// The app's guidance, duas, Miqat routes and other fixed content, loaded from
// assets/data/content.json (exported from the web app's src/data/content.js,
// so no religious text is retyped by hand).
import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

import '../engine/machine.dart' show Json;
import '../engine/miqat.dart';
import 'i18n.dart';

class Dua {
  Dua(this.raw);
  final Json raw;
  String get id => raw['id'] as String;
  String get category => raw['category'] as String;
  String? get basis => raw['basis'] as String?;
  List<String> get contexts => ((raw['contexts'] as List?) ?? const []).cast<String>();
  String get title => raw['title'] as String;
  String? get when => raw['when'] as String?;
  String? get arabic => raw['arabic'] as String?;
  String? get transliteration => raw['transliteration'] as String?;
  String? get translation => raw['translation'] as String?;
  String? get note => raw['note'] as String?;
  String? get source => raw['source'] as String?;
  bool get reviewed => (raw['review'] as Json?)?['status'] == 'reviewed';
}

class RouteInfo {
  RouteInfo(this.raw);
  final Json raw;
  String get id => raw['id'] as String;
  String get group => raw['group'] as String;
  String get mode => raw['mode'] as String;
  String get label => raw['label'] as String;
  List<String> get miqats => ((raw['miqats'] as List?) ?? const []).cast<String>();
  String get note => raw['note'] as String;
  List<String> get extra => ((raw['extra'] as List?) ?? const []).cast<String>();
}

class Content {
  Content(this.raw)
      : duas = (raw['DUAS'] as List).map((d) => Dua(d as Json)).toList(),
        routes = (raw['ROUTES'] as List).map((r) => RouteInfo(r as Json)).toList(),
        languages = (raw['LANGUAGES'] as List).map((l) => Language.fromJson(l as Json)).toList();

  final Json raw;
  final List<Dua> duas;
  final List<RouteInfo> routes;
  final List<Language> languages;

  static Future<Content> load() async {
    final text = await rootBundle.loadString('assets/data/content.json');
    return Content(jsonDecode(text) as Json);
  }

  Dua? dua(String id) {
    for (final d in duas) {
      if (d.id == id) return d;
    }
    return null;
  }

  RouteInfo? routeById(String? id) {
    if (id == null) return null;
    for (final r in routes) {
      if (r.id == id) return r;
    }
    return null;
  }

  List<Json> list(String key) => (raw[key] as List).cast<Json>();
  Json map(String key) => raw[key] as Json;
  String str(String key) => raw[key] as String;

  Json get guidance => map('GUIDANCE');
  Json guide(String key) => guidance[key] as Json;
  List<String> points(dynamic v) => ((v as List?) ?? const []).cast<String>();

  String get reviewNotice => str('REVIEW_NOTICE');
  Json get meta => map('CONTENT_META');
  bool get reviewed => (meta['review'] as Json)['status'] == 'reviewed';
  String get version => meta['version'] as String;

  List<Json> get miqatJson => list('MIQATS');
  List<MiqatPoint> get miqatPoints => miqatJson.map(MiqatPoint.fromJson).toList();
  List<Json> get prepChecklist => list('PREP_CHECKLIST');
  List<Json> get ihramGuide => list('IHRAM_GUIDE');
  List<Json> get routeGroups => list('ROUTE_GROUPS');
  Json get routeSteps => map('ROUTE_STEPS');
  List<Json> get duaCategories => list('DUA_CATEGORIES');
  List<Json> get emergencyNumbers => list('EMERGENCY_NUMBERS');
  Json get guides => map('GUIDES');
  Json get basisLabel => map('BASIS_LABEL');
  Json get stageLines => map('STAGE_LINES');
  List<Json> hairOptions(String gender) => ((raw['HAIR_OPTIONS'] as Json)[gender] as List).cast<Json>();
}
