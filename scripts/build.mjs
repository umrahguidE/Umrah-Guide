// Builds dist/ — the folder GitHub Pages serves. No bundler, no dependencies.
//
//   dist/            the landing website (site/) and the privacy policy
//   dist/app/        the web app (PWA)
import { cp, mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const APP = ['index.html', 'privacy.html', 'styles.css', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'asset-manifest.json', 'src', 'audio'];
const skipReadme = (p) => !p.endsWith('README.md');

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'app'), { recursive: true });

for (const entry of APP) {
  const from = join(root, entry);
  if (existsSync(from)) await cp(from, join(dist, 'app', entry), { recursive: true, filter: skipReadme });
}
await cp(join(root, 'site'), dist, { recursive: true, filter: skipReadme });
for (const entry of ['privacy.html', 'icon.svg']) await cp(join(root, entry), join(dist, entry));

const files = await readdir(dist, { recursive: true });
console.log(`Built dist/ with ${files.length} entries: the website at dist/, the web app at dist/app/.`);
