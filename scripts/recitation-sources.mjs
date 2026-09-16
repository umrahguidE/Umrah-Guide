/**
 * Pure data: which reciter, which Qur'anic verse, which Ḥiṣn al-Muslim item —
 * no network calls, no side effects. Shared by fetch-recitations.mjs (which
 * downloads the audio) and export-content-review.mjs (which documents the
 * mapping for scholar review) so the two can never drift apart.
 */

export const RECITERS = {
  husary: { name: 'Maḥmūd Khalīl al-Ḥuṣarī (murattal)', path: 'Husary_128kbps' },
  alafasy: { name: 'Mishary Rāshid al-ʿAfāsy', path: 'Alafasy_128kbps' },
  abdulbasit: { name: 'ʿAbd al-Bāsiṭ ʿAbd aṣ-Ṣamad (murattal)', path: 'Abdul_Basit_Murattal_192kbps' },
  minshawi: { name: 'Muḥammad Ṣiddīq al-Minshāwī (murattal)', path: 'Minshawy_Murattal_128kbps' },
  sudais: { name: 'ʿAbd ar-Raḥmān as-Sudais', path: 'Abdurrahmaan_As-Sudais_192kbps' },
};

// Dua card → Qur'anic verse. The card may show part of the verse; the recitation is the whole āyah.
// Verified by universal surah:ayah addressing — unambiguous regardless of any site's own numbering.
export const QURAN = {
  'yemeni-corner': { surah: 2, ayah: 201, label: 'Qur’an 2:201' },
  maqam: { surah: 2, ayah: 125, label: 'Qur’an 2:125' },
  'safa-verse': { surah: 2, ayah: 158, label: 'Qur’an 2:158' },
};

// Dua card → Ḥiṣn al-Muslim item (hisnmuslim.com/audio/ar/{item}.mp3). `narration` = the
// recording reads the surrounding hadith, not only the words of the dua.
//
// CAUTION: hisnmuslim.com exposes at least two different numbering schemes — a ~132-chapter
// index (its husn_en.json API) and this flat per-recording audio numbering, which are NOT the
// same sequence. The items below were entered by item number against the flat audio numbering
// used by long-established Hisn al-Muslim apps, but this could not be independently re-confirmed
// against an authoritative published mapping. Each entry MUST be listened to and checked against
// its card's Arabic text as part of scholar review before public release — see
// docs/CONTENT_REVIEW.md § Audio recitations.
export const HISN = {
  talbiyah: { item: 233, file: 'audio/talbiyah.mp3', narration: false },
  'enter-mosque': { item: 20, narration: false },
  'leave-mosque': { item: 21, narration: false },
  'black-stone': { item: 234, narration: true },
  'safa-marwah-dhikr': { item: 236, narration: true },
  istighfar: { item: 250, narration: true },
  hawqala: { item: 260, narration: true },
  'four-words': { item: 261, narration: true },
};
