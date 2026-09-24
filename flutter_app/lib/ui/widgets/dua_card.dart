// A dua: Arabic, real recitation, transliteration, meaning and source. Port of
// duaCard / listenButton / playerControls in src/ui/components.js. Arabic is
// only ever played from a real recording, never the phone voice.
import 'package:flutter/material.dart';

import '../../app/content.dart';
import '../../services/clips.dart';
import '../app_scope.dart';
import '../format.dart';
import '../theme.dart';
import 'common.dart';

class DuaCard extends StatelessWidget {
  const DuaCard(this.dua, {super.key, this.highlight = false, this.audio = true});
  final Dua? dua;
  final bool highlight;

  /// False on the Talbiyah screen, which has its own player.
  final bool audio;

  @override
  Widget build(BuildContext context) {
    final d = dua;
    if (d == null) return const SizedBox.shrink();
    final app = context.app;
    final c = context.c;
    final rec = audio ? app.clips.entry(d.id) : null;
    final basis = d.basis == null ? null : app.content.basisLabel[d.basis] as String?;
    return AppCard(
      borderColor: highlight ? c.gold : c.border,
      borderWidth: highlight ? 2 : 1,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: Text(context.t(d.title), style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800, height: 1.25))),
              if (basis != null)
                Container(
                  margin: const EdgeInsetsDirectional.only(start: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: c.accentSoft, borderRadius: BorderRadius.circular(999)),
                  child: Text(context.t(basis), style: TextStyle(color: c.accent, fontSize: 11.5, fontWeight: FontWeight.w700)),
                ),
            ],
          ),
          if (d.when != null) ...[const SizedBox(height: 4), Muted(context.t(d.when!))],
          if (d.arabic != null) ...[
            const SizedBox(height: 10),
            Directionality(
              textDirection: TextDirection.rtl,
              child: SizedBox(
                width: double.infinity,
                child: Text(d.arabic!, textAlign: TextAlign.right, style: const TextStyle(fontSize: 26, height: 1.9, fontFamilyFallback: ['Noto Naskh Arabic', 'Noto Sans Arabic', 'Amiri'])),
              ),
            ),
          ],
          if (audio && app.clips.hasRecording(d.id)) ...[const SizedBox(height: 8), ListenBlock(d.id)],
          if (audio && rec != null) ...[
            const SizedBox(height: 4),
            Text(
              [
                rec['kind'] == 'quran' ? context.t('Recited by {name}', {'name': rec['reciter']}) : context.t(rec['reciter'] as String),
                rec['label'],
              ].join(' · '),
              style: TextStyle(color: c.muted, fontSize: 13.5),
            ),
            if (rec['narration'] != null) Muted(context.t('This recording reads the whole hadith, including the words of the dua.'), small: true),
          ] else if (audio && d.arabic != null)
            Muted(context.t('No recitation recording for this dua yet.'), small: true),
          if (d.transliteration != null) ...[
            const SizedBox(height: 10),
            Text(d.transliteration!, style: TextStyle(fontStyle: FontStyle.italic, color: c.muted, fontSize: 15.5, height: 1.5)),
          ],
          if (d.translation != null) ...[const SizedBox(height: 8), Text(context.t(d.translation!), style: const TextStyle(fontSize: 16, height: 1.5))],
          if (d.note != null) ...[const SizedBox(height: 8), AlertBox(kind: AlertKind.info, child: Text(context.t(d.note!)))],
          const SizedBox(height: 10),
          Row(
            children: [
              if (d.source != null) Expanded(child: Text('${context.t('Source')}: ${d.source}', style: TextStyle(color: c.muted, fontSize: 12.8))),
              ReviewDot(reviewed: d.reviewed),
            ],
          ),
        ],
      ),
    );
  }
}

/// A small, quiet marker rather than a loud repeated pill — the review status
/// still tracks accurately (see docs/CONTENT_REVIEW.md), it just doesn't shout.
class ReviewDot extends StatelessWidget {
  const ReviewDot({super.key, required this.reviewed});
  final bool reviewed;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final label = reviewed ? context.t('Scholar-reviewed') : context.t('Pending scholar review');
    return Semantics(
      label: label,
      child: Tooltip(
        message: label,
        child: Padding(
          padding: const EdgeInsets.all(4),
          child: Text(reviewed ? '✓' : '●', style: TextStyle(color: reviewed ? c.green : c.warnLine, fontSize: 13, fontWeight: FontWeight.w800)),
        ),
      ),
    );
  }
}

/// "Listen to the recitation" plus, while it plays, a seek bar, time and speed.
class ListenBlock extends StatelessWidget {
  const ListenBlock(this.id, {super.key, this.big = false});
  final String id;
  final bool big;

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final c = context.c;
    if (!app.clips.hasRecording(id)) return const SizedBox.shrink();
    final playing = app.clips.playingId == id;
    final clips = app.clips;
    final maxMs = clips.duration.inMilliseconds.toDouble();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SoftButton(
          label: playing ? '⏹ ${context.t('Stop')}' : '🎙 ${context.t('Listen to the recitation')}',
          primary: big || playing,
          small: !big,
          onPressed: () => app.playDua(id),
        ),
        if (playing) ...[
          Slider(
            value: maxMs <= 0 ? 0 : clips.position.inMilliseconds.clamp(0, maxMs.toInt()).toDouble(),
            max: maxMs <= 0 ? 1 : maxMs,
            onChanged: (v) => clips.seek(Duration(milliseconds: v.round())),
            semanticFormatterCallback: (_) => context.t('Seek'),
          ),
          Row(
            children: [
              Text('${fmtClock(clips.position)} / ${fmtClock(clips.duration)}', style: TextStyle(color: c.muted, fontSize: 13)),
              const Spacer(),
              SoftButton(
                label: '${clips.rate}×',
                small: true,
                onPressed: () => clips.setRate(playbackRates[(playbackRates.indexOf(clips.rate) + 1) % playbackRates.length]),
              ),
            ],
          ),
          if (clips.queue != null && clips.queue!.length > 1)
            Muted('▶ ${context.t('Playing {current} of {total}', {'current': clips.queueIndex + 1, 'total': clips.queue!.length})}', small: true),
        ],
      ],
    );
  }
}

/// "▶ Play all N recitations" for a section.
class PlayAllButton extends StatelessWidget {
  const PlayAllButton({super.key, required this.ids, required this.label});
  final List<String> ids;
  final String label;

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final playable = ids.where(app.clips.hasRecording).toList();
    if (playable.length < 2) return const SizedBox.shrink();
    final active = app.clips.queue != null && app.clips.playingId != null && playable.contains(app.clips.playingId);
    return SoftButton(
      label: active ? '⏹ ${context.t('Stop')}' : '▶ ${context.t('Play all {n} recitations', {'n': playable.length})} — $label',
      primary: active,
      onPressed: () => app.playAllDuas(playable),
    );
  }
}
