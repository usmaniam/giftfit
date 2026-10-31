import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { config } from './config';

// Ids are generated server-side (base64url), never user input; this strips anything else anyway.
const safe = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, '');

type Storage = {
  put(id: string, bytes: Buffer): Promise<void>;
  get(id: string): Promise<Buffer>;
  remove(id: string): Promise<void>;
};

/** Local disk: development and Docker-style hosting with a volume. */
const local: Storage = {
  async put(id, bytes) { await mkdir(config.storageDir, { recursive: true }); await writeFile(path.join(config.storageDir, safe(id)), bytes); },
  get: (id) => readFile(path.join(config.storageDir, safe(id))),
  remove: (id) => rm(path.join(config.storageDir, safe(id)), { force: true }),
};

let client: ReturnType<typeof createClient> | undefined;
const bucket = () => {
  client ??= createClient(config.supabaseUrl, config.supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client.storage.from(config.storageBucket);
};

/** Supabase Storage, private bucket, server-side service-role access only. Required on Vercel (no persistent disk). */
const supabase: Storage = {
  async put(id, bytes) {
    const { error } = await bucket().upload(safe(id), bytes, { contentType: 'application/octet-stream', upsert: true });
    if (error) throw new Error(`storage_put_failed: ${error.message}`);
  },
  async get(id) {
    const { data, error } = await bucket().download(safe(id));
    if (error || !data) throw new Error('storage_not_found');
    return Buffer.from(await data.arrayBuffer());
  },
  async remove(id) {
    const { error } = await bucket().remove([safe(id)]);
    if (error) throw new Error(`storage_remove_failed: ${error.message}`);
  },
};

export const storage: Storage = config.storageDriver === 'supabase' ? supabase : local;

/** Creates the private bucket if it does not exist. Called from the seed script. */
export async function ensureBucket() {
  if (config.storageDriver !== 'supabase') return;
  if (!config.supabaseUrl || !config.supabaseServiceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the supabase storage driver');
  const c = createClient(config.supabaseUrl, config.supabaseServiceKey, { auth: { persistSession: false } });
  const { error } = await c.storage.createBucket(config.storageBucket, { public: false, fileSizeLimit: 20 * 1024 * 1024 });
  if (error && !/already exists/i.test(error.message)) throw new Error(`createBucket failed: ${error.message}`);
}
