// app.js — main app: renderer, input, tools, presets, UI wiring
'use strict';

(function () {
const { Vec2, World, Body, DistanceConstraint, makeBox, makeCircle, makePolygon, SHAPE } = window.PSandbox;
const { Educator } = window.PEdu;

/* =========================== canvas & camera =========================== */
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let cssW = 0, cssH = 0, dpr = 1;
const PX_PER_M = 50;          // 1 meter = 50 px (constant for now)
const camera = { x: 0, y: 0, scale: PX_PER_M };

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  cssW = rect.width; cssH = rect.height;
  dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  rebuildBoundaries();
}
window.addEventListener('resize', resize);

const screenToWorld = (sx, sy) => new Vec2((sx - camera.x) / camera.scale, (sy - camera.y) / camera.scale);
const worldToScreen = (wx, wy) => ({ x: wx * camera.scale + camera.x, y: wy * camera.scale + camera.y });

/* =========================== world =========================== */
const world = new World({ gravity: 9.81, iterations: 10 });
let walls = [];
function rebuildBoundaries() {
  for (const w of walls) world.remove(w);
  walls = [];
  if (cssW === 0) return;
  const Wm = cssW / PX_PER_M, Hm = cssH / PX_PER_M;
  const t = 0.4;
  // floor
  walls.push(world.add(makeBox(Wm / 2, Hm + t / 2 - 0.05, Wm + t * 2, t,
    { isStatic: true, color: '#3a4055' })));
  // ceiling
  walls.push(world.add(makeBox(Wm / 2, -t / 2 + 0.05, Wm + t * 2, t,
    { isStatic: true, color: '#3a4055' })));
  // left
  walls.push(world.add(makeBox(-t / 2 + 0.05, Hm / 2, t, Hm + t * 2,
    { isStatic: true, color: '#3a4055' })));
  // right
  walls.push(world.add(makeBox(Wm + t / 2 - 0.05, Hm / 2, t, Hm + t * 2,
    { isStatic: true, color: '#3a4055' })));
}

/* =========================== UI elements =========================== */
const ui = {
  gravity: document.getElementById('gravity'),
  gravityVal: document.getElementById('gravityVal'),
  timeScale: document.getElementById('timeScale'),
  timeVal: document.getElementById('timeVal'),
  pauseBtn: document.getElementById('pauseBtn'),
  resetBtn: document.getElementById('resetBtn'),
  clearBtn: document.getElementById('clearBtn'),
  showVectors: document.getElementById('showVectors'),
  showContacts: document.getElementById('showContacts'),
  showTrails: document.getElementById('showTrails'),
  showAABB: document.getElementById('showAABB'),
  showHeatmap: document.getElementById('showHeatmap'),
  showFPS: document.getElementById('showFPS'),
  audioOn: document.getElementById('audioOn'),
  audioVol: document.getElementById('audioVol'),
  hint: document.getElementById('hint'),
  // educator targets (now in floating overlays)
  lessonTitle: document.getElementById('ov-lessonTitle'),
  lessonBody: document.getElementById('ov-lessonBody'),
  lessonFormula: document.getElementById('ov-lessonFormula'),
  lessonTags: document.getElementById('ov-lessonTags'),
  levelBadge: document.getElementById('ov-levelBadge'),
  conceptList: document.getElementById('ov-conceptList'),
};

const educator = new Educator(world, ui);

/* =========================== audio =========================== */
// Procedural Web Audio synthesis. AudioContext is lazy-initialized on the first
// user gesture (browsers block AudioContext.start() outside a gesture).
const AudioFx = (() => {
  let actx = null;
  let masterGain = null;
  let lastCollisionT = 0; // dedupe collision spam from many simultaneous contacts

  function ensure() {
    if (actx) return true;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    actx = new Ctor();
    masterGain = actx.createGain();
    masterGain.gain.value = parseFloat(ui.audioVol.value);
    masterGain.connect(actx.destination);
    return true;
  }

  function active() {
    if (!ui.audioOn.checked) return null;
    if (!ensure()) return null;
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  // Tone with attack-decay envelope. type ∈ {sine, triangle, sawtooth, square}.
  function tone({ freq, dur, type = 'sine', gain = 0.2, slideTo = null }) {
    const ax = active(); if (!ax) return;
    const t0 = ax.currentTime;
    const osc = ax.createOscillator();
    const g = ax.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // Filtered noise burst (good for impacts, swishes).
  function noise({ dur, filter = 1500, type = 'lowpass', gain = 0.2 }) {
    const ax = active(); if (!ax) return;
    const t0 = ax.currentTime;
    const len = Math.max(1, Math.ceil(ax.sampleRate * dur));
    const buffer = ax.createBuffer(1, len, ax.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ax.createBufferSource();
    src.buffer = buffer;
    const f = ax.createBiquadFilter();
    f.type = type;
    f.frequency.value = filter;
    const g = ax.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(masterGain);
    src.start(t0);
  }

  return {
    setVolume(v) {
      if (masterGain) masterGain.gain.setValueAtTime(v, actx.currentTime);
    },
    collision(relV, now) {
      // Dedupe: cap to ~one impact sound per 25 ms across all contacts.
      if (now - lastCollisionT < 25) return;
      lastCollisionT = now;
      const v = Math.min(Math.max(relV || 0, 0.5), 30);
      const pitch = 90 + v * 12;          // soft thud → sharp clack
      const gain = Math.min(0.45, 0.04 + v * 0.018);
      noise({ dur: 0.04 + v * 0.004, filter: pitch * 6, gain });
      // tiny sub-thud for low-velocity hits to give body
      if (v < 8) tone({ freq: 80, dur: 0.06, type: 'sine', gain: gain * 0.3 });
    },
    spring() {
      tone({ freq: 320, dur: 0.18, type: 'triangle', gain: 0.12, slideTo: 180 });
    },
    push() {
      noise({ dur: 0.16, filter: 1200, type: 'bandpass', gain: 0.18 });
    },
    spawn() {
      tone({ freq: 540, dur: 0.07, type: 'sine', gain: 0.10, slideTo: 720 });
    },
    slice() {
      noise({ dur: 0.10, filter: 5000, type: 'highpass', gain: 0.14 });
    },
    pin() {
      tone({ freq: 880, dur: 0.05, type: 'square', gain: 0.07 });
    },
    // ======================= UI SOUNDS =======================
    // Soft hover tick - subtle high frequency blip
    hover() {
      tone({ freq: 2200, dur: 0.025, type: 'sine', gain: 0.04 });
    },
    // Click/select sound - satisfying pop
    click() {
      tone({ freq: 660, dur: 0.04, type: 'triangle', gain: 0.08 });
      tone({ freq: 1320, dur: 0.02, type: 'sine', gain: 0.04 });
    },
    // Tool selection - distinctive chirp
    toolSelect() {
      tone({ freq: 880, dur: 0.05, type: 'triangle', gain: 0.10, slideTo: 1100 });
    },
    // Toggle on - rising tone
    toggleOn() {
      tone({ freq: 440, dur: 0.06, type: 'sine', gain: 0.08, slideTo: 880 });
    },
    // Toggle off - falling tone
    toggleOff() {
      tone({ freq: 660, dur: 0.06, type: 'sine', gain: 0.06, slideTo: 330 });
    },
    // Slider tick - tiny click for each step
    sliderTick() {
      noise({ dur: 0.015, filter: 3000, type: 'highpass', gain: 0.03 });
    },
    // Overlay open - whoosh up
    overlayOpen() {
      noise({ dur: 0.12, filter: 2000, type: 'bandpass', gain: 0.08 });
      tone({ freq: 400, dur: 0.10, type: 'sine', gain: 0.06, slideTo: 600 });
    },
    // Overlay close - whoosh down
    overlayClose() {
      noise({ dur: 0.10, filter: 1500, type: 'bandpass', gain: 0.06 });
      tone({ freq: 500, dur: 0.08, type: 'sine', gain: 0.05, slideTo: 300 });
    },
    // Preset load - musical flourish
    presetLoad() {
      tone({ freq: 523, dur: 0.08, type: 'triangle', gain: 0.10 }); // C5
      setTimeout(() => tone({ freq: 659, dur: 0.08, type: 'triangle', gain: 0.10 }), 60); // E5
      setTimeout(() => tone({ freq: 784, dur: 0.12, type: 'triangle', gain: 0.12 }), 120); // G5
    },
    // Reset/clear sound - descending sweep
    reset() {
      tone({ freq: 800, dur: 0.15, type: 'sawtooth', gain: 0.08, slideTo: 200 });
      noise({ dur: 0.12, filter: 800, type: 'lowpass', gain: 0.10 });
    },
    // Error/invalid action
    error() {
      tone({ freq: 200, dur: 0.12, type: 'square', gain: 0.08 });
      tone({ freq: 180, dur: 0.12, type: 'square', gain: 0.06 });
    },
    // Drag start
    dragStart() {
      noise({ dur: 0.05, filter: 2500, type: 'bandpass', gain: 0.06 });
    },
    // Drag end/drop
    dragEnd() {
      tone({ freq: 440, dur: 0.04, type: 'sine', gain: 0.06 });
      noise({ dur: 0.03, filter: 1800, type: 'lowpass', gain: 0.05 });
    }
  };
})();

ui.audioVol.addEventListener('input', () => AudioFx.setVolume(parseFloat(ui.audioVol.value)));

// Pipe simulation events into AudioFx and particle system. Educator already listens separately.
let lastCollisionParticleT = 0;
world.on(ev => {
  if (ev.type === 'collision') {
    AudioFx.collision(ev.relVelocity, performance.now());
    // Spawn impact particles for strong collisions (throttled)
    const now = performance.now();
    if (ev.relVelocity > 3 && now - lastCollisionParticleT > 50 && ev.point) {
      lastCollisionParticleT = now;
      const screenPt = worldToScreen(ev.point.x, ev.point.y);
      const count = Math.min(12, Math.floor(2 + ev.relVelocity * 0.5));
      spawnParticles(screenPt.x, screenPt.y, count, {
        color: '#ffffff',
        speed: 1.5 + ev.relVelocity * 0.3,
        spread: Math.PI,
        life: 0.3
      });
    }
  }
  else if (ev.type === 'spring') AudioFx.spring();
  else if (ev.type === 'push') AudioFx.push();
  else if (ev.type === 'spawn') {
    AudioFx.spawn();
    // Spawn particles at new body
    if (ev.body) {
      const pt = worldToScreen(ev.body.position.x, ev.body.position.y);
      spawnParticles(pt.x, pt.y, 8, { color: ev.body.color || '#00e5a0', speed: 2, life: 0.4 });
    }
  }
  else if (ev.type === 'slice') AudioFx.slice();
  else if (ev.type === 'pin') AudioFx.pin();
});

/* =========================== state =========================== */
const state = {
  paused: false,
  timeScale: 1,
  tool: 'grab',
  // drag state for spawn tools
  dragStart: null,
  dragCurrent: null,
  // grab interaction
  grabBody: null, grabAnchor: null, grabConstraint: null, grabPrevGravityScale: null,
  // slice interaction (drag stroke that cuts constraints)
  slicePath: null, // array of canvas-space {x,y} points while drag-held
  // fps tracking
  fpsEMA: 60, lastFpsT: 0,
  // spring tool
  springStart: null, springStartLocal: null,
  // impulse tool
  impulseBody: null, impulseStart: null, impulseEnd: null,
  // selection for readouts
  selected: null,
  // trails
  trails: new Map(), // body.id -> array of recent positions (world)
  // mouse velocity tracking for dynamic force
  mouseVelocity: { x: 0, y: 0, speed: 0 },
  lastMousePos: null,
  lastMouseTime: 0,
  // particles
  particles: [],
  particlesEnabled: true,
  // current material preset
  material: 'default',
};

/* =========================== MATERIALS PRESETS =========================== */
const MATERIALS = {
  default: { density: 1, friction: 0.3, restitution: 0.4, color: null },
  rubber: { density: 1.2, friction: 0.9, restitution: 0.85, color: '#ff6b9d' },
  ice: { density: 0.9, friction: 0.02, restitution: 0.1, color: '#88ddff' },
  metal: { density: 7.8, friction: 0.5, restitution: 0.2, color: '#9ba8c0' },
  wood: { density: 0.6, friction: 0.6, restitution: 0.3, color: '#c49a6c' },
  bouncy: { density: 0.8, friction: 0.4, restitution: 0.95, color: '#00e5a0' },
  heavy: { density: 15, friction: 0.7, restitution: 0.1, color: '#5a5a6e' },
  light: { density: 0.2, friction: 0.3, restitution: 0.5, color: '#ffeaa7' },
};

/* =========================== PREFAB STRUCTURES =========================== */
function spawnPrefab(type, cx, cy) {
  const bodies = [];
  const matProps = getMaterialProps();
  
  switch (type) {
    case 'pyramid': {
      // 3-layer pyramid
      const baseW = 1.0, baseH = 0.4;
      for (let row = 0; row < 3; row++) {
        const count = 3 - row;
        const y = cy - row * (baseH + 0.02);
        const startX = cx - (count - 1) * baseW / 2;
        for (let i = 0; i < count; i++) {
          const b = world.add(makeBox(startX + i * baseW, y, baseW * 0.95, baseH, matProps));
          bodies.push(b);
        }
      }
      break;
    }
    case 'bridge': {
      // Plank bridge with supports
      const plankW = 0.6, plankH = 0.15;
      const segs = [];
      for (let i = 0; i < 6; i++) {
        const x = cx - 2 + i * 0.7;
        const seg = world.add(makeBox(x, cy, plankW, plankH, { ...matProps, color: '#c49a6c' }));
        segs.push(seg);
        bodies.push(seg);
      }
      // Link planks
      for (let i = 0; i < segs.length - 1; i++) {
        world.addConstraint(new DistanceConstraint(
          segs[i], segs[i + 1],
          new Vec2(plankW / 2, 0), new Vec2(-plankW / 2, 0),
          { isSpring: false }
        ));
      }
      break;
    }
    case 'car': {
      // Simple car: body + 2 wheels
      const body = world.add(makeBox(cx, cy, 1.5, 0.4, { ...matProps, color: '#6b8bff' }));
      const wheelL = world.add(makeCircle(cx - 0.5, cy + 0.4, 0.25, { ...matProps, friction: 0.9, color: '#4a5068' }));
      const wheelR = world.add(makeCircle(cx + 0.5, cy + 0.4, 0.25, { ...matProps, friction: 0.9, color: '#4a5068' }));
      // Pin wheels to body
      world.addConstraint(new DistanceConstraint(body, wheelL, new Vec2(-0.5, 0.4), new Vec2(0, 0), { isSpring: true, springK: 800, damping: 20 }));
      world.addConstraint(new DistanceConstraint(body, wheelR, new Vec2(0.5, 0.4), new Vec2(0, 0), { isSpring: true, springK: 800, damping: 20 }));
      bodies.push(body, wheelL, wheelR);
      break;
    }
    case 'ragdoll': {
      // Simple ragdoll figure
      const head = world.add(makeCircle(cx, cy - 1.2, 0.25, { ...matProps, color: '#ffeaa7' }));
      const torso = world.add(makeBox(cx, cy - 0.5, 0.5, 0.8, { ...matProps, color: '#6b8bff' }));
      const armL = world.add(makeBox(cx - 0.6, cy - 0.6, 0.5, 0.15, { ...matProps, color: '#ffeaa7' }));
      const armR = world.add(makeBox(cx + 0.6, cy - 0.6, 0.5, 0.15, { ...matProps, color: '#ffeaa7' }));
      const legL = world.add(makeBox(cx - 0.15, cy + 0.3, 0.18, 0.6, { ...matProps, color: '#4a5068' }));
      const legR = world.add(makeBox(cx + 0.15, cy + 0.3, 0.18, 0.6, { ...matProps, color: '#4a5068' }));
      // Joints
      world.addConstraint(new DistanceConstraint(head, torso, new Vec2(0, 0.25), new Vec2(0, -0.4), { isSpring: true, springK: 600, damping: 15 }));
      world.addConstraint(new DistanceConstraint(torso, armL, new Vec2(-0.25, -0.3), new Vec2(0.25, 0), { isSpring: true, springK: 400, damping: 10 }));
      world.addConstraint(new DistanceConstraint(torso, armR, new Vec2(0.25, -0.3), new Vec2(-0.25, 0), { isSpring: true, springK: 400, damping: 10 }));
      world.addConstraint(new DistanceConstraint(torso, legL, new Vec2(-0.1, 0.4), new Vec2(0, -0.3), { isSpring: true, springK: 500, damping: 12 }));
      world.addConstraint(new DistanceConstraint(torso, legR, new Vec2(0.1, 0.4), new Vec2(0, -0.3), { isSpring: true, springK: 500, damping: 12 }));
      bodies.push(head, torso, armL, armR, legL, legR);
      break;
    }
    case 'catapult': {
      // Base + arm
      const base = world.add(makeBox(cx, cy, 1.2, 0.3, { isStatic: true, color: '#4a5068' }));
      const arm = world.add(makeBox(cx, cy - 0.5, 0.15, 1.2, { ...matProps, color: '#c49a6c' }));
      const bucket = world.add(makeBox(cx, cy - 1.1, 0.4, 0.15, matProps));
      // Pin arm to base, spring it back
      world.addConstraint(new DistanceConstraint(base, arm, new Vec2(0, -0.15), new Vec2(0, 0.5), { isSpring: false }));
      world.addConstraint(new DistanceConstraint(arm, bucket, new Vec2(0, -0.6), new Vec2(0, 0), { isSpring: false }));
      bodies.push(base, arm, bucket);
      break;
    }
    case 'seesaw': {
      // Fulcrum + plank
      const fulcrum = world.add(makePolygon(cx, cy + 0.3, 3, 0.4, { isStatic: true, color: '#4a5068' }));
      const plank = world.add(makeBox(cx, cy, 3, 0.15, { ...matProps, color: '#c49a6c' }));
      // Pin plank to fulcrum top
      world.addConstraint(new DistanceConstraint(fulcrum, plank, new Vec2(0, -0.35), new Vec2(0, 0.08), { isSpring: false }));
      bodies.push(fulcrum, plank);
      break;
    }
  }
  
  // Emit spawn events
  bodies.forEach(b => world.emit({ type: 'spawn', body: b }));
  if (bodies.length > 0) state.selected = bodies[0];
  return bodies;
}

/* =========================== FLUID SYSTEM =========================== */
const fluidParticles = [];
const FLUID_SETTINGS = {
  enabled: false,
  pouring: false, // true while mouse held down
  pourPos: null,  // current pour position
  type: 'water',
  maxParticles: 400,
  colors: {
    water: ['#2277ee', '#44aaff', '#66ccff'],
    oil: ['#2a2a2a', '#3a3a3a', '#4a4a4a'],
    lava: ['#ff2200', '#ff6600', '#ffaa00'],
    sand: ['#c49a6c', '#daa520', '#e6be8a']
  },
  // Physics properties per type
  props: {
    water: { gravity: 0.25, viscosity: 0.985, spread: 1.2, density: 1.0, radius: 4, pushForce: 0.008 },
    oil:   { gravity: 0.12, viscosity: 0.96, spread: 0.6, density: 0.8, radius: 5, pushForce: 0.004 },
    lava:  { gravity: 0.35, viscosity: 0.92, spread: 0.8, density: 2.5, radius: 6, pushForce: 0.015 },
    sand:  { gravity: 0.45, viscosity: 0.88, spread: 0.3, density: 1.6, radius: 3, pushForce: 0.012 }
  }
};

// Spatial hash for fluid particle lookups (performance)
const fluidGrid = { cells: new Map(), cellSize: 16 };

function fluidGridKey(x, y) {
  return `${Math.floor(x / fluidGrid.cellSize)},${Math.floor(y / fluidGrid.cellSize)}`;
}

function rebuildFluidGrid() {
  fluidGrid.cells.clear();
  for (let i = 0; i < fluidParticles.length; i++) {
    const p = fluidParticles[i];
    const key = fluidGridKey(p.x, p.y);
    if (!fluidGrid.cells.has(key)) fluidGrid.cells.set(key, []);
    fluidGrid.cells.get(key).push(i);
  }
}

function getFluidNeighbors(x, y) {
  const neighbors = [];
  const cx = Math.floor(x / fluidGrid.cellSize);
  const cy = Math.floor(y / fluidGrid.cellSize);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const key = `${cx + dx},${cy + dy}`;
      const cell = fluidGrid.cells.get(key);
      if (cell) neighbors.push(...cell);
    }
  }
  return neighbors;
}

function spawnFluid(x, y, count = 5) {
  if (!FLUID_SETTINGS.enabled) return;
  const type = FLUID_SETTINGS.type;
  const colors = FLUID_SETTINGS.colors[type];
  const props = FLUID_SETTINGS.props[type];
  
  for (let i = 0; i < count; i++) {
    if (fluidParticles.length >= FLUID_SETTINGS.maxParticles) {
      fluidParticles.shift(); // Remove oldest
    }
    const angle = Math.random() * Math.PI * 2;
    const spd = Math.random() * props.spread * 2;
    fluidParticles.push({
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: Math.cos(angle) * spd + (state.mouseVelocity.x || 0) * 0.01,
      vy: Math.sin(angle) * spd + Math.random() * 1.5,
      radius: props.radius * (0.8 + Math.random() * 0.4),
      color: colors[Math.floor(Math.random() * colors.length)],
      type,
      life: 1.0
    });
  }
}

function updateFluid() {
  const len = fluidParticles.length;
  if (len === 0) return;
  
  // Rebuild spatial grid
  rebuildFluidGrid();
  
  const props = FLUID_SETTINGS.props[FLUID_SETTINGS.type];
  const gravity = props.gravity;
  const viscosity = props.viscosity;
  const pushForce = props.pushForce;
  const interactDist = 14;
  const interactDistSq = interactDist * interactDist;
  
  // Get all physics bodies for collision
  const bodies = world.bodies.filter(b => !b.isStatic);
  
  for (let i = len - 1; i >= 0; i--) {
    const p = fluidParticles[i];
    const pProps = FLUID_SETTINGS.props[p.type];
    
    // Apply gravity
    p.vy += pProps.gravity;
    
    // Particle-particle interaction (pressure + viscosity)
    const neighbors = getFluidNeighbors(p.x, p.y);
    for (const j of neighbors) {
      if (j <= i) continue;
      const q = fluidParticles[j];
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < interactDistSq && distSq > 0.01) {
        const dist = Math.sqrt(distSq);
        const overlap = interactDist - dist;
        const nx = dx / dist, ny = dy / dist;
        
        // Pressure force (repulsion)
        const pressure = overlap * 0.15;
        p.vx += nx * pressure;
        p.vy += ny * pressure;
        q.vx -= nx * pressure;
        q.vy -= ny * pressure;
        
        // Viscosity (velocity averaging)
        const avgVx = (p.vx + q.vx) * 0.5;
        const avgVy = (p.vy + q.vy) * 0.5;
        p.vx += (avgVx - p.vx) * 0.02;
        p.vy += (avgVy - p.vy) * 0.02;
        q.vx += (avgVx - q.vx) * 0.02;
        q.vy += (avgVy - q.vy) * 0.02;
      }
    }
    
    // Collision with physics bodies - apply force to bodies
    for (const body of bodies) {
      const bx = body.position.x * PX_PER_M;
      const by = body.position.y * PX_PER_M;
      const dx = p.x - bx;
      const dy = p.y - by;
      const dist = Math.hypot(dx, dy);
      const bodyRadius = (body.shape?.radius || 0.5) * PX_PER_M;
      const collisionDist = bodyRadius + p.radius + 5;
      
      if (dist < collisionDist && dist > 0.1) {
        const nx = dx / dist, ny = dy / dist;
        const overlap = collisionDist - dist;
        
        // Push particle away from body
        p.x += nx * overlap * 0.5;
        p.y += ny * overlap * 0.5;
        
        // Reflect velocity
        const dot = p.vx * nx + p.vy * ny;
        if (dot < 0) {
          p.vx -= 1.5 * dot * nx;
          p.vy -= 1.5 * dot * ny;
          p.vx *= 0.7;
          p.vy *= 0.7;
        }
        
        // Apply force to body (buoyancy + drag)
        const forceMag = pProps.pushForce * pProps.density * (1 + Math.hypot(p.vx, p.vy) * 0.1);
        body.applyForce(new Vec2(-nx * forceMag, -ny * forceMag - pProps.density * 0.002));
      }
    }
    
    // Apply damping
    p.vx *= pProps.viscosity;
    p.vy *= pProps.viscosity;
    
    // Clamp velocity
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > 12) {
      p.vx = (p.vx / speed) * 12;
      p.vy = (p.vy / speed) * 12;
    }
    
    // Move
    p.x += p.vx;
    p.y += p.vy;
    
    // Bounce off screen walls
    if (p.x < p.radius) { p.x = p.radius; p.vx *= -0.4; }
    if (p.x > canvas.width - p.radius) { p.x = canvas.width - p.radius; p.vx *= -0.4; }
    if (p.y > canvas.height - p.radius) { 
      p.y = canvas.height - p.radius; 
      p.vy *= -0.2; 
      p.vx *= 0.92;
      // Sand and lava settle faster
      if (p.type === 'sand' || p.type === 'lava') p.life -= 0.002;
    }
    
    // Decay life slowly
    p.life -= 0.0003;
    
    // Remove dead or escaped particles
    if (p.life <= 0 || p.y < -50 || p.x < -50 || p.x > canvas.width + 50) {
      fluidParticles.splice(i, 1);
    }
  }
}

function drawFluid() {
  const len = fluidParticles.length;
  if (len === 0) return;
  
  // Sort by y for depth effect (optional, skip for performance)
  // fluidParticles.sort((a, b) => a.y - b.y);
  
  for (let i = 0; i < len; i++) {
    const p = fluidParticles[i];
    const alpha = Math.min(0.85, p.life);
    
    // Draw drop shadow for depth
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(p.x + 1, p.y + 2, p.radius * 0.9, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw main particle
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Highlight for liquid effect
    if (p.type === 'water' || p.type === 'oil') {
      ctx.globalAlpha = alpha * 0.4;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.x - p.radius * 0.3, p.y - p.radius * 0.3, p.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'lava') {
      // Glowing core for lava
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/* =========================== PARTICLE SYSTEM =========================== */
function spawnParticles(x, y, count, options = {}) {
  if (!state.particlesEnabled) return;
  const {
    color = '#00e5a0',
    speed = 3,
    spread = Math.PI * 2,
    baseAngle = -Math.PI / 2,
    life = 0.6,
    size = 3,
    gravity = 0.15
  } = options;
  for (let i = 0; i < count; i++) {
    const angle = baseAngle + (Math.random() - 0.5) * spread;
    const v = speed * (0.5 + Math.random() * 0.5);
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life,
      maxLife: life,
      size: size * (0.5 + Math.random() * 0.5),
      color,
      gravity
    });
  }
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.vy += p.gravity;
    p.x += p.vx;
    p.y += p.vy;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of state.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* =========================== world events → educator =========================== */
let lastFallSampled = 0;
function sampleEnvironment(now) {
  // detect dominant fall events (loose body with high downward speed and no neighbors)
  if (now - lastFallSampled < 700) return;
  lastFallSampled = now;
  for (const b of world.bodies) {
    if (b.isStatic || walls.includes(b)) continue;
    if (b.velocity.y > 4 && b.velocity.lengthSq() > 16) {
      world.emit({ type: 'fall', body: b });
      break;
    }
    if (b.angularVelocity * b.angularVelocity > 25) {
      world.emit({ type: 'rotation', body: b });
      break;
    }
    if (0.5 * b.mass * b.velocity.lengthSq() > 50) {
      world.emit({ type: 'highEnergy', body: b });
      break;
    }
  }
}

/* =========================== mouse =========================== */
function canvasPos(ev) {
  const r = canvas.getBoundingClientRect();
  return new Vec2(ev.clientX - r.left, ev.clientY - r.top);
}

canvas.addEventListener('pointerdown', (ev) => {
  if (ev.pointerType === 'mouse' && ev.button !== 0) return;
  ev.preventDefault();
  canvas.setPointerCapture(ev.pointerId);
  const cp = canvasPos(ev);
  const wp = screenToWorld(cp.x, cp.y);
  const body = world.bodyAt(wp);
  
  // Start pouring fluid if enabled
  if (FLUID_SETTINGS.enabled) {
    FLUID_SETTINGS.pouring = true;
    FLUID_SETTINGS.pourPos = { x: cp.x, y: cp.y };
  }

  switch (state.tool) {
    case 'box': case 'circle': case 'polygon': case 'wall': case 'triangle': case 'rope':
      state.dragStart = cp;
      state.dragCurrent = cp;
      break;
    case 'grab':
      if (body && !body.isStatic) {
        state.selected = body;
        startGrab(body, wp);
      } else {
        state.selected = null;
      }
      break;
    case 'spring':
      if (body && !body.isStatic) {
        const local = worldToLocal(body, wp);
        state.springStart = body;
        state.springStartLocal = local;
        state.dragCurrent = cp;
      }
      break;
    case 'impulse':
      if (body && !body.isStatic) {
        state.impulseBody = body;
        state.impulseStart = cp;
        state.impulseEnd = cp;
      }
      break;
    case 'delete':
      if (body && !walls.includes(body)) {
        world.remove(body);
        if (state.selected === body) state.selected = null;
      }
      break;
    case 'pin':
      if (body && !walls.includes(body)) togglePin(body);
      break;
    case 'slice':
      state.slicePath = [{ x: cp.x, y: cp.y }];
      break;
  }
});

canvas.addEventListener('pointermove', (ev) => {
  const cp = canvasPos(ev);
  const wp = screenToWorld(cp.x, cp.y);
  const now = performance.now();
  
  // Track mouse velocity for dynamic force scaling
  if (state.lastMousePos) {
    const dt = Math.max(1, now - state.lastMouseTime) / 1000;
    const dx = cp.x - state.lastMousePos.x;
    const dy = cp.y - state.lastMousePos.y;
    // Smooth velocity with EMA
    const newVx = dx / dt;
    const newVy = dy / dt;
    state.mouseVelocity.x = state.mouseVelocity.x * 0.7 + newVx * 0.3;
    state.mouseVelocity.y = state.mouseVelocity.y * 0.7 + newVy * 0.3;
    state.mouseVelocity.speed = Math.hypot(state.mouseVelocity.x, state.mouseVelocity.y);
  }
  state.lastMousePos = { x: cp.x, y: cp.y };
  state.lastMouseTime = now;
  
  if (state.dragStart) state.dragCurrent = cp;
  if (state.grabConstraint) {
    // move grab anchor - apply velocity-based force boost
    state.grabAnchor.position = wp;
    // Higher mouse speed = stiffer grab for more responsive throwing
    const speedFactor = Math.min(3, 1 + state.mouseVelocity.speed / 800);
    if (state.grabConstraint.springK) {
      state.grabConstraint.springK = 2000 * speedFactor;
      state.grabConstraint.damping = 70 * speedFactor;
    }
  }
  if (state.springStart) state.dragCurrent = cp;
  if (state.impulseBody) state.impulseEnd = cp;
  if (state.slicePath) {
    const prev = state.slicePath[state.slicePath.length - 1];
    state.slicePath.push({ x: cp.x, y: cp.y });
    sliceAlong(prev, cp);
  }

  // Update pour position while holding
  if (FLUID_SETTINGS.pouring) {
    FLUID_SETTINGS.pourPos = { x: cp.x, y: cp.y };
  }

  // hover-select for readouts when no other selection
  if (!state.grabBody && !state.dragStart && !state.springStart && !state.impulseBody) {
    if (state.tool === 'grab' || state.tool === 'delete') {
      const hover = world.bodyAt(wp);
      if (hover && !walls.includes(hover)) state.selected = hover;
    }
  }
});

canvas.addEventListener('pointerup', (ev) => {
  if (ev.pointerType === 'mouse' && ev.button !== 0) return;
  const cp = canvasPos(ev);
  const wp = screenToWorld(cp.x, cp.y);
  
  // Stop pouring fluid
  FLUID_SETTINGS.pouring = false;
  FLUID_SETTINGS.pourPos = null;

  if (state.dragStart) {
    finishSpawn(state.dragStart, cp);
    state.dragStart = null;
    state.dragCurrent = null;
  }
  if (state.grabConstraint) endGrab();
  if (state.springStart) {
    const startBody = state.springStart;
    const target = world.bodyAt(wp);
    if (target && target !== startBody) {
      const localTarget = worldToLocal(target, wp);
      world.addConstraint(new DistanceConstraint(startBody, target, state.springStartLocal, localTarget, {
        isSpring: true, springK: 480, damping: 9.6
      }));
      world.emit({ type: 'spring' });
    } else {
      // anchor in space: create static anchor body
      const anchor = world.add(makeCircle(wp.x, wp.y, 0.05, { isStatic: true, color: '#4a5068' }));
      world.addConstraint(new DistanceConstraint(startBody, anchor, state.springStartLocal, new Vec2(0, 0), {
        isSpring: true, springK: 480, damping: 9.6
      }));
      world.emit({ type: 'spring' });
    }
    state.springStart = null;
    state.springStartLocal = null;
    state.dragCurrent = null;
  }
  if (state.impulseBody) {
    const dx = (state.impulseEnd.x - state.impulseStart.x) / camera.scale;
    const dy = (state.impulseEnd.y - state.impulseStart.y) / camera.scale;
    // Velocity-based force multiplier - faster mouse = stronger push
    const speedBoost = Math.min(4, 1 + state.mouseVelocity.speed / 400);
    const j = new Vec2(dx, dy).mul(state.impulseBody.mass * 6 * speedBoost);
    state.impulseBody.applyImpulse(j, screenToWorld(state.impulseStart.x, state.impulseStart.y));
    // Spawn impact particles
    const impactPt = state.impulseEnd;
    spawnParticles(impactPt.x, impactPt.y, Math.floor(8 + speedBoost * 4), {
      color: '#ffc46a',
      speed: 4 * speedBoost,
      spread: Math.PI * 0.8,
      baseAngle: Math.atan2(dy, dx)
    });
    world.emit({ type: 'push', body: state.impulseBody });
    state.impulseBody = null; state.impulseStart = null; state.impulseEnd = null;
  }
  if (state.slicePath) state.slicePath = null;
});

canvas.addEventListener('pointercancel', () => {
  if (state.grabConstraint) endGrab();
  state.dragStart = null; state.dragCurrent = null;
  state.springStart = null;
  state.impulseBody = null;
  state.slicePath = null;
});

/* =========================== grab constraint =========================== */
function startGrab(body, worldPoint) {
  state.grabBody = body;
  // Zero gravity for the held body — otherwise the spring constantly fights mg
  // and the user sees the body sag/oscillate under their cursor.
  state.grabPrevGravityScale = body.gravityScale;
  body.gravityScale = 0;
  // create a kinematic anchor: a static body that we move with the cursor
  state.grabAnchor = new Body({
    shape: SHAPE.CIRCLE, position: worldPoint, radius: 0.01,
    isStatic: true, color: '#ffffff'
  });
  // We don't add the anchor to world.bodies (so it doesn't collide).
  const localBody = worldToLocal(body, worldPoint);
  // Mass-aware critical-damping tuning (Box2D mouse-joint style):
  // k = m·ω², c = 2·m·ω·ζ. Picking ω from a target frequency makes the grab
  // track at the same visual speed regardless of body mass.
  const f = 3;       // Hz — target oscillation frequency
  const zeta = 0.9;  // damping ratio (slightly under critical for snappy feel)
  const omega = 2 * Math.PI * f;
  const k = body.mass * omega * omega;
  const c = 2 * body.mass * omega * zeta;
  // Cap force so a fast cursor flick can't dump enough momentum to tunnel
  // through walls or produce extreme velocities. ~50 g of acceleration max.
  const maxForce = body.mass * 500;
  state.grabConstraint = new DistanceConstraint(body, state.grabAnchor, localBody, new Vec2(0, 0), {
    isSpring: true, springK: k, damping: c, length: 0, dampAllAxes: true, maxForce
  });
  world.constraints.push(state.grabConstraint);
}
function endGrab() {
  if (state.grabConstraint) {
    const i = world.constraints.indexOf(state.grabConstraint);
    if (i >= 0) world.constraints.splice(i, 1);
  }
  if (state.grabBody) state.grabBody.gravityScale = state.grabPrevGravityScale ?? 1;
  state.grabBody = null; state.grabAnchor = null; state.grabConstraint = null;
  state.grabPrevGravityScale = null;
}

/* =========================== pin / slice =========================== */
function togglePin(body) {
  body.isStatic = !body.isStatic;
  if (body.isStatic) {
    body.velocity = new Vec2(0, 0);
    body.angularVelocity = 0;
    body.force = new Vec2(0, 0);
    body.torque = 0;
  }
  // Recompute mass — static bodies have inverseMass=0; dynamic ones recompute
  // from density and shape. Without this they'd stay massless after unpinning.
  body.computeMass();
  world.emit({ type: 'pin', body });
}

// Segment-segment intersection (canvas-space ok; we just need yes/no).
function segmentsIntersect(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return false;
  const sx = p3.x - p1.x, sy = p3.y - p1.y;
  const t = (sx * d2y - sy * d2x) / denom;
  const u = (sx * d1y - sy * d1x) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function sliceAlong(prevCanvas, currCanvas) {
  // Cut any constraint whose anchor-to-anchor segment is crossed by the stroke.
  let cuts = 0;
  for (let i = world.constraints.length - 1; i >= 0; i--) {
    const c = world.constraints[i];
    const wA = applyTransform(c.A, c.anchorA);
    const wB = applyTransform(c.B, c.anchorB);
    const sA = worldToScreen(wA.x, wA.y);
    const sB = worldToScreen(wB.x, wB.y);
    if (segmentsIntersect(prevCanvas, currCanvas, sA, sB)) {
      world.constraints.splice(i, 1);
      cuts++;
    }
  }
  if (cuts > 0) world.emit({ type: 'slice', count: cuts });
}

function worldToLocal(body, worldP) {
  const cos = Math.cos(-body.angle), sin = Math.sin(-body.angle);
  const dx = worldP.x - body.position.x, dy = worldP.y - body.position.y;
  return new Vec2(dx * cos - dy * sin, dx * sin + dy * cos);
}

/* =========================== spawn =========================== */
// Mobile size limits - smaller max sizes for better viewing area
function getMaxObjectSize() {
  const isMobile = window.matchMedia('(max-width: 860px)').matches;
  return {
    radius: isMobile ? 1.8 : 4.0,      // max radius for circles/polygons
    dimension: isMobile ? 3.0 : 6.0,   // max width/height for boxes
    wallDim: isMobile ? 4.0 : 8.0      // max wall dimension
  };
}

// Get material properties for spawned objects
function getMaterialProps() {
  const mat = MATERIALS[state.material] || MATERIALS.default;
  return {
    density: mat.density,
    friction: mat.friction,
    restitution: mat.restitution,
    color: mat.color || pickSpawnColor()
  };
}

function finishSpawn(start, end) {
  const ws = screenToWorld(start.x, start.y);
  const we = screenToWorld(end.x, end.y);
  const dx = we.x - ws.x, dy = we.y - ws.y;
  const dragLen = Math.hypot(dx, dy);
  const maxSize = getMaxObjectSize();
  const matProps = getMaterialProps();

  switch (state.tool) {
    case 'box': {
      const w = Math.min(maxSize.dimension, Math.max(0.5, Math.abs(dx) * 2 || 1.0));
      const h = Math.min(maxSize.dimension, Math.max(0.5, Math.abs(dy) * 2 || 1.0));
      const cx = (ws.x + we.x) / 2, cy = (ws.y + we.y) / 2;
      const b = world.add(makeBox(cx, cy, w, h, matProps));
      state.selected = b;
      world.emit({ type: 'spawn', body: b });
      break;
    }
    case 'circle': {
      const r = Math.min(maxSize.radius, Math.max(0.25, dragLen / 2 || 0.5));
      const cx = (ws.x + we.x) / 2, cy = (ws.y + we.y) / 2;
      const b = world.add(makeCircle(cx, cy, r, matProps));
      state.selected = b;
      world.emit({ type: 'spawn', body: b });
      break;
    }
    case 'polygon': {
      const r = Math.min(maxSize.radius, Math.max(0.3, dragLen / 2 || 0.6));
      const sides = 5 + ((Math.random() * 4) | 0);
      const cx = (ws.x + we.x) / 2, cy = (ws.y + we.y) / 2;
      const b = world.add(makePolygon(cx, cy, sides, r, matProps));
      state.selected = b;
      world.emit({ type: 'spawn', body: b });
      break;
    }
    case 'wall': {
      const w = Math.min(maxSize.wallDim, Math.max(0.5, Math.abs(dx) || 2));
      const h = Math.min(maxSize.wallDim, Math.max(0.2, Math.abs(dy) || 0.4));
      const cx = (ws.x + we.x) / 2, cy = (ws.y + we.y) / 2;
      world.add(makeBox(cx, cy, w, h, { isStatic: true, color: '#4a5068' }));
      break;
    }
    case 'triangle': {
      const r = Math.min(maxSize.radius, Math.max(0.3, dragLen / 2 || 0.6));
      const cx = (ws.x + we.x) / 2, cy = (ws.y + we.y) / 2;
      const b = world.add(makePolygon(cx, cy, 3, r, matProps));
      state.selected = b;
      world.emit({ type: 'spawn', body: b });
      break;
    }
    case 'rope': {
      // Build a chain of small balls between drag start and drag end, linked by
      // rigid distance constraints. Both ends free; user can pin endpoints with
      // the Pin tool to anchor the rope.
      const len = dragLen;
      if (len < 0.3) break; // need a meaningful drag
      const segR = 0.12;
      const segGap = segR * 2.2;
      const N = Math.max(3, Math.min(24, Math.floor(len / segGap) + 1));
      const segs = [];
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const x = ws.x + dx * t;
        const y = ws.y + dy * t;
        const seg = world.add(makeCircle(x, y, segR, {
          color: '#9ba8c0', density: 0.4, friction: 0.4, restitution: 0.05
        }));
        segs.push(seg);
      }
      for (let i = 0; i < N - 1; i++) {
        world.addConstraint(new DistanceConstraint(
          segs[i], segs[i + 1], new Vec2(0, 0), new Vec2(0, 0),
          { stiffness: 1.0 }
        ));
      }
      state.selected = segs[0];
      world.emit({ type: 'spawn', body: segs[0] });
      break;
    }
  }
}

// Vibrant, joyful palette that matches the new UI theme
const SPAWN_PALETTE = [
  '#00e5a0', // accent green
  '#ff6b9d', // secondary pink
  '#6b8bff', // tertiary blue
  '#ffc46a', // warm yellow
  '#00ffc8', // bright cyan
  '#ff8bb8', // soft pink
  '#8ba8ff', // light blue
  '#a0ffdb', // mint
  '#ffb366', // orange
  '#c9a0ff', // lavender
];
let spawnIdx = 0;
function pickSpawnColor() { spawnIdx = (spawnIdx + 1) % SPAWN_PALETTE.length; return SPAWN_PALETTE[spawnIdx]; }

/* =========================== rendering =========================== */
function render() {
  // Fill with lighter background instead of clear
  ctx.fillStyle = '#1a1d28';
  ctx.fillRect(0, 0, cssW, cssH);
  drawGrid();

  // bodies
  for (const b of world.bodies) drawBody(b);

  // constraints
  for (const c of world.constraints) drawConstraint(c);

  // tool overlays
  drawToolOverlay();

  // contacts (debug)
  if (ui.showContacts.checked) drawContacts();

  // velocity vectors (debug)
  if (ui.showVectors.checked) drawVelocities();

  // trails
  if (ui.showTrails.checked) drawTrails();

  // bounding boxes
  if (ui.showAABB.checked) drawAABBs();

  // selection ring
  if (state.selected && !walls.includes(state.selected)) drawSelectionRing(state.selected);

  // FPS overlay (drawn last so it sits on top)
  if (ui.showFPS.checked) drawFPS();
}

function drawGrid() {
  const step = 1; // 1 m
  const sPx = step * camera.scale;
  // Subtle grid - neutral color for visibility
  ctx.strokeStyle = 'rgba(120, 130, 160, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = (camera.x % sPx); x < cssW; x += sPx) {
  ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, cssH);
  }
  for (let y = (camera.y % sPx); y < cssH; y += sPx) {
  ctx.moveTo(0, y + 0.5); ctx.lineTo(cssW, y + 0.5);
  }
  ctx.stroke();
  
  // Floor line with accent
  ctx.strokeStyle = 'rgba(0, 229, 160, 0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, cssH - 1); ctx.lineTo(cssW, cssH - 1);
  ctx.stroke();
  }

// Speed → color: blue (slow) → cyan → green → yellow → red (fast).
// Mapped over 0..30 m/s, which covers most sandbox motion before the velocity
// clamp kicks in.
function speedColor(v) {
  const HEATMAP_VMAX = 30;
  const t = Math.min(1, v / HEATMAP_VMAX);
// 5-stop gradient matching the vibrant theme
  const stops = [
  [0.00, 107, 139, 255], // slow tertiary blue
  [0.25, 0, 229, 160],   // accent green
  [0.50, 0, 255, 200],   // bright cyan
  [0.75, 255, 196, 106], // warm yellow
  [1.00, 255, 107, 157]  // fast secondary pink
  ];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i];
      const u = (t - a[0]) / (b[0] - a[0]);
      const r = Math.round(a[1] + (b[1] - a[1]) * u);
      const g = Math.round(a[2] + (b[2] - a[2]) * u);
      const bl = Math.round(a[3] + (b[3] - a[3]) * u);
      return `rgb(${r},${g},${bl})`;
    }
  }
  return `rgb(240,100,110)`;
}

function drawBody(b) {
  ctx.save();
  const useHeatmap = ui.showHeatmap.checked && !b.isStatic && !walls.includes(b);
  const fillColor = useHeatmap ? speedColor(b.velocity.length()) : b.color;
  const isDynamic = !b.isStatic && !walls.includes(b);
  
  // Add subtle glow for dynamic bodies
  if (isDynamic) {
  ctx.shadowColor = withAlpha(fillColor, 0.4);
  ctx.shadowBlur = 10;
  }
  
  if (b.shape === SHAPE.CIRCLE) {
  const p = worldToScreen(b.position.x, b.position.y);
  const r = b.radius * camera.scale;
  ctx.fillStyle = withAlpha(fillColor, b.isStatic ? 0.5 : 0.9);
  ctx.strokeStyle = fillColor;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // orientation marker
  ctx.shadowBlur = 0;
  const ex = p.x + Math.cos(b.angle) * r;
  const ey = p.y + Math.sin(b.angle) * r;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ex, ey); ctx.stroke();
  } else {
  const verts = b.worldVertices();
  ctx.beginPath();
  for (let i = 0; i < verts.length; i++) {
  const p = worldToScreen(verts[i].x, verts[i].y);
  if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = withAlpha(fillColor, b.isStatic ? 0.4 : 0.9);
  ctx.strokeStyle = fillColor;
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  }
  ctx.restore();
  }

function drawAABBs() {
  ctx.strokeStyle = 'rgba(107, 139, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  for (const b of world.bodies) {
  if (walls.includes(b)) continue;
  const a = b.aabb();
  const min = worldToScreen(a.minX, a.minY);
  const max = worldToScreen(a.maxX, a.maxY);
  ctx.strokeRect(min.x, min.y, max.x - min.x, max.y - min.y);
  }
  ctx.setLineDash([]);
  }

function drawFPS() {
  ctx.save();
  // Rounded rect background
  ctx.fillStyle = 'rgba(10, 10, 15, 0.85)';
  ctx.beginPath();
  ctx.roundRect(10, 10, 140, 44, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 229, 160, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  ctx.font = '500 12px "JetBrains Mono", monospace';
  ctx.textBaseline = 'top';
  const fps = state.fpsEMA.toFixed(1);
  const dyn = world.bodies.filter(b => !b.isStatic).length;
  ctx.fillStyle = '#00e5a0';
  ctx.fillText(`${fps} fps`, 18, 16);
  ctx.fillStyle = '#8888a0';
  ctx.fillText(`bodies: ${world.bodies.length} (${dyn} dyn)`, 18, 32);
  ctx.restore();
  }

function drawConstraint(c) {
  const wA = applyTransform(c.A, c.anchorA);
  const wB = applyTransform(c.B, c.anchorB);
  const a = worldToScreen(wA.x, wA.y);
  const b = worldToScreen(wB.x, wB.y);
  ctx.strokeStyle = c.isSpring ? '#00ffc8' : '#8888a0';
  ctx.lineWidth = 2;
  if (c.isSpring) {
  drawSpring(a, b);
  } else {
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  }
  function drawSpring(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;
  const coils = Math.max(8, Math.floor(len / 8));
  
  // Glow effect for springs
  ctx.shadowColor = 'rgba(0, 255, 200, 0.4)';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  for (let i = 1; i < coils; i++) {
  const t = i / coils;
  const cx = a.x + ux * len * t;
  const cy = a.y + uy * len * t;
  const off = (i % 2 === 0 ? 1 : -1) * 5;
  ctx.lineTo(cx + nx * off, cy + ny * off);
  }
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.shadowBlur = 0;
  
  // anchor dots with glow
  ctx.fillStyle = '#00ffc8';
  ctx.shadowColor = 'rgba(0, 255, 200, 0.6)';
  ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(a.x, a.y, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  }

function applyTransform(b, local) {
  const cos = Math.cos(b.angle), sin = Math.sin(b.angle);
  return new Vec2(local.x * cos - local.y * sin + b.position.x,
                  local.x * sin + local.y * cos + b.position.y);
}

function drawToolOverlay() {
  // Spawn drag preview with glow
  if (state.dragStart && state.dragCurrent) {
  const a = state.dragStart, b = state.dragCurrent;
  ctx.shadowColor = 'rgba(0, 229, 160, 0.4)';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = 'rgba(0, 229, 160, 0.8)';
  ctx.fillStyle = 'rgba(0, 229, 160, 0.12)';
  ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
  ctx.beginPath();
  if (state.tool === 'circle') {
  const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
  const r = Math.hypot(b.x - a.x, b.y - a.y) / 2 || 14;
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  } else {
  const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y);
  const w = Math.max(20, Math.abs(b.x - a.x));
  const h = Math.max(20, Math.abs(b.y - a.y));
  ctx.roundRect(x0, y0, w, h, 4);
  }
  ctx.fill(); ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  }
  
  // Spring drag preview with glow
  if (state.springStart && state.dragCurrent) {
  const wA = applyTransform(state.springStart, state.springStartLocal);
  const a = worldToScreen(wA.x, wA.y);
  ctx.shadowColor = 'rgba(0, 255, 200, 0.5)';
  ctx.shadowBlur = 10;
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = '#00ffc8';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(state.dragCurrent.x, state.dragCurrent.y); ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  }
  
  // Impulse drag preview with glow
  if (state.impulseBody && state.impulseStart && state.impulseEnd) {
  const a = state.impulseStart, b = state.impulseEnd;
  ctx.shadowColor = 'rgba(255, 196, 106, 0.5)';
  ctx.shadowBlur = 10;
  ctx.strokeStyle = '#ffc46a'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  drawArrowhead(a, b, '#ffc46a');
  ctx.shadowBlur = 0;
  }
  
  // Slice stroke preview with glow
  if (state.slicePath && state.slicePath.length > 1) {
  ctx.shadowColor = 'rgba(255, 107, 157, 0.6)';
  ctx.shadowBlur = 10;
  ctx.strokeStyle = '#ff6b9d';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(state.slicePath[0].x, state.slicePath[0].y);
  for (let i = 1; i < state.slicePath.length; i++) {
  ctx.lineTo(state.slicePath[i].x, state.slicePath[i].y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  }
}

function drawArrowhead(a, b, color) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const size = 8;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - Math.cos(ang - 0.4) * size, b.y - Math.sin(ang - 0.4) * size);
  ctx.lineTo(b.x - Math.cos(ang + 0.4) * size, b.y - Math.sin(ang + 0.4) * size);
  ctx.closePath();
  ctx.fill();
}

function drawContacts() {
  ctx.fillStyle = '#ff6b9d';
  ctx.shadowColor = 'rgba(255, 107, 157, 0.6)';
  ctx.shadowBlur = 8;
  for (const c of world.contacts) {
  for (const p of c.points) {
  const s = worldToScreen(p.x, p.y);
  ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill();
  const tip = { x: s.x + c.normal.x * 14, y: s.y + c.normal.y * 14 };
  ctx.strokeStyle = '#ff6b9d';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
  }
  }
  ctx.shadowBlur = 0;
  }

function drawVelocities() {
  ctx.strokeStyle = '#6b8bff';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(107, 139, 255, 0.5)';
  ctx.shadowBlur = 6;
  for (const b of world.bodies) {
  if (b.isStatic || b.velocity.lengthSq() < 0.01) continue;
  const p = worldToScreen(b.position.x, b.position.y);
  const ex = p.x + b.velocity.x * camera.scale * 0.25;
  const ey = p.y + b.velocity.y * camera.scale * 0.25;
  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ex, ey); ctx.stroke();
  drawArrowhead(p, { x: ex, y: ey }, '#6b8bff');
  }
  ctx.shadowBlur = 0;
  }
  
  function drawTrails() {
  for (const [id, pts] of state.trails) {
  if (pts.length < 2) continue;
  // Gradient trail from transparent to vibrant
  const gradient = ctx.createLinearGradient(
    worldToScreen(pts[0].x, pts[0].y).x,
    worldToScreen(pts[0].x, pts[0].y).y,
    worldToScreen(pts[pts.length-1].x, pts[pts.length-1].y).x,
    worldToScreen(pts[pts.length-1].x, pts[pts.length-1].y).y
  );
  gradient.addColorStop(0, 'rgba(0, 229, 160, 0.1)');
  gradient.addColorStop(1, 'rgba(0, 229, 160, 0.6)');
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
  const s = worldToScreen(pts[i].x, pts[i].y);
  if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
  }
  ctx.stroke();
  }
  }

function drawSelectionRing(b) {
  const aabb = b.aabb();
  const min = worldToScreen(aabb.minX, aabb.minY);
  const max = worldToScreen(aabb.maxX, aabb.maxY);
  const pad = 4;
  const w = max.x - min.x + pad * 2;
  const h = max.y - min.y + pad * 2;
  const x = min.x - pad;
  const y = min.y - pad;
  const r = 4; // corner radius
  
  // Subtle glow
  ctx.shadowColor = 'rgba(0, 229, 160, 0.3)';
  ctx.shadowBlur = 6;
  ctx.strokeStyle = 'rgba(0, 229, 160, 0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.stroke();
  ctx.shadowBlur = 0;
  }

function withAlpha(hex, a) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  return `rgba(${r},${g},${b},${a})`;
}

/* =========================== readouts =========================== */
// Compact formatter: keeps small numbers readable; switches to scientific
// once the integer part stops fitting in the metric cells. Without this
// large numbers get visually clipped, leaving the user reading a wrong prefix.
function fmtNum(n) {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a === 0) return '0';
  if (a >= 1e6 || a < 1e-3) return n.toExponential(2);
  return n.toFixed(2);
}

// PE reference: floor's top surface (matches the visual floor the user sees).
// Measured against the body's lowest point (aabb.maxY in screen-down coords)
// so a body resting on the floor reads ~0 J. Tiny negative values from contact
// penetration are clamped to 0 for clarity.
const FLOOR_SURFACE_OFFSET = 0.05; // matches makeBox offset in rebuildBoundaries
function bodyHeightAboveFloor(body) {
  const floorTop = cssH / PX_PER_M - FLOOR_SURFACE_OFFSET;
  const aabb = body.aabb();
  const h = floorTop - aabb.maxY;
  return h > 0 ? h : 0;
}

// Readouts are now handled by the floating info overlay
function updateReadouts() {
  // No-op - readings moved to floating overlay
}

/* =========================== trails update =========================== */
function updateTrails() {
  if (!ui.showTrails.checked) { state.trails.clear(); return; }
  for (const b of world.bodies) {
    if (b.isStatic) continue;
    let arr = state.trails.get(b.id);
    if (!arr) { arr = []; state.trails.set(b.id, arr); }
    arr.push(b.position.copy());
    if (arr.length > 60) arr.shift();
  }
  // prune for removed bodies
  for (const id of [...state.trails.keys()]) {
    if (!world.bodies.find(b => b.id === id)) state.trails.delete(id);
  }
}

// ======================= HAPTIC FEEDBACK =======================
function triggerHaptic(type = 'light') {
  if ('vibrate' in navigator) {
    const patterns = {
      light: [8],
      medium: [15],
      heavy: [25],
      double: [10, 30, 10],
      success: [10, 50, 20]
    };
    navigator.vibrate(patterns[type] || patterns.light);
  }
}

/* =========================== UI wiring =========================== */
// Slider sound throttle to prevent spam
let lastSliderSoundT = 0;
const sliderSoundThrottle = 40; // ms between slider ticks

ui.gravity.addEventListener('input', () => {
  world.gravity = parseFloat(ui.gravity.value);
  ui.gravityVal.textContent = world.gravity.toFixed(2);
  const now = performance.now();
  if (now - lastSliderSoundT > sliderSoundThrottle) {
    AudioFx.sliderTick();
    lastSliderSoundT = now;
  }
});
ui.timeScale.addEventListener('input', () => {
  state.timeScale = parseFloat(ui.timeScale.value);
  ui.timeVal.textContent = state.timeScale.toFixed(2);
  const now = performance.now();
  if (now - lastSliderSoundT > sliderSoundThrottle) {
    AudioFx.sliderTick();
    lastSliderSoundT = now;
  }
});
ui.pauseBtn.addEventListener('click', () => {
  state.paused = !state.paused;
  ui.pauseBtn.textContent = state.paused ? '▶' : '⏸';
  if (state.paused) AudioFx.toggleOff(); else AudioFx.toggleOn();
});
ui.resetBtn.addEventListener('click', () => {
  loadPreset('default');
  AudioFx.reset();
});
ui.clearBtn.addEventListener('click', () => {
  world.clear(); rebuildBoundaries(); state.selected = null; state.trails.clear();
  world.gravity = parseFloat(ui.gravity.value);
  world.preSubstep = null;
  AudioFx.reset();
});

// tool buttons with haptic and sound
document.querySelectorAll('.tool').forEach(el => {
  el.addEventListener('mouseenter', () => AudioFx.hover());
  el.addEventListener('click', () => {
    document.querySelectorAll('.tool').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
    state.tool = el.dataset.tool;
    triggerHaptic('light');
    AudioFx.toolSelect();
  });
});

// presets with haptic and sound
document.querySelectorAll('.preset').forEach(el => {
  el.addEventListener('mouseenter', () => AudioFx.hover());
  el.addEventListener('click', () => {
    loadPreset(el.dataset.preset);
    world.emit({ type: 'preset', name: el.dataset.preset });
    triggerHaptic('double');
    AudioFx.presetLoad();
  });
});

// level selection with haptic and sound
document.querySelectorAll('#levelSegment .seg').forEach(el => {
  el.addEventListener('mouseenter', () => AudioFx.hover());
  el.addEventListener('click', () => {
    document.querySelectorAll('#levelSegment .seg').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
    educator.setLevel(parseInt(el.dataset.level, 10));
    triggerHaptic('light');
    AudioFx.click();
  });
});

// Add hover sounds to all interactive elements
document.querySelectorAll('.bar-group button, .overlay-toggle, .check, .bar-toggle').forEach(el => {
  el.addEventListener('mouseenter', () => AudioFx.hover());
});

// Checkbox toggle sounds
document.querySelectorAll('.check input[type=checkbox]').forEach(el => {
  el.addEventListener('change', () => {
    if (el.checked) AudioFx.toggleOn(); else AudioFx.toggleOff();
  });
});

// Material selection
document.querySelectorAll('.material').forEach(el => {
  el.addEventListener('mouseenter', () => AudioFx.hover());
  el.addEventListener('click', () => {
    document.querySelectorAll('.material').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
    state.material = el.dataset.material;
    triggerHaptic('light');
    AudioFx.click();
  });
});

// Prefab spawning - spawn at center of canvas
document.querySelectorAll('.prefab').forEach(el => {
  el.addEventListener('mouseenter', () => AudioFx.hover());
  el.addEventListener('click', () => {
    const cx = cssW / 2 / PX_PER_M;
    const cy = cssH / 2 / PX_PER_M;
    spawnPrefab(el.dataset.prefab, cx, cy);
    triggerHaptic('double');
    AudioFx.presetLoad();
  });
});

// Fluid controls
const fluidEnabledCheck = document.getElementById('fluidEnabled');
const clearFluidBtn = document.getElementById('clearFluid');

if (fluidEnabledCheck) {
  fluidEnabledCheck.addEventListener('change', () => {
    FLUID_SETTINGS.enabled = fluidEnabledCheck.checked;
    if (fluidEnabledCheck.checked) AudioFx.toggleOn(); else AudioFx.toggleOff();
  });
}

if (clearFluidBtn) {
  clearFluidBtn.addEventListener('click', () => {
    fluidParticles.length = 0;
    AudioFx.reset();
    triggerHaptic('medium');
  });
}

document.querySelectorAll('.fluid-type').forEach(el => {
  el.addEventListener('mouseenter', () => AudioFx.hover());
  el.addEventListener('click', () => {
    document.querySelectorAll('.fluid-type').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
    FLUID_SETTINGS.type = el.dataset.fluid;
    triggerHaptic('light');
    AudioFx.click();
  });
});

// Particles toggle
const showParticlesCheck = document.getElementById('showParticles');
if (showParticlesCheck) {
  showParticlesCheck.addEventListener('change', () => {
    state.particlesEnabled = showParticlesCheck.checked;
    if (showParticlesCheck.checked) AudioFx.toggleOn(); else AudioFx.toggleOff();
  });
}

// collapse / dismiss controls
const topbarEl = document.querySelector('.topbar');
const layoutEl = document.querySelector('.layout');
const hintEl = document.getElementById('hint');
document.getElementById('topbarToggle').addEventListener('click', () => {
  topbarEl.classList.toggle('collapsed');
  // ResizeObserver picks this up, but call resize() directly so canvas redraws this frame.
  requestAnimationFrame(resize);
});

document.getElementById('hintClose').addEventListener('click', () => {
  hintEl.classList.add('dismissed');
  try { localStorage.setItem('ps.hintDismissed', '1'); } catch (e) { /* private mode */ }
});
try {
  if (localStorage.getItem('ps.hintDismissed') === '1') hintEl.classList.add('dismissed');
} catch (e) { /* ignore */ }

// ======================= TOOLS PANEL COLLAPSE =======================
const toolsPanel = document.getElementById('toolsPanel');
const toolsCollapseBtn = document.getElementById('toolsCollapseBtn');

function toggleToolsCollapse() {
  triggerHaptic('light');
  toolsPanel.classList.toggle('collapsed');
  const isCollapsed = toolsPanel.classList.contains('collapsed');
  try { localStorage.setItem('ps.toolsCollapsed', isCollapsed ? '1' : '0'); } catch (e) {}
  requestAnimationFrame(resize);
}

toolsCollapseBtn.addEventListener('click', toggleToolsCollapse);

// Restore collapsed state
try {
  if (localStorage.getItem('ps.toolsCollapsed') === '1') {
    toolsPanel.classList.add('collapsed');
  }
} catch (e) {}

// ======================= DRAGGABLE DIVIDERS =======================
function setupDivider(divider, computeSize, varName, storeKey) {
  if (!divider) return;
  let dragging = false;
  
  divider.addEventListener('pointerdown', (e) => {
    // Un-collapse tools when starting to drag
    if (toolsPanel.classList.contains('collapsed')) {
      toolsPanel.classList.remove('collapsed');
    }
    e.preventDefault();
    try { divider.setPointerCapture(e.pointerId); } catch (err) {}
    divider.classList.add('dragging');
    layoutEl.classList.add('resizing');
    dragging = true;
    triggerHaptic('light');
  });
  
  divider.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const isMobile = window.matchMedia('(max-width: 860px)').matches;
    const r = layoutEl.getBoundingClientRect();
    const size = computeSize(e, r, isMobile);
    layoutEl.style.setProperty(varName, size + 'px');
  });
  
  divider.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    divider.classList.remove('dragging');
    layoutEl.classList.remove('resizing');
    resize();
    triggerHaptic('medium');
    try { localStorage.setItem(storeKey, layoutEl.style.getPropertyValue(varName)); } catch (e) {}
  });
  
  divider.addEventListener('pointercancel', () => {
    if (!dragging) return;
    dragging = false;
    divider.classList.remove('dragging');
    layoutEl.classList.remove('resizing');
  });
}

// Tools divider setup
setupDivider(
  document.getElementById('toolsDivider'),
  (e, r, mobile) => {
    const minSize = mobile ? 36 : 80;
    const maxSize = mobile ? r.height * 0.4 : r.width * 0.4;
    const rawSize = mobile ? e.clientY - r.top : e.clientX - r.left;
    return Math.max(minSize, Math.min(maxSize, rawSize));
  },
  '--tools-size', 'ps.toolsSize'
);

// Restore tools size
try {
  const ts = localStorage.getItem('ps.toolsSize');
  if (ts && !toolsPanel.classList.contains('collapsed')) {
    layoutEl.style.setProperty('--tools-size', ts);
  }
} catch (e) {}

// ======================= TOPBAR DIVIDER =======================
const topbarDivider = document.getElementById('topbarDivider');
const topbar = document.querySelector('.topbar');

function setupTopbarDivider() {
  if (!topbarDivider || !topbar) return;
  
  let dragging = false;
  let startY = 0;
  let startHeight = 0;
  
  topbarDivider.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { topbarDivider.setPointerCapture(e.pointerId); } catch (err) {}
    topbarDivider.classList.add('dragging');
    topbar.classList.add('resizing');
    dragging = true;
    startY = e.clientY;
    startHeight = topbar.offsetHeight;
    triggerHaptic('light');
  });
  
  topbarDivider.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const deltaY = e.clientY - startY;
    const newHeight = Math.max(48, Math.min(200, startHeight + deltaY));
    topbar.style.minHeight = newHeight + 'px';
  });
  
  topbarDivider.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    topbarDivider.classList.remove('dragging');
    topbar.classList.remove('resizing');
    triggerHaptic('medium');
    try { localStorage.setItem('ps.topbarHeight', topbar.style.minHeight); } catch (e) {}
  });
  
  topbarDivider.addEventListener('pointercancel', () => {
    if (!dragging) return;
    dragging = false;
    topbarDivider.classList.remove('dragging');
    topbar.classList.remove('resizing');
  });
  
  // Double-click to reset
  topbarDivider.addEventListener('dblclick', () => {
    topbar.style.minHeight = '';
    triggerHaptic('double');
    try { localStorage.removeItem('ps.topbarHeight'); } catch (e) {}
  });
}

setupTopbarDivider();

// Restore topbar height
try {
  const th = localStorage.getItem('ps.topbarHeight');
  if (th && topbar) topbar.style.minHeight = th;
} catch (e) {}

// ======================= MODULAR OVERLAY SYSTEM =======================
// Reusable overlay manager with fluid touch dragging and inertia
// Track all overlay instances for z-index management
const overlayInstances = [];

class FloatingOverlay {
  constructor(id, toggleId, storageKey) {
    this.el = document.getElementById(id);
    this.toggle = document.getElementById(toggleId);
    this.storageKey = storageKey;
    this.drag = { 
      active: false, 
      offsetX: 0, 
      offsetY: 0, 
      velocityX: 0, 
      velocityY: 0,
      lastX: 0,
      lastY: 0,
      lastTime: 0
    };
    this.pinch = {
      active: false,
      initialDistance: 0,
      initialScale: 1,
      pointers: new Map()
    };
    this.scale = 1;
    this.opacity = 0.9;
    this.glassMode = false;
    this.inertiaRAF = null;
    
    if (!this.el || !this.toggle) return;
    
    this.closeBtn = this.el.querySelector('.floating-overlay-close');
    this.opacitySlider = this.el.querySelector('.overlay-controls input[type=range]');
    this.glassToggle = this.el.querySelector('.glass-toggle');
    
    overlayInstances.push(this);
    this.init();
  }
  
  init() {
    // Toggle button with haptic and sound
    this.toggle.addEventListener('mouseenter', () => AudioFx.hover());
    this.toggle.addEventListener('click', () => {
      triggerHaptic('light');
      this.toggleVisibility();
    });
    if (this.closeBtn) {
      this.closeBtn.addEventListener('mouseenter', () => AudioFx.hover());
      this.closeBtn.addEventListener('click', () => {
        triggerHaptic('light');
        this.hide();
      });
    }
    
    // Opacity slider with sound
    if (this.opacitySlider) {
      let lastOpacitySoundT = 0;
      this.opacitySlider.addEventListener('input', () => {
        this.setOpacity(parseFloat(this.opacitySlider.value));
        const now = performance.now();
        if (now - lastOpacitySoundT > 50) {
          AudioFx.sliderTick();
          lastOpacitySoundT = now;
        }
      });
    }
    
    // Glass mode toggle with sound
    if (this.glassToggle) {
      this.glassToggle.addEventListener('mouseenter', () => AudioFx.hover());
      this.glassToggle.addEventListener('click', () => {
        triggerHaptic('light');
        this.toggleGlassMode();
        if (this.glassMode) AudioFx.toggleOn(); else AudioFx.toggleOff();
      });
    }
    
    // Bring to front on any interaction
    this.el.addEventListener('pointerdown', () => this.bringToFront(), { capture: true });
    
    // Multi-touch support for pinch and drag
    this.el.addEventListener('pointerdown', (e) => this.onPointerDown(e), { passive: false });
    this.el.addEventListener('pointermove', (e) => this.onPointerMove(e), { passive: false });
    this.el.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.el.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    this.el.addEventListener('lostpointercapture', (e) => this.onPointerUp(e));
    
    // Touch events for better pinch detection
    this.el.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    this.el.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    this.el.addEventListener('touchend', (e) => this.onTouchEnd(e));
    
    // Prevent context menu on long press
    this.el.addEventListener('contextmenu', (e) => {
      if (this.drag.active || this.pinch.active) e.preventDefault();
    });
    
    // Restore state
    this.restoreState();
  }
  
  bringToFront() {
    // Remove focused from all overlays
    overlayInstances.forEach(ov => {
      if (ov.el) ov.el.classList.remove('focused');
    });
    // Add focused to this one
    this.el.classList.add('focused');
  }
  
  toggleGlassMode() {
    this.glassMode = !this.glassMode;
    this.el.classList.toggle('glass-mode', this.glassMode);
    this.saveState();
  }
  
  setGlassMode(enabled) {
    this.glassMode = enabled;
    this.el.classList.toggle('glass-mode', this.glassMode);
  }
  
  // Pinch gesture helpers
  getTouchDistance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  onTouchStart(e) {
    if (e.target.matches('input, button, a')) return;
    
    if (e.touches.length === 2) {
      e.preventDefault();
      this.pinch.active = true;
      this.drag.active = false;
      this.pinch.initialDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
      this.pinch.initialScale = this.scale;
      this.el.classList.add('pinching');
      this.el.classList.remove('dragging');
      triggerHaptic('light');
    }
  }
  
  onTouchMove(e) {
    if (this.pinch.active && e.touches.length === 2) {
      e.preventDefault();
      const currentDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
      const scaleRatio = currentDistance / this.pinch.initialDistance;
      // Smaller max scale on mobile for more viewing area
      const isMobile = window.matchMedia('(max-width: 860px)').matches;
      const minScale = isMobile ? 0.5 : 0.6;
      const maxScale = isMobile ? 1.0 : 1.5;
      const newScale = Math.max(minScale, Math.min(maxScale, this.pinch.initialScale * scaleRatio));
      this.setScale(newScale);
    }
  }
  
  onTouchEnd(e) {
    if (this.pinch.active && e.touches.length < 2) {
      this.pinch.active = false;
      this.el.classList.remove('pinching');
      triggerHaptic('medium');
      this.saveState();
    }
  }
  
  setScale(val) {
    this.scale = val;
    this.el.style.setProperty('--overlay-scale', val);
    // Also scale font sizes proportionally
    this.el.style.fontSize = (12 * val) + 'px';
  }
  
  toggleVisibility() {
    if (this.el.classList.contains('visible')) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  show() {
    if (this.inertiaRAF) cancelAnimationFrame(this.inertiaRAF);
    if (!this.el.style.left && !this.el.style.right) {
      this.setDefaultPosition();
    }
    this.el.classList.add('visible');
    this.toggle.classList.add('active');
    AudioFx.overlayOpen();
    this.saveState();
  }
  
  hide() {
    if (this.inertiaRAF) cancelAnimationFrame(this.inertiaRAF);
    this.el.classList.remove('visible');
    this.toggle.classList.remove('active');
    AudioFx.overlayClose();
    this.saveState();
  }
  
  setDefaultPosition() {
    const defaultX = this.el.dataset.defaultX || '16';
    const defaultY = this.el.dataset.defaultY || '70';
    
    if (defaultX === 'right') {
      this.el.style.right = '70px';
      this.el.style.left = 'auto';
    } else if (defaultX === 'center') {
      this.el.style.left = Math.max(16, (window.innerWidth - 320) / 2) + 'px';
    } else {
      this.el.style.left = defaultX + 'px';
    }
    this.el.style.top = defaultY + 'px';
  }
  
  setOpacity(val) {
    this.opacity = val;
    // Direct opacity control - no blur, clean transparency
    this.el.style.setProperty('--overlay-opacity', val);
    // Remove backdrop blur entirely for clean see-through
    this.el.style.backdropFilter = 'none';
    this.el.style.webkitBackdropFilter = 'none';
    if (this.opacitySlider) this.opacitySlider.value = val;
    this.saveState();
  }
  
  onPointerDown(e) {
    if (e.target.matches('input, button, a, .floating-overlay-close')) return;
    e.preventDefault();
    
    if (this.inertiaRAF) cancelAnimationFrame(this.inertiaRAF);
    
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch (err) {}
    
    this.el.classList.add('dragging');
    this.drag.active = true;
    AudioFx.dragStart();
    
    const rect = this.el.getBoundingClientRect();
    this.drag.offsetX = e.clientX - rect.left;
    this.drag.offsetY = e.clientY - rect.top;
    this.drag.lastX = e.clientX;
    this.drag.lastY = e.clientY;
    this.drag.lastTime = performance.now();
    this.drag.velocityX = 0;
    this.drag.velocityY = 0;
    
    triggerHaptic('light');
  }
  
  onPointerMove(e) {
    if (!this.drag.active) return;
    e.preventDefault();
    
    const now = performance.now();
    const dt = Math.max(1, now - this.drag.lastTime);
    
    // Calculate velocity for inertia
    this.drag.velocityX = (e.clientX - this.drag.lastX) / dt * 16;
    this.drag.velocityY = (e.clientY - this.drag.lastY) / dt * 16;
    
    this.drag.lastX = e.clientX;
    this.drag.lastY = e.clientY;
    this.drag.lastTime = now;
    
    // Clamp position
    const x = Math.max(0, Math.min(window.innerWidth - this.el.offsetWidth, e.clientX - this.drag.offsetX));
    const y = Math.max(0, Math.min(window.innerHeight - this.el.offsetHeight, e.clientY - this.drag.offsetY));
    
    this.el.style.left = x + 'px';
    this.el.style.right = 'auto';
    this.el.style.top = y + 'px';
  }
  
  onPointerUp(e) {
    if (!this.drag.active) return;
    this.drag.active = false;
    this.el.classList.remove('dragging');
    AudioFx.dragEnd();
    
    // Apply inertia if velocity is significant
    const speed = Math.sqrt(this.drag.velocityX ** 2 + this.drag.velocityY ** 2);
    if (speed > 0.5) {
      this.applyInertia();
    } else {
      this.saveState();
    }
  }
  
  applyInertia() {
    const friction = 0.92;
    const minVelocity = 0.1;
    
    const animate = () => {
      this.drag.velocityX *= friction;
      this.drag.velocityY *= friction;
      
      let x = parseFloat(this.el.style.left) + this.drag.velocityX;
      let y = parseFloat(this.el.style.top) + this.drag.velocityY;
      
      // Bounce off edges with damping
      const maxX = window.innerWidth - this.el.offsetWidth;
      const maxY = window.innerHeight - this.el.offsetHeight;
      
      if (x < 0) { x = 0; this.drag.velocityX *= -0.3; triggerHaptic('light'); AudioFx.click(); }
      if (x > maxX) { x = maxX; this.drag.velocityX *= -0.3; triggerHaptic('light'); AudioFx.click(); }
      if (y < 0) { y = 0; this.drag.velocityY *= -0.3; triggerHaptic('light'); AudioFx.click(); }
      if (y > maxY) { y = maxY; this.drag.velocityY *= -0.3; triggerHaptic('light'); AudioFx.click(); }
      
      this.el.style.left = x + 'px';
      this.el.style.top = y + 'px';
      
      if (Math.abs(this.drag.velocityX) > minVelocity || Math.abs(this.drag.velocityY) > minVelocity) {
        this.inertiaRAF = requestAnimationFrame(animate);
      } else {
        this.saveState();
      }
    };
    
    this.inertiaRAF = requestAnimationFrame(animate);
  }
  
  saveState() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        visible: this.el.classList.contains('visible'),
        x: parseInt(this.el.style.left) || 0,
        y: parseInt(this.el.style.top) || 0,
        opacity: this.opacity,
        scale: this.scale,
        glassMode: this.glassMode
      }));
    } catch (e) {}
  }
  
  restoreState() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.x !== undefined) {
          this.el.style.left = data.x + 'px';
          this.el.style.right = 'auto';
        }
        if (data.y !== undefined) this.el.style.top = data.y + 'px';
        if (data.opacity !== undefined) this.setOpacity(data.opacity);
        if (data.scale !== undefined) this.setScale(data.scale);
        if (data.glassMode !== undefined) this.setGlassMode(data.glassMode);
        if (data.visible) this.show();
      }
    } catch (e) {}
  }
}

// Create overlay instances
const infoOverlayManager = new FloatingOverlay('infoOverlay', 'infoOverlayToggle', 'ps.infoOverlay');
const lessonOverlayManager = new FloatingOverlay('lessonOverlay', 'lessonOverlayToggle', 'ps.lessonOverlay');
const tipsOverlayManager = new FloatingOverlay('tipsOverlay', 'tipsOverlayToggle', 'ps.tipsOverlay');

// Toggle functions for keyboard shortcuts
function toggleInfoOverlay() { infoOverlayManager.toggleVisibility(); }
function toggleLessonOverlay() { lessonOverlayManager.toggleVisibility(); }
function toggleTipsOverlay() { tipsOverlayManager.toggleVisibility(); }

// Element refs for updates
const ovSelected = document.getElementById('ov-selected');
const ovSpeed = document.getElementById('ov-speed');
const ovKe = document.getElementById('ov-ke');
const ovPe = document.getElementById('ov-pe');
const ovMomentum = document.getElementById('ov-momentum');
const ovAngular = document.getElementById('ov-angular');
const ovTotal = document.getElementById('ov-total');
const ovCount = document.getElementById('ov-count');
const ovLessonTitle = document.getElementById('ov-lessonTitle');
const ovLessonBody = document.getElementById('ov-lessonBody');
const ovLessonFormula = document.getElementById('ov-lessonFormula');
const ovLevelBadge = document.getElementById('ov-levelBadge');
const ovConceptList = document.getElementById('ov-conceptList');

// Update info overlay readings
function updateInfoOverlay() {
  const infoEl = document.getElementById('infoOverlay');
  if (!infoEl || !infoEl.classList.contains('visible')) return;
  
  const b = state.selected;
  const dynamicBodies = world.bodies.filter(x => !x.isStatic && !walls.includes(x));
  
  // System totals
  let totalKE = 0, totalPE = 0;
  dynamicBodies.forEach(body => {
    totalKE += 0.5 * body.mass * body.velocity.lengthSq();
    totalPE += body.mass * Math.abs(world.gravity) * bodyHeightAboveFloor(body);
  });
  
  if (ovTotal) ovTotal.textContent = (totalKE + totalPE).toFixed(1);
  if (ovCount) ovCount.textContent = dynamicBodies.length;
  
  if (!b || walls.includes(b)) {
    if (ovSelected) ovSelected.textContent = '—';
    if (ovSpeed) ovSpeed.textContent = '0';
    if (ovKe) ovKe.textContent = '0';
    if (ovPe) ovPe.textContent = '0';
    if (ovMomentum) ovMomentum.textContent = '0';
    if (ovAngular) ovAngular.textContent = '0';
    return;
  }
  
  const speed = b.velocity.length();
  const ke = 0.5 * b.mass * b.velocity.lengthSq();
  const pe = b.mass * Math.abs(world.gravity) * bodyHeightAboveFloor(b);
  const momentum = b.mass * speed;
  
  if (ovSelected) ovSelected.textContent = b.shape === SHAPE.CIRCLE ? 'Ball' : 'Box';
  if (ovSpeed) ovSpeed.textContent = speed.toFixed(2);
  if (ovKe) ovKe.textContent = ke.toFixed(1);
  if (ovPe) ovPe.textContent = pe.toFixed(1);
  if (ovMomentum) ovMomentum.textContent = momentum.toFixed(2);
  if (ovAngular) ovAngular.textContent = Math.abs(b.angularVelocity || 0).toFixed(2);
}

// Update lesson overlay from education system
function updateLessonOverlay() {
  const lessonEl = document.getElementById('lessonOverlay');
  if (!lessonEl || !lessonEl.classList.contains('visible')) return;
  
  // Sync with education.js if available
  if (typeof currentLesson !== 'undefined' && currentLesson) {
    if (ovLessonTitle) ovLessonTitle.textContent = currentLesson.title || 'Physics Concepts';
    if (ovLessonBody) ovLessonBody.textContent = currentLesson.body || '';
    if (ovLessonFormula && currentLesson.formula) {
      ovLessonFormula.textContent = currentLesson.formula;
      ovLessonFormula.hidden = false;
    } else if (ovLessonFormula) {
      ovLessonFormula.hidden = true;
    }
  }
  
  // Update level badge
  if (ovLevelBadge) {
    const levelNames = ['Curious', 'Student', 'University', 'Expert'];
    const currentLevel = parseInt(document.querySelector('#levelSegment .seg.active')?.dataset.level) || 1;
    ovLevelBadge.textContent = levelNames[currentLevel - 1];
  }
}

// Update tips overlay concepts
function updateTipsOverlay() {
  if (!ovConceptList) return;
  const tipsEl = document.getElementById('tipsOverlay');
  if (!tipsEl || !tipsEl.classList.contains('visible')) return;
  
  // Sync with education.js concept list if available
  const panelConcepts = document.getElementById('conceptList');
  if (panelConcepts) {
    ovConceptList.innerHTML = panelConcepts.innerHTML;
  }
}

// keyboard
window.addEventListener('keydown', (ev) => {
  if (ev.target.matches('input, textarea')) return;
  const map = { '1':'box', '2':'circle', '3':'polygon', '4':'wall',
                '5':'triangle', '6':'rope',
                'g':'grab', 'G':'grab', 's':'spring', 'S':'spring',
                'p':'impulse', 'P':'impulse', 'x':'delete', 'X':'delete',
                'n':'pin', 'N':'pin', 'k':'slice', 'K':'slice' };
  if (ev.shiftKey && /[1-4]/.test(ev.key)) {
    const lv = parseInt(ev.key, 10);
    document.querySelector(`#levelSegment .seg[data-level="${lv}"]`).click();
    return;
  }
  if (map[ev.key]) {
    document.querySelector(`.tool[data-tool="${map[ev.key]}"]`).click();
  } else if (ev.key === ' ') {
    ev.preventDefault();
    ui.pauseBtn.click();
  } else if (ev.key === 'r' || ev.key === 'R') {
    ui.resetBtn.click();
  } else if (ev.key === 'c' || ev.key === 'C') {
    ui.clearBtn.click();
  } else if (ev.key === '?') {
    document.getElementById('helpDialog').showModal();
  } else if (ev.key === 'i' || ev.key === 'I') {
    toggleInfoOverlay();
  } else if (ev.key === 'l' || ev.key === 'L') {
    toggleLessonOverlay();
  } else if (ev.key === 't' || ev.key === 'T') {
    toggleTipsOverlay();
  }
});

/* =========================== presets =========================== */
function loadPreset(name) {
  world.clear();
  state.selected = null;
  state.trails.clear();
  world.preSubstep = null;
  rebuildBoundaries();
  world.gravity = parseFloat(ui.gravity.value);

  const Wm = cssW / PX_PER_M, Hm = cssH / PX_PER_M;

  switch (name) {
    case 'default':
      // a few balls and a box to start
      world.add(makeCircle(Wm * 0.4, Hm * 0.3, 0.5, { color: '#6aa6ff' }));
      world.add(makeCircle(Wm * 0.6, Hm * 0.2, 0.4, { color: '#ffc46a' }));
      world.add(makeBox(Wm * 0.5, Hm * 0.5, 1.2, 1.2, { color: '#9bf2e0' }));
      break;
    case 'stack': {
      const x = Wm * 0.5;
      const baseY = Hm - 0.4;
      for (let i = 0; i < 8; i++) {
        const y = baseY - 0.45 - i * 0.85;
        world.add(makeBox(x + (Math.random() - 0.5) * 0.05, y, 0.8, 0.8, {
          color: SPAWN_PALETTE[i % SPAWN_PALETTE.length], friction: 0.7
        }));
      }
      break;
    }
    case 'pendulum': {
      const ax = Wm * 0.5, ay = 0.5;
      const anchor = world.add(makeCircle(ax, ay, 0.08, { isStatic: true, color: '#4a5068' }));
      const bob = world.add(makeCircle(ax + 3, ay + 0.2, 0.5, { color: '#ff7a8a', density: 4 }));
      world.addConstraint(new DistanceConstraint(anchor, bob, new Vec2(0, 0), new Vec2(0, 0), {
        length: 3.2, stiffness: 1.0
      }));
      bob.velocity = new Vec2(0, 0);
      break;
    }
    case 'newton': {
      const ay = 1.2;
      const len = 3;
      const radius = 0.5;
      const spacing = radius * 2;
      const cx = Wm * 0.5;
      const N = 5;
      for (let i = 0; i < N; i++) {
        const x = cx + (i - (N - 1) / 2) * spacing;
        const anchor = world.add(makeCircle(x, ay, 0.05, { isStatic: true, color: '#4a5068' }));
        const ball = world.add(makeCircle(x, ay + len, radius, {
          color: '#8ad0ff', restitution: 0.95, friction: 0.0, density: 5
        }));
        world.addConstraint(new DistanceConstraint(anchor, ball, new Vec2(0, 0), new Vec2(0, 0), {
          length: len, stiffness: 1.0
        }));
      }
      // first ball pulled aside
      const first = world.bodies.find(b => !b.isStatic);
      if (first) {
        first.position = new Vec2(first.position.x - 2.5, first.position.y - 1.5);
      }
      break;
    }
    case 'ramp': {
      // diagonal ramp + ball on top — vertex order TL→TR→BR→BL to match engine winding
      const verts = [new Vec2(-3, -0.2), new Vec2(3, -0.2), new Vec2(3, 0.2), new Vec2(-3, 0.2)];
      const ramp = new Body({
        shape: SHAPE.POLYGON,
        position: new Vec2(Wm * 0.5, Hm * 0.7),
        vertices: verts,
        isStatic: true,
        color: '#4a5068'
      });
      ramp.angle = -0.3;
      ramp._cachedAngle = NaN;
      world.add(ramp);
      world.add(makeCircle(Wm * 0.5 - 2.5, Hm * 0.7 - 1.5, 0.4, { color: '#ffc46a', restitution: 0.4, friction: 0.3 }));
      // a wall to roll into
      world.add(makeBox(Wm * 0.5 + 3.5, Hm - 1.2, 0.4, 1.6, { isStatic: true, color: '#4a5068' }));
      break;
    }
    case 'orbit': {
      world.gravity = 0;
      const cx = Wm * 0.5, cy = Hm * 0.5;
      // central mass (static)
      const sun = world.add(makeCircle(cx, cy, 0.5, { isStatic: true, color: '#ffc46a' }));
      // orbiters
      const config = [
        { r: 2.0, m: 1.0, color: '#6aa6ff' },
        { r: 3.5, m: 1.5, color: '#9bf2e0' },
        { r: 5.0, m: 0.8, color: '#ff7a8a' }
      ];
      const G = 60;
      const sunMass = 200;
      const planets = [];
      for (const c of config) {
        const px = cx + c.r;
        const py = cy;
        const v = Math.sqrt(G * sunMass / c.r); // circular orbit
        const planet = world.add(makeCircle(px, py, 0.25 + c.m * 0.1, {
          color: c.color, density: c.m / (Math.PI * 0.25 * 0.25), friction: 0, restitution: 0.5
        }));
        planet.velocity = new Vec2(0, -v);
        planets.push(planet);
      }

      world.preSubstep = (dt) => {
        for (const p of planets) {
          if (!world.bodies.includes(p)) continue;
          const r = sun.position.sub(p.position);
          const distSq = Math.max(r.lengthSq(), 0.25);
          const dist = Math.sqrt(distSq);
          const F = G * sunMass * p.mass / distSq;
          p.applyForce(r.mul(F / dist));
        }
      };
      break;
    }
    case 'dominoes': {
      const baseY = Hm - 0.4;
      const w = 0.18, h = 1.6;
      const N = 12;
      const spacing = 0.7;
      const startX = Wm * 0.5 - ((N - 1) * spacing) / 2;
      for (let i = 0; i < N; i++) {
        const tile = world.add(makeBox(startX + i * spacing, baseY - h / 2 + 0.05, w, h, {
          color: SPAWN_PALETTE[i % SPAWN_PALETTE.length], friction: 0.5, density: 2
        }));
        // Tilt the first one so it falls into the next.
        if (i === 0) {
          tile.angle = -0.35;
          tile._cachedAngle = NaN;
          tile.angularVelocity = -1.5;
        }
      }
      break;
    }
    case 'tower': {
      // Pyramid of boxes.
      const baseY = Hm - 0.4;
      const bw = 0.7, bh = 0.7;
      const rows = 7;
      for (let row = 0; row < rows; row++) {
        const count = rows - row;
        const y = baseY - bh / 2 - row * bh + 0.05;
        const startX = Wm * 0.5 - ((count - 1) * bw) / 2;
        for (let i = 0; i < count; i++) {
          world.add(makeBox(startX + i * bw, y, bw * 0.95, bh * 0.95, {
            color: SPAWN_PALETTE[(row + i) % SPAWN_PALETTE.length], friction: 0.6
          }));
        }
      }
      break;
    }
    case 'wreckingball': {
      // Heavy pendulum + a stack of small boxes for it to demolish.
      const ax = Wm * 0.25, ay = 0.6;
      const ropeLen = Math.min(4.5, Hm * 0.55);
      const anchor = world.add(makeCircle(ax, ay, 0.1, { isStatic: true, color: '#4a5068' }));
      const ball = world.add(makeCircle(ax - ropeLen * 0.7, ay + ropeLen * 0.3, 0.55, {
        color: '#cfd6e6', density: 18, restitution: 0.2, friction: 0.5
      }));
      world.addConstraint(new DistanceConstraint(anchor, ball, new Vec2(0, 0), new Vec2(0, 0), {
        length: ropeLen, stiffness: 1.0
      }));
      ball.velocity = new Vec2(0, 0);

      // Stack of small boxes on the right.
      const stackX = Wm * 0.7;
      const baseY = Hm - 0.4;
      const sw = 0.5, sh = 0.5;
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 4; col++) {
          world.add(makeBox(
            stackX + (col - 1.5) * sw, baseY - sh / 2 - row * sh + 0.05,
            sw * 0.95, sh * 0.95,
            { color: SPAWN_PALETTE[(row + col) % SPAWN_PALETTE.length], friction: 0.6 }
          ));
        }
      }
      break;
    }
  }
}

/* =========================== main loop =========================== */
let lastTime = performance.now();
function loop(now) {
  const rawDt = (now - lastTime) / 1000;
  lastTime = now;
  // FPS exponential moving average — smooth jitter so the readout doesn't flicker.
  if (rawDt > 0 && rawDt < 0.5) {
    const inst = 1 / rawDt;
    state.fpsEMA = state.fpsEMA * 0.92 + inst * 0.08;
  }
  if (!state.paused) {
    if (state.grabBody && !state.grabBody.isStatic) {
      // Off-center grab forces produce torque; strongly damp angular velocity
      // while held so the body doesn't spiral out of control.
      const dampedDt = rawDt * state.timeScale;
      state.grabBody.angularVelocity *= Math.exp(-9 * dampedDt);
    }
    world.step(rawDt * state.timeScale);
    sampleEnvironment(now);
    updateTrails();
  }
  // Continuous fluid pouring while mouse held
  if (FLUID_SETTINGS.pouring && FLUID_SETTINGS.pourPos) {
    const speedBoost = Math.min(2.5, 1 + (state.mouseVelocity.speed || 0) / 600);
    spawnFluid(FLUID_SETTINGS.pourPos.x, FLUID_SETTINGS.pourPos.y, Math.floor(3 * speedBoost));
  }
  
  // Always update particles and fluid (even when paused for visual effect)
  updateParticles(rawDt);
  updateFluid();
render();
  drawFluid();
  drawParticles();
  updateReadouts();
  updateInfoOverlay();
  updateLessonOverlay();
  updateTipsOverlay();
  requestAnimationFrame(loop);
  }

/* =========================== bootstrap =========================== */
function init() {
  resize();
  if (cssW < 50 || cssH < 50) {
    // Stage hasn't laid out yet (common on mobile / desktop-mode toggle).
    // Retry next tick rather than spawning bodies into a 0×0 world.
    setTimeout(init, 50);
    return;
  }
  // On mobile, auto-collapse the heavy chrome so the canvas dominates.
  // The user can still expand via the toggle buttons.
  if (window.matchMedia('(max-width: 860px)').matches) {
    topbarEl.classList.add('collapsed');
    layoutEl.classList.add('panel-collapsed');
  }
  loadPreset('default');
  educator.setLevel(1);
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => resize()).observe(canvas.parentElement);
  }
  requestAnimationFrame(loop);
}
if (document.readyState === 'complete') init();
else window.addEventListener('load', init);

})();
