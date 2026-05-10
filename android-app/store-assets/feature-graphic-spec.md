# Feature Graphic Spec — Physics Sandbox

**Required size:** 1024 × 500 px (JPEG or PNG, no alpha)

---

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [ICON 180×180]    Physics Sandbox         Learn physics        │
│  (left, centered   (center, large white    by playing.          │
│   vertically)      heading, bold)          (right, subtitle,    │
│                                            #00e5a0 accent)      │
│                                                                  │
│  Background: dark navy-to-charcoal gradient matching app bg     │
│  Accent glow: soft #6b8bff radial behind icon, #00e5a0 subtle   │
│  glow on right subtitle                                          │
└─────────────────────────────────────────────────────────────────┘
```

## Color Values (from app palette)

| Token           | Hex       | Usage                        |
|-----------------|-----------|------------------------------|
| `--bg`          | `#0a0a0f` | Background fill (left side)  |
| `--bg-2`        | `#16161f` | Background fill (right side) |
| `--text`        | `#f0f0f8` | Product name, headline       |
| `--accent`      | `#00e5a0` | Tagline, icon glow trim      |
| `--tertiary`    | `#6b8bff` | Background radial glow       |

## Background

Linear gradient from `#0a0a0f` (left) to `#111118` (right), with:
- A large soft radial glow in `#6b8bff` at ~20% opacity behind the icon (left third)
- A faint radial glow in `#00e5a0` at ~12% opacity behind the tagline (right third)
- Thin particle dots or grid lines in `rgba(255,255,255,0.03)` for texture

## Icon

- Use `/icon-master-1024.png` scaled to 180×180 px
- Positioned 60px from the left edge, vertically centered
- Subtle `0 0 40px rgba(0,229,160,0.3)` drop shadow

## Product Name

- Font: Space Grotesk 700
- Size: 52px
- Color: `#f0f0f8`
- Text: "Physics Sandbox"
- Horizontally centered in the middle third of the graphic
- Vertically centered slightly above the midpoint

## Tagline

- Font: Space Grotesk 400
- Size: 22px
- Color: `#00e5a0`
- Text: "Learn physics by playing."
- Below the product name, ~18px gap
- Same horizontal center

## Do Not

- Do not use screenshots of the actual app canvas in the feature graphic
- Do not include price ($9) — Play Store has a separate IAP declaration for that
- Do not exceed the 1024×500 canvas (Play Store crops anything outside)

## Tools

Can be produced with:
- Figma (preferred — use the Stacklis color variables)
- GIMP / Photoshop / Canva
- ComfyUI SVG-to-canvas workflow
