import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { and, asc, eq, inArray } from 'drizzle-orm';
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
const START_TIMEOUT_MS = 60_000;
const MAX_RESULT_BYTES = 20 * 1024 * 1024;

const getRender = (id: string) => db.select().from(schema.renders).where(eq(schema.renders.id, id)).get();

function fail(id: string, code: string) {
  db.update(schema.renders).set({ status: 'error', errorCode: code, finishedAt: new Date() }).where(eq(schema.renders.id, id)).run();
}

/** Mark the session done once nothing is queued or running. */
function settleSession(sessionId: string) {
  const open = db.select().from(schema.renders)
    .where(and(eq(schema.renders.sessionId, sessionId), inArray(schema.renders.status, ['queued', 'running']))).all();
  if (open.length === 0) db.update(schema.giftSessions).set({ status: 'done' })
    .where(and(eq(schema.giftSessions.id, sessionId), eq(schema.giftSessions.status, 'rendering'))).run();
}

export function enqueueRender(sessionId: string, itemId: string, endpoint: string): string {
  const id = newId();
  db.insert(schema.renders).values({ id, sessionId, itemId, endpoint, status: 'queued', createdAt: new Date() }).run();
  db.update(schema.giftSessions).set({ status: 'rendering' }).where(eq(schema.giftSessions.id, sessionId)).run();
  return id;
}

/** Claim queued renders up to the concurrency cap (synchronous, so concurrent pumps can't double-claim), then start them. */
export async function pump() {
  // Finish anything already in flight first, even if nobody is polling it. Otherwise an abandoned render
  // (giver closed the tab) would hold a concurrency slot forever and eventually block every new render.
  const inflight = db.select().from(schema.renders).where(eq(schema.renders.status, 'running')).all();
  await Promise.all(inflight.map(advance));
  const running = db.select().from(schema.renders).where(eq(schema.renders.status, 'running')).all().length;
  const room = Math.max(0, config.maxConcurrentRenders - running);
  if (!room) return;
  const claimed = db.select().from(schema.renders).where(eq(schema.renders.status, 'queued'))
    .orderBy(asc(schema.renders.createdAt)).limit(room).all();
  for (const r of claimed) db.update(schema.renders).set({ status: 'running' }).where(eq(schema.renders.id, r.id)).run();
  await Promise.all(claimed.map(start));
}

async function start(r: Render) {
  try {
    const item = db.select().from(schema.catalogItems).where(eq(schema.catalogItems.id, r.itemId)).get();
    const s = db.select().from(schema.giftSessions).where(eq(schema.giftSessions.id, r.sessionId)).get();
    const p = db.select().from(schema.recipientProfiles).where(eq(schema.recipientProfiles.sessionId, r.sessionId)).get();
    if (!item || !s || !p || s.status === 'deleted') return fail(r.id, 'session_gone');
    if (config.demoMode) {
      db.update(schema.renders).set({ youcamTaskId: 'demo' }).where(eq(schema.renders.id, r.id)).run();
      return;
    }
    const a = ADAPTERS[item.category];
    const blocker = liveBlocker(a, config.youcamExperimental);
    if (blocker) return fail(r.id, blocker);
    const photoId = a.input === 'hand' ? p.handAssetId : p.selfieAssetId;
    if (!photoId) return fail(r.id, 'input_photo_missing');
    const bytes = await storage.get(photoId);
    const img = parseImage(bytes);
    if (!img) return fail(r.id, 'input_photo_invalid');
    const srcFileId = await uploadImage(bytes, img.mime, `${a.input}.${img.mime === 'image/png' ? 'png' : 'jpg'}`, a.fileEndpoint);
    const refUrl = item.imageUrl.startsWith('http') ? item.imageUrl : config.appUrl + item.imageUrl;
    const { task_id } = await createTask(a.endpoint!, a.build({ srcFileId, refUrl, occasion: s.occasion }));
    db.update(schema.renders).set({ youcamTaskId: task_id, unitsSpent: a.units ?? 0 }).where(eq(schema.renders.id, r.id)).run();
  } catch (e) {
    fail(r.id, e instanceof YouCamError ? e.code : 'internal');
  }
}

async function storeResult(r: Render, bytes: Buffer) {
  const p = db.select().from(schema.recipientProfiles).where(eq(schema.recipientProfiles.sessionId, r.sessionId)).get();
  const id = newId();
  await storage.put(id, bytes);
  db.insert(schema.assets).values({ id, kind: 'render', path: id, expiresAt: new Date(Date.now() + (p?.deleteAfterDays ?? 7) * 86_400_000) }).run();
  // Atomic completion: only the poll that flips running -> success keeps its file; a concurrent loser cleans up.
  const won = db.update(schema.renders).set({ status: 'success', resultAssetId: id, finishedAt: new Date() })
    .where(and(eq(schema.renders.id, r.id), eq(schema.renders.status, 'running'))).run().changes === 1;
  if (!won) { await storage.remove(id); db.delete(schema.assets).where(eq(schema.assets.id, id)).run(); }
  else logEvent(r.sessionId, r.itemId, 'preview');
}

/** Move one running render forward (idempotent, throttled for live tasks). */
async function advance(r: Render) {
  try {
    if (!r.youcamTaskId) {
      if (Date.now() - r.createdAt.getTime() > START_TIMEOUT_MS) fail(r.id, 'start_timeout');
    } else if (r.youcamTaskId === 'demo') {
      if (Date.now() - r.createdAt.getTime() >= config.demoDelayMs) {
        await storeResult(r, await readFile(path.join(process.cwd(), 'fixtures/demo', `${r.itemId}.svg`)));
      }
    } else if (Date.now() - (lastCheck.get(r.id) ?? 0) >= POLL_MIN_MS) {
      lastCheck.set(r.id, Date.now());
      const t = await getTask(r.endpoint, r.youcamTaskId);
      if (t.status === 'error') fail(r.id, 'task_error');
      else if (t.status === 'success') {
        if (!t.resultUrl) fail(r.id, 'no_result_url');
        else {
          const res = await fetch(t.resultUrl, { signal: AbortSignal.timeout(30_000) });
          const buf = Buffer.from(await res.arrayBuffer());
          if (!res.ok || buf.length > MAX_RESULT_BYTES) fail(r.id, 'result_download_failed');
          else await storeResult(r, buf);
        }
      }
    }
  } catch (e) {
    if (!(e instanceof YouCamError && e.code === 'network')) fail(r.id, e instanceof YouCamError ? e.code : 'internal');
  }
  settleSession(r.sessionId);
}

/** One poll step. Stateless: safe to call from any request, any number of times. */
export async function pollRender(id: string): Promise<Render | undefined> {
  let r = getRender(id);
  if (!r) return undefined;
  if (r.status === 'queued') { await pump(); r = getRender(id)!; }
  if (r.status === 'running') await advance(r);
  return getRender(id);
}
