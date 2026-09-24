// Controller: owns the state, turns taps into engine events, persists after
// every change, and keeps tracking, sensors, voice, recitations, map and wake
// lock in sync. Port of src/ui/app.js. Screens read from here and call its
// methods; nothing else changes the ritual state.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:share_plus/share_plus.dart';
import 'package:vibration/vibration.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../engine/geo.dart';
import '../engine/machine.dart';
import '../engine/miqat.dart';
import '../engine/motion.dart';
import '../engine/stages.dart';
import '../engine/tracking.dart';
import '../services/clips.dart';
import '../services/location.dart';
import '../services/tracking_runtime.dart';
import '../services/voice.dart';
import 'content.dart';
import 'i18n.dart';
import 'store.dart';
import 'voice_lines.dart';

/// Errors that just mean "that tap was a duplicate" — ignored silently.
const Set<String> _quietErrors = {'STALE', 'ALREADY_PAUSED', 'NOT_PAUSED'};
const int _tapGuardMs = 350;
const int _quickConfirmMs = 15000;

/// The pilgrim's real-world fix while Tawaf/Sa'i tracking is on, kept separate
/// from the Map page's own explicitly-toggled "show my location" so stopping
/// one never affects the other.
class LiveFix {
  GeoPoint? latLng;
  double? distanceM;
  double? accuracyM;
}

/// State of the standalone Map page.
class MapState {
  bool live = false;
  List<LocalPoint> trail = [];
  LocalPoint? position;
  double? accuracyM;
  double? distanceM;
  GeoPoint? latLng;
  String? error;

  /// True once the pilgrim is beyond the Kaaba diagram's ~500 m coverage, so
  /// the real online map is shown instead.
  bool get showsRealMap => live && distanceM != null && distanceM! > mapRangeM;
}

class MiqatView {
  const MiqatView({this.busy = false, this.error, this.status});
  final bool busy;
  final String? error;
  final MiqatStatus? status;
}

class ModalState {
  const ModalState.correct(this.ritual)
      : kind = 'correct',
        type = null,
        field = null,
        n = null,
        expect = null;
  const ModalState.quick({required this.type, required this.field, required this.n, required this.expect})
      : kind = 'quick-confirm',
        ritual = null;
  final String kind;
  final String? ritual;
  final String? type;
  final String? field;
  final int? n;
  final String? expect;
}

bool get simulateFromEnvironment => const bool.fromEnvironment('SIM') || Uri.base.queryParameters.containsKey('sim');

class AppController extends ChangeNotifier {
  AppController({required this.content, required this.store, required this.tr, this.simulate = false}) {
    lines = VoiceLines(tr, content);
    voice = VoiceService();
    clips = ClipPlayer()..addListener(notifyListeners);
    tracking = TrackingRuntime(
      simulate: simulate,
      isDropped: () => simDropped,
      getStepLength: () => prefs.stepLengthM ?? 0.72,
      onRawPosition: _onRawPosition,
      onReading: _onReading,
    );
    state = store.loadState();
    prefs = store.loadPrefs();
  }

  final Content content;
  final Store store;
  final Translator tr;
  final bool simulate;
  late final VoiceLines lines;
  late final VoiceService voice;
  late final ClipPlayer clips;
  late final TrackingRuntime tracking;

  late Json state;
  late Prefs prefs;

  // ── UI state ──
  String? error;
  String? notice;
  ({String kind, int n})? justCompleted;
  ModalState? modal;
  Map<String, bool> readyChecks = {};
  TrackingReading? reading;
  final LiveFix live = LiveFix();
  final MapState map = MapState();
  MiqatView? miqatReading;
  bool miqatWatching = false;
  bool simDropped = false;
  bool wakeLockOn = false;

  StreamSubscription<Position>? _mapSub;
  StreamSubscription<Position>? _miqatSub;
  int _lastTapAt = 0;

  // ── convenience ──
  String t(String s, [Map<String, Object?>? vars]) => tr.t(s, vars);
  Json? get session => state['session'] as Json?;
  List<Json> get archive => (state['archive'] as List).cast<Json>();
  bool get hasLanguage => prefs.language != null;
  int get undoDepth => store.undoDepth;
  String get nowIso => DateTime.now().toUtc().toIso8601String();

  Future<void> init() async {
    await tr.setLanguage(prefs.language ?? 'en');
    await voice.init();
    voice.enabled = prefs.voiceEnabled && voice.available;
    voice.preferredName = prefs.voiceName;
    clips.preferredReciter = prefs.reciter;
    await clips.init();
    _syncSideEffects();
  }

  // ── spoken guidance ──
  // Never talks over a recitation. `build` is a function (so it can be re-run
  // in English when the phone has no voice for the pilgrim's language) — a
  // known, labelled fallback instead of a confusing half-broken mix of scripts.
  Future<bool> say(String? Function() build, {String? key, bool interrupt = false, bool force = false}) async {
    if (clips.anythingPlaying) return false;
    final fallback = tr.code != 'en' && !voice.hasVoiceForLanguage(tr.language.speech);
    final text = fallback ? tr.inEnglish(() => build() ?? '') : (build() ?? '');
    if (text.isEmpty) return false;
    return voice.say(text, lang: tr.language.speech, key: key, interrupt: interrupt, force: force, forceEnglish: fallback);
  }

  Future<void> _buzz(List<int> pattern) async {
    try {
      if (await Vibration.hasVibrator()) Vibration.vibrate(pattern: [0, ...pattern]);
    } catch (_) {}
  }

  // ── ritual state ──
  bool dispatch(Json event, {bool remember = true}) {
    final before = state;
    try {
      state = transition(state, {'now': nowIso, ...event});
    } on RitualError catch (err) {
      if (!_quietErrors.contains(err.code)) error = t(err.message);
      notifyListeners();
      return false;
    } catch (err) {
      debugPrint('$err');
      error = t('Something went wrong. Your last saved progress is kept.');
      notifyListeners();
      return false;
    }
    if (remember) store.pushUndo(before);
    notice = store.saveState(state) ? null : t('Warning: progress could not be saved on this device (storage full or blocked).');
    error = null;
    final type = event['type'];
    justCompleted = type == EV.confirmTawafRound
        ? (kind: 'tawaf', n: event['round'] as int)
        : type == EV.confirmSaiLap
            ? (kind: 'sai', n: event['lap'] as int)
            : null;
    if (type == EV.startTawaf) clips.pauseTalbiyah(); // Talbiyah stops when Tawaf begins.
    final beforeStage = (before['session'] as Json?)?['current_stage'];
    if (beforeStage != session?['current_stage']) {
      map.trail = [];
      readyChecks = {};
    }
    _announce(before, event);
    _syncSideEffects();
    notifyListeners();
    return true;
  }

  void _announce(Json before, Json event) {
    final s = session;
    if (s == null) return;
    final type = event['type'];
    final stageChanged = (before['session'] as Json?)?['current_stage'] != s['current_stage'];
    if (type == EV.confirmTawafRound) {
      say(() => lines.roundConfirmed(event['round'] as int), interrupt: true, force: true);
    } else if (type == EV.confirmSaiLap) {
      say(() => lines.lapConfirmed(event['lap'] as int), interrupt: true, force: true);
    } else if (type == EV.correctTawafRound) {
      say(() => lines.corrected('tawaf', event['round'] as int), interrupt: true, force: true);
    } else if (type == EV.correctSaiLap) {
      say(() => lines.corrected('sai', event['lap'] as int), interrupt: true, force: true);
    } else if (type == EV.pause) {
      say(() => lines.paused(), interrupt: true);
    } else if (type == EV.resume) {
      say(() => lines.resumed(), interrupt: true);
    } else if (stageChanged) {
      say(() => lines.stageLine(s['current_stage'] as String, s), key: 'stage:${s['current_stage']}', interrupt: true);
    }
  }

  bool _guard() {
    final now = DateTime.now().millisecondsSinceEpoch;
    if (now - _lastTapAt < _tapGuardMs) return false;
    _lastTapAt = now;
    return true;
  }

  // ── actions the screens call ──
  Future<void> setLanguage(String code) async {
    await tr.setLanguage(code);
    prefs.language = tr.code;
    store.savePrefs(prefs);
    await voice.stop();
    notifyListeners();
    final s = session;
    say(() => s != null ? lines.stageLine(s['current_stage'] as String, s) : t('Voice guide on.'), force: true);
  }

  bool startUmrah(String gender) {
    final ok = dispatch({'type': EV.start, 'gender': gender, 'language': tr.code});
    if (ok && prefs.miqatRoute != null) dispatch({'type': EV.setMiqat, 'routeId': prefs.miqatRoute}, remember: false);
    return ok;
  }

  void next(String expect) {
    if (_guard()) dispatch({'type': EV.next, 'expect': expect});
  }

  void toggleCheck(String key, bool value) => dispatch({'type': EV.toggleCheck, 'key': key, 'value': value}, remember: false);

  void setReadyCheck(String key, bool value) {
    readyChecks = {...readyChecks, key: value};
    notifyListeners();
  }

  void startTawaf(String expect) {
    if (_guard()) dispatch({'type': EV.startTawaf, 'expect': expect});
  }

  void startSai(String expect) {
    if (_guard()) dispatch({'type': EV.startSai, 'expect': expect});
  }

  void confirmRound(int n, String expect) => _confirmCounted(EV.confirmTawafRound, 'round', n, expect);
  void confirmLap(int n, String expect) => _confirmCounted(EV.confirmSaiLap, 'lap', n, expect);

  void _confirmCounted(String type, String field, int n, String expect) {
    if (!_guard()) return;
    final s = session;
    final Json? ritual = s == null ? null : (s[field == 'round' ? 'tawaf' : 'sai'] as Json?);
    final String? startedAt = ritual == null ? null : (ritual[field == 'round' ? 'current_round_started_at' : 'current_lap_started_at'] as String?);
    if (startedAt != null && DateTime.now().millisecondsSinceEpoch - DateTime.parse(startedAt).millisecondsSinceEpoch < _quickConfirmMs) {
      modal = ModalState.quick(type: type, field: field, n: n, expect: expect);
      notifyListeners();
      return;
    }
    _finishCounted(type, field, n, expect);
  }

  void confirmQuick() {
    final m = modal;
    if (m == null || m.kind != 'quick-confirm') return;
    modal = null;
    _finishCounted(m.type!, m.field!, m.n!, m.expect!);
  }

  void _finishCounted(String type, String field, int n, String expect) {
    final s = session;
    final r = reading;
    final assisted = s?['tracking_mode'] == 'assisted';
    final confidence = assisted && r != null && r.isOk && r.suggestCompletion ? r.confidence : 'manual';
    if (field == 'lap') _learnStepLength(r);
    dispatch({'type': type, field: n, 'expect': expect, 'confidence': confidence});
  }

  /// A lap walked with good GPS teaches us the pilgrim's step length for the indoor laps.
  void _learnStepLength(TrackingReading? r) {
    if (r == null || r.mode != 'gps+steps' || r.agreement != 'agree' || r.progress < 0.9 || r.lengthM == null) return;
    final measured = calibrateStepLength(r.progress * r.lengthM!, r.stepsThisLap ?? 0);
    if (measured == null) return;
    prefs.stepLengthM = measured;
    store.savePrefs(prefs);
  }

  void resetStepLength() {
    prefs.stepLengthM = null;
    store.savePrefs(prefs);
    notifyListeners();
  }

  void pause() => dispatch({'type': EV.pause});
  void resume() => dispatch({'type': EV.resume});

  void openCorrect(String ritual) {
    modal = ModalState.correct(ritual);
    notifyListeners();
  }

  void correct(String ritual, int n) {
    final ok = dispatch(ritual == 'tawaf' ? {'type': EV.correctTawafRound, 'round': n} : {'type': EV.correctSaiLap, 'lap': n});
    if (ok) {
      modal = null;
      notifyListeners();
    }
  }

  void closeModal() {
    modal = null;
    notifyListeners();
  }

  void setTracking(String mode) => dispatch({'type': EV.setTrackingMode, 'mode': mode}, remember: false);

  void confirmHair(String method, String expect) {
    if (_guard()) dispatch({'type': EV.confirmHair, 'method': method, 'expect': expect});
  }

  void undo() {
    final prev = store.popUndo();
    if (prev == null) return;
    state = prev;
    store.saveState(state);
    error = null;
    modal = null;
    justCompleted = null;
    _syncSideEffects();
    notifyListeners();
  }

  bool endSession() => dispatch({'type': EV.reset});

  // ── preparation, info, personal duas ──
  void togglePrep(String id, bool value) {
    prefs.checklist[id] = value;
    store.savePrefs(prefs);
    notifyListeners();
  }

  void saveInfo(Map<String, String> values) {
    for (final e in values.entries) {
      prefs.info[e.key] = e.value.trim();
    }
    notice = store.savePrefs(prefs) ? t('Saved on this device.') : t('Could not save — device storage is full or blocked.');
    notifyListeners();
  }

  Future<void> saveHotelHere() async {
    try {
      final fix = await currentFix();
      prefs.info['hotelLat'] = fix.point.lat;
      prefs.info['hotelLng'] = fix.point.lng;
      store.savePrefs(prefs);
      notice = t('Hotel location saved (±{m} m).', {'m': fix.accuracyM.round()});
      error = null;
    } on LocationProblem catch (e) {
      error = t(e.message);
    }
    notifyListeners();
  }

  void addPersonalDua(String text) {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;
    prefs.personalDuas = [...prefs.personalDuas, {'id': DateTime.now().millisecondsSinceEpoch.toRadixString(36), 'text': trimmed}];
    store.savePrefs(prefs);
    notifyListeners();
  }

  void removePersonalDua(String id) {
    prefs.personalDuas = prefs.personalDuas.where((d) => d['id'] != id).toList();
    store.savePrefs(prefs);
    notifyListeners();
  }

  // ── Miqat ──
  void setMiqatRoute(String? id) {
    prefs.miqatRoute = (id == null || id.isEmpty) ? null : id;
    store.savePrefs(prefs);
    miqatReading = null;
    if (miqatWatching) {
      _stopMiqatWatch();
      _startMiqatWatch();
    }
    if (session?['status'] == 'active') {
      dispatch({'type': EV.setMiqat, 'routeId': prefs.miqatRoute}, remember: false);
    } else {
      notifyListeners();
    }
  }

  List<MiqatPoint> _miqatCandidates() {
    final r = content.routeById((session?['miqat'] as Json?)?['route_id'] as String? ?? prefs.miqatRoute);
    if (r == null) return const [];
    return content.miqatPoints.where((m) => r.miqats.contains(m.id)).toList();
  }

  void toggleMiqatWatch() {
    if (miqatWatching) {
      _stopMiqatWatch();
    } else {
      _startMiqatWatch();
    }
    notifyListeners();
  }

  void _stopMiqatWatch() {
    _miqatSub?.cancel();
    _miqatSub = null;
    miqatWatching = false;
  }

  Future<void> _startMiqatWatch() async {
    final candidates = _miqatCandidates();
    if (candidates.isEmpty) {
      miqatReading = const MiqatView(error: 'Choose your route first.');
      return;
    }
    try {
      await ensureLocationPermission();
    } on LocationProblem catch (e) {
      miqatReading = MiqatView(error: e.message);
      notifyListeners();
      return;
    }
    miqatWatching = true;
    _miqatSub = watchFixes(precise: false).listen((p) {
      final before = miqatReading?.status?.status;
      final reading = miqatStatus(GeoPoint(p.latitude, p.longitude), candidates);
      miqatReading = MiqatView(status: reading);
      if (reading.status != before) {
        if (reading.status == 'approaching') {
          _buzz([200, 100, 200]);
          say(() => lines.miqatApproaching(reading.first.kmToBoundary, reading.first.name), interrupt: true, force: true);
        } else if (reading.status == 'reached') {
          _buzz([400, 150, 400]);
          say(() => lines.miqatReached(reading.first.name), interrupt: true, force: true);
        }
      }
      notifyListeners();
    }, onError: (_) {
      miqatReading = const MiqatView(error: 'Could not get your location.');
      _stopMiqatWatch();
      notifyListeners();
    });
  }

  Future<void> locateForMiqat() async {
    miqatReading = const MiqatView(busy: true);
    notifyListeners();
    try {
      final candidates = _miqatCandidates();
      if (candidates.isEmpty) throw const LocationProblem('Choose your route first.');
      final fix = await currentFix();
      final status = miqatStatus(fix.point, candidates);
      miqatReading = MiqatView(status: status);
      if (status.status != 'far') _buzz([200, 100, 200]);
    } on LocationProblem catch (e) {
      miqatReading = MiqatView(error: e.message);
    }
    notifyListeners();
  }

  // ── live map (standalone Map page) ──
  Future<void> toggleMapLive() async {
    if (map.live) {
      _stopMapWatch();
      notifyListeners();
      return;
    }
    try {
      await ensureLocationPermission();
    } on LocationProblem catch (e) {
      map.error = e.message;
      notifyListeners();
      return;
    }
    map.error = null;
    map.live = true;
    _mapSub = watchFixes(precise: true).listen((p) {
      final coords = GeoPoint(p.latitude, p.longitude);
      map.latLng = coords;
      final dist = distanceM(coords, haramGeo.kaabaCenter);
      map.distanceM = dist;
      map.accuracyM = p.accuracy;
      if (dist <= mapRangeM) {
        final point = toLocalM(haramGeo.kaabaCenter, coords);
        map.position = point;
        _addTrail(point);
      } else {
        map.position = null;
      }
      notifyListeners();
    }, onError: (_) {
      map.error = 'Could not get your location.';
      _stopMapWatch();
      notifyListeners();
    });
    notifyListeners();
  }

  void _stopMapWatch() {
    _mapSub?.cancel();
    _mapSub = null;
    map.live = false;
    map.position = null;
    map.distanceM = null;
    map.latLng = null;
  }

  /// Called when leaving the Map page.
  void leaveMapPage() {
    if (map.live) {
      _stopMapWatch();
      notifyListeners();
    }
  }

  void clearTrail() {
    map.trail = [];
    notifyListeners();
  }

  void _addTrail(LocalPoint p) {
    final last = map.trail.isEmpty ? null : map.trail.last;
    if (last == null || ((p.x - last.x) * (p.x - last.x) + (p.y - last.y) * (p.y - last.y)) > 1.5 * 1.5) {
      map.trail = [...map.trail, p];
      if (map.trail.length > 120) map.trail = map.trail.sublist(map.trail.length - 120);
    }
  }

  // ── tracking runtime callbacks ──
  void _onRawPosition(PositionSample? sample) {
    if (sample == null) {
      live.latLng = null;
      live.distanceM = null;
      live.accuracyM = null;
      return;
    }
    final coords = GeoPoint(sample.lat, sample.lng);
    live.latLng = coords;
    live.distanceM = distanceM(coords, haramGeo.kaabaCenter);
    live.accuracyM = sample.accuracy;
  }

  void _onReading(TrackingReading? next) {
    final before = reading;
    reading = next;
    final p = next?.position;
    if (p != null) _addTrail(LocalPoint(p.x, p.y));
    _reactToReading(before, next);
    notifyListeners();
  }

  void _reactToReading(TrackingReading? before, TrackingReading? r) {
    final s = session;
    if (s == null || r == null || !r.isOk) {
      if (s != null && r != null && before != null && before.isOk && (r.status == 'weak' || r.status == 'out_of_area')) {
        say(() => lines.weakSignal(), key: 'weak', interrupt: true);
      }
      return;
    }
    if (r.suggestCompletion && !(before?.suggestCompletion ?? false)) {
      // A distinct triple-buzz — deliberately different from the single, short
      // vibration used elsewhere — so the pilgrim can recognise "you may be
      // done" by feel alone in a crowd.
      _buzz([150, 90, 150, 90, 250]);
      final p = parseStage(s['current_stage'] as String);
      say(() => p.kind == 'sai' ? lines.saiSuggestion(saiDirection(p.n!).to) : lines.tawafSuggestion(), key: 'suggest', interrupt: true, force: true);
    }
    if (r.sector != null && r.sector!.id != before?.sector?.id) {
      say(() => lines.sectorLine(r.sector), key: 'sector:${r.sector!.id}');
    }
    if (r.green == 'inside' && before?.green != 'inside') {
      _buzz([100]);
      say(() => lines.greenMarkers(s['gender'] as String), key: 'green');
    }
  }

  void toggleSimDrop() {
    simDropped = !simDropped;
    notifyListeners();
  }

  void _syncSideEffects() {
    tracking.sync(session);
    _syncWakeLock();
  }

  Future<void> _syncWakeLock() async {
    final s = session;
    final want = s?['status'] == 'active' && parseStage(s!['current_stage'] as String).kind != 'simple' && s['paused'] != true;
    if (want == wakeLockOn) return;
    wakeLockOn = want;
    try {
      if (want) {
        await WakelockPlus.enable();
      } else {
        await WakelockPlus.disable();
      }
    } catch (_) {
      wakeLockOn = false;
    }
  }

  // ── voice, recitations, settings ──
  void toggleVoice() {
    voice.enabled = !voice.enabled && voice.available;
    prefs.voiceEnabled = voice.enabled;
    store.savePrefs(prefs);
    final s = session;
    if (voice.enabled) {
      say(() => s != null ? lines.stageLine(s['current_stage'] as String, s) : t('Voice guide on.'), force: true, interrupt: true);
    } else {
      voice.stop();
    }
    notifyListeners();
  }

  void testVoice() {
    final s = session;
    voice.enabled = voice.available;
    say(() => s != null ? lines.stageLine(s['current_stage'] as String, s) : t('Voice guide on.'), force: true, interrupt: true);
    notifyListeners();
  }

  void selectVoice(String? name) {
    voice.preferredName = name;
    prefs.voiceName = name;
    store.savePrefs(prefs);
    voice.enabled = voice.available;
    say(() => t('Voice guide on.'), force: true, interrupt: true);
    notifyListeners();
  }

  void setReciter(String? key) {
    clips.preferredReciter = key;
    prefs.reciter = key;
    store.savePrefs(prefs);
    notifyListeners();
  }

  void setTextScale(double scale) {
    prefs.textScale = scale;
    store.savePrefs(prefs);
    notifyListeners();
  }

  // Recitations only: a real reciter's recording, never the phone voice.
  Future<void> playDua(String id) async {
    if (clips.playingId == id) return clips.stop();
    await voice.stop();
    await clips.pauseTalbiyah();
    if (!await clips.play(id)) {
      notice = t('This recitation could not be played.');
      notifyListeners();
    }
  }

  /// "Play all" for a whole section — every recitation in it, back to back.
  Future<void> playAllDuas(List<String> ids) async {
    if (clips.playingId != null && ids.contains(clips.playingId)) return clips.stop();
    await voice.stop();
    await clips.pauseTalbiyah();
    if (!await clips.playAll(ids)) {
      notice = t('These recitations could not be played.');
      notifyListeners();
    }
  }

  Future<void> toggleTalbiyah() async {
    await voice.stop();
    await clips.toggleTalbiyah();
  }

  /// Shows [message] in the error banner (used by screens for form validation).
  void showError(String? message) {
    error = message;
    notifyListeners();
  }

  void clearNotice() {
    notice = null;
    notifyListeners();
  }

  // ── export ──
  Future<void> exportJourney(String id) async {
    final all = [?session, ...archive];
    final s = all.where((x) => x['id'] == id).firstOrNull;
    if (s == null) return;
    final data = const JsonEncoder.withIndent('  ').convert({'exported_at': nowIso, ...toRecords(s)});
    final day = (s['started_at'] as String).substring(0, 10);
    await SharePlus.instance.share(ShareParams(
      files: [XFile.fromData(utf8.encode(data), mimeType: 'application/json', name: 'umrah-journey-$day.json')],
      fileNameOverrides: ['umrah-journey-$day.json'],
    ));
  }

  @override
  void dispose() {
    tracking.stop();
    _mapSub?.cancel();
    _miqatSub?.cancel();
    clips.removeListener(notifyListeners);
    clips.dispose();
    super.dispose();
  }
}
