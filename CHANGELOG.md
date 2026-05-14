# Changelog

All notable changes to Physics Sandbox land here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.0.2] — 2026-05-14

### Added
- Share-link size caps (`SHARE_INPUT_MAX = 32 KiB`, `SHARE_DECOMPRESSED_MAX = 1 MiB`) — zip-bomb / oversized-input DoS defense on `#scene=` fragments.

### Changed
- Android `versionCode` 1→2, `versionName` "1.0"→"1.0.1" (Play Store upload prerequisite).
- Android FileProvider `cache-path` narrowed from `"."` to `"images/"`.
- Asset `?v=` query strings synced to v=85 (styles) / v=80 (app.js) across root, `app/`, `landing.html`, `privacy.html`, `terms.html`, and `android-app/www/index.html`.
- Repo hygiene: untracked the cached screenshot/diag artifacts that were committed before the matching `.gitignore` rule (already-ignored files only).

### Fixed
- `shadowBlur` on collision-contact visualization now skipped on touch devices (was the last hot-path shadowBlur left unguarded; springs and anchors were already gated in v1.0.1).
- Empty `catch {}` blocks around `localStorage.setItem(MODE_KEY, ...)` and the 3D `teardown` dynamic import now log to `console.debug` / `console.warn` so failures aren't silent.

## [1.0.1] — 2026-05-13

### Added
- `ps.educator.level` localStorage key — educator level now persists across reload.
- CSP + X-Frame-Options headers in `vercel.json`.
- `README.md`, `android-app/README.md`, `CHANGELOG.md`.
- GitHub Actions test workflow (`.github/workflows/test.yml`).

### Changed
- `package.json` scripts now bind `0.0.0.0:8081` (matches `start-server.bat` and the Stacklis ecosystem norm).
- `privacy.html` localStorage disclosure is now complete; the Pro flag honor-tier is documented explicitly.
- Android FileProvider `external-path` tightened from `"."` to `"Pictures/"`.

### Fixed
- `shadowBlur` on springs no longer drawn on touch (2–3 ms/frame mobile savings).
- Three.js `antialias` disabled on touch + low-DPI devices (5–8 ms/frame mobile savings).
- `JSON.parse` in `layout.js` panel state/rect now `try`/`catch`-wrapped (corrupted state no longer crashes init).

## [1.0.0] — 2026-05-10

### Added
- 3D mode (free, Three.js + Rapier3D).
- Save / load scenes (Pro).
- Export derivations (Pro).
- 4-level educator content (Curious / Beginner / Intermediate / Expert).
- Capacitor Android wrapper.
