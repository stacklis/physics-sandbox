// app3d.js — 3D mode entry. Smoke version: empty scene + single test cube.
'use strict';
import { World, makeCube, makeWall, _ready } from './engine3d.js?v=66';
import { Renderer3D } from './render3d.js?v=66';

let world, renderer, raf, lastT;

export async function init3D({ canvas, hostEl }) {
  await _ready;
  world = new World({ gravity: { x: 0, y: -9.81, z: 0 }, maxDynamicBodies: 80 });
  renderer = new Renderer3D({ canvas, hostEl });

  // Floor as a Rapier static body (mirrors the visible floor mesh).
  const floor = world.addBody(makeWall({ position: { x: 0, y: -0.2, z: 0 }, size: { x: 16, y: 0.4, z: 2 } }));
  // Don't draw the floor mesh — already drawn by Renderer3D._buildPlayfield.

  // Test cube to confirm physics + render are coupled.
  const cube = world.addBody(makeCube({ position: { x: 0, y: 6, z: 0 }, size: 1, color: '#00e5a0' }));
  renderer.addBodyMesh(cube);

  lastT = performance.now();
  loop();
  return { world, renderer };
}

function loop() {
  // Guard: a queued frame could fire after teardown nulls the globals.
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
