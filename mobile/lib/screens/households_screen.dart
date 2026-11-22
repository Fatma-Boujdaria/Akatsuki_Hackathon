import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/appliances.dart';
import '../util/format.dart' as f;
import '../util/i18n.dart';
import '../widgets/appliance_editor.dart';
import '../widgets/fields.dart';
import '../widgets/status.dart';
import '../widgets/power_picker.dart';
import '../widgets/ui.dart';
import 'onboarding_screen.dart';

// "Mes foyers" (frontend/src/pages/Households.tsx): every home of the account, with its
// boxes; add, edit, show, delete; the appliances of the shown home.

class HouseholdsScreen extends StatefulWidget {
  const HouseholdsScreen({super.key, this.adding = false});
  final bool adding;
  @override
  State<HouseholdsScreen> createState() => _HouseholdsScreenState();
}

class _HouseholdsScreenState extends State<HouseholdsScreen> {
  late bool _adding = widget.adding;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final app = AppScope.of(context);
    final current = app.currentHousehold;
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: app.refreshHouseholds,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(kGutter, 12, kGutter, 40),
            children: [
              PageHeader(
                back: true,
                title: L('Mes foyers', 'My homes', 'دياري'),
                aside: _adding ? null : Btn(L('Ajouter', 'Add', 'زيد'), icon: LucideIcons300.plus, onPressed: () => setState(() => _adding = true)),
              ),
              Text(
                L('Résidence principale, secondaire, maison des parents, location : chaque foyer a ses boîtiers, ses mesures, ses alertes et ses réglages.',
                    'Main home, second home, parents\' house, rental: each home has its own boxes, readings, alerts and settings.',
                    'الدار الأصلية، دار الصيف، دار الوالدين، دار للكراء: كل دار عندها البواطات والقياسات والتنبيهات متاعها.'),
                style: T.small(tg.mute).copyWith(fontSize: 14),
              ),
              const SizedBox(height: 16),
              if (_adding) ...[
                TgCard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Text(L('Nouveau foyer', 'New home', 'دار جديدة'), style: T.h3(tg.ink)),
                    HouseholdForm(
                      initial: HouseholdIn(name: '', subscribedKva: 6, alertMarginKwh: 10),
                      submitLabel: L('Créer', 'Create', 'اعمل'),
                      onCancel: () => setState(() => _adding = false),
                      onSubmit: (body) async {
                        final nav = Navigator.of(context);
                        final created = await app.api.createHousehold(body);
                        app.switchHousehold(created.id);
                        await app.refreshHouseholds();
                        setState(() => _adding = false);
                        // Same flow as the web: its appliances, then its box.
                        nav.push(MaterialPageRoute(builder: (_) => const OnboardingScreen(resumeAppliances: true)));
                      },
                    ),
                  ]),
                ),
                const SizedBox(height: 12),
              ],
              for (final h in app.households) ...[
                _HouseholdCard(key: ValueKey(h.id), h: h, isCurrent: h.id == current?.id),
                const SizedBox(height: 12),
              ],
              if (current != null) _CurrentAppliances(key: ValueKey('appl-${current.id}-${app.householdEpoch}'), home: current),
            ],
          ),
        ),
      ),
    );
  }
}

class HouseholdForm extends StatefulWidget {
  const HouseholdForm({super.key, required this.initial, required this.onSubmit, required this.onCancel, required this.submitLabel});
  final HouseholdIn initial;
  final Future<void> Function(HouseholdIn) onSubmit;
  final VoidCallback onCancel;
  final String submitLabel;
  @override
  State<HouseholdForm> createState() => _HouseholdFormState();
}

class _HouseholdFormState extends State<HouseholdForm> {
  late final _name = TextEditingController(text: widget.initial.name);
  late final _address = TextEditingController(text: widget.initial.address ?? '');
  late final _occupants = TextEditingController(text: widget.initial.occupants?.toString() ?? '');
  late double _kva = widget.initial.subscribedKva;
  late final _margin = TextEditingController(text: '${widget.initial.alertMarginKwh}');
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _address, _occupants, _margin]) {
      c.dispose();
    }
    super.dispose();
  }

  double get _kvaValue => _kva;

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.onSubmit(HouseholdIn(
        name: _name.text.trim(),
        address: _address.text,
        occupants: parseNum(_occupants.text)?.round().clamp(1, 30),
        subscribedKva: _kvaValue,
        alertMarginKwh: (parseNum(_margin.text) ?? 0).round().clamp(0, 200),
      ));
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.only(top: 12),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: tg.hairline))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        TgField(label: L('Nom', 'Name', 'الاسم'), controller: _name, onChanged: (_) => setState(() {})),
        const SizedBox(height: 12),
        TgField(label: L('Adresse ou ville', 'Address or city', 'العنوان ولا المدينة'), controller: _address),
        const SizedBox(height: 12),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: TgField(label: L('Occupants', 'Occupants', 'السكان'), controller: _occupants, keyboardType: TextInputType.number)),
          const SizedBox(width: 10),
          Expanded(
            child: TgField(label: L('Marge', 'Margin', 'الهامش'), controller: _margin, suffixText: 'kWh', keyboardType: TextInputType.number),
          ),
        ]),
        const SizedBox(height: 12),
        PowerPicker(kva: _kva, onChanged: (v) => setState(() => _kva = v)),
        if (_error != null) ...[const SizedBox(height: 12), TgBanner(tone: BannerTone.broken, child: Text(_error!))],
        const SizedBox(height: 14),
        Row(children: [
          Btn(widget.submitLabel, onPressed: _busy || _name.text.trim().isEmpty || _kvaValue <= 0 ? null : _submit),
          const SizedBox(width: 8),
          Btn(L('Annuler', 'Cancel', 'إلغاء'), kind: BtnKind.secondary, onPressed: widget.onCancel),
        ]),
      ]),
    );
  }
}

enum _Mode { view, edit, delete }

class _HouseholdCard extends StatefulWidget {
  const _HouseholdCard({super.key, required this.h, required this.isCurrent});
  final Household h;
  final bool isCurrent;
  @override
  State<_HouseholdCard> createState() => _HouseholdCardState();
}

class _HouseholdCardState extends State<_HouseholdCard> {
  _Mode _mode = _Mode.view;
  DeviceCreated? _device;
  String? _error;
  final _confirm = TextEditingController();

  @override
  void dispose() {
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _guard(Future<void> Function() f) async {
    setState(() => _error = null);
    try {
      await f();
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final app = AppScope.of(context);
    final h = widget.h;
    final details = [
      if ((h.address ?? '').isNotEmpty) h.address!,
      '${f.num(h.subscribedKva, decimals: 1, fixed: false)} kVA',
      if (h.occupants != null) L('${h.occupants} pers.', '${h.occupants} people', '${h.occupants} أشخاص'),
    ].join(' · ');
    return Container(
      decoration: BoxDecoration(
        color: tg.surface,
        borderRadius: BorderRadius.circular(kRadiusCard),
        border: Border.all(color: widget.isCurrent ? tg.link : Colors.transparent, width: 2),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const IconTile(icon: LucideIcons300.house, tone: Tone.tile),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(h.name, style: T.h3(tg.ink).copyWith(fontSize: 16, fontWeight: FontWeight.w800)),
              Text(details, style: T.small(tg.mute)),
              const SizedBox(height: 4),
              Text.rich(TextSpan(style: T.caption(tg.mute).copyWith(fontSize: 12), children: [
                TextSpan(
                    text: L('${h.applianceCount} appareil(s) déclaré(s)', '${h.applianceCount} appliance(s) declared',
                        '${h.applianceCount} آلة مصرّح بيها')),
                if (h.unreadAlerts > 0)
                  TextSpan(
                    text: ' · ${L('${h.unreadAlerts} alerte(s)', '${h.unreadAlerts} alert(s)', '${h.unreadAlerts} تنبيه')}',
                    style: TextStyle(color: tg.harissa, fontWeight: FontWeight.w700),
                  ),
              ])),
            ]),
          ),
          const SizedBox(width: 8),
          if (widget.isCurrent)
            Container(
              height: 28,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              decoration: BoxDecoration(color: tg.successSoft, borderRadius: BorderRadius.circular(999)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(LucideIcons300.check, size: 14, color: tg.success),
                const SizedBox(width: 4),
                Text(L('Affiché', 'Shown', 'معروضة'), style: T.caption(tg.success).copyWith(fontSize: 12, fontWeight: FontWeight.w700)),
              ]),
            )
          else
            Btn(L('Afficher', 'Show', 'اعرض'), kind: BtnKind.secondary, onPressed: () => app.switchHousehold(h.id)),
        ]),
        const SizedBox(height: 12),
        if (h.devices.isEmpty)
          Text(L('Aucun boîtier pour l\'instant.', 'No box yet.', 'ما فماش بواطة لتوّا.'), style: T.small(tg.mute))
        else
          for (final d in h.devices)
            Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: tg.sunken, borderRadius: BorderRadius.circular(kRadiusCtl)),
              child: Row(children: [
                Icon(LucideIcons300.cpu, size: 16, color: tg.ink),
                const SizedBox(width: 8),
                Expanded(
                  child: Text('${d.id} · ${d.kind == 'simulator' ? L('simulateur', 'simulator', 'سيمولاتور') : 'ESP32'}',
                      style: T.small(tg.ink).copyWith(fontWeight: FontWeight.w600)),
                ),
                Text(
                  d.online
                      ? L('En ligne', 'Online', 'متصل')
                      : d.lastSeenAt != null
                          ? '${L('vu à', 'seen at', 'آخر مرة')} ${f.time(d.lastSeenAt!)}'
                          : L('jamais connecté', 'never connected', 'عمرو ما تكونيكطا'),
                  style: T.small(d.online ? tg.success : tg.mute).copyWith(fontWeight: d.online ? FontWeight.w700 : FontWeight.w500),
                ),
              ]),
            ),
        if (_device != null) ...[const SizedBox(height: 10), DeviceKeyNotice(device: _device!)],
        if (_error != null) ...[const SizedBox(height: 10), TgBanner(tone: BannerTone.broken, child: Text(_error!))],
        if (_mode == _Mode.view) ...[
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 8, children: [
            Btn(L('Modifier', 'Edit', 'بدّل'), kind: BtnKind.secondary, icon: LucideIcons300.pencil, onPressed: () => setState(() => _mode = _Mode.edit)),
            Btn('ESP32', kind: BtnKind.secondary, icon: LucideIcons300.plus,
                onPressed: () => _guard(() async {
                      final d = await app.api.addDevice(h.id, 'esp32');
                      await app.refreshHouseholds();
                      setState(() => _device = d);
                    })),
            Btn(L('Simulateur', 'Simulator', 'سيمولاتور'), kind: BtnKind.secondary, icon: LucideIcons300.plus,
                onPressed: () => _guard(() async {
                      final d = await app.api.addDevice(h.id, 'simulator');
                      await app.refreshHouseholds();
                      setState(() => _device = d);
                    })),
            Btn(L('Supprimer', 'Delete', 'فسخ'), kind: BtnKind.danger, icon: LucideIcons300.trash2,
                onPressed: app.households.length <= 1 ? null : () => setState(() => _mode = _Mode.delete)),
          ]),
          if (app.households.length <= 1)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(L('Garde au moins un foyer', 'Keep at least one home', 'خلّي على الأقل دار وحدة'), style: T.caption(tg.mute).copyWith(fontSize: 12)),
            ),
        ],
        if (_mode == _Mode.edit)
          HouseholdForm(
            initial: HouseholdIn(
              name: h.name,
              address: h.address,
              occupants: h.occupants,
              subscribedKva: h.subscribedKva,
              alertMarginKwh: h.alertMarginKwh,
            ),
            submitLabel: L('Enregistrer', 'Save', 'سجّل'),
            onCancel: () => setState(() => _mode = _Mode.view),
            onSubmit: (body) async {
              await app.api.updateHousehold(h.id, body);
              await app.refreshHouseholds();
              if (h.id == app.currentHousehold?.id) app.refreshSettings();
              setState(() => _mode = _Mode.view);
            },
          ),
        if (_mode == _Mode.delete) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: tg.grenadeSoft, borderRadius: BorderRadius.circular(kRadiusCtl)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(
                L('Supprimer ce foyer efface ses boîtiers, toutes ses mesures, alertes, conseils, scores et appareils. C\'est définitif.',
                    'Deleting this home erases its boxes and all its readings, alerts, tips, scores and appliances. This cannot be undone.',
                    'فسخ الدار هذي يفسخ البواطات والقياسات والتنبيهات والنصائح والآلات الكل. ما يرجعش.'),
                style: T.small(tg.grenade).copyWith(fontSize: 14),
              ),
              const SizedBox(height: 10),
              TgField(
                label: L('Tape « ${h.name} » pour confirmer', 'Type "${h.name}" to confirm', 'اكتب « ${h.name} » باش تأكّد'),
                controller: _confirm,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 10),
              Wrap(spacing: 8, runSpacing: 8, children: [
                Btn(L('Supprimer définitivement', 'Delete for good', 'فسخ نهائيا'), kind: BtnKind.danger,
                    onPressed: _confirm.text.trim() != h.name
                        ? null
                        : () => _guard(() async {
                              await app.api.deleteHousehold(h.id);
                              await app.refreshHouseholds();
                            })),
                Btn(L('Annuler', 'Cancel', 'إلغاء'), kind: BtnKind.secondary, onPressed: () => setState(() => _mode = _Mode.view)),
              ]),
            ]),
          ),
        ],
      ]),
    );
  }
}

class _CurrentAppliances extends StatefulWidget {
  const _CurrentAppliances({super.key, required this.home});
  final Household home;
  @override
  State<_CurrentAppliances> createState() => _CurrentAppliancesState();
}

class _CurrentAppliancesState extends State<_CurrentAppliances> {
  List<ApplianceCatalogItem> _catalog = [];
  List<ApplianceIn>? _items;
  bool _saved = false, _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final api = AppScope.read(context).api;
      api.applianceCatalog().then((c) => mounted ? setState(() => _catalog = c) : null).catchError((_) => null);
      api.appliances().then((l) => mounted ? setState(() => _items = [...l]) : null).catchError((e) {
        if (mounted) setState(() => _error = '$e');
        return null;
      });
    });
  }

  Future<void> _save() async {
    final app = AppScope.read(context);
    setState(() {
      _busy = true;
      _error = null;
      _saved = false;
    });
    try {
      await app.api.replaceAppliances(cleanAppliances(_items!));
      await app.refreshHouseholds();
      if (mounted) setState(() => _saved = true);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionLabel('${L('Appareils de', 'Appliances of', 'الآلات متاع')} « ${widget.home.name} »'),
      if (_items == null)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Text(_error ?? L('Chargement…', 'Loading…', 'قاعد يتحمّل…'), style: T.small(tg.mute)),
        )
      else ...[
        ApplianceEditor(
          items: _items!,
          catalog: _catalog,
          onChanged: (x) => setState(() {
            _items = x;
            _saved = false;
          }),
        ),
        if (_error != null) ...[const SizedBox(height: 12), TgBanner(tone: BannerTone.broken, child: Text(_error!))],
        const SizedBox(height: 12),
        Row(children: [
          Btn(L('Enregistrer les appareils', 'Save appliances', 'سجّل الآلات'), onPressed: _busy ? null : _save),
          const SizedBox(width: 12),
          if (_saved) Text(L('Enregistré', 'Saved', 'تسجّل'), style: T.small(tg.success).copyWith(fontWeight: FontWeight.w700)),
        ]),
      ],
    ]);
  }
}
