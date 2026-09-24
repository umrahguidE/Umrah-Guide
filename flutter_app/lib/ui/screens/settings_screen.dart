// Settings: language, voice guide (with the "no voice installed" help),
// Qur'an reciter, text size and the counting sensors. Port of settingsPage in
// src/ui/views.js.
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'navigation.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final v = app.voice;
    final lang = app.tr.language;
    final voices = v.listVoices(lang.speech);
    final s = app.session;
    final rec = app.clips.index;
    final files = (rec?['files'] as Map?) ?? const {};
    final reciters = (rec?['reciters'] as Map?)?.cast<String, dynamic>();
    final mobile = defaultTargetPlatform == TargetPlatform.android || defaultTargetPlatform == TargetPlatform.iOS;
    final step = app.prefs.stepLengthM;
    final scale = app.prefs.textScale;
    Widget sensorRow(bool ok, String title, String okText) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(ok ? '✓' : '○', style: TextStyle(fontWeight: FontWeight.w800, color: ok ? context.c.green : context.c.muted, fontSize: 16)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                Muted(ok ? okText : context.t('Not seen yet. It starts when a round or lap does.'), small: true),
              ]),
            ),
          ]),
        );
    return Stack14([
      PageHeading(context.t('Settings')),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SectionTitle('🌐 ${context.t('Language')}'),
          Text(lang.native, style: const TextStyle(fontSize: 16)),
          const SizedBox(height: 8),
          SoftButton(label: context.t('Change language'), onPressed: () => context.nav.open(AppPage.language)),
        ]),
      ),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SectionTitle('🔊 ${context.t('Voice guide')}'),
          Muted(context.t('Speaks every step, round and arrival in your language, using your phone’s voice. Works offline.')),
          const SizedBox(height: 6),
          if (!v.available)
            AlertBox(kind: AlertKind.warn, child: Text(context.t('This device or browser has no speech voice available.')))
          else ...[
            CheckRow(
              label: context.t('Voice guide'),
              help: context.t('The phone voice never reads Arabic — duas are played from real recitations.'),
              value: v.enabled,
              onChanged: (_) => app.toggleVoice(),
            ),
            if (voices.isEmpty)
              AlertBox(
                kind: AlertKind.warn,
                child: Text(mobile
                    ? context.t('Your phone has no {language} voice installed, so this will speak in English instead until you add it. To fix this, go to your phone’s Settings → Language & input → Text-to-speech output → Install voice data, and download {language}.', {'language': lang.native})
                    : context.t('This computer has no {language} voice installed, so this will speak in English instead until you add one. On Windows: Settings → Time & language → Speech → Manage voices → Add voices, then download {language}. On a Mac: System Settings → Accessibility → Spoken Content → System voice → Manage Voices.', {'language': lang.native})),
              )
            else if (voices.length > 1) ...[
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                isExpanded: true,
                initialValue: voices.any((x) => x.name == v.preferredName) ? v.preferredName : '',
                decoration: InputDecoration(labelText: context.t('Voice'), border: const OutlineInputBorder()),
                items: [
                  DropdownMenuItem(value: '', child: Text(context.t('Automatic (recommended)'))),
                  for (final o in voices) DropdownMenuItem(value: o.name, child: Text('${o.name}${o.isDefault ? ' — ${context.t('suggested')}' : ''}', overflow: TextOverflow.ellipsis)),
                ],
                onChanged: (x) => app.selectVoice(x == null || x.isEmpty ? null : x),
              ),
              const SizedBox(height: 6),
              Muted(context.t('Not happy with how it sounds? Your phone may offer several voices for this language — try another one above.'), small: true),
            ] else
              Muted(context.t('Your phone only offers one voice for this language.'), small: true),
            const SizedBox(height: 8),
            SoftButton(label: '▶ ${context.t('Test the voice')}', onPressed: app.testVoice),
          ],
        ]),
      ),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SectionTitle('🎙 ${context.t('Recitations')}'),
          if (rec == null)
            Muted(context.t('No recitations on this device yet. They are included when the app is built.'))
          else ...[
            Text(context.t('{n} recitations are on this device.', {'n': files.length})),
            Text(context.t('Qur’anic verses recited by {name}.', {'name': rec['quranReciter'] ?? rec['reciter']})),
            const SizedBox(height: 4),
            Muted(((rec['sources'] as List?) ?? const []).join(' · '), small: true),
            if (reciters != null && reciters.length > 1) ...[
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                isExpanded: true,
                initialValue: app.prefs.reciter ?? '',
                decoration: InputDecoration(labelText: context.t('Qur’an reciter'), border: const OutlineInputBorder()),
                items: [
                  DropdownMenuItem(value: '', child: Text(context.t('Default ({name})', {'name': rec['quranReciter']}))),
                  for (final e in reciters.entries) DropdownMenuItem(value: e.key, child: Text('${e.value}')),
                ],
                onChanged: (x) => app.setReciter(x == null || x.isEmpty ? null : x),
              ),
              const SizedBox(height: 6),
              Muted(context.t('Applies to the 3 Qur’anic verses (Yemeni Corner, Maqām Ibrāhīm, Safa). The Sunnah duas are a single fixed recording each.'), small: true),
            ],
          ],
        ]),
      ),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SectionTitle('🔠 ${context.t('Text size')}'),
          Wrap(spacing: 8, runSpacing: 8, children: [
            SoftButton(label: context.t('Normal'), primary: scale == 1, onPressed: () => app.setTextScale(1)),
            SoftButton(label: context.t('Large'), primary: scale == 1.15, onPressed: () => app.setTextScale(1.15)),
            SoftButton(label: context.t('Extra large'), primary: scale == 1.3, onPressed: () => app.setTextScale(1.3)),
          ]),
        ]),
      ),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SectionTitle('📡 ${context.t('Counting')}'),
          if (s != null) Text(s['tracking_mode'] == 'assisted' ? context.t('Location help is ON') : context.t('Location help is OFF')),
          sensorRow(app.tracking.compassSeen, context.t('Compass'), context.t('Working — it counts your turning when GPS is weak.')),
          sensorRow(app.tracking.stepsSeen, context.t('Step sensor'), context.t('Working — it carries a Sa’i lap where GPS drops out.')),
          const SizedBox(height: 6),
          Text.rich(TextSpan(children: [
            TextSpan(text: '${context.t('Your step length:')} ', style: const TextStyle(fontWeight: FontWeight.w700)),
            TextSpan(text: step != null ? '${step.toStringAsFixed(2)} m' : context.t('not measured yet')),
          ])),
          if (step != null) ...[const SizedBox(height: 8), SoftButton(label: context.t('Measure it again'), onPressed: app.resetStepLength)],
        ]),
      ),
    ]);
  }
}
