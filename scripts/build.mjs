// Copies the app into dist/ — the folder a static host serves and the folder
// Capacitor wraps into the Android and iOS apps. No bundler, no dependencies.
import { cp, mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const ENTRIES = ['index.html', 'privacy.html', 'styles.css', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'asset-manifest.json', 'src', 'audio'];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of ENTRIES) {
  const from = join(root, entry);
  if (!existsSync(from)) continue;
  await cp(from, join(dist, entry), { recursive: true, filter: (p) => !p.endsWith('README.md') });
}

const files = await readdir(dist, { recursive: true });
console.log(`Built dist/ with ${files.length} entries. Serve it, or run "npx cap sync" to update the Android and iOS apps.`);
