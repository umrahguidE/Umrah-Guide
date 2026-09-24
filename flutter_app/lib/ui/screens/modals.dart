// The two dialogs: "Wrong count?" (pick the round/lap you are really on) and
// the quick-confirm check when a round/lap is confirmed only seconds after it
// started. Port of modal / quickConfirmModal in src/ui/views.js.
import 'package:flutter/material.dart';

import '../../app/app_controller.dart';
import '../../engine/stages.dart';
import '../app_scope.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'guided_screen.dart' show placeName;

/// Drawn over the page (inside the app's own Stack, so it follows the app's
/// state rather than a separate navigator route).
class ModalLayer extends StatelessWidget {
  const ModalLayer({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final m = app.modal;
    if (m == null) return const SizedBox.shrink();
    final Widget body = m.kind == 'quick-confirm' ? _QuickConfirm(m) : _CorrectCount(m.ritual!);
    return Positioned.fill(
      child: Material(
        color: Colors.black54,
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: Semantics(
                  scopesRoute: true,
                  namesRoute: true,
                  explicitChildNodes: true,
                  child: AppCard(padding: const EdgeInsets.all(20), child: body),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CorrectCount extends StatelessWidget {
  const _CorrectCount(this.ritual);
  final String ritual;

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final s = app.session;
    if (s == null) return const SizedBox.shrink();
    final c = context.c;
    final tawaf = ritual == 'tawaf';
    final total = tawaf ? tawafRounds : saiLaps;
    final p = parseStage(s['current_stage'] as String);
    final current = p.kind == ritual ? p.n : null;
    final currentLabel = current != null
        ? '${tawaf ? context.t('Round {n}', {'n': current}) : context.t('Lap {n}', {'n': current})} / $total'
        : (tawaf ? context.t('Tawaf complete') : context.t('Sa’i complete'));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(header: true, child: Text(context.t('Wrong count?'), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800))),
        const SizedBox(height: 10),
        Text.rich(TextSpan(children: [TextSpan(text: '${context.t('Current')}: '), TextSpan(text: currentLabel, style: const TextStyle(fontWeight: FontWeight.w800))]), style: const TextStyle(fontSize: 16)),
        const SizedBox(height: 6),
        Text(tawaf ? context.t('Select the round you are on now:') : context.t('Select the lap you are on now:'), style: const TextStyle(fontSize: 16)),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          alignment: WrapAlignment.center,
          children: [
            for (var n = 1; n <= total; n++)
              SizedBox(
                width: 60,
                height: 60,
                child: OutlinedButton(
                  onPressed: () => app.correct(ritual, n),
                  style: OutlinedButton.styleFrom(
                    padding: EdgeInsets.zero,
                    backgroundColor: n == current ? c.accentSoft : c.surface,
                    side: BorderSide(color: n == current ? c.accent : c.border, width: n == current ? 2 : 1),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Text('$n', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: c.text)),
                    if (!tawaf)
                      Text(
                        '${placeName(context, saiDirection(n).from).characters.first}→${placeName(context, saiDirection(n).to).characters.first}',
                        style: TextStyle(fontSize: 11, color: c.muted),
                      ),
                  ]),
                ),
              ),
          ],
        ),
        if (!tawaf) ...[const SizedBox(height: 8), Muted(context.t('Odd laps go Safa → Marwah; even laps go Marwah → Safa.'), small: true)],
        const SizedBox(height: 12),
        AlertBox(
          kind: AlertKind.info,
          child: Text.rich(TextSpan(children: [
            TextSpan(text: '${context.t('This app’s count is only a record to help you.')} '),
            TextSpan(text: context.t('Your own certain count is what matters.'), style: const TextStyle(fontWeight: FontWeight.w800)),
            TextSpan(text: ' ${context.t(app.content.guidance['DOUBT'] as String)}'),
          ])),
        ),
        const SizedBox(height: 8),
        GhostButton(label: context.t('Cancel'), onPressed: app.closeModal),
      ],
    );
  }
}

class _QuickConfirm extends StatelessWidget {
  const _QuickConfirm(this.m);
  final ModalState m;

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final tawaf = m.field == 'round';
    final n = m.n!;
    final question = tawaf
        ? context.t('Round {n} started only a few seconds ago. Mark it complete anyway?', {'n': n})
        : context.t('Lap {n} started only a few seconds ago. Mark it complete anyway?', {'n': n});
    final confirm = tawaf ? context.t('Confirm Round {n} complete', {'n': n}) : context.t('I have reached {place}', {'place': placeName(context, saiDirection(n).to)});
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(header: true, child: Text(question, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, height: 1.3))),
        const SizedBox(height: 16),
        BigButton(label: '✓ $confirm', onPressed: app.confirmQuick),
        const SizedBox(height: 6),
        GhostButton(label: context.t('Cancel'), onPressed: app.closeModal),
      ],
    );
  }
}
