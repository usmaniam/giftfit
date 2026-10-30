# Asset and third-party licenses

## Project assets

| Asset | Source | License |
|---|---|---|
| `public/catalog/*.svg` | Placeholder product tiles generated for this project | MIT (same as code) |
| `fixtures/demo/*.svg` | Illustrated demo previews from `scripts/gen-demo-fixtures.py` | MIT (same as code) |
| `fixtures/demo/sample-person.png` | Illustration drawn programmatically for this project (no real person) | MIT (same as code) |
| `src/app/icon.svg` | Drawn for this project | MIT (same as code) |
| `docs/screenshots/*.png` | Screenshots of this app running in demo mode | MIT (same as code) |
| Fonts | None bundled. The UI uses system font stacks (headings fall back through Iowan Old Style, Palatino, Georgia) | n/a |

The catalog's product images are placeholder tiles. Any real product photo added later should be listed here with its source and license, and must not show brand logos or trademarks.

## Third-party software (production dependencies)

Production dependencies are permissively licensed (MIT, Apache-2.0, BSD, ISC and similar), with these exceptions to note:

| Package | License | Notes |
|---|---|---|
| `@img/sharp-libvips-*` | LGPL-3.0-or-later | Transitive dependency of Next.js image optimization. Used as an unmodified, separately distributed binary; this app does not call it directly |
| `caniuse-lite` | CC-BY-4.0 | Browser-support data used by build tooling. Attribution: © Alexis Deveria and contributors, https://github.com/browserslist/caniuse-lite |
| `lightningcss` | MPL-2.0 | Used at build time by Tailwind CSS v4, unmodified |

Generated with `pnpm licenses list --prod`.
