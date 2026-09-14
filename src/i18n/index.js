// Translations. Strings are looked up by their English text, so the English
// stays readable in the code and every language falls back to English for
// anything not yet translated. Placeholders are written {name}.
//
// Arabic duas, Qur'an and transliterations are never translated — only the
// words around them.
import hi from './hi.js';
import ta from './ta.js';
import ml from './ml.js';

export const LANGUAGES = Object.freeze([
  { code: 'en', name: 'English', native: 'English', speech: 'en-GB' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', speech: 'hi-IN' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', speech: 'ta-IN' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', speech: 'ml-IN' },
]);

const PACKS = { hi, ta, ml };
let current = 'en';

export function setLanguage(code) {
  current = LANGUAGES.some((l) => l.code === code) ? code : 'en';
  return current;
}

export const getLanguage = () => current;
export const languageInfo = (code = current) => LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];

export function t(text, vars) {
  if (text == null || text === '') return '';
  const pack = PACKS[current];
  let out = (pack && pack[text]) || text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (match, key) => (vars[key] ?? match));
  return out;
}

/** Translates each string of a list (guidance points and the like). */
export const tList = (items) => (items ?? []).map((item) => t(item));

export const packFor = (code) => PACKS[code] ?? {};
