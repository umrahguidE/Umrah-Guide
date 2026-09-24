// Tiny drawing helpers shared by the ring, track and map painters.
import 'package:flutter/material.dart';

Paint fill(Color color) => Paint()
  ..color = color
  ..style = PaintingStyle.fill;

Paint stroke(Color color, double width) => Paint()
  ..color = color
  ..style = PaintingStyle.stroke
  ..strokeWidth = width;

/// A dashed straight line.
void drawDashedLine(Canvas canvas, Offset a, Offset b, Paint paint, double dash, double gap) {
  drawDashedPath(canvas, Path()..moveTo(a.dx, a.dy)..lineTo(b.dx, b.dy), paint, dash, gap);
}

void drawDashedPath(Canvas canvas, Path path, Paint paint, double dash, double gap) {
  for (final metric in path.computeMetrics()) {
    var d = 0.0;
    while (d < metric.length) {
      final end = (d + dash).clamp(0.0, metric.length);
      canvas.drawPath(metric.extractPath(d, end), paint);
      d += dash + gap;
    }
  }
}

/// Draws [text] with its anchor at [at]. [align] left = the text starts at
/// [at], center = centred on it, right = ends at it; the baseline is placed
/// on [at].dy like an SVG text element.
void drawLabel(Canvas canvas, String text, Offset at, {required Color color, double size = 13, FontWeight weight = FontWeight.w800, TextAlign align = TextAlign.left, TextDirection direction = TextDirection.ltr}) {
  final tp = TextPainter(
    text: TextSpan(text: text, style: TextStyle(color: color, fontSize: size, fontWeight: weight)),
    textDirection: direction,
  )..layout();
  final dx = switch (align) {
    TextAlign.center => at.dx - tp.width / 2,
    TextAlign.right || TextAlign.end => at.dx - tp.width,
    _ => at.dx,
  };
  final baseline = tp.computeDistanceToActualBaseline(TextBaseline.alphabetic);
  tp.paint(canvas, Offset(dx, at.dy - baseline));
}
