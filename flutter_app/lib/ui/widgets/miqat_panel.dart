// Route picker, the Miqat(s) for that route, and the "watch for my Miqat"
// alert. Port of miqatPanel / miqatWatchControls / miqatReadingView in
// src/ui/views.js.
import 'package:flutter/material.dart';

import '../../app/app_controller.dart';
import '../../engine/machine.dart' show Json;
import '../../engine/miqat.dart';
import '../app_scope.dart';
import 'common.dart';
import 'dua_card.dart';

/// One Miqat line: name, modern place, who it is for and the distance.
class MiqatLine extends StatelessWidget {
  const MiqatLine(this.miqat, {super.key});
  final Json miqat;

  @override
  Widget build(BuildContext context) {
    final km = miqatRadiusKm(MiqatPoint.fromJson(miqat)).round();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text.rich(TextSpan(children: [
            TextSpan(text: miqat['name'] as String, style: const TextStyle(fontWeight: FontWeight.w800)),
            TextSpan(text: ' — ${miqat['modern']}', style: TextStyle(color: Theme.of(context).hintColor)),
          ])),
          Muted('${context.t(miqat['forWho'] as String)} ${context.t('About {km} km from Makkah in a straight line.', {'km': km})}', small: true),
        ],
      ),
    );
  }
}

class MiqatPanel extends StatelessWidget {
  const MiqatPanel({super.key, required this.routeId});
  final String? routeId;

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final content = app.content;
    final route = content.routeById(routeId);
    final miqats = route == null ? <Json>[] : content.miqatJson.where((m) => route.miqats.contains(m['id'])).toList();
    final items = <DropdownMenuItem<String>>[];
    for (final g in content.routeGroups) {
      items.add(DropdownMenuItem<String>(enabled: false, value: '__group_${g['id']}', child: Text(context.t(g['label'] as String), style: const TextStyle(fontWeight: FontWeight.w800))));
      for (final r in content.routes.where((r) => r.group == g['id'])) {
        items.add(DropdownMenuItem<String>(value: r.id, child: Padding(padding: const EdgeInsetsDirectional.only(start: 12), child: Text(context.t(r.label), overflow: TextOverflow.ellipsis))));
      }
    }
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(context.t('Where are you travelling from?'), style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            isExpanded: true,
            initialValue: route?.id,
            hint: Text(context.t('Choose your route…')),
            decoration: const InputDecoration(border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10)),
            items: items,
            onChanged: (v) => app.setMiqatRoute(v),
          ),
          const SizedBox(height: 10),
          if (route != null) ...[
            Text(context.t(route.note), style: const TextStyle(fontSize: 16.5, height: 1.45)),
            for (final m in miqats) MiqatLine(m),
            PointsList(context.app.tr.tList(route.extra)),
            const SizedBox(height: 8),
            FoldCard(title: context.t('What to do, step by step'), child: PointsList(app.tr.tList(content.routeSteps[route.mode] as List?))),
            if (route.miqats.isNotEmpty) ...[const SizedBox(height: 10), const MiqatWatchControls()],
          ] else
            Muted(context.t('Flights are listed by country, roads and the train by where you set out from.')),
          const SizedBox(height: 8),
          Row(children: [ReviewDot(reviewed: content.reviewed)]),
        ],
      ),
    );
  }
}

class MiqatWatchControls extends StatelessWidget {
  const MiqatWatchControls({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final on = app.miqatWatching;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(spacing: 8, runSpacing: 8, children: [
          SoftButton(label: on ? '⏹ ${context.t('Stop watching')}' : '🔔 ${context.t('Watch for my Miqat')}', primary: on, onPressed: app.toggleMiqatWatch),
          SoftButton(label: '📍 ${context.t('Check once')}', onPressed: app.locateForMiqat),
        ]),
        if (on) ...[const SizedBox(height: 8), Muted(context.t('Watching. Keep the app open or in the background — it will vibrate, speak and warn you as the Miqat line approaches.'), small: true)],
        MiqatReadingView(app.miqatReading),
      ],
    );
  }
}

class MiqatReadingView extends StatelessWidget {
  const MiqatReadingView(this.view, {super.key});
  final MiqatView? view;

  @override
  Widget build(BuildContext context) {
    final r = view;
    if (r == null) return const SizedBox.shrink();
    Widget wrap(Widget w) => Padding(padding: const EdgeInsets.only(top: 8), child: w);
    if (r.busy) return wrap(Muted(context.t('Finding your location…')));
    if (r.error != null) return wrap(AlertBox(kind: AlertKind.warn, child: Text(context.t(r.error!))));
    final s = r.status;
    if (s == null) return const SizedBox.shrink();
    final label = switch (s.status) {
      'far' => 'Not near the Miqat yet',
      'approaching' => 'Approaching the Miqat — get ready now',
      _ => 'You have reached or passed the Miqat boundary',
    };
    final km = s.first.kmToBoundary.round();
    return wrap(AlertBox(
      kind: s.status == 'far' ? AlertKind.info : AlertKind.warn,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(context.t(label), style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(km > 0
              ? context.t('First Miqat line on your route: {name} — about {km} km to go.', {'name': s.first.name, 'km': km})
              : context.t('First Miqat line on your route: {name} — crossed.', {'name': s.first.name})),
          const SizedBox(height: 4),
          Text(context.t('Approximate. The crew announcement or your group leader takes priority.'), style: const TextStyle(fontSize: 13.5)),
        ],
      ),
    ));
  }
}
