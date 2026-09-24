// What the voice guide says out loud, in the pilgrim's language. Short, plain
// sentences — a spoken version of what is already on screen, so it carries the
// same draft status and goes through the same review. The English is written
// for the speech engine ("rak-ahs", "Sa-i"). Arabic duas are never spoken by
// the phone voice: only real recitations play Arabic. Port of
// src/data/voice-lines.js.
import '../engine/machine.dart' show Json;
import '../engine/stages.dart';
import '../engine/tracking.dart' show KaabaSector;
import 'content.dart';
import 'i18n.dart';

class VoiceLines {
  VoiceLines(this.tr, this.content);
  final Translator tr;
  final Content content;

  String _t(String s, [Map<String, Object?>? v]) => tr.t(s, v);
  String _place(String id) => _t(placeLabel[id]!);

  String? stageLine(String stage, Json? session) {
    final p = parseStage(stage);
    if (p.kind == 'tawaf') {
      final line = _t('Round {n} of {total}. Keep the Kaaba on your left.', {'n': p.n, 'total': tawafRounds});
      return p.n == tawafRounds ? '$line ${_t('This is the final round.')}' : line;
    }
    if (p.kind == 'sai') {
      final d = saiDirection(p.n!);
      final line = _t('Lap {n} of {total}. {from} to {to}.', {'n': p.n, 'total': saiLaps, 'from': _place(d.from), 'to': _place(d.to)});
      return p.n == saiLaps ? '$line ${_t('This is the final lap. It ends at Marwah.')}' : line;
    }
    final source = content.stageLines[stage] as String?;
    if (source == null) return null;
    final line = _t(source);
    return stage == 'IHRAM' && session?['gender'] == 'female' ? '$line ${_t('Women recite the Talbiyah quietly.')}' : line;
  }

  String roundConfirmed(int n) => n >= tawafRounds
      ? _t('Round seven confirmed. Tawaf complete.')
      : _t('Round {n} confirmed. {left} to go. Begin round {next}.', {'n': n, 'left': tawafRounds - n, 'next': n + 1});

  String lapConfirmed(int n) {
    if (n >= saiLaps) return _t('Lap seven confirmed at Marwah. Sa-i complete.');
    final next = saiDirection(n + 1);
    return _t('Lap {n} confirmed at {at}. {left} to go. Now {from} to {to}.', {
      'n': n,
      'at': _place(saiDirection(n).to),
      'left': saiLaps - n,
      'from': _place(next.from),
      'to': _place(next.to),
    });
  }

  String tawafSuggestion() => _t('You appear to be back at the Black Stone line. Confirm the round if you have completed it.');
  String saiSuggestion(String to) => _t('You appear to have reached {place}. Confirm when you have arrived.', {'place': _place(to)});

  String? sectorLine(KaabaSector? sector) => sector == null ? null : [_t(sector.label), _t(sector.tip)].where((s) => s.isNotEmpty).join('. ');

  String greenMarkers(String gender) => gender == 'male' ? _t('Green markers. Jog between them if you are able.') : _t('Green markers. Keep walking at your normal pace.');

  String weakSignal() => _t('Tracking signal is weak. Please keep count yourself, and confirm each round by hand.');
  String paused() => _t('Tracking paused.');
  String resumed() => _t('Tracking resumed.');
  String corrected(String kind, int n) => kind == 'tawaf'
      ? _t('Round count corrected. You are now on round {n}.', {'n': n})
      : _t('Lap count corrected. You are now on lap {n}.', {'n': n});

  String miqatApproaching(double km, String name) =>
      _t('Miqat approaching. About {km} kilometres to the line of {name}. Enter Ihram now if you have not.', {'km': km.round(), 'name': name});
  String miqatReached(String name) => _t('You have reached the {name} Miqat line. You should be in Ihram now.', {'name': name});
}
