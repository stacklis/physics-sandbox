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
  destructionMode: document.getElementById('destructionMode'),
  grabStrength: document.getElementById('grabStrength'),
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
      // Dedupe: cap to ~one impact sound per 30 ms across all contacts.
      if (now - lastCollisionT < 30) return;
      lastCollisionT = now;
      const v = Math.min(Math.max(relV || 0, 0.5), 20);
      const pitch = 60 + v * 8;          // softer thud
      const gain = Math.min(0.25, 0.02 + v * 0.01);
      // Use lower filter for softer sound
      noise({ dur: 0.03 + v * 0.003, filter: pitch * 4, gain });
      // Sub-thud for body
      if (v < 10) tone({ freq: 60, dur: 0.05, type: 'sine', gain: gain * 0.2 });
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
    }
  };
})();

ui.audioVol.addEventListener('input', () => AudioFx.setVolume(parseFloat(ui.audioVol.value)));

// Pipe simulation events into AudioFx. Educator already listens separately.
// Destruction threshold for breaking objects
const DESTRUCTION_THRESHOLD = 8;

world.on(ev => {
  if (ev.type === 'collision') {
    AudioFx.collision(ev.relVelocity, performance.now());
    
    // Destruction mode: break objects on high-velocity impacts or marked for destruction
    if (state.destructionMode) {
      const { bodyA, bodyB, point } = ev;
      const effectiveVelA = bodyA?._thrownVelocity || ev.relVelocity;
      const effectiveVelB = bodyB?._thrownVelocity || ev.relVelocity;
      const shouldDestroyA = bodyA && !bodyA.isStatic && !walls.includes(bodyA) && !bodyA._isFragment && !bodyA._destroyed &&
        (effectiveVelA > DESTRUCTION_THRESHOLD || bodyA._destroyOnImpact);
      const shouldDestroyB = bodyB && !bodyB.isStatic && !walls.includes(bodyB) && !bodyB._isFragment && !bodyB._destroyed &&
        (effectiveVelB > DESTRUCTION_THRESHOLD || bodyB._destroyOnImpact);
      
      if (shouldDestroyA) {
        setTimeout(() => destroyBody(bodyA, point, Math.max(ev.relVelocity, effectiveVelA)), 0);
      }
      if (shouldDestroyB) {
        setTimeout(() => destroyBody(bodyB, point, Math.max(ev.relVelocity, effectiveVelB)), 0);
      }
    }
  }
  else if (ev.type === 'spring') AudioFx.spring();
  else if (ev.type === 'push') AudioFx.push();
  else if (ev.type === 'spawn') AudioFx.spawn();
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
  // material applicator
  activeMaterial: null, // currently selected material for application
  // destruction mode
  destructionMode: false,
  // grab strength multiplier (1 = normal, higher = more forceful)
  grabStrength: 1.0,
  // track grabbed body velocity for throw detection
  grabVelocityHistory: [],
  };

/* =========================== DESTRUCTION SYSTEM =========================== */
// Breaks a body into voxel fragments on collision
function destroyBody(body, impactPoint, impactForce) {
  if (!body || body.isStatic || walls.includes(body) || body._destroyed) return [];
  body._destroyed = true;
  
  const fragments = [];
  const pos = body.position;
  const vel = body.velocity;
  const color = body.color || '#888';
  
  // Determine fragment count based on body size and impact force
  const bodySize = body.shape === SHAPE.CIRCLE 
    ? body.radius * 2 
    : Math.max(body.width || 1, body.height || 1);
  const fragmentCount = Math.min(12, Math.max(4, Math.floor(bodySize * 2 + impactForce * 0.5)));
  const fragmentSize = Math.max(0.15, bodySize / fragmentCount * 0.8);
  
  // Create voxel fragments
  for (let i = 0; i < fragmentCount; i++) {
    // Spread fragments from impact point
    const angle = (i / fragmentCount) * Math.PI * 2 + Math.random() * 0.5;
    const dist = Math.random() * bodySize * 0.4;
    const fx = pos.x + Math.cos(angle) * dist;
    const fy = pos.y + Math.sin(angle) * dist;
    
    // Calculate explosion velocity from impact point
    const dx = fx - (impactPoint?.x || pos.x);
    const dy = fy - (impactPoint?.y || pos.y);
    const expDist = Math.hypot(dx, dy) || 0.1;
    const expForce = (impactForce * 0.3 + 2) * (1 - expDist / bodySize);
    
    const frag = world.add(makeBox(fx, fy, fragmentSize, fragmentSize, {
      density: body.density * 0.5,
      friction: 0.5,
      restitution: 0.3,
      color: color
    }));
    
    // Apply explosion velocity plus inherited velocity
    frag.velocity = new Vec2(
      vel.x + (dx / expDist) * expForce + (Math.random() - 0.5) * 2,
      vel.y + (dy / expDist) * expForce + (Math.random() - 0.5) * 2 - 2
    );
    frag.angularVelocity = (Math.random() - 0.5) * 15;
    frag._isFragment = true;
    frag._fragmentLife = 5 + Math.random() * 3; // Fragments fade after 5-8 seconds
    
    fragments.push(frag);
  }
  
  // Remove original body
  world.remove(body);
  if (state.selected === body) state.selected = null;
  
  // Play destruction sound
  AudioFx.slice();
  
  return fragments;
}

// Update fragment lifetimes and fade them out
function updateFragments(dt) {
  if (!state.destructionMode) return;
  
  for (const body of [...world.bodies]) {
    if (body._isFragment) {
      body._fragmentLife -= dt;
      if (body._fragmentLife <= 0) {
        world.remove(body);
      } else if (body._fragmentLife < 1) {
        // Fade out - shrink the fragment
        const scale = body._fragmentLife;
        body.width *= 0.98;
        body.height *= 0.98;
      }
    }
  }
}

/* =========================== MATERIALS SYSTEM =========================== */
const MATERIALS = {
  default: { density: 1, friction: 0.3, restitution: 0.4, color: null, name: 'Default' },
  rubber: { density: 1.2, friction: 0.9, restitution: 0.85, color: '#ff6b9d', name: 'Rubber' },
  ice: { density: 0.9, friction: 0.02, restitution: 0.1, color: '#88ddff', name: 'Ice' },
  metal: { density: 7.8, friction: 0.5, restitution: 0.2, color: '#9ba8c0', name: 'Metal' },
  wood: { density: 0.6, friction: 0.6, restitution: 0.3, color: '#c49a6c', name: 'Wood' },
  bouncy: { density: 0.8, friction: 0.4, restitution: 0.95, color: '#00e5a0', name: 'Bouncy' },
  heavy: { density: 15, friction: 0.7, restitution: 0.1, color: '#5a5a6e', name: 'Heavy' },
  light: { density: 0.2, friction: 0.3, restitution: 0.5, color: '#ffeaa7', name: 'Light' },
};

// Apply material to an existing body
function applyMaterialToBody(body, materialKey) {
  if (!body || body.isStatic) return false;
  const mat = MATERIALS[materialKey];
  if (!mat) return false;
  
  // Store original area for mass recalculation
  const area = body.mass / (body.density || 1);
  
  // Apply material properties
  body.density = mat.density;
  body.mass = mat.density * area;
  body.invMass = body.mass > 0 ? 1 / body.mass : 0;
  body.friction = mat.friction;
  body.restitution = mat.restitution;
  
  // Apply color if material has one
  if (mat.color) {
    body.color = mat.color;
  }
  
  // Store material name on body
  body.materialName = materialKey;
  
  return true;
}

// Reset body to default material
function resetBodyMaterial(body) {
  return applyMaterialToBody(body, 'default');
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

// Prevent context menu on canvas for right-click material reset
canvas.addEventListener('contextmenu', (ev) => {
  if (state.activeMaterial) ev.preventDefault();
});

canvas.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  canvas.setPointerCapture(ev.pointerId);
  const cp = canvasPos(ev);
  const wp = screenToWorld(cp.x, cp.y);
  const body = world.bodyAt(wp);
  
  // Material applicator mode - apply on left click, reset on right click
  if (state.activeMaterial && body && !body.isStatic && !walls.includes(body)) {
    if (ev.pointerType === 'mouse' && ev.button === 2) {
      // Right-click: reset to default and deselect material
      resetBodyMaterial(body);
      state.activeMaterial = null;
      document.querySelectorAll('.material').forEach(e => e.classList.remove('active'));
      AudioFx.toggleOff();
      triggerHaptic('medium');
      return;
    } else if (ev.pointerType !== 'mouse' || ev.button === 0) {
      // Left-click: apply selected material
      applyMaterialToBody(body, state.activeMaterial);
      AudioFx.spawn();
      triggerHaptic('light');
      return;
    }
  }
  
  if (ev.pointerType === 'mouse' && ev.button !== 0) return;

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
  if (state.dragStart) state.dragCurrent = cp;
  if (state.grabConstraint) {
    // move grab anchor
    state.grabAnchor.position = wp;
  }
  if (state.springStart) state.dragCurrent = cp;
  if (state.impulseBody) state.impulseEnd = cp;
  if (state.slicePath) {
    const prev = state.slicePath[state.slicePath.length - 1];
    state.slicePath.push({ x: cp.x, y: cp.y });
    sliceAlong(prev, cp);
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
    const j = new Vec2(dx, dy).mul(state.impulseBody.mass * 6);
    state.impulseBody.applyImpulse(j, screenToWorld(state.impulseStart.x, state.impulseStart.y));
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
  // Apply grab strength multiplier (1-5 range)
  const strength = state.grabStrength;
  const f = 3 * strength;       // Hz — target oscillation frequency (scales with strength)
  const zeta = 0.7 + strength * 0.1;  // damping ratio
  const omega = 2 * Math.PI * f;
  const k = body.mass * omega * omega * strength;
  const c = 2 * body.mass * omega * zeta;
  // Scale max force with strength - allows more forceful throws
  const maxForce = body.mass * 500 * strength;
  state.grabConstraint = new DistanceConstraint(body, state.grabAnchor, localBody, new Vec2(0, 0), {
    isSpring: true, springK: k, damping: c, length: 0, dampAllAxes: true, maxForce
  });
  world.constraints.push(state.grabConstraint);
  state.grabVelocityHistory = []; // Reset velocity tracking
}
function endGrab() {
  const releasedBody = state.grabBody;
  let releaseVelocity = 0;
  
  if (state.grabConstraint) {
    const i = world.constraints.indexOf(state.grabConstraint);
    if (i >= 0) world.constraints.splice(i, 1);
  }
  
  // Calculate release velocity from history
  if (releasedBody && state.grabVelocityHistory.length > 1) {
    releaseVelocity = releasedBody.velocity.length();
    // Also check velocity history for peak velocity during drag
    const maxHistoryVel = Math.max(...state.grabVelocityHistory);
    releaseVelocity = Math.max(releaseVelocity, maxHistoryVel * 0.8);
  }
  
  if (releasedBody) releasedBody.gravityScale = state.grabPrevGravityScale ?? 1;
  
  // Check for high-velocity throw destruction
  if (state.destructionMode && releasedBody && releaseVelocity > DESTRUCTION_THRESHOLD * 0.7) {
    // Mark for destruction on next collision, or destroy immediately if thrown very fast
    releasedBody._thrownVelocity = releaseVelocity;
    if (releaseVelocity > DESTRUCTION_THRESHOLD * 1.5) {
      // Very fast throw - destroy on any collision
      releasedBody._destroyOnImpact = true;
    }
  }
  
  state.grabBody = null; state.grabAnchor = null; state.grabConstraint = null;
  state.grabPrevGravityScale = null;
  state.grabVelocityHistory = [];
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

function finishSpawn(start, end) {
  const ws = screenToWorld(start.x, start.y);
  const we = screenToWorld(end.x, end.y);
  const dx = we.x - ws.x, dy = we.y - ws.y;
  const dragLen = Math.hypot(dx, dy);
  const maxSize = getMaxObjectSize();

  switch (state.tool) {
    case 'box': {
      const w = Math.min(maxSize.dimension, Math.max(0.5, Math.abs(dx) * 2 || 1.0));
      const h = Math.min(maxSize.dimension, Math.max(0.5, Math.abs(dy) * 2 || 1.0));
      const cx = (ws.x + we.x) / 2, cy = (ws.y + we.y) / 2;
      const b = world.add(makeBox(cx, cy, w, h, { color: pickSpawnColor() }));
      state.selected = b;
      world.emit({ type: 'spawn', body: b });
      break;
    }
    case 'circle': {
      const r = Math.min(maxSize.radius, Math.max(0.25, dragLen / 2 || 0.5));
      const cx = (ws.x + we.x) / 2, cy = (ws.y + we.y) / 2;
      const b = world.add(makeCircle(cx, cy, r, { color: pickSpawnColor() }));
      state.selected = b;
      world.emit({ type: 'spawn', body: b });
      break;
    }
    case 'polygon': {
      const r = Math.min(maxSize.radius, Math.max(0.3, dragLen / 2 || 0.6));
      const sides = 5 + ((Math.random() * 4) | 0);
      const cx = (ws.x + we.x) / 2, cy = (ws.y + we.y) / 2;
      const b = world.add(makePolygon(cx, cy, sides, r, { color: pickSpawnColor() }));
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
      const b = world.add(makePolygon(cx, cy, 3, r, { color: pickSpawnColor() }));
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
ui.gravity.addEventListener('input', () => {
  world.gravity = parseFloat(ui.gravity.value);
  ui.gravityVal.textContent = world.gravity.toFixed(2);
});
ui.timeScale.addEventListener('input', () => {
  state.timeScale = parseFloat(ui.timeScale.value);
  ui.timeVal.textContent = state.timeScale.toFixed(2);
});
ui.pauseBtn.addEventListener('click', () => {
  state.paused = !state.paused;
  ui.pauseBtn.textContent = state.paused ? '▶' : '⏸';
});
ui.resetBtn.addEventListener('click', () => loadPreset('default'));
ui.clearBtn.addEventListener('click', () => {
  world.clear(); rebuildBoundaries(); state.selected = null; state.trails.clear();
  world.gravity = parseFloat(ui.gravity.value);
  world.preSubstep = null;
});

// tool buttons with haptic feedback
document.querySelectorAll('.tool').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.tool').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
    state.tool = el.dataset.tool;
    // Deselect material applicator when switching tools
    state.activeMaterial = null;
    document.querySelectorAll('.material').forEach(e => e.classList.remove('active'));
    triggerHaptic('light');
  });
});

// Material applicator - click to select, click again to deselect
document.querySelectorAll('.material').forEach(el => {
  el.addEventListener('click', () => {
    const matKey = el.dataset.material;
    
    // Toggle: if same material clicked, deselect
    if (state.activeMaterial === matKey) {
      state.activeMaterial = null;
      el.classList.remove('active');
      AudioFx.toggleOff();
    } else {
      // Deselect previous and select new
      document.querySelectorAll('.material').forEach(e => e.classList.remove('active'));
      el.classList.add('active');
      state.activeMaterial = matKey;
      AudioFx.toolSelect();
    }
    triggerHaptic('light');
  });
});

// Destruction mode toggle
if (ui.destructionMode) {
ui.destructionMode.addEventListener('change', () => {
    state.destructionMode = ui.destructionMode.checked;
    triggerHaptic(state.destructionMode ? 'medium' : 'light');
    if (state.destructionMode) {
      AudioFx.slice();
    }
  });
}

// Grab strength slider
if (ui.grabStrength) {
  ui.grabStrength.addEventListener('input', () => {
    state.grabStrength = parseFloat(ui.grabStrength.value);
    // Update existing grab constraint if one exists
    if (state.grabConstraint && state.grabBody) {
      const body = state.grabBody;
      const strength = state.grabStrength;
      const f = 3 * strength;
      const zeta = 0.7 + strength * 0.1;
      const omega = 2 * Math.PI * f;
      state.grabConstraint.springK = body.mass * omega * omega * strength;
      state.grabConstraint.damping = 2 * body.mass * omega * zeta;
      state.grabConstraint.maxForce = body.mass * 500 * strength;
    }
  });
}

// presets with haptic
document.querySelectorAll('.preset').forEach(el => {
  el.addEventListener('click', () => {
    loadPreset(el.dataset.preset);
    world.emit({ type: 'preset', name: el.dataset.preset });
    triggerHaptic('double');
  });
});

// level selection with haptic
document.querySelectorAll('#levelSegment .seg').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('#levelSegment .seg').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
    educator.setLevel(parseInt(el.dataset.level, 10));
    triggerHaptic('light');
  });
});

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
  
  // Prevent flicker on hover by adding interacting class
  divider.addEventListener('pointerenter', () => {
    document.body.classList.add('interacting');
  });
  
  divider.addEventListener('pointerleave', () => {
    if (!dragging) {
      document.body.classList.remove('interacting');
    }
  });
  
  divider.addEventListener('pointerdown', (e) => {
    // Un-collapse tools when starting to drag
    if (toolsPanel.classList.contains('collapsed')) {
      toolsPanel.classList.remove('collapsed');
    }
    e.preventDefault();
    try { divider.setPointerCapture(e.pointerId); } catch (err) {}
    divider.classList.add('dragging');
    layoutEl.classList.add('resizing');
    document.body.classList.add('interacting');
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
    document.body.classList.remove('interacting');
    resize();
    triggerHaptic('medium');
    try { localStorage.setItem(storeKey, layoutEl.style.getPropertyValue(varName)); } catch (e) {}
  });
  
  divider.addEventListener('pointercancel', () => {
    if (!dragging) return;
    dragging = false;
    divider.classList.remove('dragging');
    layoutEl.classList.remove('resizing');
    document.body.classList.remove('interacting');
  });
}

// Tools divider setup
const toolsDividerEl = document.getElementById('toolsDivider');
setupDivider(
  toolsDividerEl,
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
    document.body.classList.add('interacting');
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
    document.body.classList.remove('interacting');
    triggerHaptic('medium');
    try { localStorage.setItem('ps.topbarHeight', topbar.style.minHeight); } catch (e) {}
  });
  
  topbarDivider.addEventListener('pointercancel', () => {
    if (!dragging) return;
    dragging = false;
    topbarDivider.classList.remove('dragging');
    topbar.classList.remove('resizing');
    document.body.classList.remove('interacting');
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
    // Toggle button with haptic
    this.toggle.addEventListener('click', () => {
      triggerHaptic('light');
      this.toggleVisibility();
    });
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => {
        triggerHaptic('light');
        this.hide();
      });
    }
    
    // Opacity slider
    if (this.opacitySlider) {
      this.opacitySlider.addEventListener('input', () => {
        this.setOpacity(parseFloat(this.opacitySlider.value));
      });
    }
    
    // Glass mode toggle
    if (this.glassToggle) {
      this.glassToggle.addEventListener('click', () => {
        triggerHaptic('light');
        this.toggleGlassMode();
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
    this.saveState();
  }
  
  hide() {
    if (this.inertiaRAF) cancelAnimationFrame(this.inertiaRAF);
    this.el.classList.remove('visible');
    this.toggle.classList.remove('active');
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
      
      if (x < 0) { x = 0; this.drag.velocityX *= -0.3; triggerHaptic('light'); }
      if (x > maxX) { x = maxX; this.drag.velocityX *= -0.3; triggerHaptic('light'); }
      if (y < 0) { y = 0; this.drag.velocityY *= -0.3; triggerHaptic('light'); }
      if (y > maxY) { y = maxY; this.drag.velocityY *= -0.3; triggerHaptic('light'); }
      
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
const ovMaterial = document.getElementById('ov-material');
const ovMass = document.getElementById('ov-mass');
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
    if (ovMaterial) { ovMaterial.textContent = '—'; ovMaterial.style.color = ''; }
    if (ovMass) ovMass.textContent = '0';
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
  
  // Determine shape name
  let shapeName = 'Box';
  if (b.shape === SHAPE.CIRCLE) shapeName = 'Ball';
  else if (b.shape === SHAPE.POLYGON && b.vertices?.length === 3) shapeName = 'Triangle';
  else if (b.shape === SHAPE.POLYGON) shapeName = 'Polygon';
  
  // Get material name (capitalize first letter)
  const matKey = b.materialName || 'default';
  const matData = MATERIALS[matKey];
  const displayMatName = matData?.name || (matKey.charAt(0).toUpperCase() + matKey.slice(1));
  
  if (ovSelected) ovSelected.textContent = shapeName;
  if (ovMaterial) {
    ovMaterial.textContent = displayMatName;
    ovMaterial.style.color = matData?.color || '';
  }
  if (ovMass) ovMass.textContent = b.mass.toFixed(2);
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
      
      // Track velocity for throw detection
      const vel = state.grabBody.velocity.length();
      state.grabVelocityHistory.push(vel);
      // Keep only last 10 samples
      if (state.grabVelocityHistory.length > 10) state.grabVelocityHistory.shift();
    }
    world.step(rawDt * state.timeScale);
    sampleEnvironment(now);
    updateTrails();
    updateFragments(rawDt);
  }
render();
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
