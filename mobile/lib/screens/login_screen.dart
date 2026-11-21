import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/logo.dart';
import '../widgets/status.dart';
import '../widgets/ui.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _server = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _showPassword = false;
  String? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_server.text.isEmpty) _server.text = AppScope.read(context).server;
  }

  @override
  void dispose() {
    _server.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppScope.read(context).login(_server.text, _email.text, _password.text);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _field(String label, TextEditingController c,
      {String? help, TextInputType? type, bool obscure = false, Widget? suffix, String? hint, List<String>? autofill}) {
    final tg = context.tg;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: T.h3(tg.ink).copyWith(fontSize: 15)),
        const SizedBox(height: 6),
        TextField(
          controller: c,
          keyboardType: type,
          obscureText: obscure,
          autocorrect: false,
          enableSuggestions: !obscure,
          autofillHints: autofill,
          style: T.body(tg.ink),
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(hintText: hint, suffixIcon: suffix),
        ),
        if (help != null) ...[const SizedBox(height: 6), Text(help, style: T.small(tg.mute))],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final ready = _email.text.isNotEmpty && _password.text.isNotEmpty && _server.text.isNotEmpty && !_busy;
    return Scaffold(
      body: SafeArea(
        child: AutofillGroup(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 32, 20, 32),
            children: [
              const Logo(size: 36, fontSize: 22),
              const SizedBox(height: 28),
              Text('Vois ta facture avant qu\'elle arrive.', style: T.display(tg.ink).copyWith(fontSize: 30, height: 1.2)),
              const SizedBox(height: 10),
              Text(
                'Électricité et eau en temps réel, facture STEG estimée, alerte avant un changement de tranche.',
                style: T.body(tg.body),
              ),
              const SizedBox(height: 32),
              Text('Connexion', style: T.h1(tg.ink)),
              const SizedBox(height: 4),
              Text('Avec le compte de ton foyer.', style: T.small(tg.mute)),
              const SizedBox(height: 24),
              _field('Email', _email,
                  type: TextInputType.emailAddress, hint: 'toi@exemple.tn', autofill: const [AutofillHints.email]),
              const SizedBox(height: 18),
              _field(
                'Mot de passe',
                _password,
                obscure: !_showPassword,
                autofill: const [AutofillHints.password],
                suffix: IconButton(
                  tooltip: _showPassword ? 'Masquer' : 'Afficher',
                  icon: Icon(_showPassword ? LucideIcons300.eyeOff : LucideIcons300.eye, color: tg.mute, size: 20),
                  onPressed: () => setState(() => _showPassword = !_showPassword),
                ),
              ),
              const SizedBox(height: 18),
              _field(
                'Serveur',
                _server,
                type: TextInputType.url,
                hint: 'http://192.168.1.20:8000',
                help: 'Émulateur : http://10.0.2.2:8000. Téléphone : l\'adresse Wi-Fi du PC qui fait tourner l\'API.',
              ),
              if (_error != null) ...[
                const SizedBox(height: 18),
                TgBanner(tone: BannerTone.broken, child: Text(_error!)),
              ],
              const SizedBox(height: 24),
              Btn(_busy ? 'Connexion…' : 'Se connecter', onPressed: ready ? _submit : null, expand: true),
            ],
          ),
        ),
      ),
    );
  }
}
