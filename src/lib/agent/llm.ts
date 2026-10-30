import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import type { schema } from '@/db';
import { config } from '../config';

type Item = typeof schema.catalogItems.$inferSelect;
export type LlmPick = { itemId: string; reason: string; caveat: string };
export type LlmResult = { ok: true; picks: LlmPick[] } | { ok: false; why: string };

const Out = z.object({ picks: z.array(z.object({ itemId: z.string(), reason: z.string().trim().min(1).max(220), caveat: z.string().trim().min(1).max(220) })).min(1) });

const SYSTEM = [
  'You are a gift stylist ranking candidate gifts for "the recipient".',
  'Use ONLY the fields provided. Never invent facts about the recipient (looks, taste, personality, size).',
  'Never mention limits, boundaries, preferences, or what the recipient avoids or allows.',
  'Order ALL candidates best-first for the occasion and budget, favoring variety across categories.',
  'For each: one sentence reason (max 140 chars) from the product fields, and one sentence caveat (max 120 chars) about the product or the preview.',
  'Return JSON only.',
].join(' ');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isRetryable = (e: unknown) => /429|503|RESOURCE_EXHAUSTED|UNAVAILABLE/i.test(String((e as { status?: number; message?: string })?.status ?? '') + String((e as Error)?.message ?? e));

export const llmEnabled = () => config.agentEnabled && !!config.geminiKey && !!config.geminiModel;

/**
 * One call per gift session. Privacy: the prompt holds only the occasion, a budget range, and candidate product
 * metadata. No names, notes, photos, categories/metal/color limits, or raw profile data. Candidates are already
 * filtered by the recipient's limits server-side, so the model needs none of them.
 */
export async function rerank(input: { occasion: string; budgetMin: number; budgetMax: number; undertone: string | null; candidates: Item[] }): Promise<LlmResult> {
  const ai = new GoogleGenAI({ apiKey: config.geminiKey, ...(config.geminiBaseUrl ? { httpOptions: { baseUrl: config.geminiBaseUrl } } : {}) });
  const prompt = JSON.stringify({
    occasion: input.occasion, budgetUSD: [input.budgetMin, input.budgetMax],
    ...(input.undertone ? { sharedUndertone: input.undertone } : {}),
    candidates: input.candidates.map((i) => ({ id: i.id, name: i.name, category: i.category, priceUSD: i.price, colors: i.colors, metal: i.metal, tags: i.tags })),
  });
  const deadline = Date.now() + config.llmTimeoutMs;
  let lastWhy = 'unknown';

  for (let attempt = 0; attempt < 3; attempt++) {
    const left = deadline - Date.now();
    if (left <= 0) return { ok: false, why: 'timeout' };
    try {
      const call = ai.models.generateContent({
        model: config.geminiModel, contents: prompt,
        config: {
          systemInstruction: SYSTEM, temperature: 0.3, responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT, required: ['picks'],
            properties: { picks: { type: Type.ARRAY, items: { type: Type.OBJECT, required: ['itemId', 'reason', 'caveat'],
              properties: { itemId: { type: Type.STRING }, reason: { type: Type.STRING }, caveat: { type: Type.STRING } } } } },
          },
        },
      });
      const res = await Promise.race([call, sleep(left).then(() => { throw new Error('timeout'); })]);
      let json: unknown;
      try { json = JSON.parse(res.text ?? ''); } catch { return { ok: false, why: 'invalid_json' }; }
      const parsed = Out.safeParse(json);
      if (!parsed.success) return { ok: false, why: 'schema_mismatch' };
      const known = new Set(input.candidates.map((c) => c.id));
      const seen = new Set<string>();
      const picks = parsed.data.picks.filter((p) => known.has(p.itemId) && !seen.has(p.itemId) && seen.add(p.itemId));
      return picks.length ? { ok: true, picks } : { ok: false, why: 'no_valid_picks' };
    } catch (e) {
      if ((e as Error)?.message === 'timeout') return { ok: false, why: 'timeout' };
      lastWhy = isRetryable(e) ? 'rate_limited' : 'api_error';
      if (!isRetryable(e)) return { ok: false, why: lastWhy };
      await sleep(Math.min(400 * 2 ** attempt, Math.max(0, deadline - Date.now())));
    }
  }
  return { ok: false, why: lastWhy };
}
