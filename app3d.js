// app3d.js — 3D mode: input, drag-spawn, basic action tools, main loop.
'use strict';
import * as THREE from 'three';
import { World, makeCube, makeSphere, makeCylinder, makeCapsule, makePrism, makeWall, _ready } from './engine3d.js?v=71';
import { Renderer3D } from './render3d.js?v=71';
import { getConcept } from './education3d.js?v=71';

const PALETTE = ['#00e5a0', '#ff6b9d', '#6b8bff', '#ffc46a', '#00ffc8', '#ff8bb8', '#a0ffdb', '#ffb366', '#c9a0ff'];
let palIdx = 0;
const nextColor = () => { palIdx = (palIdx + 1) % PALETTE.length; return PALETTE[palIdx]; };

let lastConceptShownAt = 0;
function showConcept(key) {
  const now = performance.now();
  if (now - lastConceptShownAt < 4000) return; // 4 s cooldown
  lastConceptShownAt = now;
  const lvlBtn = document.querySelector('#levelSegment .seg.active');
  const level = lvlBtn ? Number(lvlBtn.dataset.level) || 1 : 1;
  const c = getConcept(key, level);
  if (!c) return;
  toast(`${c.title} — ${c.body}`);
}

let world, renderer, raf, lastT;
let canvas, hostEl;
let tool = 'grab';
let dragStart = null, dragNow = null; // screen px
const SPAWN_Y = 3; // height above floor where objects spawn
let grabbed = null, grabOffset = null, grabPlane = null;
let selectedBody = null;
let pointerDownTime = 0, pointerDownPos = null;

export async function init3D(opts) {
  canvas = opts.canvas; hostEl = opts.hostEl;
  await _ready;
  world = new World({ gravity: { x: 0, y: -9.81, z: 0 }, maxDynamicBodies: 80 });
  renderer = new Renderer3D({ canvas, hostEl });

  // Static playfield — matches render3d.js dimensions (D=50, floorZ=5).
  const W = renderer.playfield.W, H = renderer.playfield.H, D = renderer.playfield.D;
  const FZ = 5; // must match floorZ in render3d.js
  world.addBody(makeWall({ position: { x: 0, y: -0.2, z: FZ }, size: { x: W, y: 0.4, z: D } }));
  world.addBody(makeWall({ position: { x: -W / 2 - 0.15, y: H / 2, z: FZ }, size: { x: 0.3, y: H, z: D } }));
  world.addBody(makeWall({ position: { x:  W / 2 + 0.15, y: H / 2, z: FZ }, size: { x: 0.3, y: H, z: D } }));

  bindToolbar();
  bindCanvas();

  lastT = performance.now();
  loop();
  return { world, renderer };
}

function bindToolbar() {
  document.querySelectorAll('[data-tool3d]').forEach(el => {
    el.addEventListener('click', () => {
      tool = el.dataset.tool3d;
      document.querySelectorAll('[data-tool3d]').forEach(b => b.classList.toggle('active', b === el));
    });
  });
}

function bindCanvas() {
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('contextmenu', e => e.preventDefault()); // suppress browser right-click menu
}

// Project a screen point onto a horizontal Y-plane (default y=2, above the floor).
// Spawning on a Y-plane means x/z come from where the user points,
// and the spawn height is always above the floor — objects fall correctly
// regardless of camera angle.
function screenToWorldOnPlane(ev, spawnY = 2) {
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((ev.clientX - r.left) / r.width) * 2 - 1,
    -((ev.clientY - r.top) / r.height) * 2 + 1
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, renderer.camera);
  // Horizontal plane at y = spawnY
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -spawnY);
  const out = new THREE.Vector3();
  if (!ray.ray.intersectPlane(plane, out)) {
    // Ray parallel to plane (camera horizontal) — fall back to a point 12 units ahead
    ray.ray.at(12, out);
    out.y = spawnY;
  }
  return out;
}

function pickBody(ev) {
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((ev.clientX - r.left) / r.width) * 2 - 1,
    -((ev.clientY - r.top) / r.height) * 2 + 1
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, renderer.camera);
  const meshes = [...renderer.bodyMeshes.values()];
  const hits = ray.intersectObjects(meshes, false);
  if (!hits.length) return null;
  const mesh = hits[0].object;
  for (const [rb, m] of renderer.bodyMeshes) if (m === mesh) return rb;
  return null;
}

function onDown(ev) {
  // Track pointer-down for tap detection on both left (select) and right (revert to grab).
  if (ev.button === 0 || ev.button === 2) {
    pointerDownTime = performance.now();
    pointerDownPos = { x: ev.clientX, y: ev.clientY };
  }
  if (tool === 'delete') {
    const rb = pickBody(ev);
    if (rb) {
      if (rb === selectedBody) selectedBody = null;
      renderer.removeBodyMesh(rb);
      world.removeBody(rb);
    }
    return;
  }
  if (tool === 'grab') {
    const rb = pickBody(ev);
    if (rb && !rb.isFixed()) {
      grabbed = rb;
      const t = rb.translation();
      grabPlane = t.z;
      const cursor = screenToWorldOnPlane(ev, grabPlane);
      grabOffset = { x: t.x - cursor.x, y: t.y - cursor.y };
      rb.setLinearDamping(8.0);
    }
    return;
  }
  // Spawn tool — start a drag.
  dragStart = { x: ev.clientX, y: ev.clientY };
  dragNow = { x: ev.clientX, y: ev.clientY };
}

function onMove(ev) {
  if (grabbed) {
    const cur = screenToWorldOnPlane(ev, grabPlane);
    const target = new THREE.Vector3(cur.x + grabOffset.x, cur.y + grabOffset.y, grabPlane);
    const t = grabbed.translation();
    const f = 60; // proportional grab spring
    grabbed.setLinvel({
      x: (target.x - t.x) * f,
      y: (target.y - t.y) * f,
      z: (target.z - t.z) * f,
    }, true);
    return;
  }
  if (dragStart) dragNow = { x: ev.clientX, y: ev.clientY };
}

function onUp(ev) {
  if (grabbed) {
    grabbed.setLinearDamping(0.05);
    grabbed = null; grabOffset = null;
    return;
  }

  // Tap detection: < 250 ms, < 5 px movement.
  if (pointerDownPos) {
    const elapsed = performance.now() - pointerDownTime;
    const moved = Math.hypot(ev.clientX - pointerDownPos.x, ev.clientY - pointerDownPos.y);
    if (elapsed < 250 && moved < 5) {
      if (ev.button === 0) {
        // Left tap → select body for live readings.
        const rb = pickBody(ev);
        selectedBody = rb || null;
        highlightSelected();
      } else if (ev.button === 2) {
        // Right tap → revert to grab tool.
        const btn = document.querySelector('.tool[data-tool3d="grab"]');
        if (btn) btn.click();
      }
    }
    pointerDownPos = null;
  }

  if (!dragStart) return;
  // Project drag onto the horizontal spawn plane — x/z from screen, y fixed above floor.
  const start = screenToWorldOnPlane({ clientX: dragStart.x, clientY: dragStart.y }, SPAWN_Y);
  const end   = screenToWorldOnPlane({ clientX: ev.clientX, clientY: ev.clientY }, SPAWN_Y);
  const dx = end.x - start.x, dz = end.z - start.z;
  const len = Math.hypot(dx, dz);
  const cx = (start.x + end.x) / 2, cz = (start.z + end.z) / 2;
  const pos = { x: cx, y: SPAWN_Y, z: cz };
  try {
    let spec;
    switch (tool) {
      case 'cube': {
        const size = Math.max(0.3, Math.min(3, len || 0.6));
        spec = makeCube({ position: pos, size, color: nextColor() });
        break;
      }
      case 'sphere': {
        const radius = Math.max(0.2, Math.min(1.5, len / 2 || 0.4));
        spec = makeSphere({ position: pos, radius, color: nextColor() });
        break;
      }
      case 'cylinder': {
        const radius = Math.max(0.2, Math.min(1.2, len / 2 || 0.4));
        spec = makeCylinder({ position: pos, radius, halfHeight: radius * 1.2, color: nextColor() });
        break;
      }
      case 'capsule': {
        const radius = Math.max(0.15, Math.min(0.8, len / 3 || 0.3));
        spec = makeCapsule({ position: pos, radius, halfHeight: radius * 1.5, color: nextColor() });
        break;
      }
      case 'prism': {
        const radius = Math.max(0.25, Math.min(1.5, len / 2 || 0.5));
        const sides = 5 + ((Math.random() * 4) | 0);
        spec = makePrism({ position: pos, sides, radius, depth: Math.max(0.3, radius * 0.8), color: nextColor() });
        break;
      }
      case 'wall': {
        const w = Math.max(0.5, Math.min(10, Math.abs(dx) || 3));
        const h = Math.max(0.3, Math.min(5, Math.abs(dz) || 0.5));
        spec = makeWall({ position: pos, size: { x: w, y: 1.5, z: h } });
        break;
      }
    }
    if (spec) {
      const rb = world.addBody(spec);
      renderer.addBodyMesh(rb);
      showConcept('contactRestitution3D');
    }
  } catch (e) {
    if (/body cap/.test(e.message)) toast('Body cap reached (80). Delete some objects first.');
    else console.error(e);
  }
  dragStart = null; dragNow = null;
}

function toast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:#222;color:#fff;padding:8px 14px;border-radius:6px;z-index:9999;font:13px system-ui';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function highlightSelected() {
  if (!renderer) return;
  for (const [rb, mesh] of renderer.bodyMeshes) {
    if (!mesh.material) continue;
    if (rb === selectedBody) {
      mesh.material.emissive = new THREE.Color(0x334455);
    } else {
      mesh.material.emissive = new THREE.Color(0x000000);
    }
  }
}

function fmt(n, d = 2) { return Number.isFinite(n) ? n.toFixed(d) : '0'; }

function updateReadings() {
  const sel = document.getElementById('ov-selected');
  const mass = document.getElementById('ov-mass');
  const speed = document.getElementById('ov-speed');
  const ke = document.getElementById('ov-ke');
  const pe = document.getElementById('ov-pe');
  const momentum = document.getElementById('ov-momentum');
  const angular = document.getElementById('ov-angular');
  const count = document.getElementById('ov-count');
  const total = document.getElementById('ov-total');

  // Body count (dynamic only).
  let bodyCount = 0, systemKE = 0;
  if (world) {
    for (const rb of world.bodies) {
      if (rb.isFixed()) continue;
      bodyCount++;
      const v = rb.linvel();
      const spd = Math.hypot(v.x, v.y, v.z);
      systemKE += 0.5 * rb.mass() * spd * spd;
    }
  }
  if (count) count.textContent = bodyCount;
  if (total) total.textContent = fmt(systemKE);

  if (!selectedBody || !world) {
    if (sel) sel.textContent = '—';
    if (mass) mass.textContent = '0';
    if (speed) speed.textContent = '0';
    if (ke) ke.textContent = '0';
    if (pe) pe.textContent = '0';
    if (momentum) momentum.textContent = '0';
    if (angular) angular.textContent = '0';
    return;
  }

  const rb = selectedBody;
  const u = rb.userData || {};
  const m = rb.mass();
  const lv = rb.linvel();
  const av = rb.angvel();
  const t = rb.translation();
  const spd = Math.hypot(lv.x, lv.y, lv.z);
  const angSpd = Math.hypot(av.x, av.y, av.z);
  const kineticE = 0.5 * m * spd * spd;
  const potentialE = m * 9.81 * Math.max(0, t.y);
  const mom = m * spd;

  if (sel) sel.textContent = u.kind || '—';
  if (mass) mass.textContent = fmt(m);
  if (speed) speed.textContent = fmt(spd);
  if (ke) ke.textContent = fmt(kineticE);
  if (pe) pe.textContent = fmt(potentialE);
  if (momentum) momentum.textContent = fmt(mom);
  if (angular) angular.textContent = fmt(angSpd);
}

function loop() {
  if (!world || !renderer) return;
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  // Belt-and-braces: if a body somehow escapes the playfield, remove it.
  for (const rb of [...world.bodies]) {
    if (rb.isFixed()) continue;
    const t = rb.translation();
    if (Math.abs(t.x) > 50 || t.y < -20 || Math.abs(t.z) > 20) {
      renderer.removeBodyMesh(rb);
      world.removeBody(rb);
    }
  }
  world.step(dt);
  renderer.syncMeshes();
  renderer.render();
  updateReadings();
  raf = requestAnimationFrame(loop);
}

export function teardown3D() {
  if (raf) cancelAnimationFrame(raf);
  if (renderer) { renderer.dispose(); renderer = null; }
  if (world) { world.free(); world = null; }
  selectedBody = null;
}

const SCHEMA_3D = 'physics-sandbox/scene-3d/v1';

export function serialize3D() {
  const bodies = [];
  for (const rb of world.bodies) {
    if (rb.isFixed()) continue;
    const u = rb.userData || {};
    const t = rb.translation(), q = rb.rotation(), v = rb.linvel(), a = rb.angvel();
    const c = rb.collider(0);
    const entry = { kind: u.kind, color: u.color,
      position: [t.x, t.y, t.z], rotation: [q.x, q.y, q.z, q.w],
      velocity: [v.x, v.y, v.z], angularVelocity: [a.x, a.y, a.z] };
    switch (u.kind) {
      case 'cube':     { const he = c.halfExtents(); entry.size = he.x * 2; break; }
      case 'sphere':   { entry.radius = c.radius(); break; }
      case 'cylinder':
      case 'capsule':  { entry.radius = c.radius(); entry.halfHeight = c.halfHeight(); break; }
      case 'prism':    { entry.sides = u.sides; entry.radius = u.radius; entry.depth = u.depth; break; }
    }
    bodies.push(entry);
  }
  return {
    type: SCHEMA_3D,
    mode: '3d',
    createdAt: new Date().toISOString(),
    bodies,
  };
}

export function deserialize3D(json) {
  if (!json || json.type !== SCHEMA_3D) {
    throw new Error('Not a 3D scene file.');
  }
  selectedBody = null;
  // Wipe dynamic bodies (keep static playfield).
  for (const rb of [...world.bodies]) {
    if (!rb.isFixed()) {
      renderer.removeBodyMesh(rb);
      world.removeBody(rb);
    }
  }
  for (const b of json.bodies || []) {
    const pos = { x: b.position[0], y: b.position[1], z: b.position[2] };
    let spec;
    switch (b.kind) {
      case 'cube':     spec = makeCube({ position: pos, size: b.size, color: b.color }); break;
      case 'sphere':   spec = makeSphere({ position: pos, radius: b.radius, color: b.color }); break;
      case 'cylinder': spec = makeCylinder({ position: pos, radius: b.radius, halfHeight: b.halfHeight, color: b.color }); break;
      case 'capsule':  spec = makeCapsule({ position: pos, radius: b.radius, halfHeight: b.halfHeight, color: b.color }); break;
      case 'prism':    spec = makePrism({ position: pos, sides: b.sides, radius: b.radius, depth: b.depth, color: b.color }); break;
      default: continue;
    }
    const rb = world.addBody(spec);
    if (b.rotation) rb.setRotation({ x: b.rotation[0], y: b.rotation[1], z: b.rotation[2], w: b.rotation[3] }, true);
    if (b.velocity) rb.setLinvel({ x: b.velocity[0], y: b.velocity[1], z: b.velocity[2] }, true);
    if (b.angularVelocity) rb.setAngvel({ x: b.angularVelocity[0], y: b.angularVelocity[1], z: b.angularVelocity[2] }, true);
    renderer.addBodyMesh(rb);
  }
}
