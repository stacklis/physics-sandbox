// Loader shim for the 2D engine. engine.js is a browser IIFE that attaches
// `PSandbox` to the `window` it is passed. We run it in a Node vm context
// with a synthetic `window` and re-export PSandbox for tests.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '..', 'engine.js'), 'utf-8');

const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(src, ctx);

export const PSandbox = ctx.window.PSandbox;
