import { storage } from '../storage';

function sniff(b: Buffer): string {
  const head = b.subarray(0, 5).toString();
  if (head === '<svg ' || head === '<?xml') return 'image/svg+xml';
  if (b.readUInt32BE(0) === 0x89504e47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  return 'application/octet-stream';
}

/** Serves a stored render. Callers must have already authorized access. SVG demo previews are sandboxed with a CSP. */
export async function serveRender(assetId: string): Promise<Response> {
  const bytes = await storage.get(assetId).catch(() => null);
  if (!bytes) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(bytes), { headers: {
    'content-type': sniff(bytes), 'cache-control': 'private, max-age=300', 'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
  } });
}
