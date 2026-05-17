# Physics Sandbox

A 2D and 3D rigid-body physics playground that explains itself. Drag in empty space to spawn objects, watch live readouts for energy and momentum, and scale the explanations from "Curious" to "Expert" with the 4-level educator system. Free to use; **Pro is a $9 one-time unlock** (save scenes + export derivations). 2D mode is plain Canvas + a hand-rolled solver. 3D mode is Three.js + Rapier3D. Static site — no build step, no server runtime, no analytics. Live at [physics.stacklis.com](https://physics.stacklis.com).

## Quick start

```bash
npm run dev
```

Serves the repo root on port `8081` bound to `0.0.0.0` so it's reachable across your LAN / Tailnet.

- Local:    http://localhost:8081/
- Tailnet:  http://100.99.119.80:8081/  (Stacklis main PC node)

The free demo is at `/app/?free=1`. The landing page is `/`. The full app shell is `/app/`.

## Repo layout

```
index.html         Landing page (marketing + pricing + FAQ)
landing.html       Alternate landing layout (rarely served, kept for A/B)
app/index.html     The actual sandbox shell — topbar, panels, importmap
app.js             2D mode glue — tools, UI events, save/load, Pro gating
app3d.js           3D mode glue — same role as app.js but for Three.js scene
engine.js          2D physics solver (bodies, collisions, constraints, ropes)
engine3d.js        3D physics adapter on top of Rapier3D
education.js       2D educator content (4-level explanations + derivations)
education3d.js     3D educator content
layout.js          Panel docking, resizing, floating rects, hide/collapse state
render3d.js        Three.js scene management, camera, lights
styles.css         All styling — tokens, panels, topbar, landing, docs
manifest.json      PWA manifest
tests/             node --test runner unit tests
scripts/           Icon generation + dev scripts
docs/              Plans, specs, design notes (mostly archived)
docs/archive/      Shipped plans preserved for context
marketing/         Capture scripts and screenshot assets
android-app/       Capacitor Android wrapper — see android-app/README.md
vercel.json        Vercel deploy config (headers, rewrites, cache rules)
```

## Vercel deploy

Auto-on-push to `main`. Vercel reads `vercel.json` for routing, cache headers, and the CSP. There is no build step — Vercel just publishes the static files.

To preview a branch deploy, push to the branch and grab the preview URL from the Vercel dashboard.

## Capacitor Android

The Android wrapper lives in `android-app/`. It syncs the root `app/`, JS bundles, CSS, and assets into `android-app/www/` and runs them inside a Capacitor WebView.

```bash
cd android-app
npm install              # one-time, installs Capacitor CLI
npm run sync             # pulls latest source into www/ and runs cap sync
npx cap open android     # opens Android Studio for build / release
```

See `android-app/README.md` for the full release flow (keystore, signed AAB, Play Store upload).

## Stripe Pro

Pro is a $9 one-time payment via Stripe checkout. The entitlement is a client-side flag (`ps.pro` in `localStorage`) — see the entitlement code in `app.js`. Anyone with developer tools can flip it on their own device; we ship the simulator on the honor system. There's an ops-side redeem-code path for support / refunds / comp licenses; the code lives in the same area of `app.js`.

The privacy policy at `/privacy.html` documents the localStorage inventory and the honor-system caveat in plain English.

## Testing

```bash
npm test
```

Runs every `tests/**/*.test.mjs` file via the built-in `node --test` runner. No external test framework dependency.

GitHub Actions runs the same command on push and PR (see `.github/workflows/test.yml`).

## Contributing

PRs welcome. A few style notes:

- 2D code (`app.js`, `engine.js`, `education.js`) is plain script-tag JS with `var` / `function` declarations and global helpers. Match that style — don't introduce ESM imports here.
- 3D code (`app3d.js`, `engine3d.js`, `education3d.js`, `render3d.js`, `layout.js`) is ESM. The importmap in `app/index.html` resolves `three` and `@dimforge/rapier3d-compat` from CDN.
- No build step. If you need a dependency, prefer the importmap CDN path over adding to `package.json`.
- Tests go in `tests/`, suffixed `.test.mjs`, written against `node --test`.
- Keep the privacy story intact: no analytics, no telemetry, no third-party scripts beyond the importmap CDN, Stripe, and Google Fonts.

## License

MIT. See `package.json`.
