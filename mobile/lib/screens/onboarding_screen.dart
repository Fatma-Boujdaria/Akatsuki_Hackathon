import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/appliances.dart';
import '../util/i18n.dart';
import '../widgets/appliance_editor.dart';
import '../widgets/fields.dart';
import '../widgets/logo.dart';
import '../widgets/status.dart';
import '../widgets/ui.dart';

// First-time setup (frontend/src/pages/Onboarding.tsx): 1. the home, 2. its appliances,
// 3. the box or the simulator. Also opened from "Mes foyers" for a new home, at step 2.

enum _Step { home, appliances, device }

class OnboardingScreen extends StatefulWidget {
  /// Start at the appliances of the current home (a home just added from "Mes foyers").
  const OnboardingScreen({super.key, this.resumeAppliances = false});
  final bool resumeAppliances;
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  late _Step _step = widget.resumeAppliances ? _Step.appliances : _Step.home;
  final _name = TextEditingController(text: L('Ma maison', 'My home', 'داري'));
  final _address = TextEditingController();
  final _occupants = TextEditingController();
  final _kva = TextEditingController(text: '6');
  final _margin = TextEditingController(text: '10');
  List<ApplianceCatalogItem> _catalog = [];
  List<ApplianceIn> _items = [];
  DeviceCreated? _device;
  String? _error;
  bool _busy = false;

  AppState get _app => AppScope.read(context);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _app.setOnboarding(true);
      _app.api.applianceCatalog().then((c) => mounted ? setState(() => _catalog = c) : null).catchError((_) => null);
      if (widget.resumeAppliances) {
        _app.api.appliances().then((list) => mounted ? setState(() => _items = [...list]) : null).catchError((_) => null);
      }
    });
  }

  @override
  void dispose() {
    for (final c in [_name, _address, _occupants, _kva, _margin]) {
      c.dispose();
    }
    super.dispose();
  }

  double get _kvaValue => parseNum(_kva.text) ?? 0;
  int get _marginValue => (parseNum(_margin.text) ?? 0).round().clamp(0, 200);

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

  Future<void> _saveHome() => _run(() async {
        final occ = parseNum(_occupants.text)?.round();
        final created = await _app.api.createHousehold(HouseholdIn(
          name: _name.text.trim().isEmpty ? L('Ma maison', 'My home', 'داري') : _name.text.trim(),
          address: _address.text,
          occupants: occ?.clamp(1, 30),
          subscribedKva: _kvaValue,
          alertMarginKwh: _marginValue,
        ));
        _app.switchHousehold(created.id);
        await _app.refreshHouseholds();
        setState(() => _step = _Step.appliances);
      });

  Future<void> _saveAppliances() => _run(() async {
        await _app.api.replaceAppliances(cleanAppliances(_items));
        await _app.refreshHouseholds();
        setState(() => _step = _Step.device);
      });

  Future<void> _addDevice(String kind) => _run(() async {
        final id = _app.currentHousehold?.id;
        if (id == null) return;
        final d = await _app.api.addDevice(id, kind);
        await _app.refreshHouseholds();
        setState(() => _device = d);
      });

  void _finish() {
    _app.setOnboarding(false);
    _app.refreshDashboard();
    _app.refreshSettings();
    final nav = Navigator.of(context);
    if (nav.canPop()) nav.popUntil((r) => r.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final app = AppScope.of(context);
    final firstName = (app.user?.fullName ?? '').trim().split(' ').first;
    final isNewHome = widget.resumeAppliances || app.households.length > 1 || (app.households.length == 1 && _step == _Step.home);
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(kGutter, 16, kGutter, 32),
          children: [
            Row(children: [
              const LogoMark(size: 40),
              const Spacer(),
              const LanguageSwitch(),
            ]),
            const SizedBox(height: 24),
            Text(
              isNewHome
                  ? L('Nouveau foyer', 'New home', 'دار جديدة')
                  : '${L('Bienvenue', 'Welcome', 'مرحبا')}${firstName.isEmpty ? '' : ', $firstName'}',
              style: T.display(tg.ink),
            ),
            const SizedBox(height: 4),
            Text(
              L('Trois étapes pour que Tranche Guard comprenne ton foyer.', 'Three steps so Tranche Guard understands your home.',
                  'ثلاثة مراحل باش Tranche Guard يفهم الدار متاعك.'),
              style: T.body(tg.mute),
            ),
            const SizedBox(height: 18),
            _Steps(step: _step),
            const SizedBox(height: 18),
            if (_error != null) ...[TgBanner(tone: BannerTone.broken, child: Text(_error!)), const SizedBox(height: 14)],
            ...switch (_step) {
              _Step.home => [_homeForm(tg)],
              _Step.appliances => _appliances(),
              _Step.device => [_deviceCard(tg)],
            },
          ],
        ),
      ),
    );
  }

  Widget _homeForm(TG tg) => TgCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          TgField(label: L('Nom du foyer', 'Home name', 'اسم الدار'), controller: _name),
          const SizedBox(height: 14),
          TgField(label: L('Adresse ou ville', 'Address or city', 'العنوان ولا المدينة'), controller: _address, hint: 'Tunis, La Marsa'),
          const SizedBox(height: 14),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: TgField(
                label: L('Occupants', 'Occupants', 'عدد السكان'),
                controller: _occupants,
                keyboardType: TextInputType.number,
                help: L('facultatif', 'optional', 'اختياري'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TgField(
                label: L('Puissance souscrite', 'Subscribed power', 'القوة المشترك فيها'),
                controller: _kva,
                suffixText: 'kVA',
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                help: L('sur ta facture STEG', 'on your STEG bill', 'مكتوبة في فاتورة STEG'),
                onChanged: (_) => setState(() {}),
              ),
            ),
          ]),
          const SizedBox(height: 14),
          TgField(
            label: L('Marge d\'alerte', 'Alert margin', 'هامش التنبيه'),
            controller: _margin,
            suffixText: 'kWh',
            keyboardType: TextInputType.number,
            onChanged: (_) => setState(() {}),
            help: L('Préviens-moi $_marginValue kWh avant la tranche suivante.', 'Warn me $_marginValue kWh before the next tranche.',
                'نبّهني $_marginValue kWh قبل الشريحة الجاية.'),
          ),
          const SizedBox(height: 18),
          Btn(L('Continuer', 'Continue', 'كمّل'), onPressed: _busy || _kvaValue <= 0 ? null : _saveHome, expand: true, large: true),
        ]),
      );

  List<Widget> _appliances() => [
        ApplianceEditor(items: _items, catalog: _catalog, onChanged: (x) => setState(() => _items = x)),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(
            child: Btn(L('Enregistrer mes appareils', 'Save my appliances', 'سجّل الآلات'),
                onPressed: _busy ? null : _saveAppliances, expand: true, large: true),
          ),
          const SizedBox(width: 10),
          Btn(L('Plus tard', 'Later', 'من بعد'), kind: BtnKind.secondary, large: true,
              onPressed: _busy ? null : () => setState(() => _step = _Step.device)),
        ]),
      ];

  Widget _deviceCard(TG tg) => TgCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(L('Ton boîtier de mesure', 'Your monitoring box', 'البواطة متاع القياس'), style: T.h2(tg.ink)),
          const SizedBox(height: 8),
          Text(
            L('Le boîtier ESP32 (PZEM-004T pour l\'électricité, YF-S201 pour l\'eau) envoie une mesure toutes les 5 s. Sans boîtier, le simulateur envoie les mêmes données.',
                'The ESP32 box (PZEM-004T for electricity, YF-S201 for water) sends a reading every 5 s. Without one, the simulator sends the same data.',
                'البواطة ESP32 (PZEM-004T للضو، YF-S201 للماء) تبعث قياس كل 5 ثواني. بلاش بواطة، السيمولاتور يبعث نفس المعطيات.'),
            style: T.small(tg.body).copyWith(fontSize: 14),
          ),
          const SizedBox(height: 16),
          if (_device != null)
            DeviceKeyNotice(device: _device!)
          else ...[
            Btn(L('Ajouter mon boîtier ESP32', 'Add my ESP32 box', 'زيد البواطة ESP32'),
                kind: BtnKind.secondary, icon: LucideIcons300.cpu, expand: true, onPressed: _busy ? null : () => _addDevice('esp32')),
            const SizedBox(height: 10),
            Btn(L('Utiliser le simulateur', 'Use the simulator', 'استعمل السيمولاتور'),
                kind: BtnKind.secondary, expand: true, onPressed: _busy ? null : () => _addDevice('simulator')),
          ],
          const SizedBox(height: 16),
          Btn(L('Voir mon tableau de bord', 'See my dashboard', 'شوف الداشبورد متاعي'),
              icon: LucideIcons300.circleCheck, expand: true, large: true, onPressed: _finish),
        ]),
      );
}

class _Steps extends StatelessWidget {
  const _Steps({required this.step});
  final _Step step;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final steps = [
      (_Step.home, LucideIcons300.house, L('Mon foyer', 'My home', 'داري')),
      (_Step.appliances, LucideIcons300.plug, L('Mes appareils', 'My appliances', 'الآلات')),
      (_Step.device, LucideIcons300.cpu, L('Mon boîtier', 'My box', 'البواطة')),
    ];
    return Row(children: [
      for (var i = 0; i < steps.length; i++) ...[
        if (i > 0) const SizedBox(width: 8),
        Expanded(
          child: Builder(builder: (context) {
            final at = steps.indexWhere((s) => s.$1 == step);
            final (bg, fg) = i == at
                ? (tg.chipActive, tg.onChipActive)
                : i < at
                    ? (tg.successSoft, tg.success)
                    : (tg.surface, tg.mute);
            return Semantics(
              label: steps[i].$3,
              selected: i == at,
              child: Container(
                height: 36,
                decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(steps[i].$2, size: 16, color: fg),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(steps[i].$3,
                        overflow: TextOverflow.ellipsis, style: T.caption(fg).copyWith(fontSize: 12, fontWeight: FontWeight.w700)),
                  ),
                ]),
              ),
            );
          }),
        ),
      ],
    ]);
  }
}

/// Device id and its key, shown once (onboarding and "Mes foyers").
class DeviceKeyNotice extends StatelessWidget {
  const DeviceKeyNotice({super.key, required this.device});
  final DeviceCreated device;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return TgBanner(
      tone: BannerTone.info,
      title: L('Appareil ajouté', 'Device added', 'البواطة تزادت'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('${L('Identifiant', 'ID', 'المعرّف')} : ${device.device.id}'),
        const SizedBox(height: 4),
        Text('${L('Clé de l\'appareil (affichée une seule fois)', 'Device key (shown once)', 'مفتاح البواطة (يتورّى مرة برك)')} :'),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(color: tg.sunken, borderRadius: BorderRadius.circular(kRadiusCtl)),
          child: SelectableText(device.apiKey, textDirection: TextDirection.ltr, style: T.small(tg.ink)),
        ),
      ]),
    );
  }
}
