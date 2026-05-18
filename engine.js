// engine.js — 2D rigid-body physics engine
// Convex polygons + circles, SAT collision, sequential-impulse solver,
// Coulomb friction, Baumgarte position correction, distance/spring constraints.
'use strict';

(function (global) {

/* ============================== Vec2 ============================== */
class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  static of(x, y) { return new Vec2(x, y); }
  copy() { return new Vec2(this.x, this.y); }
  set(x, y) { this.x = x; this.y = y; return this; }
  add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
  mul(s) { return new Vec2(this.x * s, this.y * s); }
  neg() { return new Vec2(-this.x, -this.y); }
  dot(v) { return this.x * v.x + this.y * v.y; }
  cross(v) { return this.x * v.y - this.y * v.x; } // z-component
  perp() { return new Vec2(-this.y, this.x); }
  lengthSq() { return this.x * this.x + this.y * this.y; }
  length() { return Math.hypot(this.x, this.y); }
  normalize() { const l = this.length(); return l > 1e-12 ? new Vec2(this.x / l, this.y / l) : new Vec2(0, 0); }
  distSq(v) { const dx = this.x - v.x, dy = this.y - v.y; return dx * dx + dy * dy; }
  dist(v) { return Math.hypot(this.x - v.x, this.y - v.y); }
}
// scalar × vec → vec   (rotates v 90° CCW × s)
Vec2.crossSV = (s, v) => new Vec2(-s * v.y, s * v.x);

/* ============================== Body ============================== */
const SHAPE = { CIRCLE: 'circle', POLYGON: 'polygon' };
let _BODY_ID = 0;

class Body {
  constructor(opts) {
    this.id = _BODY_ID++;
    this.position = (opts.position || new Vec2()).copy();
    this.velocity = new Vec2();
    this.angle = opts.angle || 0;
    this.angularVelocity = 0;
    this.force = new Vec2();
    this.torque = 0;

    this.shape = opts.shape;
    this.radius = opts.radius || 0;
    this.localVertices = (opts.vertices || []).map(v => v.copy ? v.copy() : new Vec2(v.x, v.y));

    this.density = opts.density ?? 1;
    this.restitution = opts.restitution ?? 0.25;
    this.friction = opts.friction ?? 0.5;
    this.linearDamping = opts.linearDamping ?? 0.005;
    this.angularDamping = opts.angularDamping ?? 0.01;
    this.gravityScale = opts.gravityScale ?? 1; // 0 disables gravity for this body
    this.isStatic = !!opts.isStatic;
    this.color = opts.color || randomColor();
    this.label = opts.label || null;

    // cached world-space vertices/normals (recomputed each step)
    this._worldVerts = null;
    this._worldNormals = null;
    this._cachedAngle = NaN;
    this._cachedPos = new Vec2(NaN, NaN);

    this.computeMass();
  }

  computeMass() {
    if (this.isStatic) {
      this.mass = 0; this.inverseMass = 0;
      this.inertia = 0; this.inverseInertia = 0;
      return;
    }
    if (this.shape === SHAPE.CIRCLE) {
      const r = this.radius;
      this.mass = Math.PI * r * r * this.density;
      this.inertia = 0.5 * this.mass * r * r;
    } else {
      // Polygon: signed area + second moment about origin (assumes vertices around origin).
      let area = 0, mmoi = 0;
      const v = this.localVertices, n = v.length;
      for (let i = 0; i < n; i++) {
        const p1 = v[i];
        const p2 = v[(i + 1) % n];
        const c = p1.cross(p2);
        area += c;
        mmoi += c * (p1.dot(p1) + p1.dot(p2) + p2.dot(p2));
      }
      area = Math.abs(area) * 0.5;
      mmoi = Math.abs(mmoi) / 12;
      this.mass = area * this.density;
      this.inertia = mmoi * this.density;
    }
    this.inverseMass = this.mass > 0 ? 1 / this.mass : 0;
    this.inverseInertia = this.inertia > 0 ? 1 / this.inertia : 0;
  }

  /* ---- world-space cache ---- */
  _refreshWorld() {
    if (this.shape !== SHAPE.POLYGON) return;
    if (this._cachedAngle === this.angle &&
        this._cachedPos.x === this.position.x &&
        this._cachedPos.y === this.position.y &&
        this._worldVerts) return;
    const cos = Math.cos(this.angle), sin = Math.sin(this.angle);
    const px = this.position.x, py = this.position.y;
    const n = this.localVertices.length;
    const wv = new Array(n), wn = new Array(n);
    for (let i = 0; i < n; i++) {
      const v = this.localVertices[i];
      wv[i] = new Vec2(v.x * cos - v.y * sin + px, v.x * sin + v.y * cos + py);
    }
    for (let i = 0; i < n; i++) {
      const a = wv[i], b = wv[(i + 1) % n];
      // Vertices are CCW → outward normal is right-perp of edge (a→b)
      const ex = b.x - a.x, ey = b.y - a.y;
      const len = Math.hypot(ex, ey) || 1;
      wn[i] = new Vec2(ey / len, -ex / len);
    }
    this._worldVerts = wv;
    this._worldNormals = wn;
    this._cachedAngle = this.angle;
    this._cachedPos.set(this.position.x, this.position.y);
  }
  worldVertices() { this._refreshWorld(); return this._worldVerts; }
  worldNormals() { this._refreshWorld(); return this._worldNormals; }

  aabb() {
    if (this.shape === SHAPE.CIRCLE) {
      const r = this.radius;
      return {
        minX: this.position.x - r, minY: this.position.y - r,
        maxX: this.position.x + r, maxY: this.position.y + r
      };
    }
    const wv = this.worldVertices();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of wv) {
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
    }
    return { minX, minY, maxX, maxY };
  }

  applyForce(f, worldPoint) {
    if (this.isStatic) return;
    this.force = this.force.add(f);
    if (worldPoint) {
      const r = worldPoint.sub(this.position);
      this.torque += r.cross(f);
    }
  }
  applyImpulse(j, worldPoint) {
    if (this.isStatic) return;
    this.velocity = this.velocity.add(j.mul(this.inverseMass));
    if (worldPoint) {
      const r = worldPoint.sub(this.position);
      this.angularVelocity += this.inverseInertia * r.cross(j);
    }
  }
  velocityAt(worldPoint) {
    const r = worldPoint.sub(this.position);
    return this.velocity.add(Vec2.crossSV(this.angularVelocity, r));
  }

  setPosition(p) { this.position = p.copy(); this._cachedAngle = NaN; }
  setAngle(a) { this.angle = a; this._cachedAngle = NaN; }
}

/* =========================== shape factories =========================== */
function rectVertices(w, h) {
  const hw = w / 2, hh = h / 2;
  // CCW
  return [new Vec2(-hw, -hh), new Vec2(hw, -hh), new Vec2(hw, hh), new Vec2(-hw, hh)];
}
function regularPolygonVertices(sides, radius) {
  const verts = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    verts.push(new Vec2(Math.cos(a) * radius, Math.sin(a) * radius));
  }
  return verts;
}
function makeBox(x, y, w, h, opts = {}) {
  return new Body(Object.assign({
    shape: SHAPE.POLYGON,
    position: new Vec2(x, y),
    vertices: rectVertices(w, h),
    width: w, height: h
  }, opts));
}
function makeCircle(x, y, r, opts = {}) {
  return new Body(Object.assign({
    shape: SHAPE.CIRCLE,
    position: new Vec2(x, y),
    radius: r
  }, opts));
}
function makePolygon(x, y, sides, r, opts = {}) {
  return new Body(Object.assign({
    shape: SHAPE.POLYGON,
    position: new Vec2(x, y),
    vertices: regularPolygonVertices(sides, r)
  }, opts));
}

/* =========================== collision (SAT) =========================== */
/* Manifold: { normal (Vec2 from A→B), penetration, contacts[] } */

function aabbOverlap(a, b) {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

function collideCircleCircle(A, B) {
  const d = B.position.sub(A.position);
  const r = A.radius + B.radius;
  const distSq = d.lengthSq();
  if (distSq >= r * r) return null;
  const dist = Math.sqrt(distSq);
  const normal = dist > 1e-9 ? d.mul(1 / dist) : new Vec2(1, 0);
  const penetration = r - dist;
  // contact at the surface midpoint between bodies
  const contact = A.position.add(normal.mul(A.radius - penetration * 0.5));
  return { normal, penetration, contacts: [contact] };
}

// circle = A, poly = B
function collideCirclePolygon(A, B) {
  const verts = B.worldVertices();
  const norms = B.worldNormals();
  let bestIdx = 0;
  let bestSep = -Infinity;
  for (let i = 0; i < verts.length; i++) {
    const s = norms[i].dot(A.position.sub(verts[i]));
    if (s > A.radius) return null; // separating axis
    if (s > bestSep) { bestSep = s; bestIdx = i; }
  }

  const v1 = verts[bestIdx];
  const v2 = verts[(bestIdx + 1) % verts.length];

  // Center is inside polygon (bestSep <= 0): use the closest face's outward normal.
  if (bestSep < 1e-6) {
    const outward = norms[bestIdx];
    // n points from A (circle) to B (polygon). Polygon body center is on -outward side
    // of the face, circle center is also on -outward (inside). Push B along +n means
    // push polygon away from circle along -outward.
    const n = outward.neg();
    const contact = A.position.sub(outward.mul(A.radius));
    return { normal: n, penetration: A.radius - bestSep, contacts: [contact] };
  }

  // Determine Voronoi region of bestSep face wrt circle center.
  const e = v2.sub(v1);
  const u1 = A.position.sub(v1).dot(e);
  const u2 = A.position.sub(v2).dot(e.neg());

  let outward, contact;
  if (u1 <= 0) {                    // closest to v1
    if (A.position.distSq(v1) > A.radius * A.radius) return null;
    const dir = A.position.sub(v1);
    outward = dir.normalize();
    contact = v1;
  } else if (u2 <= 0) {             // closest to v2
    if (A.position.distSq(v2) > A.radius * A.radius) return null;
    const dir = A.position.sub(v2);
    outward = dir.normalize();
    contact = v2;
  } else {                          // closest to face
    outward = norms[bestIdx];
    contact = A.position.sub(outward.mul(A.radius));
  }
  // outward points from poly toward circle; n = A→B = -outward
  return { normal: outward.neg(), penetration: A.radius - bestSep, contacts: [contact] };
}

/* SAT for two convex polygons. Returns reference face owner ('A' or 'B') and edge index. */
function findAxisLeastPenetration(A, B) {
  const vA = A.worldVertices();
  const nA = A.worldNormals();
  const vB = B.worldVertices();
  let bestSep = -Infinity, bestIdx = 0;
  for (let i = 0; i < vA.length; i++) {
    const n = nA[i];
    // support point of B in direction -n
    let minProj = Infinity, supportIdx = -1;
    for (let j = 0; j < vB.length; j++) {
      const p = n.dot(vB[j]);
      if (p < minProj) { minProj = p; supportIdx = j; }
    }
    const sep = n.dot(vB[supportIdx].sub(vA[i]));
    if (sep > bestSep) { bestSep = sep; bestIdx = i; }
    if (bestSep > 0) return { sep: bestSep, idx: bestIdx, support: supportIdx };
  }
  return { sep: bestSep, idx: bestIdx };
}

// Sutherland-Hodgman clip of points against side plane (line through plane.p with normal plane.n,
// keep points where (q - plane.p)·plane.n <= 0). Returns up to 2 points.
function clipSegmentToLine(points, planeN, planeOffset) {
  const out = [];
  const d0 = planeN.dot(points[0]) - planeOffset;
  const d1 = planeN.dot(points[1]) - planeOffset;
  if (d0 <= 0) out.push(points[0]);
  if (d1 <= 0) out.push(points[1]);
  if (d0 * d1 < 0) {
    const t = d0 / (d0 - d1);
    const ix = points[0].x + t * (points[1].x - points[0].x);
    const iy = points[0].y + t * (points[1].y - points[0].y);
    out.push(new Vec2(ix, iy));
  }
  return out;
}

function collidePolygonPolygon(A, B) {
  const a = findAxisLeastPenetration(A, B);
  if (a.sep > 0) return null;
  const b = findAxisLeastPenetration(B, A);
  if (b.sep > 0) return null;

  // Pick reference body — the one with greater (less negative) separation so we use shallower axis.
  let ref, inc, refIdx, flip;
  const TOL = 0.001;
  if (a.sep > b.sep + TOL) {
    ref = A; inc = B; refIdx = a.idx; flip = false;
  } else if (b.sep > a.sep + TOL) {
    ref = B; inc = A; refIdx = b.idx; flip = true;
  } else {
    // Prefer A if close — keeps consistent normals across frames.
    ref = A; inc = B; refIdx = a.idx; flip = false;
  }

  const refVerts = ref.worldVertices();
  const refNorms = ref.worldNormals();
  const incVerts = inc.worldVertices();
  const incNorms = inc.worldNormals();

  const refNormal = refNorms[refIdx];
  const v1 = refVerts[refIdx];
  const v2 = refVerts[(refIdx + 1) % refVerts.length];

  // Find incident edge: incident face is the one whose normal is most anti-parallel to refNormal
  let incIdx = 0, minDot = Infinity;
  for (let i = 0; i < incNorms.length; i++) {
    const d = incNorms[i].dot(refNormal);
    if (d < minDot) { minDot = d; incIdx = i; }
  }
  const incEdge = [incVerts[incIdx], incVerts[(incIdx + 1) % incVerts.length]];

  // Side planes (perpendicular to refNormal): clip incident edge against them
  const tangent = new Vec2(v2.x - v1.x, v2.y - v1.y).normalize();
  const sideNeg = tangent.neg();
  const offsetNeg = sideNeg.dot(v1);
  const offsetPos = tangent.dot(v2);

  let clipped = clipSegmentToLine(incEdge, sideNeg, offsetNeg);
  if (clipped.length < 2) return null;
  clipped = clipSegmentToLine(clipped, tangent, offsetPos);
  if (clipped.length < 2) return null;

  // Keep points behind the reference face plane
  const refOffset = refNormal.dot(v1);
  const contacts = [];
  let maxPen = 0;
  for (const p of clipped) {
    const sep = refNormal.dot(p) - refOffset;
    if (sep <= 0) {
      contacts.push(p);
      if (-sep > maxPen) maxPen = -sep;
    }
  }
  if (contacts.length === 0) return null;

  // n must point from A to B. refNormal points outward from `ref` toward `inc`.
  // If ref==A then refNormal already points toward B — good.
  // If ref==B (flip=true) we need to negate so n still goes A→B.
  const normal = flip ? refNormal.neg() : refNormal;

  return { normal, penetration: maxPen, contacts };
}

function collide(A, B) {
  if (A.shape === SHAPE.CIRCLE && B.shape === SHAPE.CIRCLE) return collideCircleCircle(A, B);
  if (A.shape === SHAPE.CIRCLE && B.shape === SHAPE.POLYGON) return collideCirclePolygon(A, B);
  if (A.shape === SHAPE.POLYGON && B.shape === SHAPE.CIRCLE) {
    const m = collideCirclePolygon(B, A);
    if (!m) return null;
    return { normal: m.normal.neg(), penetration: m.penetration, contacts: m.contacts };
  }
  return collidePolygonPolygon(A, B);
}

/* =========================== contact resolution =========================== */
class Contact {
  constructor(A, B, manifold) {
    this.A = A; this.B = B;
    this.normal = manifold.normal; // A → B
    this.penetration = manifold.penetration;
    this.points = manifold.contacts;
    this.e = Math.min(A.restitution, B.restitution);
    this.mu = Math.sqrt(A.friction * B.friction);
    this.normalImpulse = new Array(this.points.length).fill(0);
    this.tangentImpulse = new Array(this.points.length).fill(0);
    this.bias = new Array(this.points.length).fill(0);
  }

  preStep(dt, gravity) {
    const slop = 0.005;
    const biasFactor = 0.2;
    for (let i = 0; i < this.points.length; i++) {
      // Restitution-driven bias for bouncy collisions
      const rA = this.points[i].sub(this.A.position);
      const rB = this.points[i].sub(this.B.position);
      const vRel = this.B.velocityAt(this.points[i]).sub(this.A.velocityAt(this.points[i]));
      const vNormal = vRel.dot(this.normal);
      // Skip restitution for near-resting contacts (avoid jitter)
      const restThreshold = Math.abs(gravity) * dt * 1.0;
      const restitution = (vNormal < -restThreshold) ? this.e * vNormal : 0;
      // Baumgarte position correction term
      const correction = Math.max(this.penetration - slop, 0) * (biasFactor / dt);
      this.bias[i] = correction - restitution;
    }
  }

  solveVelocity() {
    const A = this.A, B = this.B;
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      const rA = p.sub(A.position);
      const rB = p.sub(B.position);

      // ----- Normal impulse (with bias)
      const vRel = B.velocityAt(p).sub(A.velocityAt(p));
      const vN = vRel.dot(this.normal);

      const rACrossN = rA.cross(this.normal);
      const rBCrossN = rB.cross(this.normal);
      const kNormal = A.inverseMass + B.inverseMass +
        rACrossN * rACrossN * A.inverseInertia +
        rBCrossN * rBCrossN * B.inverseInertia;
      if (kNormal <= 0) continue;

      let lambda = (-vN + this.bias[i]) / kNormal;
      const oldN = this.normalImpulse[i];
      this.normalImpulse[i] = Math.max(oldN + lambda, 0);
      lambda = this.normalImpulse[i] - oldN;
      const Pn = this.normal.mul(lambda);
      A.applyImpulse(Pn.neg(), p);
      B.applyImpulse(Pn, p);

      // ----- Friction (clamped to μ * normalImpulse)
      const tangent = new Vec2(-this.normal.y, this.normal.x); // perp to n
      const vRel2 = B.velocityAt(p).sub(A.velocityAt(p));
      const vT = vRel2.dot(tangent);

      const rACrossT = rA.cross(tangent);
      const rBCrossT = rB.cross(tangent);
      const kTan = A.inverseMass + B.inverseMass +
        rACrossT * rACrossT * A.inverseInertia +
        rBCrossT * rBCrossT * B.inverseInertia;
      if (kTan <= 0) continue;

      let lambdaT = -vT / kTan;
      const maxT = this.mu * this.normalImpulse[i];
      const oldT = this.tangentImpulse[i];
      this.tangentImpulse[i] = Math.max(-maxT, Math.min(maxT, oldT + lambdaT));
      lambdaT = this.tangentImpulse[i] - oldT;
      const Pt = tangent.mul(lambdaT);
      A.applyImpulse(Pt.neg(), p);
      B.applyImpulse(Pt, p);
    }
  }
}

/* =========================== constraints =========================== */
class DistanceConstraint {
  constructor(A, B, anchorA, anchorB, opts = {}) {
    this.A = A; this.B = B;
    this.anchorA = anchorA.copy(); // local
    this.anchorB = anchorB.copy(); // local
    const wA = this._world(A, anchorA);
    const wB = this._world(B, anchorB);
    this.length = opts.length != null ? opts.length : wA.dist(wB);
    this.stiffness = opts.stiffness ?? 0.9; // 0..1 (1 = rigid-ish)
    this.damping = opts.damping ?? 0.05;
    this.isSpring = opts.isSpring ?? false;
    this.springK = opts.springK ?? 80;
    this.dampAllAxes = opts.dampAllAxes ?? false;
    this.maxForce = opts.maxForce ?? Infinity; // cap |F| to prevent flick-induced spikes
    this.broken = false;
  }
  _world(body, local) {
    const cos = Math.cos(body.angle), sin = Math.sin(body.angle);
    return new Vec2(
      local.x * cos - local.y * sin + body.position.x,
      local.x * sin + local.y * cos + body.position.y
    );
  }

  apply(dt, iter = 0) {
    // Force-based constraints (springs) accumulate into Body.force via applyForce
    // and integrate next substep. Run them once, not iterations× — otherwise
    // force is multiplied by iteration count.
    if (this.isSpring && iter > 0) return;

    const pA = this._world(this.A, this.anchorA);
    const pB = this._world(this.B, this.anchorB);
    const delta = pB.sub(pA);
    const dist = delta.length();
    if (dist < 1e-9) return;
    const dir = delta.mul(1 / dist);

    if (this.isSpring) {
      // Hooke's law: F = -k(x - L). springK is N/m, damping is N·s/m.
      const stretch = dist - this.length;
      const force = dir.mul(-this.springK * stretch);
      const vRel = this.B.velocityAt(pB).sub(this.A.velocityAt(pA));
      // dampAllAxes damps tangential motion too — needed for off-center grabs,
      // otherwise spin at the anchor point pumps undamped energy into the body.
      const damp = this.dampAllAxes
        ? vRel.mul(-this.damping)
        : dir.mul(-this.damping * vRel.dot(dir));
      let total = force.add(damp);
      if (this.maxForce !== Infinity) {
        const tlen = total.length();
        if (tlen > this.maxForce) total = total.mul(this.maxForce / tlen);
      }
      this.A.applyForce(total.neg(), pA);
      this.B.applyForce(total, pB);
    } else {
      // Rigid distance: directly correct positions and velocities
      const rA = pA.sub(this.A.position);
      const rB = pB.sub(this.B.position);
      const vRel = this.B.velocityAt(pB).sub(this.A.velocityAt(pA));
      const vAlong = vRel.dot(dir);

      const rACrossD = rA.cross(dir);
      const rBCrossD = rB.cross(dir);
      const k = this.A.inverseMass + this.B.inverseMass +
        rACrossD * rACrossD * this.A.inverseInertia +
        rBCrossD * rBCrossD * this.B.inverseInertia;
      if (k <= 0) return;
      const C = dist - this.length;
      const bias = (this.stiffness * 0.2 / dt) * C;
      const lambda = -(vAlong + bias) / k;
      const P = dir.mul(lambda);
      this.A.applyImpulse(P.neg(), pA);
      this.B.applyImpulse(P, pB);
    }
  }
}

/* =========================== world =========================== */
class World {
  constructor(opts = {}) {
    this.bodies = [];
    this.constraints = [];
    this.gravity = opts.gravity != null ? opts.gravity : 9.81;
    this.iterations = opts.iterations ?? 8; // 5 was too few for constraint stacks (Newton's cradle resting line jittered into overlap)
    this.contacts = [];
    this.events = [];
    this.eventListeners = [];
    this.timeAccumulator = 0;
    this.fixedDt = 1 / 60; // was 1/120 — 60Hz physics is smooth enough and halves substeps
    this.preSubstep = null; // optional callback fn(dt) called before each substep's integration
    // Hard caps to prevent numerical blowups from constraint stacking (grab + walls + collisions).
    // 80 m/s is well above realistic sandbox speeds (orbit preset peaks ~49 m/s)
    // but low enough that sub-step travel (80/120 ≈ 0.67 m) is bounded relative to
    // wall thickness, limiting how badly a fast body can tunnel.
    this.maxLinearVelocity = 80;    // m/s
    this.maxAngularVelocity = 50;   // rad/s
    this._stepClock = 0;            // frame counter for collision dedup
    this._collidedThisFrame = new Map();
  }

  add(body) { this.bodies.push(body); return body; }
  remove(body) {
    body._destroyed = true; // flag for fast preSubstep checks
    const i = this.bodies.indexOf(body);
    if (i >= 0) this.bodies.splice(i, 1);
    this.constraints = this.constraints.filter(c => c.A !== body && c.B !== body);
  }
  clear() { this.bodies.length = 0; this.constraints.length = 0; }
  addConstraint(c) { this.constraints.push(c); return c; }

  on(fn) { this.eventListeners.push(fn); }
  emit(ev) {
    this.events.push(ev);
    for (const fn of this.eventListeners) fn(ev);
  }

  /* Variable framerate; we run substeps at fixed dt for stability. */
  step(frameDt) {
    if (frameDt > 0.1) frameDt = 0.1; // clamp on tab-defocus
    this._stepClock++;
    this._collidedThisFrame.clear(); // reset per-frame collision dedup
    this.timeAccumulator += frameDt;
    let steps = 0;
    while (this.timeAccumulator >= this.fixedDt && steps < 3) { // was 6
      this._substep(this.fixedDt);
      this.timeAccumulator -= this.fixedDt;
      steps++;
    }
    if (steps === 3) this.timeAccumulator = 0;
  }

  _substep(dt) {
    if (this.preSubstep) this.preSubstep(dt);

    // 1) integrate forces (gravity + applied)
    for (const b of this.bodies) {
      if (b.isStatic) { b.force.set(0, 0); b.torque = 0; continue; }
      // Gravity force
      b.velocity.x += (b.force.x * b.inverseMass) * dt;
      b.velocity.y += ((b.force.y * b.inverseMass) + this.gravity * b.gravityScale) * dt;
      b.angularVelocity += b.torque * b.inverseInertia * dt;
      // damping
      b.velocity = b.velocity.mul(1 - b.linearDamping * dt);
      b.angularVelocity *= (1 - b.angularDamping * dt);
      b.force.set(0, 0); b.torque = 0;
    }

    // 2) broad/narrow phase
    this.contacts = [];
    const n = this.bodies.length;
    for (let i = 0; i < n; i++) {
      const A = this.bodies[i];
      const aabbA = A.aabb();
      for (let j = i + 1; j < n; j++) {
        const B = this.bodies[j];
        if (A.isStatic && B.isStatic) continue;
        const aabbB = B.aabb();
        if (!aabbOverlap(aabbA, aabbB)) continue;
        const m = collide(A, B);
        if (m) {
          const contact = new Contact(A, B, m);
          this.contacts.push(contact);
          // Only emit collision events when impact is non-trivial and bodies
          // haven't already collided this frame (cooldown per body-pair).
          // This eliminates the main source of lag: hundreds of collision events
          // per frame when many bodies are resting against each other.
          const relV = B.velocityAt(m.contacts[0]).sub(A.velocityAt(m.contacts[0])).length();
          if (relV > 0.8) {
            const now = this._stepClock;
            const key = A.id < B.id ? (A.id * 65536 + B.id) : (B.id * 65536 + A.id);
            const last = this._collidedThisFrame.get(key) || 0;
            if (now - last >= 1) { // at least 1 frame gap
              this._collidedThisFrame.set(key, now);
              this.emit({
                type: 'collision', a: A, b: B,
                point: m.contacts[0],
                normal: m.normal,
                relVelocity: relV,
              });
            }
          }
        }
      }
    }

    // 3) prepare contacts
    for (const c of this.contacts) c.preStep(dt, this.gravity);

    // 4) iterative solver: contacts + constraints.
    // Pass iteration index so force-based constraints (springs) can apply once
    // per substep — applyForce accumulates, so iterating it would multiply force
    // by `iterations`, making springs both over-stiff and prone to oscillation.
    for (let it = 0; it < this.iterations; it++) {
      for (const c of this.contacts) c.solveVelocity();
      for (const con of this.constraints) con.apply(dt, it);
    }

    // 5) clamp velocities, then integrate positions.
    // Clamping guards against NaN/Infinity and constraint stacking; physical scenes
    // never approach these caps.
    const maxV = this.maxLinearVelocity;
    const maxW = this.maxAngularVelocity;
    for (const b of this.bodies) {
      if (b.isStatic) continue;
      if (!Number.isFinite(b.velocity.x) || !Number.isFinite(b.velocity.y)) {
        b.velocity.x = 0; b.velocity.y = 0;
      }
      if (!Number.isFinite(b.angularVelocity)) b.angularVelocity = 0;
      const vLen = Math.hypot(b.velocity.x, b.velocity.y);
      if (vLen > maxV) {
        const s = maxV / vLen;
        b.velocity.x *= s; b.velocity.y *= s;
      }
      if (b.angularVelocity > maxW) b.angularVelocity = maxW;
      else if (b.angularVelocity < -maxW) b.angularVelocity = -maxW;
      b.position.x += b.velocity.x * dt;
      b.position.y += b.velocity.y * dt;
      b.angle += b.angularVelocity * dt;
    }
  }

  /* convenience: spatial query */
  bodyAt(point) {
    // iterate from top of z-order (last drawn) backward
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const b = this.bodies[i];
      if (b.shape === SHAPE.CIRCLE) {
        if (b.position.distSq(point) <= b.radius * b.radius) return b;
      } else {
        if (pointInPolygon(point, b.worldVertices())) return b;
      }
    }
    return null;
  }
}

function pointInPolygon(p, verts) {
  // Convex polygon (CCW): p is inside if it's on the left side of every edge.
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i], b = verts[(i + 1) % verts.length];
    const edge = b.sub(a);
    const toP = p.sub(a);
    if (edge.cross(toP) < 0) return false;
  }
  return true;
}

/* =========================== utilities =========================== */
const PALETTE = [
  '#6aa6ff', '#8ad0ff', '#6ee29a', '#ffc46a', '#ff7a8a',
  '#c79bff', '#9bf2e0', '#ffa1cf', '#a8d56e', '#ffd56a'
];
function randomColor() { return PALETTE[(Math.random() * PALETTE.length) | 0]; }

/* =========================== exports =========================== */
global.PSandbox = {
  Vec2, Body, World, Contact, DistanceConstraint,
  SHAPE,
  makeBox, makeCircle, makePolygon,
  rectVertices, regularPolygonVertices,
  pointInPolygon
};

})(window);
