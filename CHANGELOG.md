# Changelog

All notable changes to Physics Sandbox land here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
