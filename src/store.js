// Device persistence. Every state change is written synchronously, so progress
// survives the app being killed, the phone restarting or having no signal.
import { initialState } from './engine/machine.js';

const STATE_KEY = 'guided-umrah.state.v1';
const UNDO_KEY = 'guided-umrah.undo.v1';
const PREFS_KEY = 'guided-umrah.prefs.v1';
const UNDO_LIMIT = 20;

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadState() {
  const s = read(STATE_KEY);
  return s?.version === 1 ? s : initialState();
}
export const saveState = (s) => write(STATE_KEY, s);

export const defaultPrefs = () => ({
  checklist: {},
  info: {},
  personalDuas: [],
  miqatRoute: null,
  language: null,
  voice: { enabled: true },
  stepLengthM: null,
});

export const loadPrefs = () => {
  const saved = read(PREFS_KEY) ?? {};
  return { ...defaultPrefs(), ...saved, voice: { ...defaultPrefs().voice, ...(saved.voice ?? {}) } };
};
export const savePrefs = (p) => write(PREFS_KEY, p);

let undo = read(UNDO_KEY) ?? [];

export function pushUndo(s) {
  undo.push(s);
  if (undo.length > UNDO_LIMIT) undo = undo.slice(-UNDO_LIMIT);
  write(UNDO_KEY, undo);
}

export function popUndo() {
  const s = undo.pop() ?? null;
  write(UNDO_KEY, undo);
  return s;
}

export const undoDepth = () => undo.length;
