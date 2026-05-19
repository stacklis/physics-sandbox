// layout.js — Physics Sandbox layout controller (2026-05-09 rework).
//
// Drives the bottom-tab/sheet UX on mobile (<=768px) and the resizable +
// floating-panels desktop layout (>768px). app.js never sees the difference:
// it just queries `.visible` on `#infoOverlay` / `#lessonOverlay` / `#tipsOverlay`,
// and calls `window.toggleInfoOverlay()` / `toggleLessonOverlay()` / `toggleTipsOverlay()`
// for keyboard shortcuts. This module exposes those globals and toggles `.visible`
// on the appropriate panel.
//
// Desktop adds three dock-edge resize handles (tools right edge, readings left
// edge, educator top edge) plus a pop-out button on Readings + Educator that
// detaches them as floating panels. Floating panels can be dragged, edge-resized
// and corner-resized; dragging a floating panel near its native dock edge shows
// a docking zone — release inside redocks. State persists per-panel via
// localStorage keys (ps:layout:* and ps:panel:*).
//
// Mobile uses the existing bottom-sheet metaphor but with continuous user
// drag height + nearest-of-{30,60,80}vh snap on release. In landscape mobile
// the sheet pulls from the right and snaps in vw.
//
// No build step. Native ESM. Loaded via `<script type="module">`.

const TABS = ['tools', 'readings', 'educator'];
const PANEL_BY_TAB = { tools: 'toolsPanel', readings: 'infoOverlay', educator: 'lessonOverlay' };
const MOBILE_QUERY = '(max-width: 768px)';
const LANDSCAPE_MOBILE_QUERY = '(max-width: 768px) and (orientation: landscape) and (max-height: 600px)';

const body = document.body;
const tabbar = document.querySelector('.tabbar');
const tabs = Array.from(document.querySelectorAll('.tabbar .tab'));
const panels = {
  tools: document.getElementById('toolsPanel'),
  readings: document.getElementById('infoOverlay'),
  educator: document.getElementById('lessonOverlay'),
};
const canvasHost = document.querySelector('.canvas-host');

// State -----------------------------------------------------------------------
let activeTab = 'tools';
let sheetOpen = false;          // mobile only
let mobile = window.matchMedia(MOBILE_QUERY).matches;
let landscapeMobile = window.matchMedia(LANDSCAPE_MOBILE_QUERY).matches;
// Overlay panel open states (mobile only; start hidden until tab is tapped)
const overlayOpen = { readings: false, educator: false };

// Public surface (used by app.js for keyboard shortcuts) ----------------------
function setActiveTab(tab, opts = {}) {
  if (!TABS.includes(tab)) return;
  activeTab = tab;
  body.dataset.activeTab = tab;
  syncPanelVisibility();
  if (opts.openSheet && mobile) openSheet();
}

function openSheet() {
  if (!mobile) return;
  sheetOpen = true;
  body.dataset.sheetOpen = 'true';
  body.dataset.sheetLocked = 'true';
  syncPanelVisibility();
}

function closeSheet() {
  sheetOpen = false;
  body.dataset.sheetOpen = 'false';
  delete body.dataset.sheetLocked;
  syncPanelVisibility();
}

function toggleSheet() {
  if (sheetOpen) closeSheet(); else openSheet();
}

// Update `.visible` on panels and tab active states. -------------------------
// Desktop: all panels visible. Mobile: tools only when sheet open; readings
// and educator shown only when overlayOpen[tab] is true.
function syncPanelVisibility() {
  for (const tab of TABS) {
    const el = panels[tab];
    if (!el) continue;
    let on;
    if (mobile) {
      if (tab === 'tools') {
        on = sheetOpen && activeTab === 'tools';
      } else {
        on = overlayOpen[tab] === true;
      }
    } else {
      on = true;
    }
    el.classList.toggle('visible', on);
  }
  if (mobile) syncTabStates();
}

// Sync tabbar active state: tools = sheet open; overlays = overlayOpen.
function syncTabStates() {
  for (const btn of tabs) {
    const tab = btn.dataset.tab;
    let on;
    if (tab === 'tools') {
      on = sheetOpen && activeTab === 'tools';
    } else {
      on = overlayOpen[tab] === true;
    }
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

// Tab clicks ------------------------------------------------------------------
tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (mobile) {
      if (tab === 'tools') {
        // Tools: toggle the sheet
        if (sheetOpen && activeTab === 'tools') closeSheet();
        else setActiveTab('tools', { openSheet: true });
      } else {
        // Readings / Educator: toggle visibility
        overlayOpen[tab] = !overlayOpen[tab];
        // Clear collapsed state when reopening so full content shows
        if (overlayOpen[tab]) panels[tab]?.classList.remove('panel-collapsed');
        syncPanelVisibility();
      }
    } else {
      setActiveTab(tab, { openSheet: true });
    }
  });
});

// Mobile: chips in a horizontal strip. Tapping a chip toggles
// .panel-expanded (radio — expanding one collapses the others).
// Default state is collapsed (CSS handles it without needing JS init).
// Readings is OMITTED — it renders as an always-on HUD overlay (see
// styles.css mobile @media block), not a togglable chip.
const PANEL_KEYS = ['tools', 'educator'];

function collapseAllPanels() {
  for (const k of PANEL_KEYS) panels[k]?.classList.remove('panel-expanded');
}

function expandPanel(key) {
  collapseAllPanels();
  panels[key]?.classList.add('panel-expanded');
}

PANEL_KEYS.forEach(key => {
  const panelEl = panels[key];
  if (!panelEl) return;
  const header = panelEl.querySelector('.panel-header');
  if (!header) return;
  header.addEventListener('click', e => {
    if (!mobile) return;
    if (e.target.closest('button')) return;
    if (panelEl.classList.contains('panel-expanded')) {
      panelEl.classList.remove('panel-expanded');
    } else {
      expandPanel(key);
    }
  });
  const closeBtn = panelEl.querySelector('.panel-close, .overlay-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', e => {
      if (!mobile) return;
      e.stopPropagation();
      panelEl.classList.remove('panel-expanded');
    });
  }
});

// Tap outside the panels (canvas/topbar) closes any open panel.
// Skip when tapping the HUD (#infoOverlay) — it's always-on, not collapsible.
document.addEventListener('pointerdown', e => {
  if (!mobile) return;
  if (e.target.closest('.panel-host')) return;
  if (e.target.closest('.panel.panel-expanded')) return;
  if (e.target.closest('#infoOverlay')) return;
  collapseAllPanels();
}, true);

// Mobile: HUD + expanded Tools/Educator panels are draggable (1 finger on
// header) and pinch-resizable (2 fingers anywhere). Scale is stored on
// dataset.scale, position on inline left/top. Drag has a 6px threshold so
// it doesn't fight the tap-to-collapse handler.
function makeInteractive(panelEl) {
  if (!panelEl) return;
  const header = panelEl.querySelector('.panel-header');
  if (!header) return;
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  const DRAG_THRESHOLD = 6;
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 2.5;

  function pinchDist() {
    const a = Array.from(pointers.values());
    if (a.length < 2) return 0;
    return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
  }
  function readScale() { return parseFloat(panelEl.dataset.scale || '1'); }

  panelEl.addEventListener('pointerdown', e => {
    if (!mobile) return;
    // HUD is always fixed. Tools/Educator only fixed when expanded.
    if (panelEl.id !== 'infoOverlay' && !panelEl.classList.contains('panel-expanded')) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      const fromHeader = e.target.closest('.panel-header') && !e.target.closest('button');
      // HUD has no header (chrome stripped per UX) — let drag start anywhere
      // on the HUD body that isn't a button.
      const isHud = panelEl.id === 'infoOverlay';
      const hudAnywhere = isHud && !e.target.closest('button');
      if (fromHeader || hudAnywhere) {
        const rect = panelEl.getBoundingClientRect();
        drag = {
          startX: e.clientX, startY: e.clientY,
          left: rect.left, top: rect.top,
          moved: false,
        };
      }
    } else if (pointers.size === 2) {
      drag = null;
      pinch = { dist: pinchDist(), scale: readScale() };
      panelEl.classList.add('panel-pinching');
    }
  });

  panelEl.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const d = pinchDist();
      const ratio = d / pinch.dist;
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinch.scale * ratio));
      panelEl.style.transform = `scale(${next})`;
      panelEl.style.transformOrigin = 'top left';
      panelEl.dataset.scale = String(next);
    } else if (drag) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      panelEl.classList.add('panel-dragging');
      const scale = readScale();
      const w = panelEl.offsetWidth * scale;
      const h = panelEl.offsetHeight * scale;
      const left = Math.max(4, Math.min(window.innerWidth - w - 4, drag.left + dx));
      const top = Math.max(4, Math.min(window.innerHeight - h - 4, drag.top + dy));
      panelEl.style.left = left + 'px';
      panelEl.style.top = top + 'px';
      panelEl.style.right = 'auto';
      panelEl.style.bottom = 'auto';
    }
  });

  function release(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2 && pinch) {
      pinch = null;
      panelEl.classList.remove('panel-pinching');
    }
    if (drag && pointers.size === 0) {
      const moved = drag.moved;
      drag = null;
      panelEl.classList.remove('panel-dragging');
      if (moved && e.target.closest('.panel-header')) {
        e.stopPropagation();
        e.preventDefault();
      }
    }
  }
  panelEl.addEventListener('pointerup', release);
  panelEl.addEventListener('pointercancel', release);

  // Block click after drag (some browsers fire click after pointerup).
  header.addEventListener('click', e => {
    if (drag && drag.moved) { e.stopPropagation(); e.preventDefault(); }
  }, true);
}

if (mobile) {
  // On mobile, append the panel-host into the topbar so the Tools / Educator
  // chips flow inline with the atom logo + Pro button. Avoids the previous
  // "empty middle row in the topbar, chips on row 2" layout.
  const topbarEl = document.querySelector('.topbar');
  const panelHostEl = document.querySelector('.panel-host');
  if (topbarEl && panelHostEl && panelHostEl.parentNode !== topbarEl) {
    topbarEl.appendChild(panelHostEl);
  }
  // HUD uses a dedicated drag-handle (the ● button) since the HUD body has
  // pointer-events: none so canvas interactions pass through.
  makeInteractive(panels.tools);
  makeInteractive(panels.educator);
  // Auto-collapse Tools after picking a tool, preset or material — gets the
  // panel out of the way so the user can immediately interact with the canvas.
  const COLLAPSE_AFTER = '.tool[data-tool], .tool[data-tool3d], .preset, .material';
  panels.tools?.addEventListener('click', e => {
    if (!e.target.closest(COLLAPSE_AFTER)) return;
    panels.tools.classList.remove('panel-expanded');
    // Clear any stale drag inline style so the panel snaps back to its
    // chip position cleanly when re-expanded next time.
    panels.tools.style.left = '';
    panels.tools.style.top = '';
    panels.tools.style.right = '';
    panels.tools.style.bottom = '';
  }, true);
}

// HUD view modes — full → minimal → hidden, cycled via tiny ● in the HUD
// corner. Also reachable from ⋯ → Readings (which toggles hidden/full).
// Mode persists in localStorage.
if (mobile) {
  const HUD = document.getElementById('infoOverlay');
  const HUD_MODE_KEY = 'ps:hud-mode';
  const MODES = ['full', 'minimal', 'hidden'];
  function applyHudMode(mode) {
    if (!HUD) return;
    if (!MODES.includes(mode)) mode = 'full';
    HUD.dataset.hudMode = mode;
    // No longer set body.dataset.hudHidden — the ● toggle must stay visible
    // in 'hidden' mode so the user can re-expand. The hudMode attribute on
    // #infoOverlay drives all CSS now.
    try { localStorage.setItem(HUD_MODE_KEY, mode); } catch {}
  }
  let savedMode = 'full';
  try { savedMode = localStorage.getItem(HUD_MODE_KEY) || 'full'; } catch {}
  applyHudMode(savedMode);

  const hudToggle = document.getElementById('hudViewToggle');
  if (hudToggle && HUD) {
    // The ● serves DOUBLE-DUTY: tap = cycle modes, drag = move the HUD.
    // makeDragHandle disambiguates via a 6px movement threshold.
    let dragHandle = null;
    const THRESHOLD = 6;
    hudToggle.addEventListener('pointerdown', e => {
      e.stopPropagation();
      const rect = HUD.getBoundingClientRect();
      dragHandle = {
        startX: e.clientX, startY: e.clientY,
        left: rect.left, top: rect.top,
        moved: false,
        pointerId: e.pointerId,
      };
      try { hudToggle.setPointerCapture(e.pointerId); } catch {}
    });
    hudToggle.addEventListener('pointermove', e => {
      if (!dragHandle || e.pointerId !== dragHandle.pointerId) return;
      const dx = e.clientX - dragHandle.startX;
      const dy = e.clientY - dragHandle.startY;
      if (!dragHandle.moved && Math.hypot(dx, dy) < THRESHOLD) return;
      dragHandle.moved = true;
      HUD.classList.add('panel-dragging');
      const w = HUD.offsetWidth;
      const h = HUD.offsetHeight;
      const left = Math.max(4, Math.min(window.innerWidth - w - 4, dragHandle.left + dx));
      const top = Math.max(4, Math.min(window.innerHeight - h - 4, dragHandle.top + dy));
      HUD.style.left = left + 'px';
      HUD.style.top = top + 'px';
      HUD.style.right = 'auto';
      HUD.style.bottom = 'auto';
    });
    function endHudDrag(e) {
      if (!dragHandle || e.pointerId !== dragHandle.pointerId) return;
      const moved = dragHandle.moved;
      dragHandle = null;
      HUD.classList.remove('panel-dragging');
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
      } else {
        // Tap (no drag) → cycle modes.
        const cur = HUD.dataset.hudMode || 'full';
        const next = MODES[(MODES.indexOf(cur) + 1) % MODES.length];
        applyHudMode(next);
      }
    }
    hudToggle.addEventListener('pointerup', endHudDrag);
    hudToggle.addEventListener('pointercancel', endHudDrag);
  }

  const readingsToggle = document.getElementById('toggleReadingsBtn');
  if (readingsToggle) {
    readingsToggle.addEventListener('click', e => {
      e.stopPropagation();
      const cur = HUD?.dataset.hudMode || 'full';
      applyHudMode(cur === 'hidden' ? 'full' : 'hidden');
    }, true);
  }
}

// =============================================================================
// MOBILE SHEET — continuous drag with nearest-of-{low,mid,high} snap on release.
// In portrait the snap targets are vh (30 / 60 / 80). In landscape-mobile the
// sheet pulls from the right and the targets are vw (same numbers).
// =============================================================================
const SHEET_SNAP = { low: 30, mid: 60, high: 80 };
let sheetHeightMode = 'mid';

function setSheetHeight(mode) {
  // Translate legacy values into the new namespace.
  if (mode === 'default') mode = 'mid';
  if (mode === 'tall') mode = 'high';
  sheetHeightMode = mode;
  body.dataset.sheetHeight = mode;
  // Clear any inline override from a live drag.
  for (const el of Object.values(panels)) {
    if (el) {
      el.style.removeProperty('--sheet-height');
      el.style.removeProperty('--sheet-width');
    }
  }
}

function bindGrabber(panelEl) {
  const grabber = panelEl.querySelector('.panel-grabber');
  if (!grabber) return;
  let startCoord = 0;        // start clientY (portrait) or clientX (landscape)
  let delta = 0;             // signed pixel delta along drag axis
  let dragging = false;
  let pointerId = null;
  let startVal = 60;         // start size in vh (portrait) or vw (landscape)
  let liveVal = 60;
  let axisIsX = false;       // captured at pointerdown so a mid-drag rotation
                             // doesn't flip the math

  grabber.addEventListener('pointerdown', e => {
    if (!mobile) return;
    dragging = true;
    pointerId = e.pointerId;
    axisIsX = landscapeMobile;
    startCoord = axisIsX ? e.clientX : e.clientY;
    delta = 0;
    startVal = SHEET_SNAP[sheetHeightMode] || 60;
    liveVal = startVal;
    try { grabber.setPointerCapture(e.pointerId); } catch {}
    panelEl.classList.add('dragging');
  });

  grabber.addEventListener('pointermove', e => {
    if (!dragging) return;
    const cur = axisIsX ? e.clientX : e.clientY;
    delta = cur - startCoord;
    if (axisIsX) {
      // Landscape: sheet attached to right edge. Drag right => sheet shrinks
      // (delta > 0 -> negative vw change). Drag left => sheet grows.
      const vwPx = window.innerWidth / 100;
      const dVal = -delta / vwPx;
      liveVal = clamp(startVal + dVal, 18, 95);
      panelEl.style.setProperty('--sheet-width', `${liveVal}vw`);
    } else {
      // Portrait: sheet attached to bottom. Drag down (delta > 0) shrinks.
      const vhPx = window.innerHeight / 100;
      const dVal = -delta / vhPx;
      liveVal = clamp(startVal + dVal, 18, 95);
      panelEl.style.setProperty('--sheet-height', `${liveVal}vh`);
    }
  });

  function release() {
    if (!dragging) return;
    dragging = false;
    panelEl.classList.remove('dragging');

    // Close-on-pull-away rules:
    //   from `low`           (30vh/30vw): drag-away >  60px closes
    //   from `mid` or `high` (60/80):     drag-away > 100px closes
    // delta > 0 means "away from sheet" in both axes (down in portrait, right
    // in landscape) given the sheet anchors used.
    const closeThreshold = sheetHeightMode === 'low' ? 60 : 100;
    if (delta > closeThreshold) {
      closeSheet();
      return;
    }

    // Snap to nearest of {30, 60, 80}; (still snap on release).
    const snaps = Object.entries(SHEET_SNAP);
    let bestKey = 'mid';
    let bestDist = Infinity;
    for (const [key, v] of snaps) {
      const d = Math.abs(liveVal - v);
      if (d < bestDist) { bestDist = d; bestKey = key; }
    }
    setSheetHeight(bestKey);
  }

  grabber.addEventListener('pointerup', release);
  grabber.addEventListener('pointercancel', release);
  grabber.addEventListener('lostpointercapture', release);
}

Object.values(panels).forEach(el => { if (el) bindGrabber(el); });

// =============================================================================
// DESKTOP — dock-edge resize handles + floating panels.
// =============================================================================
const LS = {
  toolsW:    'ps:layout:tools-w',
  readingsW: 'ps:layout:readings-w',
  educatorH: 'ps:layout:educator-h',
  readingsState: 'ps:panel:readings:state',
  readingsRect:  'ps:panel:readings:rect',
  educatorState: 'ps:panel:educator:state',
  educatorRect:  'ps:panel:educator:rect',
};

const DEFAULTS = {
  toolsW: 280,
  readingsW: 320,
  educatorH: 180,
  readingsRect: { w: 280, h: 360, x: null, y: 12, anchor: 'top-right', margin: 12 },
  educatorRect: { w: 360, h: 260, x: null, y: null, anchor: 'bottom-right', margin: 12 },
};

const RANGES = {
  toolsW: [200, 480],
  readingsW: [240, 520],
  educatorH: [120, 400],
};

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// --- Restore persisted dock dimensions on first load.
function restoreDockSizes() {
  const root = document.documentElement;
  const tw = parseFloat(localStorage.getItem(LS.toolsW));
  const rw = parseFloat(localStorage.getItem(LS.readingsW));
  const eh = parseFloat(localStorage.getItem(LS.educatorH));
  if (Number.isFinite(tw)) root.style.setProperty('--tools-w', `${clamp(tw, ...RANGES.toolsW)}px`);
  if (Number.isFinite(rw)) root.style.setProperty('--readings-w', `${clamp(rw, ...RANGES.readingsW)}px`);
  if (Number.isFinite(eh)) root.style.setProperty('--educator-h', `${clamp(eh, ...RANGES.educatorH)}px`);
}
restoreDockSizes();

// --- Inject the three dock-edge handles into <body>. Position is set via
// fixed coords in JS based on the panel's measured rects each rAF tick during
// resize and on every layout change.
const dockEdges = {
  tools:    document.createElement('div'),
  readings: document.createElement('div'),
  educator: document.createElement('div'),
};
dockEdges.tools.className = 'dock-edge';
dockEdges.tools.dataset.edge = 'tools-edge';
dockEdges.readings.className = 'dock-edge';
dockEdges.readings.dataset.edge = 'readings-edge';
dockEdges.educator.className = 'dock-edge';
dockEdges.educator.dataset.edge = 'educator-edge';
for (const el of Object.values(dockEdges)) {
  document.body.appendChild(el);
  el.style.display = mobile ? 'none' : '';
}

function positionDockEdges() {
  if (mobile) return;
  // Tools: right edge of tools panel.
  if (panels.tools) {
    const r = panels.tools.getBoundingClientRect();
    Object.assign(dockEdges.tools.style, {
      left: `${r.right - 3}px`,
      top: `${r.top}px`,
      bottom: `${window.innerHeight - r.bottom}px`,
      height: '',
    });
  }
  // Readings: left edge of readings panel (when docked + visible).
  const readingsFloat = body.dataset.readingsFloating === 'true';
  if (panels.readings && !readingsFloat) {
    const r = panels.readings.getBoundingClientRect();
    Object.assign(dockEdges.readings.style, {
      display: '',
      left: `${r.left - 3}px`,
      top: `${r.top}px`,
      bottom: `${window.innerHeight - r.bottom}px`,
      height: '',
    });
  } else {
    dockEdges.readings.style.display = 'none';
  }
  // Educator: top edge of educator panel (when docked + visible).
  const educatorFloat = body.dataset.educatorFloating === 'true';
  if (panels.educator && !educatorFloat) {
    const r = panels.educator.getBoundingClientRect();
    Object.assign(dockEdges.educator.style, {
      display: '',
      left: `${r.left}px`,
      right: `${window.innerWidth - r.right}px`,
      top: `${r.top - 3}px`,
      width: '',
    });
  } else {
    dockEdges.educator.style.display = 'none';
  }
}

// Re-position handles on every resize / layout change.
let positionRaf = 0;
function schedulePositionEdges() {
  if (positionRaf) return;
  positionRaf = requestAnimationFrame(() => {
    positionRaf = 0;
    positionDockEdges();
  });
}
window.addEventListener('resize', schedulePositionEdges);
if ('ResizeObserver' in window) {
  const ro = new ResizeObserver(schedulePositionEdges);
  if (panels.tools) ro.observe(panels.tools);
  if (panels.readings) ro.observe(panels.readings);
  if (panels.educator) ro.observe(panels.educator);
  if (canvasHost) ro.observe(canvasHost);
}

// --- Bind drag-to-resize on each handle.
function bindDockEdge(handleEl, varName, lsKey, range, axis) {
  let dragging = false;
  let startCoord = 0;
  let startVal = 0;
  let lastVal = 0;
  let raf = 0;

  function readCurrentPx() {
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    const v = cs.getPropertyValue(varName).trim();
    const px = parseFloat(v);
    return Number.isFinite(px) ? px : 0;
  }

  handleEl.addEventListener('pointerdown', e => {
    if (mobile) return;
    if (e.button !== 0) return;
    dragging = true;
    startCoord = axis === 'x' ? e.clientX : e.clientY;
    startVal = readCurrentPx();
    lastVal = startVal;
    handleEl.classList.add('dragging');
    body.classList.add('resizing-dock');
    try { handleEl.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  });

  handleEl.addEventListener('pointermove', e => {
    if (!dragging) return;
    const cur = axis === 'x' ? e.clientX : e.clientY;
    let delta = cur - startCoord;
    // tools-edge grows when dragging right. readings-edge grows when dragging
    // LEFT (panel on right). educator-edge grows when dragging UP (panel on
    // bottom).
    if (varName === '--readings-w') delta = -delta;
    if (varName === '--educator-h') delta = -delta;
    const next = clamp(startVal + delta, range[0], range[1]);
    if (next === lastVal) return;
    lastVal = next;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      document.documentElement.style.setProperty(varName, `${lastVal}px`);
      schedulePositionEdges();
    });
  });

  function release() {
    if (!dragging) return;
    dragging = false;
    handleEl.classList.remove('dragging');
    body.classList.remove('resizing-dock');
    try { localStorage.setItem(lsKey, String(lastVal)); } catch {}
    schedulePositionEdges();
    if (typeof window.PSandboxResize === 'function') window.PSandboxResize();
  }
  handleEl.addEventListener('pointerup', release);
  handleEl.addEventListener('pointercancel', release);
  handleEl.addEventListener('lostpointercapture', release);

  // Double-click resets.
  handleEl.addEventListener('dblclick', () => {
    if (mobile) return;
    document.documentElement.style.removeProperty(varName);
    try { localStorage.removeItem(lsKey); } catch {}
    schedulePositionEdges();
  });
}

bindDockEdge(dockEdges.tools,    '--tools-w',    LS.toolsW,    RANGES.toolsW,    'x');
bindDockEdge(dockEdges.readings, '--readings-w', LS.readingsW, RANGES.readingsW, 'x');
bindDockEdge(dockEdges.educator, '--educator-h', LS.educatorH, RANGES.educatorH, 'y');

// =============================================================================
// FLOATING PANELS — Readings + Educator can detach into draggable + resizable
// floats anchored inside .canvas-host.
// =============================================================================
const FLOAT_KEYS = ['readings', 'educator'];
const MIN_W = 220;
const MIN_H = 180;
const HEADER_VISIBLE_PX = 60;
const DOCK_ZONE_PX = 32;
const POP_BUTTONS = {};

const dockZones = {
  readings: null,
  educator: null,
};

function ensureDockZones() {
  if (!canvasHost) return;
  for (const key of FLOAT_KEYS) {
    if (!dockZones[key]) {
      const z = document.createElement('div');
      z.className = 'dock-zone';
      z.dataset.zone = key;
      canvasHost.appendChild(z);
      dockZones[key] = z;
    }
  }
}
ensureDockZones();

// Read floating state from localStorage; defaults to docked.
function readState(key) {
  try {
    const s = localStorage.getItem(LS[key + 'State']);
    if (s === 'floating') return 'floating';
  } catch {}
  return 'docked';
}
function readRect(key) {
  let raw;
  try { raw = localStorage.getItem(LS[key + 'Rect']); } catch { raw = null; }
  if (!raw) return null;
  let r;
  try { r = JSON.parse(raw); }
  catch (e) { r = DEFAULTS[key + 'Rect']; console.warn('[layout] bad JSON for ' + key + 'Rect', e); }
  if (r && Number.isFinite(r.w) && Number.isFinite(r.h)) return r;
  return null;
}
function writeRect(key, rect) {
  try { localStorage.setItem(LS[key + 'Rect'], JSON.stringify(rect)); } catch {}
}
function writeState(key, state) {
  try { localStorage.setItem(LS[key + 'State'], state); } catch {}
}

function getCanvasHostRect() {
  return canvasHost ? canvasHost.getBoundingClientRect() : { width: 800, height: 600, left: 0, top: 0 };
}

function defaultRect(key) {
  const host = getCanvasHostRect();
  const def = DEFAULTS[key + 'Rect'];
  let { w, h, anchor, margin } = def;
  // Keep within bounds.
  w = Math.min(w, Math.max(MIN_W, host.width - margin * 2));
  h = Math.min(h, Math.max(MIN_H, host.height - margin * 2));
  let x, y;
  if (anchor === 'top-right') {
    x = host.width - w - margin;
    y = margin;
  } else if (anchor === 'bottom-right') {
    x = host.width - w - margin;
    y = host.height - h - margin;
  } else {
    x = margin; y = margin;
  }
  return { x, y, w, h };
}

function clampRectToHost(rect) {
  const host = getCanvasHostRect();
  const w = clamp(rect.w, MIN_W, Math.max(MIN_W, host.width * 0.95));
  const h = clamp(rect.h, MIN_H, Math.max(MIN_H, host.height * 0.95));
  // Keep at least HEADER_VISIBLE_PX of header inside the host area.
  const minX = -(w - HEADER_VISIBLE_PX);
  const maxX = host.width - HEADER_VISIBLE_PX;
  const minY = 0;
  const maxY = host.height - HEADER_VISIBLE_PX;
  const x = clamp(rect.x ?? 0, minX, maxX);
  const y = clamp(rect.y ?? 0, minY, maxY);
  return { x, y, w, h };
}

function applyFloatStyles(panelEl, rect) {
  panelEl.style.left = `${rect.x}px`;
  panelEl.style.top = `${rect.y}px`;
  panelEl.style.width = `${rect.w}px`;
  panelEl.style.height = `${rect.h}px`;
}

function clearFloatStyles(panelEl) {
  panelEl.style.left = '';
  panelEl.style.top = '';
  panelEl.style.width = '';
  panelEl.style.height = '';
}

// Track raised z-order — most-recently-clicked floating panel sits on top.
let activeFloatKey = null;
function raiseFloat(key) {
  if (activeFloatKey === key) return;
  activeFloatKey = key;
  for (const k of FLOAT_KEYS) {
    const el = panels[k];
    if (!el) continue;
    el.classList.toggle('active', k === key && el.classList.contains('floating'));
  }
}

function setupPopButton(key) {
  const panelEl = panels[key];
  if (!panelEl) return;
  const btn = panelEl.querySelector(`.panel-pop[data-pop="${key}"]`);
  if (!btn) return;
  POP_BUTTONS[key] = btn;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (mobile) return;
    if (panelEl.classList.contains('floating')) hideOverlayPanel(key);
    else showOverlayPanel(key);
  });
  // Reflect initial label.
  updatePopButton(key);
}

function updatePopButton(key) {
  const btn = POP_BUTTONS[key];
  if (!btn) return;
  const panelEl = panels[key];
  const floating = panelEl && panelEl.classList.contains('floating');
  if (floating) {
    btn.textContent = '✕';
    btn.setAttribute('aria-label', 'Dock panel');
    btn.setAttribute('title', 'Dock panel');
  } else {
    btn.textContent = '⊞';
    btn.setAttribute('aria-label', 'Pop out panel');
    btn.setAttribute('title', 'Pop out panel');
  }
}

function floatPanel(key) {
  const panelEl = panels[key];
  if (!panelEl || !canvasHost) return;
  if (panelEl.classList.contains('floating')) return;
  // Clear any stale dock-collapsed state — overlay panels have no dock slot.
  panelEl.classList.remove('dock-collapsed');
  delete body.dataset[key + 'Collapsed'];
  // Set body attr first so grid template collapses BEFORE we re-parent the
  // panel — avoids a one-frame flash where the grid still allocates the dock
  // column but the panel is already absolute-positioned.
  body.dataset[key + 'Floating'] = 'true';
  panelEl.classList.add('floating');
  canvasHost.appendChild(panelEl);
  // Inject resize-corner + edges (idempotent).
  ensureFloatHandles(panelEl);
  // Apply rect — restore persisted, else default.
  const stored = readRect(key);
  const rect = clampRectToHost(stored || defaultRect(key));
  applyFloatStyles(panelEl, rect);
  writeRect(key, rect);
  writeState(key, 'floating');
  raiseFloat(key);
  updatePopButton(key);
  schedulePositionEdges();
}

function dockPanel(key) {
  const panelEl = panels[key];
  if (!panelEl) return;
  if (!panelEl.classList.contains('floating')) return;
  if (panelEl.classList.contains('dock-exit')) return;
  // Hide dock-zone hint immediately so it doesn't linger during exit anim.
  if (dockZones[key]) dockZones[key].classList.remove('active');
  // Play exit animation, then complete the dock when it ends.
  panelEl.classList.add('dock-exit');
  const finalize = () => {
    panelEl.removeEventListener('animationend', finalize);
    clearTimeout(fallback);
    panelEl.classList.remove('floating', 'active', 'dock-exit');
    clearFloatStyles(panelEl);
    delete body.dataset[key + 'Floating'];
    const host = document.querySelector('.panel-host');
    if (host) host.appendChild(panelEl);
    writeState(key, 'docked');
    if (activeFloatKey === key) activeFloatKey = null;
    updatePopButton(key);
    schedulePositionEdges();
  };
  panelEl.addEventListener('animationend', finalize, { once: true });
  // Fallback in case animationend doesn't fire (reduced-motion, etc.).
  const fallback = setTimeout(finalize, 220);
}

function ensureFloatHandles(panelEl) {
  if (panelEl.dataset.floatBound === 'true') return;
  panelEl.dataset.floatBound = 'true';
  const corner = document.createElement('div');
  corner.className = 'resize-corner';
  panelEl.appendChild(corner);
  for (const side of ['n', 'e', 's', 'w']) {
    const ed = document.createElement('div');
    ed.className = 'resize-edge';
    ed.dataset.edge = side;
    panelEl.appendChild(ed);
  }
  bindFloatHandles(panelEl);
}

function bindFloatHandles(panelEl) {
  const key = panelEl.dataset.panel; // 'readings' / 'educator'
  // Header drag-to-move.
  const header = panelEl.querySelector('.panel-header');
  if (header) bindFloatHeader(panelEl, header, key);
  // Corner resize.
  const corner = panelEl.querySelector('.resize-corner');
  if (corner) bindFloatResize(panelEl, corner, 'corner', key);
  // Edge resizes.
  for (const ed of panelEl.querySelectorAll('.resize-edge')) {
    bindFloatResize(panelEl, ed, ed.dataset.edge, key);
  }
  // Click anywhere on the panel raises it.
  panelEl.addEventListener('pointerdown', () => {
    if (panelEl.classList.contains('floating')) raiseFloat(key);
  }, true);
}

function bindFloatHeader(panelEl, headerEl, key) {
  let dragging = false;
  let startX = 0, startY = 0;
  let startRect = null;
  let raf = 0;
  let liveRect = null;
  // Inertia: keep a short ring of recent move samples so release can compute
  // an average velocity over the last ~120ms (single-frame deltas are noisy
  // on touchscreens and lead to teleporting or dead releases).
  const SAMPLE_MS = 120;
  let samples = []; // [{ t, x, y }]
  let momentumRaf = 0;

  function cancelMomentum() {
    if (momentumRaf) { cancelAnimationFrame(momentumRaf); momentumRaf = 0; }
  }

  headerEl.addEventListener('pointerdown', e => {
    if (!panelEl.classList.contains('floating')) return;
    // Don't start a drag from interactive children (buttons inside header) or
    // the level-badge (clickable-feeling span on the educator panel).
    if (e.target.closest('button')) return;
    if (e.target.closest('.level-badge')) return;
    cancelMomentum(); // a new grab cancels any in-flight glide
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const r = panelEl.getBoundingClientRect();
    const host = getCanvasHostRect();
    startRect = { x: r.left - host.left, y: r.top - host.top, w: r.width, h: r.height };
    liveRect = { ...startRect };
    samples = [{ t: performance.now(), x: e.clientX, y: e.clientY }];
    panelEl.classList.add('dragging');
    raiseFloat(key);
    try { headerEl.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  });

  headerEl.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    liveRect = clampRectToHost({ x: startRect.x + dx, y: startRect.y + dy, w: startRect.w, h: startRect.h });
    const now = performance.now();
    samples.push({ t: now, x: e.clientX, y: e.clientY });
    // Drop samples older than the velocity window.
    while (samples.length > 2 && now - samples[0].t > SAMPLE_MS) samples.shift();
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      applyFloatStyles(panelEl, liveRect);
      updateDockZoneHint(key, liveRect);
    });
  });

  function release() {
    if (!dragging) return;
    dragging = false;
    panelEl.classList.remove('dragging');
    // If we're in the dock zone, dock instead of saving rect or gliding.
    if (isInDockZone(key, liveRect)) {
      dockPanel(key);
      hideDockZones();
      return;
    }
    hideDockZones();

    // Compute release velocity (px / ms) from the last sample window.
    let vx = 0, vy = 0;
    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dtMs = Math.max(1, last.t - first.t);
      vx = (last.x - first.x) / dtMs;
      vy = (last.y - first.y) / dtMs;
    }
    const speed = Math.hypot(vx, vy);

    if (speed < 0.25) {
      // Slow release — no glide, just persist the resting rect.
      writeRect(key, liveRect);
      return;
    }

    // Inertia loop: ease velocity to zero, advancing liveRect by vx/vy each
    // frame. Decay factor chosen so a fast flick travels ~250-400ms before
    // resting. Stop when speed drops below threshold or rect saturates.
    const decay = 0.92;
    const minSpeed = 0.03;
    let lastT = performance.now();
    const step = () => {
      const now = performance.now();
      const frameMs = Math.min(48, now - lastT);
      lastT = now;
      const before = { x: liveRect.x, y: liveRect.y };
      const candidate = {
        x: liveRect.x + vx * frameMs,
        y: liveRect.y + vy * frameMs,
        w: liveRect.w,
        h: liveRect.h,
      };
      liveRect = clampRectToHost(candidate);
      applyFloatStyles(panelEl, liveRect);
      // If the clamp ate the entire delta, we've hit a wall — kill velocity
      // on that axis so we don't burn frames sliding against an edge.
      if (liveRect.x === before.x) vx = 0;
      if (liveRect.y === before.y) vy = 0;
      vx *= decay; vy *= decay;
      const s = Math.hypot(vx, vy);
      if (s < minSpeed) {
        momentumRaf = 0;
        writeRect(key, liveRect);
        return;
      }
      momentumRaf = requestAnimationFrame(step);
    };
    momentumRaf = requestAnimationFrame(step);
  }
  headerEl.addEventListener('pointerup', release);
  headerEl.addEventListener('pointercancel', release);
  headerEl.addEventListener('lostpointercapture', release);
}

function bindFloatResize(panelEl, gripEl, mode, key) {
  let dragging = false;
  let startX = 0, startY = 0;
  let startRect = null;
  let raf = 0;
  let liveRect = null;

  gripEl.addEventListener('pointerdown', e => {
    if (!panelEl.classList.contains('floating')) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const r = panelEl.getBoundingClientRect();
    const host = getCanvasHostRect();
    startRect = { x: r.left - host.left, y: r.top - host.top, w: r.width, h: r.height };
    liveRect = { ...startRect };
    panelEl.classList.add('dragging');
    raiseFloat(key);
    try { gripEl.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
    e.stopPropagation();
  });

  gripEl.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let nx = startRect.x;
    let ny = startRect.y;
    let nw = startRect.w;
    let nh = startRect.h;
    if (mode === 'corner' || mode === 'e') nw = startRect.w + dx;
    if (mode === 'corner' || mode === 's') nh = startRect.h + dy;
    if (mode === 'w') { nw = startRect.w - dx; nx = startRect.x + dx; }
    if (mode === 'n') { nh = startRect.h - dy; ny = startRect.y + dy; }
    // Enforce min sizes BEFORE clamping to host so we don't drift the anchor.
    if (mode === 'w' && nw < MIN_W) { nx -= (MIN_W - nw); nw = MIN_W; }
    if (mode === 'n' && nh < MIN_H) { ny -= (MIN_H - nh); nh = MIN_H; }
    liveRect = clampRectToHost({ x: nx, y: ny, w: nw, h: nh });
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      applyFloatStyles(panelEl, liveRect);
    });
  });

  function release() {
    if (!dragging) return;
    dragging = false;
    panelEl.classList.remove('dragging');
    writeRect(key, liveRect);
  }
  gripEl.addEventListener('pointerup', release);
  gripEl.addEventListener('pointercancel', release);
  gripEl.addEventListener('lostpointercapture', release);
}

function isInDockZone(key, rect) {
  const host = getCanvasHostRect();
  if (key === 'readings') {
    // Readings docks to the right edge — center X near host right.
    const cx = rect.x + rect.w / 2;
    return cx > host.width - DOCK_ZONE_PX - rect.w * 0.25;
  } else if (key === 'educator') {
    const cy = rect.y + rect.h / 2;
    return cy > host.height - DOCK_ZONE_PX - rect.h * 0.25;
  }
  return false;
}

function updateDockZoneHint(key, rect) {
  const z = dockZones[key];
  if (!z) return;
  z.classList.toggle('active', isInDockZone(key, rect));
}

function hideDockZones() {
  for (const k of FLOAT_KEYS) {
    if (dockZones[k]) dockZones[k].classList.remove('active');
  }
}

// Wire pop buttons + restore floating state on load (desktop only).
for (const key of FLOAT_KEYS) setupPopButton(key);

// =============================================================================
// OVERLAY VISIBILITY — readings + educator are overlay-only, no dock position.
// Topbar toggle buttons show/hide them; pop button in header closes them.
// =============================================================================
const OVERLAY_VIS_BTNS = {};

function hideOverlayPanel(key) {
  const panelEl = panels[key];
  if (!panelEl) return;
  panelEl.classList.add('panel-overlay-hidden');
  try { localStorage.setItem(`ps:panel:${key}:hidden`, 'true'); } catch {}
  updateOverlayVisBtn(key);
}

function showOverlayPanel(key) {
  const panelEl = panels[key];
  if (!panelEl) return;
  panelEl.classList.remove('panel-overlay-hidden');
  try { localStorage.setItem(`ps:panel:${key}:hidden`, 'false'); } catch {}
  if (!panelEl.classList.contains('floating')) floatPanel(key);
  else raiseFloat(key);
  updateOverlayVisBtn(key);
}

function toggleOverlayPanel(key) {
  const panelEl = panels[key];
  if (!panelEl) return;
  if (panelEl.classList.contains('panel-overlay-hidden')) showOverlayPanel(key);
  else hideOverlayPanel(key);
}

function updateOverlayVisBtn(key) {
  const btn = OVERLAY_VIS_BTNS[key];
  if (!btn) return;
  const on = mobile
    ? overlayOpen[key] === true
    : !panels[key]?.classList.contains('panel-overlay-hidden');
  btn.classList.toggle('active', on);
}

function setupOverlayToggleBtn(key) {
  const btn = document.querySelector(`[data-vis-panel="${key}"]`);
  if (!btn) return;
  OVERLAY_VIS_BTNS[key] = btn;
  btn.addEventListener('click', () => {
    if (mobile) {
      // Mobile uses the overlayOpen map (same logic as the retired tabbar).
      overlayOpen[key] = !overlayOpen[key];
      if (overlayOpen[key]) panels[key]?.classList.remove('panel-collapsed');
      syncPanelVisibility();
      updateOverlayVisBtn(key);
    } else {
      toggleOverlayPanel(key);
    }
  });
  updateOverlayVisBtn(key);
}

for (const key of FLOAT_KEYS) setupOverlayToggleBtn(key);

// Tools toggle (mobile-only button in the ⋯ menu). Mirrors the retired
// tabbar "Tools" tab — opens / closes the bottom sheet.
const toolsToggleBtn = document.getElementById('toggleToolsBtn');
if (toolsToggleBtn) {
  toolsToggleBtn.addEventListener('click', () => {
    if (!mobile) return;
    if (sheetOpen && activeTab === 'tools') closeSheet();
    else setActiveTab('tools', { openSheet: true });
  });
}

function restoreFloatStates() {
  if (mobile) return;
  for (const key of FLOAT_KEYS) {
    floatPanel(key); // Overlay panels have no dock position — always float
  }
  // Restore hidden state
  for (const key of FLOAT_KEYS) {
    try {
      if (localStorage.getItem(`ps:panel:${key}:hidden`) === 'true') hideOverlayPanel(key);
    } catch {}
  }
}
// Defer one frame so canvas-host has a measured rect before we clamp into it.
requestAnimationFrame(restoreFloatStates);

// =============================================================================
// DOCK COLLAPSE — each docked panel can be collapsed to a thin strip.
// Tools/Readings → 32px sidebar strip. Educator → 28px bottom strip.
// State persists via localStorage. Collapsed panels hide the dock-edge handle.
// =============================================================================
const COLLAPSE_LS = {
  tools:    'ps:panel:tools:collapsed',
  readings: 'ps:panel:readings:collapsed',
  educator: 'ps:panel:educator:collapsed',
};
const COLLAPSE_SIZES = { tools: 36, readings: 36, educator: 28 };
const CSS_VAR_MAP  = { tools: '--tools-w', readings: '--readings-w', educator: '--educator-h' };
const LS_SIZE_MAP  = { tools: LS.toolsW, readings: LS.readingsW, educator: LS.educatorH };
const RANGE_MAP    = { tools: RANGES.toolsW, readings: RANGES.readingsW, educator: RANGES.educatorH };
const COLLAPSE_LABELS = {
  tools:    { open: '‹', closed: '›', labelOpen: 'Collapse tools',    labelClosed: 'Expand tools'    },
  readings: { open: '›', closed: '‹', labelOpen: 'Collapse readings', labelClosed: 'Expand readings' },
  educator: { open: '⌄', closed: '⌃', labelOpen: 'Collapse educator', labelClosed: 'Expand educator' },
};

const dockCollapsed = { tools: false, readings: false, educator: false };
const COLLAPSE_BTNS = {};

function readDockCollapsed(key) {
  try { return localStorage.getItem(COLLAPSE_LS[key]) === 'true'; } catch { return false; }
}
function writeDockCollapsed(key, val) {
  try { localStorage.setItem(COLLAPSE_LS[key], String(val)); } catch {}
}

function applyDockCollapse(key) {
  const panelEl = panels[key];
  if (!panelEl) return;
  const isCollapsed = dockCollapsed[key];
  panelEl.classList.toggle('dock-collapsed', isCollapsed);
  body.dataset[key + 'Collapsed'] = String(isCollapsed);
  const root = document.documentElement;
  if (isCollapsed) {
    root.style.setProperty(CSS_VAR_MAP[key], `${COLLAPSE_SIZES[key]}px`);
  } else {
    const stored = parseFloat(localStorage.getItem(LS_SIZE_MAP[key]));
    if (Number.isFinite(stored)) root.style.setProperty(CSS_VAR_MAP[key], `${clamp(stored, ...RANGE_MAP[key])}px`);
    else root.style.removeProperty(CSS_VAR_MAP[key]);
  }
  updateCollapseBtn(key);
  schedulePositionEdges();
  // Re-measure canvas after the 240ms grid transition finishes.
  setTimeout(() => { if (typeof window.PSandboxResize === 'function') window.PSandboxResize(); }, 260);
}

function updateCollapseBtn(key) {
  const btn = COLLAPSE_BTNS[key];
  if (!btn) return;
  const l = COLLAPSE_LABELS[key];
  const isCollapsed = dockCollapsed[key];
  btn.textContent = isCollapsed ? l.closed : l.open;
  btn.setAttribute('aria-label', isCollapsed ? l.labelClosed : l.labelOpen);
  btn.setAttribute('title',      isCollapsed ? l.labelClosed : l.labelOpen);
}

function toggleDockCollapse(key) {
  const panelEl = panels[key];
  if (!panelEl || mobile) return;
  if (panelEl.classList.contains('floating')) return;
  dockCollapsed[key] = !dockCollapsed[key];
  applyDockCollapse(key);
  writeDockCollapsed(key, dockCollapsed[key]);
}

function setupCollapseButton(key) {
  const panelEl = panels[key];
  if (!panelEl) return;
  const btn = panelEl.querySelector(`.panel-collapse[data-collapse="${key}"]`);
  if (!btn) return;
  COLLAPSE_BTNS[key] = btn;
  btn.addEventListener('click', e => { e.stopPropagation(); toggleDockCollapse(key); });
  updateCollapseBtn(key);
}

function restoreCollapseStates() {
  if (mobile) return;
  for (const key of TABS) {
    if (FLOAT_KEYS.includes(key)) continue; // overlay-only panels have no dock slot
    dockCollapsed[key] = readDockCollapsed(key);
    if (dockCollapsed[key]) applyDockCollapse(key);
    else updateCollapseBtn(key);
  }
}

for (const key of TABS) setupCollapseButton(key);
restoreCollapseStates();

// Re-clamp floating panels when canvas-host resizes (e.g. window resize, dock
// width changes). Use the existing canvas-host ResizeObserver hook.
if ('ResizeObserver' in window && canvasHost) {
  const ro = new ResizeObserver(() => {
    for (const key of FLOAT_KEYS) {
      const el = panels[key];
      if (!el || !el.classList.contains('floating')) continue;
      const stored = readRect(key) || defaultRect(key);
      const r = clampRectToHost(stored);
      applyFloatStyles(el, r);
      writeRect(key, r);
    }
  });
  ro.observe(canvasHost);
}

// =============================================================================
// Breakpoint changes ----------------------------------------------------------
// =============================================================================
const mql = window.matchMedia(MOBILE_QUERY);
const mqlLandscape = window.matchMedia(LANDSCAPE_MOBILE_QUERY);

function updateLayoutMode() {
  if (!mobile) {
    body.dataset.layoutMode = 'desktop';
  } else if (landscapeMobile) {
    body.dataset.layoutMode = 'landscape-mobile';
  } else {
    body.dataset.layoutMode = 'portrait-mobile';
  }
}

function onBreakpointChange() {
  const wasMobile = mobile;
  const wasLandscape = landscapeMobile;
  mobile = mql.matches;
  landscapeMobile = mqlLandscape.matches;
  const breakpointFlipped = wasMobile !== mobile;
  const orientationFlipped = wasLandscape !== landscapeMobile;
  if (!breakpointFlipped && !orientationFlipped) return;
  updateLayoutMode();
  if (breakpointFlipped) {
    if (!mobile) {
      sheetOpen = false;
      body.dataset.sheetOpen = 'false';
      delete body.dataset.sheetLocked;
      setSheetHeight('mid');
      // Show dock-edges + restore floating and collapse states.
      for (const el of Object.values(dockEdges)) el.style.display = '';
      restoreCollapseStates();
      restoreFloatStates();
      schedulePositionEdges();
    } else {
      sheetOpen = false;
      body.dataset.sheetOpen = 'false';
      delete body.dataset.sheetLocked;
      // Clear collapse visual state for mobile (no strips on mobile).
      for (const key of TABS) {
        const panelEl = panels[key];
        if (panelEl) panelEl.classList.remove('dock-collapsed');
        delete body.dataset[key + 'Collapsed'];
        const root = document.documentElement;
        root.style.removeProperty(CSS_VAR_MAP[key]);
      }
      // Hide dock-edges and tear down floats so the sheet renders cleanly.
      for (const el of Object.values(dockEdges)) el.style.display = 'none';
      for (const key of FLOAT_KEYS) {
        const el = panels[key];
        if (el && el.classList.contains('floating')) {
          // Don't clear the persisted state — just visually re-dock for mobile.
          el.classList.remove('floating', 'active');
          clearFloatStyles(el);
          delete body.dataset[key + 'Floating'];
          const host = document.querySelector('.panel-host');
          if (host) host.appendChild(el);
          updatePopButton(key);
        }
      }
    }
  }
  if (orientationFlipped) {
    // Clear any inline drag override so the new axis CSS var picks up cleanly.
    for (const el of Object.values(panels)) {
      if (!el) continue;
      el.style.removeProperty('--sheet-height');
      el.style.removeProperty('--sheet-width');
    }
  }
  syncPanelVisibility();
}

function bindMql(target, handler) {
  if (typeof target.addEventListener === 'function') {
    target.addEventListener('change', handler);
  } else if (typeof target.addListener === 'function') {
    target.addListener(handler);
  }
}
bindMql(mql, onBreakpointChange);
bindMql(mqlLandscape, onBreakpointChange);
window.addEventListener('orientationchange', onBreakpointChange);

// =============================================================================
// TOPBAR OVERFLOW MENU — `⋯` button toggles a dropdown that holds the
// Save/Load/Share/Derivations/Reset/Clear actions on mobile. On desktop the
// `.topbar-overflow` wrapper uses `display: contents` so children flow inline
// and the ⋯ button hides (CSS-driven). Click-outside + Escape close.
// =============================================================================
const topbarMoreBtn = document.getElementById('topbarMore');
const topbarOverflow = document.getElementById('topbarOverflow');

function openTopbarOverflow() {
  body.dataset.topbarOverflowOpen = 'true';
  if (topbarMoreBtn) topbarMoreBtn.setAttribute('aria-expanded', 'true');
  positionFabMenu();
}
function closeTopbarOverflow() {
  delete body.dataset.topbarOverflowOpen;
  if (topbarMoreBtn) topbarMoreBtn.setAttribute('aria-expanded', 'false');
}
function toggleTopbarOverflow() {
  if (body.dataset.topbarOverflowOpen === 'true') closeTopbarOverflow();
  else openTopbarOverflow();
}

if (topbarMoreBtn) {
  topbarMoreBtn.addEventListener('click', e => {
    e.stopPropagation();
    toggleTopbarOverflow();
  });
}
// When a button inside the overflow is clicked, close the menu (the underlying
// app.js handlers still fire because they're bound by id directly).
if (topbarOverflow) {
  topbarOverflow.addEventListener('click', e => {
    if (e.target.closest('button')) closeTopbarOverflow();
  });
}
// Click-outside closes the menu.
document.addEventListener('pointerdown', e => {
  if (body.dataset.topbarOverflowOpen !== 'true') return;
  if (e.target.closest('.topbar-overflow,.topbar-more')) return;
  closeTopbarOverflow();
}, true);
// Escape closes the menu.
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && body.dataset.topbarOverflowOpen === 'true') {
    closeTopbarOverflow();
  }
});

// =============================================================================
// DRAGGABLE FAB — on mobile the ⋯ button is a fixed FAB that can be dragged
// to any position on screen. Position persists via localStorage.
// Double-tap resets to default corner position.
// =============================================================================
function positionFabMenu() {
  if (!topbarMoreBtn || !topbarOverflow) return;
  if (window.innerWidth > 768) return;
  const btn = topbarMoreBtn.getBoundingClientRect();
  const mW = 190, mH = 264;
  let top = btn.top > window.innerHeight / 2 ? btn.top - mH - 4 : btn.bottom + 4;
  let left = Math.max(8, Math.min(btn.right - mW, window.innerWidth - mW - 8));
  top = Math.max(8, Math.min(top, window.innerHeight - mH - 8));
  topbarOverflow.style.top = top + 'px';
  topbarOverflow.style.left = left + 'px';
  topbarOverflow.style.right = '';
  topbarOverflow.style.bottom = '';
}

(function initFabDrag() {
  if (!topbarMoreBtn) return;
  const LS = 'ps_fab_pos';
  const SZ = 44, THRESH = 6, R = 16, B = 16;

  function isMob() { return window.innerWidth <= 768; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function applyPos(left, top) {
    topbarMoreBtn.style.left = left + 'px';
    topbarMoreBtn.style.top = top + 'px';
    topbarMoreBtn.style.right = '';
    topbarMoreBtn.style.bottom = '';
  }
  function defaultPos() {
    const sai = parseFloat(getComputedStyle(document.documentElement).paddingBottom) || 0;
    return { left: window.innerWidth - SZ - R, top: window.innerHeight - SZ - B - sai };
  }
  function constrain(left, top) {
    return { left: clamp(left, 8, window.innerWidth - SZ - 8), top: clamp(top, 8, window.innerHeight - SZ - 8) };
  }
  function loadPos() {
    let s;
    try { s = localStorage.getItem(LS); } catch { return null; }
    if (!s) return null;
    try { return JSON.parse(s); }
    catch (e) { console.warn('[layout] bad JSON for ' + LS, e); return null; }
  }
  function savePos(l, t) { try { localStorage.setItem(LS, JSON.stringify({ left: l, top: t })); } catch {} }

  function initPos() {
    if (!isMob()) return;
    const saved = loadPos();
    const pos = saved ? constrain(saved.left, saved.top) : defaultPos();
    applyPos(pos.left, pos.top);
  }

  let dsx = 0, dsy = 0, fsl = 0, fst = 0, dragging = false, moved = false, lastTap = 0;

  topbarMoreBtn.addEventListener('pointerdown', e => {
    if (!isMob()) return;
    dsx = e.clientX; dsy = e.clientY;
    const r = topbarMoreBtn.getBoundingClientRect();
    fsl = r.left; fst = r.top;
    dragging = true; moved = false;
    topbarMoreBtn.setPointerCapture(e.pointerId);
  });

  topbarMoreBtn.addEventListener('pointermove', e => {
    if (!dragging || !isMob()) return;
    const dx = e.clientX - dsx, dy = e.clientY - dsy;
    if (!moved && Math.hypot(dx, dy) < THRESH) return;
    moved = true;
    topbarMoreBtn.classList.add('ps-dragging');
    const { left, top } = constrain(fsl + dx, fst + dy);
    applyPos(left, top);
  });

  topbarMoreBtn.addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging = false;
    topbarMoreBtn.classList.remove('ps-dragging');
    if (moved) {
      const r = topbarMoreBtn.getBoundingClientRect();
      savePos(r.left, r.top);
      e.stopImmediatePropagation();
      moved = false;
      return;
    }
    moved = false;
    const now = Date.now();
    if (now - lastTap < 400) {
      const pos = defaultPos();
      applyPos(pos.left, pos.top);
      savePos(pos.left, pos.top);
      lastTap = 0;
      closeTopbarOverflow();
      return;
    }
    lastTap = now;
  });

  topbarMoreBtn.addEventListener('pointercancel', () => {
    dragging = false; moved = false;
    topbarMoreBtn.classList.remove('ps-dragging');
  });

  window.addEventListener('resize', () => {
    if (!isMob()) return;
    const saved = loadPos();
    if (saved) { const p = constrain(saved.left, saved.top); applyPos(p.left, p.top); }
    else { const p = defaultPos(); applyPos(p.left, p.top); }
  });

  initPos();
})();

// Tools close button (mobile only) --------------------------------------------
const toolsCloseBtn = document.getElementById('toolsClose');
if (toolsCloseBtn) {
  toolsCloseBtn.addEventListener('click', () => { if (mobile) closeSheet(); });
}

// Overlay close buttons (mobile only) -----------------------------------------
const readingsCloseBtn = document.getElementById('readingsClose');
if (readingsCloseBtn) {
  readingsCloseBtn.addEventListener('click', () => {
    if (!mobile) return;
    overlayOpen.readings = false;
    syncPanelVisibility();
  });
}
const educatorCloseBtn = document.getElementById('educatorClose');
if (educatorCloseBtn) {
  educatorCloseBtn.addEventListener('click', () => {
    if (!mobile) return;
    overlayOpen.educator = false;
    syncPanelVisibility();
  });
}

// =============================================================================
// Init ------------------------------------------------------------------------
// =============================================================================
updateLayoutMode();
setSheetHeight('mid');
setActiveTab('tools');
// Auto-open the tools sheet on mobile so controls are visible immediately.
if (mobile) openSheet();
// Both overlays start hidden on mobile (overlayOpen = false).
// Pre-collapse educator so that the first open always shows full content
// (the tab-open handler removes panel-collapsed before making it visible).
if (mobile) panels.educator?.classList.add('panel-collapsed');
syncPanelVisibility();
schedulePositionEdges();

// Keyboard-shortcut globals app.js calls --------------------------------------
window.toggleInfoOverlay = () => {
  if (mobile) {
    overlayOpen.readings = !overlayOpen.readings;
    if (overlayOpen.readings) panels.readings?.classList.remove('panel-collapsed');
    syncPanelVisibility();
  } else {
    toggleOverlayPanel('readings');
  }
};
window.toggleLessonOverlay = () => {
  if (mobile) {
    overlayOpen.educator = !overlayOpen.educator;
    if (overlayOpen.educator) panels.educator?.classList.remove('panel-collapsed');
    syncPanelVisibility();
  } else {
    toggleOverlayPanel('educator');
  }
};
window.toggleTipsOverlay = () => {
  const dlg = document.getElementById('helpDialog');
  if (dlg && typeof dlg.showModal === 'function' && !dlg.open) dlg.showModal();
};

// Expose for debugging.
window.PSandboxLayout = {
  setActiveTab, openSheet, closeSheet, toggleSheet,
  floatPanel, dockPanel,
  showOverlayPanel, hideOverlayPanel, toggleOverlayPanel,
  openTopbarOverflow, closeTopbarOverflow, toggleTopbarOverflow,
  get state() {
    return {
      activeTab, sheetOpen, mobile, landscapeMobile, sheetHeightMode,
      layoutMode: body.dataset.layoutMode,
      readingsFloating: panels.readings?.classList.contains('floating') || false,
      educatorFloating: panels.educator?.classList.contains('floating') || false,
    };
  },
};
