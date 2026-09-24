// Voice guide: speaks each step, round, corner and arrival out loud in the
// pilgrim's language, using the phone's built-in speech (offline).
//
// The phone voice NEVER reads Arabic. Duas and Qur'an are only ever played from
// real recitations. Port of the voice guide in src/ui/voice.js.
import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';

const int _sameLineCooldownMs = 8000;

class VoiceInfo {
  const VoiceInfo({required this.name, required this.locale});
  final String name;
  final String locale;
}

// Devices often ship several voices per language — a small on-device "compact"
// one and a much better network/neural one. flutter_tts gives no quality
// field, so we rank by naming hints that correlate with quality and pick the
// best match; the pilgrim can always override it from Settings.
final List<RegExp> _qualityHints = [
  RegExp('neural', caseSensitive: false),
  RegExp('natural', caseSensitive: false),
  RegExp('enhanced', caseSensitive: false),
  RegExp('premium', caseSensitive: false),
  RegExp('wavenet', caseSensitive: false),
  RegExp('online', caseSensitive: false),
  RegExp('google', caseSensitive: false),
  RegExp('siri', caseSensitive: false),
];

int _rank(VoiceInfo v) {
  var score = v.name.toLowerCase().contains('network') ? 5 : 0; // a network voice is almost always the better one
  if (_qualityHints.any((re) => re.hasMatch(v.name))) score += 3;
  return score;
}

String _norm(String s) => s.toLowerCase().replaceAll('_', '-');

class VoiceService {
  final FlutterTts _tts = FlutterTts();
  List<VoiceInfo> _all = [];
  bool available = false;
  bool enabled = false;

  /// The pilgrim's manual pick for the current language, if any.
  String? preferredName;
  String? _lastKey;
  int _lastAt = 0;

  Future<void> init() async {
    try {
      await _tts.setSpeechRate(defaultTargetPlatform == TargetPlatform.iOS ? 0.48 : 0.95);
      await refreshVoices();
      available = true;
    } catch (_) {
      available = false;
    }
  }

  Future<void> refreshVoices() async {
    try {
      final raw = await _tts.getVoices;
      _all = ((raw as List?) ?? const [])
          .whereType<Map>()
          .map((m) => VoiceInfo(name: '${m['name']}', locale: '${m['locale']}'))
          .toList();
    } catch (_) {
      _all = [];
    }
  }

  List<VoiceInfo> _forLanguage(String code) {
    final want = _norm(code);
    final exact = _all.where((v) => _norm(v.locale) == want).toList();
    if (exact.isNotEmpty) return exact;
    final prefix = want.length >= 2 ? want.substring(0, 2) : want;
    return _all.where((v) => _norm(v.locale).startsWith(prefix)).toList();
  }

  VoiceInfo? _voiceFor(String code) {
    final candidates = _forLanguage(code);
    if (candidates.isEmpty) return null;
    if (preferredName != null) {
      for (final v in candidates) {
        if (v.name == preferredName) return v;
      }
    }
    return candidates.reduce((best, v) => _rank(v) > _rank(best) ? v : best);
  }

  /// True when the phone has a voice for [code].
  bool hasVoiceForLanguage(String code) => _voiceFor(code) != null;

  /// Every installed voice for [code], best guess first.
  List<({String name, bool isDefault})> listVoices(String code) {
    final def = _voiceFor(code)?.name;
    final sorted = _forLanguage(code).toList()..sort((a, b) => _rank(b).compareTo(_rank(a)));
    return sorted.map((v) => (name: v.name, isDefault: v.name == def)).toList();
  }

  /// Speaks a line. The same line is not repeated within a few seconds.
  /// Pass [forceEnglish] when the pilgrim's language has no installed voice:
  /// this deliberately speaks clear English rather than letting the phone pick
  /// some unpredictable substitute voice for text it can't actually read — a
  /// known, labelled fallback instead of a confusing guess.
  Future<bool> say(String text, {required String lang, String? key, bool interrupt = false, bool force = false, bool forceEnglish = false}) async {
    if (!enabled || !available || text.isEmpty) return false;
    final now = DateTime.now().millisecondsSinceEpoch;
    final k = key ?? text;
    if (!force && k == _lastKey && now - _lastAt < _sameLineCooldownMs) return false;
    _lastKey = k;
    _lastAt = now;
    try {
      if (interrupt) await _tts.stop();
      final code = forceEnglish ? 'en-GB' : lang;
      await _tts.setLanguage(code);
      final voice = _voiceFor(code);
      if (voice != null) await _tts.setVoice({'name': voice.name, 'locale': voice.locale});
      await _tts.speak(text);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> stop() async {
    _lastKey = null;
    try {
      await _tts.stop();
    } catch (_) {}
  }
}
