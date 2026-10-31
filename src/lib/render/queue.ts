import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { config } from '../config';
import { parseImage } from '../images';
import { storage } from '../storage';
import { newId } from '../tokens';
import { createTask, getTask, uploadImage, YouCamError } from '../youcam';
import { ADAPTERS, liveBlocker } from './adapters';
import { logEvent } from '../events';

type Render = typeof schema.renders.$inferSelect;
const lastCheck = new Map<string, number>();
const POLL_MIN_MS = 2000;
const PUMP_LOCK = 482_113; // arbitrary app-wide advisory lock key
const START_TIMEOUT_MS = 60_000;
const MAX_RESULT_BYTES = 20 * 1024 * 1024;

async function getRender(id: string): Promise<Render | undefined> {
  const [r] = await db.select().from(schema.renders).where(eq(schema.renders.id, id));
  return r;
}

async function fail(id: string, code: string) {
  await db.update(schema.renders).set({ status: 'error', errorCode: code, finishedAt: new Date() }).where(eq(schema.renders.id, id));
}

/** Mark the session done once nothing is queued or running. */
async function settleSession(sessionId: string) {
  const open = await db.select({ id: schema.renders.id }).from(schema.renders)
    .where(and(eq(schema.renders.sessionId, sessionId), inArray(schema.renders.status, ['queued', 'running'])));
  if (open.length === 0) await db.update(schema.giftSessions).set({ status: 'done' })
    .where(and(eq(schema.giftSessions.id, sessionId), eq(schema.giftSessions.status, 'rendering')));
}

export async function enqueueRender(sessionId: string, itemId: string, endpoint: string): Promise<string> {
  const id = newId();
  await db.insert(schema.renders).values({ id, sessionId, itemId, endpoint, status: 'queued', createdAt: new Date() });
  await db.update(schema.giftSessions).set({ status: 'rendering' }).where(eq(schema.giftSessions.id, sessionId));
  return id;
}

/** Claim queued renders up to the concurrency cap, then start them. The claim runs under a Postgres advisory lock so
 *  concurrent serverless invocations can neither double-claim a render nor exceed the cap. */
export async function pump() {
  // Finish anything already in flight first, even if nobody is polling it. Otherwise an abandoned render
  // (giver closed the tab) would hold a concurrency slot forever and eventually block every new render.
  const inflight = await db.select().from(schema.renders).where(eq(schema.renders.status, 'running'));
  await Promise.all(inflight.map(advance));
  const claimed = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${PUMP_LOCK})`);
    const running = await tx.select({ id: schema.renders.id }).from(schema.renders).where(eq(schema.renders.status, 'running'));
    const room = Math.max(0, config.maxConcurrentRenders - running.length);
    if (!room) return [] as Render[];
    const next = await tx.select({ id: schema.renders.id }).from(schema.renders).where(eq(schema.renders.status, 'queued'))
      .orderBy(asc(schema.renders.createdAt)).limit(room);
    if (!next.length) return [] as Render[];
    return tx.update(schema.renders).set({ status: 'running' })
      .where(and(eq(schema.renders.status, 'queued'), inArray(schema.renders.id, next.map((n) => n.id)))).returning();
  });
  await Promise.all(claimed.map(start));
}

async function start(r: Render) {
  try {
    const [[item], [s], [p]] = await Promise.all([
      db.select().from(schema.catalogItems).where(eq(schema.catalogItems.id, r.itemId)),
      db.select().from(schema.giftSessions).where(eq(schema.giftSessions.id, r.sessionId)),
      db.select().from(schema.recipientProfiles).where(eq(schema.recipientProfiles.sessionId, r.sessionId)),
    ]);
    if (!item || !s || !p || s.status === 'deleted') return await fail(r.id, 'session_gone');
    if (config.demoMode) {
      await db.update(schema.renders).set({ youcamTaskId: 'demo' }).where(eq(schema.renders.id, r.id));
      return;
    }
    const a = ADAPTERS[item.category];
    const blocker = liveBlocker(a, config.youcamExperimental);
    if (blocker) return await fail(r.id, blocker);
    const photoId = a.input === 'hand' ? p.handAssetId : p.selfieAssetId;
    if (!photoId) return await fail(r.id, 'input_photo_missing');
    const bytes = await storage.get(photoId);
    const img = parseImage(bytes);
    if (!img) return await fail(r.id, 'input_photo_invalid');
    const srcFileId = await uploadImage(bytes, img.mime, `${a.input}.${img.mime === 'image/png' ? 'png' : 'jpg'}`, a.fileEndpoint);
    const refUrl = item.imageUrl.startsWith('http') ? item.imageUrl : config.appUrl + item.imageUrl;
    const { task_id } = await createTask(a.endpoint!, a.build({ srcFileId, refUrl, occasion: s.occasion }));
    await db.update(schema.renders).set({ youcamTaskId: task_id, unitsSpent: a.units ?? 0 }).where(eq(schema.renders.id, r.id));
  } catch (e) {
    await fail(r.id, e instanceof YouCamError ? e.code : 'internal');
  }
}

async function storeResult(r: Render, bytes: Buffer) {
  const [p] = await db.select().from(schema.recipientProfiles).where(eq(schema.recipientProfiles.sessionId, r.sessionId));
  const id = newId();
  await storage.put(id, bytes);
  await db.insert(schema.assets).values({ id, kind: 'render', path: id, expiresAt: new Date(Date.now() + (p?.deleteAfterDays ?? 7) * 86_400_000) });
  // Atomic completion: only the poll that flips running -> success keeps its file; a concurrent loser cleans up.
  const won = (await db.update(schema.renders).set({ status: 'success', resultAssetId: id, finishedAt: new Date() })
    .where(and(eq(schema.renders.id, r.id), eq(schema.renders.status, 'running'))).returning({ id: schema.renders.id })).length === 1;
  if (!won) { await storage.remove(id); await db.delete(schema.assets).where(eq(schema.assets.id, id)); }
  else await logEvent(r.sessionId, r.itemId, 'preview');
}

/** Move one running render forward (idempotent, throttled for live tasks). */
async function advance(r: Render) {
  try {
    if (!r.youcamTaskId) {
      if (Date.now() - r.createdAt.getTime() > START_TIMEOUT_MS) await fail(r.id, 'start_timeout');
    } else if (r.youcamTaskId === 'demo') {
      if (Date.now() - r.createdAt.getTime() >= config.demoDelayMs) {
        await storeResult(r, await readFile(path.join(process.cwd(), 'fixtures/demo', `${r.itemId}.svg`)));
      }
    } else if (Date.now() - (lastCheck.get(r.id) ?? 0) >= POLL_MIN_MS) {
      lastCheck.set(r.id, Date.now());
      const t = await getTask(r.endpoint, r.youcamTaskId);
      if (t.status === 'error') await fail(r.id, 'task_error');
      else if (t.status === 'success') {
        if (!t.resultUrl) await fail(r.id, 'no_result_url');
        else {
          const res = await fetch(t.resultUrl, { signal: AbortSignal.timeout(30_000) });
          const buf = Buffer.from(await res.arrayBuffer());
          if (!res.ok || buf.length > MAX_RESULT_BYTES) await fail(r.id, 'result_download_failed');
          else await storeResult(r, buf);
        }
      }
    }
  } catch (e) {
    if (!(e instanceof YouCamError && e.code === 'network')) await fail(r.id, e instanceof YouCamError ? e.code : 'internal');
  }
  await settleSession(r.sessionId);
}

/** One poll step. Stateless: safe to call from any request, any number of times. */
export async function pollRender(id: string): Promise<Render | undefined> {
  let r = await getRender(id);
  if (!r) return undefined;
  if (r.status === 'queued') { await pump(); r = (await getRender(id))!; }
  if (r.status === 'running') await advance(r);
  return getRender(id);
}
