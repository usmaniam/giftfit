# GiftFit

**See the gift on them before you buy it, without spoiling the surprise.**

A consent-first, two-sided gifting app: the giver sends a private link, the recipient shares one selfie and sets their limits, and GiftFit previews real candidate gifts on them using YouCam's virtual try-on APIs. A gift agent ranks the options by occasion, budget and the recipient's boundaries, with a plain-language reason and an honest caveat for every pick.

![Giver board](docs/screenshots/giver-board-demo.png)

> Built for the YouCam API hackathon. **Runs with no API keys** in demo mode (illustrated previews, clearly labeled). Live YouCam rendering is implemented; [Known limitations](#known-limitations) is explicit about what has and hasn't been exercised against the real service.

## Quickstart

Requirements: **Node 20+**, **pnpm 9+** (`npm i -g pnpm`) and **Docker** (for a local Postgres; or point `DATABASE_URL` at any Postgres, including a free Supabase project).

### Demo mode (no keys needed)

```bash
git clone <repo-url> && cd giftfit
nvm use                    # or install the Node version in .nvmrc
cp .env.example .env
docker compose up -d db    # local Postgres on :5432
pnpm i && pnpm db:push && pnpm seed && pnpm dev
# open http://localhost:3000, then tap "Try the demo"
```

Verify it works: with the server running, `pnpm test:smoke` runs 20 end-to-end checks (setup, consent, renders, co-pick, checkout, delete-all).

### Live mode (real YouCam renders)

```bash
# .env
DEMO_MODE=false
YOUCAM_API_KEY=...
APP_URL=https://your-public-url     # YouCam fetches product images from this URL, so it must be reachable
GEMINI_API_KEY=...                  # optional: AI-written reasons (free key from Google AI Studio)
GIFT_AGENT_MODEL=...                # a current Flash / Flash-Lite model ID from AI Studio
```

Restart. Live rendering also needs product photos vetted against each endpoint's image spec (`image_spec_ok` in `src/db/seed.ts`); the bundled catalog uses placeholder tiles, so replace them with licensed photos (credited in `ASSETS_LICENSES.md`) before live use.

### Troubleshooting

- **`ERR_PNPM_IGNORED_BUILDS`**: run `pnpm approve-builds --all`. The repo ships `pnpm-workspace.yaml` / `package.json` allowlists that normally make this unnecessary (tested on pnpm 9, 10 and 12).
- **`ECONNREFUSED` on port 5432**: the local database isn't running. `docker compose up -d db`.
- **Reset everything**: `pnpm db:reset` (local databases only; also delete files in `storage/`).

## How it works

1. **Giver** creates a session (occasion, budget, *Surprise* or *Co-pick*) and shares a private, expiring invite link.
2. **Recipient** opens the link and goes through: consent (rendering and sharing are separate choices, plus auto-delete after 1/7/30 days) → selfie (and an optional hand photo for rings and watches) → boundaries (gift types, metal, colors to avoid, private no-gos) → what to share.
3. **Gift agent** filters the catalog by the recipient's limits *on the server*, scores what's left, and (optionally) asks Gemini to re-rank and write reasons.
4. **Renders** are queued (3 at a time, 8 per session) and appear on the giver's board as they finish, each labeled *Style preview, not an exact fit* or *Preview only, fit can differ*.
5. **Surprise mode:** the recipient never sees which items were previewed. **Co-pick mode:** the recipient hearts or vetoes previews of themselves, and the giver sees only the hearted ones.
6. **Mock checkout** records a demo purchase (no payment or personal data). The **merchant view** (`/merchant`) shows an anonymous gifting funnel.
7. The recipient can **delete everything at any time** and gets a receipt; the giver's session ends.

| Recipient consent | Boundaries | Co-pick review |
|---|---|---|
| ![consent](docs/screenshots/recipient-consent.png) | ![limits](docs/screenshots/recipient-boundaries.png) | ![review](docs/screenshots/copick-recipient-review.png) |

| Giver sees approvals | Mock checkout | Merchant view (seeded) | Delete receipt |
|---|---|---|---|
| ![approved](docs/screenshots/copick-giver-approved.png) | ![checkout](docs/screenshots/mock-checkout.png) | ![merchant](docs/screenshots/merchant-demo-data.png) | ![receipt](docs/screenshots/delete-receipt.png) |

The giver's **How these were picked** panel (the recipient's limits are never shown to the giver):

<img src="docs/screenshots/agent-reasoning.png" width="320" alt="Agent reasoning panel">

## YouCam APIs used

All calls go through `src/lib/youcam.ts` (upload → create task → poll → download). Per-category request bodies live in `src/lib/render/adapters.ts`; the queue is `src/lib/render/queue.ts`.

| Category | Endpoint | Preview type | Live status |
|---|---|---|---|
| Scarf | `POST /s2s/v2.0/task/scarf` | styled scene | **Enabled by default.** Body per the YouCam scarf docs (`src_file_id`, `ref_file_url`, `style`). |
| Clothes (top) | `/s2s/v2.0/task/cloth-v4` | overlay | Behind `YOUCAM_EXPERIMENTAL=true`: body fields unverified |
| Earrings | `/s2s/v2.0/task/2d-vto/earring` | overlay | Behind `YOUCAM_EXPERIMENTAL=true`: body fields unverified |
| Necklace | `/s2s/v2.0/task/2d-vto/necklace` | overlay | Behind `YOUCAM_EXPERIMENTAL=true`: body fields unverified |
| Bag | `/s2s/v2.0/task/bag` (+ `/file/bag`) | styled scene | Behind `YOUCAM_EXPERIMENTAL=true`: body fields unverified |
| Ring / Watch | `/s2s/v2.0/task/2d-vto/ring`, `.../watch` | overlay (hand photo) | Behind `YOUCAM_EXPERIMENTAL=true`: body fields unverified |
| Hat, Makeup look | none confirmed / needs template id | | Demo mode only |

Unverified adapters are **off by default** so the app never spends credits on guessed request bodies. The live code path is tested against `scripts/mock-youcam.mjs`, a local stand-in built from the documented shapes (it is *not* the real service). To use it: `node scripts/mock-youcam.mjs`, then `DEMO_MODE=false YOUCAM_API_KEY=testkey YOUCAM_BASE_URL=http://localhost:4010`.

## Architecture

```mermaid
flowchart LR
  G[Giver phone] -->|session, shortlist, board| API[Next.js API routes]
  R[Recipient phone] -->|consent, photos, reactions, delete| API
  API --> DB[(Postgres via Drizzle: Supabase in production)]
  API --> FS[(Photos, renders: local disk in dev, Supabase Storage in production)]
  API --> AG[Gift agent: hard filter, scoring, optional Gemini]
  API --> Q[Render queue: 3 concurrent, 8 per session]
  Q -->|live| YC[YouCam S2S API]
  Q -->|demo| FX[Illustrated fixtures]
  M[Merchant view] --> DB
```

Key decisions:

- **The server enforces every limit.** The agent proposes; `src/lib/boundaries.ts` decides. Category, budget, avoided colors, metal, hand-photo and live-adapter checks run on every render request, whatever the UI or agent says.
- **Stateless queue.** Render state lives in the database; any request can advance it. Polling the list also finishes abandoned renders, so a closed tab can't hold a slot forever.
- **Postgres + object storage** so the app runs on stateless serverless hosting (Vercel). Locally that is a Docker Postgres and local disk; in production it is Supabase Postgres and a private Supabase Storage bucket. The queue claims work under a Postgres advisory lock, so concurrent invocations can't double-claim a render or exceed the concurrency cap.
- **Honest labeling is server-side**: caveats are forced to mention preview limits (and ring size) regardless of what a model writes.

## Privacy and consent model

- Rendering consent and sharing consent are separate. Without sharing consent the giver sees nothing.
- Photos are stored only in a private storage bucket (or local disk in development), reachable only through server routes, expire after the recipient's chosen 1/7/30 days, and are re-encoded in the browser (EXIF/GPS stripped) and validated by magic bytes on the server. Photos are never sent to the LLM.
- **Gemini receives only**: the occasion, a budget range, and candidate product metadata. No photos, names, notes, or the recipient's limits (candidates are already filtered by them). Reasons that echo a limit (for example "avoids orange") are discarded before the giver sees them. Free-tier Gemini usage may be covered by different data-use terms than paid usage; check Google's current terms, which is why nothing identifying is sent.
- The giver never sees which limits applied. In co-pick mode they see only items the recipient hearted.
- Invite tokens are random, stored only as HMAC hashes, and expire after 14 days. Set `INVITE_TOKEN_SECRET` in production (there is no auto-generated fallback).
- **Delete my data** removes photos, renders, picks, preferences and live analytics events immediately, and deactivates the link. Seeded demo analytics are unaffected.
- Merchant analytics are anonymous: session id, item id and event type only.

## Demo mode

`DEMO_MODE=true` (default) runs the same queue, polling and UI without calling YouCam. Previews are **illustrations of an illustrated sample person**, generated by `scripts/gen-demo-fixtures.py`, and labeled "DEMO PREVIEW · illustrated, not a real render". They are never shown as real renders. The "Try the demo" button creates a ready session for the sample recipient so you can skip the invite step. Merchant numbers are seeded demo data, labeled as such.

## Known limitations

- **Live rendering has been exercised only against a local mock** (`scripts/mock-youcam.mjs`), not the real YouCam service, so no real renders are included. The *Live status* column above reflects documented request shapes, not confirmed live results.
- Previews show style, not exact fit. Rings and watches can't confirm size.
- Hat and makeup-look previews exist only in demo mode.
- The Gemini path is tested against a mock server, not the real API.
- Undertone scoring exists in code but is inactive: the color-profile analysis isn't wired up.
- Giver access is a capability URL (the unguessable session id), not an account. There is no rate limiting or abuse detection, and photos are not encrypted at rest.
- A giver can infer how many previews a recipient declined in co-pick mode (proposed minus approved minus pending).
- A failed render shows a message but no automatic replacement is chosen.
- Tested in headless Chromium at phone size and in Node. Not tested on iOS Safari or Android, and no formal accessibility audit (semantic HTML, focus styles, `aria-pressed` and live regions are in place).
- The database tables have row-level security enabled with no policies, so Supabase's public API cannot read them; only the server's database connection can. Photos are served only through token-checked routes.

## Testing notes

```bash
pnpm typecheck
pnpm test:smoke          # needs a running server in DEMO_MODE (pnpm dev)
pnpm check:secrets       # quick credential-pattern scan before publishing
pnpm db:reset            # wipe and re-seed the LOCAL database
```

Mock servers for the optional integrations: `scripts/mock-youcam.mjs` (port 4010) and `scripts/mock-gemini.mjs` (port 4020, `MODE=ok|429once|429|badjson|badids|badschema|leak|slow`).

## Deploy (Vercel + Supabase)

1. **Supabase**: create a project. Copy the *transaction pooler* connection string (port 6543) for the app, and the *direct* (or session pooler) string for setup. Copy the project URL and the `service_role` key (Project Settings, API).
2. **Create tables and seed** from your machine, using the direct string. `pnpm seed` also creates the private `giftfit` storage bucket when the Supabase variables are set:

   ```bash
   DATABASE_URL="<direct string>" SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm db:push
   DATABASE_URL="<direct string>" SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm seed
   ```
3. **Vercel**: import the repo. Set these environment variables: `DATABASE_URL` (pooler string), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `INVITE_TOKEN_SECRET` and `CRON_SECRET` (both `openssl rand -hex 24`), `DEMO_MODE=true`, and optionally `APP_URL`, `GEMINI_API_KEY`, `GIFT_AGENT_MODEL`, `YOUCAM_API_KEY`. Pick a Vercel function region close to your Supabase region.
4. **Verify**: `/api/health` should return `ok: true`, `catalogItems: 12` and `storage: "supabase"`.

`vercel.json` sets a 60 s function limit and a daily cron (`/api/cron/purge`) that deletes expired photos. Vercel caps request bodies at 4.5 MB; the browser downsizes photos before upload and the server rejects anything over 4 MB.

## License and credits

MIT, see [`LICENSE`](LICENSE). Asset and third-party credits are in [`ASSETS_LICENSES.md`](ASSETS_LICENSES.md). No brand logos or trademarks are used.
