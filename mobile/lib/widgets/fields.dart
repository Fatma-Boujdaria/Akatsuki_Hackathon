import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../state/app_state.dart';
import '../theme.dart';
import '../util/i18n.dart';
import 'logo.dart';

// Fields of the design (frontend/src/components/Field.tsx): label above, 52 px control,
// 14 px corners, help or error below.

class TgField extends StatefulWidget {
  const TgField({
    super.key,
    required this.label,
    required this.controller,
    this.hint,
    this.help,
    this.error,
    this.suffixText,
    this.keyboardType,
    this.password = false,
    this.ltr = false,
    this.autofill,
    this.onChanged,
    this.onSubmitted,
    this.textInputAction,
    this.maxLines = 1,
    this.maxLength,
    this.enabled = true,
  });

  final String label;
  final TextEditingController controller;
  final String? hint, help, error, suffixText;
  final TextInputType? keyboardType;

  /// Password with a show / hide button.
  final bool password;

  /// Always left to right (e-mail, server address, codes), also in Arabic.
  final bool ltr;
  final List<String>? autofill;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final TextInputAction? textInputAction;
  final int maxLines;
  final int? maxLength;
  final bool enabled;

  @override
  State<TgField> createState() => _TgFieldState();
}

class _TgFieldState extends State<TgField> {
  bool _shown = false;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final err = widget.error;
    Widget? suffix;
    if (widget.password) {
      suffix = IconButton(
        tooltip: _shown
            ? L('Masquer le mot de passe', 'Hide password', 'خبّي كلمة السر')
            : L('Afficher le mot de passe', 'Show password', 'ورّي كلمة السر'),
        icon: Icon(_shown ? LucideIcons300.eyeOff : LucideIcons300.eye, size: 18, color: tg.mute),
        onPressed: () => setState(() => _shown = !_shown),
      );
    } else if (widget.suffixText != null) {
      suffix = Padding(
        padding: const EdgeInsetsDirectional.only(end: 14),
        child: Text(widget.suffixText!, style: T.small(tg.mute).copyWith(fontWeight: FontWeight.w600)),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label, style: T.small(tg.body).copyWith(fontSize: 14, fontWeight: FontWeight.w600, height: 20 / 14)),
        const SizedBox(height: 8),
        TextField(
          controller: widget.controller,
          keyboardType: widget.keyboardType,
          obscureText: widget.password && !_shown,
          autocorrect: false,
          enableSuggestions: !widget.password,
          autofillHints: widget.autofill,
          textInputAction: widget.textInputAction,
          onChanged: widget.onChanged,
          onSubmitted: widget.onSubmitted,
          maxLines: widget.password ? 1 : widget.maxLines,
          maxLength: widget.maxLength,
          enabled: widget.enabled,
          textDirection: widget.ltr ? TextDirection.ltr : null,
          style: T.body(tg.ink).copyWith(fontWeight: FontWeight.w500),
          decoration: InputDecoration(
            hintText: widget.hint,
            hintTextDirection: widget.ltr ? TextDirection.ltr : null,
            constraints: widget.maxLines > 1 ? null : const BoxConstraints(minHeight: 52),
            suffixIcon: suffix,
            suffixIconConstraints: const BoxConstraints(minWidth: 44, minHeight: 44),
            errorText: err == null ? null : '',
            errorStyle: const TextStyle(height: 0, fontSize: 0),
            counterText: '',
          ),
        ),
        if (err != null) ...[
          const SizedBox(height: 6),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(padding: const EdgeInsets.only(top: 2), child: Icon(LucideIcons300.circleAlert, size: 16, color: tg.grenade)),
            const SizedBox(width: 6),
            Expanded(child: Text(err, style: T.small(tg.grenade).copyWith(fontSize: 14))),
          ]),
        ] else if (widget.help != null) ...[
          const SizedBox(height: 6),
          Text(widget.help!, style: T.small(tg.mute).copyWith(fontSize: 14, fontWeight: FontWeight.w400)),
        ],
      ],
    );
  }
}

/// Checkbox with its label on the same line (44 px tall).
class CheckboxField extends StatelessWidget {
  const CheckboxField({super.key, required this.label, required this.value, required this.onChanged, this.help});
  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;
  final String? help;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      InkWell(
        onTap: () => onChanged(!value),
        borderRadius: BorderRadius.circular(8),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: kTap),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            SizedBox.square(
              dimension: 24,
              child: Checkbox(
                value: value,
                onChanged: (v) => onChanged(v ?? false),
                activeColor: tg.primary,
                checkColor: tg.onPrimary,
                side: BorderSide(color: tg.control, width: 1.5),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5)),
              ),
            ),
            const SizedBox(width: 10),
            Flexible(child: Text(label, style: T.small(tg.body).copyWith(fontSize: 14, fontWeight: FontWeight.w600))),
          ]),
        ),
      ),
      if (help != null) Padding(padding: const EdgeInsetsDirectional.only(start: 34), child: Text(help!, style: T.small(tg.mute))),
    ]);
  }
}

/// FR · EN · تونسي in a pill track. Saved on the phone and, when logged in, in the account.
class LanguageSwitch extends StatelessWidget {
  const LanguageSwitch({super.key});
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final app = AppScope.of(context);
    return Semantics(
      label: L('Langue', 'Language', 'اللغة'),
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(color: tg.sunken, borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Padding(
            padding: const EdgeInsetsDirectional.only(start: 8, end: 4),
            child: Icon(LucideIcons300.languages, size: 16, color: tg.mute),
          ),
          for (final l in Lang.values)
            Semantics(
              selected: l == app.language,
              button: true,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => app.setLanguage(l),
                child: Container(
                  height: 32,
                  constraints: const BoxConstraints(minWidth: 44),
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: l == app.language ? tg.chipActive : Colors.transparent,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(l.short,
                      style: T.caption(l == app.language ? tg.onChipActive : tg.chip).copyWith(
                          fontSize: 12, fontWeight: l == app.language ? FontWeight.w700 : FontWeight.w600)),
                ),
              ),
            ),
        ]),
      ),
    );
  }
}

/// Login artboard: language switch, shield logo, wordmark, tagline, the form,
/// privacy note and footer at the bottom.
class AuthShell extends StatelessWidget {
  const AuthShell({super.key, required this.children, this.title, this.footer, this.back = false});
  final List<Widget> children;
  final String? title;
  final Widget? footer;
  final bool back;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, box) => SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(28, 16, 28, 24),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: box.maxHeight - 40),
              child: IntrinsicHeight(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(children: [
                      if (back)
                        IconButton(
                          tooltip: L('Retour', 'Back', 'رجوع'),
                          onPressed: () => Navigator.of(context).maybePop(),
                          icon: Icon(isRtl ? LucideIcons300.arrowRight : LucideIcons300.arrowLeft, color: tg.ink),
                        ),
                      const Spacer(),
                      const LanguageSwitch(),
                    ]),
                    const SizedBox(height: 24),
                    const Center(child: LogoMark(size: 88)),
                    const SizedBox(height: 14),
                    const Center(child: Wordmark(fontSize: 32)),
                    const SizedBox(height: 10),
                    Text(L('Ta facture, sans surprise', 'Your bill, no surprises', 'فاتورتك، بلا مفاجآت'),
                        textAlign: TextAlign.center, style: T.body(tg.mute)),
                    if (title != null) ...[
                      const SizedBox(height: 36),
                      Text(title!, textAlign: TextAlign.center, style: T.h2(tg.ink).copyWith(fontSize: 20)),
                      const SizedBox(height: 24),
                    ] else
                      const SizedBox(height: 44),
                    ...children,
                    const Spacer(),
                    const SizedBox(height: 36),
                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(LucideIcons300.lock, size: 16, color: tg.mute),
                      const SizedBox(width: 10),
                      Flexible(
                        child: Text(
                          L('Tes données restent privées et chiffrées', 'Your data stays private and encrypted',
                              'المعطيات متاعك تبقى خاصة ومشفّرة'),
                          style: T.small(tg.mute),
                        ),
                      ),
                    ]),
                    if (footer != null) ...[const SizedBox(height: 12), Center(child: footer!)],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
