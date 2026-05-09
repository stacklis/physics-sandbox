// app3d.js — 3D mode: input, drag-spawn, basic action tools, main loop.
'use strict';
import * as THREE from 'three';
import { World, makeCube, makeSphere, makeCylinder, makeCapsule, makePrism, makeWall, _ready } from './engine3d.js?v=66';
import { Renderer3D } from './render3d.js?v=66';
import { getConcept } from './education3d.js?v=66';

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
let dragSpawnZ = 0;
let grabbed = null, grabOffset = null, grabPlane = null;

export async function init3D(opts) {
  canvas = opts.canvas; hostEl = opts.hostEl;
  await _ready;
  world = new World({ gravity: { x: 0, y: -9.81, z: 0 }, maxDynamicBodies: 80 });
  renderer = new Renderer3D({ canvas, hostEl });

  // Static playfield — floor + side walls + invisible Z-clamps.
  const W = renderer.playfield.W, H = renderer.playfield.H, D = renderer.playfield.D;
  world.addBody(makeWall({ position: { x: 0, y: -0.2, z: 0 }, size: { x: W, y: 0.4, z: D + 1 } }));
  world.addBody(makeWall({ position: { x: -W / 2 - 0.2, y: H / 2, z: 0 }, size: { x: 0.4, y: H, z: D + 1 } }));
  world.addBody(makeWall({ position: { x: W / 2 + 0.2, y: H / 2, z: 0 }, size: { x: 0.4, y: H, z: D + 1 } }));
  world.addBody(makeWall({ position: { x: 0, y: H / 2, z: -D / 2 - 0.2 }, size: { x: W + 1, y: H, z: 0.4 } })); // back
  world.addBody(makeWall({ position: { x: 0, y: H / 2, z: D / 2 + 0.2 }, size: { x: W + 1, y: H, z: 0.4 } })); // front (invisible)

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
}

function screenToWorldOnPlane(ev, planeZ = 0) {
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((ev.clientX - r.left) / r.width) * 2 - 1,
    -((ev.clientY - r.top) / r.height) * 2 + 1
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, renderer.camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);
  const out = new THREE.Vector3();
  ray.ray.intersectPlane(plane, out);
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
  if (tool === 'delete') {
    const rb = pickBody(ev);
    if (rb) {
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
  if (!dragStart) return;
  const start = screenToWorldOnPlane({ clientX: dragStart.x, clientY: dragStart.y }, dragSpawnZ);
  const end = screenToWorldOnPlane({ clientX: ev.clientX, clientY: ev.clientY }, dragSpawnZ);
  const dx = end.x - start.x, dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2;
  const jitter = (Math.random() - 0.5) * 0.1;
  const pos = { x: cx, y: cy, z: dragSpawnZ + jitter };
  try {
    let spec;
    switch (tool) {
      case 'cube': {
        const size = Math.max(0.3, Math.min(3, Math.max(Math.abs(dx), Math.abs(dy)) || 0.6));
        spec = makeCube({ position: pos, size, color: nextColor() });
        break;
      }
      case 'sphere': {
        const radius = Math.max(0.2, Math.min(1.5, len / 2 || 0.4));
        spec = makeSphere({ position: pos, radius, color: nextColor() });
        break;
      }
      case 'cylinder': {
        const radius = Math.max(0.2, Math.min(1.2, Math.abs(dx) / 2 || 0.4));
        const half = Math.max(0.2, Math.min(1.5, Math.abs(dy) / 2 || 0.5));
        spec = makeCylinder({ position: pos, radius, halfHeight: half, color: nextColor() });
        break;
      }
      case 'capsule': {
        const radius = Math.max(0.15, Math.min(0.8, Math.abs(dx) / 2 || 0.3));
        const half = Math.max(0.2, Math.min(1.5, Math.abs(dy) / 2 || 0.5));
        spec = makeCapsule({ position: pos, radius, halfHeight: half, color: nextColor() });
        break;
      }
      case 'prism': {
        const radius = Math.max(0.25, Math.min(1.5, len / 2 || 0.5));
        const sides = 5 + ((Math.random() * 4) | 0);
        spec = makePrism({ position: pos, sides, radius, depth: 0.5, color: nextColor() });
        break;
      }
      case 'wall': {
        const w = Math.max(0.5, Math.min(8, Math.abs(dx) || 2));
        const h = Math.max(0.2, Math.min(4, Math.abs(dy) || 0.4));
        spec = makeWall({ position: pos, size: { x: w, y: h, z: 0.6 } });
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

function loop() {
  if (!world || !renderer) return;
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  world.step(dt);
  renderer.syncMeshes();
  renderer.render();
  raf = requestAnimationFrame(loop);
}

export function teardown3D() {
  if (raf) cancelAnimationFrame(raf);
  if (renderer) { renderer.dispose(); renderer = null; }
  if (world) { world.free(); world = null; }
}
