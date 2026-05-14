# Changelog

All notable changes to Physics Sandbox land here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.0.3] — 2026-05-14

### Added
- Global `:focus-visible` keyboard-focus ring across all interactive elements (WCAG 2.4.7).
- Knowledge-level segment now has `role="tab"` + dynamic `aria-selected` on each button.
- Visible accent ground (teal glow line + faded band) so the world floor reads as a floor instead of empty canvas.

### Changed
- Boundary walls thickened from 0.4 m to 4.0 m (`maxLinearVelocity × fixedDt × substepCap`) — walls sit outside the visible canvas so this is invisible but eliminates tunneling.
- `endGrab` throw velocity now clamped to `world.maxLinearVelocity` at release (was uncapped — fast flicks could inject 100+ m/s in one frame and tunnel through walls).
- `DESTRUCTION_THRESHOLD` reduced from 100 m/s to 40 m/s so destruction stays reachable under the velocity cap.
- `enforceBodyCap` eviction loop rewritten — old form could null-deref on the first iteration when `oldest` was unset.
- Share-link `r1` (uncompressed) path now also enforces the 1 MiB scene cap.
- Space-bar tap vs hold disambiguated — tap toggles pause on keyup, hold-and-drag pans without toggling pause.
- Pop-out panel button label now reflects the actual action (`⊞` "Pop out" when docked, `✕` "Dock" when floating).
- Pan tool removed from 2D toolbar — right-click drag, Space+drag, and two-finger touch already cover pan; the dedicated button was redundant.

### Fixed
- Triangle bodies now display "Triangle" in the readings panel (was reading nonexistent `b.vertices`; corrected to `b.localVertices`).

### Tests
- Added 8 tests for the 2D engine (`tests/engine2d.test.mjs`) — was previously zero coverage on `engine.js`. New cases: Vec2 length/copy, falling-body integration, static immobility, factory shape kinds, `World.remove` constraint cleanup, `maxLinearVelocity` clamp, **thick-wall containment under high velocity (regression test for the boundary tunneling bug)**, and `DistanceConstraint` pendulum settling. Loader shim `tests/_load-engine2d.mjs` runs `engine.js` in a Node vm context with a synthetic `window`.

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
