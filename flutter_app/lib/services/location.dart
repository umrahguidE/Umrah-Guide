// One place for asking the phone for location, so every screen reports the
// same plain-language errors (these are English source strings that go through
// the translator).
import 'dart:async';

import 'package:geolocator/geolocator.dart';

import '../engine/geo.dart';

class LocationProblem implements Exception {
  const LocationProblem(this.message);
  final String message;
  @override
  String toString() => message;
}

typedef GeoFix = ({GeoPoint point, double accuracyM});

Future<void> ensureLocationPermission() async {
  try {
    if (!await Geolocator.isLocationServiceEnabled()) throw const LocationProblem('Location is not available on this device.');
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      throw const LocationProblem('Location permission was denied.');
    }
  } on LocationProblem {
    rethrow;
  } catch (_) {
    throw const LocationProblem('Could not get your location.');
  }
}

/// One position fix, asking for permission first.
Future<GeoFix> currentFix() async {
  await ensureLocationPermission();
  try {
    final p = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 20)),
    );
    return (point: GeoPoint(p.latitude, p.longitude), accuracyM: p.accuracy);
  } catch (_) {
    throw const LocationProblem('Could not get your location.');
  }
}

/// A live stream of fixes ([precise] = best accuracy; otherwise a light,
/// battery-friendly watch for the Miqat).
Stream<Position> watchFixes({required bool precise}) => Geolocator.getPositionStream(
      locationSettings: LocationSettings(accuracy: precise ? LocationAccuracy.best : LocationAccuracy.medium, distanceFilter: 0),
    );
