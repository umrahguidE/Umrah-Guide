// Voice guide: speaks each step, round, corner and arrival out loud, using the
// phone's built-in speech (works offline, no download).
//
// For Arabic, a recorded reciter's file is always preferred: if
// audio/duas/<id>.mp3 exists it is played instead of the speech engine.
// Machine-spoken Arabic is off by default — it mispronounces, and Qur'an and
// dua should be heard from a real reciter.

const SAME_LINE_COOLDOWN_MS = 8000;

export function createVoice({ synth = globalThis.speechSynthesis, lang = 'en-GB', rate = 0.95 } = {}) {
  let enabled = false;
  let arabicEnabled = false;
  let lastKey = null;
  let lastAt = 0;

  const voiceFor = (language) => {
    const voices = synth?.getVoices?.() ?? [];
    const want = language.toLowerCase();
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
    get arabicEnabled() {
      return arabicEnabled;
    },
    set arabicEnabled(v) {
      arabicEnabled = Boolean(v);
    },
    /** Speaks a line. The same line is not repeated within a few seconds. */
    say(text, { key = text, language = lang, interrupt = false, force = false } = {}) {
      if (!enabled || !text || !synth) return false;
      const now = Date.now();
      if (!force && key === lastKey && now - lastAt < SAME_LINE_COOLDOWN_MS) return false;
      lastKey = key;
      lastAt = now;
      if (interrupt) synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      utterance.rate = rate;
      const voice = voiceFor(language);
      if (voice) utterance.voice = voice;
      synth.speak(utterance);
      return true;
    },
    /** True when the device actually has an Arabic voice installed. */
    get arabicVoiceAvailable() {
      return Boolean(voiceFor('ar'));
    },
    sayArabic(text, options = {}) {
      if (!arabicEnabled || !text || !voiceFor('ar')) return false;
      return this.say(text, { language: 'ar-SA', rate: 0.8, ...options });
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
 * Plays recorded recitations (an imam's voice) when the file is present.
 * Resolves false when there is no recording, so callers can fall back.
 */
export function createClipPlayer() {
  let audio = null;
  let currentId = null;
  const missing = new Set(); // don't ask the network twice for a recording that isn't there
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
    stop() {
      audio?.pause();
      audio = null;
      currentId = null;
      notify();
    },
    async play(id, url = duaClipUrl(id)) {
      if (missing.has(id)) return false;
      this.stop();
      audio = new Audio(url);
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
        missing.add(id);
        done();
        return false;
      }
    },
  };
}
