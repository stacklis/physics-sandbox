// engine3d.js — Rapier3D wrapper for Physics Sandbox 3D mode.
// Lazy-initialised. Exposes World + body factories used by app3d.js.
'use strict';
export const _ready = (async () => {
  const RAPIER = await import('https://esm.sh/@dimforge/rapier3d-compat@0.14.0');
  await RAPIER.init();
  return RAPIER;
})();
