// Device persistence. Every state change is written synchronously to local
// storage, so progress survives the app being killed, the phone restarting or
// having no signal. Same keys and JSON shape as the web app's src/store.js.
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../engine/machine.dart' show initialState, Json;

const _stateKey = 'guided-umrah.state.v1';
const _undoKey = 'guided-umrah.undo.v1';
const _prefsKey = 'guided-umrah.prefs.v1';
const _undoLimit = 20;

class Prefs {
  Prefs({
    Map<String, bool>? checklist,
    Map<String, dynamic>? info,
    List<Map<String, String>>? personalDuas,
    this.miqatRoute,
    this.language,
    this.voiceEnabled = true,
    this.voiceName,
    this.stepLengthM,
    this.reciter,
    this.textScale = 1,
  })  : checklist = checklist ?? {},
        info = info ?? {},
        personalDuas = personalDuas ?? [];

  Map<String, bool> checklist;
  Map<String, dynamic> info;
  List<Map<String, String>> personalDuas;
  String? miqatRoute;
  String? language;
  bool voiceEnabled;

  /// The pilgrim's own pick of an installed voice for their language, if any.
  String? voiceName;
  double? stepLengthM;

  /// Which Qur'an reciter plays where a verse offers a choice; null = default.
  String? reciter;

  /// 1 = normal, 1.15 = large, 1.3 = extra large.
  double textScale;

  factory Prefs.fromJson(Json j) {
    final voice = (j['voice'] as Json?) ?? const {};
    return Prefs(
      checklist: ((j['checklist'] as Map?) ?? const {}).map((k, v) => MapEntry('$k', v == true)),
      info: Map<String, dynamic>.from((j['info'] as Map?) ?? const {}),
      personalDuas: ((j['personalDuas'] as List?) ?? const []).map((e) => Map<String, String>.from((e as Map).map((k, v) => MapEntry('$k', '$v')))).toList(),
      miqatRoute: j['miqatRoute'] as String?,
      language: j['language'] as String?,
      voiceEnabled: voice['enabled'] != false,
      voiceName: voice['voiceURI'] as String?,
      stepLengthM: (j['stepLengthM'] as num?)?.toDouble(),
      reciter: j['reciter'] as String?,
      textScale: (j['textScale'] as num?)?.toDouble() ?? 1,
    );
  }

  Json toJson() => {
        'checklist': checklist,
        'info': info,
        'personalDuas': personalDuas,
        'miqatRoute': miqatRoute,
        'language': language,
        'voice': {'enabled': voiceEnabled, 'voiceURI': voiceName},
        'stepLengthM': stepLengthM,
        'reciter': reciter,
        'textScale': textScale,
      };
}

class Store {
  Store(this._sp) : _undo = _readList(_sp, _undoKey);

  final SharedPreferences _sp;
  List<Json> _undo;

  static Future<Store> open() async => Store(await SharedPreferences.getInstance());

  static List<Json> _readList(SharedPreferences sp, String key) {
    try {
      final raw = sp.getString(key);
      if (raw == null) return [];
      return (jsonDecode(raw) as List).cast<Json>();
    } catch (_) {
      return [];
    }
  }

  Json? _read(String key) {
    try {
      final raw = _sp.getString(key);
      return raw == null ? null : jsonDecode(raw) as Json;
    } catch (_) {
      return null;
    }
  }

  bool _write(String key, Object value) {
    try {
      _sp.setString(key, jsonEncode(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  Json loadState() {
    final s = _read(_stateKey);
    return s?['version'] == 1 ? s! : initialState();
  }

  bool saveState(Json s) => _write(_stateKey, s);

  Prefs loadPrefs() => Prefs.fromJson(_read(_prefsKey) ?? const {});
  bool savePrefs(Prefs p) => _write(_prefsKey, p.toJson());

  void pushUndo(Json s) {
    _undo.add(s);
    if (_undo.length > _undoLimit) _undo = _undo.sublist(_undo.length - _undoLimit);
    _write(_undoKey, _undo);
  }

  Json? popUndo() {
    if (_undo.isEmpty) return null;
    final s = _undo.removeLast();
    _write(_undoKey, _undo);
    return s;
  }

  int get undoDepth => _undo.length;
}
