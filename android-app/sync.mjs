// Re-copies the web source files from the parent project into ./www so the
// Capacitor app is shipped with the latest code. Run via `npm run sync-web`.
// Treat this as a one-way pull: edits made directly inside ./www will be
// overwritten the next time you run sync.
//
// Layout note (post-landing-page split):
//   parent/index.html         -> marketing landing (NOT shipped in the APK)
//   parent/app/index.html     -> the actual app shell (shipped, renamed to www/index.html)
//   parent/{engine,education,app}.js, styles.css -> shared engine + UI code
//   parent/{favicon, icons, manifest} -> PWA assets
//
// We rewrite the relative paths inside the copied app/index.html from "../foo"
// back to "foo" so the Android-shipped HTML resolves siblings inside www/.
import { copyFileSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..');
const dstDir = join(__dirname, 'www');
mkdirSync(dstDir, { recursive: true });

// 1) Code files (flat copy)
const codeFiles = ['app.js', 'engine.js', 'education.js', 'layout.js', 'styles.css'];
let copied = 0;
for (const f of codeFiles) {
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

// 2) PWA assets — manifest + icons (so the Android WebView matches web)
const assetFiles = [
  'manifest.json',
  'favicon.ico',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-512-maskable.png',
];
for (const f of assetFiles) {
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

// 3) The app shell — pulled from parent/app/index.html (the marketing root
//    parent/index.html is web-only and would break the wrapped app). Rewrite
//    the "../foo" relative refs back to "foo" because in www/ everything is a
//    sibling.
const appHtmlSrc = join(srcDir, 'app', 'index.html');
if (existsSync(appHtmlSrc)) {
  let html = readFileSync(appHtmlSrc, 'utf8');
  html = html.replace(/(["'(])\.\.\//g, '$1');
  writeFileSync(join(dstDir, 'index.html'), html, 'utf8');
  console.log('copied app/index.html -> www/index.html (paths flattened)');
  copied++;
} else {
  console.warn('skip (missing in parent): app/index.html');
}

console.log(`\n${copied} file(s) synced to www/`);
