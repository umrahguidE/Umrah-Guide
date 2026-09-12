# Guided Umrah

An offline-first companion that follows **one pilgrim through one Umrah**, from
preparation to completion, and always answers:

> Where am I? · What am I doing? · Which round? · What comes next? · What should I know here? · Am I finished?

```
Preparation → Miqat → Ihram (+ niyyah) → Talbiyah → Masjid al-Haram → Tawaf start
→ Tawaf rounds 1–7 → Tawaf complete → Two rak'ahs → Zamzam → Safa
→ Sa'i laps 1–7 (green-marker guidance) → Marwah → Hair → Exit Ihram → UMRAH COMPLETE
```

> ⚠️ **The religious content is a draft and has NOT been reviewed by scholars.**
> Do not release it publicly until `docs/CONTENT_REVIEW.md` has been signed off
> (see [Content review](#content-review)). The app shows a "Draft guidance"
> banner on every screen until then.

## Run it

No dependencies. Node 20+ is only needed for the dev server and the tests.

```bash
npm start                 # http://localhost:5173
                          # http://localhost:5173/?sim  → simulated GPS, compass and steps walk Tawaf and Sa'i for you
npm test                  # engine, tracking, motion, Miqat, content and screen tests
npm run build             # dist/ — what a static host serves and what Capacitor wraps
npm run review:export     # regenerate docs/CONTENT_REVIEW.md for reviewers
```

The app must be served over http(s): it uses ES modules, a service worker
(offline pack), geolocation and motion sensors. `localhost` works for
development; for a phone, deploy `dist/` to any HTTPS static host and choose
**Add to Home Screen**, or build the native apps — see
[docs/MOBILE.md](docs/MOBILE.md).

## How the counting stays accurate

No phone can count Tawaf rounds perfectly from GPS alone: the Mataf is roofed,
there are several floors, and crowds block the sky. So the app counts with
several independent signals and tells you which ones agree.

| Signal | What it does | Where it wins |
|---|---|---|
| **GPS** | Angle swept around the Kaaba; position along the Mas'a | Open courtyard, ground floor |
| **Compass / gyro** | A full circuit turns your body 360°, whatever your path | Indoors and on the upper floors, where GPS fails |
| **Steps** | Distance walked; a Sa'i lap is about 390 m | The covered Mas'a; also catches "a round in 12 steps" |
| **Corner checkpoints** | ʿIrāqī → Shāmī → Yemeni must be passed **in order** | Stops GPS jitter from inventing a round |

On top of that:

- Fixes worse than 35 m are dropped; jumps faster than walking are rejected; the rest are smoothed (1-D Kalman per axis).
- Every round and lap is recorded with the confidence it was counted at (`high` when GPS and compass agree, `medium` for a single signal, `low` when they disagree, `manual` when you counted yourself).
- Your **step length is learned automatically** from a Sa'i lap walked with good GPS, then used for the laps where GPS drops out.
- **Nothing is ever completed automatically.** The app only ever says "possible round completion" — you confirm.

## The live ritual engine

The heart of the app is a pure state machine in
[src/engine/machine.js](src/engine/machine.js): `transition(state, event) → state`.
Every stage from `MIQAT` to `UMRAH_COMPLETE`, including `TAWAF_ROUND_1…7` and
`SAI_1…7`, is one entry in `STAGE_ORDER` ([src/engine/stages.js](src/engine/stages.js)),
so the current stage alone says where the pilgrim is. The UI is only a view of
that state.

| Rule | How |
|---|---|
| **Tracking suggests, the pilgrim confirms.** | Trackers only ever produce `suggestCompletion`. A round or lap is recorded **only** by `CONFIRM_TAWAF_ROUND` / `CONFIRM_SAI_LAP`. |
| **The app's count is never authoritative.** | "Wrong count?" is on every round and lap screen (Tawaf until Sa'i starts, Sa'i until the hair ritual). Corrections are logged, never silent. |
| **A double tap can't skip a round.** | Buttons carry the stage they were drawn for, confirmations name the round, a 700 ms tap guard, and a prompt if the round started under 15 s ago. |
| **Pause never loses progress.** | `PAUSE` stops tracking and blocks confirmation; correction still works while paused. |
| **Weak signal never invents progress.** | When every signal is gone: *"Tracking signal weak"*, the last **confirmed** count, and a *Continue manually* button. |
| **Sa'i starts at Safa, ends at Marwah.** | Odd laps Safa → Marwah, even laps Marwah → Safa; the database enforces it too. |
| **Guidance fits the pilgrim.** | Men: iḍṭibāʿ, ramal in rounds 1–3, jogging between the green markers, shave or shorten. Women: walk normally, shorten only. |
| **Works with no signal.** | State is saved to the device after every step; the service worker caches the whole app. |

## Voice guide

The app speaks every step with the phone's own voice, offline: the stage you
have reached, each round and lap with its direction, the part of the Kaaba you
are beside ("Ḥijr Ismāʿīl — stay outside the wall"), the green markers, the
arrival at Safa or Marwah, weak signal, and the Miqat alert. Lines live in
[src/data/voice-lines.js](src/data/voice-lines.js) and are reviewed with the
rest of the content. There is an on/off button in the top bar, and more in
**More → Settings**.

For Arabic the app prefers a **real reciter**: if `audio/duas/<id>.mp3` exists
it plays that instead of the speech engine (`audio/talbiyah.mp3` for the
Talbiyah). No recordings ship with this build — they must come from a reciter
whose recording you have permission to distribute. Machine-spoken Arabic is off
by default because it mispronounces.

## Map

An offline schematic of Masjid al-Haram drawn in metres from the same
coordinates the tracker uses: Kaaba with the Black Stone corner and the start
line, the Mataf, Ḥijr Ismāʿīl, Maqām Ibrāhīm, and the Mas'a from Safa to Marwah
with the green-marker section. Your live position, its accuracy circle and your
trail are drawn on top, on its own tab and inside the round and lap screens.

## Miqat

32 routes grouped by how you travel — flights by country, roads and the Haramain
train by starting city, sea routes, and "already inside the boundary" cases
(Jeddah, Makkah, landed in Ihram). Each gives its Miqat(s), what to do step by
step, and route-specific notes. **Watch for my Miqat** keeps checking your
distance in flight and vibrates, speaks and warns as the line approaches. Where
a route can cross more than one Miqat, the app alerts at whichever comes first.

## Project layout

```
index.html, styles.css          App shell (mobile-first, light/dark)
sw.js, asset-manifest.json      Offline pack (service worker + file list)
capacitor.config.json           Android/iOS wrapper config (docs/MOBILE.md)
src/engine/                     Framework-free core; runs in the browser, Node or React Native
  stages.js                     Stage list, Sa'i directions, progress
  machine.js                    The ritual state machine + toRecords() for the database
  tracking.js                   Position filter, Tawaf and Sa'i trackers, Kaaba sectors
  motion.js                     Step detection, heading, step-length calibration
  miqat.js, geo.js              Route-aware Miqat check, geometry
src/data/                       ALL religious/practical text (draft; pending review)
  content.js, routes.js, voice-lines.js
src/ui/                         Views, components, map, voice, sensors, controller
docs/schema.sql                 One-pilgrim journey database
docs/CONTENT_REVIEW.md          Generated sheet for scholars to sign off
docs/MOBILE.md                  Google Play + App Store from this one codebase
tests/                          node --test suites
```

## Data model

[docs/schema.sql](docs/schema.sql) implements `umrah_session`, `tawaf_session`,
`tawaf_rounds`, `sai_session` and `sai_laps`, plus `tracking_confidence` and
`source` per round/lap, `ritual_pauses`, `count_corrections` and an append-only
`ritual_events` log. `toRecords(session)` produces exactly these rows; the
Journey tab exports them as JSON. Times are an app record only, never a
religious requirement.

## Calibration (required before real-world use)

Everything in `HARAM_GEO` ([src/engine/tracking.js](src/engine/tracking.js)) and
the Miqat coordinates in `content.js` are **approximate placeholders**:

- Kaaba centre, and the bearing from it to the Black Stone corner (the start line)
- The sector boundaries for each side of the Kaaba
- Safa and Marwah end points, and the green-marker section as a fraction of the Mas'a
- Coordinates of the five Miqats

Survey them on site, then re-run `npm test`.

## Content review

1. `npm run review:export` writes `docs/CONTENT_REVIEW.md` (~280 items: stage guidance, Ihram guide, Miqats and all routes, every dua with Arabic, transliteration, translation and source, hair rulings, emergency numbers, and every spoken voice line).
2. Qualified scholars mark each item approved, corrected or removed, and sign off with their name and madhhab.
3. Apply corrections in `src/data/`, then set `review: { status: 'reviewed', by, at }` on approved items. The "Pending scholar review" badges disappear item by item.
4. Remove the draft banner only when everything is reviewed.

Points where the schools differ are marked "Scholars differ" rather than decided by the app.

## Known limitations and next steps

- **Audio**: no recitation is bundled; see [audio/README.md](audio/README.md).
- **Background on phones**: a PWA cannot reliably track or play audio with the screen locked, especially on iOS. The app holds a Wake Lock during Tawaf and Sa'i; for true background work, build the native apps ([docs/MOBILE.md](docs/MOBILE.md)).
- **Languages**: English UI with Arabic texts. `language` is stored on the session; Urdu, Indonesian/Malay, Turkish, French and Arabic UI are next.
- **Not built yet**: gates and services on the map, family/group tracking, account sync (the schema is ready), and a scholar-reviewed Madinah guide.
- **Storage**: `localStorage` is enough for one pilgrim on one device; use IndexedDB or SQLite once sync arrives.
- **Emergency numbers** (911 / 997 / 999 / 998) must be verified before release.
