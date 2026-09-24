// Small building blocks used by every screen — the Flutter equivalents of the
// web app's cards, alerts, big buttons, chips and lists.
import 'package:flutter/material.dart';

import '../theme.dart';

class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.color, this.borderColor, this.borderWidth = 1});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? color;
  final Color? borderColor;
  final double borderWidth;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? c.surface,
        borderRadius: BorderRadius.circular(kRadius),
        border: Border.all(color: borderColor ?? c.border, width: borderWidth),
        boxShadow: const [BoxShadow(color: Color(0x0D000000), blurRadius: 16, offset: Offset(0, 4))],
      ),
      child: child,
    );
  }
}

enum AlertKind { info, warn, error, success, suggest }

class AlertBox extends StatelessWidget {
  const AlertBox({super.key, required this.kind, required this.child, this.center = false});
  final AlertKind kind;
  final Widget child;
  final bool center;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final (bg, ink, line) = switch (kind) {
      AlertKind.info => (c.infoBg, c.infoInk, c.infoLine),
      AlertKind.warn => (c.warnBg, c.warnInk, c.warnLine),
      AlertKind.error => (c.errBg, c.errInk, c.errLine),
      AlertKind.success => (c.okBg, c.okInk, c.okLine),
      AlertKind.suggest => (c.goldSoft, c.text, c.gold),
    };
    return Semantics(
      liveRegion: kind == AlertKind.error || kind == AlertKind.suggest,
      child: Container(
        width: double.infinity,
        padding: EdgeInsets.all(kind == AlertKind.suggest ? 16 : 12),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: line, width: kind == AlertKind.suggest ? 2 : 1),
        ),
        child: DefaultTextStyle.merge(
          style: TextStyle(color: ink, fontWeight: kind == AlertKind.success || kind == AlertKind.suggest ? FontWeight.w600 : null, height: 1.4),
          textAlign: center ? TextAlign.center : null,
          child: child,
        ),
      ),
    );
  }
}

/// The big call-to-action button. [ready] makes it glow, [final_] paints it gold.
class BigButton extends StatefulWidget {
  const BigButton({super.key, required this.label, required this.onPressed, this.primary = true, this.ready = false, this.gold = false});
  final String label;
  final VoidCallback? onPressed;
  final bool primary;
  final bool ready;
  final bool gold;

  @override
  State<BigButton> createState() => _BigButtonState();
}

class _BigButtonState extends State<BigButton> with SingleTickerProviderStateMixin {
  late final AnimationController _glow = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(BigButton old) {
    super.didUpdateWidget(old);
    _sync();
  }

  void _sync() {
    final reduce = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (widget.ready && !reduce) {
      if (!_glow.isAnimating) _glow.repeat();
    } else {
      _glow.stop();
      _glow.value = 0;
    }
  }

  @override
  void dispose() {
    _glow.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final bg = widget.gold ? c.gold : (widget.primary ? c.accent : c.surface);
    final fg = widget.gold ? Colors.white : (widget.primary ? c.accentInk : c.text);
    return AnimatedBuilder(
      animation: _glow,
      builder: (context, child) {
        final t = _glow.value;
        return Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            boxShadow: widget.ready ? [BoxShadow(color: c.gold.withValues(alpha: 0.55 * (1 - t)), spreadRadius: 16 * t, blurRadius: 0)] : null,
          ),
          child: child,
        );
      },
      child: SizedBox(
        width: double.infinity,
        height: 60,
        child: FilledButton(
          onPressed: widget.onPressed,
          style: FilledButton.styleFrom(
            backgroundColor: bg,
            foregroundColor: fg,
            disabledBackgroundColor: c.surface2,
            disabledForegroundColor: c.muted,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: widget.primary || widget.gold ? BorderSide.none : BorderSide(color: c.border)),
            textStyle: const TextStyle(fontSize: 17.6, fontWeight: FontWeight.w600),
          ),
          child: Text(widget.label, textAlign: TextAlign.center),
        ),
      ),
    );
  }
}

/// A smaller outlined button.
class SoftButton extends StatelessWidget {
  const SoftButton({super.key, required this.label, required this.onPressed, this.danger = false, this.primary = false, this.small = false});
  final String label;
  final VoidCallback? onPressed;
  final bool danger;
  final bool primary;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final fg = danger ? c.errInk : (primary ? c.accentInk : c.text);
    final bg = danger ? c.errBg : (primary ? c.accent : c.surface);
    return ConstrainedBox(
      constraints: BoxConstraints(minHeight: small ? 36 : 48),
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: bg,
          foregroundColor: fg,
          side: BorderSide(color: danger ? c.errLine : (primary ? c.accent : c.border)),
          padding: EdgeInsets.symmetric(horizontal: small ? 12 : 16, vertical: small ? 6 : 10),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: TextStyle(fontWeight: FontWeight.w600, fontSize: small ? 14 : 16),
        ),
        child: Text(label, textAlign: TextAlign.center),
      ),
    );
  }
}

class GhostButton extends StatelessWidget {
  const GhostButton({super.key, required this.label, required this.onPressed});
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => TextButton(
        onPressed: onPressed,
        style: TextButton.styleFrom(foregroundColor: context.c.accent, minimumSize: const Size(0, 48), textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
        child: Text(label, textAlign: TextAlign.center),
      );
}

class Eyebrow extends StatelessWidget {
  const Eyebrow(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Text(text.toUpperCase(), style: TextStyle(color: context.c.muted, fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.8));
}

class PageHeading extends StatelessWidget {
  const PageHeading(this.title, {super.key, this.lead});
  final String title;
  final String? lead;
  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 25.6, fontWeight: FontWeight.w800, height: 1.2)),
          if (lead != null) ...[const SizedBox(height: 6), Text(lead!, style: TextStyle(color: context.c.muted, fontSize: 16.5, height: 1.45))],
        ],
      );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text, style: const TextStyle(fontSize: 18.4, fontWeight: FontWeight.w800, height: 1.2)),
      );
}

class Muted extends StatelessWidget {
  const Muted(this.text, {super.key, this.small = false, this.center = false});
  final String text;
  final bool small;
  final bool center;
  @override
  Widget build(BuildContext context) => Text(text, textAlign: center ? TextAlign.center : null, style: TextStyle(color: context.c.muted, fontSize: small ? 13.6 : 15.5, height: 1.4));
}

/// A bulleted list of guidance points (already translated).
class PointsList extends StatelessWidget {
  const PointsList(this.items, {super.key});
  final List<String> items;
  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final p in items)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(padding: const EdgeInsets.only(top: 9, right: 10, left: 4), child: Container(width: 6, height: 6, decoration: BoxDecoration(color: context.c.accent, shape: BoxShape.circle))),
                Expanded(child: Text(p, style: const TextStyle(fontSize: 16, height: 1.45))),
              ],
            ),
          ),
      ],
    );
  }
}

class Chip2 extends StatelessWidget {
  const Chip2(this.label, {super.key, this.on = false, this.warn = false, this.ok = false, this.onTap});
  final String label;
  final bool on;
  final bool warn;
  final bool ok;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final bg = on ? c.accent : (warn ? c.warnBg : (ok ? c.accentSoft : c.surface2));
    final fg = on ? c.accentInk : (warn ? c.warnInk : (ok ? c.accent : c.text));
    final line = on ? c.accent : (warn ? c.warnLine : c.border);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999), border: Border.all(color: line)),
        child: Text(label, style: TextStyle(color: fg, fontSize: 12.8, fontWeight: FontWeight.w600)),
      ),
    );
  }
}

class ProgressBar extends StatelessWidget {
  const ProgressBar(this.fraction, {super.key, required this.semanticsLabel});
  final double fraction;
  final String semanticsLabel;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Semantics(
      label: semanticsLabel,
      value: '${(fraction * 100).round()}%',
      child: ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: LinearProgressIndicator(value: fraction.clamp(0.0, 1.0), minHeight: 10, backgroundColor: c.surface2, color: c.accent),
      ),
    );
  }
}

/// The 1..N counters under a Tawaf/Sa'i heading.
class RoundDots extends StatelessWidget {
  const RoundDots({super.key, required this.done, required this.current, required this.total, required this.semanticsLabel});
  final int done;
  final int current;
  final int total;
  final String semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Semantics(
      label: semanticsLabel,
      child: Wrap(
        alignment: WrapAlignment.center,
        spacing: 8,
        runSpacing: 8,
        children: [
          for (var n = 1; n <= total; n++)
            Container(
              width: 38,
              height: 38,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: n <= done ? c.accent : c.surface,
                border: Border.all(color: n <= done || n == current ? c.accent : c.border, width: n == current ? 2.5 : 1.5),
              ),
              child: Text(n <= done ? '✓' : '$n', style: TextStyle(fontWeight: FontWeight.w700, color: n <= done ? c.accentInk : c.text)),
            ),
        ],
      ),
    );
  }
}

/// A check row (checkbox with a bold label and a small help line).
class CheckRow extends StatelessWidget {
  const CheckRow({super.key, required this.label, this.help, required this.value, required this.onChanged});
  final String label;
  final String? help;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: () => onChanged(!value),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Checkbox(value: value, onChanged: (v) => onChanged(v ?? false), visualDensity: VisualDensity.comfortable),
              const SizedBox(width: 4),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                      if (help != null) Muted(help!, small: true),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      );
}

/// A foldable section (the web app's collapsible details block).
class FoldCard extends StatelessWidget {
  const FoldCard({super.key, required this.title, required this.child, this.initiallyOpen = false});
  final String title;
  final Widget child;
  final bool initiallyOpen;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(kRadius), border: Border.all(color: c.border)),
      clipBehavior: Clip.antiAlias,
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: initiallyOpen,
          title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          expandedCrossAxisAlignment: CrossAxisAlignment.start,
          children: [child],
        ),
      ),
    );
  }
}

/// A home/more grid tile.
class TileButton extends StatelessWidget {
  const TileButton({super.key, required this.icon, required this.title, this.subtitle, required this.onTap});
  final String icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Material(
      color: c.surface,
      borderRadius: BorderRadius.circular(kRadius),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(kRadius),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(kRadius), border: Border.all(color: c.border)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(icon, style: const TextStyle(fontSize: 26)),
              const SizedBox(height: 6),
              Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15.5)),
              if (subtitle != null && subtitle!.isNotEmpty) Muted(subtitle!, small: true),
            ],
          ),
        ),
      ),
    );
  }
}

/// Lays tiles out two per row.
class TileGrid extends StatelessWidget {
  const TileGrid(this.tiles, {super.key});
  final List<Widget> tiles;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, box) {
          final w = (box.maxWidth - 12) / 2;
          return Wrap(spacing: 12, runSpacing: 12, children: [for (final t in tiles) SizedBox(width: w, child: t)]);
        },
      );
}

/// Column with the app's standard vertical rhythm between children.
class Stack14 extends StatelessWidget {
  const Stack14(this.children, {super.key, this.gap = 14});
  final List<Widget> children;
  final double gap;

  @override
  Widget build(BuildContext context) {
    final items = children.where((w) => w is! SizedBox || (w.width != 0 || w.height != 0)).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < items.length; i++) ...[if (i > 0) SizedBox(height: gap), items[i]],
      ],
    );
  }
}
