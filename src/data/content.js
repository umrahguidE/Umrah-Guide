/**
 * Religious and practical guidance content.
 *
 * STATUS: DRAFT — NOT SCHOLAR-REVIEWED.
 * Everything in this file must be reviewed and signed off by qualified scholars
 * before any public release. Run `npm run review:export` to produce
 * docs/CONTENT_REVIEW.md, the sheet reviewers work from. When an item is
 * approved, set its `review` to { status: 'reviewed', by, at }.
 *
 * Principles followed in this draft:
 *  - Only things that are established are presented as established, with the
 *    basis shown (Qur'an / Prophetic hadith / Companions' practice).
 *  - No fixed "Round 1 dua, Round 2 dua…". Outside the specific places that
 *    have established words, pilgrims make general dua, dhikr and Qur'an.
 *  - Where the schools differ, the text says so and points to the scholar.
 *  - Hadith numbering follows the common Dar-us-Salam / sunnah.com numbering;
 *    reviewers should verify each reference.
 */

const PENDING = Object.freeze({ status: 'pending', by: null, at: null });

export const CONTENT_META = Object.freeze({
  version: '0.1.0-draft',
  review: PENDING,
  note: 'This guidance is a draft written to reflect widely held positions. It has not yet been reviewed by qualified scholars. Where your scholar or group leader differs, follow them.',
});

export const REVIEW_NOTICE = 'Draft guidance — not yet scholar-reviewed';

// ───────────────────────── Preparation ─────────────────────────

export const PREP_CHECKLIST = [
  { id: 'documents', label: 'Passport / travel documents' },
  { id: 'visa', label: 'Visa and any required permits' },
  { id: 'accommodation', label: 'Accommodation' },
  { id: 'transport', label: 'Transportation' },
  { id: 'ihram', label: 'Ihram clothing' },
  { id: 'necessities', label: 'Personal necessities (unscented toiletries, sandals, medication, water bottle)' },
  { id: 'restrictions', label: 'Learn the Ihram restrictions', link: '#/ihram' },
  { id: 'miqat', label: 'Know your Miqat', link: '#/miqat' },
  { id: 'offline-guide', label: 'Download the offline Umrah guide', link: '#/offline' },
  { id: 'offline-audio', label: 'Download duas / audio', link: '#/offline' },
  { id: 'emergency', label: 'Save emergency information', link: '#/info' },
  { id: 'hotel', label: 'Save hotel location', link: '#/info' },
  { id: 'group', label: 'Save group / leader information', link: '#/info' },
];

// ───────────────────────── Understand Ihram ─────────────────────────

export const IHRAM_GUIDE = [
  {
    id: 'meaning',
    title: 'What Ihram means',
    points: [
      'Ihram is the sacred state a pilgrim enters with the intention of Umrah (or Hajj).',
      'The special clothing is part of it, but Ihram itself begins with the intention and the Talbiyah.',
    ],
  },
  {
    id: 'how',
    title: 'How to enter Ihram',
    points: [
      'Before reaching the Miqat (recommended): ghusl, and trim nails or remove unwanted hair if needed.',
      'Men may apply scent to the body — not to the Ihram garments — before making the intention.',
      'Put on the Ihram clothing.',
      'Scholars differ on whether there is a specific prayer for Ihram. If it is the time of an obligatory prayer, many enter Ihram after praying it.',
      'At the Miqat, make the intention and begin the Talbiyah.',
    ],
  },
  {
    id: 'men',
    title: 'What men wear',
    points: [
      'Two plain sheets: one wrapped around the waist (izār) and one over the shoulders (ridā’). White is preferred.',
      'No garments tailored to the shape of the body (shirts, trousers, underwear, socks) and no head covering.',
      'Sandals or footwear that leave the ankles uncovered.',
    ],
  },
  {
    id: 'women',
    title: 'What women wear',
    points: [
      'Ordinary loose, modest clothing that covers the body, in any colour — there is no special Ihram colour for women.',
      'Do not wear a face veil (niqāb) or gloves while in Ihram.',
      'Many scholars allow lowering a cloth over the face in the presence of non-mahram men.',
    ],
  },
  {
    id: 'intention',
    title: 'Intention (niyyah)',
    points: [
      'The intention is made in the heart. Saying it in words helps, especially on your first Umrah.',
      'Commonly taught wording: Allāhumma innī urīdul-ʿumrata fa-yassirhā lī wa taqabbalhā minnī — “O Allah, I intend to perform Umrah, so make it easy for me and accept it from me.”',
      'Then begin the Talbiyah for Umrah: Labbayka Allāhumma ʿumratan — “Here I am, O Allah, for Umrah.”',
      'If you fear illness or an obstacle may stop you from completing Umrah, you may add the condition: Allāhumma maḥillī ḥaythu ḥabastanī.',
    ],
  },
  {
    id: 'talbiyah',
    title: 'Talbiyah',
    points: ['Begin after making the intention and recite it often until you start Tawaf.', 'Men recite it aloud; women recite it quietly.'],
  },
  {
    id: 'restrictions',
    title: 'Restrictions while in Ihram',
    points: [
      'Removing hair or clipping nails.',
      'Using perfume or scented products on the body or clothing.',
      'Men: wearing tailored/fitted clothing or covering the head.',
      'Women: wearing a niqāb or gloves.',
      'Hunting land animals.',
      'Marriage contracts and proposals.',
      'Sexual relations and anything leading to them.',
      'Avoid arguing, obscene talk and all sin.',
      'If a restriction is broken by mistake, forgetfulness or out of need, the ruling (and any compensation, fidyah) depends on the case — ask a scholar.',
    ],
  },
  {
    id: 'special',
    title: 'Special circumstances',
    points: [
      'A woman with menstruation or post-natal bleeding may enter Ihram, but does not perform Tawaf until she is pure. Ask a scholar about your situation and travel dates.',
      'Illness, disability and children each have specific rulings — ask a scholar. Wheelchairs and carts are available in the Haram.',
    ],
  },
].map((s) => ({ ...s, review: PENDING }));

// ───────────────────────── Miqat ─────────────────────────
// Coordinates are approximate and must be verified before release.

export const MIQATS = [
  { id: 'dhul-hulayfah', name: 'Dhul-Ḥulayfah', modern: 'Abyār ʿAlī (Masjid ash-Shajarah)', coords: { lat: 24.4136, lng: 39.5431 }, forWho: 'People coming from Madinah and those travelling via it.' },
  { id: 'juhfah', name: 'Al-Juḥfah', modern: 'near Rābigh', coords: { lat: 22.7106, lng: 39.1447 }, forWho: 'People of Egypt, the Levant, North Africa and those on routes from the north-west.' },
  { id: 'qarn', name: 'Qarn al-Manāzil', modern: 'As-Sayl al-Kabīr', coords: { lat: 21.6331, lng: 40.4269 }, forWho: 'People of Najd, Riyadh, Ṭā’if, the Gulf and many eastern routes.' },
  { id: 'yalamlam', name: 'Yalamlam', modern: 'As-Saʿdiyyah', coords: { lat: 20.5383, lng: 39.8836 }, forWho: 'People of Yemen, the south, and many sea and air routes from South and South-East Asia.' },
  { id: 'dhat-irq', name: 'Dhāt ʿIrq', modern: 'Aḍ-Ḍarībah', coords: { lat: 21.9333, lng: 40.4333 }, forWho: 'People of Iraq and the north-east.' },
].map((m) => ({ ...m, review: PENDING }));

// Route-aware Miqat guidance lives in its own file: there are many routes.
export { ROUTES, ROUTE_GROUPS, ROUTE_STEPS, routeById } from './routes.js';

// ───────────────────────── Stage guidance ─────────────────────────

export const GUIDANCE = {
  MIQAT: {
    lead: 'The Miqat is the boundary at which a pilgrim heading for Umrah must already be in Ihram. Which Miqat applies depends on your route.',
    points: [
      'Get ready before you reach it: ghusl, trimming and putting on Ihram clothing can all be done beforehand — at home, at the airport or in your hotel.',
      'If you intend Umrah, do not pass the Miqat without entering Ihram.',
      'Flying? Enter Ihram when the aircraft passes over or parallel to the Miqat — not after landing in Jeddah.',
      'Scholars differ on a few route cases. If your situation is unusual, follow your scholar.',
    ],
  },
  IHRAM: {
    lead: 'Ihram is the sacred state you enter by making the intention for Umrah — not just the clothing.',
    checks: {
      prepared: { label: 'Prepared for Ihram', help: 'Ghusl (recommended) and Ihram clothing on. Men: any scent on the body only, before the intention — none on the garments.' },
      intention: { label: 'Intention made', help: 'Intend Umrah in your heart. You may say: Allāhumma innī urīdul-ʿumrata fa-yassirhā lī wa taqabbalhā minnī.' },
      talbiyah: { label: 'Talbiyah started', help: 'Begin reciting the Talbiyah (shown on the next screen).' },
    },
  },
  TALBIYAH: {
    lead: 'Recite the Talbiyah often from entering Ihram until you begin Tawaf.',
    points: ['Keep reciting on the way to Makkah. Background mode keeps the recitation playing while you use the rest of the app.', 'Stop the Talbiyah when you begin Tawaf.'],
    men: ['Men raise their voices with the Talbiyah.'],
    women: ['Women recite it quietly, so that only those beside them hear.'],
  },
  ENTER_HARAM: {
    lead: 'You are in Makkah and your Ihram is active. Next: Tawaf.',
    points: [
      'Enter with your right foot and say the dua for entering the mosque.',
      'Know your starting point: the line of the Black Stone corner, marked by a green light on the mosque wall opposite it.',
      'Keep the Kaaba on your LEFT the whole time.',
      'Follow the flow of the crowd. Do not push. Do not obstruct other pilgrims.',
      'Agree a meeting point with your group and note the gate number you entered by.',
    ],
  },
  TAWAF_READY: {
    lead: 'Go to the line of the Black Stone corner. Every round starts and ends here.',
    ready: [
      { id: 'wudu', label: 'I have wudu', help: 'Most scholars require wudu for Tawaf.' },
      { id: 'talbiyah', label: 'I have stopped the Talbiyah', help: 'The Talbiyah ends when Tawaf begins.' },
      { id: 'idtiba', label: 'Right shoulder uncovered', help: 'Men only, for this Tawaf: the upper sheet goes under the right arm and over the left shoulder (iḍṭibāʿ).', men: true },
    ],
    points: [
      'Face the Black Stone. If it is easy and safe, touch or kiss it. If it is crowded, point towards it with your right hand from where you are and say “Allāhu akbar”. Never push or harm anyone to reach it — touching it is not required.',
      'Walk outside the low semicircular wall (Ḥijr Ismāʿīl / al-Ḥaṭīm). It is part of the Kaaba, so walking through it does not count.',
    ],
  },
  TAWAF_ROUND: {
    points: [
      'There is no fixed dua that must be said in each round. Make dhikr and dua and recite Qur’an as you wish.',
      'Between the Yemeni Corner and the Black Stone, say “Rabbanā ātinā…” (see Duas).',
      'Touch the Yemeni Corner with your right hand if it is easy, without kissing it. If you cannot reach it, simply pass by.',
      'Each time you reach the Black Stone line, point towards it and say “Allāhu akbar”, then begin the next round.',
    ],
    ramal: 'Men, rounds 1–3 only: ramal — walk briskly with short steps, if you can do so without harming anyone.',
  },
  PAUSE: 'If the congregational prayer begins, join it, then continue from where you stopped. Ask your scholar about resuming after a long break.',
  DOUBT: 'If you are unsure of your count, scholars commonly advise building on the lower number you are certain of.',
  TAWAF_COMPLETE: {
    men: ['Cover your right shoulder again (end iḍṭibāʿ) before praying.'],
  },
  TWO_RAKAH: {
    lead: 'Pray two rak’ahs after Tawaf.',
    points: [
      'Behind Maqām Ibrāhīm if there is space. If it is crowded, pray anywhere in the mosque — do not block the people doing Tawaf.',
      'It is Sunnah to recite Sūrat al-Kāfirūn in the first rak’ah and Sūrat al-Ikhlāṣ in the second.',
    ],
  },
  ZAMZAM: {
    lead: 'Drink Zamzam if it is available.',
    points: [
      'Say Bismillāh and drink.',
      'Make your own dua — there is no fixed formula to recite.',
      'If it is easy, you may return to touch the Black Stone before going to Safa (Sunnah). Skip it if it is crowded.',
    ],
  },
  SAFA: {
    lead: 'Sa’i starts at Safa — not Marwah.',
    points: [
      'As you approach Safa, recite “Inna aṣ-Ṣafā wal-Marwata min shaʿā’irillāh…” and “Abda’u bimā bada’a Allāhu bih” — once, at the start of Sa’i only.',
      'Go up Safa if you can, face the Kaaba, raise your hands, say “Allāhu akbar” and the dhikr (below), and make dua — three times.',
    ],
  },
  SAI_LAP: {
    points: [
      'There is no fixed dua for each lap. Make dhikr and dua and recite Qur’an as you wish.',
      'On reaching Safa or Marwah, face the Kaaba, raise your hands and repeat the dhikr and dua as you did at Safa (the verse is recited only at the start).',
    ],
    men: ['Between the green markers, jog (walk quickly) if you are able.'],
    women: ['Walk at your normal pace the whole way, including between the green markers.'],
  },
  SAI_COMPLETE: {
    lead: 'Your seventh lap ended at Marwah. Next: the hair ritual.',
  },
  HAIR: {
    lead: 'The final step of Umrah.',
    points: ['If you are performing Hajj at-Tamattuʿ soon, many scholars recommend that men shorten now and shave after Hajj.'],
  },
  IHRAM_EXIT: {
    lead: 'With the hair ritual done, your Umrah is complete and the Ihram restrictions have ended.',
  },
};

export const HAIR_OPTIONS = {
  male: [
    { value: 'shave', label: 'Shave (ḥalq)', note: 'Shave the whole head. This is more virtuous for men.' },
    { value: 'shorten', label: 'Shorten (taqṣīr)', note: 'Shorten hair from all over the head, not just a few strands.' },
  ],
  female: [{ value: 'shorten', label: 'Shorten hair', note: 'Gather the hair and cut about a fingertip’s length (around 2 cm) from the ends. Women do not shave.' }],
};

// ───────────────────────── Duas ─────────────────────────

export const BASIS_LABEL = {
  quran: 'Qur’an',
  hadith: 'Prophetic hadith',
  companion: 'Companions’ practice',
  taught: 'Commonly taught wording',
  general: 'General guidance',
};

export const DUA_CATEGORIES = [
  { id: 'established', icon: '📖', label: 'Established supplications', intro: 'Words tied to particular places and moments of Umrah, with their source.' },
  { id: 'dhikr', icon: '📿', label: 'Dhikr', intro: 'Remembrance you can repeat anywhere — during Tawaf, Sa’i or while waiting.' },
  { id: 'general', icon: '🤲', label: 'General dua', intro: 'Ask Allah for anything, in any language.' },
  { id: 'quran', icon: '📖', label: 'Qur’an', intro: 'Reciting Qur’an during Tawaf and Sa’i is good.' },
  { id: 'personal', icon: '❤️', label: 'My personal duas', intro: 'Your own list — the duas you promised family and friends. Saved on this device only.' },
];

export const TAWAF_DUA_NOTE =
  'There is no fixed dua that must be said in each of the seven rounds. Booklets that give a special dua for “Round 1”, “Round 2” and so on are not a requirement. Make dhikr and dua and recite Qur’an; the items marked for Tawaf below belong to particular places.';
export const SAI_DUA_NOTE =
  'There is no fixed dua for each lap of Sa’i. The established words are said at Safa and Marwah; between them, make any dua, dhikr or Qur’an.';

export const DUAS = [
  {
    id: 'talbiyah',
    category: 'established',
    basis: 'hadith',
    contexts: ['ihram'],
    title: 'Talbiyah',
    when: 'From entering Ihram until you begin Tawaf.',
    arabic: 'لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لَا شَرِيكَ لَكَ لَبَّيْكَ، إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالْمُلْكَ، لَا شَرِيكَ لَكَ',
    transliteration: 'Labbayka Allāhumma labbayk. Labbayka lā sharīka laka labbayk. Inna al-ḥamda wan-niʿmata laka wal-mulk. Lā sharīka lak.',
    translation: 'Here I am, O Allah, here I am. Here I am — You have no partner — here I am. All praise, all grace and all sovereignty belong to You. You have no partner.',
    source: 'Ṣaḥīḥ al-Bukhārī 1549; Ṣaḥīḥ Muslim 1184; Ḥiṣn al-Muslim no. 233',
  },
  {
    id: 'intention',
    category: 'established',
    basis: 'taught',
    contexts: ['ihram'],
    title: 'Intention for Umrah',
    when: 'At the Miqat, when entering Ihram. The intention itself is made in the heart.',
    arabic: 'اللَّهُمَّ إِنِّي أُرِيدُ الْعُمْرَةَ فَيَسِّرْهَا لِي وَتَقَبَّلْهَا مِنِّي',
    transliteration: 'Allāhumma innī urīdul-ʿumrata fa-yassirhā lī wa taqabbalhā minnī.',
    translation: 'O Allah, I intend to perform Umrah, so make it easy for me and accept it from me.',
    source: 'The commonly taught wording of the intention for Umrah',
    note: 'After making the intention, begin the Talbiyah for Umrah.',
  },
  {
    id: 'labbayka-umrah',
    category: 'established',
    basis: 'hadith',
    contexts: ['ihram'],
    title: 'Talbiyah for Umrah',
    when: 'Straight after the intention, to begin your Umrah.',
    arabic: 'لَبَّيْكَ اللَّهُمَّ عُمْرَةً',
    transliteration: 'Labbayka Allāhumma ʿumratan.',
    translation: 'Here I am, O Allah, for Umrah.',
    source: 'Ṣaḥīḥ Muslim 1251 (ḥadīth of Anas), wording for Umrah alone',
  },
  {
    id: 'ishtirat',
    category: 'established',
    basis: 'hadith',
    contexts: ['ihram'],
    title: 'Condition when entering Ihram (optional)',
    when: 'For someone who fears illness or an obstacle may prevent them completing Umrah.',
    arabic: 'اللَّهُمَّ مَحِلِّي حَيْثُ حَبَسْتَنِي',
    transliteration: 'Allāhumma maḥillī ḥaythu ḥabastanī.',
    translation: 'O Allah, my place of leaving Ihram is wherever You hold me back.',
    source: 'Ṣaḥīḥ al-Bukhārī 5089; Ṣaḥīḥ Muslim 1207 (Ḍubāʿah bint az-Zubayr)',
    note: 'Scholars differ on whether this is for everyone or only for those with a reason to fear.',
  },
  {
    id: 'enter-mosque',
    category: 'established',
    basis: 'hadith',
    contexts: ['haram'],
    title: 'Entering the mosque',
    when: 'Entering Masjid al-Haram (or any mosque), right foot first.',
    arabic: 'أَعُوذُ بِاللَّهِ الْعَظِيمِ، وَبِوَجْهِهِ الْكَرِيمِ، وَسُلْطَانِهِ الْقَدِيمِ، مِنَ الشَّيْطَانِ الرَّجِيمِ، بِسْمِ اللَّهِ، وَالصَّلَاةُ وَالسَّلَامُ عَلَى رَسُولِ اللَّهِ، اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ',
    transliteration: 'Aʿūdhu billāhil-ʿaẓīm, wa bi-wajhihil-karīm, wa sulṭānihil-qadīm, minash-shayṭānir-rajīm. Bismillāh, waṣ-ṣalātu was-salāmu ʿalā rasūlillāh. Allāhumma iftaḥ lī abwāba raḥmatik.',
    translation: 'I seek refuge in Allah the Almighty, in His noble Face and His eternal authority, from the accursed devil. In the name of Allah, and blessings and peace be upon the Messenger of Allah. O Allah, open for me the gates of Your mercy.',
    source: 'Ḥiṣn al-Muslim no. 20 (Abū Dāwūd 466; Ibn as-Sunnī 88; Muslim 713)',
  },
  {
    id: 'black-stone',
    category: 'established',
    basis: 'hadith',
    contexts: ['tawaf'],
    title: 'At the Black Stone',
    when: 'At the start of Tawaf and each time you pass the Black Stone — touching it if easy, otherwise pointing to it with your right hand from where you are.',
    arabic: 'اللَّهُ أَكْبَرُ',
    transliteration: 'Allāhu akbar.',
    translation: 'Allah is the Greatest.',
    source: 'Ṣaḥīḥ al-Bukhārī 1613; Ḥiṣn al-Muslim no. 234',
    note: 'Some also say “Bismillāh” at the start of Tawaf, reported from Ibn ʿUmar. Never push or harm others to reach the Stone.',
  },
  {
    id: 'yemeni-corner',
    category: 'established',
    basis: 'hadith',
    contexts: ['tawaf'],
    title: 'Between the Yemeni Corner and the Black Stone',
    when: 'In every round, on the stretch between the Yemeni Corner and the Black Stone.',
    arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
    transliteration: 'Rabbanā ātinā fid-dunyā ḥasanatan wa fil-ākhirati ḥasanatan wa qinā ʿadhāban-nār.',
    translation: 'Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.',
    source: 'Sunan Abī Dāwūd 1892; the words are Qur’an 2:201; Ḥiṣn al-Muslim no. 235',
  },
  {
    id: 'maqam',
    category: 'established',
    basis: 'quran',
    contexts: ['after-tawaf'],
    title: 'At Maqām Ibrāhīm',
    when: 'Going to pray the two rak’ahs after Tawaf.',
    arabic: 'وَاتَّخِذُوا مِنْ مَقَامِ إِبْرَاهِيمَ مُصَلًّى',
    transliteration: 'Wattakhidhū min maqāmi Ibrāhīma muṣallā.',
    translation: 'And take the station of Ibrāhīm as a place of prayer.',
    source: 'Qur’an 2:125; recited by the Prophet ﷺ per Ṣaḥīḥ Muslim 1218',
    note: 'In the two rak’ahs, recite al-Kāfirūn and al-Ikhlāṣ. Pray anywhere in the mosque if the area is crowded.',
  },
  {
    id: 'zamzam',
    category: 'established',
    basis: 'hadith',
    contexts: ['after-tawaf'],
    title: 'Drinking Zamzam',
    when: 'After the two rak’ahs, if Zamzam is available.',
    arabic: 'مَاءُ زَمْزَمَ لِمَا شُرِبَ لَهُ',
    transliteration: 'Mā’u Zamzama limā shuriba lah.',
    translation: 'The water of Zamzam is for whatever it is drunk for.',
    source: 'Sunan Ibn Mājah 3062',
    note: 'This is a hadith about Zamzam, not a formula to recite. Say Bismillāh, drink, and ask Allah for whatever you need.',
  },
  {
    id: 'safa-verse',
    category: 'established',
    basis: 'quran',
    contexts: ['sai'],
    title: 'Approaching Safa',
    when: 'When you first approach Safa to begin Sa’i — once, not every lap.',
    arabic: 'إِنَّ الصَّفَا وَالْمَرْوَةَ مِنْ شَعَائِرِ اللَّهِ ۝ أَبْدَأُ بِمَا بَدَأَ اللَّهُ بِهِ',
    transliteration: 'Inna aṣ-Ṣafā wal-Marwata min shaʿā’irillāh. Abda’u bimā bada’a Allāhu bih.',
    translation: 'Indeed, Safa and Marwah are among the symbols of Allah. I begin with what Allah began with.',
    source: 'Qur’an 2:158; Ṣaḥīḥ Muslim 1218 (ḥadīth of Jābir)',
  },
  {
    id: 'safa-marwah-dhikr',
    category: 'established',
    basis: 'hadith',
    contexts: ['sai'],
    title: 'On Safa and on Marwah',
    when: 'On Safa and each time you reach Safa or Marwah: face the Kaaba, raise your hands, say “Allāhu akbar”, then this — three times, with your own dua in between.',
    arabic: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ، أَنْجَزَ وَعْدَهُ، وَنَصَرَ عَبْدَهُ، وَهَزَمَ الْأَحْزَابَ وَحْدَهُ',
    transliteration: 'Lā ilāha illallāhu waḥdahu lā sharīka lah, lahul-mulku wa lahul-ḥamd, wa huwa ʿalā kulli shay’in qadīr. Lā ilāha illallāhu waḥdah, anjaza waʿdah, wa naṣara ʿabdah, wa hazamal-aḥzāba waḥdah.',
    translation: 'None has the right to be worshipped but Allah alone, without partner. His is the dominion and His is the praise, and He has power over all things. None has the right to be worshipped but Allah alone. He fulfilled His promise, gave victory to His servant, and alone defeated the confederates.',
    source: 'Ṣaḥīḥ Muslim 1218 (ḥadīth of Jābir); Ḥiṣn al-Muslim no. 236',
  },
  {
    id: 'green-markers',
    category: 'established',
    basis: 'companion',
    contexts: ['sai'],
    title: 'Between the green markers',
    when: 'Reported as said between the green markers during Sa’i.',
    arabic: 'رَبِّ اغْفِرْ وَارْحَمْ، إِنَّكَ أَنْتَ الْأَعَزُّ الْأَكْرَمُ',
    transliteration: 'Rabbighfir warḥam, innaka antal-aʿazzul-akram.',
    translation: 'My Lord, forgive and have mercy. You are the Most Mighty, the Most Generous.',
    source: 'Reported from Ibn Masʿūd and Ibn ʿUmar (Muṣannaf Ibn Abī Shaybah)',
    note: 'This is the practice of Companions, not a fixed formula from the Prophet ﷺ. Any dua is fine here.',
  },
  {
    id: 'leave-mosque',
    category: 'established',
    basis: 'hadith',
    contexts: ['haram'],
    title: 'Leaving the mosque',
    when: 'Leaving Masjid al-Haram (or any mosque), left foot first.',
    arabic: 'بِسْمِ اللَّهِ، وَالصَّلَاةُ وَالسَّلَامُ عَلَى رَسُولِ اللَّهِ، اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ، اللَّهُمَّ اعْصِمْنِي مِنَ الشَّيْطَانِ الرَّجِيمِ',
    transliteration: 'Bismillāh, waṣ-ṣalātu was-salāmu ʿalā rasūlillāh. Allāhumma innī as’aluka min faḍlik. Allāhumma-ʿṣimnī minash-shayṭānir-rajīm.',
    translation: 'In the name of Allah, and blessings and peace be upon the Messenger of Allah. O Allah, I ask You of Your bounty. O Allah, protect me from the accursed devil.',
    source: 'Ḥiṣn al-Muslim no. 21 (Muslim 713; Ibn Mājah 773)',
  },
  {
    id: 'four-words',
    category: 'dhikr',
    basis: 'hadith',
    contexts: ['tawaf', 'sai'],
    title: 'The four most beloved words',
    arabic: 'سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَلَا إِلَهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ',
    transliteration: 'Subḥānallāh, wal-ḥamdu lillāh, wa lā ilāha illallāh, wallāhu akbar.',
    translation: 'Glory be to Allah, all praise is for Allah, none has the right to be worshipped but Allah, and Allah is the Greatest.',
    source: 'Ṣaḥīḥ Muslim 2137; Ḥiṣn al-Muslim no. 261',
  },
  {
    id: 'istighfar',
    category: 'dhikr',
    basis: 'hadith',
    contexts: ['tawaf', 'sai'],
    title: 'Seeking forgiveness',
    arabic: 'أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ الَّذِي لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ وَأَتُوبُ إِلَيْهِ',
    transliteration: 'Astaghfirullāhal-ʿaẓīm, alladhī lā ilāha illā huwal-ḥayyul-qayyūm, wa atūbu ilayh.',
    translation: 'I seek the forgiveness of Allah the Almighty, besides whom none has the right to be worshipped, the Ever-Living, the Sustainer of all, and I turn to Him in repentance.',
    source: 'Ḥiṣn al-Muslim no. 250 (Abū Dāwūd 1517; at-Tirmidhī 3577)',
  },
  {
    id: 'hawqala',
    category: 'dhikr',
    basis: 'hadith',
    contexts: ['tawaf', 'sai'],
    title: 'A treasure of Paradise',
    arabic: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
    transliteration: 'Lā ḥawla wa lā quwwata illā billāh.',
    translation: 'There is no might and no power except with Allah.',
    source: 'Ṣaḥīḥ al-Bukhārī 6384; Ṣaḥīḥ Muslim 2704; Ḥiṣn al-Muslim no. 260',
  },
  {
    id: 'afw-afiyah',
    category: 'general',
    basis: 'hadith',
    contexts: ['tawaf', 'sai'],
    title: 'Pardon and well-being',
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ',
    transliteration: 'Allāhumma innī as’alukal-ʿafwa wal-ʿāfiyata fid-dunyā wal-ākhirah.',
    translation: 'O Allah, I ask You for pardon and well-being in this world and the Hereafter.',
    source: 'Sunan Abī Dāwūd 5074; Sunan Ibn Mājah 3871',
  },
  {
    id: 'own-words',
    category: 'general',
    basis: 'general',
    contexts: ['tawaf', 'sai'],
    title: 'In your own words',
    when: 'Any time during Tawaf and Sa’i.',
    note: 'Ask Allah in any language — for yourself, your parents, your family, the people who asked you to pray for them, and all Muslims. Sincerity matters more than wording.',
  },
  {
    id: 'recite-quran',
    category: 'quran',
    basis: 'general',
    contexts: ['tawaf', 'sai'],
    title: 'Recite what you know',
    when: 'Any time during Tawaf and Sa’i.',
    note: 'Recite any Qur’an you know from memory. There are no set sūrahs for particular rounds or laps.',
  },
].map((d) => ({ ...d, review: PENDING }));

// ───────────────────────── Practical ─────────────────────────

export const EMERGENCY_NUMBERS = [
  { label: 'Unified emergency number', number: '911' },
  { label: 'Ambulance (Saudi Red Crescent)', number: '997' },
  { label: 'Police', number: '999' },
  { label: 'Civil Defence', number: '998' },
];
export const EMERGENCY_NOTE = 'Verify these numbers before release and before travel.';

export const GUIDES = {
  makkah: {
    title: 'Makkah guide',
    points: [
      'Save your hotel and a meeting point in My info before going to the Haram.',
      'Note the number of the gate you enter by — every gate of Masjid al-Haram is numbered.',
      'Drink water often. Zamzam coolers are placed throughout the mosque.',
      'Carry a card with your name, hotel, group and leader’s phone number.',
    ],
    planned: ['Offline map of the Haram: gates, Zamzam points, toilets and wheelchair services', 'Route back from the Haram to your hotel'],
  },
  madinah: {
    title: 'Madinah guide',
    points: ['Visiting Madinah is not part of the Umrah rites — your Umrah is complete without it.'],
    planned: ['Scholar-reviewed guidance for visiting Masjid an-Nabawi', 'Offline map of Masjid an-Nabawi and surroundings'],
  },
};
