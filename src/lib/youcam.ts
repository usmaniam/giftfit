import { config } from './config';

export class YouCamError extends Error {
  constructor(public code: string, message: string, public httpStatus?: number) { super(message); }
}

const TIMEOUT_MS = 20_000;

async function yc<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!config.youcamKey) throw new YouCamError('no_api_key', 'YOUCAM_API_KEY is not set');
  const res = await fetch(config.youcamBase + path, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Authorization: `Bearer ${config.youcamKey}`, 'content-type': 'application/json', ...(init.headers || {}) },
  }).catch((e) => { throw new YouCamError('network', String(e?.message ?? e)); });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.status !== 200) {
    const code = String(json?.error_code ?? json?.error ?? `http_${res.status}`);
    throw new YouCamError(code, String(json?.error ?? json?.message ?? 'YouCam request failed'), res.status);
  }
  return json.data as T;
}

/** 1) register file, 2) PUT bytes to the signed URL, 3) return file_id. */
export async function uploadImage(bytes: Buffer, mime: 'image/jpeg' | 'image/png', name: string, filePath = '/s2s/v2.0/file') {
  const data = await yc<{ files: { file_id: string; requests: { url: string; headers: Record<string, string> }[] }[] }>(
    filePath, { method: 'POST', body: JSON.stringify({ files: [{ content_type: mime, file_name: name, file_size: bytes.length }] }) });
  const f = data.files?.[0];
  if (!f?.requests?.[0]) throw new YouCamError('bad_upload_response', 'No upload URL returned');
  const put = await fetch(f.requests[0].url, { method: 'PUT', headers: f.requests[0].headers, body: new Uint8Array(bytes), signal: AbortSignal.timeout(TIMEOUT_MS) })
    .catch((e) => { throw new YouCamError('network', String(e?.message ?? e)); });
  if (!put.ok) throw new YouCamError('upload_failed', `Upload failed (${put.status})`, put.status);
  return f.file_id;
}

export const createTask = (endpoint: string, body: object) =>
  yc<{ task_id: string }>(endpoint, { method: 'POST', body: JSON.stringify(body) });

type RawTask = { task_status: 'running' | 'success' | 'error'; results?: { url?: string } | { url?: string }[]; error?: string };
/** Poll once. The caller decides cadence. Result shape is parsed defensively (object or array). */
export async function getTask(endpoint: string, id: string) {
  const t = await yc<RawTask>(`${endpoint}/${id}`);
  const r = Array.isArray(t.results) ? t.results[0] : t.results;
  return { status: t.task_status, resultUrl: r?.url, error: t.error };
}
