// Voice guide: speaks each step, round, corner and arrival out loud in the
// pilgrim's language, using the phone's built-in speech (offline).
//
// The phone voice NEVER reads Arabic. Duas and Qur'an are only ever played
// from real recitations (audio/duas/index.json).

const SAME_LINE_COOLDOWN_MS = 8000;

export function createVoice({ synth = globalThis.speechSynthesis, lang = () => 'en-GB', rate = 0.95 } = {}) {
  let enabled = false;
  let lastKey = null;
  let lastAt = 0;
  const language = () => (typeof lang === 'function' ? lang() : lang);

  const voiceFor = (code) => {
    const voices = synth?.getVoices?.() ?? [];
    const want = code.toLowerCase();
    return voices.find((v) => v.lang?.toLowerCase().replace('_', '-') === want) ?? voices.find((v) => v.lang?.toLowerCase().startsWith(want.slice(0, 2))) ?? null;
  };

  return {
    get available() {
      return Boolean(synth);
    },
    get enabled() {
      return enabled;
    },
    set enabled(v) {
      enabled = Boolean(v && synth);
      if (!enabled) synth?.cancel();
    },
    /** True when the phone has a voice for the current language. */
    get hasVoiceForLanguage() {
      return Boolean(voiceFor(language()));
    },
    /** Speaks a line. The same line is not repeated within a few seconds. */
    say(text, { key = text, interrupt = false, force = false } = {}) {
      if (!enabled || !text || !synth) return false;
      const now = Date.now();
      if (!force && key === lastKey && now - lastAt < SAME_LINE_COOLDOWN_MS) return false;
      lastKey = key;
      lastAt = now;
      if (interrupt) synth.cancel();
      const code = language();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = code;
      utterance.rate = rate;
      const voice = voiceFor(code);
      if (voice) utterance.voice = voice;
      synth.speak(utterance);
      return true;
    },
    stop() {
      synth?.cancel();
      lastKey = null;
    },
  };
}

// The Talbiyah recording sits beside the app's other audio; every other dua
// has its own file under audio/duas/.
export const duaClipUrl = (id) => (id === 'talbiyah' ? './audio/talbiyah.mp3' : `./audio/duas/${id}.mp3`);

/**
 * Plays recorded recitations. Resolves false when there is no recording.
 */
export function createClipPlayer() {
  let audio = null;
  let currentId = null;
  const missing = new Set(); // don't ask the network twice for a recording that isn't there
  let catalog = null; // audio/duas/index.json, when present, is the authoritative list
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn(currentId));

  return {
    get playingId() {
      return currentId;
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    setCatalog(entries) {
      catalog = new Map(Object.entries(entries));
    },
    stop() {
      audio?.pause();
      audio = null;
      currentId = null;
      notify();
    },
    async play(id) {
      if (missing.has(id) || (catalog && !catalog.has(id))) return false;
      this.stop();
      audio = new Audio(catalog?.get(id)?.file ?? duaClipUrl(id));
      currentId = id;
      notify();
      const done = () => {
        if (currentId === id) {
          currentId = null;
          notify();
        }
      };
      audio.addEventListener('ended', done);
      audio.addEventListener('error', () => {
        missing.add(id);
        done();
      });
      try {
        await audio.play();
        return true;
      } catch {
        done();
        return false;
      }
    },
  };
}
