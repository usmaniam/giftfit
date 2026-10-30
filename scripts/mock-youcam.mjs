// Local stand-in for the YouCam S2S API, following the request/response shapes described in the README ("YouCam APIs used").
// NOT the real service: it exists so the live code path (upload -> task -> poll -> download) can be run without a key.
// Usage: node scripts/mock-youcam.mjs   (port 4010; MOCK_FAIL=1 makes every task end in "error")
import http from 'node:http';
import { appendFileSync } from 'node:fs';

const PORT = 4010, LOG = process.env.MOCK_LOG ?? '/tmp/mock-youcam.log';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const polls = new Map();
let n = 0;

http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks), url = new URL(req.url, `http://localhost:${PORT}`);
  let body = null; try { body = JSON.parse(raw.toString()); } catch {}
  appendFileSync(LOG, JSON.stringify({ method: req.method, path: url.pathname, auth: req.headers.authorization ?? null, body }) + '\n');
  const json = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };

  if (url.pathname.startsWith('/upload/') && req.method === 'PUT') { res.writeHead(200); return res.end(); }
  if (url.pathname.startsWith('/result/')) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
  if (req.headers.authorization !== 'Bearer testkey') return json(401, { status: 401, error: 'unauthorized' });

  if (req.method === 'POST' && url.pathname.startsWith('/s2s/v2.0/file')) {
    const id = `file_${++n}`;
    return json(200, { status: 200, data: { files: [{ file_id: id, requests: [{ url: `http://localhost:${PORT}/upload/${id}`, headers: { 'content-type': body.files[0].content_type } }] }] } });
  }
  if (req.method === 'POST' && url.pathname.startsWith('/s2s/v2.0/task/')) {
    const id = `task_${++n}`; polls.set(id, 0);
    return json(200, { status: 200, data: { task_id: id } });
  }
  const m = url.pathname.match(/^\/s2s\/v2\.0\/task\/.+\/(task_\d+)$/);
  if (req.method === 'GET' && m) {
    const k = (polls.get(m[1]) ?? 0) + 1; polls.set(m[1], k);
    if (k < 2) return json(200, { status: 200, data: { task_status: 'running' } });
    if (process.env.MOCK_FAIL) return json(200, { status: 200, data: { task_status: 'error', error: 'exceed_max_filesize' } });
    return json(200, { status: 200, data: { task_status: 'success', results: { url: `http://localhost:${PORT}/result/${m[1]}.png` } } });
  }
  json(404, { status: 404, error: 'not_found' });
}).listen(PORT, () => console.log(`mock YouCam on :${PORT}`));
