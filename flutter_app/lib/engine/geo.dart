// Small spherical-geometry helpers; accurate to well under a metre at Haram
// scale. Port of src/engine/geo.js.
import 'dart:math' as math;

const double _earthRadiusM = 6371008.8;
double _rad(double d) => d * math.pi / 180;
double _deg(double r) => r * 180 / math.pi;

class GeoPoint {
  const GeoPoint(this.lat, this.lng);
  final double lat;
  final double lng;

  factory GeoPoint.fromJson(Map<String, dynamic> j) => GeoPoint((j['lat'] as num).toDouble(), (j['lng'] as num).toDouble());

  @override
  String toString() => 'GeoPoint($lat, $lng)';
}

/// East/north metres relative to some origin.
class LocalPoint {
  const LocalPoint(this.x, this.y);
  final double x;
  final double y;
}

double distanceM(GeoPoint a, GeoPoint b) {
  final dLat = _rad(b.lat - a.lat);
  final dLng = _rad(b.lng - a.lng);
  final h = math.pow(math.sin(dLat / 2), 2) + math.cos(_rad(a.lat)) * math.cos(_rad(b.lat)) * math.pow(math.sin(dLng / 2), 2);
  return 2 * _earthRadiusM * math.asin(math.min(1.0, math.sqrt(h)));
}

/// Initial bearing from [from] to [to], degrees clockwise from north in [0, 360).
double bearingDeg(GeoPoint from, GeoPoint to) {
  final lat1 = _rad(from.lat);
  final lat2 = _rad(to.lat);
  final dLng = _rad(to.lng - from.lng);
  final y = math.sin(dLng) * math.cos(lat2);
  final x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dLng);
  return (_deg(math.atan2(y, x)) + 360) % 360;
}

/// Wraps an angle into [-180, 180).
double normDeg(double d) => ((((d + 180) % 360) + 360) % 360) - 180;

/// Point reached by travelling [distM] metres from [from] on [bearing].
GeoPoint destination(GeoPoint from, double bearing, double distM) {
  final delta = distM / _earthRadiusM;
  final theta = _rad(bearing);
  final lat1 = _rad(from.lat);
  final lng1 = _rad(from.lng);
  final lat2 = math.asin(math.sin(lat1) * math.cos(delta) + math.cos(lat1) * math.sin(delta) * math.cos(theta));
  final lng2 = lng1 + math.atan2(math.sin(theta) * math.sin(delta) * math.cos(lat1), math.cos(delta) - math.sin(lat1) * math.sin(lat2));
  return GeoPoint(_deg(lat2), _deg(lng2));
}

/// Local east/north metres of [p] relative to [origin] (equirectangular; fine
/// over a few km).
LocalPoint toLocalM(GeoPoint origin, GeoPoint p) => LocalPoint(
      _rad(p.lng - origin.lng) * _earthRadiusM * math.cos(_rad(origin.lat)),
      _rad(p.lat - origin.lat) * _earthRadiusM,
    );

GeoPoint lerpPoint(GeoPoint a, GeoPoint b, double t) => GeoPoint(a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t);
