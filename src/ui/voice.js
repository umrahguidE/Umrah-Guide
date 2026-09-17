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
  let preferredURI = null; // pilgrim's manual pick for the current language, if any
  const language = () => (typeof lang === 'function' ? lang() : lang);

  // Devices often ship several voices per language — a small on-device
  // "compact" one and a much better network/neural one. speechSynthesis
  // gives no quality field, so we rank by naming and delivery hints that
  // reliably correlate with quality across Android, iOS/Safari and desktop
  // Chrome/Edge, and pick the best match instead of the first one found.
  // This is only a starting guess: the pilgrim can always override it from
  // Settings, because no heuristic can know which installed voice actually
  // sounds good to a given ear on a given device.
  const QUALITY_HINTS = [/neural/i, /natural/i, /enhanced/i, /premium/i, /wavenet/i, /online/i, /google/i, /siri/i];
  const rank = (v) => {
    let score = v.localService === false ? 5 : 0; // a network voice is almost always the better one
    if (QUALITY_HINTS.some((re) => re.test(v.name))) score += 3;
    if (v.default) score += 1;
    return score;
  };
  const voicesForLanguage = (code) => {
    const voices = synth?.getVoices?.() ?? [];
    const want = code.toLowerCase();
    const exact = voices.filter((v) => v.lang?.toLowerCase().replace('_', '-') === want);
    return exact.length ? exact : voices.filter((v) => v.lang?.toLowerCase().startsWith(want.slice(0, 2)));
  };
  const voiceFor = (code) => {
    const candidates = voicesForLanguage(code);
    if (!candidates.length) return null;
    if (preferredURI) {
      const chosen = candidates.find((v) => v.voiceURI === preferredURI);
      if (chosen) return chosen;
    }
    return candidates.reduce((best, v) => (rank(v) > rank(best) ? v : best));
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
    /** Every installed voice for the current language, best guess first. */
    listVoices() {
      return voicesForLanguage(language())
        .slice()
        .sort((a, b) => rank(b) - rank(a))
        .map((v) => ({ uri: v.voiceURI, name: v.name, isDefault: v.voiceURI === voiceFor(language())?.voiceURI }));
    },
    get preferredVoiceURI() {
      return preferredURI;
    },
    /** Pilgrim's manual override. Pass null to go back to automatic ranking. */
    set preferredVoiceURI(uri) {
      preferredURI = uri || null;
    },
    /**
     * Speaks a line. The same line is not repeated within a few seconds.
     * Pass `forceEnglish` when the pilgrim's language has no installed
     * voice: this deliberately speaks clear English rather than letting the
     * phone pick some unpredictable substitute voice for text it can't
     * actually read (which can come out as neither language, understood by
     * no one) — a known, labelled fallback instead of a confusing guess.
     */
    say(text, { key = text, interrupt = false, force = false, forceEnglish = false } = {}) {
      if (!enabled || !text || !synth) return false;
      const now = Date.now();
      if (!force && key === lastKey && now - lastAt < SAME_LINE_COOLDOWN_MS) return false;
      lastKey = key;
      lastAt = now;
      if (interrupt) synth.cancel();
      const code = forceEnglish ? 'en-GB' : language();
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

export const PLAYBACK_RATES = Object.freeze([0.75, 1, 1.25]);

/**
 * Plays real recitations only (never the phone voice). One clip at a time,
 * with a seek bar, a speed control, and a queue so a whole section — every
 * established dua for Tawaf, say — can play back to back like a playlist.
 * Resolves false from play() when there is no recording for that id.
 */
export function createClipPlayer() {
  let audio = null;
  let currentId = null;
  let rate = 1;
  let queue = null; // { ids, index } while playing "Play all" for a section
  const missing = new Set(); // don't ask the network twice for a recording that isn't there
  let catalog = null; // audio/duas/index.json, when present, is the authoritative list
  let preferredReciter = null; // pilgrim's choice of Qur'an reciter, when the clip offers alternates

  /** The file to actually play for `id` — the pilgrim's preferred reciter's
   * recording if this clip offers one, else whatever the catalog names, else
   * the conventional path (for a device with no catalog loaded yet). */
  function urlFor(id) {
    const entry = catalog?.get(id);
    const alt = preferredReciter && entry?.alternates?.[preferredReciter];
    return alt?.file ?? entry?.file ?? duaClipUrl(id);
  }
  const listeners = new Set();
  const notify = () =>
    listeners.forEach((fn) =>
      fn({
        playingId: currentId,
        currentTime: audio?.currentTime ?? 0,
        duration: Number.isFinite(audio?.duration) ? audio.duration : 0,
        rate,
        queue: queue ? { ...queue } : null,
      }),
    );

  function teardown() {
    if (!audio) return;
    audio.pause();
    audio.removeEventListener('timeupdate', notify);
    audio.removeEventListener('loadedmetadata', notify);
    audio = null;
  }

  const player = {
    get playingId() {
      return currentId;
    },
    get duration() {
      return Number.isFinite(audio?.duration) ? audio.duration : 0;
    },
    get currentTime() {
      return audio?.currentTime ?? 0;
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    setCatalog(entries) {
      catalog = new Map(Object.entries(entries));
    },
    hasRecording(id) {
      return Boolean(catalog?.has(id)) && !missing.has(id);
    },
    get preferredReciter() {
      return preferredReciter;
    },
    set preferredReciter(key) {
      preferredReciter = key || null;
    },
    /** Reciters offering an alternate recording of this specific clip, if any. */
    recitersFor(id) {
      return catalog?.get(id)?.alternates ?? null;
    },
    stop() {
      teardown();
      currentId = null;
      queue = null;
      notify();
    },
    seek(seconds) {
      if (audio) audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
    },
    setRate(next) {
      rate = next;
      if (audio) audio.playbackRate = rate;
      notify();
    },
    /** Plays one recitation. Pass `queueIds` to chain into the next one on end (for "Play all"). */
    async play(id, { queueIds = null } = {}) {
      if (missing.has(id) || (catalog && !catalog.has(id))) return false;
      teardown();
      audio = new Audio(urlFor(id));
      audio.playbackRate = rate;
      currentId = id;
      queue = queueIds ? { ids: queueIds, index: queueIds.indexOf(id) } : null;
      notify();
      audio.addEventListener('timeupdate', notify);
      audio.addEventListener('loadedmetadata', notify);
      const advance = async () => {
        const q = queue;
        const next = q && q.index >= 0 ? q.ids.slice(q.index + 1).find((next) => player.hasRecording(next)) : null;
        if (next) await player.play(next, { queueIds: q.ids });
        else {
          currentId = null;
          queue = null;
          notify();
        }
      };
      audio.addEventListener('ended', advance);
      audio.addEventListener('error', () => {
        missing.add(id);
        advance();
      });
      try {
        await audio.play();
        return true;
      } catch {
        currentId = null;
        queue = null;
        notify();
        return false;
      }
    },
    /** Plays every id in order that has a recording, skipping the rest — a "Play all" for a section. */
    async playAll(ids) {
      const playable = ids.filter((id) => player.hasRecording(id));
      if (!playable.length) return false;
      return player.play(playable[0], { queueIds: playable });
    },
  };
  return player;
}
