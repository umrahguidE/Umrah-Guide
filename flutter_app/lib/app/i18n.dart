// Translations. Strings are looked up by their English text, so the English
// stays readable in the code and every language falls back to English for
// anything not yet translated. Placeholders are written {name}. Port of
// src/i18n/index.js; the packs are exported from the web app's own files by
// scripts/export-flutter-data.mjs.
import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

class Language {
  const Language({required this.code, required this.name, required this.native, required this.speech, required this.dir});
  final String code;
  final String name;
  final String native;

  /// BCP-47 tag handed to the phone's speech engine.
  final String speech;
  final String dir;

  bool get rtl => dir == 'rtl';

  factory Language.fromJson(Map<String, dynamic> j) => Language(
        code: j['code'] as String,
        name: j['name'] as String,
        native: j['native'] as String,
        speech: j['speech'] as String,
        dir: j['dir'] as String,
      );
}

class Translator {
  Translator(this.languages);

  final List<Language> languages;
  String _code = 'en';
  Map<String, String> _pack = const {};
  final Map<String, Map<String, String>> _cache = {};

  String get code => _code;
  Language get language => languages.firstWhere((l) => l.code == _code, orElse: () => languages.first);

  /// Switches language, loading its pack on first use.
  Future<void> setLanguage(String code) async {
    final known = languages.any((l) => l.code == code);
    _code = known ? code : 'en';
    if (_code == 'en') {
      _pack = const {};
      return;
    }
    _pack = _cache[_code] ??= await _loadPack(_code);
  }

  static Future<Map<String, String>> _loadPack(String code) async {
    final raw = await rootBundle.loadString('assets/i18n/$code.json');
    return (jsonDecode(raw) as Map<String, dynamic>).map((k, v) => MapEntry(k, v as String));
  }

  /// Runs [build] with English temporarily selected (used to speak clear
  /// English when the phone has no voice for the pilgrim's language).
  String inEnglish(String Function() build) {
    final code = _code;
    final pack = _pack;
    _code = 'en';
    _pack = const {};
    try {
      return build();
    } finally {
      _code = code;
      _pack = pack;
    }
  }

  static final RegExp _placeholder = RegExp(r'\{(\w+)\}');

  /// Translates [text] (an English source string), filling {placeholders}.
  String t(String? text, [Map<String, Object?>? vars]) {
    if (text == null || text.isEmpty) return '';
    var out = _pack[text];
    if (out == null || out.isEmpty) out = text;
    if (vars != null) {
      out = out.replaceAllMapped(_placeholder, (m) => '${vars[m.group(1)] ?? m.group(0)}');
    }
    return out;
  }

  /// Translates each string of a list (guidance points and the like).
  List<String> tList(Iterable<dynamic>? items) => (items ?? const []).map((e) => t(e as String)).toList();
}
