import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, makeCube, makeSphere, makeCylinder, makeCapsule, makePrism, makeWall, _ready } from '../engine3d.js';

test('World steps under gravity', async () => {
  await _ready;
  const w = new World({ gravity: { x: 0, y: -9.81, z: 0 } });
  const cube = w.addBody(makeCube({ position: { x: 0, y: 5, z: 0 }, size: 1 }));
  for (let i = 0; i < 60; i++) w.step(1 / 60);
  const p = cube.translation();
  assert.ok(p.y < 5, `cube did not fall: y=${p.y}`);
});

test('Static wall does not fall', async () => {
  await _ready;
  const w = new World({ gravity: { x: 0, y: -9.81, z: 0 } });
  const wall = w.addBody(makeWall({ position: { x: 0, y: 0, z: 0 }, size: { x: 10, y: 0.5, z: 2 } }));
  for (let i = 0; i < 60; i++) w.step(1 / 60);
  const p = wall.translation();
  assert.equal(p.y, 0);
});

test('Body factories produce distinct shape kinds', async () => {
  await _ready;
  const w = new World({ gravity: { x: 0, y: 0, z: 0 } });
  const cube = w.addBody(makeCube({ position: { x: 0, y: 0, z: 0 }, size: 1 }));
  const sphere = w.addBody(makeSphere({ position: { x: 2, y: 0, z: 0 }, radius: 0.5 }));
  const cyl = w.addBody(makeCylinder({ position: { x: 4, y: 0, z: 0 }, radius: 0.4, halfHeight: 0.6 }));
  const cap = w.addBody(makeCapsule({ position: { x: 6, y: 0, z: 0 }, radius: 0.3, halfHeight: 0.5 }));
  const prism = w.addBody(makePrism({ position: { x: 8, y: 0, z: 0 }, sides: 5, radius: 0.5, depth: 0.6 }));
  assert.equal(cube.userData.kind, 'cube');
  assert.equal(sphere.userData.kind, 'sphere');
  assert.equal(cyl.userData.kind, 'cylinder');
  assert.equal(cap.userData.kind, 'capsule');
  assert.equal(prism.userData.kind, 'prism');
});

test('Removing a body cleans up', async () => {
  await _ready;
  const w = new World({ gravity: { x: 0, y: 0, z: 0 } });
  const cube = w.addBody(makeCube({ position: { x: 0, y: 0, z: 0 }, size: 1 }));
  assert.equal(w.bodies.size, 1);
  w.removeBody(cube);
  assert.equal(w.bodies.size, 0);
});

test('Body cap respected', async () => {
  await _ready;
  const w = new World({ gravity: { x: 0, y: 0, z: 0 }, maxDynamicBodies: 3 });
  for (let i = 0; i < 3; i++) w.addBody(makeCube({ position: { x: i, y: 0, z: 0 }, size: 0.5 }));
  assert.equal(w.atCap(), true);
  assert.throws(
    () => w.addBody(makeCube({ position: { x: 99, y: 0, z: 0 }, size: 0.5 })),
    /body cap/
  );
});
