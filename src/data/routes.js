/**
 * Route-aware Miqat guidance. DRAFT — pending scholar review like the rest of
 * src/data/content.js.
 *
 * Where a route can cross more than one Miqat line, every possible one is
 * listed. The app then alerts at whichever line is reached FIRST, which is the
 * safe side: entering Ihram a little early is fine, passing a Miqat without it
 * is not.
 */

const PENDING = Object.freeze({ status: 'pending', by: null, at: null });

export const ROUTE_GROUPS = [
  { id: 'air', label: '✈️ Flying' },
  { id: 'land', label: '🚗 By road or train in Saudi Arabia' },
  { id: 'sea', label: '🚢 Arriving by sea' },
  { id: 'inside', label: '📍 Already inside the Miqat boundary' },
];

/** What to do, by kind of journey. */
export const ROUTE_STEPS = {
  air: [
    'Before the airport: ghusl (recommended), trim nails and unwanted hair, and put on the Ihram clothing. Men can travel in the two sheets from the start.',
    'If you prefer to change on board, change BEFORE the Miqat announcement — aircraft toilets get busy and you may not get in.',
    'Make the intention and begin the Talbiyah before the aircraft reaches the Miqat line, not after.',
    'Turn on “Watch for my Miqat” in this app before take-off. It keeps checking your distance even in flight mode, as long as location is allowed.',
    'Cabin crew usually announce the Miqat, but do not depend on it alone — announcements are sometimes missed, late, or not made at all.',
    'Aircraft cover 10–15 km every minute. When the app says you are 150 km away, you have roughly 10–15 minutes.',
    'Do not delay Ihram until you land in Jeddah — unless your own scholar has told you otherwise for your case.',
    'If you realise you passed the Miqat without Ihram, ask a scholar. Many say to go back to the Miqat if you can, otherwise there is a compensation (dam).',
  ],
  land: [
    'Prepare before you set out: ghusl (recommended), trim, and put on the Ihram clothing.',
    'Most road Miqats have a mosque with washrooms and changing rooms — you can also prepare there.',
    'Make the intention and begin the Talbiyah as you leave the Miqat, not before you have decided to start Umrah.',
    'If your bus or taxi will not stop at the Miqat, enter Ihram before you board.',
  ],
  sea: [
    'Prepare on board before the ship reaches the Miqat line.',
    'Make the intention and begin the Talbiyah when the ship passes the point parallel to the Miqat.',
    'Ask the ship’s guide or your group leader when that will be, and keep this app’s Miqat watch on.',
  ],
  inside: [
    'You do not pass a Miqat, so there is no line to watch for.',
    'Prepare (ghusl, Ihram clothing), then make the intention and begin the Talbiyah at the place named below.',
  ],
};

const route = (r) => ({ ...r, review: PENDING });

export const ROUTES = [
  // ── Flying ──────────────────────────────────────────────────────────────
  route({
    id: 'air-pakistan', group: 'air', mode: 'air', label: 'Pakistan (Karachi, Lahore, Islamabad, Peshawar)', miqats: ['qarn', 'yalamlam'],
    note: 'Flights from Pakistan cross the line of Qarn al-Manāzil or Yalamlam depending on the path they take that day.',
    extra: ['Many pilgrims from Pakistan enter Ihram at the airport before departure — this is safe and easy, and is what most groups do.'],
  }),
  route({
    id: 'air-india', group: 'air', mode: 'air', label: 'India', miqats: ['qarn', 'yalamlam'],
    note: 'Flights from India cross Yalamlam or Qarn al-Manāzil depending on the route.',
    extra: ['Flights from the south of India usually cross Yalamlam; from the north, Qarn al-Manāzil is more likely. Being in Ihram before either is the safe choice.'],
  }),
  route({
    id: 'air-bangladesh', group: 'air', mode: 'air', label: 'Bangladesh', miqats: ['qarn', 'yalamlam'],
    note: 'Flights from Bangladesh cross Yalamlam or Qarn al-Manāzil depending on the route.',
  }),
  route({
    id: 'air-srilanka-maldives', group: 'air', mode: 'air', label: 'Sri Lanka or the Maldives', miqats: ['yalamlam'],
    note: 'These routes come from the south-east and cross the line of Yalamlam.',
  }),
  route({
    id: 'air-indonesia-malaysia', group: 'air', mode: 'air', label: 'Indonesia, Malaysia, Brunei or Singapore', miqats: ['yalamlam'],
    note: 'The long-standing Miqat for pilgrims arriving from this direction is Yalamlam.',
    extra: ['Many groups enter Ihram at the departure airport, or at a stop such as Dubai or Doha, which is safer than waiting for an announcement.'],
  }),
  route({
    id: 'air-southeast-asia', group: 'air', mode: 'air', label: 'Thailand, the Philippines or elsewhere in South-East Asia', miqats: ['yalamlam', 'qarn'],
    note: 'Route-dependent: usually Yalamlam, sometimes Qarn al-Manāzil if you transit through the Gulf.',
  }),
  route({
    id: 'air-gulf', group: 'air', mode: 'air', label: 'UAE, Qatar, Kuwait, Bahrain or Oman', miqats: ['qarn'],
    note: 'Flights from the Gulf cross the line of Qarn al-Manāzil (as-Sayl al-Kabīr).',
    extra: ['These flights are short — often under two hours — so be in Ihram before boarding, or very soon after take-off.'],
  }),
  route({
    id: 'air-iran-iraq', group: 'air', mode: 'air', label: 'Iran or Iraq', miqats: ['dhat-irq', 'qarn'],
    note: 'Coming from the north-east, the Miqat is Dhāt ʿIrq; some routes cross Qarn al-Manāzil instead.',
  }),
  route({
    id: 'air-central-asia', group: 'air', mode: 'air', label: 'Central Asia, Afghanistan or China', miqats: ['dhat-irq', 'qarn'],
    note: 'Routes from the north-east and east cross Dhāt ʿIrq or Qarn al-Manāzil.',
  }),
  route({
    id: 'air-turkey-levant', group: 'air', mode: 'air', label: 'Türkiye, Syria, Lebanon, Jordan or Palestine', miqats: ['juhfah'],
    note: 'Coming from the north-west, the Miqat is al-Juḥfah (near Rābigh).',
  }),
  route({
    id: 'air-egypt-north-africa', group: 'air', mode: 'air', label: 'Egypt, Libya, Tunisia, Algeria or Morocco', miqats: ['juhfah'],
    note: 'Al-Juḥfah is the Miqat for those arriving from the direction of Egypt and North Africa.',
  }),
  route({
    id: 'air-europe', group: 'air', mode: 'air', label: 'The UK or Europe', miqats: ['juhfah'],
    note: 'Flights from Europe approach from the north-west and cross the line of al-Juḥfah.',
    extra: ['On a night flight, set an alarm — the Miqat is often crossed while the cabin is dark and people are asleep.'],
  }),
  route({
    id: 'air-americas', group: 'air', mode: 'air', label: 'North or South America', miqats: ['juhfah'],
    note: 'Whether you transit through Europe or the Gulf, the last leg usually crosses al-Juḥfah.',
    extra: ['If you transit through the Gulf (Dubai, Doha, Istanbul), the final leg may cross Qarn al-Manāzil instead — keep the Miqat watch on for the last flight.'],
  }),
  route({
    id: 'air-west-africa', group: 'air', mode: 'air', label: 'Nigeria, Ghana, Senegal, Sudan or Chad', miqats: ['juhfah'],
    note: 'Pilgrims arriving from this direction commonly take al-Juḥfah as their Miqat.',
  }),
  route({
    id: 'air-east-africa', group: 'air', mode: 'air', label: 'Kenya, Tanzania, Ethiopia, Somalia or Uganda', miqats: ['yalamlam'],
    note: 'Coming from the south, the Miqat is Yalamlam.',
  }),
  route({
    id: 'air-southern-africa', group: 'air', mode: 'air', label: 'South Africa or southern Africa', miqats: ['yalamlam'],
    note: 'These routes approach from the south and cross the line of Yalamlam.',
  }),
  route({
    id: 'air-australia', group: 'air', mode: 'air', label: 'Australia or New Zealand', miqats: ['yalamlam', 'qarn'],
    note: 'Usually Yalamlam; if you transit through the Gulf the last leg may cross Qarn al-Manāzil.',
  }),
  route({
    id: 'air-madinah-first', group: 'air', mode: 'air', label: 'Flying to MADINAH first (Umrah afterwards)', miqats: ['dhul-hulayfah'],
    note: 'Your flight to Madinah does not cross a Miqat. You enter Ihram later, at Dhul-Ḥulayfah (Abyār ʿAlī), when you set out for Makkah.',
    extra: ['Travel to Madinah in normal clothes. There is no Ihram and no Talbiyah on this flight.', 'When you leave for Makkah, use the “By road from Madinah” or “Haramain train” route in this list.'],
  }),
  route({
    id: 'air-taif', group: 'air', mode: 'air', label: 'Flying to Ṭā’if', miqats: ['qarn'],
    note: 'Ṭā’if is beyond the Miqat, so you enter Ihram when you set out for Makkah — at as-Sayl al-Kabīr, or at Wādī Muḥrim if you take the Hada road.',
  }),

  // ── Road and train ──────────────────────────────────────────────────────
  route({
    id: 'madinah-road', group: 'land', mode: 'land', label: 'By road from Madinah', miqats: ['dhul-hulayfah'],
    note: 'Enter Ihram at Dhul-Ḥulayfah (Abyār ʿAlī, Masjid ash-Shajarah), about 11 km from Masjid an-Nabawi.',
    extra: ['The mosque has washrooms and changing areas, and buses normally stop there.'],
  }),
  route({
    id: 'madinah-train', group: 'land', mode: 'land', label: 'Haramain train, Madinah → Makkah', miqats: ['dhul-hulayfah'],
    note: 'The train does not stop at the Miqat, so be in Ihram before it leaves.',
    extra: ['Most pilgrims go to Abyār ʿAlī first, enter Ihram there, then come to the station — or prepare at the hotel and make the intention before departure.', 'The journey is about two hours, so plan the Talbiyah and any prayer times around it.'],
  }),
  route({
    id: 'riyadh-road', group: 'land', mode: 'land', label: 'By road from Riyadh or the Eastern Province', miqats: ['qarn'],
    note: 'The highway passes as-Sayl al-Kabīr (Qarn al-Manāzil), which has a large Miqat mosque.',
  }),
  route({
    id: 'qassim-hail-road', group: 'land', mode: 'land', label: 'By road from Qassim, Ḥā’il or the north-east', miqats: ['dhat-irq', 'qarn', 'dhul-hulayfah'],
    note: 'Which Miqat applies depends on the road you take. Be in Ihram before the first one on your route.',
  }),
  route({
    id: 'taif-road', group: 'land', mode: 'land', label: 'By road from Ṭā’if', miqats: ['qarn'],
    note: 'On the main road, the Miqat is as-Sayl al-Kabīr. If you come down the Hada road, it is Wādī Muḥrim, which is the same Miqat from a different direction.',
  }),
  route({
    id: 'north-coast-road', group: 'land', mode: 'land', label: 'By road from Tabuk, Yanbu or the north coast', miqats: ['juhfah'],
    note: 'Enter Ihram at al-Juḥfah, near Rābigh.',
  }),
  route({
    id: 'south-road', group: 'land', mode: 'land', label: 'By road from Jazan, Abha or Yemen', miqats: ['yalamlam'],
    note: 'Enter Ihram at Yalamlam (as-Saʿdiyyah).',
  }),
  route({
    id: 'jeddah-airport-arrival', group: 'land', mode: 'inside', label: 'I have landed in Jeddah already in Ihram', miqats: [],
    note: 'Your Miqat is already behind you. Keep the Ihram restrictions, keep reciting the Talbiyah, and go on to Makkah.',
    extra: ['Do not change out of Ihram at the airport or hotel — you stay in Ihram until after the hair ritual.'],
  }),

  // ── Sea ─────────────────────────────────────────────────────────────────
  route({
    id: 'sea-north', group: 'sea', mode: 'sea', label: 'By sea from the north (Suez, Egypt, Jordan)', miqats: ['juhfah'],
    note: 'Enter Ihram when the ship is parallel to al-Juḥfah.',
  }),
  route({
    id: 'sea-south', group: 'sea', mode: 'sea', label: 'By sea from the south (Sudan, Yemen, East Africa)', miqats: ['yalamlam'],
    note: 'Enter Ihram when the ship is parallel to Yalamlam.',
  }),

  // ── Already inside ──────────────────────────────────────────────────────
  route({
    id: 'jeddah-resident', group: 'inside', mode: 'inside', label: 'I live in or am staying in Jeddah', miqats: [],
    note: 'Jeddah is inside the Miqat boundary. If you set out from Jeddah intending Umrah, enter Ihram from where you are — your home, your hotel or the mosque.',
    extra: ['This applies to people who are already in Jeddah. If you flew in intending Umrah, the Miqat on your flight path applied — ask a scholar if you passed it without Ihram.'],
  }),
  route({
    id: 'between-miqat-makkah', group: 'inside', mode: 'inside', label: 'I live between a Miqat and Makkah (Rābigh, Bahrah, ʿUsfān…)', miqats: [],
    note: 'People living inside the boundary enter Ihram from where they are.',
  }),
  route({
    id: 'in-makkah', group: 'inside', mode: 'inside', label: 'I am already in Makkah', miqats: [],
    note: 'For Umrah you go outside the Haram boundary to enter Ihram — most commonly Masjid ʿĀ’ishah at at-Tanʿīm — then return to Makkah for Tawaf.',
    extra: ['Taxis and buses to Masjid ʿĀ’ishah run all day and night from near the Haram.', 'Some go to al-Jiʿrānah or Ḥudaybiyah instead; all are outside the Haram boundary.'],
  }),
];

export const routeById = (id) => ROUTES.find((r) => r.id === id) ?? null;
