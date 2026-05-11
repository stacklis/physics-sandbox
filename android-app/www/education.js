// education.js — knowledge-level explanations + event-triggered teaching layer
'use strict';

(function (global) {

/* Levels: 1=Curious (~ages 7-10), 2=Student (HS), 3=University, 4=Expert (grad / ref) */

const CONCEPTS = {
  gravity: {
    title: 'Gravity',
    tags: ['force', 'free-fall'],
    levels: {
      1: "Earth pulls everything down. Heavy or light, big or small — they all fall the same way (if there's no air). That's gravity!",
      2: "Near Earth's surface, gravity accelerates objects downward at g ≈ 9.81 m/s². The pull on an object is its weight, W = m·g. Mass doesn't appear in the acceleration — that's why a feather and a hammer fall together in a vacuum.",
      3: "Newton's law of universal gravitation: F = G·m₁·m₂/r², where G ≈ 6.674×10⁻¹¹ N·m²/kg². At a planet's surface this reduces to a near-uniform field g = GM/R², giving the local approximation a = g.",
      4: "In general relativity, gravity is not a force but the curvature of spacetime sourced by the stress-energy tensor (Einstein field equations Gμν = 8πG/c⁴ Tμν). The equivalence principle — local indistinguishability of gravitation and uniform acceleration — recovers Newtonian dynamics in the weak-field, low-velocity limit."
    },
    formula: { 2: 'F = m·g', 3: 'F = G·m₁·m₂ / r²', 4: 'Gμν = 8πG/c⁴ · Tμν' }
  },

  newtonsFirst: {
    title: "Newton's First Law (Inertia)",
    tags: ['Newton', 'inertia'],
    levels: {
      1: "Things keep doing what they're doing unless something pushes them. A ball at rest stays put; a ball rolling keeps rolling (unless friction slows it).",
      2: "An object's velocity stays constant unless a net external force acts on it. Inertia is an object's tendency to resist changes in motion, and it's measured by mass.",
      3: "In an inertial frame, a body's momentum p = m·v is conserved in the absence of net external force. This is a special case of Newton's 2nd law (dp/dt = F) when F = 0.",
      4: "Inertia emerges from the symmetry of the laws of physics under spatial translation (Noether's theorem ↔ momentum conservation). Mach's principle suggests inertia is induced by the distribution of mass-energy in the universe — still an open interpretive question."
    },
    formula: { 3: 'F = 0  ⇒  dp/dt = 0' }
  },

  newtonsSecond: {
    title: "Newton's Second Law (F = ma)",
    tags: ['Newton', 'force'],
    levels: {
      1: "Push a heavy thing — it speeds up slowly. Push a light thing the same way — it speeds up quickly. Heavier needs more push.",
      2: "The acceleration of an object is proportional to the net force on it and inversely proportional to its mass: a = F/m, or F = m·a.",
      3: "More generally F = dp/dt. For constant mass this reduces to F = m·a. Forces add as vectors; the net force determines the acceleration vector.",
      4: "In Lagrangian mechanics this becomes the Euler-Lagrange equation d/dt(∂L/∂q̇) − ∂L/∂q = 0. Hamilton's principle (δ∫L dt = 0) generalizes it to systems with constraints, fields, and relativistic motion."
    },
    formula: { 2: 'F = m · a', 3: 'F = dp/dt', 4: 'd/dt(∂L/∂q̇) − ∂L/∂q = 0' }
  },

  newtonsThird: {
    title: "Newton's Third Law",
    tags: ['Newton', 'collision'],
    levels: {
      1: "When you push something, it pushes you back the same amount. That's why jumping pushes the ground a tiny bit too — and a bouncy ball makes your hand feel a bump.",
      2: "For every action there is an equal and opposite reaction. If A exerts force F on B, then B exerts −F on A simultaneously.",
      3: "Action-reaction pairs act on different bodies, so they don't cancel within a single body's equation of motion. Together they conserve total momentum of an isolated system.",
      4: "The third law is rooted in translational symmetry of the action — pairwise central forces inherit Newton's third law. In field theories it generalizes via momentum conservation of the field-matter system; non-instantaneous interactions (e.g. EM) require including field momentum."
    }
  },

  momentum: {
    title: 'Momentum',
    tags: ['conservation'],
    levels: {
      1: "A heavy ball rolling fast is hard to stop. Momentum is how 'pushy' a moving thing is — bigger and faster means more momentum.",
      2: "Momentum p = m·v. In a collision with no outside forces, total momentum before equals total momentum after — even when energy is lost.",
      3: "Linear momentum is conserved for any isolated system: Σpᵢ = constant. Impulse J = ∫F dt = Δp links forces to momentum changes.",
      4: "Momentum is the conserved Noether current of spatial translation symmetry. Relativistically, p = γmv, and four-momentum (E/c, p) transforms as a Lorentz vector with invariant E² − (pc)² = (mc²)²."
    },
    formula: { 2: 'p = m · v', 3: 'J = ∫F dt = Δp', 4: 'E² − (pc)² = (mc²)²' }
  },

  kineticEnergy: {
    title: 'Kinetic Energy',
    tags: ['energy'],
    levels: {
      1: "Anything that's moving has energy — that's why a moving ball can knock things over. Faster = a lot more energy.",
      2: "Kinetic energy is KE = ½·m·v². Doubling the speed gives FOUR times the energy. That's why high-speed crashes are so much worse than low-speed ones.",
      3: "KE = ½·m·v² (translational) + ½·I·ω² (rotational). Total mechanical energy E = KE + PE is conserved when only conservative forces act.",
      4: "Relativistic kinetic energy: KE = (γ − 1)mc² ≈ ½mv² for v ≪ c. Energy is the conserved current of time-translation symmetry (Noether)."
    },
    formula: { 2: 'KE = ½ m v²', 3: 'KE = ½ m v² + ½ I ω²', 4: 'KE = (γ − 1) m c²' }
  },

  potentialEnergy: {
    title: 'Potential Energy',
    tags: ['energy'],
    levels: {
      1: "Lift something up high — it has 'stored' energy. When you let go, gravity turns that stored energy into motion.",
      2: "Gravitational potential energy near Earth's surface: PE = m·g·h. The higher up, the more energy stored. Drop it and PE turns into KE.",
      3: "PE is defined relative to a reference. For uniform gravity, U = mgh. For two masses, U = −Gm₁m₂/r. Force is the negative gradient: F = −∇U.",
      4: "Potential energy exists for conservative force fields where ∇×F = 0. In Lagrangian mechanics, L = T − U; the potential parameterizes interactions and yields the equations of motion via the Euler-Lagrange equations."
    },
    formula: { 2: 'PE = m · g · h', 3: 'F = −∇U', 4: 'L = T − U' }
  },

  energyConservation: {
    title: 'Conservation of Energy',
    tags: ['energy', 'conservation'],
    levels: {
      1: "Energy doesn't appear or disappear — it just changes form. Sliding down a slide turns 'high up' energy into 'fast' energy.",
      2: "In a closed system without friction, total energy stays constant: KE + PE = constant. Friction doesn't 'destroy' energy — it converts it to heat.",
      3: "ΔE_total = W_nonconservative. Mechanical energy is conserved iff all forces are conservative. Otherwise, the difference is dissipated (friction → heat, plastic deformation, sound).",
      4: "Energy conservation is the conserved current of time-translation symmetry. In general relativity, energy is locally conserved (∇·T = 0) but global energy in curved spacetime is not always well-defined."
    }
  },

  collisions: {
    title: 'Collisions',
    tags: ['momentum', 'energy'],
    levels: {
      1: "When two things bump, they push each other away. Bouncy things keep most of their motion; squishy things slow down a lot.",
      2: "Momentum is conserved in every collision. Elastic collisions also conserve KE (think billiard balls). Inelastic ones lose KE to heat or deformation. The 'coefficient of restitution' e measures bounciness: e = 1 elastic, e = 0 perfectly inelastic.",
      3: "For two-body collisions: p_total before = p_total after; ½m₁v₁² + ½m₂v₂² before ≥ after, with equality only when elastic. Coefficient of restitution: e = −(v₁' − v₂')/(v₁ − v₂) along the contact normal.",
      4: "Treat as impulsive: Δp = J·n̂ along contact normal. The impulse magnitude follows from conservation laws plus a constitutive law (e). For continuum bodies, contact mechanics (Hertz theory) describes the elastic deformation that mediates the impulse."
    },
    formula: { 2: 'p_before = p_after', 3: 'e = −(v₁′−v₂′)/(v₁−v₂)' }
  },

  friction: {
    title: 'Friction',
    tags: ['force', 'dissipation'],
    levels: {
      1: "Things rubbing together feel sticky and slow each other down. That's friction. Rough surfaces have lots; ice has very little.",
      2: "Friction force resists relative motion: F_friction ≤ μ·N, where N is the normal force pressing the surfaces together. Static friction (not yet moving) can be larger than kinetic friction (already sliding).",
      3: "Kinetic friction: F_k = μ_k·N opposite to relative velocity. Static friction is constraint-like: |F_s| ≤ μ_s·N. Friction does negative work that becomes heat (entropy increase).",
      4: "Coulomb friction is a phenomenological model. Microscopically, friction arises from asperity contact, adhesion, and plastic deformation. Tribology models like Bowden-Tabor give μ ≈ τ_y/p_y from yield stresses. Stick-slip dynamics are nonlinear and underlie phenomena from earthquakes to musical bowing."
    },
    formula: { 2: 'F_k = μ_k · N' }
  },

  springs: {
    title: 'Springs & Hooke\'s Law',
    tags: ['oscillation', 'energy'],
    levels: {
      1: "Stretch a rubber band — it pulls back. Squish it — it pushes back. Springs always try to return to their normal shape.",
      2: "Hooke's law: F = −k·x. The further you stretch, the stronger the pull-back. Released, a spring oscillates back and forth — that's simple harmonic motion.",
      3: "Linear restoring force F = −kx gives angular frequency ω = √(k/m), period T = 2π√(m/k). Energy oscillates between elastic PE = ½kx² and KE = ½mv², with E = ½kA² constant.",
      4: "Simple harmonic motion is the canonical quadratic-potential limit of any smooth potential near a stable equilibrium (Taylor expand U about minimum). It generalizes to coupled oscillators (normal modes) and ultimately to quantum field theory (each mode is a harmonic oscillator → particles)."
    },
    formula: { 2: 'F = −k · x', 3: 'ω = √(k/m),  T = 2π√(m/k)' }
  },

  angularMotion: {
    title: 'Rotation & Angular Momentum',
    tags: ['rotation'],
    levels: {
      1: "Spinning things keep spinning. A figure skater pulls in her arms and spins faster — pretty cool, right?",
      2: "Angular momentum L = I·ω, where I is moment of inertia (mass × distance² from the axis) and ω is angular velocity. Pulling mass closer to the axis lowers I, so ω goes up to keep L the same.",
      3: "Torque τ = r × F changes angular momentum: τ = dL/dt. For rigid bodies, L = I·ω; in general L = ∑rᵢ × pᵢ. Conserved when net torque is zero.",
      4: "Angular momentum is the Noether current of rotational symmetry. In quantum mechanics it is quantized in units of ħ; in general relativity, the conserved 'angular momentum' is well-defined only for spacetimes with rotational Killing vectors."
    },
    formula: { 2: 'L = I · ω', 3: 'τ = dL/dt = r × F' }
  },

  drag: {
    title: 'Drag & Damping',
    tags: ['fluid', 'dissipation'],
    levels: {
      1: "Move your hand fast through water — it's hard! Air does the same thing, just gentler. The faster you go, the more it pushes back.",
      2: "At low speeds, drag is roughly proportional to velocity (F ∝ v). At higher speeds (and in air), drag scales with v². When drag equals the driving force, you reach terminal velocity.",
      3: "Stokes drag (Re ≪ 1): F = 6πμrv. Quadratic drag (high Re): F = ½ρv²C_dA. Reynolds number Re = ρvL/μ separates the regimes.",
      4: "Drag arises from momentum transfer to a viscous fluid; the full description requires solving Navier-Stokes. The drag coefficient C_d encodes geometry and is itself a function of Re; turbulence and boundary-layer separation introduce non-trivial dependencies (e.g. drag crisis on a smooth sphere near Re ≈ 3×10⁵)."
    }
  },

  pendulum: {
    title: 'Pendulum',
    tags: ['oscillation'],
    levels: {
      1: "A weight on a string swings back and forth. It always takes about the same time per swing — that's why old clocks used pendulums!",
      2: "For small swings, the period is T = 2π√(L/g). It depends on the length and gravity, but NOT on the mass or (small) amplitude. That's why a pendulum makes a good clock.",
      3: "Equation of motion: θ̈ = −(g/L)·sin θ. Small-angle approximation sin θ ≈ θ gives SHM with ω = √(g/L). For larger angles the period depends on amplitude (use elliptic integrals for the exact answer).",
      4: "The driven damped pendulum is a classic nonlinear system: bifurcations, chaos at sufficient drive, and a phase-space portrait showing fixed points and limit cycles. The Foucault pendulum reveals Earth's rotation through a slow precession of its swing plane."
    },
    formula: { 2: 'T = 2π√(L/g)' }
  },

  centerOfMass: {
    title: 'Center of Mass',
    tags: ['rigid-body'],
    levels: {
      1: "Every object has a balance point. If you held a hammer there with one finger, it would balance perfectly!",
      2: "The center of mass is the average position of an object's mass. It moves as if all the mass and all the forces acted at that single point.",
      3: "r_cm = (1/M)·Σmᵢrᵢ. External forces produce: M·r̈_cm = F_ext, regardless of internal complexity. This decomposes any rigid-body motion into translation of the COM plus rotation about it.",
      4: "Within special relativity the COM is frame-dependent; the 'center-of-momentum' frame is the invariant analogue. For extended systems with binding energy, mass and energy contribute via E/c²."
    },
    formula: { 3: 'r_cm = (1/M) Σ mᵢ rᵢ' }
  }
};

const LEVEL_NAMES = { 1: 'Curious', 2: 'Student', 3: 'University', 4: 'Expert' };

class Educator {
  constructor(world, ui) {
    this.world = world;
    this.ui = ui; // { lessonTitle, lessonBody, lessonFormula, lessonTags, levelBadge, conceptList }
    this.level = 1;
    this.currentConcept = null;
    this.encountered = new Set();
    this.cooldownUntil = 0; // wallclock
    this.idleSince = performance.now();

    this.show('intro', "Welcome", this._introText(), null, []);
    world.on(ev => this._onEvent(ev));
  }

  setLevel(level) {
    this.level = level;
    this.ui.levelBadge.textContent = LEVEL_NAMES[level];
    if (this.currentConcept && CONCEPTS[this.currentConcept]) {
      this._renderConcept(this.currentConcept);
    } else {
      this.show('intro', 'Welcome', this._introText(), null, []);
    }
  }

  _introText() {
    return ({
      1: "Try the tools on the left to make balls and boxes! As things bump and fall, this panel will explain what's happening.",
      2: "Spawn objects, drop them, watch them collide. The panel will explain the physics behind what you see — momentum, energy, friction, and more.",
      3: "Each interaction is mapped to a concept. As contacts and constraints fire events, you'll see the relevant principles, with formulas and references.",
      4: "Trigger-based pedagogy: events emitted from the contact solver and constraint apply step drive concept selection. Formal results referenced; full derivations omitted for brevity."
    })[this.level];
  }

  /* event handling -------- */
  _onEvent(ev) {
    const now = performance.now();
    if (ev.type === 'collision') {
      // pick concept based on energy / context
      const v = ev.relVelocity;
      let concept = 'collisions';
      if (v > 8) concept = 'momentum';
      if (v > 18) concept = 'kineticEnergy';
      // If gravity is dominant and nearly head-on with a static object, talk about Newton 3
      if (ev.b.isStatic || ev.a.isStatic) {
        if (v > 5 && Math.random() < 0.3) concept = 'newtonsThird';
      }
      this._maybeShow(concept, now, 1500);
      this.idleSince = now;
    } else if (ev.type === 'spawn') {
      this._maybeShow('newtonsFirst', now, 800);
    } else if (ev.type === 'spring') {
      this._maybeShow('springs', now, 600);
    } else if (ev.type === 'push') {
      this._maybeShow('newtonsSecond', now, 600);
    } else if (ev.type === 'rotation') {
      this._maybeShow('angularMotion', now, 1500);
    } else if (ev.type === 'fall') {
      this._maybeShow('gravity', now, 800);
    } else if (ev.type === 'rest') {
      this._maybeShow('friction', now, 1500);
    } else if (ev.type === 'highEnergy') {
      this._maybeShow('kineticEnergy', now, 1500);
    } else if (ev.type === 'preset') {
      if (ev.name === 'pendulum') this._maybeShow('pendulum', now, 0);
      else if (ev.name === 'newton') this._maybeShow('collisions', now, 0);
      else if (ev.name === 'orbit') this._maybeShow('gravity', now, 0);
      else if (ev.name === 'ramp') this._maybeShow('energyConservation', now, 0);
      else if (ev.name === 'stack') this._maybeShow('centerOfMass', now, 0);
    }
  }

  _maybeShow(conceptKey, now, cooldownMs) {
    if (!CONCEPTS[conceptKey]) return;
    if (now < this.cooldownUntil) return;
    this.cooldownUntil = now + cooldownMs;
    this._renderConcept(conceptKey);
  }

  _renderConcept(key) {
    const c = CONCEPTS[key];
    if (!c) return;
    this.currentConcept = key;
    this.encountered.add(key);
    this._renderConceptList();
    const body = c.levels[this.level] || c.levels[3] || '';
    const formula = c.formula && c.formula[this.level];
    this.show(key, c.title, body, formula, c.tags || []);
  }

  show(key, title, body, formula, tags) {
    this.ui.lessonTitle.textContent = title;
    this.ui.lessonBody.textContent = body;
    if (formula) {
      this.ui.lessonFormula.textContent = formula;
      this.ui.lessonFormula.hidden = false;
    } else {
      this.ui.lessonFormula.hidden = true;
    }
    this.ui.lessonTags.innerHTML = '';
    for (const t of tags) {
      const span = document.createElement('span');
      span.className = 'lesson-tag';
      span.textContent = t;
      this.ui.lessonTags.appendChild(span);
    }
  }

  _renderConceptList() {
    const list = this.ui.conceptList;
    list.innerHTML = '';
    if (this.encountered.size === 0) {
      const empty = document.createElement('span');
      empty.className = 'concept-pill empty';
      empty.textContent = 'Interact to begin learning';
      list.appendChild(empty);
      return;
    }
    for (const key of this.encountered) {
      const pill = document.createElement('span');
      pill.className = 'concept-pill';
      pill.textContent = CONCEPTS[key].title;
      pill.title = 'Click to revisit';
      pill.style.cursor = 'pointer';
      pill.onclick = () => this._renderConcept(key);
      list.appendChild(pill);
    }
  }
}

global.PEdu = { CONCEPTS, LEVEL_NAMES, Educator };

})(window);
