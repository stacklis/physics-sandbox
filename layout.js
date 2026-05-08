// layout.js — Physics Sandbox layout controller (2026-05-08 rework).
//
// Drives the bottom-tab/sheet UX on mobile (<=1024px) and the derived three-zone
// sidebar layout on desktop (>1024px). app.js never sees the difference: it just
// queries `.visible` on `#infoOverlay` / `#lessonOverlay` / `#tipsOverlay`, and
// calls `window.toggleInfoOverlay()` / `toggleLessonOverlay()` / `toggleTipsOverlay()`
// for keyboard shortcuts. This module exposes those globals and toggles `.visible`
// on the appropriate panel.
//
// No build step. Native ESM. Loaded via `<script type="module">`.

const TABS = ['tools', 'readings', 'educator'];
const PANEL_BY_TAB = { tools: 'toolsPanel', readings: 'infoOverlay', educator: 'lessonOverlay' };
const MOBILE_QUERY = '(max-width: 1024px)';

const body = document.body;
const tabbar = document.querySelector('.tabbar');
const tabs = Array.from(document.querySelectorAll('.tabbar .tab'));
const panels = {
  tools: document.getElementById('toolsPanel'),
  readings: document.getElementById('infoOverlay'),
  educator: document.getElementById('lessonOverlay'),
};

// State -----------------------------------------------------------------------
let activeTab = 'tools';
let sheetOpen = false;          // mobile only
let mobile = window.matchMedia(MOBILE_QUERY).matches;

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
  syncPanelVisibility();
}

function closeSheet() {
  sheetOpen = false;
  body.dataset.sheetOpen = 'false';
  syncPanelVisibility();
}

function toggleSheet() {
  if (sheetOpen) closeSheet(); else openSheet();
}

// Update `.visible` on the panels app.js polls every frame. -------------------
// On desktop: tools, readings, educator are all visible (they live in their own
// grid zones). Tips is never visible.
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
      // Tap active tab => dismiss
      closeSheet();
    } else {
      setActiveTab(tab, { openSheet: true });
    }
  });
});

// Swipe-down dismiss + drag-to-resize on the sheet ----------------------------
// Lightweight: track Y delta on pointerdown of the panel-grabber. On release,
// > 60px down => close. < -40px => grow to tall. Otherwise snap back.
const SHEET_HEIGHTS = { default: '60vh', tall: '85vh' };
let sheetHeightMode = 'default';

function setSheetHeight(mode) {
  sheetHeightMode = mode;
  body.dataset.sheetHeight = mode;
}

function bindGrabber(panelEl) {
  const grabber = panelEl.querySelector('.panel-grabber');
  if (!grabber) return;
  let startY = 0;
  let dy = 0;
  let dragging = false;
  let pointerId = null;

  grabber.addEventListener('pointerdown', e => {
    if (!mobile) return;
    dragging = true;
    pointerId = e.pointerId;
    startY = e.clientY;
    dy = 0;
    try { grabber.setPointerCapture(e.pointerId); } catch {}
    panelEl.classList.add('dragging');
  });

  grabber.addEventListener('pointermove', e => {
    if (!dragging) return;
    dy = e.clientY - startY;
    // Live-translate while dragging — user feels they're holding the sheet.
    const translate = Math.max(0, dy);
    panelEl.style.transform = `translateY(${translate}px)`;
  });

  function release() {
    if (!dragging) return;
    dragging = false;
    panelEl.classList.remove('dragging');
    panelEl.style.transform = '';
    if (dy > 80) {
      closeSheet();
    } else if (dy < -50) {
      setSheetHeight('tall');
    } else {
      // Snap back; if we were tall and user dragged down a bit, drop to default.
      if (sheetHeightMode === 'tall' && dy > 30) setSheetHeight('default');
    }
  }

  grabber.addEventListener('pointerup', release);
  grabber.addEventListener('pointercancel', release);
  grabber.addEventListener('lostpointercapture', release);
}

Object.values(panels).forEach(el => { if (el) bindGrabber(el); });

// Breakpoint changes ----------------------------------------------------------
const mql = window.matchMedia(MOBILE_QUERY);
function onBreakpointChange() {
  const wasMobile = mobile;
  mobile = mql.matches;
  if (wasMobile === mobile) return;
  // Reset sheet state when we cross. On desktop the sheet concept doesn't apply.
  if (!mobile) {
    sheetOpen = false;
    body.dataset.sheetOpen = 'false';
    setSheetHeight('default');
  } else {
    // Entering mobile — sheet starts closed; user taps a tab to open.
    sheetOpen = false;
    body.dataset.sheetOpen = 'false';
  }
  syncPanelVisibility();
}
if (typeof mql.addEventListener === 'function') {
  mql.addEventListener('change', onBreakpointChange);
} else if (typeof mql.addListener === 'function') {
  mql.addListener(onBreakpointChange);
}

// Init ------------------------------------------------------------------------
setSheetHeight('default');
setActiveTab('tools');
syncPanelVisibility();

// Keyboard-shortcut globals app.js calls --------------------------------------
window.toggleInfoOverlay = () => {
  if (mobile) {
    if (activeTab === 'readings' && sheetOpen) closeSheet();
    else setActiveTab('readings', { openSheet: true });
  } else {
    // Desktop: panels are always visible. Briefly highlight the readings panel.
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
  // Tips merged into Educator + helpDialog. 'T' opens help dialog.
  const dlg = document.getElementById('helpDialog');
  if (dlg && typeof dlg.showModal === 'function' && !dlg.open) dlg.showModal();
};

// Expose for debugging.
window.PSandboxLayout = { setActiveTab, openSheet, closeSheet, toggleSheet, get state() {
  return { activeTab, sheetOpen, mobile, sheetHeightMode };
}};
