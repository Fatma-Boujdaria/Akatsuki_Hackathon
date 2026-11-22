import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/api.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/i18n.dart';
import '../widgets/fields.dart';
import '../widgets/status.dart';
import '../widgets/ui.dart';
import 'auth_screens.dart';

/// "Connexion" artboard of the design. The server address (phone app only) sits in a
/// small row under the form, so the screen keeps the design's look.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _remember = true;
  bool _unverified = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final app = AppScope.read(context);
    setState(() {
      _busy = true;
      _error = null;
      _unverified = false;
    });
    try {
      await app.login(_email.text, _password.text, remember: _remember);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = '$e';
          _unverified = e is ApiException && e.code == 'email_not_verified';
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _push(Widget screen) {
    setState(() => _error = null);
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }

  Future<void> _editServer() async {
    final app = AppScope.read(context);
    final ctrl = TextEditingController(text: app.server);
    final saved = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(L('Adresse du serveur', 'Server address', 'عنوان السرفور')),
        content: TgField(
          label: L('Serveur', 'Server', 'السرفور'),
          controller: ctrl,
          ltr: true,
          keyboardType: TextInputType.url,
          hint: 'http://192.168.1.20:8000',
          help: L(
            'Émulateur : http://10.0.2.2:8000. Téléphone : l\'adresse Wi-Fi du PC qui fait tourner l\'API.',
            'Emulator: http://10.0.2.2:8000. Phone: the Wi-Fi address of the PC running the API.',
            'الإيموليتور: http://10.0.2.2:8000. التليفون: عنوان الواي فاي متاع البي سي اللي يخدّم الـAPI.',
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: Text(L('Annuler', 'Cancel', 'إلغاء'))),
          TextButton(onPressed: () => Navigator.pop(context, ctrl.text), child: Text(L('Enregistrer', 'Save', 'سجّل'))),
        ],
      ),
    );
    ctrl.dispose();
    if (saved != null && saved.trim().isNotEmpty) app.setServer(saved);
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final app = AppScope.of(context);
    final ready = _email.text.isNotEmpty && _password.text.isNotEmpty && !_busy;
    return AuthShell(
      footer: Column(children: [
        Wrap(crossAxisAlignment: WrapCrossAlignment.center, alignment: WrapAlignment.center, children: [
          Text(L('Pas encore de compte ?', 'No account yet?', 'ما عندكش حساب؟'), style: T.small(tg.mute).copyWith(fontSize: 14)),
          const SizedBox(width: 4),
          TextLink(L('Créer un compte', 'Create an account', 'اعمل حساب'), bold: true, onTap: () => _push(const RegisterScreen())),
        ]),
        InkWell(
          onTap: _editServer,
          borderRadius: BorderRadius.circular(8),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: kTap),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(LucideIcons300.server, size: 14, color: tg.control),
              const SizedBox(width: 6),
              Text(app.server, textDirection: TextDirection.ltr, style: T.caption(tg.control).copyWith(fontSize: 12)),
            ]),
          ),
        ),
      ]),
      children: [
        AutofillGroup(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
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
            const SizedBox(height: 18),
            TgField(
              label: L('Mot de passe', 'Password', 'كلمة السر'),
              controller: _password,
              password: true,
              autofill: const [AutofillHints.password],
              textInputAction: TextInputAction.done,
              onChanged: (_) => setState(() {}),
              onSubmitted: (_) => ready ? _submit() : null,
            ),
          ]),
        ),
        const SizedBox(height: 6),
        Wrap(alignment: WrapAlignment.spaceBetween, crossAxisAlignment: WrapCrossAlignment.center, children: [
          CheckboxField(
            label: L('Se souvenir de moi', 'Remember me', 'تفكّرني'),
            value: _remember,
            onChanged: (v) => setState(() => _remember = v),
          ),
          TextLink(
            L('Mot de passe oublié ?', 'Forgot password?', 'نسيت كلمة السر؟'),
            onTap: () => _push(ForgotPasswordScreen(email: _email.text.trim())),
          ),
        ]),
        if (_error != null) ...[
          const SizedBox(height: 8),
          TgBanner(
            tone: BannerTone.broken,
            actions: _unverified
                ? [
                    Btn(
                      L('Saisir mon code', 'Enter my code', 'دخّل الكود'),
                      kind: BtnKind.secondary,
                      onPressed: () => _push(RegisterScreen(verifyEmail: _email.text.trim())),
                    ),
                  ]
                : null,
            child: Text(_error!),
          ),
        ],
        const SizedBox(height: 16),
        Btn(
          _busy ? L('Connexion…', 'Logging in…', 'قاعد يدخل…') : L('Se connecter', 'Log in', 'ادخل'),
          onPressed: ready ? _submit : null,
          expand: true,
          large: true,
        ),
      ],
    );
  }
}
