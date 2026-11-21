// Tranche Guard graphic charter V1: Sicily palette, type scale, components radii.

import 'package:material_ui/material_ui.dart';

/// Semantic colour tokens, light and dark (charter board 03).
@immutable
class TG extends ThemeExtension<TG> {
  const TG({
    required this.canvas,
    required this.surface,
    required this.sunken,
    required this.hairline,
    required this.control,
    required this.mute,
    required this.body,
    required this.ink,
    required this.primary,
    required this.primaryHover,
    required this.primarySoft,
    required this.onPrimary,
    required this.elec,
    required this.elecStroke,
    required this.elecInk,
    required this.elecSoft,
    required this.water,
    required this.waterInk,
    required this.waterSoft,
    required this.harissa,
    required this.harissaSoft,
    required this.harissaLine,
    required this.grenade,
    required this.grenadeSoft,
    required this.grenadeLine,
    required this.isDark,
  });

  // Neutrals, tinted toward the palette navy
  final Color canvas, surface, sunken, hairline, control, mute, body, ink;
  // Action · brand: Bahr, the only colour you can click
  final Color primary, primaryHover, primarySoft, onPrimary;
  // Electricity: Chams fill, stroke and ink for lines and text, Sable soft
  final Color elec, elecStroke, elecInk, elecSoft;
  // Water: Ciel fill only, ink for lines, icons and text
  final Color water, waterInk, waterSoft;
  // Status, outside the palette on purpose
  final Color harissa, harissaSoft, harissaLine; // heads-up: a tranche is near or crossed
  final Color grenade, grenadeSoft, grenadeLine; // broken: leaks, faults, errors
  final bool isDark;

  static const bahr = Color(0xFF1D59BB);
  static const chams = Color(0xFFFEBD19);
  static const ciel = Color(0xFF76B9FF);
  static const navy = Color(0xFF0D171F);

  static const light = TG(
    canvas: Color(0xFFF5F7FA),
    surface: Color(0xFFFFFFFF),
    sunken: Color(0xFFECF0F5),
    hairline: Color(0xFFDDE3EA),
    control: Color(0xFF7C8796),
    mute: Color(0xFF5A6576),
    body: Color(0xFF354150),
    ink: Color(0xFF0D171F),
    primary: Color(0xFF1D59BB),
    primaryHover: Color(0xFF174A9E),
    primarySoft: Color(0xFFE3ECF8),
    onPrimary: Color(0xFFFFFFFF),
    elec: Color(0xFFFEBD19),
    elecStroke: Color(0xFFA87000),
    elecInk: Color(0xFF7F5600),
    elecSoft: Color(0xFFFEF3B3),
    water: Color(0xFF76B9FF),
    waterInk: Color(0xFF2B6FC2),
    waterSoft: Color(0xFFE3F0FF),
    harissa: Color(0xFFC2401B),
    harissaSoft: Color(0xFFFBE5DC),
    harissaLine: Color(0xFFF0BFAE),
    grenade: Color(0xFFA3183F),
    grenadeSoft: Color(0xFFF9E0E7),
    grenadeLine: Color(0xFFEDB8C6),
    isDark: false,
  );

  // Dark theme: the palette's own navy, Ciel takes over actions.
  static const dark = TG(
    canvas: Color(0xFF0D171F),
    surface: Color(0xFF13212C),
    sunken: Color(0xFF1B2B38),
    hairline: Color(0xFF263848),
    control: Color(0xFF6F7E8F),
    mute: Color(0xFF95A3B3),
    body: Color(0xFFC4CFDB),
    ink: Color(0xFFEAF0F6),
    primary: Color(0xFF76B9FF),
    primaryHover: Color(0xFF9CCBFF),
    primarySoft: Color(0xFF1B2B38),
    onPrimary: Color(0xFF0D171F),
    elec: Color(0xFFFEBD19),
    elecStroke: Color(0xFFFEBD19),
    elecInk: Color(0xFFFEBD19),
    elecSoft: Color(0xFF34372A),
    water: Color(0xFF76B9FF),
    waterInk: Color(0xFF76B9FF),
    waterSoft: Color(0xFF22384C),
    harissa: Color(0xFFFF8A63),
    harissaSoft: Color(0xFF2A2B31),
    harissaLine: Color(0xFF6B3B2C),
    grenade: Color(0xFFF27A98),
    grenadeSoft: Color(0xFF292A37),
    grenadeLine: Color(0xFF6A2E42),
    isDark: true,
  );

  @override
  TG copyWith() => this;

  @override
  TG lerp(ThemeExtension<TG>? other, double t) => (other is TG && t >= 0.5) ? other : this;
}

extension TGContext on BuildContext {
  TG get tg => Theme.of(this).extension<TG>()!;
}

/// Radius 10 for controls, 14 for cards. Every tap target is at least 44 px.
const double kRadiusCtl = 10;
const double kRadiusCard = 14;
const double kTap = 44;
const double kGutter = 16;

const _tnum = [FontFeature.tabularFigures()];

/// Grotesk counts, Inter explains, Mono measures (charter board 04).
class T {
  static const grotesk = 'SpaceGrotesk';
  static const inter = 'Inter';
  static const mono = 'JetBrainsMono';

  /// hero · Grotesk 48/48 600 on mobile
  static TextStyle hero(Color c) => TextStyle(
        fontFamily: grotesk,
        fontWeight: FontWeight.w600,
        fontSize: 48,
        height: 1.0,
        letterSpacing: -2,
        color: c,
        fontFeatures: _tnum,
      );

  /// display · Grotesk 32/38 600 on mobile (40/46 on desktop)
  static TextStyle display(Color c) => TextStyle(
        fontFamily: grotesk,
        fontWeight: FontWeight.w600,
        fontSize: 32,
        height: 38 / 32,
        letterSpacing: -1,
        color: c,
      );

  /// h1 · Grotesk 28/34 600
  static TextStyle h1(Color c) => TextStyle(
        fontFamily: grotesk,
        fontWeight: FontWeight.w600,
        fontSize: 26,
        height: 32 / 26,
        letterSpacing: -0.5,
        color: c,
        fontFeatures: _tnum,
      );

  /// metric · Grotesk for live values (1 380 W)
  static TextStyle metric(Color c) => TextStyle(
        fontFamily: grotesk,
        fontWeight: FontWeight.w600,
        fontSize: 28,
        height: 34 / 28,
        letterSpacing: -1,
        color: c,
        fontFeatures: _tnum,
      );

  /// h2 · Inter 20/28 600
  static TextStyle h2(Color c) =>
      TextStyle(fontFamily: inter, fontWeight: FontWeight.w600, fontSize: 20, height: 28 / 20, color: c);

  /// h3 · Inter 16/24 600
  static TextStyle h3(Color c) =>
      TextStyle(fontFamily: inter, fontWeight: FontWeight.w600, fontSize: 16, height: 24 / 16, color: c);

  /// body · Inter 16/24 400
  static TextStyle body(Color c) =>
      TextStyle(fontFamily: inter, fontWeight: FontWeight.w400, fontSize: 16, height: 24 / 16, color: c);

  /// small · Inter 14/20 400
  static TextStyle small(Color c) =>
      TextStyle(fontFamily: inter, fontWeight: FontWeight.w400, fontSize: 14, height: 20 / 14, color: c);

  /// label · Mono 12/16 500 caps +0.08 em (write the text in capitals)
  static TextStyle label(Color c) => TextStyle(
        fontFamily: mono,
        fontWeight: FontWeight.w500,
        fontSize: 12,
        height: 16 / 12,
        letterSpacing: 0.96,
        color: c,
      );

  /// data · Mono 14/20 500 tnum
  static TextStyle data(Color c) => TextStyle(
        fontFamily: mono,
        fontWeight: FontWeight.w500,
        fontSize: 14,
        height: 20 / 14,
        color: c,
        fontFeatures: _tnum,
      );

  /// Axis text: Mono 11
  static TextStyle axis(Color c) =>
      TextStyle(fontFamily: mono, fontWeight: FontWeight.w400, fontSize: 11, color: c, fontFeatures: _tnum);
}

ThemeData buildTheme(TG tg) {
  final scheme = ColorScheme(
    brightness: tg.isDark ? Brightness.dark : Brightness.light,
    primary: tg.primary,
    onPrimary: tg.onPrimary,
    secondary: tg.primary,
    onSecondary: tg.onPrimary,
    error: tg.grenade,
    onError: tg.surface,
    surface: tg.surface,
    onSurface: tg.ink,
  );
  final ctlBorder = OutlineInputBorder(
    borderRadius: BorderRadius.circular(kRadiusCtl),
    borderSide: BorderSide(color: tg.control.withValues(alpha: 0.6)),
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: tg.canvas,
    canvasColor: tg.canvas,
    fontFamily: T.inter,
    extensions: [tg],
    splashFactory: InkSparkle.splashFactory,
    dividerTheme: DividerThemeData(color: tg.hairline, thickness: 1, space: 1),
    textSelectionTheme: TextSelectionThemeData(cursorColor: tg.primary, selectionColor: tg.primarySoft),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: tg.surface,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      hintStyle: T.body(tg.control),
      border: ctlBorder,
      enabledBorder: ctlBorder,
      focusedBorder: ctlBorder.copyWith(borderSide: BorderSide(color: tg.primary, width: 2)),
      errorBorder: ctlBorder.copyWith(borderSide: BorderSide(color: tg.grenade)),
      focusedErrorBorder: ctlBorder.copyWith(borderSide: BorderSide(color: tg.grenade, width: 2)),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: tg.ink,
      contentTextStyle: T.small(tg.canvas),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(kRadiusCtl)),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: tg.primary),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {TargetPlatform.android: FadeForwardsPageTransitionsBuilder()},
    ),
  );
}
