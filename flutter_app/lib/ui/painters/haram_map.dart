// Offline map of Masjid al-Haram, drawn in metres around the Kaaba from the
// mapped geometry in haramGeo (OpenStreetMap): the Kaaba's real corners, the
// Tawaf start line to the green light, Maqām Ibrāhīm, Ḥijr Ismāʿīl, and the
// Mas'a between the Safa and Marwah hilltops. The mosque outline and the
// green-marker section are schematic. Port of src/ui/map.js.
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../engine/geo.dart';
import '../../engine/tracking.dart';
import '../theme.dart';
import 'paint_utils.dart';

/// Local metres (x east, y north) around the Kaaba's centre.
LocalPoint localOf(GeoPoint p) => toLocalM(haramGeo.kaabaCenter, p);

// SVG y grows downwards, so north is -y.
Offset _o(LocalPoint p) => Offset(p.x, -p.y);

LocalPoint _lerp(LocalPoint a, LocalPoint b, double k) => LocalPoint(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k);

class HaramMap extends StatefulWidget {
  const HaramMap({
    super.key,
    this.pilgrim,
    this.accuracyM,
    this.trail = const [],
    this.focus,
    this.saiFromSafa,
    required this.labels,
    required this.semanticsLabel,
  });

  /// Live position in local metres.
  final LocalPoint? pilgrim;
  final double? accuracyM;
  final List<LocalPoint> trail;

  /// 'tawaf' or 'sai' fades the other part.
  final String? focus;

  /// 0..1 along the Mas'a, when known but there is no GPS position.
  final double? saiFromSafa;

  /// Translated labels: safa, marwah, greenMarkers, start, maqam, scale.
  final Map<String, String> labels;
  final String semanticsLabel;

  @override
  State<HaramMap> createState() => _HaramMapState();
}

class _HaramMapState extends State<HaramMap> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800))..repeat();
  Offset _last = Offset.zero;

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final reduce = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    final safa = localOf(haramGeo.safa);
    final marwah = localOf(haramGeo.marwah);
    final saiDot = widget.saiFromSafa == null ? null : _lerp(safa, marwah, widget.saiFromSafa!);
    final shown = widget.pilgrim ?? saiDot;
    if (shown != null) _last = _o(shown);
    return Semantics(
      label: widget.semanticsLabel,
      image: true,
      child: AspectRatio(
        aspectRatio: 390 / 545,
        child: TweenAnimationBuilder<Offset>(
          tween: Tween<Offset>(end: _last),
          duration: const Duration(milliseconds: 600),
          curve: Curves.easeOut,
          builder: (context, dot, _) => AnimatedBuilder(
            animation: _pulse,
            builder: (context, _) => CustomPaint(
              painter: _MapPainter(
                colors: c,
                dot: shown == null ? null : dot,
                live: widget.pilgrim != null,
                accuracyM: widget.accuracyM,
                trail: widget.trail,
                focus: widget.focus,
                labels: widget.labels,
                pulse: reduce ? 0.3 : _pulse.value,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MapPainter extends CustomPainter {
  _MapPainter({required this.colors, required this.dot, required this.live, required this.accuracyM, required this.trail, required this.focus, required this.labels, required this.pulse});
  final AppColors colors;
  final Offset? dot;
  final bool live;
  final double? accuracyM;
  final List<LocalPoint> trail;
  final String? focus;
  final Map<String, String> labels;
  final double pulse;

  @override
  void paint(Canvas canvas, Size size) {
    final c = colors;
    final geo = haramGeo;
    canvas.save();
    canvas.scale(size.width / 390, size.height / 545);
    canvas.translate(165, 375); // viewBox -165 -375 390 545

    final safa = localOf(geo.safa);
    final marwah = localOf(geo.marwah);
    final [g0, g1] = geo.greenZone;
    final greenA = _lerp(safa, marwah, g0);
    final greenB = _lerp(safa, marwah, g1);
    final masaAngle = math.atan2(marwah.x - safa.x, marwah.y - safa.y);
    final masaLength = math.sqrt(math.pow(marwah.x - safa.x, 2) + math.pow(marwah.y - safa.y, 2));

    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(-160, -370, 380, 535), const Radius.circular(30)), fill(c.surface2));
    final mosque = RRect.fromRectAndRadius(const Rect.fromLTWH(-150, -352, 300, 518), const Radius.circular(42));
    canvas.drawRRect(mosque, fill(c.surface));
    canvas.drawRRect(mosque, stroke(c.border, 3));

    // ── the Mas'a ──
    final masaOpacity = focus == 'tawaf' ? 0.5 : 1.0;
    canvas.saveLayer(null, Paint()..color = Colors.white.withValues(alpha: masaOpacity));
    canvas.save();
    canvas.translate(safa.x, -safa.y);
    canvas.rotate(masaAngle);
    final masa = RRect.fromRectAndRadius(Rect.fromLTWH(-11, -masaLength, 22, masaLength), const Radius.circular(6));
    canvas.drawRRect(masa, fill(c.surface2));
    canvas.drawRRect(masa, stroke(c.border, 2));
    canvas.restore();
    canvas.drawLine(_o(greenA), _o(greenB), stroke(c.green.withValues(alpha: 0.3), 20));
    for (final hillAt in [safa, marwah]) {
      canvas.drawCircle(_o(hillAt), 9, fill(c.surface));
      canvas.drawCircle(_o(hillAt), 9, stroke(c.accent, 3));
    }
    drawLabel(canvas, labels['safa'] ?? '', Offset(safa.x + 16, -safa.y + 5), color: c.text, size: 13);
    drawLabel(canvas, labels['marwah'] ?? '', Offset(marwah.x - 16, -marwah.y + 5), color: c.text, size: 13, align: TextAlign.right);
    final mid = _lerp(greenA, greenB, 0.5);
    drawLabel(canvas, labels['greenMarkers'] ?? '', Offset(mid.x + 16, -mid.y), color: c.muted, size: 10, weight: FontWeight.w400);
    canvas.restore();

    // ── the Mataf ──
    final matafOpacity = focus == 'sai' ? 0.5 : 1.0;
    canvas.saveLayer(null, Paint()..color = Colors.white.withValues(alpha: matafOpacity));
    drawDashedPath(canvas, Path()..addOval(Rect.fromCircle(center: Offset.zero, radius: 45)), stroke(c.border, 2), 6, 6);
    drawDashedPath(canvas, Path()..addOval(Rect.fromCircle(center: Offset.zero, radius: 80)), stroke(c.border, 1.5), 3, 9);
    final startLine = geo.startLine.map((p) => _o(localOf(p))).toList();
    final line = Path()..moveTo(startLine.first.dx, startLine.first.dy);
    for (final p in startLine.skip(1)) {
      line.lineTo(p.dx, p.dy);
    }
    drawDashedPath(canvas, line, stroke(c.green, 2), 5, 5);
    final greenLight = startLine.last;
    canvas.drawCircle(greenLight, 6, fill(c.green));
    canvas.drawCircle(greenLight, 6, stroke(c.surface, 2));
    drawLabel(canvas, labels['start'] ?? '', Offset(greenLight.dx + 10, greenLight.dy + 16), color: c.text, size: 13);

    final hijr = Path();
    for (var i = 0; i < geo.hijr.length; i++) {
      final p = _o(localOf(geo.hijr[i]));
      i == 0 ? hijr.moveTo(p.dx, p.dy) : hijr.lineTo(p.dx, p.dy);
    }
    hijr.close();
    canvas.drawPath(hijr, fill(c.kaaba));

    final k = [geo.blackStone, geo.iraqi, geo.shami, geo.yemeni].map((p) => _o(localOf(p))).toList();
    final kaaba = Path()..addPolygon(k, true);
    canvas.drawPath(kaaba, fill(c.kaaba));
    canvas.drawCircle(k.first, 1.8, fill(c.gold));
    canvas.drawCircle(k.first, 1.8, stroke(c.surface, 0.8));
    final maqam = _o(localOf(geo.maqam));
    canvas.drawCircle(maqam, 2.5, stroke(c.muted, 2));
    drawLabel(canvas, labels['maqam'] ?? '', Offset(maqam.dx + 6, maqam.dy - 8), color: c.muted, size: 10, weight: FontWeight.w400);
    canvas.restore();

    // ── trail and pilgrim ──
    if (trail.length > 1) {
      final path = Path()..moveTo(trail.first.x, -trail.first.y);
      for (final p in trail.skip(1)) {
        path.lineTo(p.x, -p.y);
      }
      canvas.drawPath(path, stroke(c.accent.withValues(alpha: 0.5), 3)..strokeJoin = StrokeJoin.round..strokeCap = StrokeCap.round);
    }
    final d = dot;
    if (d != null) {
      if (live) {
        if (accuracyM != null && accuracyM! > 0) canvas.drawCircle(d, math.max(4, accuracyM!), fill(c.accent.withValues(alpha: 0.12)));
        canvas.drawCircle(d, 6 + 10 * pulse, fill(c.gold.withValues(alpha: 0.4 * (1 - pulse))));
      }
      canvas.drawCircle(d, 6, fill(c.gold));
      canvas.drawCircle(d, 6, stroke(c.surface, 3));
    }

    // ── north arrow and scale ──
    canvas.drawPath(Path()..moveTo(-140, -330)..lineTo(-134, -314)..lineTo(-140, -318)..lineTo(-146, -314)..close(), fill(c.muted));
    drawLabel(canvas, 'N', const Offset(-140, -300), color: c.muted, size: 10, weight: FontWeight.w400, align: TextAlign.center);
    canvas.drawLine(const Offset(-140, 140), const Offset(-90, 140), stroke(c.muted, 2));
    drawLabel(canvas, labels['scale'] ?? '50 m', const Offset(-140, 132), color: c.muted, size: 10, weight: FontWeight.w400);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_MapPainter old) => true;
}
