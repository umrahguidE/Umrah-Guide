// Time and number formatting in the pilgrim's language.
import 'package:intl/intl.dart';

String fmtTime(String? iso, String locale) {
  if (iso == null) return '—';
  final dt = DateTime.tryParse(iso);
  if (dt == null) return '—';
  return DateFormat.jm(locale).format(dt.toLocal());
}

String fmtDateTime(String? iso, String locale) {
  if (iso == null) return '—';
  final dt = DateTime.tryParse(iso);
  if (dt == null) return '—';
  return '${DateFormat.yMMMd(locale).format(dt.toLocal())}, ${DateFormat.jm(locale).format(dt.toLocal())}';
}

/// "1:23" style clock for a playback position.
String fmtClock(Duration d) => '${d.inMinutes}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';
