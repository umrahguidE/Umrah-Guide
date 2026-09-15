// Translations. Strings are looked up by their English text, so the English
// stays readable in the code and every language falls back to English for
// anything not yet translated. Placeholders are written {name}.
//
// Arabic duas, Qur'an and transliterations are never translated — only the
// words around them. The translated packs are drafts that have not yet been
// checked by native speakers.
import hi from './hi.js';
import ur from './ur.js';
import bn from './bn.js';
import id from './id.js';
import tr from './tr.js';
import ta from './ta.js';
import ml from './ml.js';

export const LANGUAGES = Object.freeze([
  { code: 'en', name: 'English', native: 'English', speech: 'en-GB', dir: 'ltr' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', speech: 'hi-IN', dir: 'ltr' },
  { code: 'ur', name: 'Urdu', native: 'اردو', speech: 'ur-PK', dir: 'rtl' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', speech: 'bn-BD', dir: 'ltr' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', speech: 'id-ID', dir: 'ltr' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe', speech: 'tr-TR', dir: 'ltr' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', speech: 'ta-IN', dir: 'ltr' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', speech: 'ml-IN', dir: 'ltr' },
]);

const PACKS = { hi, ur, bn, id, tr, ta, ml };
let current = 'en';
let recorder = null;

/** Test hook: collects every string passed to t(), to check translation coverage. */
export function recordStrings(set) {
  recorder = set;
}

export function setLanguage(code) {
  current = LANGUAGES.some((l) => l.code === code) ? code : 'en';
  return current;
}

export const getLanguage = () => current;
export const languageInfo = (code = current) => LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];

export function t(text, vars) {
  if (text == null || text === '') return '';
  recorder?.add(text);
  const pack = PACKS[current];
  let out = (pack && pack[text]) || text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (match, key) => (vars[key] ?? match));
  return out;
}

/** Translates each string of a list (guidance points and the like). */
export const tList = (items) => (items ?? []).map((item) => t(item));

export const packFor = (code) => PACKS[code] ?? {};
