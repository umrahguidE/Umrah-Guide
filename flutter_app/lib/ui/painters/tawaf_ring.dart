// The Tawaf ring seen from above, north up. The start line points at the Black
// Stone corner; progress is drawn anticlockwise (Kaaba on the pilgrim's left).
// Port of tawafRing in src/ui/components.js.
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme.dart';
import 'paint_utils.dart';

const double _cx = 120;
const double _cy = 120;
const double _r = 92;

Offset _pt(double bearingDeg, [double radius = _r]) {
  final a = bearingDeg * math.pi / 180;
  return Offset(_cx + radius * math.sin(a), _cy - radius * math.cos(a));
}

class TawafRing extends StatefulWidget {
  const TawafRing({super.key, required this.startBearing, required this.startLabel, this.progress, required this.semanticsLabel});
  final double startBearing;
  final String startLabel;

  /// 0..1 around the Kaaba, or null when there is no live reading.
  final double? progress;
  final String semanticsLabel;

  @override
  State<TawafRing> createState() => _TawafRingState();
}

class _TawafRingState extends State<TawafRing> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800))..repeat();
  Offset _lastDot = _pt(0);

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final reduce = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    final side = math.min(300.0, MediaQuery.sizeOf(context).width * 0.8);
    final p = widget.progress?.clamp(0.0, 1.0);
    final target = p == null ? null : _pt(widget.startBearing - p * 360);
    if (target != null) _lastDot = target;
    return Semantics(
      label: widget.semanticsLabel,
      image: true,
      child: Center(
        child: SizedBox(
          width: side,
          height: side,
          // The dot glides to each new position instead of jumping.
          child: TweenAnimationBuilder<Offset>(
            tween: Tween<Offset>(end: _lastDot),
            duration: const Duration(milliseconds: 600),
            curve: Curves.easeOut,
            builder: (context, dot, _) => AnimatedBuilder(
              animation: _pulse,
              builder: (context, _) => CustomPaint(
                painter: _RingPainter(
                  colors: c,
                  startBearing: widget.startBearing,
                  startLabel: widget.startLabel,
                  progress: p,
                  dot: target == null ? null : dot,
                  pulse: reduce ? 0.3 : _pulse.value,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.colors, required this.startBearing, required this.startLabel, required this.progress, required this.dot, required this.pulse});
  final AppColors colors;
  final double startBearing;
  final String startLabel;
  final double? progress;
  final Offset? dot;
  final double pulse;

  @override
  void paint(Canvas canvas, Size size) {
    final c = colors;
    canvas.save();
    canvas.scale(size.width / 308, size.height / 308);
    canvas.translate(34, 34); // viewBox -34 -34 308 308

    // track
    canvas.drawCircle(const Offset(_cx, _cy), _r, stroke(c.surface2, 14));

    // progress arc
    final p = progress;
    if (p != null && p > 0) {
      final paint = stroke(c.accent, 14)..strokeCap = StrokeCap.round;
      if (p >= 0.999) {
        canvas.drawCircle(const Offset(_cx, _cy), _r, paint);
      } else {
        canvas.drawArc(Rect.fromCircle(center: const Offset(_cx, _cy), radius: _r), (startBearing - 90) * math.pi / 180, -p * 2 * math.pi, false, paint);
      }
    }

    // Kaaba, turned so its Black Stone corner faces the start line
    canvas.save();
    canvas.translate(_cx, _cy);
    canvas.rotate((startBearing - 45) * math.pi / 180);
    canvas.translate(-_cx, -_cy);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(98, 98, 44, 44), const Radius.circular(3)), fill(c.kaaba));
    canvas.drawRect(const Rect.fromLTWH(98, 107, 44, 6), fill(c.gold));
    canvas.drawCircle(const Offset(142, 98), 3.5, fill(c.gold));
    canvas.drawCircle(const Offset(142, 98), 3.5, stroke(c.surface, 1.5));
    canvas.restore();

    // start line and marker
    final s = _pt(startBearing);
    drawDashedLine(canvas, const Offset(_cx, _cy), s, stroke(c.green, 2), 4, 4);
    canvas.drawCircle(s, 9, fill(c.green));
    canvas.drawCircle(s, 9, stroke(c.surface, 3));
    drawLabel(canvas, startLabel, _pt(startBearing, _r + 26), color: c.green, size: 13, weight: FontWeight.w800, align: TextAlign.center);

    // direction chevrons
    for (final offset in const [70.0, 160.0, 250.0]) {
      final b = startBearing - offset;
      final pt = _pt(b);
      canvas.save();
      canvas.translate(pt.dx, pt.dy);
      canvas.rotate((b - 90) * math.pi / 180);
      canvas.translate(-pt.dx, -pt.dy);
      final path = Path()
        ..moveTo(pt.dx - 5, pt.dy + 4)
        ..lineTo(pt.dx, pt.dy - 5)
        ..lineTo(pt.dx + 5, pt.dy + 4);
      canvas.drawPath(path, stroke(c.muted, 2.5)..strokeCap = StrokeCap.round..strokeJoin = StrokeJoin.round);
      canvas.restore();
    }

    // the pilgrim
    final d = dot;
    if (d != null) {
      canvas.drawCircle(d, 8 + 14 * pulse, fill(c.gold.withValues(alpha: 0.4 * (1 - pulse))));
      canvas.drawCircle(d, 8, fill(c.gold));
      canvas.drawCircle(d, 8, stroke(c.surface, 3));
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.colors != colors || old.progress != progress || old.dot != dot || old.pulse != pulse || old.startBearing != startBearing || old.startLabel != startLabel;
}
