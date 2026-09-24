// The Umrah tab: home (before starting), the progress card, and one screen per
// stage of the journey (except the counted Tawaf rounds and Sa'i laps, which
// live in counted_screens.dart). Port of guidedPage / SIMPLE_VIEWS in
// src/ui/views.js.
import 'package:flutter/material.dart';

import '../../app/content.dart' show Dua;
import '../../engine/machine.dart' show Json, summarize, ihramChecks;
import '../../engine/stages.dart';
import '../../engine/tracking.dart';
import '../app_scope.dart';
import '../format.dart';
import '../painters/tawaf_ring.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/dua_card.dart';
import '../widgets/miqat_panel.dart';
import '../widgets/tracking_widgets.dart';
import 'counted_screens.dart';
import 'navigation.dart';

const List<({String icon, String name})> umrahSteps = [
  (icon: '📍', name: 'Miqat'),
  (icon: '🤍', name: 'Ihram'),
  (icon: '📣', name: 'Talbiyah'),
  (icon: '🕌', name: 'Masjid al-Haram'),
  (icon: '🕋', name: 'Tawaf'),
  (icon: '🧎', name: 'Two rak’ahs'),
  (icon: '💧', name: 'Zamzam'),
  (icon: '🚶', name: 'Sa’i'),
  (icon: '✂️', name: 'Hair'),
  (icon: '✅', name: 'Complete'),
];

const Map<String, int> _stepOf = {
  'MIQAT': 1, 'IHRAM': 2, 'TALBIYAH': 3, 'ENTER_HARAM': 4, 'TAWAF_READY': 5, 'TAWAF_COMPLETE': 5, 'TWO_RAKAH': 6, //
  'ZAMZAM': 7, 'SAFA': 8, 'SAI_COMPLETE': 8, 'HAIR': 9, 'IHRAM_EXIT': 10, 'UMRAH_COMPLETE': 10,
};

int stepOf(String stage) {
  final p = parseStage(stage);
  if (p.kind == 'tawaf') return 5;
  if (p.kind == 'sai') return 8;
  return _stepOf[stage] ?? 1;
}

String stageName(BuildContext context, String id) {
  final p = parseStage(id);
  if (p.kind == 'tawaf') return context.t('Tawaf — Round {n} / {total}', {'n': p.n, 'total': tawafRounds});
  if (p.kind == 'sai') return context.t('Sa’i — Lap {n} / {total}', {'n': p.n, 'total': saiLaps});
  return context.t(stageTitle(id));
}

String placeName(BuildContext context, String id) => context.t(placeLabel[id]!);

List<String> genderPoints(BuildContext context, Json guide, String gender) => context.app.tr.tList((gender == 'male' ? guide['men'] : guide['women']) as List?);

/// The whole Umrah tab.
class GuidedPage extends StatelessWidget {
  const GuidedPage({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final s = app.session;
    if (s == null) return const HomeContent();
    return Stack14([
      if (s['status'] == 'active') const StatusCard(),
      if (app.error != null) AlertBox(kind: AlertKind.error, child: Text(app.error!)),
      const JustDone(),
      StageBody(session: s),
    ]);
  }
}

class HomeContent extends StatefulWidget {
  const HomeContent({super.key});
  @override
  State<HomeContent> createState() => _HomeContentState();
}

class _HomeContentState extends State<HomeContent> {
  String? _gender;

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final c = context.c;
    final prepDone = app.content.prepChecklist.where((i) => app.prefs.checklist[i['id']] == true).length;
    final nav = context.nav;
    return Stack14([
      AppCard(
        child: Column(
          children: [
            const Text('🕋', style: TextStyle(fontSize: 48)),
            Eyebrow(context.t('Guided Umrah Mode')),
            const SizedBox(height: 4),
            Text(context.t('Your Umrah, one step at a time.'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 25.6, fontWeight: FontWeight.w800, height: 1.2)),
            const SizedBox(height: 10),
            Text(context.t('The app shows you what to do now, counts your rounds, and tells you when you are finished. It works without internet.'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, height: 1.45)),
            if (app.error != null) ...[const SizedBox(height: 10), AlertBox(kind: AlertKind.error, child: Text(app.error!))],
            const SizedBox(height: 16),
            Align(alignment: AlignmentDirectional.centerStart, child: Text(context.t('Show guidance for'), style: TextStyle(color: c.muted, fontWeight: FontWeight.w700))),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: _GenderChoice(label: '👳 ${context.t('Man')}', selected: _gender == 'male', onTap: () => setState(() => _gender = 'male'))),
              const SizedBox(width: 10),
              Expanded(child: _GenderChoice(label: '🧕 ${context.t('Woman')}', selected: _gender == 'female', onTap: () => setState(() => _gender = 'female'))),
            ]),
            const SizedBox(height: 14),
            BigButton(
              label: '▶ ${context.t('Start Umrah')}',
              onPressed: () {
                if (_gender == null) {
                  app.showError(context.t('Choose man or woman so the guidance fits you.'));
                  return;
                }
                app.startUmrah(_gender!);
              },
            ),
          ],
        ),
      ),
      TileGrid([
        TileButton(icon: '🧳', title: context.t('Preparation'), subtitle: context.t('{done} / {total} ready', {'done': prepDone, 'total': app.content.prepChecklist.length}), onTap: () => nav.open(AppPage.prep)),
        TileButton(icon: '🤍', title: context.t('Understand Ihram'), subtitle: context.t('Clothing, intention, restrictions'), onTap: () => nav.open(AppPage.ihram)),
        TileButton(icon: '📍', title: context.t('Miqat guide'), subtitle: context.t('Based on your route'), onTap: () => nav.open(AppPage.miqat)),
        TileButton(icon: '🆘', title: context.t('My info & emergency'), subtitle: context.t('Hotel, group, contacts'), onTap: () => nav.open(AppPage.info)),
        TileButton(icon: '🤲', title: context.t('Duas'), subtitle: context.t('Arabic · recitation · meaning'), onTap: () => nav.tab(tabDuas)),
      ]),
      if (app.archive.isNotEmpty) Center(child: TextButton(onPressed: () => nav.tab(tabJourney), child: Text('${context.t('Past journeys')} (${app.archive.length})'))),
      Center(child: Muted(context.t('Designed and developed by Mhd Wasim'), small: true)),
    ]);
  }
}

class _GenderChoice extends StatelessWidget {
  const _GenderChoice({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          height: 54,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? c.accentSoft : c.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: selected ? c.accent : c.border, width: selected ? 2 : 1),
          ),
          child: Text(label, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16.5, color: selected ? c.accent : c.text)),
        ),
      ),
    );
  }
}

class StatusCard extends StatelessWidget {
  const StatusCard({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final s = app.session!;
    final stage = s['current_stage'] as String;
    final p = parseStage(stage);
    final pct = progressOf(stage);
    final d = p.kind == 'sai' ? saiDirection(p.n!) : null;
    final current = stepOf(stage);
    final c = context.c;
    return Semantics(
      container: true,
      label: context.t('My Umrah progress'),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Eyebrow(context.t('My Umrah')),
              const Spacer(),
              if (app.undoDepth > 0) TextButton(onPressed: app.undo, child: Text('↶ ${context.t('Undo last step')}')),
            ]),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                for (var i = 0; i < umrahSteps.length; i++)
                  Container(
                    width: 28,
                    height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: i + 1 < current ? c.accent : (i + 1 == current ? c.surface : c.surface2),
                      border: Border.all(color: i + 1 <= current ? c.accent : c.border, width: i + 1 == current ? 2.5 : 1),
                    ),
                    child: Text(i + 1 < current ? '✓' : umrahSteps[i].icon, style: TextStyle(fontSize: i + 1 < current ? 13 : 12.5, color: i + 1 < current ? c.accentInk : null, fontWeight: FontWeight.w800)),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: ProgressBar(pct, semanticsLabel: context.t('Overall Umrah progress'))),
              const SizedBox(width: 10),
              Text('${(pct * 100).round()}%', style: const TextStyle(fontWeight: FontWeight.w800)),
            ]),
            const SizedBox(height: 8),
            Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 8, children: [
              Muted(context.t('Now')),
              Text(stageName(context, stage), style: const TextStyle(fontWeight: FontWeight.w800)),
              if (d != null) Muted('${placeName(context, d.from)} → ${placeName(context, d.to)}'),
              if (s['paused'] == true) Chip2(context.t('Paused'), warn: true),
            ]),
          ],
        ),
      ),
    );
  }
}

class JustDone extends StatelessWidget {
  const JustDone({super.key});

  @override
  Widget build(BuildContext context) {
    final j = context.app.justCompleted;
    if (j == null) return const SizedBox.shrink();
    if (j.kind == 'tawaf') {
      return AlertBox(kind: AlertKind.success, child: Text('✓ ${context.t('Round {n} completed', {'n': j.n})}${j.n == tawafRounds ? ' — ${context.t('Tawaf finished')}' : ''}'));
    }
    final d = saiDirection(j.n);
    final next = j.n < saiLaps ? saiDirection(j.n + 1) : null;
    return AlertBox(
      kind: AlertKind.success,
      child: Text('✓ ${context.t('{place} reached — Lap {n} complete', {'place': placeName(context, d.to), 'n': j.n})}'
          '${next != null ? '. ${context.t('Next')}: ${placeName(context, next.from)} → ${placeName(context, next.to)}' : ''}'),
    );
  }
}

class StageBody extends StatelessWidget {
  const StageBody({super.key, required this.session});
  final Json session;

  @override
  Widget build(BuildContext context) {
    final stage = session['current_stage'] as String;
    final p = parseStage(stage);
    if (p.kind == 'tawaf') return TawafRoundView(session: session, n: p.n!);
    if (p.kind == 'sai') return SaiLapView(session: session, n: p.n!);
    return switch (stage) {
      Stage.miqat => _MiqatStage(session),
      Stage.ihram => _IhramStage(session),
      Stage.talbiyah => _TalbiyahStage(session),
      Stage.enterHaram => _EnterHaramStage(session),
      Stage.tawafReady => _TawafReadyStage(session),
      Stage.tawafComplete => _TawafCompleteStage(session),
      Stage.twoRakah => _TwoRakahStage(session),
      Stage.zamzam => _ZamzamStage(session),
      Stage.safa => _SafaStage(session),
      Stage.saiComplete => _SaiCompleteStage(session),
      Stage.hair => _HairStage(session),
      Stage.ihramExit => _IhramExitStage(session),
      Stage.umrahComplete => _CompleteStage(session),
      _ => AlertBox(kind: AlertKind.error, child: Text('${context.t('Unknown step')}: $stage')),
    };
  }
}

/// One big icon, one clear instruction and (below) one big button.
class StepHero extends StatelessWidget {
  const StepHero({super.key, required this.session, required this.title, this.lead});
  final Json session;
  final String title;
  final String? lead;

  @override
  Widget build(BuildContext context) {
    final n = stepOf(session['current_stage'] as String);
    return AppCard(
      child: Column(
        children: [
          Text(umrahSteps[n - 1].icon, style: const TextStyle(fontSize: 44)),
          const SizedBox(height: 4),
          Eyebrow('${context.t('Step {n} of {total}', {'n': n, 'total': umrahSteps.length})} · ${context.t(umrahSteps[n - 1].name)}'),
          const SizedBox(height: 6),
          Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 25.6, fontWeight: FontWeight.w800, height: 1.2)),
          if (lead != null) ...[const SizedBox(height: 8), Text(lead!, textAlign: TextAlign.center, style: TextStyle(fontSize: 16.5, height: 1.45, color: context.c.muted))],
        ],
      ),
    );
  }
}

Widget _continueBtn(BuildContext context, Json s, String label, {bool enabled = true}) => BigButton(label: label, onPressed: enabled ? () => context.app.next(s['current_stage'] as String) : null);

Widget _more(BuildContext context, String key, String title, List<String> points) => FoldCard(title: title, child: PointsList(context.app.tr.tList(points)));

Dua? _dua(BuildContext context, String id) => context.app.content.dua(id);

// ───────────────────────── the simple stages ─────────────────────────

class _MiqatStage extends StatelessWidget {
  const _MiqatStage(this.s);
  final Json s;
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final g = app.content.guide('MIQAT');
    return Stack14([
      StepHero(session: s, title: context.t('Approaching the Miqat'), lead: context.t(g['lead'] as String)),
      MiqatPanel(routeId: (s['miqat'] as Json?)?['route_id'] as String? ?? app.prefs.miqatRoute),
      _continueBtn(context, s, context.t('I’m at the Miqat — enter Ihram')),
      Muted(context.t('Already in Ihram? Continue — you will confirm it on the next screen.'), small: true, center: true),
      _more(context, 'more:MIQAT', context.t('More guidance'), app.content.points(g['points'])),
    ]);
  }
}

class _IhramStage extends StatelessWidget {
  const _IhramStage(this.s);
  final Json s;
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final g = app.content.guide('IHRAM');
    final checks = s['checks'] as Json;
    final ready = ihramChecks.every((k) => checks[k] == true);
    final defs = g['checks'] as Json;
    return Stack14([
      StepHero(session: s, title: context.t('Ihram check'), lead: context.t(g['lead'] as String)),
      AppCard(
        child: Column(children: [
          for (final k in ihramChecks)
            CheckRow(
              label: context.t((defs[k] as Json)['label'] as String),
              help: (defs[k] as Json)['help'] == null ? null : context.t((defs[k] as Json)['help'] as String),
              value: checks[k] == true,
              onChanged: (v) => app.toggleCheck(k, v),
            ),
        ]),
      ),
      _continueBtn(context, s, context.t('Continue'), enabled: ready),
      if (!ready) Muted(context.t('Tick all three to continue.'), small: true, center: true),
      DuaCard(_dua(context, 'intention')),
      DuaCard(_dua(context, 'labbayka-umrah')),
      FoldCard(title: context.t('Optional condition, if you fear being prevented'), child: DuaCard(_dua(context, 'ishtirat'))),
      Align(alignment: AlignmentDirectional.centerStart, child: TextButton(onPressed: () => context.nav.open(AppPage.ihram), child: Text('${context.t('Read the Ihram restrictions')} →'))),
    ]);
  }
}

class _TalbiyahStage extends StatelessWidget {
  const _TalbiyahStage(this.s);
  final Json s;
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final g = app.content.guide('TALBIYAH');
    final recorded = app.clips.hasRecording('talbiyah');
    return Stack14([
      StepHero(session: s, title: context.t('Talbiyah'), lead: context.t(g['lead'] as String)),
      AppCard(
        child: recorded
            ? Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                BigButton(label: app.clips.talbiyahPlaying ? '⏸ ${context.t('Pause')}' : '🎙 ${context.t('Play the Talbiyah')}', onPressed: app.toggleTalbiyah),
                CheckRow(label: context.t('Keep repeating while I use the app'), value: app.clips.talbiyahLoop, onChanged: app.clips.setTalbiyahLoop),
              ])
            : Muted(context.t('No recitation recording for this dua yet.')),
      ),
      DuaCard(_dua(context, 'talbiyah'), audio: false),
      PointsList([...app.tr.tList(g['points'] as List?), ...genderPoints(context, g, s['gender'] as String)]),
      _continueBtn(context, s, context.t('I’ve arrived at Masjid al-Haram')),
    ]);
  }
}

class _EnterHaramStage extends StatelessWidget {
  const _EnterHaramStage(this.s);
  final Json s;
  @override
  Widget build(BuildContext context) {
    final g = context.app.content.guide('ENTER_HARAM');
    return Stack14([
      StepHero(session: s, title: context.t('Makkah — Masjid al-Haram'), lead: context.t(g['lead'] as String)),
      DuaCard(_dua(context, 'enter-mosque')),
      _continueBtn(context, s, context.t('Go to the Tawaf starting point')),
      _more(context, 'more:ENTER_HARAM', context.t('More guidance'), context.app.content.points(g['points'])),
    ]);
  }
}

class _TawafReadyStage extends StatelessWidget {
  const _TawafReadyStage(this.s);
  final Json s;
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final g = app.content.guide('TAWAF_READY');
    final items = (g['ready'] as List).cast<Json>().where((i) => i['men'] != true || s['gender'] == 'male').toList();
    return Stack14([
      StepHero(session: s, title: context.t('Tawaf — starting point'), lead: context.t(g['lead'] as String)),
      TawafRing(startBearing: haramGeo.blackStoneBearingDeg, startLabel: context.t('START'), semanticsLabel: context.t('Tawaf ring. Start at the Black Stone line; walk with the Kaaba on your left.')),
      Center(child: Text.rich(TextSpan(children: [
        TextSpan(text: '🕋 ${context.t('Kaaba on your')} '),
        TextSpan(text: context.t('LEFT'), style: const TextStyle(fontWeight: FontWeight.w800)),
        TextSpan(text: ' · ${context.t('start at the Black Stone line')}'),
      ]), textAlign: TextAlign.center, style: const TextStyle(fontSize: 16.8))),
      Text(context.t('Before you start'), style: const TextStyle(fontSize: 18.4, fontWeight: FontWeight.w800)),
      AppCard(
        child: Column(children: [
          for (final i in items)
            CheckRow(
              label: context.t(i['label'] as String),
              help: i['help'] == null ? null : context.t(i['help'] as String),
              value: app.readyChecks[i['id']] == true,
              onChanged: (v) => app.setReadyCheck(i['id'] as String, v),
            ),
        ]),
      ),
      TrackingToggleCard(session: s),
      BigButton(label: '▶ ${context.t('Start Round 1')}', onPressed: () => app.startTawaf(s['current_stage'] as String)),
      DuaCard(_dua(context, 'black-stone')),
      _more(context, 'more:TAWAF_READY', context.t('More guidance'), app.content.points(g['points'])),
    ]);
  }
}

/// The confirmed rounds/laps as a checked list.
class CountList extends StatelessWidget {
  const CountList({super.key, required this.records, required this.field, required this.noun, this.withDirection = false});
  final List<Json> records;
  final String field;
  final String noun;
  final bool withDirection;

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final locale = app.tr.code;
    return Column(children: [
      for (final r in records)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 3),
          child: Row(children: [
            Expanded(
              child: Text(
                '✓ ${noun == 'Round' ? context.t('Round {n}', {'n': r[field]}) : context.t('Lap {n}', {'n': r[field]})}'
                '${withDirection ? ' · ${placeName(context, r['start_location'] as String)} → ${placeName(context, r['end_location'] as String)}' : ''}',
                style: const TextStyle(fontSize: 15.5),
              ),
            ),
            Muted(r['source'] == 'correction' ? context.t('set by correction') : fmtTime(r['completed_at'] as String?, locale), small: true),
          ]),
        ),
    ]);
  }
}

class _TawafCompleteStage extends StatelessWidget {
  const _TawafCompleteStage(this.s);
  final Json s;
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final tawaf = s['tawaf'] as Json;
    final locale = app.tr.code;
    return Stack14([
      AppCard(
        child: Column(children: [
          const Text('✅', style: TextStyle(fontSize: 44)),
          Eyebrow(context.t('Tawaf')),
          Text(context.t('{done} / {total} complete', {'done': summarize(s).tawafDone, 'total': tawafRounds}), style: const TextStyle(fontSize: 25.6, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          CountList(records: (tawaf['rounds'] as List).cast<Json>(), field: 'round_number', noun: 'Round'),
          const SizedBox(height: 8),
          Muted(context.t('Started {start} · Completed {end}', {'start': fmtTime(tawaf['started_at'] as String?, locale), 'end': fmtTime(tawaf['completed_at'] as String?, locale)}), small: true),
        ]),
      ),
      PointsList(genderPoints(context, app.content.guide('TAWAF_COMPLETE'), s['gender'] as String)),
      Text.rich(TextSpan(children: [TextSpan(text: '${context.t('Next')}: '), TextSpan(text: context.t('Pray two rak’ahs'), style: const TextStyle(fontWeight: FontWeight.w800))]), style: const TextStyle(fontSize: 16.5)),
      _continueBtn(context, s, context.t('Continue')),
      GhostButton(label: context.t('Wrong count?'), onPressed: () => app.openCorrect('tawaf')),
    ]);
  }
}

class _TwoRakahStage extends StatelessWidget {
  const _TwoRakahStage(this.s);
  final Json s;
  @override
  Widget build(BuildContext context) {
    final g = context.app.content.guide('TWO_RAKAH');
    return Stack14([
      StepHero(session: s, title: context.t('Two rak’ahs'), lead: context.t(g['lead'] as String)),
      PointsList(context.app.tr.tList(g['points'] as List?)),
      _continueBtn(context, s, context.t('I’ve prayed — continue')),
      DuaCard(_dua(context, 'maqam')),
      GhostButton(label: context.t('Recount Tawaf'), onPressed: () => context.app.openCorrect('tawaf')),
    ]);
  }
}

class _ZamzamStage extends StatelessWidget {
  const _ZamzamStage(this.s);
  final Json s;
  @override
  Widget build(BuildContext context) {
    final g = context.app.content.guide('ZAMZAM');
    return Stack14([
      StepHero(session: s, title: context.t('Zamzam'), lead: context.t(g['lead'] as String)),
      PointsList(context.app.tr.tList(g['points'] as List?)),
      _continueBtn(context, s, context.t('Continue to Sa’i')),
      DuaCard(_dua(context, 'zamzam')),
    ]);
  }
}

class _SafaStage extends StatelessWidget {
  const _SafaStage(this.s);
  final Json s;
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final g = app.content.guide('SAFA');
    return Stack14([
      StepHero(session: s, title: context.t('Sa’i starts at SAFA'), lead: context.t(g['lead'] as String)),
      DuaCard(_dua(context, 'safa-verse')),
      DuaCard(_dua(context, 'safa-marwah-dhikr')),
      TrackingToggleCard(session: s),
      BigButton(label: '▶ ${context.t('Start Sa’i — Lap 1: Safa → Marwah')}', onPressed: () => app.startSai(s['current_stage'] as String)),
      _more(context, 'more:SAFA', context.t('More guidance'), app.content.points(g['points'])),
    ]);
  }
}

class _SaiCompleteStage extends StatelessWidget {
  const _SaiCompleteStage(this.s);
  final Json s;
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final sai = s['sai'] as Json;
    final locale = app.tr.code;
    return Stack14([
      AppCard(
        child: Column(children: [
          const Text('✅', style: TextStyle(fontSize: 44)),
          Eyebrow(context.t('Sa’i')),
          Text(context.t('{done} / {total} complete', {'done': summarize(s).saiDone, 'total': saiLaps}), style: const TextStyle(fontSize: 25.6, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          CountList(records: (sai['laps'] as List).cast<Json>(), field: 'lap_number', noun: 'Lap', withDirection: true),
          const SizedBox(height: 8),
          Text(context.t('END: MARWAH'), style: const TextStyle(fontWeight: FontWeight.w800)),
          Muted(context.t('Started {start} · Completed {end}', {'start': fmtTime(sai['started_at'] as String?, locale), 'end': fmtTime(sai['completed_at'] as String?, locale)}), small: true),
        ]),
      ),
      Text(context.t(app.content.guide('SAI_COMPLETE')['lead'] as String), style: const TextStyle(fontSize: 16.5)),
      _continueBtn(context, s, context.t('Continue to the final step')),
      GhostButton(label: context.t('Wrong count?'), onPressed: () => app.openCorrect('sai')),
    ]);
  }
}

class _HairStage extends StatefulWidget {
  const _HairStage(this.s);
  final Json s;
  @override
  State<_HairStage> createState() => _HairStageState();
}

class _HairStageState extends State<_HairStage> {
  String? _method;

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final s = widget.s;
    final g = app.content.guide('HAIR');
    final gender = s['gender'] as String;
    final opts = app.content.hairOptions(gender);
    final method = opts.length == 1 ? opts.first['value'] as String : _method;
    return Stack14([
      StepHero(session: s, title: context.t('Hair — final Umrah step'), lead: context.t(g['lead'] as String)),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(gender == 'male' ? context.t('Men') : context.t('Women'), style: TextStyle(color: context.c.muted, fontWeight: FontWeight.w700)),
          RadioGroup<String>(
            groupValue: method,
            onChanged: (v) => setState(() => _method = v),
            child: Column(children: [
              for (final o in opts)
                RadioListTile<String>(
                  contentPadding: EdgeInsets.zero,
                  value: o['value'] as String,
                  title: Text(context.t(o['label'] as String), style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text(context.t(o['note'] as String)),
                ),
            ]),
          ),
          if (gender == 'male') PointsList(app.tr.tList(g['points'] as List?)),
          const SizedBox(height: 10),
          BigButton(label: '✓ ${context.t('Confirm — hair done')}', onPressed: method == null ? null : () => app.confirmHair(method, s['current_stage'] as String)),
        ]),
      ),
      GhostButton(label: context.t('Recount Sa’i'), onPressed: () => app.openCorrect('sai')),
    ]);
  }
}

class _IhramExitStage extends StatelessWidget {
  const _IhramExitStage(this.s);
  final Json s;
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final sum = summarize(s);
    Widget row(String k, Widget v) => Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(children: [Expanded(child: Muted(k)), v]));
    return Stack14([
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Eyebrow(context.t('Umrah status')),
          row(context.t('Ihram restrictions'), Text(context.t('ENDED'), style: const TextStyle(fontWeight: FontWeight.w800))),
          row(context.t('Tawaf'), Text('✓ ${sum.tawafDone}/$tawafRounds')),
          row(context.t('Sa’i'), Text('✓ ${sum.saiDone}/$saiLaps')),
          row(context.t('Hair'), Text('✓ ${(s['hair'] as Json?)?['method'] == 'shave' ? context.t('Shaved') : context.t('Shortened')}')),
        ]),
      ),
      Text(context.t(app.content.guide('IHRAM_EXIT')['lead'] as String), style: const TextStyle(fontSize: 16.5)),
      _continueBtn(context, s, context.t('Finish — mark my Umrah complete')),
    ]);
  }
}

class _CompleteStage extends StatelessWidget {
  const _CompleteStage(this.s);
  final Json s;
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final sum = summarize(s);
    final locale = app.tr.code;
    Widget row(String k, String v) => Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(children: [Expanded(child: Muted(k)), Text(v, style: const TextStyle(fontWeight: FontWeight.w700))]));
    return AppCard(
      borderColor: context.c.gold,
      borderWidth: 2,
      child: Column(children: [
        Directionality(textDirection: TextDirection.rtl, child: Text('الحمد لله', style: TextStyle(fontSize: 44, color: context.c.gold, fontFamilyFallback: const ['Noto Naskh Arabic', 'Noto Sans Arabic', 'Amiri']))),
        Text(context.t('Umrah complete'), style: const TextStyle(fontSize: 25.6, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        row(context.t('Ihram'), '✓'),
        row(context.t('Talbiyah'), '✓'),
        row(context.t('Tawaf'), '${sum.tawafDone} / $tawafRounds ✓'),
        row(context.t('Two rak’ahs'), s['two_rakah_at'] != null ? '✓' : '—'),
        row(context.t('Zamzam'), s['zamzam_at'] != null ? '✓' : '—'),
        row(context.t('Sa’i'), '${sum.saiDone} / $saiLaps ✓'),
        row(context.t('Hair'), '✓'),
        const SizedBox(height: 8),
        Muted('${context.t('Started')}: ${fmtDateTime(s['started_at'] as String?, locale)}\n${context.t('Completed')}: ${fmtDateTime(s['completed_at'] as String?, locale)}', small: true),
        const SizedBox(height: 8),
        Text(context.t('Taqabbal Allāhu minnā wa minkum — may Allah accept it from us and from you.'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, height: 1.45)),
        const SizedBox(height: 12),
        Wrap(spacing: 8, runSpacing: 8, alignment: WrapAlignment.center, children: [
          SoftButton(label: context.t('View journey'), onPressed: () => context.nav.tab(tabJourney)),
          SoftButton(label: context.t('View duas'), onPressed: () => context.nav.tab(tabDuas)),
          SoftButton(label: context.t('Makkah guide'), onPressed: () => context.nav.open(AppPage.guide, 'makkah')),
          SoftButton(label: context.t('Madinah guide'), onPressed: () => context.nav.open(AppPage.guide, 'madinah')),
        ]),
        GhostButton(label: context.t('Start another Umrah'), onPressed: app.endSession),
      ]),
    );
  }
}
