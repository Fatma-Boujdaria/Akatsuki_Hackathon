// Cartheco design (DESIGN.md at the repo root, same tokens as frontend/src/index.css):
// "App Screens" design, Sicily palette, Plus Jakarta Sans, dark first with a light twin.

import 'package:material_ui/material_ui.dart';

import 'util/i18n.dart';

/// Semantic colour tokens, light and dark. Widgets use these names, never raw hex.
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
    required this.chip,
    required this.primary,
    required this.primaryHover,
    required this.primarySoft,
    required this.onPrimary,
    required this.link,
    required this.chipActive,
    required this.onChipActive,
    required this.navActive,
    required this.elec,
    required this.elecStroke,
    required this.elecInk,
    required this.elecSoft,
    required this.water,
    required this.waterInk,
    required this.waterSoft,
    required this.bar,
    required this.barTrack,
    required this.success,
    required this.successSoft,
    required this.harissa,
    required this.harissaSoft,
    required this.harissaLine,
    required this.harissaBody,
    required this.grenade,
    required this.grenadeSoft,
    required this.grenadeLine,
    required this.tile,
    required this.brandAccent,
    required this.isDark,
  });

  // Neutrals, tinted toward the palette navy
  final Color canvas, surface, sunken, hairline, control, mute, body, ink, chip;
  // Action: Bahr in light, Chams in dark
  final Color primary, primaryHover, primarySoft, onPrimary, link, chipActive, onChipActive, navActive;
  // Electricity: Chams fill, ink for text on light
  final Color elec, elecStroke, elecInk, elecSoft;
  // Water: Ciel fill, Bahr ink on light
  final Color water, waterInk, waterSoft;
  // Tranche bar
  final Color bar, barTrack;
  // Status
  final Color success, successSoft;
  final Color harissa, harissaSoft, harissaLine, harissaBody; // heads-up: a tranche is near or crossed
  final Color grenade, grenadeSoft, grenadeLine; // broken: leaks, faults, errors
  final Color tile; // icon tile behind a tip
  final Color brandAccent; // "Guard" in the wordmark
  final bool isDark;

  // Fixed brand colours (logo, avatar)
  static const bahr = Color(0xFF1D59BB);
  static const chams = Color(0xFFFEBD19);
  static const ciel = Color(0xFF76B9FF);
  static const sable = Color(0xFFFEF3B3);
  static const navy = Color(0xFF0D1820);

  static const light = TG(
    canvas: Color(0xFFEEF4FB),
    surface: Color(0xFFFFFFFF),
    sunken: Color(0xFFE4ECF5),
    hairline: Color(0xFFDCE6F0),
    control: Color(0xFF8496A8),
    mute: Color(0xFF4A5B6C),
    body: Color(0xFF24384C),
    ink: Color(0xFF0D1820),
    chip: Color(0xFF24384C),
    primary: Color(0xFF1D59BB),
    primaryHover: Color(0xFF174A9E),
    primarySoft: Color(0xFFDFEAFA),
    onPrimary: Color(0xFFFFFFFF),
    link: Color(0xFF1D59BB),
    chipActive: Color(0xFF1D59BB),
    onChipActive: Color(0xFFFFFFFF),
    navActive: Color(0xFF1D59BB),
    elec: Color(0xFFFEBD19),
    elecStroke: Color(0xFFA87000),
    elecInk: Color(0xFF8A5E00),
    elecSoft: Color(0xFFFEF3B3),
    water: Color(0xFF76B9FF),
    waterInk: Color(0xFF1D59BB),
    waterSoft: Color(0xFFE3F0FF),
    bar: Color(0xFF1D59BB),
    barTrack: Color(0xFFDCE6F0),
    success: Color(0xFF15803D),
    successSoft: Color(0xFFDCF5E7),
    harissa: Color(0xFFA15C00),
    harissaSoft: Color(0xFFFFF4D6),
    harissaLine: Color(0xFFFEBD19),
    harissaBody: Color(0xFF5C4400),
    grenade: Color(0xFFB42318),
    grenadeSoft: Color(0xFFFDE8E6),
    grenadeLine: Color(0xFFF5B5AE),
    tile: Color(0xFFE3F0FF),
    brandAccent: Color(0xFF8A5E00),
    isDark: false,
  );

  // Dark theme: the design's main artboard.
  static const dark = TG(
    canvas: Color(0xFF0D1820),
    surface: Color(0xFF16273A),
    sunken: Color(0xFF1B2F44),
    hairline: Color(0xFF24384C),
    control: Color(0xFF6F8397),
    mute: Color(0xFF9FB1C2),
    body: Color(0xFFD5E1EC),
    ink: Color(0xFFFFFFFF),
    chip: Color(0xFFD5E1EC),
    primary: Color(0xFFFEBD19),
    primaryHover: Color(0xFFFFCD4D),
    primarySoft: Color(0xFF2A2410),
    onPrimary: Color(0xFF0D1820),
    link: Color(0xFF76B9FF),
    chipActive: Color(0xFFFFFFFF),
    onChipActive: Color(0xFF0D1820),
    navActive: Color(0xFFFEBD19),
    elec: Color(0xFFFEBD19),
    elecStroke: Color(0xFFFEBD19),
    elecInk: Color(0xFFFEBD19),
    elecSoft: Color(0xFF2A2410),
    water: Color(0xFF76B9FF),
    waterInk: Color(0xFF76B9FF),
    waterSoft: Color(0xFF1D3B5E),
    bar: Color(0xFF76B9FF),
    barTrack: Color(0xFF24384C),
    success: Color(0xFF3DDC97),
    successSoft: Color(0xFF143327),
    harissa: Color(0xFFFEBD19),
    harissaSoft: Color(0xFF2A2410),
    harissaLine: Color(0xFFFEBD19),
    harissaBody: Color(0xFFE9DDB0),
    grenade: Color(0xFFFF9A8A),
    grenadeSoft: Color(0xFF3A1F22),
    grenadeLine: Color(0xFF6B3236),
    tile: Color(0xFF1D3B5E),
    brandAccent: Color(0xFFFEBD19),
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

/// Design radii: 20 cards, 14 inputs and small tiles, 12 chips inside cards.
/// Every tap target is at least 44 px.
const double kRadiusCtl = 14;
const double kRadiusCard = 20;
const double kRadiusChip = 12;
const double kTap = 44;
const double kGutter = 16;

const _tnum = [FontFeature.tabularFigures()];

/// Type scale of the design: Plus Jakarta Sans everywhere, heavy for numbers.
/// Arabic gets the system Arabic font with a little more line height.
class T {
  static const sans = 'PlusJakartaSans';
  // Older names kept so every screen reads the same family.
  static const grotesk = sans;
  static const inter = sans;
  static const mono = 'JetBrainsMono';

  static double _lh(double px, double size) => (px + (isRtl ? 3 : 0)) / size;

  static TextStyle _s(Color c, double size, double line, FontWeight w, {double ls = 0, bool tnum = false}) =>
      TextStyle(
        fontFamily: sans,
        fontWeight: w,
        fontSize: size,
        height: _lh(line, size),
        letterSpacing: ls,
        color: c,
        fontFeatures: tnum ? _tnum : null,
      );

  /// hero · 40/44 800
  static TextStyle hero(Color c) => _s(c, 40, 44, FontWeight.w800, ls: -1, tnum: true);

  /// display · 22/30 800
  static TextStyle display(Color c) => _s(c, 22, 30, FontWeight.w800, ls: -0.3);

  /// h1 · 22/28 800
  static TextStyle h1(Color c) => _s(c, 22, 28, FontWeight.w800, tnum: true);

  /// metric · 28/34 800 (live values: 1,24 kW)
  static TextStyle metric(Color c) => _s(c, 28, 34, FontWeight.w800, ls: -0.5, tnum: true);

  /// h2 · 18/26 800
  static TextStyle h2(Color c) => _s(c, 18, 26, FontWeight.w800);

  /// h3 · 15/22 700
  static TextStyle h3(Color c) => _s(c, 15, 22, FontWeight.w700);

  /// body · 15/23 400
  static TextStyle body(Color c) => _s(c, 15, 23, FontWeight.w400);

  /// small · 13/19 500
  static TextStyle small(Color c) => _s(c, 13, 19, FontWeight.w500);

  /// label · 13/18 700
  static TextStyle label(Color c) => _s(c, 13, 18, FontWeight.w700);

  /// data · 14/20 700 tnum
  static TextStyle data(Color c) => _s(c, 14, 20, FontWeight.w700, tnum: true);

  /// Axis text of charts: 11, tnum
  static TextStyle axis(Color c) => _s(c, 11, 14, FontWeight.w500, tnum: true);

  /// Tiny caption under a number (kWh ce mois): 11/14 500
  static TextStyle caption(Color c) => _s(c, 11, 14, FontWeight.w500);
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
    borderSide: BorderSide(color: tg.hairline),
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: tg.canvas,
    canvasColor: tg.canvas,
    fontFamily: T.sans,
    extensions: [tg],
    splashFactory: InkSparkle.splashFactory,
    dividerTheme: DividerThemeData(color: tg.hairline, thickness: 1, space: 1),
    textSelectionTheme: TextSelectionThemeData(cursorColor: tg.primary, selectionColor: tg.primarySoft),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: tg.isDark ? tg.sunken : tg.surface,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      hintStyle: T.body(tg.control),
      border: ctlBorder,
      enabledBorder: ctlBorder,
      focusedBorder: ctlBorder.copyWith(borderSide: BorderSide(color: tg.link, width: 2)),
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
