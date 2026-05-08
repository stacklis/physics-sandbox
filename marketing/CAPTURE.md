# Marketing capture script

What to record, where to put it, what settings to use. Follow this top-down and you end up with everything the landing page and Play Store listing need.

## Outputs

| File | Use | Required |
|---|---|---|
| `marketing/screenshots/desktop/01-hero.png` (1920x1080) | landing hero, Play Store wide | yes |
| `marketing/screenshots/desktop/02-newton.png` | feature grid | yes |
| `marketing/screenshots/desktop/03-pendulum.png` | feature grid | yes |
| `marketing/screenshots/desktop/04-derivations.png` | Pro features | yes |
| `marketing/screenshots/desktop/05-knowledge-levels.png` | feature grid | yes |
| `marketing/screenshots/desktop/06-orbit.png` | extra | nice-to-have |
| `marketing/screenshots/mobile/01-hero.png` (1080x1920) | Play Store mobile | yes |
| `marketing/screenshots/mobile/02-tools.png` | Play Store mobile | yes |
| `marketing/screenshots/mobile/03-readouts.png` | Play Store mobile | yes |
| `marketing/demo.mp4` (1920x1080, 45s, ~10 MB) | landing video | yes |

Naming convention: `NN-shortname.png` / `NN-shortname.mp4`. Two-digit prefix so they sort correctly.

## Viewports & framing

- **Desktop screenshots:** Chrome at 1920x1080, no devtools open. Run the app from `http://localhost:8081/app/`. Use the OS-level screenshot tool (Win+Shift+S → "Window" mode is fine). Do NOT include the Chrome chrome — crop or use the "Window" mode.
- **Mobile screenshots:** Chrome devtools → Toggle device toolbar → choose "iPhone 14 Pro Max" (430x932) or set custom 1080x1920. Use the devtools "Capture full size screenshot" option (3-dot menu in the device toolbar). This gives a clean 1080x1920 with no browser chrome.
- **Demo video:** OBS Studio at 1920x1080, 30 fps, MP4 / x264, CRF 22, target ~10 MB for 45s. Audio off (or pleasant ambient music — no voiceover required).

## Scenes to capture (in order)

1. **Hero** — load `/app/?preset=newton` (Newton's cradle preloaded). Toggle "Velocity vectors" on. Pull the first ball aside, let it swing. Screenshot the moment of impact.
2. **Newton's cradle in motion** — same preset, mid-swing. Capture the moment the energy transfers across the chain.
3. **Pendulum** — load `/app/?preset=pendulum`, drag the bob up and to the side, release, screenshot at the bottom of its swing with vectors on.
4. **Derivations export** — toggle Pro on (`localStorage.setItem('ps.pro', '1')` in console, then reload), spawn a few objects, push them around, click Derivations, and screenshot the resulting printable doc preview.
5. **Knowledge levels** — at the "Curious" level, screenshot the lesson card. Switch to "Expert," screenshot the same scene with the Expert formula visible.
6. **Orbits** — load `/app/?preset=orbit`. Wait for a full orbit to be drawn (turn on motion trails: Display → "Motion trails"). Screenshot.

## Demo video shot list (45 seconds)

| Time | Action |
|---|---|
| 0:00 - 0:05 | Title card — "Physics Sandbox" overlaid on the Newton's cradle preset, slow-mo. |
| 0:05 - 0:15 | Spawn boxes by drag, drop them, show stacking. |
| 0:15 - 0:25 | Switch to "Spring" tool, attach a spring between two balls, watch oscillation. Highlight the live readouts panel with a subtle zoom or highlight. |
| 0:25 - 0:35 | Click the "Newton's cradle" preset button. Pull a ball aside, release. Knowledge-level switcher visible. |
| 0:35 - 0:42 | Switch knowledge level from "Curious" to "Expert" — show the lesson body change in real time. |
| 0:42 - 0:45 | End card — `sandbox.stacklis.com` + price `$9 one-time`. |

OBS recommended scene setup:

- Source: Display Capture (or Window Capture if multi-monitor).
- Filter on the Display Capture: Crop/Pad to your 1920x1080 region.
- Recording → Output → MP4, x264, CRF 22, 30 fps. Audio bitrate 128 if any.
- Use the "Replay Buffer" so you can re-take a segment without restarting.

## Where to drop files

- All screenshots go into `marketing/screenshots/desktop/` or `.../mobile/`.
- Demo video goes into `marketing/demo.mp4`.
- Once `demo.mp4` exists, swap out the placeholder block in `index.html`'s "See it in 45 seconds" section for:

  ```html
  <video controls preload="metadata" playsinline poster="/marketing/screenshots/desktop/01-hero.png" style="width:100%; max-width:880px; display:block; margin:0 auto; border-radius:12px; border:1px solid var(--line-2);">
    <source src="/marketing/demo.mp4" type="video/mp4" />
  </video>
  ```

  (Search the landing for `demo-video` and replace the placeholder div.)

## Play Store assets (deferred to v1.1)

Same screenshots; additionally needed:

- 512x512 app icon — already at `/icon-512.png`.
- 1024x500 feature graphic — not yet generated. When ready, create from the OG image (`/og-image.png`) and crop/resize.
- Short description (80 chars max).
- Full description (4000 chars max).
- Privacy URL — `https://sandbox.stacklis.com/privacy.html`.

Do not generate these until the operator is ready to file the listing.
