// engine3d.js — Rapier3D wrapper for Physics Sandbox 3D mode.
// Resolves '@dimforge/rapier3d-compat' via the importmap (browser) or
// node_modules (Node tests). The bare specifier is the single source of
// truth for the URL/version.
'use strict';

let _RAPIER_PROMISE = null;
async function loadRapier() {
  if (!_RAPIER_PROMISE) {
    _RAPIER_PROMISE = (async () => {
      const mod = await import('@dimforge/rapier3d-compat');
      await mod.init();
      return mod;
    })();
  }
  return _RAPIER_PROMISE;
}
export const _ready = loadRapier();

let RAPIER = null;
_ready.then(r => { RAPIER = r; });

/* ============================== World ============================== */

export class World {
  constructor({ gravity = { x: 0, y: -9.81, z: 0 }, maxDynamicBodies = 80 } = {}) {
    if (!RAPIER) throw new Error('engine3d: await _ready before constructing World');
    this._w = new RAPIER.World(gravity);
    this._w.timestep = 1 / 60;
    this.bodies = new Set();
    this.maxDynamicBodies = maxDynamicBodies;
  }
  addBody(spec) {
    if (!spec.isStatic && this.atCap()) {
      throw new Error('body cap reached');
    }
    const desc = spec.isStatic
      ? RAPIER.RigidBodyDesc.fixed()
      : RAPIER.RigidBodyDesc.dynamic();
    desc.setTranslation(spec.position.x, spec.position.y, spec.position.z);
    if (spec.rotation) desc.setRotation(spec.rotation);
    const rb = this._w.createRigidBody(desc);
    rb.userData = {
      kind: spec.kind,
      color: spec.color || randomColor(),
      sides: spec.sides,
      radius: spec.radius,
      depth: spec.depth,
    };
    for (const c of spec.colliders) {
      const cd = c.collider;
      if (spec.density != null) cd.setDensity(spec.density);
      if (spec.friction != null) cd.setFriction(spec.friction);
      if (spec.restitution != null) cd.setRestitution(spec.restitution);
      this._w.createCollider(cd, rb);
    }
    this.bodies.add(rb);
    return rb;
  }
  removeBody(rb) {
    this._w.removeRigidBody(rb);
    this.bodies.delete(rb);
  }
  step(dt) {
    if (dt && dt > 0) this._w.timestep = dt;
    this._w.step();
  }
  atCap() {
    let dyn = 0;
    for (const b of this.bodies) if (!b.isFixed()) dyn++;
    return dyn >= this.maxDynamicBodies;
  }
  setGravity(g) {
    this._w.gravity = g;
  }
  free() {
    this._w.free();
    this.bodies.clear();
  }
}

/* ============================== Body factories ============================== */
// Each factory returns a "spec" object: { kind, position, rotation, colliders, isStatic, ...material }.
// World.addBody() consumes specs.

export function makeCube({ position, size = 1, isStatic = false, density, friction, restitution, color }) {
  const h = size / 2;
  return {
    kind: 'cube', position, isStatic, density, friction, restitution, color,
    colliders: [{ collider: RAPIER.ColliderDesc.cuboid(h, h, h) }],
  };
}

export function makeSphere({ position, radius = 0.5, isStatic = false, density, friction, restitution, color }) {
  return {
    kind: 'sphere', position, isStatic, density, friction, restitution, color,
    colliders: [{ collider: RAPIER.ColliderDesc.ball(radius) }],
  };
}

export function makeCylinder({ position, radius = 0.5, halfHeight = 0.5, isStatic = false, density, friction, restitution, color }) {
  return {
    kind: 'cylinder', position, isStatic, density, friction, restitution, color,
    // Rapier cylinder axis is +Y by default — matches our spec (vertical drum).
    colliders: [{ collider: RAPIER.ColliderDesc.cylinder(halfHeight, radius) }],
  };
}

export function makeCapsule({ position, radius = 0.3, halfHeight = 0.5, isStatic = false, density, friction, restitution, color }) {
  return {
    kind: 'capsule', position, isStatic, density, friction, restitution, color,
    colliders: [{ collider: RAPIER.ColliderDesc.capsule(halfHeight, radius) }],
  };
}

export function makePrism({ position, sides = 5, radius = 0.5, depth = 0.5, isStatic = false, density, friction, restitution, color }) {
  // Build an extruded n-gon as a convex hull of 2*sides points.
  const verts = new Float32Array(sides * 2 * 3);
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    verts[(i * 2) * 3 + 0] = x; verts[(i * 2) * 3 + 1] = y; verts[(i * 2) * 3 + 2] = -depth / 2;
    verts[(i * 2 + 1) * 3 + 0] = x; verts[(i * 2 + 1) * 3 + 1] = y; verts[(i * 2 + 1) * 3 + 2] = depth / 2;
  }
  return {
    kind: 'prism', position, isStatic, density, friction, restitution, color,
    sides, radius, depth,
    colliders: [{ collider: RAPIER.ColliderDesc.convexHull(verts) }],
  };
}

export function makeWall({ position, size = { x: 4, y: 0.5, z: 2 }, color }) {
  return {
    kind: 'wall', position, isStatic: true, color,
    colliders: [{ collider: RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2) }],
  };
}

/* ============================== helpers ============================== */
const PALETTE = ['#00e5a0', '#ff6b9d', '#6b8bff', '#ffc46a', '#00ffc8', '#ff8bb8', '#a0ffdb', '#ffb366', '#c9a0ff'];
let _palIdx = 0;
function randomColor() { _palIdx = (_palIdx + 1) % PALETTE.length; return PALETTE[_palIdx]; }
