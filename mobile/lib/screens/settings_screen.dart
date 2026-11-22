import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/format.dart';
import '../util/i18n.dart';
import '../widgets/account_settings.dart';
import '../widgets/power_picker.dart';
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
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: app.refreshSettings,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(kGutter, 12, kGutter, 40),
            children: [
              PageHeader(back: true, label: s?.name ?? L('Mon foyer', 'My home', 'داري'), title: L('Paramètres', 'Settings', 'الإعدادات')),
              if (s == null)
                const Skeleton(height: 260)
              else ...[
                if (s.demoMode) ...[const _DemoCard(), const Gap(12)],
                _HouseholdForm(key: ValueKey('h${s.name}${s.subscribedKva}${s.alertMarginKwh}'), s: s),
                const Gap(12),
                _LeakForm(key: ValueKey('l${s.leakStartHour}${s.leakEndHour}${s.leakMinMinutes}'), s: s),
                const Gap(12),
                _DevicesCard(s: s),
              ],
              const Gap(12),
              TgCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  CardTitle(L('Apparence', 'Appearance', 'المظهر')),
                  Segmented<ThemeMode>(
                    value: app.themeMode,
                    onChanged: app.setTheme,
                    track: tg.sunken,
                    options: [
                      (ThemeMode.system, L('Système', 'System', 'النظام'), LucideIcons300.monitor),
                      (ThemeMode.light, L('Clair', 'Light', 'فاتح'), LucideIcons300.sun),
                      (ThemeMode.dark, L('Sombre', 'Dark', 'داكن'), LucideIcons300.moon),
                    ],
                  ),
                ]),
              ),
              const Gap(12),
              const AccountSettings(),
              const Gap(12),
              Row(children: [
                Icon(LucideIcons300.server, size: 16, color: tg.mute),
                const SizedBox(width: 6),
                Expanded(child: Text(app.server, textDirection: TextDirection.ltr, style: T.small(tg.mute))),
              ]),
            ],
          ),
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
        Btn(busy ? L('Enregistrement…', 'Saving…', 'قاعد يسجّل…') : L('Enregistrer', 'Save', 'سجّل'), onPressed: busy || !valid ? null : onSave),
        if (saved && error == null) Text(L('Enregistré.', 'Saved.', 'تسجّل.'), style: T.small(tg.success)),
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
      Text(label, style: T.small(tg.body).copyWith(fontSize: 14, fontWeight: FontWeight.w600)),
      const SizedBox(height: 8),
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
  late double _kva = widget.s.subscribedKva;
  late final _margin = TextEditingController(text: '${widget.s.alertMarginKwh}');

  @override
  void dispose() {
    _name.dispose();
    _margin.dispose();
    super.dispose();
  }

  double? get _kvaValue => _kva;
  int? get _marginValue => int.tryParse(_margin.text.trim());

  @override
  Widget build(BuildContext context) {
    final kva = _kvaValue;
    final margin = _marginValue;
    final kvaError = kva == null || kva <= 0 || kva > 100 ? L('Indique une puissance entre 1 et 100 kVA.', 'Enter a power between 1 and 100 kVA.', 'اكتب قوة بين 1 و 100 kVA.') : null;
    final marginError = margin == null || margin < 1 || margin > 50 ? L('Choisis une valeur entre 1 et 50.', 'Choose a value between 1 and 50.', 'اختار قيمة بين 1 و 50.') : null;
    final nameError = _name.text.trim().isEmpty ? L('Donne un nom à ton foyer.', 'Give your home a name.', 'عطي اسم للدار متاعك.') : null;

    return TgCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CardTitle(L('Foyer', 'Home', 'الدار')),
        _Field(label: L('Nom du foyer', 'Home name', 'اسم الدار'), controller: _name, error: nameError, onChanged: (_) => setState(() {})),
        const SizedBox(height: 16),
        PowerPicker(kva: _kva, onChanged: (v) => setState(() => _kva = v)),
        if (kvaError != null) Text(kvaError, style: T.small(context.tg.grenade)),
        const SizedBox(height: 16),
        _Field(
          label: L('Marge d\'alerte (kWh)', 'Alert margin (kWh)', 'هامش التنبيه (kWh)'),
          controller: _margin,
          number: true,
          suffix: 'kWh',
          help: L('Choisis une valeur entre 1 et 50.', 'Choose a value between 1 and 50.', 'اختار قيمة بين 1 و 50.'),
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
      Text(label, style: T.small(tg.body).copyWith(fontSize: 14, fontWeight: FontWeight.w600)),
      const SizedBox(height: 8),
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
    final sameError = _start == _end ? L('Le début et la fin doivent être différents.', 'Start and end must differ.', 'البداية والنهاية لازم يختلفو.') : null;
    final minError = minutes == null || minutes < 1 || minutes > 720 ? L('Choisis une durée entre 1 et 720 minutes.', 'Choose a duration between 1 and 720 minutes.', 'اختار مدة بين 1 و 720 دقيقة.') : null;

    return TgCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CardTitle(L('Surveillance des fuites', 'Leak watch', 'مراقبة التسريب')),
        Text(L('La nuit, personne ne devrait utiliser d\'eau. Une eau qui coule sans arrêt dans cette fenêtre déclenche une alerte.', 'At night nobody should use water. Water running non-stop in this window raises an alert.', 'في الليل حتى حد ما يستعمل الماء. ماء يجري بلا وقفة في الوقت هذا يعطي تنبيه.'),
            style: T.small(tg.mute)),
        const SizedBox(height: 16),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: _hour(L('Début', 'Start', 'البداية'), _start, (v) => setState(() => _start = v), error: sameError)),
          const SizedBox(width: 12),
          Expanded(child: _hour(L('Fin', 'End', 'النهاية'), _end, (v) => setState(() => _end = v))),
        ]),
        if (sameError != null) ...[
          const SizedBox(height: 6),
          Text(sameError, style: T.small(tg.grenade)),
        ],
        const SizedBox(height: 16),
        _Field(
          label: L('Durée avant l\'alerte (minutes)', 'Time before the alert (minutes)', 'المدة قبل التنبيه (دقايق)'),
          controller: _minutes,
          number: true,
          suffix: 'min',
          help: L('120 min par défaut. Pour la démo, mets 2 min.', '120 min by default. For the demo, use 2 min.', '120 دقيقة عادة. للديمو، حط 2 دقايق.'),
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
          d.kind == 'simulator' ? '${L('Simulateur', 'Simulator', 'سيمولاتور')} · ${d.id}' : '${L('Boîtier ESP32', 'ESP32 box', 'بواطة ESP32')} · ${d.id}',
          d.kind == 'simulator' ? L('Envoie le même JSON que la box', 'Sends the same JSON as the box', 'يبعث نفس JSON متاع البواطة') : 'PZEM-004T · YF-S201',
          d,
        ),
      (null, L('Tous les appareils', 'All devices', 'البواطات الكل'), L('Additionne les mesures de chaque appareil', 'Adds up the readings of every device', 'يجمع القياسات متاع كل بواطة'), null),
    ];

    return TgCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CardTitle(L('Appareil actif', 'Active device', 'البواطة المستعملة')),
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
                              ? Pill(L('En direct', 'Live', 'مباشر'), tone: PillTone.success)
                              : Pill(dev.lastSeenAt != null ? '${L('vu', 'seen', 'آخر مرة')} ${dateTime(dev.lastSeenAt!)}' : L('jamais vu', 'never seen', 'عمرو ما تشاف'),
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
          Expanded(child: Text(L('Contrôle démo', 'Demo control', 'التحكم في الديمو'), style: T.h3(tg.ink))),
          const Pill('DEMO_MODE', tone: PillTone.neutral),
        ]),
        const SizedBox(height: 10),
        Text(
          L('Ajoute un pic de +3,5 kW pendant 30 s au simulateur et assez de kWh pour entrer dans la marge d\'alerte. L\'alerte de tranche et les conseils apparaissent en une dizaine de secondes.',
              'Adds a +3.5 kW spike for 30 s to the simulator and enough kWh to enter the alert margin. The tranche alert and tips show up within about ten seconds.',
              'يزيد قفزة +3,5 kW مدة 30 ثانية للسيمولاتور وkWh كافية باش يدخل في هامش التنبيه. التنبيه والنصائح يظهرو في عشرة ثواني تقريبا.'),
          style: T.body(tg.body),
        ),
        const SizedBox(height: 16),
        Align(
          alignment: Alignment.centerLeft,
          child: Btn(_busy ? L('Envoi…', 'Sending…', 'قاعد يبعث…') : L('Simuler un pic', 'Simulate a spike', 'اعمل قفزة'), icon: LucideIcons300.zap, onPressed: _busy ? null : _spike),
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
