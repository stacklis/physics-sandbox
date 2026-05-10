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

// Public surface (used by app.js for keyboard shortcuts) ----------------------
function setActiveTab(tab, opts = {}) {
  if (!TABS.includes(tab)) return;
  activeTab = tab;
  body.dataset.activeTab = tab;
  tabs.forEach(b => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
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

// Update `.visible` on the panels app.js polls every frame. -------------------
// On desktop: tools, readings, educator are all visible (they live in their own
// grid zones OR float above the canvas). Tips is never visible.
// On mobile: only the active panel gets `.visible`, and only when the sheet is
// open. Closed sheet => no panel is "visible" so app.js skips the update work.
function syncPanelVisibility() {
  for (const tab of TABS) {
    const el = panels[tab];
    if (!el) continue;
    let on;
    if (mobile) {
      on = sheetOpen && tab === activeTab;
    } else {
      on = true;
    }
    el.classList.toggle('visible', on);
  }
}

// Tab clicks ------------------------------------------------------------------
tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (mobile && tab === activeTab && sheetOpen) {
      closeSheet();
    } else {
      setActiveTab(tab, { openSheet: true });
    }
  });
});

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
  try {
    const raw = localStorage.getItem(LS[key + 'Rect']);
    if (!raw) return null;
    const r = JSON.parse(raw);
    if (r && Number.isFinite(r.w) && Number.isFinite(r.h)) return r;
  } catch {}
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
    if (panelEl.classList.contains('floating')) dockPanel(key);
    else floatPanel(key);
  });
  // Reflect initial label.
  updatePopButton(key);
}

function updatePopButton(key) {
  const btn = POP_BUTTONS[key];
  const panelEl = panels[key];
  if (!btn || !panelEl) return;
  const isFloat = panelEl.classList.contains('floating');
  btn.textContent = isFloat ? '⊟' : '⊞';
  btn.setAttribute('aria-label', isFloat ? 'Dock panel' : 'Detach panel');
  btn.setAttribute('title', isFloat ? 'Dock panel' : 'Pop out');
}

function floatPanel(key) {
  const panelEl = panels[key];
  if (!panelEl || !canvasHost) return;
  if (panelEl.classList.contains('floating')) return;
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
  if (panelEl.classList.contains('dock-exit')) return; // already animating out
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

  headerEl.addEventListener('pointerdown', e => {
    if (!panelEl.classList.contains('floating')) return;
    // Don't start a drag from interactive children (buttons inside header) or
    // the level-badge (clickable-feeling span on the educator panel).
    if (e.target.closest('button')) return;
    if (e.target.closest('.level-badge')) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const r = panelEl.getBoundingClientRect();
    const host = getCanvasHostRect();
    startRect = { x: r.left - host.left, y: r.top - host.top, w: r.width, h: r.height };
    liveRect = { ...startRect };
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
    // If we're in the dock zone, dock instead of saving rect.
    if (isInDockZone(key, liveRect)) {
      dockPanel(key);
      hideDockZones();
      return;
    }
    hideDockZones();
    writeRect(key, liveRect);
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

function restoreFloatStates() {
  if (mobile) return;
  for (const key of FLOAT_KEYS) {
    if (readState(key) === 'floating') floatPanel(key);
  }
}
// Defer one frame so canvas-host has a measured rect before we clamp into it.
requestAnimationFrame(restoreFloatStates);

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
      // Show dock-edges + restore floating states.
      for (const el of Object.values(dockEdges)) el.style.display = '';
      restoreFloatStates();
      schedulePositionEdges();
    } else {
      sheetOpen = false;
      body.dataset.sheetOpen = 'false';
      delete body.dataset.sheetLocked;
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
// Init ------------------------------------------------------------------------
// =============================================================================
updateLayoutMode();
setSheetHeight('mid');
setActiveTab('tools');
syncPanelVisibility();
schedulePositionEdges();

// Keyboard-shortcut globals app.js calls --------------------------------------
window.toggleInfoOverlay = () => {
  if (mobile) {
    if (activeTab === 'readings' && sheetOpen) closeSheet();
    else setActiveTab('readings', { openSheet: true });
  } else {
    panels.readings.classList.add('flash');
    setTimeout(() => panels.readings.classList.remove('flash'), 600);
  }
};
window.toggleLessonOverlay = () => {
  if (mobile) {
    if (activeTab === 'educator' && sheetOpen) closeSheet();
    else setActiveTab('educator', { openSheet: true });
  } else {
    panels.educator.classList.add('flash');
    setTimeout(() => panels.educator.classList.remove('flash'), 600);
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
