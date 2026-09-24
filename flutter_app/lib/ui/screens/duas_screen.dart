// The Duas tab: every dua by category, with what fits the current step shown
// first, plus the pilgrim's own list. Port of duasPage / personalDuas in
// src/ui/views.js.
import 'package:flutter/material.dart';

import '../../engine/machine.dart' show Json;
import '../../engine/stages.dart';
import '../app_scope.dart';
import '../widgets/common.dart';
import '../widgets/dua_card.dart';
import 'guided_screen.dart' show stageName;
import 'navigation.dart';

String? duaContext(Json? s) {
  if (s == null || s['status'] != 'active') return null;
  final stage = s['current_stage'] as String;
  final p = parseStage(stage);
  if (p.kind == 'tawaf' || stage == Stage.tawafReady) return 'tawaf';
  if (p.kind == 'sai' || stage == Stage.safa) return 'sai';
  if (const [Stage.twoRakah, Stage.zamzam, Stage.tawafComplete].contains(stage)) return 'after-tawaf';
  if (stage == Stage.enterHaram) return 'haram';
  if (const [Stage.miqat, Stage.ihram, Stage.talbiyah].contains(stage)) return 'ihram';
  return null;
}

class DuasPage extends StatefulWidget {
  const DuasPage({super.key});
  @override
  State<DuasPage> createState() => _DuasPageState();
}

class _DuasPageState extends State<DuasPage> {
  final Map<String, GlobalKey> _sections = {};

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final content = app.content;
    final s = app.session;
    final ctx = duaContext(s);
    int relevant(d) => ctx != null && d.contexts.contains(ctx) ? 1 : 0;
    return Stack14([
      PageHeading(context.t('Duas'), lead: ctx != null ? context.t('What fits your current step is shown first.') : context.t('Arabic, recitation and meaning, with sources.')),
      if (s?['status'] == 'active')
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: SoftButton(label: '← ${context.t('Back to')} ${stageName(context, s!['current_stage'] as String)}', onPressed: () => context.nav.tab(tabUmrah)),
        ),
      AlertBox(kind: AlertKind.info, child: Text(context.t(content.str(ctx == 'sai' ? 'SAI_DUA_NOTE' : 'TAWAF_DUA_NOTE')))),
      Semantics(
        label: context.t('Dua categories'),
        child: Wrap(spacing: 6, runSpacing: 6, children: [
          for (final cat in content.duaCategories)
            Chip2('${cat['icon']} ${context.t(cat['label'] as String)}', onTap: () {
              final key = _sections[cat['id']];
              if (key?.currentContext != null) Scrollable.ensureVisible(key!.currentContext!, duration: const Duration(milliseconds: 300));
            }),
        ]),
      ),
      for (final cat in content.duaCategories)
        Builder(builder: (context) {
          final id = cat['id'] as String;
          final key = _sections.putIfAbsent(id, GlobalKey.new);
          final heading = Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SectionTitle('${cat['icon']} ${context.t(cat['label'] as String)}'),
            Muted(context.t(cat['intro'] as String)),
          ]);
          if (id == 'personal') return KeyedSubtree(key: key, child: Stack14([heading, const _PersonalDuas()]));
          final items = content.duas.where((d) => d.category == id).toList()..sort((a, b) => relevant(b) - relevant(a));
          return KeyedSubtree(
            key: key,
            child: Stack14([
              heading,
              Align(alignment: AlignmentDirectional.centerStart, child: PlayAllButton(ids: items.map((d) => d.id).toList(), label: context.t(cat['label'] as String))),
              for (final d in items) DuaCard(d, highlight: relevant(d) == 1),
            ]),
          );
        }),
    ]);
  }
}

class _PersonalDuas extends StatefulWidget {
  const _PersonalDuas();
  @override
  State<_PersonalDuas> createState() => _PersonalDuasState();
}

class _PersonalDuasState extends State<_PersonalDuas> {
  final TextEditingController _text = TextEditingController();

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  void _add() {
    context.app.addPersonalDua(_text.text);
    _text.clear();
  }

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    return Stack14([
      for (final d in app.prefs.personalDuas)
        AppCard(
          padding: const EdgeInsets.fromLTRB(16, 8, 4, 8),
          child: Row(children: [
            Expanded(child: Text(d['text'] ?? '', style: const TextStyle(fontSize: 16))),
            IconButton(tooltip: context.t('Remove'), onPressed: () => app.removePersonalDua(d['id']!), icon: const Icon(Icons.close)),
          ]),
        ),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          TextField(
            controller: _text,
            minLines: 2,
            maxLines: 4,
            maxLength: 500,
            decoration: InputDecoration(labelText: context.t('Add a dua or a name to pray for'), border: const OutlineInputBorder()),
          ),
          const SizedBox(height: 8),
          Align(alignment: AlignmentDirectional.centerStart, child: SoftButton(label: context.t('Add'), onPressed: _add)),
        ]),
      ),
    ]);
  }
}
