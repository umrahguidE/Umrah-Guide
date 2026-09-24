// The Journey tab: summary, rounds, laps, corrections and the full timeline of
// the current or a past Umrah, with export. Port of journeyPage in
// src/ui/views.js.
import 'package:flutter/material.dart';

import '../../engine/machine.dart' show Json, EV, summarize;
import '../../engine/stages.dart';
import '../app_scope.dart';
import '../format.dart';
import '../widgets/common.dart';
import '../widgets/tracking_widgets.dart' show confidenceLabel;
import 'guided_screen.dart' show placeName, stageName;
import 'navigation.dart';

String _logLabel(BuildContext context, Json e) {
  String conf() {
    final c = e['confidence'] as String?;
    return c != null && c != 'manual' ? ' (${context.t(confidenceLabel[c] ?? c)})' : '';
  }

  return switch (e['type']) {
    EV.start => e['gender'] == 'male' ? context.t('Umrah started (guidance for a man)') : context.t('Umrah started (guidance for a woman)'),
    EV.next => '→ ${stageName(context, e['stage'] as String)}',
    EV.toggleCheck => context.t('Ihram check updated'),
    EV.startTawaf => context.t('Tawaf started'),
    EV.confirmTawafRound => context.t('Tawaf round {n} confirmed', {'n': e['round'] ?? ''}) + conf(),
    EV.correctTawafRound => context.t('Tawaf count corrected → now on round {n}', {'n': e['round']}),
    EV.startSai => context.t('Sa’i started at Safa'),
    EV.confirmSaiLap => context.t('Sa’i lap {n} confirmed', {'n': e['lap'] ?? ''}) + conf(),
    EV.correctSaiLap => context.t('Sa’i count corrected → now on lap {n}', {'n': e['lap']}),
    EV.pause => context.t('Paused'),
    EV.resume => context.t('Resumed'),
    EV.setTrackingMode => e['mode'] == 'assisted' ? context.t('Location help is ON') : context.t('Location help is OFF'),
    EV.confirmHair => e['method'] == 'shave' ? context.t('Hair: shaved') : context.t('Hair: shortened'),
    EV.setMiqat => context.t('Miqat route chosen'),
    EV.reset => context.t('Session ended'),
    _ => '${e['type']}',
  };
}

class JourneyPage extends StatefulWidget {
  const JourneyPage({super.key});
  @override
  State<JourneyPage> createState() => _JourneyPageState();
}

class _JourneyPageState extends State<JourneyPage> {
  String? _selected;

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final locale = app.tr.code;
    final sessions = <Json>[?app.session, ...app.archive.reversed];
    if (sessions.isEmpty) {
      return Stack14([PageHeading(context.t('My journey')), Text(context.t('No journey yet. Start your Umrah from the Umrah tab.'), style: const TextStyle(fontSize: 16))]);
    }
    final s = sessions.firstWhere((x) => x['id'] == _selected, orElse: () => sessions.first);
    final sum = summarize(s);
    final status = switch (s['status']) {
      'active' => 'In progress',
      'complete' => 'Complete',
      _ => 'Ended early',
    };
    Widget row(String k, String v) => Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(child: Muted(k)), Flexible(child: Text(v, textAlign: TextAlign.end, style: const TextStyle(fontWeight: FontWeight.w700)))]));
    final corrections = ((s['corrections'] as List?) ?? const []).cast<Json>();
    final log = ((s['log'] as List?) ?? const []).cast<Json>();
    return Stack14([
      PageHeading(context.t('My journey'), lead: '${fmtDateTime(s['started_at'] as String?, locale)} · ${context.t(status)}'),
      if (sessions.length > 1)
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final x in sessions) Chip2(fmtDateTime(x['started_at'] as String?, locale), on: x['id'] == s['id'], onTap: () => setState(() => _selected = x['id'] as String)),
        ]),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SectionTitle(context.t('Summary')),
          row(context.t('Current / last step'), stageName(context, s['current_stage'] as String)),
          row(context.t('Tawaf'), '${sum.tawafDone} / $tawafRounds'),
          row(context.t('Sa’i'), '${sum.saiDone} / $saiLaps'),
          row(context.t('Started'), fmtDateTime(s['started_at'] as String?, locale)),
          row(context.t('Completed'), fmtDateTime(s['completed_at'] as String?, locale)),
          const SizedBox(height: 6),
          Muted(context.t('Times are an app record only — they are not a religious requirement.'), small: true),
        ]),
      ),
      if (s['tawaf'] != null)
        AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [SectionTitle(context.t('Tawaf rounds')), _RoundTable(records: ((s['tawaf'] as Json)['rounds'] as List).cast<Json>(), field: 'round_number', noun: 'Round')])),
      if (s['sai'] != null)
        AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [SectionTitle(context.t('Sa’i laps')), _RoundTable(records: ((s['sai'] as Json)['laps'] as List).cast<Json>(), field: 'lap_number', noun: 'Lap', withDirection: true)])),
      if (corrections.isNotEmpty)
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SectionTitle(context.t('Count corrections')),
            PointsList([
              for (final c in corrections)
                '${fmtTime(c['at'] as String?, locale)} — ${c['kind'] == 'tawaf' ? context.t('Tawaf') : context.t('Sa’i')}: ${c['from'] == 'complete' ? context.t('complete') : '#${c['from']}'} → #${c['to']}',
            ]),
          ]),
        ),
      FoldCard(
        title: context.t('Timeline'),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          for (final e in log)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SizedBox(width: 78, child: Muted(fmtTime(e['at'] as String?, locale), small: true)),
                Expanded(child: Text(_logLabel(context, e), style: const TextStyle(fontSize: 15))),
              ]),
            ),
        ]),
      ),
      Wrap(spacing: 8, runSpacing: 8, children: [
        SoftButton(label: '⬇ ${context.t('Export journey (JSON)')}', onPressed: () => app.exportJourney(s['id'] as String)),
        if (s['status'] == 'active') SoftButton(label: context.t('End this session'), danger: true, onPressed: () => confirmEndSession(context)),
      ]),
    ]);
  }
}

/// Asks before ending the active Umrah (it moves to the journey archive).
Future<void> confirmEndSession(BuildContext context) async {
  final app = context.app;
  final nav = context.nav;
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      content: Text(app.t('End this Umrah session? It will be kept in your journey history.')),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(app.t('Cancel'))),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(app.t('End this session'))),
      ],
    ),
  );
  if (ok == true && app.endSession()) nav.tab(tabUmrah);
}

class _RoundTable extends StatelessWidget {
  const _RoundTable({required this.records, required this.field, required this.noun, this.withDirection = false});
  final List<Json> records;
  final String field;
  final String noun;
  final bool withDirection;

  @override
  Widget build(BuildContext context) {
    if (records.isEmpty) return Muted(context.t('None confirmed yet.'));
    final locale = context.app.tr.code;
    String by(Json r) => r['source'] == 'correction'
        ? context.t('Correction')
        : r['tracking_confidence'] == 'manual'
            ? context.t('Manual')
            : context.t('Location ({level})', {'level': context.t(r['tracking_confidence'] as String? ?? '')});
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        columnSpacing: 18,
        horizontalMargin: 4,
        headingRowHeight: 36,
        dataRowMinHeight: 36,
        dataRowMaxHeight: 44,
        columns: [
          DataColumn(label: Text(context.t(noun))),
          if (withDirection) DataColumn(label: Text(context.t('Direction'))),
          DataColumn(label: Text(context.t('Started'))),
          DataColumn(label: Text(context.t('Completed'))),
          DataColumn(label: Text(context.t('Recorded by'))),
        ],
        rows: [
          for (final r in records)
            DataRow(cells: [
              DataCell(Text('✓ ${r[field]}')),
              if (withDirection) DataCell(Text('${placeName(context, r['start_location'] as String)} → ${placeName(context, r['end_location'] as String)}')),
              DataCell(Text(fmtTime(r['started_at'] as String?, locale))),
              DataCell(Text(fmtTime(r['completed_at'] as String?, locale))),
              DataCell(Text(by(r))),
            ]),
        ],
      ),
    );
  }
}
