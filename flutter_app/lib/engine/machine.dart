// The live ritual engine: a pure reducer `transition(state, event) -> state`.
// It never reads sensors itself; callers pass `now` and the tracking
// confidence, which keeps it deterministic, testable and fully offline.
// Port of src/engine/machine.js. State is plain JSON-style maps, so a saved
// session has exactly the same shape as in the web app.
import 'dart:convert';
import 'dart:math' as math;

import 'stages.dart';

typedef Json = Map<String, dynamic>;

class RitualError implements Exception {
  RitualError(this.code, this.message);
  final String code;
  final String message;
  @override
  String toString() => 'RitualError($code): $message';
}

class EV {
  static const start = 'START';
  static const setMiqat = 'SET_MIQAT';
  static const toggleCheck = 'TOGGLE_CHECK';
  static const next = 'NEXT';
  static const startTawaf = 'START_TAWAF';
  static const confirmTawafRound = 'CONFIRM_TAWAF_ROUND';
  static const correctTawafRound = 'CORRECT_TAWAF_ROUND';
  static const startSai = 'START_SAI';
  static const confirmSaiLap = 'CONFIRM_SAI_LAP';
  static const correctSaiLap = 'CORRECT_SAI_LAP';
  static const pause = 'PAUSE';
  static const resume = 'RESUME';
  static const setTrackingMode = 'SET_TRACKING_MODE';
  static const confirmHair = 'CONFIRM_HAIR';
  static const reset = 'RESET';
}

const List<String> ihramChecks = ['prepared', 'intention', 'talbiyah'];
const Map<String, List<String>> hairMethods = {
  'male': ['shave', 'shorten'],
  'female': ['shorten'],
};
const List<String> trackingModes = ['assisted', 'manual'];

// Stages left with a plain "Continue". Counted stages and hair have their own
// events.
const Map<String, String> _simpleNext = {
  Stage.miqat: Stage.ihram,
  Stage.ihram: Stage.talbiyah,
  Stage.talbiyah: Stage.enterHaram,
  Stage.enterHaram: Stage.tawafReady,
  Stage.tawafComplete: Stage.twoRakah,
  Stage.twoRakah: Stage.zamzam,
  Stage.zamzam: Stage.safa,
  Stage.saiComplete: Stage.hair,
  Stage.ihramExit: Stage.umrahComplete,
};

List<int> _range(int n) => List<int>.generate(n, (i) => i + 1);

class _Cfg {
  const _Cfg({
    required this.key,
    required this.name,
    required this.noun,
    required this.total,
    required this.items,
    required this.numberField,
    required this.current,
    required this.startedAt,
    required this.eventField,
    required this.stageFor,
    required this.completeStage,
    required this.correctable,
  });
  final String key;
  final String name;
  final String noun;
  final int total;
  final String items;
  final String numberField;
  final String current;
  final String startedAt;
  final String eventField;
  final String Function(int) stageFor;
  final String completeStage;
  final Set<String> correctable;
}

// Tawaf can be recounted until Sa'i starts; Sa'i until the hair ritual is
// confirmed.
final _Cfg _tawaf = _Cfg(
  key: 'tawaf',
  name: 'Tawaf',
  noun: 'round',
  total: tawafRounds,
  items: 'rounds',
  numberField: 'round_number',
  current: 'current_round',
  startedAt: 'current_round_started_at',
  eventField: 'round',
  stageFor: tawafRoundStage,
  completeStage: Stage.tawafComplete,
  correctable: {..._range(tawafRounds).map(tawafRoundStage), Stage.tawafComplete, Stage.twoRakah, Stage.zamzam, Stage.safa},
);
final _Cfg _sai = _Cfg(
  key: 'sai',
  name: 'Sa’i',
  noun: 'lap',
  total: saiLaps,
  items: 'laps',
  numberField: 'lap_number',
  current: 'current_lap',
  startedAt: 'current_lap_started_at',
  eventField: 'lap',
  stageFor: saiLapStage,
  completeStage: Stage.saiComplete,
  correctable: {..._range(saiLaps).map(saiLapStage), Stage.saiComplete, Stage.hair},
);

Json initialState() => {'version': 1, 'session': null, 'archive': <dynamic>[]};

String _isoNow() => DateTime.now().toUtc().toIso8601String();

final math.Random _rng = math.Random.secure();
String _uuid() {
  String hex(int n) => List.generate(n, (_) => _rng.nextInt(16).toRadixString(16)).join();
  final variant = (8 + _rng.nextInt(4)).toRadixString(16);
  return '${hex(8)}-${hex(4)}-4${hex(3)}-$variant${hex(3)}-${hex(12)}';
}

String newId(String prefix) => '${prefix}_${_uuid()}';

Never _fail(String code, String message) => throw RitualError(code, message);

Json _clone(Json j) => jsonDecode(jsonEncode(j)) as Json;

/// Applies [event] to [state] and returns the new state; [state] is untouched.
Json transition(Json state, Json event) {
  if (event['type'] == null) _fail('BAD_EVENT', 'Unknown action.');
  final draft = _clone(state);
  _apply(draft, event, (event['now'] as String?) ?? _isoNow());
  return draft;
}

void _apply(Json st, Json ev, String now) {
  if (ev['type'] == EV.start) return _start(st, ev, now);
  final s = st['session'] as Json?;
  if (s == null) _fail('NO_SESSION', 'Start your Umrah first.');
  if (ev['type'] == EV.reset) {
    _log(s, now, ev);
    if (s['status'] == 'active') s['status'] = 'abandoned';
    (st['archive'] as List).add(s);
    st['session'] = null;
    return;
  }
  if (s['status'] != 'active') _fail('SESSION_CLOSED', 'This Umrah is already finished.');
  // Buttons carry the stage they were drawn for; a tap from an out-of-date
  // screen is rejected.
  final expect = ev['expect'];
  if (expect != null && expect != s['current_stage']) _fail('STALE', 'That button was out of date — the screen has been refreshed.');
  final handler = _handlers[ev['type']];
  if (handler == null) _fail('BAD_EVENT', 'Unknown action "${ev['type']}".');
  handler(s, ev, now);
  _log(s, now, ev);
}

const List<String> _logFields = ['gender', 'round', 'lap', 'mode', 'method', 'key', 'value', 'confidence', 'routeId'];

void _log(Json s, String now, Json ev) {
  final entry = <String, dynamic>{'at': now, 'type': ev['type'], 'stage': s['current_stage']};
  for (final f in _logFields) {
    if (ev.containsKey(f)) entry[f] = ev[f];
  }
  (s['log'] as List).add(entry);
}

void _start(Json st, Json ev, String now) {
  final existing = st['session'] as Json?;
  if (existing?['status'] == 'active') _fail('SESSION_ACTIVE', 'An Umrah is already in progress.');
  if (hairMethods[ev['gender']] == null) _fail('GENDER_REQUIRED', 'Choose man or woman so the guidance fits you.');
  if (existing != null) (st['archive'] as List).add(existing);
  final session = <String, dynamic>{
    'id': ev['id'] ?? newId('umrah'),
    'user_id': ev['userId'] ?? 'local',
    'started_at': now,
    'completed_at': null,
    'status': 'active',
    'current_stage': Stage.miqat,
    'gender': ev['gender'],
    'language': ev['language'] ?? 'en',
    'miqat': null,
    'checks': {for (final k in ihramChecks) k: false},
    'paused': false,
    'pauses': <dynamic>[],
    'tracking_mode': 'manual',
    'tawaf': null,
    'sai': null,
    'two_rakah_at': null,
    'zamzam_at': null,
    'hair': null,
    'ihram_exited_at': null,
    'corrections': <dynamic>[],
    'log': <dynamic>[],
  };
  st['session'] = session;
  _log(session, now, ev);
}

void _requireStage(Json s, String stage) {
  if (s['current_stage'] != stage) _fail('WRONG_STAGE', 'That action is not available at this step.');
}

typedef _Handler = void Function(Json s, Json ev, String now);

final Map<String, _Handler> _handlers = {
  EV.setMiqat: (s, ev, now) {
    s['miqat'] = {'route_id': ev['routeId']};
  },
  EV.toggleCheck: (s, ev, now) {
    _requireStage(s, Stage.ihram);
    final key = ev['key'];
    if (!ihramChecks.contains(key)) _fail('BAD_CHECK', 'Unknown Ihram check.');
    final checks = s['checks'] as Json;
    checks[key as String] = ev['value'] ?? !(checks[key] as bool);
  },
  EV.next: (s, ev, now) {
    final from = s['current_stage'] as String;
    final to = _simpleNext[from];
    if (to == null) _fail('NO_NEXT', 'Use the buttons on this screen to continue.');
    final checks = s['checks'] as Json;
    if (from == Stage.ihram && !ihramChecks.every((k) => checks[k] == true)) _fail('IHRAM_INCOMPLETE', 'Complete the Ihram check first.');
    if (from == Stage.twoRakah) s['two_rakah_at'] = now;
    if (from == Stage.zamzam) s['zamzam_at'] = now;
    if (from == Stage.ihramExit) {
      s['ihram_exited_at'] = now;
      s['status'] = 'complete';
      s['completed_at'] = now;
    }
    s['current_stage'] = to;
  },
  EV.startTawaf: (s, ev, now) {
    _requireStage(s, Stage.tawafReady);
    s['tawaf'] = {
      'id': newId('tawaf'),
      'umrah_session_id': s['id'],
      'started_at': now,
      'completed_at': null,
      'current_round': 1,
      'current_round_started_at': now,
      'status': 'in_progress',
      'rounds': <dynamic>[],
    };
    s['paused'] = false;
    s['current_stage'] = tawafRoundStage(1);
  },
  EV.confirmTawafRound: (s, ev, now) => _confirmCount(s, ev, now, _tawaf),
  EV.correctTawafRound: (s, ev, now) => _correctCount(s, ev['round'], now, _tawaf),
  EV.startSai: (s, ev, now) {
    _requireStage(s, Stage.safa);
    s['sai'] = {
      'id': newId('sai'),
      'umrah_session_id': s['id'],
      'started_at': now,
      'completed_at': null,
      'current_lap': 1,
      'current_lap_started_at': now,
      'status': 'in_progress',
      'laps': <dynamic>[],
    };
    s['paused'] = false;
    s['current_stage'] = saiLapStage(1);
  },
  EV.confirmSaiLap: (s, ev, now) => _confirmCount(s, ev, now, _sai),
  EV.correctSaiLap: (s, ev, now) => _correctCount(s, ev['lap'], now, _sai),
  EV.pause: (s, ev, now) {
    if (parseStage(s['current_stage'] as String).kind == 'simple') _fail('NOT_PAUSABLE', 'Pause is available during Tawaf and Sa’i.');
    if (s['paused'] == true) _fail('ALREADY_PAUSED', 'Already paused.');
    s['paused'] = true;
    (s['pauses'] as List).add({'stage': s['current_stage'], 'started_at': now, 'ended_at': null});
  },
  EV.resume: (s, ev, now) {
    if (s['paused'] != true) _fail('NOT_PAUSED', 'Not paused.');
    s['paused'] = false;
    final pauses = s['pauses'] as List;
    if (pauses.isNotEmpty) (pauses.last as Json)['ended_at'] = now;
  },
  EV.setTrackingMode: (s, ev, now) {
    if (!trackingModes.contains(ev['mode'])) _fail('BAD_MODE', 'Unknown tracking mode.');
    s['tracking_mode'] = ev['mode'];
  },
  EV.confirmHair: (s, ev, now) {
    _requireStage(s, Stage.hair);
    final allowed = hairMethods[s['gender']]!;
    if (!allowed.contains(ev['method'])) {
      _fail('BAD_HAIR_METHOD', s['gender'] == 'female' ? 'Women shorten the hair; they do not shave it.' : 'Choose shave or shorten.');
    }
    s['hair'] = {'method': ev['method'], 'at': now};
    s['current_stage'] = Stage.ihramExit;
  },
};

Json _makeRecord(_Cfg cfg, int n, Json fields) {
  final rec = <String, dynamic>{'id': newId(cfg.noun), cfg.numberField: n, ...fields};
  if (identical(cfg, _sai)) {
    final d = saiDirection(n);
    rec['start_location'] = d.from;
    rec['end_location'] = d.to;
  }
  return rec;
}

void _confirmCount(Json s, Json ev, String now, _Cfg cfg) {
  final p = parseStage(s['current_stage'] as String);
  if (p.kind != cfg.key) _fail('WRONG_STAGE', 'There is no ${cfg.name} ${cfg.noun} to confirm right now.');
  if (s['paused'] == true) _fail('PAUSED', 'Resume before confirming.');
  final requested = ev[cfg.eventField];
  if (requested != null && requested != p.n) _fail('STALE', 'That button was out of date — the screen has been refreshed.');
  final ritual = s[cfg.key] as Json;
  (ritual[cfg.items] as List).add(_makeRecord(cfg, p.n!, {
    'started_at': ritual[cfg.startedAt],
    'completed_at': now,
    'confirmed': true,
    'tracking_confidence': ev['confidence'] ?? 'manual',
    'source': 'confirmed',
  }));
  if (p.n == cfg.total) {
    ritual['status'] = 'complete';
    ritual['completed_at'] = now;
    ritual[cfg.startedAt] = null;
    s['current_stage'] = cfg.completeStage;
  } else {
    ritual[cfg.current] = p.n! + 1;
    ritual[cfg.startedAt] = now;
    s['current_stage'] = cfg.stageFor(p.n! + 1);
  }
}

// `n` is the round/lap the pilgrim says they are on NOW. Records below it are
// kept (missing ones are filled in as corrections); records from `n` up are
// dropped.
void _correctCount(Json s, Object? n, String now, _Cfg cfg) {
  if (s[cfg.key] == null || !cfg.correctable.contains(s['current_stage'])) {
    _fail('NOT_CORRECTABLE', 'The ${cfg.name} count can’t be changed at this step.');
  }
  if (n is! int || n < 1 || n > cfg.total) _fail('BAD_COUNT', 'Choose a ${cfg.noun} from 1 to ${cfg.total}.');
  final ritual = s[cfg.key] as Json;
  final p = parseStage(s['current_stage'] as String);
  final Object from = p.kind == cfg.key ? p.n! : 'complete';
  final kept = (ritual[cfg.items] as List).cast<Json>().where((r) => (r[cfg.numberField] as int) < n).toList();
  for (var k = 1; k < n; k++) {
    if (!kept.any((r) => r[cfg.numberField] == k)) {
      kept.add(_makeRecord(cfg, k, {
        'started_at': null,
        'completed_at': null,
        'confirmed': true,
        'tracking_confidence': 'manual',
        'source': 'correction',
      }));
    }
  }
  kept.sort((a, b) => (a[cfg.numberField] as int).compareTo(b[cfg.numberField] as int));
  ritual[cfg.items] = kept;
  ritual[cfg.current] = n;
  ritual[cfg.startedAt] = now;
  ritual['status'] = 'in_progress';
  ritual['completed_at'] = null;
  if (identical(cfg, _tawaf)) {
    s['two_rakah_at'] = null;
    s['zamzam_at'] = null;
  }
  s['current_stage'] = cfg.stageFor(n);
  (s['corrections'] as List).add({'at': now, 'kind': cfg.key, 'from': from, 'to': n});
}

({int tawafDone, int saiDone, int corrections}) summarize(Json s) => (
      tawafDone: ((s['tawaf'] as Json?)?['rounds'] as List?)?.length ?? 0,
      saiDone: ((s['sai'] as Json?)?['laps'] as List?)?.length ?? 0,
      corrections: (s['corrections'] as List).length,
    );

/// Flattens a session into the rows of docs/schema.sql, ready to export or sync.
Json toRecords(Json s) {
  final tawaf = s['tawaf'] as Json?;
  final sai = s['sai'] as Json?;
  return {
    'umrah_session': {
      'id': s['id'],
      'user_id': s['user_id'],
      'started_at': s['started_at'],
      'completed_at': s['completed_at'],
      'status': s['status'],
      'current_stage': s['current_stage'],
      'gender': s['gender'],
      'language': s['language'],
      'miqat_route_id': (s['miqat'] as Json?)?['route_id'],
      'two_rakah_at': s['two_rakah_at'],
      'zamzam_at': s['zamzam_at'],
      'hair_method': (s['hair'] as Json?)?['method'],
      'ihram_exited_at': s['ihram_exited_at'],
    },
    'tawaf_session': tawaf == null
        ? null
        : {
            'id': tawaf['id'],
            'umrah_session_id': s['id'],
            'started_at': tawaf['started_at'],
            'completed_at': tawaf['completed_at'],
            'current_round': tawaf['current_round'],
            'status': tawaf['status'],
          },
    'tawaf_rounds': ((tawaf?['rounds'] as List?) ?? const []).cast<Json>().map((r) => {
          'id': r['id'],
          'tawaf_session_id': tawaf!['id'],
          'round_number': r['round_number'],
          'started_at': r['started_at'],
          'completed_at': r['completed_at'],
          'confirmed': r['confirmed'],
          'tracking_confidence': r['tracking_confidence'],
          'source': r['source'],
        }).toList(),
    'sai_session': sai == null
        ? null
        : {
            'id': sai['id'],
            'umrah_session_id': s['id'],
            'started_at': sai['started_at'],
            'completed_at': sai['completed_at'],
            'current_lap': sai['current_lap'],
            'status': sai['status'],
          },
    'sai_laps': ((sai?['laps'] as List?) ?? const []).cast<Json>().map((l) => {
          'id': l['id'],
          'sai_session_id': sai!['id'],
          'lap_number': l['lap_number'],
          'start_location': l['start_location'],
          'end_location': l['end_location'],
          'started_at': l['started_at'],
          'completed_at': l['completed_at'],
          'confirmed': l['confirmed'],
          'tracking_confidence': l['tracking_confidence'],
          'source': l['source'],
        }).toList(),
    'ritual_pauses': (s['pauses'] as List).cast<Json>().map((p) => {'umrah_session_id': s['id'], ...p}).toList(),
    'count_corrections': (s['corrections'] as List).cast<Json>().map((c) => {
          'umrah_session_id': s['id'],
          'kind': c['kind'],
          'from_value': '${c['from']}',
          'to_value': c['to'],
          'at': c['at'],
        }).toList(),
    'ritual_events': (s['log'] as List).cast<Json>().map((e) => {'umrah_session_id': s['id'], ...e}).toList(),
  };
}
