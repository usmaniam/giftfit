// Local stand-in for the Gemini generateContent endpoint, used to test the agent's LLM path without a key.
// NOT the real service. MODE: ok | 429once | 429 | badjson | badids | badschema | leak | slow   (port 4020)
import http from 'node:http';
import { appendFileSync } from 'node:fs';

const MODE = process.env.MODE ?? 'ok', LOG = process.env.MOCK_LOG ?? '/tmp/mock-gemini.log';
let calls = 0;
const reply = (res, text) => { res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }] })); };

http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  if (!req.url.includes(':generateContent')) { res.writeHead(404); return res.end(); }
  calls++; appendFileSync(LOG, JSON.stringify({ n: calls, url: req.url, key: req.headers['x-goog-api-key'] ?? null, body: raw }) + '\n');
  let prompt = {}; try { prompt = JSON.parse(JSON.parse(raw).contents[0].parts[0].text); } catch {}
  const ids = (prompt.candidates ?? []).map((c) => c.id).reverse(); // deliberately reorder vs. the rules ranking
  const mk = (extra = '') => JSON.stringify({ picks: ids.map((id) => ({ itemId: id, reason: `A good ${id.split('-')[0]} choice for this occasion.${extra}`, caveat: 'Colors may look different in person.' })) });

  if (MODE === '429' || (MODE === '429once' && calls === 1)) { res.writeHead(429, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'quota' } })); }
  if (MODE === 'slow') return setTimeout(() => reply(res, mk()), 15000);
  if (MODE === 'badjson') return reply(res, 'Sure! here are my picks');
  if (MODE === 'badids') return reply(res, JSON.stringify({ picks: [{ itemId: 'made-up-item', reason: 'x', caveat: 'y' }] }));
  if (MODE === 'badschema') return reply(res, JSON.stringify({ ranking: ids }));
  if (MODE === 'leak') return reply(res, JSON.stringify({ picks: ids.map((id, i) => ({ itemId: id, reason: i % 2 ? 'Avoids orange, which the recipient dislikes.' : `Lovely ${id.split('-')[0]} for the occasion.`, caveat: 'Fine.' })) }));
  reply(res, mk());
}).listen(4020, () => console.log(`mock Gemini on :4020 (${MODE})`));
