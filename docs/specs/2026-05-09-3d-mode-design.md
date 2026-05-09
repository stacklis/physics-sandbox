# Physics Sandbox — 3D Mode

**Date:** 2026-05-09
**Status:** Design (not yet implemented)

## Goal

Add a "3D Mode" toggle to physics-sandbox. The current 2D path stays untouched. 3D mode runs Three.js + Rapier3D under a side-on, locked camera so cubes can tumble, spheres roll true, and ropes swing in depth — but the framing still reads as the existing sandbox with depth added.

## Architecture

A mode router sits at the top of `app.js`. On boot it reads `localStorage.physicsMode` (default `2d`). 2D mode is the entire current stack, unchanged. 3D mode lazy-imports a new bundle: `render3d.js` (Three.js scene), `engine3d.js` (Rapier3D wrapper), `app3d.js` (input, tools, presets, save/load).

The toggle lives in the top bar, between the title and the educator-level dropdown. Switching modes prompts to clear the scene — there is no cross-mode body translation.

## Engine

**Rapier3D** via `@dimforge/rapier3d-compat` (WASM, async init). Matches anatomy-sim so the dependency, build patterns, and team familiarity carry over. Lazy-loaded only when 3D mode is entered (~700 KB gzipped) so the 2D-only first-paint is unchanged.

## Renderer

**Three.js**, ESM via CDN.

- **Camera:** perspective, FOV 35°, locked side-on with a **12° downward tilt**. The tilt is the visual reveal — pure 0° barely shows depth, while 12° lets the top faces of cubes show when at rest. No orbit, no pan.
- **Lighting:** hemisphere fill + a single directional key from upper-front. Soft contact shadows on the floor plane only (cheap on mobile).
- **Playfield:** shallow slab. Width × height matches current `Wm × Hm`; depth = 2 m. Floor + left/right walls visible as in 2D. Front and back walls are invisible Z-clamps so nothing escapes the camera. The back wall gets a faint grid texture for depth parallax.

## 3D Toolbar

When 3D mode is active, the spawn rail swaps in:

| Tool      | Behavior                                                       |
|-----------|----------------------------------------------------------------|
| Cube      | Replaces Box. Edge length = `max(dragWidth, dragHeight)`.      |
| Sphere    | Replaces Circle. Drag-rect → sphere radius.                    |
| Cylinder  | Axis along Y (vertical) by default; reads as a barrel/drum that can be knocked onto its side. Drag sets radius (horizontal) and length (vertical). |
| Capsule   | Cylinder + hemispherical caps. Same axis convention.           |
| Prism     | Extruded n-gon, n ∈ {3..8} (mirrors current Polygon tool).     |
| Wall      | Static slab.                                                   |
| Rope      | Chain of capsules joined by spherical (ball) joints.           |

Action tools (Grab / Spring / Impulse / Delete / Pin / Slice) stay. Their hit-test becomes a screen-space ray instead of point-in-polygon. Drag-grab projects the cursor onto the body's initial Z-plane so the user doesn't accidentally yank objects toward the camera. Slice is hidden in 3D mode for v1.

## Spawn UX

Same drag-to-size pattern as 2D. Spawn `Z = 0` with a small ±0.05 m jitter so identical-Z stacks don't read as flat. Live drag preview reuses the existing glow style but renders a wireframe primitive.

## Education Layer

New 3D copy of the 4 educator levels (Curious / Engaged / Practitioner / Expert) in `education3d.js`, mirroring `education.js`. Curious + Engaged are ~80% reused from 2D. Practitioner + Expert get genuine 3D content:

- Inertia tensor (vs. scalar moment in 2D)
- Rolling without slipping
- Gyroscopic precession at high spin
- Contact-normal restitution in 3D

## Save / Load

Scene JSON gains `mode: '2d' | '3d'`. Body schema branches by mode — 3D bodies have quaternion orientation, 3D dimensions, optional friction/restitution per axis.

The loader rejects mismatched-mode scenes with a clear toast. No auto-conversion. Share-by-link works as today; URLs generated from 3D scenes only open in 3D mode.

## Performance Budget

- Cap dynamic bodies at **80** in 3D mode (vs. ~150 in 2D). Above the cap the spawn tool grays out with a "limit reached" tooltip.
- Target **60 fps** on Galaxy S26 Ultra. Verify via Tailscale `100.99.119.80:8081` during dev.
- Shadows on floor plane only (no per-body shadow casters except via the single key light).

## Mobile / Capacitor

The Android wrapper picks up 3D mode automatically — no native changes. Smoke-test on the physical device before tagging a release.

## Stripe / Pro Gate

3D mode is positioned as a Pro feature. The current codebase audit did not surface obvious paywall code; the implementation plan will confirm. If a Pro gate exists, the 3D toggle goes behind it. If not, ship 3D as free for launch and gate it in a follow-up.

## File Layout

New files:

- `engine3d.js` — Rapier3D wrapper, body factory (`makeCube`, `makeSphere`, …), joint helpers.
- `render3d.js` — Three.js scene, camera, lights, mesh-per-body sync.
- `app3d.js` — 3D-mode main loop, input, tools, presets, save/load.
- `education3d.js` — 3D explanations for the 4 educator levels.

Modified files:

- `index.html` — adds the top-bar 2D/3D toggle and the (hidden-by-default) 3D toolbar block.
- `styles.css` — minor: toggle styles, 3D toolbar swap rules.
- `app.js` — gains a mode-router shim at the top; otherwise unchanged.

## Out of Scope (Explicit YAGNI)

- Orbital camera.
- Cross-mode scene conversion.
- Cloth / soft-body.
- Constraint slicing in 3D for v1.
- Stress / fracture in 3D.
- PWA offline caching of the Rapier WASM blob (revisit if user demand emerges).

## Risks

- **Rapier WASM init timing.** Async — UI must not let the user spawn before Rapier is ready. Show a "loading 3D engine…" splash inside the canvas for the first ~300 ms.
- **Shadow cost on mid-tier Android.** If frame-rate drops, fall back to a baked floor shadow texture.
- **Save format divergence.** Two body schemas to maintain. Mitigated by keeping each schema in its own module and refusing cross-mode loads.
- **Bundle size on first 3D entry.** Three.js + Rapier3D ≈ 1 MB gzipped. Acceptable for a Pro feature gated behind explicit user intent (clicking the toggle).
