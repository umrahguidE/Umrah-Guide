// Exports the app's content and translations to JSON for the Flutter app, so
// the Arabic duas, guidance text and every translation are copied by a program
// rather than retyped — the Flutter app reads exactly what the web app shows.
//   node scripts/export-flutter-data.mjs
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import * as C from '../src/data/content.js';
import { HARAM_GEO, KAABA_SECTORS } from '../src/engine/tracking.js';
import { STAGE_LINES } from '../src/data/voice-lines.js';
import { LANGUAGES, packFor } from '../src/i18n/index.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'flutter_app', 'assets');
await mkdir(join(out, 'data'), { recursive: true });
await mkdir(join(out, 'i18n'), { recursive: true });

const content = {
  CONTENT_META: C.CONTENT_META,
  REVIEW_NOTICE: C.REVIEW_NOTICE,
  PREP_CHECKLIST: C.PREP_CHECKLIST,
  IHRAM_GUIDE: C.IHRAM_GUIDE,
  MIQATS: C.MIQATS,
  ROUTES: C.ROUTES,
  ROUTE_GROUPS: C.ROUTE_GROUPS,
  ROUTE_STEPS: C.ROUTE_STEPS,
  GUIDANCE: C.GUIDANCE,
  HAIR_OPTIONS: C.HAIR_OPTIONS,
  BASIS_LABEL: C.BASIS_LABEL,
  DUA_CATEGORIES: C.DUA_CATEGORIES,
  TAWAF_DUA_NOTE: C.TAWAF_DUA_NOTE,
  SAI_DUA_NOTE: C.SAI_DUA_NOTE,
  DUAS: C.DUAS,
  EMERGENCY_NUMBERS: C.EMERGENCY_NUMBERS,
  EMERGENCY_NOTE: C.EMERGENCY_NOTE,
  GUIDES: C.GUIDES,
  HARAM_GEO,
  KAABA_SECTORS,
  STAGE_LINES,
  LANGUAGES,
};

const json = (v) => JSON.stringify(v, null, 1);
await writeFile(join(out, 'data', 'content.json'), json(content));

for (const { code } of LANGUAGES) {
  if (code === 'en') continue;
  await writeFile(join(out, 'i18n', `${code}.json`), json(packFor(code)));
}

const keys = Object.keys(content).length;
console.log(`Exported ${keys} content sections and ${LANGUAGES.length - 1} translation packs to flutter_app/assets/`);

// Recitations: copied from audio/ when `npm run audio:fetch` has been run.
// They are not committed (see .gitignore) — the release workflows fetch them.
const audio = join(root, 'audio');
if (existsSync(join(audio, 'duas', 'index.json'))) {
  await mkdir(join(out, 'audio', 'duas'), { recursive: true });
  if (existsSync(join(audio, 'talbiyah.mp3'))) await copyFile(join(audio, 'talbiyah.mp3'), join(out, 'audio', 'talbiyah.mp3'));
  const files = (await readdir(join(audio, 'duas'))).filter((f) => f.endsWith('.mp3') || f === 'index.json');
  for (const f of files) await copyFile(join(audio, 'duas', f), join(out, 'audio', 'duas', f));
  console.log(`Copied ${files.length} recitation files to flutter_app/assets/audio/`);
} else {
  console.log('No recitations found in audio/ — run `npm run audio:fetch` first to include them.');
}
