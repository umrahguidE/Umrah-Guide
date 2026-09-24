// The two counted screens: one Tawaf round and one Sa'i lap. Port of
// tawafRoundView / saiLapView (and their live regions) in src/ui/views.js.
//
// Flutter only rebuilds what changed, so unlike the web app there is no
// hand-written "patch just this region" code: the confirm button is a stable
// widget that a GPS tick can never tear down mid-tap.
import 'package:flutter/material.dart';

import '../../engine/machine.dart' show Json;
import '../../engine/stages.dart';
import '../../engine/tracking.dart';
import '../app_scope.dart';
import '../painters/sai_track.dart';
import '../painters/tawaf_ring.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/dua_card.dart';
import '../widgets/tracking_widgets.dart';
import 'guided_screen.dart' show placeName;
import 'navigation.dart';

/// "Round 3 / 7" with the seven dots underneath.
class _CounterCard extends StatelessWidget {
  const _CounterCard({required this.eyebrow, required this.word, required this.n, required this.total, required this.done, required this.isFinal, this.direction});
  final String eyebrow;
  final String word;
  final int n;
  final int total;
  final int done;
  final bool isFinal;
  final Widget? direction;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return AppCard(
      borderColor: isFinal ? c.gold : c.border,
      borderWidth: isFinal ? 2 : 1,
      child: Column(
        children: [
          Eyebrow(eyebrow),
          const SizedBox(height: 4),
          Semantics(
            header: true,
            child: Text.rich(
              TextSpan(children: [
                TextSpan(text: '$word ', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700)),
                TextSpan(text: '$n', style: TextStyle(fontSize: 56, fontWeight: FontWeight.w800, color: isFinal ? c.gold : c.accent, height: 1.05)),
                TextSpan(text: '  / $total', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: c.muted)),
              ]),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 8),
          RoundDots(done: done, current: n, total: total, semanticsLabel: context.t('{done} of {total} completed', {'done': done, 'total': total})),
          if (direction != null) ...[const SizedBox(height: 10), direction!],
        ],
      ),
    );
  }
}

class _PausedCard extends StatelessWidget {
  const _PausedCard({required this.ritual, required this.label});
  final String ritual;
  final String label;

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    return Semantics(
      liveRegion: true,
      child: AppCard(
        borderColor: context.c.warnLine,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Eyebrow(context.t('Paused')),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(context.t('Tracking paused. Take your time — water, rest, prayer, family.'), style: const TextStyle(fontSize: 16, height: 1.45)),
            const SizedBox(height: 6),
            Muted(context.t(app.content.guidance['PAUSE'] as String)),
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: [
              SoftButton(label: '▶ ${context.t('Resume')}', primary: true, onPressed: app.resume),
              SoftButton(label: ritual == 'tawaf' ? context.t('Correct round') : context.t('Correct lap'), onPressed: () => app.openCorrect(ritual)),
            ]),
          ],
        ),
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({required this.session, required this.ritual});
  final Json session;
  final String ritual;

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final paused = session['paused'] == true;
    return Wrap(spacing: 8, runSpacing: 8, children: [
      SoftButton(label: '🤲 ${context.t('Duas')}', onPressed: () => context.nav.tab(tabDuas)),
      if (!paused) SoftButton(label: '⏸ ${context.t('Pause')}', onPressed: app.pause),
      if (!paused) SoftButton(label: context.t('Wrong count?'), onPressed: () => app.openCorrect(ritual)),
    ]);
  }
}

class _Hint extends StatelessWidget {
  const _Hint(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Center(child: Muted(text, small: true, center: true));
}

Widget _suggestion(BuildContext context, {required String title, required String body}) => AlertBox(
      kind: AlertKind.suggest,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('🔔 $title', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
          const SizedBox(height: 4),
          Text(body),
        ],
      ),
    );

class TawafRoundView extends StatelessWidget {
  const TawafRoundView({super.key, required this.session, required this.n});
  final Json session;
  final int n;

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final s = session;
    final g = app.content.guide('TAWAF_ROUND');
    final done = ((s['tawaf'] as Json)['rounds'] as List).length;
    final isFinal = n == tawafRounds;
    final r = app.reading;
    final fix = s['tracking_mode'] == 'assisted' && r != null && r.isOk;
    final ready = fix && r.suggestCompletion;
    final paused = s['paused'] == true;
    final lastConfirmed = context.t('Tawaf — {done} of {total} rounds confirmed (you are on Round {n})', {'done': done, 'total': tawafRounds, 'n': n});
    return Stack14([
      _CounterCard(eyebrow: '${context.t('Tawaf')}${isFinal ? ' · ${context.t('final round')}' : ''}', word: context.t('Round'), n: n, total: tawafRounds, done: done, isFinal: isFinal),
      if (paused)
        _PausedCard(ritual: 'tawaf', label: context.t('Tawaf — Round {n} / {total}', {'n': n, 'total': tawafRounds}))
      else ...[
        TawafRing(
          startBearing: haramGeo.blackStoneBearingDeg,
          startLabel: context.t('START'),
          progress: fix ? r.progress : null,
          semanticsLabel: context.t('Tawaf ring. Start at the Black Stone line; walk with the Kaaba on your left.'),
        ),
        Center(child: Text.rich(TextSpan(children: [TextSpan(text: '🕋 ${context.t('Kaaba is on your')} '), TextSpan(text: context.t('LEFT'), style: const TextStyle(fontWeight: FontWeight.w800))]), style: const TextStyle(fontSize: 16.8))),
        if (fix) SectorCard(r.sector),
        if (ready) _suggestion(context, title: context.t('Possible round completion'), body: context.t('You appear to have reached the starting point. Confirm only if you have completed Round {n}.', {'n': n})),
        BigButton(
          label: '✓ ${context.t('Confirm Round {n} complete', {'n': n})}',
          gold: isFinal,
          ready: ready,
          onPressed: () => app.confirmRound(n, s['current_stage'] as String),
        ),
        _Hint(context.t('Tap when you are back at the Black Stone line (green light on the wall).')),
      ],
      _ActionRow(session: s, ritual: 'tawaf'),
      if (s['gender'] == 'male' && n <= 3) AlertBox(kind: AlertKind.info, child: Text(context.t(g['ramal'] as String))),
      if (!paused) TrackingStatusCard(session: s, reading: r, lastConfirmed: lastConfirmed),
      MapDetailsCard(kind: 'tawaf', session: s),
      FoldCard(
        title: '🤲 ${context.t('Duas and guidance for Tawaf')}',
        child: Stack14([
          PointsList(app.tr.tList(g['points'] as List?)),
          DuaCard(app.content.dua('black-stone')),
          DuaCard(app.content.dua('yemeni-corner')),
        ]),
      ),
    ]);
  }
}

class _GreenMarkerCard extends StatelessWidget {
  const _GreenMarkerCard({required this.gender, required this.green});
  final String gender;
  final String? green;

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final c = context.c;
    final men = gender == 'male';
    final head = switch (green) {
      'inside' => men ? 'Jogging zone — jog if you are able' : 'Green markers — keep walking normally',
      'ahead' => 'Green markers ahead',
      'passed' => 'Green markers passed',
      _ => 'Green markers',
    };
    final line = (app.content.guide('SAI_LAP')[men ? 'men' : 'women'] as List).first as String;
    return AppCard(
      color: green == 'inside' ? c.okBg : null,
      borderColor: green == 'inside' ? c.green : c.border,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${green == 'passed' ? '✓' : '🟢'} ${context.t(head)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 4),
          Text(context.t(line), style: const TextStyle(fontSize: 15.5, height: 1.4)),
        ],
      ),
    );
  }
}

class SaiLapView extends StatelessWidget {
  const SaiLapView({super.key, required this.session, required this.n});
  final Json session;
  final int n;

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final s = session;
    final g = app.content.guide('SAI_LAP');
    final d = saiDirection(n);
    final done = ((s['sai'] as Json)['laps'] as List).length;
    final isFinal = n == saiLaps;
    final to = placeName(context, d.to);
    final r = app.reading;
    final fix = s['tracking_mode'] == 'assisted' && r != null && r.isOk;
    final ready = fix && r.suggestCompletion;
    final paused = s['paused'] == true;
    final lastConfirmed = context.t('Sa’i — {done} of {total} laps confirmed (you are on Lap {n})', {'done': done, 'total': saiLaps, 'n': n});
    return Stack14([
      _CounterCard(
        eyebrow: '${context.t('Sa’i')}${isFinal ? ' · ${context.t('final lap')}' : ''}',
        word: context.t('Lap'),
        n: n,
        total: saiLaps,
        done: done,
        isFinal: isFinal,
        direction: Text.rich(
          TextSpan(children: [TextSpan(text: '${placeName(context, d.from)} → '), TextSpan(text: to, style: const TextStyle(fontWeight: FontWeight.w800))]),
          style: const TextStyle(fontSize: 19),
        ),
      ),
      if (paused)
        _PausedCard(ritual: 'sai', label: context.t('Sa’i — Lap {n} / {total}', {'n': n, 'total': saiLaps}))
      else ...[
        SaiTrack(
          towardsMarwah: d.to == Place.marwah,
          safaLabel: context.t('SAFA'),
          marwahLabel: context.t('MARWAH'),
          greenLabel: context.t('green markers'),
          fromSafa: fix ? r.fromSafa : null,
          semanticsLabel: d.to == Place.marwah ? context.t('Safa to Marwah') : context.t('Marwah to Safa'),
        ),
        _GreenMarkerCard(gender: s['gender'] as String, green: fix ? r.green : null),
        if (ready)
          _suggestion(
            context,
            title: context.t('{place} reached?', {'place': to}),
            body: '${isFinal ? context.t('You are approaching the final destination.') : context.t('You appear to be at {place}.', {'place': to})} ${context.t('Confirm only when you have arrived.')}',
          ),
        BigButton(
          label: '✓ ${context.t('I have reached {place}', {'place': to})}',
          gold: isFinal,
          ready: ready,
          onPressed: () => app.confirmLap(n, s['current_stage'] as String),
        ),
        _Hint(context.t('On reaching {place}: face the Kaaba, raise your hands, and repeat the dhikr and dua as at Safa.', {'place': to})),
      ],
      _ActionRow(session: s, ritual: 'sai'),
      if (!paused) TrackingStatusCard(session: s, reading: r, lastConfirmed: lastConfirmed),
      MapDetailsCard(kind: 'sai', session: s),
      FoldCard(
        title: '🤲 ${context.t('Duas and guidance for Sa’i')}',
        child: Stack14([
          PointsList(app.tr.tList(g['points'] as List?)),
          DuaCard(app.content.dua('safa-marwah-dhikr')),
          DuaCard(app.content.dua('green-markers')),
        ]),
      ),
    ]);
  }
}
