// The Map tab: the offline Masjid al-Haram diagram with the pilgrim's live
// dot, or — when they are more than ~500 m away — a real online map. Port of
// mapPage in src/ui/views.js.
import 'package:flutter/material.dart';

import '../../engine/geo.dart';
import '../../engine/stages.dart';
import '../app_scope.dart';
import '../painters/haram_map.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/real_map.dart';
import '../widgets/tracking_widgets.dart' show haramMapLabels;

class MapPage extends StatelessWidget {
  const MapPage({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final m = app.map;
    final c = context.c;
    final realMap = m.showsRealMap;
    final s = app.session;
    final p = s == null ? null : parseStage(s['current_stage'] as String);
    final r = app.reading;
    final pos = m.position ?? (r?.position == null ? null : LocalPoint(r!.position!.x, r.position!.y));
    String? status;
    if (m.live) {
      status = realMap
          ? '📡 ${context.t('Live on the real map · accuracy about ±{m} m', {'m': (m.accuracyM ?? 0).round()})}'
          : m.position != null
              ? '📡 ${context.t('Live · accuracy about ±{m} m', {'m': (m.accuracyM ?? 0).round()})}'
              : '📡 ${context.t('Waiting for a location fix…')}';
    }
    return Stack14([
      PageHeading(context.t('Map'), lead: context.t('Masjid al-Haram. Works offline — your live location on a real map needs internet.')),
      if (m.error != null) AlertBox(kind: AlertKind.warn, child: Text(context.t(m.error!))),
      AppCard(
        padding: const EdgeInsets.all(10),
        child: realMap
            ? RealMap(point: m.latLng, accuracyM: m.accuracyM, height: 420)
            : HaramMap(
                pilgrim: pos,
                accuracyM: m.accuracyM ?? r?.position?.accuracyM,
                trail: m.trail,
                saiFromSafa: p?.kind == 'sai' ? r?.fromSafa : null,
                focus: p == null || p.kind == 'simple' ? null : p.kind,
                labels: haramMapLabels(context),
                semanticsLabel: context.t('Map of Masjid al-Haram'),
              ),
      ),
      Wrap(spacing: 8, runSpacing: 8, children: [
        SoftButton(label: m.live ? '⏹ ${context.t('Stop showing my location')}' : '📍 ${context.t('Show my location')}', primary: m.live, onPressed: app.toggleMapLive),
        if (!realMap && m.trail.isNotEmpty) SoftButton(label: context.t('Clear trail'), onPressed: app.clearTrail),
      ]),
      if (status != null) Semantics(liveRegion: true, child: Text(status, style: TextStyle(fontWeight: FontWeight.w700, color: m.position != null || realMap ? c.green : c.muted))),
      if (realMap)
        Muted(context.t('You are about {km} km from Masjid al-Haram, so this shows a real online map with your live location instead of the mosque diagram. It will switch back automatically once you are close to Masjid al-Haram.', {'km': (m.distanceM! / 1000).toStringAsFixed(1)})),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SectionTitle(context.t('What you are looking at')),
          PointsList([
            context.t('Kaaba, with the Black Stone corner and the START line to the green light: every Tawaf round begins and ends there.'),
            context.t('Ḥijr Ismāʿīl: the semicircular wall. Walk outside it — it is part of the Kaaba.'),
            context.t('Maqām Ibrāhīm: where the two rak’ahs after Tawaf are prayed if there is space.'),
            context.t('Mas’a: Safa at the south end, Marwah at the north, with the green-marker section marked.'),
          ]),
          const SizedBox(height: 6),
          Muted(context.t('Positions come from OpenStreetMap survey data. For gates and services, follow the mosque’s own signs and staff.'), small: true),
        ]),
      ),
    ]);
  }
}
