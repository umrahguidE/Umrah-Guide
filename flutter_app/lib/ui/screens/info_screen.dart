// My info & emergency: hotel, group and emergency contacts saved only on this
// device, plus Saudi emergency numbers. Port of infoPage in src/ui/views.js.
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../app_scope.dart';
import '../widgets/common.dart';

const List<String> _fields = ['hotelName', 'hotelAddress', 'hotelPhone', 'groupName', 'leaderName', 'leaderPhone', 'emergencyName', 'emergencyPhone', 'medical'];

Future<void> _call(String number) => launchUrl(Uri(scheme: 'tel', path: number.replaceAll(RegExp(r'[^\d+]'), '')));

class InfoPage extends StatefulWidget {
  const InfoPage({super.key});
  @override
  State<InfoPage> createState() => _InfoPageState();
}

class _InfoPageState extends State<InfoPage> {
  final Map<String, TextEditingController> _c = {};

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_c.isEmpty) {
      final info = context.app.prefs.info;
      for (final f in _fields) {
        _c[f] = TextEditingController(text: (info[f] ?? '').toString());
      }
    }
  }

  @override
  void dispose() {
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  Widget _field(String name, String label, {bool multiline = false, bool phone = false}) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextField(
          controller: _c[name],
          minLines: multiline ? 2 : 1,
          maxLines: multiline ? 4 : 1,
          keyboardType: phone ? TextInputType.phone : (multiline ? TextInputType.multiline : TextInputType.text),
          autocorrect: false,
          decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final i = app.prefs.info;
    final lat = (i['hotelLat'] as num?)?.toDouble();
    final lng = (i['hotelLng'] as num?)?.toDouble();
    final leaderPhone = (i['leaderPhone'] ?? '').toString();
    final emergencyPhone = (i['emergencyPhone'] ?? '').toString();
    return Stack14([
      PageHeading(context.t('My info & emergency'), lead: context.t('Saved only on this device, available offline.')),
      if (app.error != null) AlertBox(kind: AlertKind.error, child: Text(app.error!)),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          SectionTitle('🏨 ${context.t('Hotel')}'),
          _field('hotelName', context.t('Hotel name')),
          _field('hotelAddress', context.t('Address / directions'), multiline: true),
          _field('hotelPhone', context.t('Hotel phone'), phone: true),
          if (lat != null && lng != null) ...[
            Text('📍 ${context.t('Saved location')}: ${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}'),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton(
                onPressed: () => launchUrl(Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lng'), mode: LaunchMode.externalApplication),
                child: Text('${context.t('Open in maps')} (${context.t('needs internet')})'),
              ),
            ),
          ],
          Align(alignment: AlignmentDirectional.centerStart, child: SoftButton(label: '📍 ${context.t('Save my current location as the hotel')}', onPressed: app.saveHotelHere)),
          const SizedBox(height: 16),
          SectionTitle('👥 ${context.t('Group')}'),
          _field('groupName', context.t('Group / agency name')),
          _field('leaderName', context.t('Group leader')),
          _field('leaderPhone', context.t('Leader’s phone'), phone: true),
          const SizedBox(height: 4),
          SectionTitle('🆘 ${context.t('Emergency')}'),
          _field('emergencyName', context.t('Emergency contact')),
          _field('emergencyPhone', context.t('Emergency contact phone'), phone: true),
          _field('medical', context.t('Medical notes (conditions, medication, allergies, blood type)'), multiline: true),
          BigButton(
            label: context.t('Save on this device'),
            onPressed: () {
              FocusScope.of(context).unfocus();
              app.saveInfo({for (final f in _fields) f: _c[f]!.text});
            },
          ),
        ]),
      ),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SectionTitle(context.t('Emergency numbers (Saudi Arabia)')),
          for (final e in app.content.emergencyNumbers) _CallRow(label: '📞 ${e['number']}', text: context.t(e['label'] as String), number: e['number'] as String),
          if (leaderPhone.isNotEmpty) _CallRow(label: '📞 ${context.t('Leader')}', text: (i['leaderName'] ?? '').toString().isNotEmpty ? '${i['leaderName']}' : context.t('Group leader'), number: leaderPhone),
          if (emergencyPhone.isNotEmpty) _CallRow(label: '📞 ${context.t('Contact')}', text: (i['emergencyName'] ?? '').toString().isNotEmpty ? '${i['emergencyName']}' : context.t('Emergency contact'), number: emergencyPhone),
        ]),
      ),
    ]);
  }
}

class _CallRow extends StatelessWidget {
  const _CallRow({required this.label, required this.text, required this.number});
  final String label;
  final String text;
  final String number;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(children: [
          SoftButton(label: label, small: true, onPressed: () => _call(number)),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 15.5))),
        ]),
      );
}
