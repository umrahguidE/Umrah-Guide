// Port of tests/tracking.test.js — the same walks and expectations, against the
// Dart trackers.
import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:guided_umrah/engine/geo.dart';
import 'package:guided_umrah/engine/tracking.dart';

final double b = haramGeo.blackStoneBearingDeg;
final math.Random rnd = math.Random(20260924);
double clock = 0;
double tick([double ms = 1000]) => clock += ms;
double jitter() => rnd.nextDouble() - 0.5;

PositionSample sample(GeoPoint p, double accuracy, double t) => PositionSample(lat: p.lat, lng: p.lng, accuracy: accuracy, timestamp: t);

// Walks around the Kaaba at about 1.5 m/s. Positive degrees = anticlockwise =
// the Tawaf direction.
TrackingReading walk(TawafTracker tracker, {required double fromBearing, required double degrees, double stepDeg = 3, double radius = 30, double accuracy = 5}) {
  late TrackingReading reading;
  final dir = degrees == 0 ? 1 : degrees.sign;
  for (double d = 0; d <= degrees.abs(); d += stepDeg) {
    final p = destination(haramGeo.kaabaCenter, fromBearing - dir * d, radius);
    reading = tracker.update(sample(p, accuracy, tick()));
  }
  return reading;
}

TrackingReading saiWalk(SaiTracker tracker, double from, double to, {double accuracy = 5, double stepM = 1.4}) {
  late TrackingReading reading;
  final dir = (to - from) == 0 ? 1.0 : (to - from).sign;
  final stepT = (dir * stepM) / tracker.lengthM;
  for (var t = from; dir > 0 ? t <= to + 1e-9 : t >= to - 1e-9; t += stepT) {
    final p = lerpPoint(haramGeo.safa, haramGeo.marwah, math.min(1.0, math.max(0.0, t)));
    reading = tracker.update(sample(p, accuracy, tick()));
  }
  return reading;
}

void main() {
  test('position filter drops inaccurate fixes, rejects teleports and smooths noise', () {
    final filter = PositionFilter(origin: haramGeo.kaabaCenter);
    expect(filter.update(sample(haramGeo.kaabaCenter, 80, tick())).ok, false);
    final start = destination(haramGeo.kaabaCenter, 90, 30);
    expect(filter.update(sample(start, 5, tick())).ok, true);
    final teleport = destination(haramGeo.kaabaCenter, 270, 30);
    expect(filter.update(sample(teleport, 5, tick())).reason, 'jump');
    // Three fixes agreeing on the new place mean our estimate was the wrong one.
    filter.update(sample(teleport, 5, tick()));
    expect(filter.update(sample(teleport, 5, tick())).ok, true);

    final noisy = PositionFilter(origin: haramGeo.kaabaCenter);
    late FilterResult last;
    for (var i = 0; i < 25; i++) {
      final p = destination(haramGeo.kaabaCenter, 90 + jitter() * 30, 30 + jitter() * 20);
      last = noisy.update(sample(p, 12, tick()));
    }
    final truth = destination(haramGeo.kaabaCenter, 90, 30);
    final truthLocal = PositionFilter(origin: haramGeo.kaabaCenter).update(sample(truth, 1, tick()));
    expect(math.sqrt(math.pow(last.x - truthLocal.x, 2) + math.pow(last.y - truthLocal.y, 2)), lessThan(8), reason: 'smoothed position stays near the truth');
  });

  test('a round is suggested only after a full anticlockwise circuit past every corner', () {
    final tr = TawafTracker(now: clock);
    var r = walk(tr, fromBearing: b, degrees: 10);
    expect(r.nearStart, true);
    expect(r.suggestCompletion, false, reason: 'standing at the start line is not a finished round');
    r = walk(tr, fromBearing: b - 10, degrees: 320);
    expect(r.suggestCompletion, false, reason: '330 degrees is not yet a round');
    expect(r.checkpoints!.iraqi && r.checkpoints!.shami && r.checkpoints!.yemeni, true);
    r = walk(tr, fromBearing: b - 330, degrees: 30);
    expect(r.suggestCompletion, true);
    expect(r.progress, greaterThan(0.9), reason: 'progress ${r.progress}');
    expect(r.mode, 'gps');
    expect(r.confidence, 'medium', reason: 'GPS alone is medium confidence');
  });

  test('turning back before the last corner does not count as a round', () {
    final tr = TawafTracker(now: clock);
    walk(tr, fromBearing: b, degrees: 200); // out to the Shami side
    final r = walk(tr, fromBearing: b - 200, degrees: -200); // and back the way they came
    expect(r.checkpoints!.yemeni, false);
    expect(r.suggestCompletion, false);
  });

  test('standing still with jittery GPS never suggests a round', () {
    final tr = TawafTracker(now: clock);
    for (var i = 0; i < 200; i++) {
      final p = destination(haramGeo.kaabaCenter, b + jitter() * 40, 25 + jitter() * 20);
      tr.update(sample(p, 15, tick(500)));
    }
    final r = tr.reading;
    expect(r.suggestCompletion, false);
    expect(r.progress, lessThan(0.5), reason: 'jitter must not accumulate a round (${r.progress})');
  });

  test('the compass alone can count a round when GPS is unusable indoors', () {
    final tr = TawafTracker(now: clock);
    late TrackingReading r;
    for (var d = 0; d <= 360; d += 5) {
      r = tr.updateHeading((b - 90 - d + 720) % 360, tick(400));
    }
    expect(r.mode, 'compass');
    expect(r.status, 'ok');
    expect(r.suggestCompletion, true);
    expect(r.confidence, 'medium');
  });

  test('GPS and compass agreeing give high confidence; disagreeing gives low', () {
    final agree = TawafTracker(now: clock);
    for (var d = 0; d <= 360; d += 3) {
      final p = destination(haramGeo.kaabaCenter, b - d, 30);
      final t = tick(600);
      agree.update(sample(p, 6, t));
      agree.updateHeading((b - 90 - d + 720) % 360, t);
    }
    expect(agree.reading.mode, 'gps+compass');
    expect(agree.reading.agreement, 'agree');
    expect(agree.reading.confidence, 'high');
    expect(agree.reading.suggestCompletion, true);

    final conflict = TawafTracker(now: clock);
    for (var d = 0; d <= 360; d += 3) {
      final p = destination(haramGeo.kaabaCenter, b - d, 30);
      final t = tick(600);
      conflict.update(sample(p, 6, t));
      conflict.updateHeading(b - 90, t); // phone never turned: compass disagrees
    }
    expect(conflict.reading.agreement, 'conflict');
    expect(conflict.reading.confidence, 'low');
  });

  test('too few steps for a round holds the suggestion back', () {
    final tr = TawafTracker(now: clock);
    tr.updateSteps(0, tick());
    walk(tr, fromBearing: b, degrees: 360);
    tr.updateSteps(12, tick());
    expect(tr.reading.suggestCompletion, false, reason: 'a round cannot happen in 12 steps');
    tr.updateSteps(260, tick());
    expect(tr.reading.suggestCompletion, true);
    expect(tr.reading.stepsThisRound, 260);
  });

  test('the tracker names the part of the Kaaba you are beside', () {
    expect(sectorAt(0)!.id, 'black-stone');
    expect(sectorAt(120)!.id, 'hijr');
    expect(sectorAt(270)!.id, 'yemeni');
    expect(sectorAt(300)!.id, 'rabbana');
    expect(offsetFrom(b - 90, b), 90);
    final tr = TawafTracker(now: clock);
    walk(tr, fromBearing: b, degrees: 145);
    expect(tr.reading.sector!.id, 'hijr');
    expect(tr.reading.sector!.tip, contains('OUTSIDE'));
  });

  test('poor accuracy, distance and silence are reported, never guessed', () {
    final tr = TawafTracker(now: clock);
    walk(tr, fromBearing: b, degrees: 90);
    final before = tr.reading.progress;
    final r = walk(tr, fromBearing: b - 90, degrees: 200, accuracy: 60);
    expect(r.status, 'weak');
    expect(r.progress, before, reason: 'inaccurate fixes never move progress');

    final far = TawafTracker(now: clock);
    expect(far.update(sample(destination(haramGeo.kaabaCenter, 0, 2000), 5, tick())).status, 'out_of_area');

    const t0 = 5000000.0;
    final quiet = TawafTracker(now: t0);
    expect(quiet.reading.status, 'waiting');
    expect(quiet.checkStale(t0 + staleAfterMs + 1).status, 'weak');
    expect(confidenceFor(double.nan), 'low');
  });

  test('startRound resets the count for the next round', () {
    final tr = TawafTracker(now: clock);
    walk(tr, fromBearing: b, degrees: 360);
    tr.startRound();
    expect(tr.reading.progress, 0);
    expect(tr.reading.checkpoints!.iraqi, false);
    final r = walk(tr, fromBearing: b, degrees: 90);
    expect(r.progress, greaterThan(0.15));
    expect(r.progress, lessThan(0.3));
  });

  test('outbound lap: progress, green markers and arrival at Marwah', () {
    final tr = SaiTracker(direction: 'SAFA_TO_MARWAH', now: clock);
    expect(tr.lengthM, greaterThan(300));
    expect(tr.lengthM, lessThan(450));
    var r = saiWalk(tr, 0, 0.03);
    expect(r.progress, lessThan(0.06));
    expect(r.suggestCompletion, false);
    expect(saiWalk(tr, 0.03, 0.15).green, 'ahead');
    expect(saiWalk(tr, 0.15, 0.25).green, 'inside');
    expect(saiWalk(tr, 0.25, 0.5).green, 'passed');
    r = saiWalk(tr, 0.5, 1);
    expect(r.suggestCompletion, true);
    expect(r.mode, 'gps');
  });

  test('return lap measures progress from Marwah towards Safa', () {
    final tr = SaiTracker(direction: 'MARWAH_TO_SAFA', now: clock);
    var r = saiWalk(tr, 1, 0.97);
    expect(r.progress, lessThan(0.06));
    expect(r.suggestCompletion, false);
    expect(saiWalk(tr, 0.97, 0.36).green, 'ahead');
    expect(saiWalk(tr, 0.36, 0.1).green, 'passed');
    r = saiWalk(tr, 0.1, 0);
    expect(r.suggestCompletion, true);
  });

  test('steps carry the lap when GPS fails under the covered Mas’a', () {
    final tr = SaiTracker(direction: 'SAFA_TO_MARWAH', stepLengthM: 0.75, now: clock);
    tr.updateSteps(0, tick());
    final steps = (tr.lengthM / 0.75).round();
    late TrackingReading r;
    for (var s = 10; s <= steps; s += 10) {
      r = tr.updateSteps(s, tick(7000));
    }
    expect(r.mode, 'steps');
    expect(r.status, 'ok');
    expect(r.suggestCompletion, true);
    expect(r.confidence, 'low', reason: 'steps alone are the least certain source');
  });

  test('GPS and steps disagreeing is reported as low confidence', () {
    final tr = SaiTracker(direction: 'SAFA_TO_MARWAH', now: clock);
    tr.updateSteps(0, tick());
    saiWalk(tr, 0, 0.2);
    final r = tr.updateSteps(500, tick());
    expect(r.agreement, 'conflict');
    expect(r.confidence, 'low');
    expect(r.suggestCompletion, false);
  });

  test('Sa’i positions well off the Mas’a are out of area', () {
    final tr = SaiTracker(direction: 'SAFA_TO_MARWAH', now: clock);
    expect(tr.update(sample(destination(haramGeo.safa, 90, 300), 5, tick())).status, 'out_of_area');
  });
}
