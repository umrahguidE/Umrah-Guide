// Port of tests/machine.test.js — the same scenarios, against the Dart engine.
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:guided_umrah/engine/machine.dart';
import 'package:guided_umrah/engine/stages.dart';

int _tick = 0;
String _at() => DateTime.utc(2026, 9, 11, 7, 0, 0).add(Duration(minutes: _tick++)).toIso8601String();

Json run(Json state, List<Json> events) => events.fold(state, (s, e) => transition(s, {'now': _at(), ...e}));
Json ev(String type, [Json? extra]) => {'type': type, ...?extra};
String stageOf(Json st) => (st['session'] as Json)['current_stage'] as String;
Json sess(Json st) => st['session'] as Json;

Json toTawafReady([String gender = 'male']) {
  var st = run(initialState(), [ev(EV.start, {'gender': gender})]);
  st = run(st, [ev(EV.next)]);
  for (final key in ihramChecks) {
    st = run(st, [ev(EV.toggleCheck, {'key': key, 'value': true})]);
  }
  return run(st, [ev(EV.next), ev(EV.next), ev(EV.next)]);
}

Json tawafTo(Json st, int round) {
  st = run(st, [ev(EV.startTawaf)]);
  for (var n = 1; n < round; n++) {
    st = run(st, [ev(EV.confirmTawafRound, {'round': n})]);
  }
  return st;
}

Json completeTawaf(Json st) => run(tawafTo(st, 7), [ev(EV.confirmTawafRound, {'round': 7})]);
Json toSafa(Json st) => run(completeTawaf(st), [ev(EV.next), ev(EV.next), ev(EV.next)]);

Json completeSai(Json st) {
  st = run(st, [ev(EV.startSai)]);
  for (var n = 1; n <= 7; n++) {
    st = run(st, [ev(EV.confirmSaiLap, {'lap': n})]);
  }
  return st;
}

void expectError(void Function() fn, String code) {
  expect(fn, throwsA(isA<RitualError>().having((e) => e.code, 'code', code)));
}

void main() {
  test('walks the full Umrah for a man and records every round and lap', () {
    var st = toTawafReady('male');
    expect(stageOf(st), Stage.tawafReady);
    st = completeSai(toSafa(st));
    expect(stageOf(st), Stage.saiComplete);
    st = run(st, [ev(EV.next), ev(EV.confirmHair, {'method': 'shave'}), ev(EV.next)]);

    expect(stageOf(st), Stage.umrahComplete);
    final s = sess(st);
    expect(s['status'], 'complete');
    expect(s['completed_at'], isNotNull);
    expect(s['ihram_exited_at'], isNotNull);
    expect(s['two_rakah_at'], isNotNull);
    expect(s['zamzam_at'], isNotNull);

    final rec = toRecords(s);
    final rounds = (rec['tawaf_rounds'] as List).cast<Json>();
    expect(rounds.map((r) => r['round_number']).toList(), [1, 2, 3, 4, 5, 6, 7]);
    expect(rounds.every((r) => r['confirmed'] == true && r['started_at'] != null && r['completed_at'] != null && r['tawaf_session_id'] == (rec['tawaf_session'] as Json)['id']), isTrue);
    expect((rec['tawaf_session'] as Json)['status'], 'complete');
    final laps = (rec['sai_laps'] as List).cast<Json>();
    expect(laps.map((l) => l['lap_number']).toList(), [1, 2, 3, 4, 5, 6, 7]);
    expect(laps.first['start_location'], 'SAFA');
    expect(laps.last['end_location'], 'MARWAH');
    expect((rec['umrah_session'] as Json)['hair_method'], 'shave');
    expect((rec['umrah_session'] as Json)['status'], 'complete');
  });

  test('the journey visits every stage exactly once, in order', () {
    final seen = <String>[];
    Json note(Json st) {
      if (seen.isEmpty || seen.last != stageOf(st)) seen.add(stageOf(st));
      return st;
    }

    var st = note(run(initialState(), [ev(EV.start, {'gender': 'female'})]));
    st = note(run(st, [ev(EV.next)]));
    for (final key in ihramChecks) {
      st = note(run(st, [ev(EV.toggleCheck, {'key': key, 'value': true})]));
    }
    for (var i = 0; i < 3; i++) {
      st = note(run(st, [ev(EV.next)]));
    }
    st = note(run(st, [ev(EV.startTawaf)]));
    for (var n = 1; n <= 7; n++) {
      st = note(run(st, [ev(EV.confirmTawafRound, {'round': n})]));
    }
    for (var i = 0; i < 3; i++) {
      st = note(run(st, [ev(EV.next)]));
    }
    st = note(run(st, [ev(EV.startSai)]));
    for (var n = 1; n <= 7; n++) {
      st = note(run(st, [ev(EV.confirmSaiLap, {'lap': n})]));
    }
    st = note(run(st, [ev(EV.next)]));
    st = note(run(st, [ev(EV.confirmHair, {'method': 'shorten'})]));
    note(run(st, [ev(EV.next)]));
    expect(seen, stageOrder.sublist(1));
  });

  test('Ihram cannot be left until all three checks are ticked', () {
    var st = run(initialState(), [ev(EV.start, {'gender': 'male'}), ev(EV.next)]);
    st = run(st, [ev(EV.toggleCheck, {'key': 'prepared', 'value': true}), ev(EV.toggleCheck, {'key': 'intention', 'value': true})]);
    expectError(() => run(st, [ev(EV.next)]), 'IHRAM_INCOMPLETE');
    st = run(st, [ev(EV.toggleCheck, {'key': 'talbiyah', 'value': true}), ev(EV.next)]);
    expect(stageOf(st), Stage.talbiyah);
  });

  test('a duplicate tap cannot confirm the next round', () {
    var st = tawafTo(toTawafReady(), 3);
    st = run(st, [ev(EV.confirmTawafRound, {'round': 3, 'expect': 'TAWAF_ROUND_3'})]);
    expect(stageOf(st), 'TAWAF_ROUND_4');
    expectError(() => run(st, [ev(EV.confirmTawafRound, {'round': 3})]), 'STALE');
    expectError(() => run(st, [ev(EV.confirmTawafRound, {'expect': 'TAWAF_ROUND_3'})]), 'STALE');
    expect(((sess(st)['tawaf'] as Json)['rounds'] as List).length, 3);
  });

  test('rounds and laps can only be completed by confirming them', () {
    final st = tawafTo(toTawafReady(), 1);
    expectError(() => run(st, [ev(EV.next)]), 'NO_NEXT');
    expectError(() => run(st, [ev(EV.confirmSaiLap, {'lap': 1})]), 'WRONG_STAGE');
    expectError(() => run(toTawafReady(), [ev(EV.startSai)]), 'WRONG_STAGE');
  });

  test('pause blocks confirmation; correction still works while paused', () {
    var st = run(tawafTo(toTawafReady(), 4), [ev(EV.pause)]);
    expect(sess(st)['paused'], true);
    expectError(() => run(st, [ev(EV.confirmTawafRound, {'round': 4})]), 'PAUSED');
    expectError(() => run(st, [ev(EV.pause)]), 'ALREADY_PAUSED');
    st = run(st, [ev(EV.correctTawafRound, {'round': 3})]);
    expect(stageOf(st), 'TAWAF_ROUND_3');
    st = run(st, [ev(EV.resume)]);
    expect(sess(st)['paused'], false);
    expect(((sess(st)['pauses'] as List).first as Json)['ended_at'], isNotNull);
    expectError(() => run(toTawafReady(), [ev(EV.pause)]), 'NOT_PAUSABLE');
  });

  test('correcting down drops the rounds from the corrected one onwards', () {
    var st = tawafTo(toTawafReady(), 5);
    st = run(st, [ev(EV.correctTawafRound, {'round': 3})]);
    expect(stageOf(st), 'TAWAF_ROUND_3');
    expect(((sess(st)['tawaf'] as Json)['rounds'] as List).cast<Json>().map((r) => r['round_number']).toList(), [1, 2]);
    expect((sess(st)['corrections'] as List).cast<Json>().map((c) => '${c['kind']}:${c['from']}>${c['to']}').toList(), ['tawaf:5>3']);
    st = run(st, [ev(EV.confirmTawafRound, {'round': 3})]);
    expect(stageOf(st), 'TAWAF_ROUND_4');
  });

  test('correcting up fills the skipped rounds as corrections', () {
    var st = tawafTo(toTawafReady(), 2);
    st = run(st, [ev(EV.correctTawafRound, {'round': 5})]);
    final rounds = ((sess(st)['tawaf'] as Json)['rounds'] as List).cast<Json>();
    expect(rounds.map((r) => r['round_number']).toList(), [1, 2, 3, 4]);
    expect(rounds.map((r) => r['source']).toList(), ['confirmed', 'correction', 'correction', 'correction']);
    expectError(() => run(st, [ev(EV.correctTawafRound, {'round': 8})]), 'BAD_COUNT');
  });

  test('Tawaf can be recounted until Sa’i starts, then not any more', () {
    var st = run(completeTawaf(toTawafReady()), [ev(EV.next), ev(EV.next)]);
    expect(stageOf(st), Stage.zamzam);
    expect(sess(st)['two_rakah_at'], isNotNull);
    final back = run(st, [ev(EV.correctTawafRound, {'round': 7})]);
    expect(stageOf(back), 'TAWAF_ROUND_7');
    expect(sess(back)['two_rakah_at'], isNull);
    expect((sess(back)['tawaf'] as Json)['status'], 'in_progress');

    st = run(st, [ev(EV.next), ev(EV.startSai)]);
    expectError(() => run(st, [ev(EV.correctTawafRound, {'round': 6})]), 'NOT_CORRECTABLE');
  });

  test('Sa’i laps alternate direction, start at Safa and end at Marwah', () {
    final dirs = [1, 2, 3, 4, 5, 6, 7].map((n) => saiDirection(n).key).toList();
    expect(dirs, ['SAFA_TO_MARWAH', 'MARWAH_TO_SAFA', 'SAFA_TO_MARWAH', 'MARWAH_TO_SAFA', 'SAFA_TO_MARWAH', 'MARWAH_TO_SAFA', 'SAFA_TO_MARWAH']);
    var st = run(toSafa(toTawafReady()), [ev(EV.startSai)]);
    for (var n = 1; n <= 4; n++) {
      st = run(st, [ev(EV.confirmSaiLap, {'lap': n})]);
    }
    st = run(st, [ev(EV.correctSaiLap, {'lap': 4})]);
    final laps = ((sess(st)['sai'] as Json)['laps'] as List).cast<Json>();
    expect(laps.map((l) => '${l['lap_number']}:${l['start_location']}>${l['end_location']}').toList(), ['1:SAFA>MARWAH', '2:MARWAH>SAFA', '3:SAFA>MARWAH']);
  });

  test('women shorten the hair and cannot record shaving', () {
    var st = run(completeSai(toSafa(toTawafReady('female'))), [ev(EV.next)]);
    expectError(() => run(st, [ev(EV.confirmHair, {'method': 'shave'})]), 'BAD_HAIR_METHOD');
    st = run(st, [ev(EV.confirmHair, {'method': 'shorten'})]);
    expect(stageOf(st), Stage.ihramExit);
  });

  test('sessions: one active at a time, reset and restart archive the old one', () {
    expectError(() => run(initialState(), [ev(EV.start)]), 'GENDER_REQUIRED');
    var st = run(initialState(), [ev(EV.start, {'gender': 'male'})]);
    expectError(() => run(st, [ev(EV.start, {'gender': 'male'})]), 'SESSION_ACTIVE');
    st = run(st, [ev(EV.reset)]);
    expect(st['session'], isNull);
    expect(((st['archive'] as List).first as Json)['status'], 'abandoned');

    var done = completeSai(toSafa(toTawafReady()));
    done = run(done, [ev(EV.next), ev(EV.confirmHair, {'method': 'shorten'}), ev(EV.next)]);
    expectError(() => run(done, [ev(EV.next)]), 'SESSION_CLOSED');
    final again = run(done, [ev(EV.start, {'gender': 'male'})]);
    expect(((again['archive'] as List).last as Json)['status'], 'complete');
    expect(stageOf(again), Stage.miqat);
  });

  test('transition never mutates the previous state', () {
    final st = tawafTo(toTawafReady(), 2);
    final snapshot = jsonEncode(st);
    run(st, [ev(EV.confirmTawafRound, {'round': 2})]);
    expect(jsonEncode(st), snapshot);
  });

  test('tracking confidence is stored on the confirmed round', () {
    final st = run(tawafTo(toTawafReady(), 1), [ev(EV.confirmTawafRound, {'round': 1, 'confidence': 'high'})]);
    expect((((sess(st)['tawaf'] as Json)['rounds'] as List).first as Json)['tracking_confidence'], 'high');
    expectError(() => run(st, [ev(EV.setTrackingMode, {'mode': 'autopilot'})]), 'BAD_MODE');
  });

  test('overall progress rises monotonically from 0 to 1', () {
    final values = stageOrder.sublist(1).map(progressOf).toList();
    expect(values.first, 0);
    expect(values.last, 1);
    for (var i = 1; i < values.length; i++) {
      expect(values[i], greaterThan(values[i - 1]));
    }
  });
}
