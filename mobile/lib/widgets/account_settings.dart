import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../screens/auth_screens.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/i18n.dart';
import 'fields.dart';
import 'status.dart';
import 'ui.dart';

// Account part of the settings (frontend/src/components/AccountSettings.tsx): name and
// language, notification preferences, password, sessions and account deletion.

class AccountSettings extends StatelessWidget {
  const AccountSettings({super.key});
  @override
  Widget build(BuildContext context) => const Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _ProfileCard(),
        SizedBox(height: 12),
        _NotificationsCard(),
        SizedBox(height: 12),
        _PasswordCard(),
        SizedBox(height: 12),
        _SessionsCard(),
      ]);
}

Widget _saved(BuildContext context, bool ok, String? error) {
  final tg = context.tg;
  if (error != null) return Text(error, style: T.small(tg.grenade));
  if (ok) return Text(L('Enregistré', 'Saved', 'تسجّل'), style: T.small(tg.success).copyWith(fontWeight: FontWeight.w700));
  return const SizedBox.shrink();
}

Widget _title(BuildContext context, IconData icon, String text) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(children: [
        Icon(icon, size: 18, color: context.tg.ink),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: T.h3(context.tg.ink))),
      ]),
    );

class _ProfileCard extends StatefulWidget {
  const _ProfileCard();
  @override
  State<_ProfileCard> createState() => _ProfileCardState();
}

class _ProfileCardState extends State<_ProfileCard> {
  late final _name = TextEditingController(text: AppScope.read(context).user?.fullName ?? '');
  final _email = TextEditingController();
  bool _ok = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _email.text = AppScope.read(context).user?.email ?? '';
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final app = AppScope.read(context);
    setState(() {
      _ok = false;
      _error = null;
    });
    try {
      app.setUser(await app.api.updateMe(fullName: _name.text.trim()));
      if (mounted) setState(() => _ok = true);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return TgCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _title(context, LucideIcons300.userRound, L('Mon compte', 'My account', 'حسابي')),
        TgField(label: L('Nom complet', 'Full name', 'الاسم الكامل'), controller: _name, maxLength: 120, onChanged: (_) => setState(() {})),
        const SizedBox(height: 12),
        TgField(
          label: L('E-mail', 'Email', 'الإيميل'),
          controller: _email,
          enabled: false,
          ltr: true,
          help: L('L\'adresse sert à te connecter.', 'The address is used to log in.', 'الإيميل يستعمل للدخول.'),
        ),
        const SizedBox(height: 12),
        Text(L('Langue', 'Language', 'اللغة'), style: T.small(tg.body).copyWith(fontSize: 14, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        const Align(alignment: AlignmentDirectional.centerStart, child: LanguageSwitch()),
        const SizedBox(height: 14),
        Wrap(spacing: 12, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
          Btn(L('Enregistrer', 'Save', 'سجّل'), onPressed: _name.text.trim().length < 2 ? null : _save),
          _saved(context, _ok, _error),
        ]),
      ]),
    );
  }
}

class _NotificationsCard extends StatefulWidget {
  const _NotificationsCard();
  @override
  State<_NotificationsCard> createState() => _NotificationsCardState();
}

class _NotificationsCardState extends State<_NotificationsCard> {
  late NotifyPrefs _prefs = AppScope.read(context).user?.notifyPrefs ?? NotifyPrefs();
  bool _ok = false;
  String? _error;

  Future<void> _save(NotifyPrefs next) async {
    final app = AppScope.read(context);
    setState(() {
      _prefs = next;
      _ok = false;
      _error = null;
    });
    try {
      app.setUser(await app.api.updateMe(notifyPrefs: next));
      if (mounted) setState(() => _ok = true);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return TgCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _title(context, LucideIcons300.bellRing, L('Notifications', 'Notifications', 'الإشعارات')),
        CheckboxField(
          label: L('Avant une tranche STEG', 'Before a STEG tranche', 'قبل شريحة STEG'),
          value: _prefs.threshold,
          onChanged: (v) => _save(_prefs.copyWith(threshold: v)),
        ),
        CheckboxField(
          label: L('Fuites et débit d\'eau anormal', 'Leaks and unusual water flow', 'التسريبات والدبي الغريب'),
          value: _prefs.leak,
          onChanged: (v) => _save(_prefs.copyWith(leak: v)),
        ),
        CheckboxField(
          label: L('Boîtier hors ligne, capteur en panne', 'Box offline, sensor fault', 'البواطة مقطوعة، كابتور معطّل'),
          value: _prefs.device,
          onChanged: (v) => _save(_prefs.copyWith(device: v)),
        ),
        CheckboxField(
          label: L('Conseils pour économiser', 'Saving tips', 'نصائح للتوفير'),
          value: _prefs.tips,
          onChanged: (v) => _save(_prefs.copyWith(tips: v)),
        ),
        const SizedBox(height: 6),
        Text(
          L('Affichées dans l\'app tant qu\'elle est ouverte. Tout reste dans Alertes > Historique.',
              'Shown in the app while it is open. Everything stays in Alerts > History.',
              'تظهر في التطبيق ما دام محلول. الكل يبقى في التنبيهات > التاريخ.'),
          style: T.caption(tg.mute).copyWith(fontSize: 12),
        ),
        const SizedBox(height: 6),
        _saved(context, _ok, _error),
      ]),
    );
  }
}

class _PasswordCard extends StatefulWidget {
  const _PasswordCard();
  @override
  State<_PasswordCard> createState() => _PasswordCardState();
}

class _PasswordCardState extends State<_PasswordCard> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _touched = false, _ok = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_current, _next, _confirm]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _touched = true);
    if (passwordProblem(_next.text, _confirm.text) != null) return;
    final app = AppScope.read(context);
    setState(() {
      _ok = false;
      _error = null;
    });
    try {
      final token = await app.api.changePassword(_current.text, _next.text);
      app.acceptToken(token, app.user!);
      for (final c in [_current, _next, _confirm]) {
        c.clear();
      }
      if (mounted) {
        setState(() {
          _touched = false;
          _ok = true;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return TgCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _title(context, LucideIcons300.keyRound, L('Mot de passe', 'Password', 'كلمة السر')),
        TgField(
          label: L('Mot de passe actuel', 'Current password', 'كلمة السر الحالية'),
          controller: _current,
          password: true,
          autofill: const [AutofillHints.password],
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        TgField(
          label: L('Nouveau mot de passe', 'New password', 'كلمة السر الجديدة'),
          controller: _next,
          password: true,
          autofill: const [AutofillHints.newPassword],
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        TgField(
          label: L('Confirme', 'Confirm', 'عاود'),
          controller: _confirm,
          password: true,
          error: _touched ? passwordProblem(_next.text, _confirm.text) : null,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 8),
        Text(L('Tes autres appareils seront déconnectés.', 'Your other devices will be logged out.', 'الأجهزة الأخرى باش تخرج.'),
            style: T.caption(tg.mute).copyWith(fontSize: 12)),
        const SizedBox(height: 12),
        Wrap(spacing: 12, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
          Btn(L('Changer le mot de passe', 'Change password', 'بدّل كلمة السر'),
              onPressed: _current.text.isEmpty || _next.text.isEmpty ? null : _save),
          _saved(context, _ok, _error),
        ]),
      ]),
    );
  }
}

class _SessionsCard extends StatefulWidget {
  const _SessionsCard();
  @override
  State<_SessionsCard> createState() => _SessionsCardState();
}

class _SessionsCardState extends State<_SessionsCard> {
  bool _deleting = false;
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  void _leave(AppState app) {
    // The settings page sits above the shell: back to the root, then log out.
    Navigator.of(context).popUntil((r) => r.isFirst);
    app.logout();
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final app = AppScope.of(context);
    final word = L('SUPPRIMER', 'DELETE', 'حذف');
    return TgCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(L('Sessions et données', 'Sessions and data', 'الجلسات والمعطيات'), style: T.h3(tg.ink))),
        Wrap(spacing: 8, runSpacing: 8, children: [
          Btn(L('Se déconnecter', 'Log out', 'اخرج'),
              kind: BtnKind.secondary, icon: isRtl ? LucideIcons300.logIn : LucideIcons300.logOut, onPressed: () => _leave(app)),
          Btn(L('Déconnecter tous mes appareils', 'Log out all my devices', 'اخرج من الأجهزة الكل'),
              kind: BtnKind.secondary,
              onPressed: () async {
                try {
                  await app.api.logoutAll();
                } catch (_) {
                  // Logged out here anyway.
                }
                if (mounted) _leave(app);
              }),
        ]),
        const SizedBox(height: 16),
        Divider(color: tg.hairline, height: 1),
        const SizedBox(height: 16),
        if (!_deleting)
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: Btn(L('Supprimer mon compte', 'Delete my account', 'فسخ الحساب متاعي'),
                kind: BtnKind.danger, icon: LucideIcons300.trash2, onPressed: () => setState(() => _deleting = true)),
          )
        else
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: tg.grenadeSoft, borderRadius: BorderRadius.circular(kRadiusCtl)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(
                L('Ton compte et tous tes foyers seront supprimés : boîtiers, mesures, alertes, conseils, scores et appareils déclarés. Tes messages au support sont gardés sans lien avec ton compte. C\'est définitif.',
                    'Your account and all your homes will be deleted: boxes, readings, alerts, tips, scores and declared appliances. Your support messages are kept without a link to your account. This cannot be undone.',
                    'الحساب والديار الكل باش يتفسخو: البواطات، القياسات، التنبيهات، النصائح والآلات. رسائل الدعم تتخلّى بلا اسمك. ما يرجعش.'),
                style: T.small(tg.grenade).copyWith(fontSize: 14),
              ),
              if (app.user?.isAdmin == true)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(L('Le dernier administrateur ne peut pas être supprimé.', 'The last administrator cannot be deleted.', 'آخر أدمين ما ينجمش يتفسخ.'),
                      style: T.small(tg.grenade)),
                ),
              const SizedBox(height: 12),
              TgField(label: L('Ton mot de passe', 'Your password', 'كلمة السر'), controller: _password, password: true, onChanged: (_) => setState(() {})),
              const SizedBox(height: 12),
              TgField(
                label: L('Tape $word pour confirmer', 'Type $word to confirm', 'اكتب $word باش تأكّد'),
                controller: _confirm,
                onChanged: (_) => setState(() {}),
              ),
              if (_error != null) ...[const SizedBox(height: 12), TgBanner(tone: BannerTone.broken, child: Text(_error!))],
              const SizedBox(height: 12),
              Wrap(spacing: 8, runSpacing: 8, children: [
                Btn(L('Supprimer définitivement', 'Delete for good', 'فسخ نهائيا'),
                    kind: BtnKind.danger,
                    onPressed: _password.text.isEmpty || _confirm.text.trim() != word
                        ? null
                        : () async {
                            setState(() => _error = null);
                            try {
                              await app.api.deleteAccount(_password.text, _confirm.text.trim());
                              if (mounted) _leave(app);
                            } catch (e) {
                              if (mounted) setState(() => _error = '$e');
                            }
                          }),
                Btn(L('Annuler', 'Cancel', 'إلغاء'), kind: BtnKind.secondary, onPressed: () => setState(() => _deleting = false)),
              ]),
            ]),
          ),
      ]),
    );
  }
}
