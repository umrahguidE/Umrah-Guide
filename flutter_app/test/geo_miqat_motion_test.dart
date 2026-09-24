// Ports of tests/geo-miqat.test.js and tests/motion.test.js, plus checks that
// the site geometry typed into tracking.dart matches the exported source data.
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:guided_umrah/engine/geo.dart';
import 'package:guided_umrah/engine/miqat.dart';
import 'package:guided_umrah/engine/motion.dart';
import 'package:guided_umrah/engine/tracking.dart';

Map<String, dynamic> loadContent() => jsonDecode(File('assets/data/content.json').readAsStringSync()) as Map<String, dynamic>;

List<MiqatPoint> allMiqats() => (loadContent()['MIQATS'] as List).map((m) => MiqatPoint.fromJson(m as Map<String, dynamic>)).toList();

void main() {
  group('geo', () {
    test('normDeg wraps into [-180, 180)', () {
      expect(normDeg(0), 0);
      expect(normDeg(190), -170);
      expect(normDeg(-190), 170);
      expect(normDeg(-600), 120);
      expect(normDeg(720), 0);
    });

    test('destination and bearing/distance agree', () {
      final p = destination(makkah, 90, 1000);
      expect((distanceM(makkah, p) - 1000).abs(), lessThan(0.5));
      expect((bearingDeg(makkah, p) - 90).abs(), lessThan(0.1));
      expect((bearingDeg(makkah, destination(makkah, 0, 500)) - 0).abs(), lessThan(0.1));
    });
  });

  group('miqat', () {
    test('Dhul-Hulayfah is the farthest Miqat and all are within 500 km', () {
      final radii = {for (final m in allMiqats()) m.id: miqatRadiusKm(m)};
      expect(radii.values.reduce(math.max), radii['dhul-hulayfah']);
      for (final km in radii.values) {
        expect(km, greaterThan(40));
        expect(km, lessThan(500));
      }
    });

    test('miqat status: far, approaching and reached', () {
      final yalamlam = allMiqats().where((m) => m.id == 'yalamlam').toList();
      expect(miqatStatus(const GeoPoint(51.5, -0.12), yalamlam).status, 'far');
      final near = destination(makkah, 180, (miqatRadiusKm(yalamlam.first) + 50) * 1000);
      final r = miqatStatus(near, yalamlam);
      expect(r.status, 'approaching');
      expect((r.first.kmToBoundary - 50).abs(), lessThan(1));
      expect(miqatStatus(const GeoPoint(21.5433, 39.1728), yalamlam).status, 'reached', reason: 'Jeddah is inside the boundary');
    });

    test('with several candidates the first boundary on the way applies', () {
      final both = allMiqats().where((m) => ['yalamlam', 'qarn'].contains(m.id)).toList();
      final farther = both.reduce((a, b) => miqatRadiusKm(a) > miqatRadiusKm(b) ? a : b);
      final r = miqatStatus(destination(makkah, 120, 400000), both);
      expect(r.first.id, farther.id);
    });
  });

  group('motion', () {
    // 60 Hz accelerometer samples of someone walking at `hz` steps per second.
    int walkSignal(StepDetector detector, {required int seconds, double hz = 2, double amplitude = 3, double noise = 0}) {
      final rnd = math.Random(7);
      for (var i = 0; i < seconds * 60; i++) {
        final t = i * (1000 / 60);
        final a = 9.81 + amplitude * math.sin(2 * math.pi * hz * (t / 1000)) + (noise > 0 ? (rnd.nextDouble() - 0.5) * 2 * noise : 0);
        detector.update(0, 0, a, t);
      }
      return detector.steps;
    }

    test('counts walking steps within a few per cent', () {
      final steps = walkSignal(StepDetector(), seconds: 10, hz: 2);
      expect((steps - 20).abs(), lessThanOrEqualTo(2), reason: 'counted $steps, expected about 20');
    });

    test('survives noisy sensor data', () {
      final steps = walkSignal(StepDetector(), seconds: 20, hz: 1.8, amplitude: 2.5, noise: 0.4);
      expect((steps - 36).abs(), lessThanOrEqualTo(5), reason: 'counted $steps, expected about 36');
    });

    test('standing still counts nothing', () {
      final detector = StepDetector();
      final rnd = math.Random(3);
      for (var i = 0; i < 1200; i++) {
        detector.update(0, 0, 9.81 + (rnd.nextDouble() - 0.5) * 0.3, i * (1000 / 60));
      }
      expect(detector.steps, 0);
    });

    test('step length is learned from a well measured lap, and absurd values rejected', () {
      expect(calibrateStepLength(390, 520), 0.75);
      expect(calibrateStepLength(390, 90), isNull, reason: 'too few steps to trust');
      expect(calibrateStepLength(390, 200), isNull, reason: 'almost 2 m per step is not walking');
      expect(calibrateStepLength(0, 500), isNull);
    });
  });

  group('site geometry matches the exported source data', () {
    // The typed constants in tracking.dart must equal what the web app uses.
    final geo = loadContent()['HARAM_GEO'] as Map<String, dynamic>;
    GeoPoint pt(dynamic j) => GeoPoint.fromJson(j as Map<String, dynamic>);
    void same(GeoPoint a, GeoPoint b, String what) {
      expect(a.lat, b.lat, reason: '$what lat');
      expect(a.lng, b.lng, reason: '$what lng');
    }

    test('points, lines and outline', () {
      same(haramGeo.kaabaCenter, pt(geo['kaabaCenter']), 'kaabaCenter');
      final corners = geo['kaabaCorners'] as Map<String, dynamic>;
      same(haramGeo.blackStone, pt(corners['blackStone']), 'blackStone');
      same(haramGeo.iraqi, pt(corners['iraqi']), 'iraqi');
      same(haramGeo.shami, pt(corners['shami']), 'shami');
      same(haramGeo.yemeni, pt(corners['yemeni']), 'yemeni');
      same(haramGeo.maqam, pt(geo['maqam']), 'maqam');
      same(haramGeo.safa, pt(geo['safa']), 'safa');
      same(haramGeo.marwah, pt(geo['marwah']), 'marwah');
      expect(haramGeo.blackStoneBearingDeg, geo['blackStoneBearingDeg']);
      expect(haramGeo.greenZone, (geo['greenZone'] as List).cast<num>().map((e) => e.toDouble()).toList());
      final line = (geo['startLine'] as List).map(pt).toList();
      expect(haramGeo.startLine.length, line.length);
      for (var i = 0; i < line.length; i++) {
        same(haramGeo.startLine[i], line[i], 'startLine[$i]');
      }
      final hijr = (geo['hijr'] as List).map(pt).toList();
      expect(haramGeo.hijr.length, hijr.length);
      for (var i = 0; i < hijr.length; i++) {
        same(haramGeo.hijr[i], hijr[i], 'hijr[$i]');
      }
    });

    test('Kaaba sectors', () {
      final sectors = (loadContent()['KAABA_SECTORS'] as List).cast<Map<String, dynamic>>();
      expect(kaabaSectors.length, sectors.length);
      for (var i = 0; i < sectors.length; i++) {
        expect(kaabaSectors[i].id, sectors[i]['id']);
        expect(kaabaSectors[i].from, sectors[i]['from']);
        expect(kaabaSectors[i].to, sectors[i]['to']);
        expect(kaabaSectors[i].label, sectors[i]['label']);
        expect(kaabaSectors[i].tip, sectors[i]['tip']);
        expect(kaabaSectors[i].duaId, sectors[i]['duaId']);
      }
    });
  });
}
