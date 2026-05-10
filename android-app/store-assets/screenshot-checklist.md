# Screenshot Checklist — Physics Sandbox Play Store

Play Store requires at minimum 2 screenshots; 8 is the maximum.
Recommended: 5 desktop (tablet) + 3 mobile (phone).

---

## Desktop Screenshots (1280×800 or 1920×1200, landscape)

Capture with Chrome DevTools → Responsive → set to 1280×800, or on actual desktop.

| # | Scene | What to show | File name |
|---|-------|-------------|-----------|
| 1 | Blank canvas | Fresh load — empty canvas with toolbar visible, hint strip shown, University level selected | `ss-desktop-01-blank.png` |
| 2 | Pendulum | Load `pendulum` preset, run for a few swings, select the pendulum bob — Live Readings panel showing speed/KE/PE populating | `ss-desktop-02-pendulum.png` |
| 3 | Newton's cradle | Load `newton` preset mid-swing, Physics panel visible, showing live momentum readout | `ss-desktop-03-cradle.png` |
| 4 | Expert readouts | Load any scene, switch to Expert level — Educator panel showing the full impulse-momentum tensor formulation | `ss-desktop-04-expert.png` |
| 5 | Pro upgrade dialog | Click Save (locked) to trigger the upgrade dialog — show the "$9 one-time" card and the two Pro feature bullets | `ss-desktop-05-upgrade.png` |

---

## Mobile Screenshots (412×915 or 390×844, portrait)

Capture with Chrome DevTools → iPhone 12 Pro (390×844) or Pixel 6 (412×915).

| # | Scene | What to show | File name |
|---|-------|-------------|-----------|
| 6 | Main canvas + tabbar | Floating overlay / tabbar visible at bottom, ball mid-fall, Readings tab active showing live KE/PE | `ss-mobile-01-canvas.png` |
| 7 | Educator panel | Educator tab selected, University-level lesson text visible, "Concepts explored" section with 3+ pills populated | `ss-mobile-02-educator.png` |
| 8 | Tools panel | Tools tab active — spawn grid (Box/Ball/Polygon etc.) fully visible, Materials section below | `ss-mobile-03-tools.png` |

---

## Capture instructions

1. Open Chrome → DevTools (F12) → Toggle device toolbar (Ctrl+Shift+M)
2. Select device profile or enter custom dimensions
3. Load `http://localhost:8081/app/` (or your Tailscale URL)
4. For presets: click the preset button in the Tools panel
5. Screenshot: DevTools → three-dot menu → Capture screenshot
6. Save to `marketing/screenshots/` with the file names above

## Play Store upload

- Format: PNG (preferred) or JPEG
- Max file size: 8 MB each
- No rounded corners needed (Play Store rounds them itself)
- No device frames (Play Store adds them if you want)
- Min dimensions: 320px on the shortest side
- Phone screenshots must be portrait orientation for the phone slot

## Feature graphic

See `feature-graphic-spec.md` for the 1024×500 banner.
