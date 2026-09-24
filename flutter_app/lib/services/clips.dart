// Plays real recitations only (never the phone voice). One clip at a time, with
// a seek bar, a speed control, and a queue so a whole section can play back to
// back like a playlist. The Talbiyah has its own looping player. Port of
// createClipPlayer in src/ui/voice.js.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:just_audio/just_audio.dart';

import '../engine/machine.dart' show Json;

const List<double> playbackRates = [0.75, 1, 1.25];

class ClipPlayer extends ChangeNotifier {
  final AudioPlayer _player = AudioPlayer();
  final AudioPlayer _talbiyah = AudioPlayer();

  /// audio/duas/index.json, when bundled, is the authoritative list.
  Json? index;
  Map<String, dynamic> _files = {};
  final Set<String> _missing = {};

  /// The pilgrim's choice of Qur'an reciter, when a clip offers alternates.
  String? preferredReciter;
  String? playingId;
  List<String>? queue;
  int queueIndex = 0;
  double rate = 1;
  Duration position = Duration.zero;
  Duration duration = Duration.zero;
  bool talbiyahPlaying = false;
  bool talbiyahLoop = false;
  bool talbiyahMissing = false;

  StreamSubscription? _posSub;
  StreamSubscription? _durSub;
  StreamSubscription? _stateSub;
  StreamSubscription? _tStateSub;

  Future<void> init() async {
    try {
      final raw = await rootBundle.loadString('assets/audio/duas/index.json');
      index = jsonDecode(raw) as Json;
      _files = (index!['files'] as Map).cast<String, dynamic>();
    } catch (_) {
      index = null;
      _files = {};
    }
    _posSub = _player.positionStream.listen((p) {
      position = p;
      notifyListeners();
    });
    _durSub = _player.durationStream.listen((d) {
      duration = d ?? Duration.zero;
      notifyListeners();
    });
    _stateSub = _player.playerStateStream.listen((s) {
      if (s.processingState == ProcessingState.completed) _advance();
    });
    _tStateSub = _talbiyah.playerStateStream.listen((s) {
      final playing = s.playing && s.processingState != ProcessingState.completed;
      if (playing != talbiyahPlaying) {
        talbiyahPlaying = playing;
        notifyListeners();
      }
    });
  }

  /// The catalogue entry for a recording (reciter, label, kind, ...).
  Map<String, dynamic>? entry(String id) => (_files[id] as Map?)?.cast<String, dynamic>();

  bool hasRecording(String id) => _files.containsKey(id) && !_missing.contains(id);

  /// Reciters offering an alternate recording of this specific clip, if any.
  Map<String, dynamic>? recitersFor(String id) => (_files[id] as Map?)?['alternates'] as Map<String, dynamic>?;

  String _assetFor(String id) {
    final entry = _files[id] as Map?;
    final alt = preferredReciter == null ? null : (entry?['alternates'] as Map?)?[preferredReciter] as Map?;
    final file = (alt?['file'] ?? entry?['file'] ?? './audio/duas/$id.mp3') as String;
    return 'assets/${file.replaceFirst('./', '')}';
  }

  Future<bool> play(String id, {List<String>? queueIds}) async {
    if (_missing.contains(id) || (_files.isNotEmpty && !_files.containsKey(id))) return false;
    try {
      await _player.stop();
      playingId = id;
      queue = queueIds;
      queueIndex = queueIds == null ? 0 : queueIds.indexOf(id);
      notifyListeners();
      await _player.setAsset(_assetFor(id));
      await _player.setSpeed(rate);
      unawaited(_player.play());
      return true;
    } catch (_) {
      _missing.add(id);
      playingId = null;
      queue = null;
      notifyListeners();
      return false;
    }
  }

  /// Plays every id in order that has a recording, skipping the rest.
  Future<bool> playAll(List<String> ids) async {
    final playable = ids.where(hasRecording).toList();
    if (playable.isEmpty) return false;
    return play(playable.first, queueIds: playable);
  }

  Future<void> _advance() async {
    final q = queue;
    final next = q != null && queueIndex >= 0 ? q.skip(queueIndex + 1).where(hasRecording).firstOrNull : null;
    if (next != null && q != null) {
      await play(next, queueIds: q);
    } else {
      playingId = null;
      queue = null;
      notifyListeners();
    }
  }

  Future<void> stop() async {
    await _player.stop();
    playingId = null;
    queue = null;
    position = Duration.zero;
    notifyListeners();
  }

  Future<void> seek(Duration to) => _player.seek(to);

  Future<void> setRate(double next) async {
    rate = next;
    await _player.setSpeed(next);
    notifyListeners();
  }

  // ── Talbiyah ──
  Future<void> toggleTalbiyah() async {
    if (talbiyahPlaying) {
      await _talbiyah.pause();
      return;
    }
    try {
      await stop();
      if (_talbiyah.audioSource == null) await _talbiyah.setAsset('assets/audio/talbiyah.mp3');
      await _talbiyah.setLoopMode(talbiyahLoop ? LoopMode.one : LoopMode.off);
      unawaited(_talbiyah.play());
    } catch (_) {
      talbiyahMissing = true;
      notifyListeners();
    }
  }

  Future<void> pauseTalbiyah() async {
    try {
      await _talbiyah.pause();
    } catch (_) {}
  }

  Future<void> setTalbiyahLoop(bool loop) async {
    talbiyahLoop = loop;
    try {
      await _talbiyah.setLoopMode(loop ? LoopMode.one : LoopMode.off);
    } catch (_) {}
    notifyListeners();
  }

  bool get anythingPlaying => playingId != null || talbiyahPlaying;

  @override
  void dispose() {
    _posSub?.cancel();
    _durSub?.cancel();
    _stateSub?.cancel();
    _tStateSub?.cancel();
    _player.dispose();
    _talbiyah.dispose();
    super.dispose();
  }
}
