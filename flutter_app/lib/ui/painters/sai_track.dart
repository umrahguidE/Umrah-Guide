// Vertical Safa (top) to Marwah (bottom) track with the green-marker section.
// Port of saiTrack in src/ui/components.js.
import 'package:flutter/material.dart';

import '../../engine/tracking.dart';
import '../theme.dart';
import 'paint_utils.dart';

const double _x = 60;
const double _top = 36;
const double _bottom = 264;
const double _len = _bottom - _top;
double _y(double k) => _top + k * _len;

class SaiTrack extends StatefulWidget {
  const SaiTrack({super.key, required this.towardsMarwah, required this.safaLabel, required this.marwahLabel, required this.greenLabel, this.fromSafa, required this.semanticsLabel});
  final bool towardsMarwah;
  final String safaLabel;
  final String marwahLabel;
  final String greenLabel;

  /// 0..1 from Safa, or null when there is no live reading.
  final double? fromSafa;
  final String semanticsLabel;

  @override
  State<SaiTrack> createState() => _SaiTrackState();
}

class _SaiTrackState extends State<SaiTrack> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800))..repeat();
  double _last = 0;

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final reduce = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    final k = widget.fromSafa?.clamp(0.0, 1.0);
    if (k != null) _last = k;
    return Semantics(
      label: widget.semanticsLabel,
      image: true,
      child: AspectRatio(
        aspectRatio: 180 / 300,
        child: TweenAnimationBuilder<double>(
          tween: Tween<double>(end: _last),
          duration: const Duration(milliseconds: 600),
          curve: Curves.easeOut,
          builder: (context, dot, _) => AnimatedBuilder(
            animation: _pulse,
            builder: (context, _) => CustomPaint(
              painter: _TrackPainter(
                colors: c,
                down: widget.towardsMarwah,
                safaLabel: widget.safaLabel,
                marwahLabel: widget.marwahLabel,
                greenLabel: widget.greenLabel,
                dot: k == null ? null : dot,
                pulse: reduce ? 0.3 : _pulse.value,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TrackPainter extends CustomPainter {
  _TrackPainter({required this.colors, required this.down, required this.safaLabel, required this.marwahLabel, required this.greenLabel, required this.dot, required this.pulse});
  final AppColors colors;
  final bool down;
  final String safaLabel;
  final String marwahLabel;
  final String greenLabel;
  final double? dot;
  final double pulse;

  @override
  void paint(Canvas canvas, Size size) {
    final c = colors;
    canvas.save();
    canvas.scale(size.width / 180, size.height / 300);
    final g0 = haramGeo.greenZone[0];
    final g1 = haramGeo.greenZone[1];

    // green-marker zone
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(_x - 15, _y(g0), 30, (g1 - g0) * _len), const Radius.circular(5)), fill(c.green.withValues(alpha: 0.3)));
    // the Mas'a
    canvas.drawLine(const Offset(_x, _top), const Offset(_x, _bottom), stroke(c.border, 8)..strokeCap = StrokeCap.round);

    // direction chevrons
    final s = down ? 1.0 : -1.0;
    for (final k in const [0.1, 0.5, 0.8]) {
      final path = Path()
        ..moveTo(_x - 7, _y(k) - 4 * s)
        ..lineTo(_x, _y(k) + 4 * s)
        ..lineTo(_x + 7, _y(k) - 4 * s);
      canvas.drawPath(path, stroke(c.muted, 2.5)..strokeCap = StrokeCap.round..strokeJoin = StrokeJoin.round);
    }

    // Safa (top) and Marwah (bottom)
    void hill(double y, bool from) {
      canvas.drawCircle(Offset(_x, y), 10, fill(from ? c.surface : c.accent));
      canvas.drawCircle(Offset(_x, y), 10, stroke(c.accent, 3));
    }

    hill(_top, down);
    hill(_bottom, !down);
    drawLabel(canvas, safaLabel, const Offset(_x + 20, _top + 5), color: c.text, size: 13);
    drawLabel(canvas, marwahLabel, const Offset(_x + 20, _bottom + 5), color: c.text, size: 13);
    drawLabel(canvas, greenLabel, Offset(_x + 22, _y((g0 + g1) / 2) + 4), color: c.green, size: 11, weight: FontWeight.w700);

    final d = dot;
    if (d != null) {
      final at = Offset(_x, _y(d));
      canvas.drawCircle(at, 8 + 14 * pulse, fill(c.gold.withValues(alpha: 0.4 * (1 - pulse))));
      canvas.drawCircle(at, 8, fill(c.gold));
      canvas.drawCircle(at, 8, stroke(c.surface, 3));
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_TrackPainter old) => old.colors != colors || old.dot != dot || old.pulse != pulse || old.down != down || old.safaLabel != safaLabel;
}

