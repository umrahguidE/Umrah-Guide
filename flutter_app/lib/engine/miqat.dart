// Route-aware Miqat check. Port of src/engine/miqat.js.
import 'geo.dart';

const GeoPoint makkah = GeoPoint(21.422487, 39.826206);
const double approachAlertKm = 150;

/// The bits of a Miqat the distance maths needs.
class MiqatPoint {
  const MiqatPoint({required this.id, required this.name, required this.coords});
  final String id;
  final String name;
  final GeoPoint coords;

  factory MiqatPoint.fromJson(Map<String, dynamic> j) => MiqatPoint(
        id: j['id'] as String,
        name: j['name'] as String,
        coords: GeoPoint.fromJson(j['coords'] as Map<String, dynamic>),
      );
}

double miqatRadiusKm(MiqatPoint miqat) => distanceM(miqat.coords, makkah) / 1000;

class MiqatCandidate {
  const MiqatCandidate({required this.id, required this.name, required this.radiusKm, required this.kmToBoundary});
  final String id;
  final String name;
  final double radiusKm;
  final double kmToBoundary;
}

class MiqatStatus {
  const MiqatStatus({required this.distanceToMakkahKm, required this.status, required this.first, required this.candidates});
  final double distanceToMakkahKm;

  /// 'reached', 'approaching' or 'far'.
  final String status;
  final MiqatCandidate first;
  final List<MiqatCandidate> candidates;
}

/// Each Miqat is treated as a ring around Makkah at its own distance ("passing
/// parallel to the Miqat"). The boundary reached first is the one that applies,
/// so candidates are sorted by distance still to travel. This is an
/// approximation for alerts only — crew announcements and the pilgrim's scholar
/// take priority.
MiqatStatus miqatStatus(GeoPoint position, List<MiqatPoint> miqats) {
  if (miqats.isEmpty) throw ArgumentError('No Miqat to compare against.');
  final distanceToMakkahKm = distanceM(position, makkah) / 1000;
  final candidates = miqats.map((m) {
    final radiusKm = miqatRadiusKm(m);
    return MiqatCandidate(id: m.id, name: m.name, radiusKm: radiusKm, kmToBoundary: distanceToMakkahKm - radiusKm);
  }).toList()
    ..sort((a, b) => a.kmToBoundary.compareTo(b.kmToBoundary));
  final first = candidates.first;
  final status = first.kmToBoundary <= 0 ? 'reached' : (first.kmToBoundary <= approachAlertKm ? 'approaching' : 'far');
  return MiqatStatus(distanceToMakkahKm: distanceToMakkahKm, status: status, first: first, candidates: candidates);
}
