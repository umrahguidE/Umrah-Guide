// Generates docs/CONTENT_REVIEW.md from src/data/content.js — the sheet that
// scholars review and sign off before any public release.
import { mkdir, writeFile } from 'node:fs/promises';
import * as C from '../src/data/content.js';
import * as V from '../src/data/voice-lines.js';
import * as T from '../src/engine/tracking.js';
import { RECITERS, QURAN, HISN } from './recitation-sources.mjs';

const out = [];
const line = (s = '') => out.push(s);
const item = (s) => line(`- [ ] ${s}`);

line('# Content review sheet');
line();
line(`Generated from \`src/data/content.js\` (version ${C.CONTENT_META.version}). Current status: **${C.CONTENT_META.review.status}**.`);
line();
line('For each item mark ✅ approved, ✏️ corrected (write the correction beneath it), or ❌ remove.');
line('Then set `review: { status: \'reviewed\', by, at }` on the approved items in `content.js` and re-run `npm run review:export`.');
line();

line('## 1. Stage guidance');
for (const [stage, g] of Object.entries(C.GUIDANCE)) {
  line();
  line(`### ${stage}`);
  if (typeof g === 'string') {
    item(g);
    continue;
  }
  if (g.lead) item(`**Lead:** ${g.lead}`);
  for (const p of g.points ?? []) item(p);
  for (const p of g.men ?? []) item(`**Men:** ${p}`);
  for (const p of g.women ?? []) item(`**Women:** ${p}`);
  if (g.ramal) item(g.ramal);
  for (const [key, c] of Object.entries(g.checks ?? {})) item(`**Check “${key}”:** ${c.label} — ${c.help}`);
}

line();
line('## 2. Understand Ihram');
for (const sec of C.IHRAM_GUIDE) {
  line();
  line(`### ${sec.title}`);
  for (const p of sec.points) item(p);
}

line();
line('## 3. Miqats and routes');
line();
line('Coordinates are approximate and must also be verified.');
line();
for (const m of C.MIQATS) item(`**${m.name}** (${m.modern}) — ${m.coords.lat}, ${m.coords.lng} — ${m.forWho}`);
line();
for (const r of C.ROUTES) {
  item(`**${r.label}** → [${r.miqats.join(', ') || 'inside the boundary'}] — ${r.note}`);
  for (const extra of r.extra ?? []) item(`&nbsp;&nbsp;↳ ${extra}`);
}
line();
for (const [mode, steps] of Object.entries(C.ROUTE_STEPS)) for (const t of steps) item(`**${mode} travel:** ${t}`);

line();
line('## 4. Duas and supplications');
for (const d of C.DUAS) {
  line();
  line(`### ${d.title} — _${C.BASIS_LABEL[d.basis]}_ (${d.category})`);
  if (d.when) item(`**When:** ${d.when}`);
  if (d.arabic) item(`**Arabic:** ${d.arabic}`);
  if (d.transliteration) item(`**Transliteration:** ${d.transliteration}`);
  if (d.translation) item(`**Translation:** ${d.translation}`);
  if (d.source) item(`**Source:** ${d.source}`);
  if (d.note) item(`**Note:** ${d.note}`);
}
line();
item(`**Tawaf note:** ${C.TAWAF_DUA_NOTE}`);
item(`**Sa’i note:** ${C.SAI_DUA_NOTE}`);

line();
line('## 5. Audio recitations');
line();
line('Every clip below is a real reciter’s recording, fetched at build time — never the phone’s speech engine. **Please listen to each one and confirm it actually recites the Arabic shown on its card, in full and correctly** — this is the one thing in this sheet that cannot be checked by reading, only by ear.');
line();
line('### Qur’an (by surah:ayah — unambiguous, but still worth a listen)');
for (const [id, v] of Object.entries(QURAN)) {
  const d = C.DUAS.find((x) => x.id === id);
  item(`**${d?.title ?? id}** (${v.label}) — reciter: ${RECITERS.husary.name}. Card Arabic: ${d?.arabic ?? '(not found in content.js)'}`);
}
line();
line('### Ḥiṣn al-Muslim duas');
line();
line('⚠️ **Numbering caution:** hisnmuslim.com publishes at least two different numbering schemes — a ~132-chapter index and this flat per-recording audio numbering (`hisnmuslim.com/audio/ar/{item}.mp3`), and they do **not** line up. The item numbers below follow the flat audio numbering used by long-established Hisn al-Muslim apps, but this could not be independently re-confirmed against an authoritative published mapping during this update. Treat every item below as unverified until a reviewer has listened to it.');
line();
for (const [id, h] of Object.entries(HISN)) {
  const d = C.DUAS.find((x) => x.id === id);
  item(`**${d?.title ?? id}** — Ḥiṣn al-Muslim item ${h.item} (\`hisnmuslim.com/audio/ar/${h.item}.mp3\`)${h.narration ? ' — recording reads the surrounding hadith, not only the dua' : ''}. Card Arabic: ${d?.arabic ?? '(not found in content.js)'}`);
}

line();
line('## 6. Hair');
for (const [gender, opts] of Object.entries(C.HAIR_OPTIONS)) for (const o of opts) item(`**${gender}:** ${o.label} — ${o.note}`);

line();
line('## 7. Practical information');
for (const e of C.EMERGENCY_NUMBERS) item(`${e.label}: ${e.number}`);
for (const g of Object.values(C.GUIDES)) for (const p of g.points) item(`**${g.title}:** ${p}`);

line();
line('## 8. Voice guide (spoken aloud)');
line();
line('Transliterations here are spelled for the speech engine, not for the screen.');
line();
for (const [stage, text] of Object.entries(V.STAGE_LINES)) item(`**${stage}:** ${text}`);
item(`**Tawaf round:** ${V.stageLine('TAWAF_ROUND_3')}`);
item(`**Sa’i lap:** ${V.stageLine('SAI_4')}`);
item(`**Round confirmed:** ${V.roundConfirmed(3)}`);
item(`**Lap confirmed:** ${V.lapConfirmed(3)}`);
item(`**Tawaf suggestion:** ${V.TAWAF_SUGGESTION}`);
item(`**Sa’i suggestion:** ${V.saiSuggestion('MARWAH')}`);
item(`**Green markers, men:** ${V.greenMarkers('male')}`);
item(`**Green markers, women:** ${V.greenMarkers('female')}`);
item(`**Weak signal:** ${V.WEAK_SIGNAL}`);
item(`**Miqat approaching:** ${V.miqatApproaching(120, 'Yalamlam')}`);
for (const sector of T.KAABA_SECTORS) item(`**Beside ${sector.label}:** ${V.sectorLine(sector)}`);

line();
line('## Sign-off');
line();
line('| Reviewer | School of thought (madhhab) | Sections reviewed | Date | Signature |');
line('|---|---|---|---|---|');
line('| | | | | |');
line();

await mkdir(new URL('../docs/', import.meta.url), { recursive: true });
await writeFile(new URL('../docs/CONTENT_REVIEW.md', import.meta.url), out.join('\n'));
console.log(`Wrote docs/CONTENT_REVIEW.md (${out.filter((l) => l.startsWith('- [ ]')).length} items to review).`);
