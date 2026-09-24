// The app's look: the same palette as the web app (light and dark), exposed as
// a theme extension so every widget reads its colours from `context.c`.
import 'package:flutter/material.dart';

@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.bg,
    required this.surface,
    required this.surface2,
    required this.text,
    required this.muted,
    required this.border,
    required this.accent,
    required this.accentStrong,
    required this.accentInk,
    required this.accentSoft,
    required this.gold,
    required this.goldSoft,
    required this.kaaba,
    required this.warnBg,
    required this.warnInk,
    required this.warnLine,
    required this.infoBg,
    required this.infoInk,
    required this.infoLine,
    required this.errBg,
    required this.errInk,
    required this.errLine,
    required this.okBg,
    required this.okInk,
    required this.okLine,
    required this.green,
  });

  final Color bg, surface, surface2, text, muted, border;
  final Color accent, accentStrong, accentInk, accentSoft;
  final Color gold, goldSoft, kaaba;
  final Color warnBg, warnInk, warnLine;
  final Color infoBg, infoInk, infoLine;
  final Color errBg, errInk, errLine;
  final Color okBg, okInk, okLine;
  final Color green;

  static const light = AppColors(
    bg: Color(0xFFF5F3EE),
    surface: Color(0xFFFFFFFF),
    surface2: Color(0xFFEFECE4),
    text: Color(0xFF17201B),
    muted: Color(0xFF5B655F),
    border: Color(0xFFDAD5C9),
    accent: Color(0xFF0E6A44),
    accentStrong: Color(0xFF0A5536),
    accentInk: Color(0xFFFFFFFF),
    accentSoft: Color(0xFFE2F1E9),
    gold: Color(0xFFA9812F),
    goldSoft: Color(0xFFF6EEDB),
    kaaba: Color(0xFF161616),
    warnBg: Color(0xFFFFF3DC),
    warnInk: Color(0xFF6E4700),
    warnLine: Color(0xFFEEC572),
    infoBg: Color(0xFFE9F1FA),
    infoInk: Color(0xFF1C4670),
    infoLine: Color(0xFFB9D0EA),
    errBg: Color(0xFFFDEAEA),
    errInk: Color(0xFF861C1C),
    errLine: Color(0xFFF0B4B4),
    okBg: Color(0xFFE3F4EA),
    okInk: Color(0xFF0D5A37),
    okLine: Color(0xFFA9DCC0),
    green: Color(0xFF1C9B53),
  );

  static const dark = AppColors(
    bg: Color(0xFF0E1311),
    surface: Color(0xFF161D1A),
    surface2: Color(0xFF1D2622),
    text: Color(0xFFE9EEEB),
    muted: Color(0xFF9AA6A0),
    border: Color(0xFF2B3531),
    accent: Color(0xFF34B27A),
    accentStrong: Color(0xFF46C48B),
    accentInk: Color(0xFF06140D),
    accentSoft: Color(0xFF173327),
    gold: Color(0xFFD6B061),
    goldSoft: Color(0xFF2C2616),
    kaaba: Color(0xFF050505),
    warnBg: Color(0xFF2F2410),
    warnInk: Color(0xFFF3CF87),
    warnLine: Color(0xFF5D4718),
    infoBg: Color(0xFF132232),
    infoInk: Color(0xFFA9CBEF),
    infoLine: Color(0xFF23405F),
    errBg: Color(0xFF341515),
    errInk: Color(0xFFF4B0B0),
    errLine: Color(0xFF5E2626),
    okBg: Color(0xFF12291D),
    okInk: Color(0xFF9FE0BB),
    okLine: Color(0xFF1F4A33),
    green: Color(0xFF3CC47A),
  );

  @override
  AppColors copyWith() => this;

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) => t < 0.5 ? this : (other as AppColors? ?? this);
}

extension AppColorsX on BuildContext {
  AppColors get c => Theme.of(this).extension<AppColors>()!;
}

const double kRadius = 16;
const double kPageMaxWidth = 560;

ThemeData buildTheme(Brightness brightness) {
  final c = brightness == Brightness.dark ? AppColors.dark : AppColors.light;
  final scheme = ColorScheme.fromSeed(seedColor: c.accent, brightness: brightness).copyWith(
    primary: c.accent,
    onPrimary: c.accentInk,
    surface: c.surface,
    onSurface: c.text,
    outline: c.border,
    error: c.errInk,
  );
  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: c.bg,
    extensions: [c],
    dividerColor: c.border,
    appBarTheme: AppBarTheme(
      backgroundColor: c.accent,
      foregroundColor: c.accentInk,
      elevation: 0,
      scrolledUnderElevation: 0,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: c.surface,
      indicatorColor: c.accentSoft,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(fontSize: 11.5, fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500, color: states.contains(WidgetState.selected) ? c.accent : c.muted),
      ),
    ),
    textTheme: Typography.material2021(platform: TargetPlatform.android).black.apply(bodyColor: c.text, displayColor: c.text),
  );
}
