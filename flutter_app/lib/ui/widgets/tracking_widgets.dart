// The live-tracking parts of the Tawaf and Sa'i screens: the status card with
// its manual/automatic switch, the source chips, the corner checklist, the
// "now beside" card and the map card. Ports of the matching functions in
// src/ui/views.js.
import 'package:flutter/material.dart';

import '../../app/app_controller.dart';
import '../../engine/geo.dart';
import '../../engine/machine.dart' show Json;
import '../../engine/tracking.dart';
import '../app_scope.dart';
import '../painters/haram_map.dart';
import '../theme.dart';
import 'common.dart';
import 'dua_card.dart';
import 'real_map.dart';

const Map<String, String> _modeLabel = {
  'gps+compass': 'GPS + compass',
  'gps+steps': 'GPS + steps',
  'gps': 'GPS',
  'compass': 'Compass only — GPS is weak here',
  'steps': 'Steps only — GPS is weak here',
};

const Map<String, String> confidenceLabel = {
  'high': 'high confidence',
  'medium': 'medium confidence',
  'low': 'low confidence — check it yourself',
};

Map<String, String> haramMapLabels(BuildContext context) => {
      'safa': context.t('SAFA'),
      'marwah': context.t('MARWAH'),
      'greenMarkers': context.t('green markers'),
      'start': context.t('START'),
      'maqam': context.t('Maqām Ibrāhīm'),
      'scale': context.t('50 m'),
    };

/// The manual/automatic tracking status, shown as a clear card with a button
/// (not a small link) on every round/lap screen, with the full weak-signal
/// warning when counting by location is not possible.
class TrackingStatusCard extends StatelessWidget {
  const TrackingStatusCard({super.key, required this.session, required this.reading, required this.lastConfirmed});
  final Json session;
  final TrackingReading? reading;
  final String lastConfirmed;

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final r = reading;
    if (session['tracking_mode'] != 'assisted') {
      return _toggleCard(context, title: '📍 ${context.t('Location help is OFF')}', sub: context.t('The phone only suggests when a round may be finished. You always confirm it yourself.'), button: context.t('Turn on'), onPressed: () => app.setTracking('assisted'));
    }
    if (r == null || r.status == 'waiting') {
      return _toggleCard(context, title: '📡 ${context.t('Waiting for a location fix…')}', button: context.t('Turn off'), onPressed: () => app.setTracking('manual'));
    }
    if (r.status == 'ok') {
      return _toggleCard(context, title: '📡 ${context.t(_modeLabel[r.mode] ?? 'Tracking')}', button: context.t('Turn off'), onPressed: () => app.setTracking('manual'), ok: true);
    }
    final why = switch (r.status) {
      'weak' => 'Tracking signal weak',
      'denied' => 'Location permission denied',
      'unavailable' => 'Location unavailable',
      'unsupported' => 'Location is not supported on this device',
      'out_of_area' => 'You seem to be outside the tracking area',
      _ => 'Tracking unavailable',
    };
    return AlertBox(
      kind: AlertKind.warn,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('⚠ ${context.t(why)}', style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(context.t('We cannot reliably determine your current position.')),
          const SizedBox(height: 6),
          Text(context.t('Your last confirmed progress:')),
          Text(lastConfirmed, style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(context.t('Please count yourself and confirm manually.')),
          const SizedBox(height: 10),
          SoftButton(label: context.t('Continue manually'), onPressed: () => app.setTracking('manual')),
        ],
      ),
    );
  }

  Widget _toggleCard(BuildContext context, {required String title, String? sub, required String button, required VoidCallback onPressed, bool ok = false}) {
    final c = context.c;
    return AppCard(
      borderColor: ok ? c.green : c.border,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyle(fontWeight: FontWeight.w800, color: ok ? c.green : c.text, fontSize: 15.5)),
                if (sub != null) Muted(sub, small: true),
              ],
            ),
          ),
          const SizedBox(width: 10),
          SoftButton(label: button, small: true, onPressed: onPressed),
        ],
      ),
    );
  }
}

/// The simple on/off card shown before a Tawaf or Sa'i starts.
class TrackingToggleCard extends StatelessWidget {
  const TrackingToggleCard({super.key, required this.session});
  final Json session;

  @override
  Widget build(BuildContext context) {
    final on = session['tracking_mode'] == 'assisted';
    final app = context.app;
    final c = context.c;
    return AppCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('📡 ${on ? context.t('Location help is ON') : context.t('Location help is OFF')}', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5, color: c.text)),
                Muted(context.t('The phone only suggests when a round may be finished. You always confirm it yourself.'), small: true),
              ],
            ),
          ),
          const SizedBox(width: 10),
          SoftButton(label: on ? context.t('Turn off') : context.t('Turn on'), small: true, onPressed: () => app.setTracking(on ? 'manual' : 'assisted')),
        ],
      ),
    );
  }
}

class SourceChips extends StatelessWidget {
  const SourceChips(this.reading, {super.key});
  final TrackingReading? reading;

  @override
  Widget build(BuildContext context) {
    final r = reading;
    if (r == null || !r.isOk) return const SizedBox.shrink();
    final steps = r.stepsThisRound ?? r.stepsThisLap ?? 0;
    final isTawaf = r.checkpoints != null;
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        Chip2('📡 GPS', on: r.mode?.contains('gps') ?? false),
        if (isTawaf) Chip2('🧭 ${context.t('Turning')}', on: r.mode?.contains('compass') ?? false),
        Chip2('👣 ${context.t('{n} steps', {'n': steps})}', on: r.mode?.contains('steps') ?? false),
        if (r.confidence != null) Chip2(context.t(confidenceLabel[r.confidence] ?? ''), warn: r.confidence == 'low'),
      ],
    );
  }
}

class CornerChecks extends StatelessWidget {
  const CornerChecks({super.key, required this.checkpoints, required this.nearStart});
  final Checkpoints? checkpoints;
  final bool nearStart;

  @override
  Widget build(BuildContext context) {
    final cp = checkpoints;
    if (cp == null) return const SizedBox.shrink();
    final all = cp.all;
    Widget item(bool done, String label) => Chip2('${done ? '✓' : '○'} $label', ok: done);
    return Semantics(
      label: context.t('Corners passed this round'),
      child: Wrap(spacing: 6, runSpacing: 6, children: [
        item(cp.iraqi, context.t('ʿIrāqī')),
        item(cp.shami, context.t('Shāmī')),
        item(cp.yemeni, context.t('Yemeni')),
        item(all && nearStart, context.t('Black Stone')),
      ]),
    );
  }
}

/// Where you are beside the Kaaba, what to do there, and the recitation for that spot.
class SectorCard extends StatelessWidget {
  const SectorCard(this.sector, {super.key});
  final KaabaSector? sector;

  @override
  Widget build(BuildContext context) {
    final s = sector;
    if (s == null) return const SizedBox.shrink();
    final c = context.c;
    final app = context.app;
    return AppCard(
      borderColor: c.border,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('📍 ${context.t('Now beside: {place}', {'place': context.t(s.label)})}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 4),
          Text(context.t(s.tip), style: const TextStyle(fontSize: 15.5, height: 1.4)),
          if (s.duaId != null && app.clips.hasRecording(s.duaId!)) ...[const SizedBox(height: 8), ListenBlock(s.duaId!)],
        ],
      ),
    );
  }
}

/// "Map and tracking details": the offline Kaaba diagram, or — when the
/// tracker's GPS fix says the pilgrim is far from Makkah — the real live map.
class MapDetailsCard extends StatelessWidget {
  const MapDetailsCard({super.key, required this.kind, required this.session});
  final String kind; // 'tawaf' or 'sai'
  final Json session;

  @override
  Widget build(BuildContext context) {
    if (session['tracking_mode'] != 'assisted') return const SizedBox.shrink();
    final app = context.app;
    final r = app.reading;
    final fix = r != null && r.isOk;
    final LiveFix live = app.live;
    final farAway = live.distanceM != null && live.distanceM! > mapRangeM;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionTitle('🗺 ${context.t('Map and tracking details')}'),
          if (farAway) ...[
            RealMap(point: live.latLng, accuracyM: live.accuracyM),
            const SizedBox(height: 8),
            Muted(context.t('You are about {km} km from Masjid al-Haram, so this shows a real online map with your live location instead of the mosque diagram. It will switch back automatically once you are close to Masjid al-Haram.', {'km': (live.distanceM! / 1000).toStringAsFixed(1)})),
          ] else ...[
            if (kind == 'tawaf') ...[CornerChecks(checkpoints: fix ? r.checkpoints : null, nearStart: r?.nearStart ?? false), const SizedBox(height: 8)],
            SourceChips(r),
            const SizedBox(height: 8),
            HaramMap(
              pilgrim: kind == 'tawaf' && r?.position != null ? LocalPoint(r!.position!.x, r.position!.y) : null,
              accuracyM: r?.position?.accuracyM,
              trail: app.map.trail,
              focus: kind,
              saiFromSafa: kind == 'sai' && fix ? r.fromSafa : null,
              labels: haramMapLabels(context),
              semanticsLabel: context.t('Map of Masjid al-Haram'),
            ),
          ],
        ],
      ),
    );
  }
}
