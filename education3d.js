// education3d.js — 3D-mode educator content. Mirrors education.js shape but
// with 3D-aware levels (Practitioner/Expert get tensor inertia, rolling, etc.).
'use strict';

export const CONCEPTS_3D = {
  inertiaTensor: {
    title: 'Inertia Tensor',
    levels: {
      1: "Heavy things spin slower. In 3D, an object also spins differently around different axes — a long pencil is easy to twist about its length but hard to flip end-over-end.",
      2: "Each rigid body has three principal axes; the moment of inertia is different on each. That's why a frisbee is stable spinning flat but wobbles end-over-end.",
      3: "Inertia is a 3×3 tensor I. Angular momentum L = I·ω. The principal axes are the eigenvectors of I; the eigenvalues are the principal moments. ω parallel to a principal axis means L stays parallel and rotation is stable.",
      4: "The intermediate axis theorem (tennis racket theorem): rotation about the axis with the middle moment is unstable. Solutions to Euler's equations Iω̇ + ω × (Iω) = τ exhibit periodic flipping under any perturbation, even with τ=0."
    }
  },
  rollingWithoutSlipping: {
    title: 'Rolling Without Slipping',
    levels: {
      1: "When a ball rolls smoothly, the bottom doesn't slide — it grips the ground for an instant before lifting away.",
      2: "Rolling without slipping means the contact point momentarily has zero velocity. For a ball of radius r rolling at speed v, its angular speed is ω = v/r.",
      3: "The constraint v_cm = ω × r couples translation and rotation. Total kinetic energy splits into ½mv² + ½Iω². For a solid sphere, I = (2/5)mr², so 2/7 of the kinetic energy is rotational.",
      4: "Rolling friction breaks the no-slip condition above a critical lateral force. The Stribeck curve and elasto-hydrodynamic theory describe the smooth/rolling/slipping transitions; numerical solvers (like Rapier's) typically use a velocity-based Baumgarte stabilisation of the no-slip constraint."
    }
  },
  gyroscopicPrecession: {
    title: 'Gyroscopic Precession',
    levels: {
      1: "A spinning top doesn't fall straight down — it slowly traces a circle. Spinning makes things resist tipping.",
      2: "Apply torque to a spinning object and it doesn't tilt the way you push — it turns sideways. That's why a bike wheel stays up while moving.",
      3: "dL/dt = τ. For a fast spin, |L| stays roughly constant but L's direction rotates. Precession rate Ω = τ / (I·ω_spin) for a horizontal torque on a vertical spin axis.",
      4: "Precession is the leading-order solution; nutation (small high-frequency oscillation) is the second-order term from Euler's equations. Steady precession requires the support to provide both gravity-balancing force and a couple, satisfying the Euler-Poinsot conditions."
    }
  },
  contactRestitution3D: {
    title: 'Restitution & Contact Normal',
    levels: {
      1: "Bouncy things bounce more. In 3D, what matters is the angle the object hits the ground at — corners absorb differently than flat sides.",
      2: "The coefficient of restitution e relates the speeds along the contact normal: v_after_normal = -e · v_before_normal. Tangential velocity (sliding) is governed by friction, not e.",
      3: "Constraint solvers project velocity onto the contact normal and apply an impulse jₙ = -(1+e)·m_eff·v_n. Coulomb friction limits the tangential impulse to |jₜ| ≤ μ·jₙ. For multi-contact resolution (e.g. a cube on its corner), the LCP is solved iteratively (Gauss-Seidel / projected sequential impulse).",
      4: "In 3D a single contact point is rare — bodies typically rest on a 3-point or face contact. The correct rigid-body model uses a contact manifold and a friction cone (or pyramid approximation). Solvers like Rapier use a sequential-impulse projected Gauss-Seidel scheme; rigorous formulations use Anitescu-Stewart time-stepping."
    }
  },
};

// Map raw event types from app3d to a list of relevant concept keys.
export const EVENTS_3D = {
  spawn: ['contactRestitution3D'],
  collision: ['contactRestitution3D'],
  rolling: ['rollingWithoutSlipping'],
  highSpin: ['gyroscopicPrecession', 'inertiaTensor'],
};

export function getConcept(key, level) {
  const c = CONCEPTS_3D[key];
  if (!c) return null;
  return { title: c.title, body: c.levels[level] || c.levels[1] };
}
