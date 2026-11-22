import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/i18n.dart';
import '../widgets/fields.dart';
import '../widgets/status.dart';
import '../widgets/ui.dart';

// Sign-up (form -> 6-digit code) and forgot password (e-mail -> code + new password -> done),
// as frontend/src/pages/Register.tsx and ForgotPassword.tsx.

String? passwordProblem(String pw, [String? confirm]) {
  if (pw.length < 8) return L('Au moins 8 caractères.', 'At least 8 characters.', 'على الأقل 8 حروف.');
  if (utf8.encode(pw).length > 72) return L('72 octets maximum.', '72 bytes maximum.', '72 بايت على الأكثر.');
  if (confirm != null && pw != confirm) {
    return L('Les deux mots de passe ne sont pas identiques.', 'The two passwords do not match.', 'كلمتين السر موش كيف كيف.');
  }
  return null;
}

/// Code sent by e-mail; in the local demo without SMTP the API returns it to show here.
class DevCodeNotice extends StatelessWidget {
  const DevCodeNotice({super.key, required this.sent});
  final CodeSent? sent;
  @override
  Widget build(BuildContext context) {
    final code = sent?.devCode;
    if (code == null) return const SizedBox.shrink();
    final tg = context.tg;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TgBanner(
        tone: BannerTone.info,
        title: L('Mode démo : pas de serveur email', 'Demo mode: no email server', 'مود ديمو: ما فماش سرفور إيميل'),
        child: Text.rich(TextSpan(children: [
          TextSpan(text: '${L('Ton code est', 'Your code is', 'الكود متاعك')} '),
          TextSpan(
            text: code,
            style: T.body(tg.ink).copyWith(fontWeight: FontWeight.w800, letterSpacing: 3),
          ),
        ])),
      ),
    );
  }
}

/// 6 digits, big and centred, always left to right.
class CodeField extends StatelessWidget {
  const CodeField({super.key, required this.label, required this.controller, required this.onChanged});
  final String label;
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: T.small(tg.body).copyWith(fontSize: 14, fontWeight: FontWeight.w600)),
      const SizedBox(height: 8),
      TextField(
        controller: controller,
        keyboardType: TextInputType.number,
        autofillHints: const [AutofillHints.oneTimeCode],
        inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
        textAlign: TextAlign.center,
        textDirection: TextDirection.ltr,
        onChanged: onChanged,
        style: T.h1(tg.ink).copyWith(letterSpacing: 8),
        decoration: const InputDecoration(hintText: '123456', constraints: BoxConstraints(minHeight: 56)),
      ),
    ]);
  }
}

class _Footer extends StatelessWidget {
  const _Footer({required this.question, required this.link, required this.onTap});
  final String? question;
  final String link;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Wrap(crossAxisAlignment: WrapCrossAlignment.center, alignment: WrapAlignment.center, children: [
        if (question != null) ...[
          Text(question!, style: T.small(context.tg.mute).copyWith(fontSize: 14)),
          const SizedBox(width: 4),
        ],
        TextLink(link, bold: true, onTap: onTap),
      ]);
}

Widget _errorBanner(String? e) =>
    e == null ? const SizedBox.shrink() : Padding(padding: const EdgeInsets.only(bottom: 16), child: TgBanner(tone: BannerTone.broken, child: Text(e)));

// ---- Sign-up ---------------------------------------------------------------------------

class RegisterScreen extends StatefulWidget {
  /// [verifyEmail]: coming from the login with an unverified account, go straight to the code.
  const RegisterScreen({super.key, this.verifyEmail});
  final String? verifyEmail;
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  final _code = TextEditingController();
  bool _codeStep = false, _touched = false, _busy = false;
  CodeSent? _sent;
  String? _error;

  @override
  void initState() {
    super.initState();
    final v = widget.verifyEmail;
    if (v != null) {
      _codeStep = true;
      _email.text = v;
      // A fresh code for the unverified account; "Renvoyer" is there if this fails.
      WidgetsBinding.instance.addPostFrameCallback((_) => _resend(silent: true));
    }
  }

  @override
  void dispose() {
    for (final c in [_name, _email, _password, _confirm, _code]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _run(Future<void> Function() f) async {
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await f();
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submitForm() async {
    setState(() => _touched = true);
    if (passwordProblem(_password.text, _confirm.text) != null || _name.text.trim().length < 2) return;
    final app = AppScope.read(context);
    await _run(() async {
      final sent = await app.api.register(
        fullName: _name.text.trim(),
        email: _email.text.trim(),
        password: _password.text,
        language: app.language.name,
      );
      setState(() {
        _sent = sent;
        _codeStep = true;
      });
    });
  }

  Future<void> _submitCode() async {
    final app = AppScope.read(context);
    final nav = Navigator.of(context);
    await _run(() async {
      final (token, user) = await app.api.verifyEmail(_email.text.trim(), _code.text.trim());
      app.acceptToken(token, user);
      nav.popUntil((r) => r.isFirst); // the gate shows the first-time setup
    });
  }

  Future<void> _resend({bool silent = false}) async {
    final app = AppScope.read(context);
    try {
      final sent = await app.api.resendCode(_email.text.trim());
      if (mounted) setState(() => _sent = sent);
    } catch (e) {
      if (!silent && mounted) setState(() => _error = '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final footer = _Footer(
      question: L('Déjà un compte ?', 'Already have an account?', 'عندك حساب؟'),
      link: L('Se connecter', 'Log in', 'ادخل'),
      onTap: () => Navigator.of(context).popUntil((r) => r.isFirst),
    );

    if (_codeStep) {
      final minutes = _sent?.expiresInMin ?? 30;
      return AuthShell(
        back: true,
        title: L('Vérifie ton e-mail', 'Check your email', 'ثبّت في الإيميل متاعك'),
        footer: footer,
        children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(padding: const EdgeInsets.only(top: 2), child: Icon(LucideIcons300.mailCheck, size: 20, color: tg.link)),
            const SizedBox(width: 12),
            Expanded(
              child: Text.rich(
                TextSpan(style: T.small(tg.body).copyWith(fontSize: 14), children: [
                  TextSpan(text: '${L('Un code à 6 chiffres a été envoyé à', 'A 6-digit code was sent to', 'بعثنا كود فيه 6 أرقام لـ')} '),
                  TextSpan(text: _email.text.trim(), style: const TextStyle(fontWeight: FontWeight.w700)),
                  TextSpan(
                      text: '. ${L('Il est valable $minutes minutes.', 'It is valid for $minutes minutes.', 'صالح لمدة $minutes دقيقة.')}'),
                ]),
              ),
            ),
          ]),
          const SizedBox(height: 18),
          DevCodeNotice(sent: _sent),
          CodeField(
            label: L('Code de vérification', 'Verification code', 'كود التثبيت'),
            controller: _code,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 18),
          _errorBanner(_error),
          Btn(
            _busy ? L('Vérification…', 'Checking…', 'قاعد يثبّت…') : L('Confirmer mon compte', 'Confirm my account', 'أكّد الحساب متاعي'),
            onPressed: _busy || _code.text.length != 6 ? null : _submitCode,
            expand: true,
            large: true,
          ),
          const SizedBox(height: 8),
          Btn(L('Renvoyer le code', 'Send the code again', 'عاود ابعث الكود'), kind: BtnKind.ghost, onPressed: _busy ? null : _resend),
        ],
      );
    }

    final pwError = _touched ? passwordProblem(_password.text, _confirm.text) : null;
    return AuthShell(
      back: true,
      title: L('Créer un compte', 'Create an account', 'اعمل حساب'),
      footer: footer,
      children: [
        AutofillGroup(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            TgField(
              label: L('Nom complet', 'Full name', 'الاسم الكامل'),
              controller: _name,
              autofill: const [AutofillHints.name],
              textInputAction: TextInputAction.next,
              error: _touched && _name.text.trim().length < 2 ? L('Indique ton nom.', 'Enter your name.', 'اكتب اسمك.') : null,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 16),
            TgField(
              label: L('E-mail', 'Email', 'الإيميل'),
              controller: _email,
              ltr: true,
              keyboardType: TextInputType.emailAddress,
              hint: 'salma@exemple.tn',
              autofill: const [AutofillHints.email],
              textInputAction: TextInputAction.next,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 16),
            TgField(
              label: L('Mot de passe', 'Password', 'كلمة السر'),
              controller: _password,
              password: true,
              autofill: const [AutofillHints.newPassword],
              help: L('8 caractères minimum.', '8 characters minimum.', '8 حروف على الأقل.'),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 16),
            TgField(
              label: L('Confirme le mot de passe', 'Confirm the password', 'عاود كلمة السر'),
              controller: _confirm,
              password: true,
              autofill: const [AutofillHints.newPassword],
              error: pwError,
              onChanged: (_) => setState(() {}),
            ),
          ]),
        ),
        const SizedBox(height: 18),
        _errorBanner(_error),
        Btn(
          _busy ? L('Création…', 'Creating…', 'قاعد يتعمل…') : L('Créer mon compte', 'Create my account', 'اعمل الحساب'),
          onPressed: _busy || _email.text.isEmpty || _password.text.isEmpty ? null : _submitForm,
          expand: true,
          large: true,
        ),
      ],
    );
  }
}

// ---- Forgot password -------------------------------------------------------------------

enum _ResetStep { email, reset, done }

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key, this.email});
  final String? email;
  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  late final _email = TextEditingController(text: widget.email ?? '');
  final _code = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  _ResetStep _step = _ResetStep.email;
  bool _touched = false, _busy = false;
  CodeSent? _sent;
  String? _error;

  @override
  void dispose() {
    for (final c in [_email, _code, _password, _confirm]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _run(Future<void> Function() f) async {
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await f();
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final api = AppScope.read(context).api;
    void backToLogin() => Navigator.of(context).popUntil((r) => r.isFirst);
    final footer = _Footer(question: null, link: L('Retour à la connexion', 'Back to log in', 'ارجع للدخول'), onTap: backToLogin);

    switch (_step) {
      case _ResetStep.done:
        return AuthShell(
          title: L('Mot de passe changé', 'Password changed', 'كلمة السر تبدّلت'),
          footer: footer,
          children: [
            Icon(LucideIcons300.circleCheck, size: 48, color: tg.success),
            const SizedBox(height: 16),
            Text(
              L('Ton nouveau mot de passe est enregistré. Les autres sessions ont été déconnectées.',
                  'Your new password is saved. Other sessions were logged out.', 'كلمة السر الجديدة تسجّلت. الجلسات الأخرى تسكّرت.'),
              textAlign: TextAlign.center,
              style: T.body(tg.body),
            ),
            const SizedBox(height: 20),
            Btn(L('Se connecter', 'Log in', 'ادخل'), onPressed: backToLogin, expand: true, large: true),
          ],
        );
      case _ResetStep.reset:
        final pwError = _touched ? passwordProblem(_password.text, _confirm.text) : null;
        return AuthShell(
          back: true,
          title: L('Choisis un nouveau mot de passe', 'Choose a new password', 'اختار كلمة سر جديدة'),
          footer: footer,
          children: [
            Text(
              L('Si un compte existe pour cette adresse, un code à 6 chiffres vient d\'y être envoyé.',
                  'If an account exists for this address, a 6-digit code was just sent to it.', 'كان فما حساب بالإيميل هذا، بعثنالو كود فيه 6 أرقام.'),
              style: T.small(tg.body).copyWith(fontSize: 14),
            ),
            const SizedBox(height: 16),
            DevCodeNotice(sent: _sent),
            CodeField(label: L('Code reçu', 'Code received', 'الكود اللي وصلك'), controller: _code, onChanged: (_) => setState(() {})),
            const SizedBox(height: 16),
            TgField(
              label: L('Nouveau mot de passe', 'New password', 'كلمة السر الجديدة'),
              controller: _password,
              password: true,
              autofill: const [AutofillHints.newPassword],
              help: L('8 caractères minimum.', '8 characters minimum.', '8 حروف على الأقل.'),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 16),
            TgField(
              label: L('Confirme le mot de passe', 'Confirm the password', 'عاود كلمة السر'),
              controller: _confirm,
              password: true,
              error: pwError,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 18),
            _errorBanner(_error),
            Btn(
              L('Enregistrer', 'Save', 'سجّل'),
              onPressed: _busy || _code.text.length != 6 || _password.text.isEmpty
                  ? null
                  : () {
                      setState(() => _touched = true);
                      if (passwordProblem(_password.text, _confirm.text) != null) return;
                      _run(() async {
                        await api.resetPassword(_email.text.trim(), _code.text, _password.text);
                        setState(() => _step = _ResetStep.done);
                      });
                    },
              expand: true,
              large: true,
            ),
          ],
        );
      case _ResetStep.email:
        return AuthShell(
          back: true,
          title: L('Mot de passe oublié', 'Forgot password', 'نسيت كلمة السر'),
          footer: footer,
          children: [
            Text(
              L('Indique l\'adresse de ton compte : on t\'envoie un code pour choisir un nouveau mot de passe.',
                  'Enter your account\'s email: we send you a code to choose a new password.',
                  'اكتب الإيميل متاع الحساب: نبعثولك كود باش تختار كلمة سر جديدة.'),
              style: T.small(tg.body).copyWith(fontSize: 14),
            ),
            const SizedBox(height: 16),
            TgField(
              label: L('E-mail', 'Email', 'الإيميل'),
              controller: _email,
              ltr: true,
              keyboardType: TextInputType.emailAddress,
              autofill: const [AutofillHints.email],
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 18),
            _errorBanner(_error),
            Btn(
              L('Recevoir un code', 'Get a code', 'ابعثلي كود'),
              onPressed: _busy || _email.text.trim().isEmpty
                  ? null
                  : () => _run(() async {
                        final sent = await api.forgotPassword(_email.text.trim());
                        setState(() {
                          _sent = sent;
                          _step = _ResetStep.reset;
                        });
                      }),
              expand: true,
              large: true,
            ),
          ],
        );
    }
  }
}
