import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config';

// Thin local-disk adapter. Ids are generated server-side (base64url), never user input.
const file = (id: string) => path.join(config.storageDir, id.replace(/[^A-Za-z0-9_-]/g, ''));
export const storage = {
  async put(id: string, bytes: Buffer) { await mkdir(config.storageDir, { recursive: true }); await writeFile(file(id), bytes); },
  get: (id: string) => readFile(file(id)),
  remove: (id: string) => rm(file(id), { force: true }),
};
