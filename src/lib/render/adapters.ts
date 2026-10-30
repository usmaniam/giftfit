import type { Category } from '../constants';

export type AdapterCtx = { srcFileId: string; refUrl: string; occasion: string };
export type Adapter = {
  endpoint: string | null;      // null = no live endpoint known (demo only)
  fileEndpoint?: string;        // feature-specific upload endpoint, when the docs require one
  input: 'selfie' | 'hand';
  units: number | null;         // null = cost unverified
  kind: 'scene' | 'overlay';    // scene = styled/generated (vibe, not fit); overlay = placed on the person
  bodyVerified: boolean;        // false = body fields are a best guess; gated behind YOUCAM_EXPERIMENTAL
  build: (c: AdapterCtx) => object;
};

// Verified style names from the YouCam scarf docs, mapped to occasions.
const SCARF_STYLE: Record<string, string> = {
  birthday: 'style_light_luxury', holiday: 'style_cottagecore', anniversary: 'style_french_elegance', 'thank-you': 'style_modern_chic',
};
const basic = (c: AdapterCtx) => ({ src_file_id: c.srcFileId, ref_file_url: c.refUrl });

export const ADAPTERS: Record<Category, Adapter> = {
  scarf: {
    endpoint: '/s2s/v2.0/task/scarf', input: 'selfie', units: 2, kind: 'scene', bodyVerified: true,
    build: (c) => ({ src_file_id: c.srcFileId, ref_file_url: c.refUrl, style: SCARF_STYLE[c.occasion] ?? 'style_modern_chic' }),
  },
  // Everything below: endpoint is from the docs, but request body fields are UNVERIFIED (see "YouCam APIs used" in the README).
  top: { endpoint: '/s2s/v2.0/task/cloth-v4', input: 'selfie', units: 2, kind: 'overlay', bodyVerified: false, build: basic },
  earrings: { endpoint: '/s2s/v2.0/task/2d-vto/earring', input: 'selfie', units: 1, kind: 'overlay', bodyVerified: false, build: basic },
  necklace: { endpoint: '/s2s/v2.0/task/2d-vto/necklace', input: 'selfie', units: 1, kind: 'overlay', bodyVerified: false, build: basic },
  bag: { endpoint: '/s2s/v2.0/task/bag', fileEndpoint: '/s2s/v2.0/file/bag', input: 'selfie', units: null, kind: 'scene', bodyVerified: false, build: basic },
  ring: { endpoint: '/s2s/v2.0/task/2d-vto/ring', fileEndpoint: '/s2s/v2.0/file/2d-vto/ring', input: 'hand', units: null, kind: 'overlay', bodyVerified: false, build: basic },
  watch: { endpoint: '/s2s/v2.0/task/2d-vto/watch', input: 'hand', units: null, kind: 'overlay', bodyVerified: false, build: basic },
  // No confirmed endpoint / needs a look template id: demo mode only.
  hat: { endpoint: null, input: 'selfie', units: null, kind: 'scene', bodyVerified: false, build: basic },
  look: { endpoint: null, input: 'selfie', units: 2, kind: 'overlay', bodyVerified: false, build: basic },
};

/** Why a category can't be rendered live right now, or null if it can. */
export function liveBlocker(a: Adapter, experimental: boolean): string | null {
  if (!a.endpoint) return 'no_live_endpoint';
  if (!a.bodyVerified && !experimental) return 'adapter_unverified';
  return null;
}
