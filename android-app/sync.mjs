// Re-copies the web source files from the parent project into ./www so the
// Capacitor app is shipped with the latest code. Run via `npm run sync-web`.
// Treat this as a one-way pull: edits made directly inside ./www will be
// overwritten the next time you run sync.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..');
const dstDir = join(__dirname, 'www');
mkdirSync(dstDir, { recursive: true });

const files = ['index.html', 'app.js', 'engine.js', 'education.js', 'styles.css'];
let copied = 0;
for (const f of files) {
  const src = join(srcDir, f);
  const dst = join(dstDir, f);
  if (!existsSync(src)) {
    console.warn(`skip (missing in parent): ${f}`);
    continue;
  }
  copyFileSync(src, dst);
  console.log(`copied ${f}`);
  copied++;
}
console.log(`\n${copied} file(s) synced to www/`);
