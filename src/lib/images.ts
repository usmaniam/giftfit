export type ParsedImage = { mime: 'image/jpeg' | 'image/png'; width: number; height: number; bytes: Buffer };

/** Validates by magic bytes (not the client's mime), reads dimensions, and drops JPEG EXIF/XMP (APP1: GPS, device). */
export function parseImage(buf: Buffer): ParsedImage | null {
  if (buf.length > 12 && buf.readUInt32BE(0) === 0x89504e47 && buf.toString('ascii', 12, 16) === 'IHDR') {
    return { mime: 'image/png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), bytes: buf };
  }
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const out: Buffer[] = [buf.subarray(0, 2)];
  let i = 2, width = 0, height = 0;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return null;
    const m = buf[i + 1];
    if (m === 0xd9) break;
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) return null;
    const isSof = m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m);
    if (isSof) { height = buf.readUInt16BE(i + 5); width = buf.readUInt16BE(i + 7); }
    if (m === 0xda) { out.push(buf.subarray(i)); break; } // entropy-coded data to end
    if (m !== 0xe1) out.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  if (!width || !height) return null;
  return { mime: 'image/jpeg', width, height, bytes: Buffer.concat(out) };
}
