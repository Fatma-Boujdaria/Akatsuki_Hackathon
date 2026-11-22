// Three languages, like the web app (frontend/src/lib/i18n.tsx): French (default),
// English and Tunisian Arabic (derja, Arabic script, right to left). Texts are written
// where they are used, so a screen and its three versions are read together:
//
//     L('Tableau de bord', 'Dashboard', 'لوحة القيادة')
//
// Changing the language rebuilds the whole app (MaterialApp is keyed by the language).

enum Lang {
  fr('Français', 'FR'),
  en('English', 'EN'),
  ar('تونسي', 'تونسي');

  const Lang(this.label, this.short);
  final String label;
  final String short;

  static Lang parse(String? code) => switch (code) {
        'en' => Lang.en,
        'ar' => Lang.ar,
        _ => Lang.fr,
      };
}

Lang _current = Lang.fr;

/// Current language, usable outside widgets (formatters, alert texts).
Lang get lang => _current;
bool get isRtl => _current == Lang.ar;

/// Set by AppState when the user picks a language (and at start-up).
void setCurrentLang(Lang l) => _current = l;

/// Pick the text of the current language. Arabic falls back to French when missing.
// ignore: non_constant_identifier_names
String L(String fr, String en, [String? ar]) => switch (_current) {
      Lang.en => en,
      Lang.ar => ar ?? fr,
      Lang.fr => fr,
    };

/// Same with any value: pick(fr: 1, en: 2, ar: 3).
T pick<T>({required T fr, required T en, T? ar}) => switch (_current) {
      Lang.en => en,
      Lang.ar => ar ?? fr,
      Lang.fr => fr,
    };
