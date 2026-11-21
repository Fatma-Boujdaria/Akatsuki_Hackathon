import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/format.dart';
import '../widgets/status.dart';
import '../widgets/ui.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final tg = context.tg;
    final s = app.settings;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: tg.canvas,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        shape: Border(bottom: BorderSide(color: tg.hairline)),
        iconTheme: IconThemeData(color: tg.ink),
        title: Text('Réglages', style: T.h3(tg.ink).copyWith(fontSize: 18)),
      ),
      body: RefreshIndicator(
        onRefresh: app.refreshSettings,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(kGutter, 20, kGutter, 40),
          children: [
            PageHeader(label: s?.name ?? 'Mon foyer', title: 'Réglages'),
            if (s == null)
              const Skeleton(height: 260)
            else ...[
              if (s.demoMode) ...[const _DemoCard(), const Gap(14)],
              _HouseholdForm(key: ValueKey('h${s.name}${s.subscribedKva}${s.alertMarginKwh}'), s: s),
              const Gap(14),
              _LeakForm(key: ValueKey('l${s.leakStartHour}${s.leakEndHour}${s.leakMinMinutes}'), s: s),
              const Gap(14),
              _DevicesCard(s: s),
            ],
            const Gap(14),
            TgCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                const CardTitle('Apparence'),
                Segmented<ThemeMode>(
                  value: app.themeMode,
                  onChanged: app.setTheme,
                  options: const [
                    (ThemeMode.system, 'Système', LucideIcons300.monitor),
                    (ThemeMode.light, 'Clair', LucideIcons300.sun),
                    (ThemeMode.dark, 'Sombre', LucideIcons300.moon),
                  ],
                ),
              ]),
            ),
            const Gap(14),
            TgCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const CardTitle('Compte'),
                Text(app.user?.email ?? '', style: T.body(tg.ink)),
                Text(app.user?.isAdmin == true ? 'administrateur' : 'foyer', style: T.label(tg.mute).copyWith(letterSpacing: 0)),
                const SizedBox(height: 12),
                Row(children: [
                  Icon(LucideIcons300.server, size: 16, color: tg.mute),
                  const SizedBox(width: 6),
                  Expanded(child: Text(app.server, style: T.data(tg.body).copyWith(fontSize: 13))),
                ]),
                const SizedBox(height: 16),
                Btn('Se déconnecter', kind: BtnKind.secondary, icon: LucideIcons300.logOut, onPressed: () {
                  Navigator.of(context).popUntil((r) => r.isFirst);
                  app.logout();
                }),
              ]),
            ),
          ],
        ),
      ),
    );
  }
}

/// Saves through PUT /api/settings and reports the result under the button.
mixin _Saver<W extends StatefulWidget> on State<W> {
  bool busy = false;
  bool saved = false;
  String? error;

  Future<void> save(Json body) async {
    final app = AppScope.read(context);
    setState(() {
      busy = true;
      saved = false;
      error = null;
    });
    try {
      app.setSettings(await app.api.updateSettings(body));
      if (mounted) setState(() => saved = true);
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Widget saveRow({required bool valid, required VoidCallback onSave}) {
    final tg = context.tg;
    return Padding(
      padding: const EdgeInsets.only(top: 18),
      child: Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 12, runSpacing: 8, children: [
        Btn(busy ? 'Enregistrement…' : 'Enregistrer', onPressed: busy || !valid ? null : onSave),
        if (saved && error == null) Text('Enregistré.', style: T.small(tg.primary)),
        if (error != null) Text(error!, style: T.small(tg.grenade)),
      ]),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.controller, this.help, this.error, this.suffix, this.number = false, this.onChanged});
  final String label;
  final TextEditingController controller;
  final String? help, error, suffix;
  final bool number;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: T.h3(tg.ink).copyWith(fontSize: 15)),
      const SizedBox(height: 6),
      TextField(
        controller: controller,
        keyboardType: number ? const TextInputType.numberWithOptions(decimal: true) : TextInputType.text,
        style: T.body(tg.ink),
        onChanged: onChanged,
        decoration: InputDecoration(
          errorText: null,
          enabledBorder: error != null
              ? OutlineInputBorder(borderRadius: BorderRadius.circular(kRadiusCtl), borderSide: BorderSide(color: tg.grenade))
              : null,
          suffixText: suffix,
          suffixStyle: T.data(tg.mute).copyWith(fontSize: 13),
        ),
      ),
      const SizedBox(height: 6),
      // Label above, help or error below (charter board 05).
      if (error != null)
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(padding: const EdgeInsets.only(top: 2), child: Icon(LucideIcons300.circleAlert, size: 16, color: tg.grenade)),
          const SizedBox(width: 6),
          Expanded(child: Text(error!, style: T.small(tg.grenade))),
        ])
      else if (help != null)
        Text(help!, style: T.small(tg.mute)),
    ]);
  }
}

class _HouseholdForm extends StatefulWidget {
  const _HouseholdForm({super.key, required this.s});
  final Settings s;
  @override
  State<_HouseholdForm> createState() => _HouseholdFormState();
}

class _HouseholdFormState extends State<_HouseholdForm> with _Saver {
  late final _name = TextEditingController(text: widget.s.name);
  late final _kva = TextEditingController(text: num(widget.s.subscribedKva, decimals: 1, fixed: false));
  late final _margin = TextEditingController(text: '${widget.s.alertMarginKwh}');

  @override
  void dispose() {
    _name.dispose();
    _kva.dispose();
    _margin.dispose();
    super.dispose();
  }

  double? get _kvaValue => double.tryParse(_kva.text.replaceAll(',', '.').trim());
  int? get _marginValue => int.tryParse(_margin.text.trim());

  @override
  Widget build(BuildContext context) {
    final kva = _kvaValue;
    final margin = _marginValue;
    final kvaError = kva == null || kva <= 0 || kva > 100 ? 'Indique une puissance entre 1 et 100 kVA.' : null;
    final marginError = margin == null || margin < 1 || margin > 50 ? 'Choisis une valeur entre 1 et 50.' : null;
    final nameError = _name.text.trim().isEmpty ? 'Donne un nom à ton foyer.' : null;

    return TgCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const CardTitle('Foyer'),
        _Field(label: 'Nom du foyer', controller: _name, error: nameError, onChanged: (_) => setState(() {})),
        const SizedBox(height: 16),
        _Field(
          label: 'Puissance souscrite (kVA)',
          controller: _kva,
          number: true,
          suffix: 'kVA',
          help: 'Indiquée sur ta facture STEG.',
          error: kvaError,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 16),
        _Field(
          label: 'Marge d\'alerte (kWh)',
          controller: _margin,
          number: true,
          suffix: 'kWh',
          help: 'Choisis une valeur entre 1 et 50.',
          error: _margin.text == '${widget.s.alertMarginKwh}' ? null : marginError,
          onChanged: (_) => setState(() {}),
        ),
        saveRow(
          valid: kvaError == null && marginError == null && nameError == null,
          onSave: () => save({'name': _name.text.trim(), 'subscribed_kva': kva, 'alert_margin_kwh': margin}),
        ),
      ]),
    );
  }
}

class _LeakForm extends StatefulWidget {
  const _LeakForm({super.key, required this.s});
  final Settings s;
  @override
  State<_LeakForm> createState() => _LeakFormState();
}

class _LeakFormState extends State<_LeakForm> with _Saver {
  late int _start = widget.s.leakStartHour;
  late int _end = widget.s.leakEndHour;
  late final _minutes = TextEditingController(text: '${widget.s.leakMinMinutes}');

  @override
  void dispose() {
    _minutes.dispose();
    super.dispose();
  }

  Widget _hour(String label, int value, ValueChanged<int> onChanged, {String? error}) {
    final tg = context.tg;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: T.h3(tg.ink).copyWith(fontSize: 15)),
      const SizedBox(height: 6),
      DropdownButtonFormField<int>(
        initialValue: value,
        isExpanded: true,
        dropdownColor: tg.surface,
        borderRadius: BorderRadius.circular(kRadiusCtl),
        style: T.body(tg.ink),
        icon: Icon(LucideIcons300.chevronDown, size: 18, color: tg.mute),
        items: [for (var h = 0; h < 24; h++) DropdownMenuItem(value: h, child: Text(hh(h)))],
        onChanged: (v) => v == null ? null : onChanged(v),
        decoration: InputDecoration(
          enabledBorder: error != null
              ? OutlineInputBorder(borderRadius: BorderRadius.circular(kRadiusCtl), borderSide: BorderSide(color: tg.grenade))
              : null,
        ),
      ),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final minutes = int.tryParse(_minutes.text.trim());
    final sameError = _start == _end ? 'Le début et la fin doivent être différents.' : null;
    final minError = minutes == null || minutes < 1 || minutes > 720 ? 'Choisis une durée entre 1 et 720 minutes.' : null;

    return TgCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const CardTitle('Surveillance des fuites'),
        Text('La nuit, personne ne devrait utiliser d\'eau. Une eau qui coule sans arrêt dans cette fenêtre déclenche une alerte.',
            style: T.small(tg.mute)),
        const SizedBox(height: 16),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: _hour('Début', _start, (v) => setState(() => _start = v), error: sameError)),
          const SizedBox(width: 12),
          Expanded(child: _hour('Fin', _end, (v) => setState(() => _end = v))),
        ]),
        if (sameError != null) ...[
          const SizedBox(height: 6),
          Text(sameError, style: T.small(tg.grenade)),
        ],
        const SizedBox(height: 16),
        _Field(
          label: 'Durée avant l\'alerte (minutes)',
          controller: _minutes,
          number: true,
          suffix: 'min',
          help: '120 min par défaut. Pour la démo, mets 2 min.',
          error: _minutes.text == '${widget.s.leakMinMinutes}' ? null : minError,
          onChanged: (_) => setState(() {}),
        ),
        saveRow(
          valid: sameError == null && minError == null,
          onSave: () => save({'leak_start_hour': _start, 'leak_end_hour': _end, 'leak_min_minutes': minutes}),
        ),
      ]),
    );
  }
}

class _DevicesCard extends StatefulWidget {
  const _DevicesCard({required this.s});
  final Settings s;
  @override
  State<_DevicesCard> createState() => _DevicesCardState();
}

class _DevicesCardState extends State<_DevicesCard> with _Saver {
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final s = widget.s;
    final options = <(String?, String, String, DeviceStatus?)>[
      for (final d in s.devices)
        (
          d.id,
          d.kind == 'simulator' ? 'Simulateur · ${d.id}' : 'Boîtier ESP32 · ${d.id}',
          d.kind == 'simulator' ? 'Envoie le même JSON que la box' : 'PZEM-004T · YF-S201',
          d,
        ),
      (null, 'Tous les appareils', 'Additionne les mesures de chaque appareil', null),
    ];

    return TgCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const CardTitle('Appareil actif'),
        for (final (id, title, sub, dev) in options)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Material(
              color: id == s.activeDeviceId ? tg.primarySoft : tg.surface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(kRadiusCtl),
                side: BorderSide(color: id == s.activeDeviceId ? tg.primary : tg.hairline),
              ),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: busy || id == s.activeDeviceId
                    ? null
                    : () => save(id != null ? {'active_device_id': id} : {'clear_active_device': true}),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  child: Row(children: [
                    Icon(
                      id == s.activeDeviceId ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                      color: id == s.activeDeviceId ? tg.primary : tg.control,
                      size: 22,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(title, style: T.small(tg.ink).copyWith(fontSize: 15, fontWeight: FontWeight.w600)),
                        Text(sub, style: T.label(tg.mute).copyWith(letterSpacing: 0)),
                        if (dev != null) ...[
                          const SizedBox(height: 6),
                          dev.online
                              ? const Pill('En direct', tone: PillTone.live)
                              : Pill(dev.lastSeenAt != null ? 'vu ${dateTime(dev.lastSeenAt!)}' : 'jamais vu',
                                  tone: PillTone.neutral, icon: const Icon(LucideIcons300.wifiOff)),
                        ],
                      ]),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        if (error != null) Text(error!, style: T.small(tg.grenade)),
      ]),
    );
  }
}

class _DemoCard extends StatefulWidget {
  const _DemoCard();
  @override
  State<_DemoCard> createState() => _DemoCardState();
}

class _DemoCardState extends State<_DemoCard> {
  SpikeOut? _result;
  String? _error;
  bool _busy = false;

  Future<void> _spike() async {
    final app = AppScope.read(context);
    setState(() {
      _busy = true;
      _error = null;
      _result = null;
    });
    try {
      final r = await app.api.spike();
      if (mounted) setState(() => _result = r);
      app.refreshDashboard();
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return TgCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(child: Text('Contrôle démo', style: T.h3(tg.ink).copyWith(fontSize: 17))),
          const Pill('DEMO_MODE', tone: PillTone.neutral),
        ]),
        const SizedBox(height: 10),
        Text(
          'Ajoute un pic de +3,5 kW pendant 30 s au simulateur et assez de kWh pour entrer dans la marge d\'alerte. '
          'L\'alerte de tranche et les conseils apparaissent en une dizaine de secondes.',
          style: T.body(tg.body),
        ),
        const SizedBox(height: 16),
        Align(
          alignment: Alignment.centerLeft,
          child: Btn(_busy ? 'Envoi…' : 'Simuler un pic', icon: LucideIcons300.zap, onPressed: _busy ? null : _spike),
        ),
        if (_result != null) ...[
          const SizedBox(height: 14),
          TgBanner(
            tone: _result!.simulatorOnline ? BannerTone.info : BannerTone.headsup,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(_result!.message),
              const SizedBox(height: 4),
              Text(
                '${_result!.deviceId} · +${num(_result!.extraW)} W · ${_result!.durationS} s · +${num(_result!.energyKwh, decimals: 1)} kWh',
                style: T.label(tg.mute).copyWith(letterSpacing: 0),
              ),
            ]),
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: 14),
          TgBanner(tone: BannerTone.broken, child: Text(_error!)),
        ],
      ]),
    );
  }
}
