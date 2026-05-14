import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PSandbox } from './_load-engine2d.mjs';

const { Vec2, World, SHAPE, makeBox, makeCircle, makePolygon, DistanceConstraint } = PSandbox;

test('Vec2 length and copy', () => {
  const v = new Vec2(3, 4);
  assert.equal(v.length(), 5);
  const c = v.copy();
  c.x = 99;
  assert.equal(v.x, 3, 'copy must be independent');
});

test('World steps a falling circle downward under positive gravity', () => {
  const w = new World({ gravity: 9.81 });
  const ball = w.add(makeCircle(0, 0, 0.5));
  const y0 = ball.position.y;
  for (let i = 0; i < 60; i++) w.step(1 / 60);
  assert.ok(ball.position.y > y0 + 0.1, `ball did not fall (y0=${y0} y=${ball.position.y})`);
});

test('Static box does not move under gravity', () => {
  const w = new World({ gravity: 9.81 });
  const wall = w.add(makeBox(0, 5, 4, 0.5, { isStatic: true }));
  for (let i = 0; i < 60; i++) w.step(1 / 60);
  assert.equal(wall.position.x, 0);
  assert.equal(wall.position.y, 5);
});

test('Body factories produce distinct shape kinds', () => {
  const box = makeBox(0, 0, 1, 1);
  const circle = makeCircle(0, 0, 0.5);
  const tri = makePolygon(0, 0, 3, 0.5);
  assert.equal(box.shape, SHAPE.POLYGON);
  assert.equal(circle.shape, SHAPE.CIRCLE);
  assert.equal(tri.shape, SHAPE.POLYGON);
  assert.equal(tri.localVertices.length, 3, 'triangle has 3 vertices');
});

test('World.remove drops the body and its constraints', () => {
  const w = new World({ gravity: 0 });
  const a = w.add(makeCircle(0, 0, 0.3));
  const b = w.add(makeCircle(2, 0, 0.3));
  w.addConstraint(new DistanceConstraint(a, b, new Vec2(), new Vec2()));
  assert.equal(w.bodies.length, 2);
  assert.equal(w.constraints.length, 1);
  w.remove(a);
  assert.equal(w.bodies.length, 1);
  assert.equal(w.constraints.length, 0, 'constraints touching removed body are filtered out');
});

test('maxLinearVelocity clamps a body that was given excessive velocity', () => {
  const w = new World({ gravity: 0 });
  const ball = w.add(makeCircle(0, 0, 0.3));
  // Inject 500 m/s — engine cap is 80.
  ball.velocity.x = 500;
  ball.velocity.y = 0;
  w.step(1 / 60);
  const speed = Math.hypot(ball.velocity.x, ball.velocity.y);
  assert.ok(speed <= w.maxLinearVelocity + 1e-3,
    `velocity not clamped: ${speed} m/s > ${w.maxLinearVelocity}`);
});

test('Thick walls contain a fast body across many steps (no tunneling)', () => {
  // Replicates the production wall geometry: t=4.0 thick walls at the edges.
  const w = new World({ gravity: 0 });
  const t = 4.0, halfSpan = 10;
  const left = w.add(makeBox(-halfSpan - t / 2, 0, t, halfSpan * 2 + t * 2, { isStatic: true }));
  const right = w.add(makeBox( halfSpan + t / 2, 0, t, halfSpan * 2 + t * 2, { isStatic: true }));
  const top = w.add(makeBox(0, -halfSpan - t / 2, halfSpan * 2 + t * 2, t, { isStatic: true }));
  const bottom = w.add(makeBox(0, halfSpan + t / 2, halfSpan * 2 + t * 2, t, { isStatic: true }));
  const ball = w.add(makeCircle(0, 0, 0.4));
  // Start at the engine cap, aimed diagonally.
  ball.velocity.x = w.maxLinearVelocity;
  ball.velocity.y = w.maxLinearVelocity;
  for (let i = 0; i < 600; i++) w.step(1 / 60); // 10 seconds at 60Hz
  assert.ok(Math.abs(ball.position.x) <= halfSpan + 0.5,
    `ball escaped on X: ${ball.position.x}`);
  assert.ok(Math.abs(ball.position.y) <= halfSpan + 0.5,
    `ball escaped on Y: ${ball.position.y}`);
});

test('DistanceConstraint holds two bodies near their target distance under gravity', () => {
  const w = new World({ gravity: 9.81 });
  const anchor = w.add(makeBox(0, 0, 1, 1, { isStatic: true }));
  const ball = w.add(makeCircle(0, 2, 0.3));
  w.addConstraint(new DistanceConstraint(
    anchor, ball,
    new Vec2(0, 0), new Vec2(0, 0),
    { length: 2, stiffness: 0.95 }
  ));
  for (let i = 0; i < 240; i++) w.step(1 / 60); // 4 seconds — long enough to settle
  const d = Math.hypot(ball.position.x - anchor.position.x, ball.position.y - anchor.position.y);
  // Soft constraint, so allow ±25% of target distance.
  assert.ok(d > 1.5 && d < 2.5, `pendulum distance drifted: ${d} (target=2)`);
});
