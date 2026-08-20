/**
 * Copies MapLibre's worker bundle into /public so it can be served as a real
 * static module script.
 *
 * WHY THIS EXISTS
 * maplibre-gl v6 spawns its tile-processing worker with
 * `new Worker(url, { type: 'module' })`. Turbopack does not statically resolve
 * that URL, so the request falls through to the Next.js catch-all route and
 * comes back as the app's HTML shell. The browser then refuses it:
 *
 *   Failed to load module script: The server responded with a non-JavaScript
 *   MIME type of "text/html".
 *
 * The map still constructs (controls, scale bar and attribution all render)
 * but the canvas stays blank, because every tile is parsed in that worker.
 *
 * Fix: serve the worker ourselves and point MapLibre at it via `setWorkerUrl()`
 * (the officially provided escape hatch). The worker does
 * `import ... from "./maplibre-gl-shared.mjs"`, so both files must land in the
 * SAME directory for that relative specifier to resolve.
 *
 * Runs on `postinstall` and before `build`/`dev`, so the copies can never drift
 * from the installed maplibre-gl version.
 */
import { copyFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'maplibre-gl', 'dist');
const dest = join(root, 'public', 'maplibre');

const FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

if (!existsSync(src)) {
  console.error('[maplibre] node_modules/maplibre-gl not found — skipping worker copy.');
  process.exit(0);
}

mkdirSync(dest, { recursive: true });

const version = JSON.parse(
  readFileSync(join(root, 'node_modules', 'maplibre-gl', 'package.json'), 'utf8'),
).version;

for (const file of FILES) {
  const from = join(src, file);
  if (!existsSync(from)) {
    console.error(`[maplibre] expected ${file} in maplibre-gl/dist — layout changed?`);
    process.exit(1);
  }
  copyFileSync(from, join(dest, file));
}

console.log(`[maplibre] worker assets synced to public/maplibre (maplibre-gl v${version})`);
