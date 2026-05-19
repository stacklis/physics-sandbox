// stacklisTouchFx — vanilla JS click ripple + cursor glow + haptic on any tap.
// Drop-in: <script src="lib/stacklisTouchFx.js"></script>. No deps.
// Auto-init on DOMContentLoaded. Respects prefers-reduced-motion.
//
// Public API (attached to window.StacklisTouchFx):
//   .init({ accent, glow, ripple, haptic }) — re-init with options
//   .pulse(x, y, accent?)                    — fire a ripple at a point
//   .haptic(type)                            — light|medium|heavy|double|success

(function () {
  "use strict";

  var reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var cfg = {
    accent: "#22c55e", // Stacklis green default — overridden via init()
    glow: !reduced,
    ripple: !reduced,
    haptic: true,
    ignoreSelector:
      "canvas, input[type=range], input[type=number], textarea, [data-no-touchfx]",
  };

  var glowEl = null;

  function inject() {
    if (document.getElementById("stacklis-touchfx-style")) return;
    var s = document.createElement("style");
    s.id = "stacklis-touchfx-style";
    s.textContent = [
      "@keyframes stx-ripple { 0% { opacity: 0.55; transform: translate(-50%,-50%) scale(0); }",
      "  100% { opacity: 0; transform: translate(-50%,-50%) scale(8); } }",
      ".stx-ripple { position: fixed; pointer-events: none; z-index: 999999;",
      "  width: 24px; height: 24px; border-radius: 50%;",
      "  animation: stx-ripple 520ms ease-out forwards;",
      "  mix-blend-mode: screen; }",
      ".stx-glow { position: fixed; pointer-events: none; z-index: 999998;",
      "  width: 28px; height: 28px; border-radius: 50%;",
      "  transform: translate(-50%,-50%);",
      "  filter: blur(14px); opacity: 0.45;",
      "  transition: opacity 200ms ease;",
      "  mix-blend-mode: screen; }",
      "@media (hover: none) { .stx-glow { display: none; } }",
    ].join("\n");
    document.head.appendChild(s);
  }

  function ensureGlow() {
    if (glowEl) return glowEl;
    glowEl = document.createElement("div");
    glowEl.className = "stx-glow";
    glowEl.style.background = cfg.accent;
    glowEl.style.opacity = "0";
    document.body.appendChild(glowEl);
    return glowEl;
  }

  function ripple(x, y, accent) {
    if (!cfg.ripple) return;
    var el = document.createElement("div");
    el.className = "stx-ripple";
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.background = accent || cfg.accent;
    el.style.boxShadow = "0 0 24px " + (accent || cfg.accent);
    document.body.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 600);
  }

  function vibrate(type) {
    if (!cfg.haptic) return;
    if (!("vibrate" in navigator)) return;
    var patterns = {
      light: [8],
      medium: [15],
      heavy: [25],
      double: [10, 30, 10],
      success: [10, 50, 20],
    };
    try {
      navigator.vibrate(patterns[type] || patterns.light);
    } catch (e) { /* ignore */ }
  }

  function shouldIgnore(target) {
    if (!cfg.ignoreSelector) return false;
    try {
      return !!(target && target.closest && target.closest(cfg.ignoreSelector));
    } catch (e) {
      return false;
    }
  }

  function onPointerDown(e) {
    if (shouldIgnore(e.target)) return;
    ripple(e.clientX, e.clientY);
    vibrate("light");
  }

  function onPointerMove(e) {
    if (!cfg.glow) return;
    if (e.pointerType && e.pointerType !== "mouse") return;
    var g = ensureGlow();
    g.style.left = e.clientX + "px";
    g.style.top = e.clientY + "px";
    g.style.opacity = "0.45";
  }

  function onPointerLeave() {
    if (glowEl) glowEl.style.opacity = "0";
  }

  function init(opts) {
    if (opts) {
      for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) cfg[k] = opts[k];
    }
    inject();
    if (cfg.glow) ensureGlow();
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("pointerleave", onPointerLeave, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerleave", onPointerLeave, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { init(); });
  } else {
    init();
  }

  window.StacklisTouchFx = {
    init: init,
    pulse: ripple,
    haptic: vibrate,
  };
})();
