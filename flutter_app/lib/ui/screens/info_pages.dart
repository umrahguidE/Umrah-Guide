// The smaller reading pages: language picker, preparation checklist, Ihram,
// Miqat guide, Makkah/Madinah guides, About and the More tab. Ports of the
// matching pages in src/ui/views.js.
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../app_scope.dart';
import '../widgets/common.dart';
import '../widgets/dua_card.dart';
import '../widgets/miqat_panel.dart';
import 'journey_screen.dart' show confirmEndSession;
import 'navigation.dart';

/// The published privacy policy (served by GitHub Pages from privacy.html).
const String privacyPolicyUrl = 'https://umrahguide.github.io/Umrah-Guide/privacy.html';

class LanguagePage extends StatelessWidget {
  const LanguagePage({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final nav = context.nav;
    return Stack14([
      const Center(child: Text('🌐', style: TextStyle(fontSize: 48))),
      const Text('Choose your language', textAlign: TextAlign.center, style: TextStyle(fontSize: 25.6, fontWeight: FontWeight.w800)),
      const Muted('भाषा चुनें · மொழியைத் தேர்ந்தெடுக்கவும் · ഭാഷ തിരഞ്ഞെടുക്കുക', center: true),
      for (final l in app.content.languages)
        SizedBox(
          height: 64,
          child: SoftButton(
            label: '${l.native}   ·   ${l.name}',
            primary: app.hasLanguage && l.code == app.tr.code,
            onPressed: () async {
              final first = !app.hasLanguage;
              await app.setLanguage(l.code);
              if (!first) nav.back();
            },
          ),
        ),
    ]);
  }
}

class PrepPage extends StatelessWidget {
  const PrepPage({super.key});

  static const Map<String, AppPage> _links = {'#/ihram': AppPage.ihram, '#/miqat': AppPage.miqat, '#/info': AppPage.info};

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final items = app.content.prepChecklist;
    final done = items.where((i) => app.prefs.checklist[i['id']] == true).length;
    return Stack14([
      PageHeading(context.t('Umrah preparation'), lead: context.t('{done} / {total} ready', {'done': done, 'total': items.length})),
      AppCard(
        child: Column(children: [
          for (final i in items)
            Row(children: [
              Expanded(child: CheckRow(label: context.t(i['label'] as String), value: app.prefs.checklist[i['id']] == true, onChanged: (v) => app.togglePrep(i['id'] as String, v))),
              if (_links[i['link']] != null) TextButton(onPressed: () => context.nav.open(_links[i['link']]!), child: Text('${context.t('Open')} →')),
            ]),
        ]),
      ),
      BigButton(label: '${context.t('Next: Understand Ihram')} →', onPressed: () => context.nav.open(AppPage.ihram)),
    ]);
  }
}

class IhramPage extends StatelessWidget {
  const IhramPage({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    return Stack14([
      PageHeading(context.t('Understand Ihram'), lead: context.t('What it is, how to enter it, what to wear, and what becomes forbidden.')),
      Row(children: [ReviewDot(reviewed: app.content.reviewed), Muted(app.content.reviewed ? context.t('Scholar-reviewed') : context.t('Pending scholar review'), small: true)]),
      for (final sec in app.content.ihramGuide)
        AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [SectionTitle(context.t(sec['title'] as String)), PointsList(app.tr.tList(sec['points'] as List?))])),
      DuaCard(app.content.dua('intention')),
      DuaCard(app.content.dua('talbiyah')),
    ]);
  }
}

class MiqatPage extends StatelessWidget {
  const MiqatPage({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final g = app.content.guide('MIQAT');
    final s = app.session;
    return Stack14([
      PageHeading(context.t('Miqat guide'), lead: context.t(g['lead'] as String)),
      MiqatPanel(routeId: (s?['miqat'] as Map?)?['route_id'] as String? ?? app.prefs.miqatRoute),
      PointsList(app.tr.tList(g['points'] as List?)),
      AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [SectionTitle(context.t('The five Miqats')), for (final m in app.content.miqatJson) MiqatLine(m)])),
    ]);
  }
}

class GuidePage extends StatelessWidget {
  const GuidePage({super.key, required this.id});
  final String? id;

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final g = app.content.guides[id] as Map?;
    if (g == null) return Stack14([PageHeading(context.t('Guide not found')), GhostButton(label: context.t('Back'), onPressed: context.nav.back)]);
    return Stack14([
      PageHeading(context.t(g['title'] as String)),
      AppCard(child: PointsList(app.tr.tList(g['points'] as List?))),
      AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [SectionTitle(context.t('Coming later')), PointsList(app.tr.tList(g['planned'] as List?))])),
    ]);
  }
}

class AboutPage extends StatelessWidget {
  const AboutPage({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final meta = app.content.meta;
    Widget card(String title, List<Widget> body) => AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [SectionTitle(title), ...body]));
    Text p(String s) => Text(s, style: const TextStyle(fontSize: 16, height: 1.45));
    return Stack14([
      PageHeading(context.t('About this guide')),
      card(context.t('Content review status'), [
        Row(children: [
          ReviewDot(reviewed: app.content.reviewed),
          Expanded(child: Text('${app.content.reviewed ? context.t('Scholar-reviewed') : context.t('Pending scholar review')} · ${context.t('Version')} ${meta['version']}')),
        ]),
        const SizedBox(height: 6),
        p(context.t(meta['note'] as String)),
      ]),
      card(context.t('Your count is what counts'), [p(context.t('The app keeps a record of your rounds and laps to help you. It is never an authority over your own count. If the app and your memory disagree, go with what you are certain of and correct the app.'))]),
      card(context.t('Location help'), [p(context.t('Location can only suggest that a round or lap may be finished — it never marks one complete. The Kaaba, the start line, Maqām Ibrāhīm, Safa and Marwah are placed from OpenStreetMap survey data; the green-marker section of the Mas’a is approximate.'))]),
      card(context.t('Recitations'), [p(context.t('Arabic is only ever played from real recitations: the Qur’anic verses from everyayah.com and the duas of the Sunnah from the Ḥiṣn al-Muslim recordings at hisnmuslim.com. The phone voice never reads Arabic.'))]),
      card(context.t('Privacy'), [
        p(context.t('Your progress, notes and personal information stay on this device and are never sent anywhere. One exception: when you turn on location while far from Masjid al-Haram, the app shows a real online map, and loading it contacts OpenStreetMap and jsDelivr, which can see your IP address and roughly which area you are viewing.')),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: TextButton(onPressed: () => launchUrl(Uri.parse(privacyPolicyUrl), mode: LaunchMode.externalApplication), child: Text(context.t('Privacy policy'))),
        ),
      ]),
      Center(child: Muted(context.t('Designed and developed by Mhd Wasim'), small: true)),
    ]);
  }
}

class MorePage extends StatelessWidget {
  const MorePage({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final nav = context.nav;
    final s = app.session;
    return Stack14([
      PageHeading(context.t('More')),
      TileGrid([
        TileButton(icon: '🌐', title: context.t('Language'), subtitle: app.tr.language.native, onTap: () => nav.open(AppPage.language)),
        TileButton(icon: '⚙️', title: context.t('Settings & voice'), onTap: () => nav.open(AppPage.settings)),
        TileButton(icon: '🆘', title: context.t('My info & emergency'), onTap: () => nav.open(AppPage.info)),
        TileButton(icon: '🧳', title: context.t('Preparation'), onTap: () => nav.open(AppPage.prep)),
        TileButton(icon: '🤍', title: context.t('Understand Ihram'), onTap: () => nav.open(AppPage.ihram)),
        TileButton(icon: '📍', title: context.t('Miqat guide'), onTap: () => nav.open(AppPage.miqat)),
        TileButton(icon: '🕋', title: context.t('Makkah guide'), onTap: () => nav.open(AppPage.guide, 'makkah')),
        TileButton(icon: '🕌', title: context.t('Madinah guide'), onTap: () => nav.open(AppPage.guide, 'madinah')),
        TileButton(icon: 'ℹ️', title: context.t('About & content review'), onTap: () => nav.open(AppPage.about)),
      ]),
      if (s?['status'] == 'active') SoftButton(label: context.t('End current Umrah session'), danger: true, onPressed: () => confirmEndSession(context)),
    ]);
  }
}
