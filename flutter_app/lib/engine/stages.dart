// The Umrah ritual as one ordered list of stages. Counted rituals (Tawaf
// rounds, Sa'i laps) are expanded into one stage per round, so the journey is a
// single linear state machine: the current stage alone says where the pilgrim
// is. Port of src/engine/stages.js.

const int tawafRounds = 7;
const int saiLaps = 7;

class Stage {
  static const notStarted = 'UMRAH_NOT_STARTED';
  static const miqat = 'MIQAT';
  static const ihram = 'IHRAM';
  static const talbiyah = 'TALBIYAH';
  static const enterHaram = 'ENTER_HARAM';
  static const tawafReady = 'TAWAF_READY';
  static const tawafComplete = 'TAWAF_COMPLETE';
  static const twoRakah = 'TWO_RAKAH';
  static const zamzam = 'ZAMZAM';
  static const safa = 'SAFA';
  static const saiComplete = 'SAI_COMPLETE';
  static const hair = 'HAIR';
  static const ihramExit = 'IHRAM_EXIT';
  static const umrahComplete = 'UMRAH_COMPLETE';
}

String tawafRoundStage(int n) => 'TAWAF_ROUND_$n';
String saiLapStage(int n) => 'SAI_$n';

List<int> _range(int n) => List<int>.generate(n, (i) => i + 1);

final List<String> stageOrder = List.unmodifiable([
  Stage.notStarted,
  Stage.miqat,
  Stage.ihram,
  Stage.talbiyah,
  Stage.enterHaram,
  Stage.tawafReady,
  ..._range(tawafRounds).map(tawafRoundStage),
  Stage.tawafComplete,
  Stage.twoRakah,
  Stage.zamzam,
  Stage.safa,
  ..._range(saiLaps).map(saiLapStage),
  Stage.saiComplete,
  Stage.hair,
  Stage.ihramExit,
  Stage.umrahComplete,
]);

const Map<String, String> _stageLabel = {
  Stage.notStarted: 'Not started',
  Stage.miqat: 'Miqat',
  Stage.ihram: 'Ihram',
  Stage.talbiyah: 'Talbiyah',
  Stage.enterHaram: 'Masjid al-Haram',
  Stage.tawafReady: 'Tawaf — starting point',
  Stage.tawafComplete: 'Tawaf complete',
  Stage.twoRakah: 'Two rak’ahs',
  Stage.zamzam: 'Zamzam',
  Stage.safa: 'Sa’i — Safa',
  Stage.saiComplete: 'Sa’i complete',
  Stage.hair: 'Hair',
  Stage.ihramExit: 'Exit Ihram',
  Stage.umrahComplete: 'Umrah complete',
};

typedef ParsedStage = ({String kind, int? n});

final RegExp _tawafRe = RegExp(r'^TAWAF_ROUND_(\d+)$');
final RegExp _saiRe = RegExp(r'^SAI_(\d+)$');

/// `kind` is 'tawaf', 'sai' or 'simple'; `n` is the round/lap for the first two.
ParsedStage parseStage(String? id) {
  final t = _tawafRe.firstMatch(id ?? '');
  if (t != null) {
    final n = int.parse(t.group(1)!);
    if (n >= 1 && n <= tawafRounds) return (kind: 'tawaf', n: n);
  }
  final s = _saiRe.firstMatch(id ?? '');
  if (s != null) {
    final n = int.parse(s.group(1)!);
    if (n >= 1 && n <= saiLaps) return (kind: 'sai', n: n);
  }
  return (kind: 'simple', n: null);
}

class Place {
  static const safa = 'SAFA';
  static const marwah = 'MARWAH';
}

const Map<String, String> placeLabel = {Place.safa: 'Safa', Place.marwah: 'Marwah'};

typedef SaiDirection = ({String from, String to, String key});

/// Lap 1 is Safa -> Marwah. Odd laps end at Marwah, even laps at Safa, so lap 7
/// ends at Marwah.
SaiDirection saiDirection(int lap) {
  final outbound = lap % 2 == 1;
  final from = outbound ? Place.safa : Place.marwah;
  final to = outbound ? Place.marwah : Place.safa;
  return (from: from, to: to, key: '${from}_TO_$to');
}

int stageIndex(String id) => stageOrder.indexOf(id);

String stageTitle(String id) {
  final p = parseStage(id);
  if (p.kind == 'tawaf') return 'Tawaf — Round ${p.n} / $tawafRounds';
  if (p.kind == 'sai') return 'Sa’i — Lap ${p.n} / $saiLaps';
  return _stageLabel[id] ?? id;
}

/// Ihram restrictions apply once the Ihram check is done and last until the
/// hair ritual.
bool isIhramActive(String id) {
  final i = stageIndex(id);
  return i >= stageIndex(Stage.talbiyah) && i <= stageIndex(Stage.hair);
}

// Rounds and laps weigh more than single steps so the overall bar moves the way
// the effort does.
int _weight(String id) => parseStage(id).kind == 'simple' ? 1 : 2;
final List<String> _journey = stageOrder.sublist(1, stageOrder.length - 1);
final int _totalWeight = _journey.fold(0, (sum, id) => sum + _weight(id));

/// Share of the journey finished before reaching [id], from 0 to 1.
double progressOf(String id) {
  if (id == Stage.umrahComplete) return 1;
  final i = _journey.indexOf(id);
  if (i < 0) return 0;
  return _journey.sublist(0, i).fold<int>(0, (sum, s) => sum + _weight(s)) / _totalWeight;
}
