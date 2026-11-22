import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/appliances.dart';
import '../util/format.dart';
import '../util/i18n.dart';
import 'ui.dart';

// "Ta formule STEG": the subscribed power decides the price grid (STEG low-voltage table
// of 1 May 2022). 1 and 2 kVA = tranche economique (62 and 96 millimes up to 100 kWh a
// month); 3 kVA and more = tranche normale (176 millimes from the first kWh). The prices
// shown come from the API, filtered the same way as the backend (Tariff.for_home).

const kEconomicMaxKva = 2.0;
const _economicKva = [1.0, 2.0];
const _normalKva = [3.0, 4.0, 6.0, 9.0, 12.0];

bool isEconomic(double kva) => kva > 0 && kva <= kEconomicMaxKva;

/// Electricity bands of the latest grid, as they apply to a home of [kva].
List<TrancheRow> stegBandsFor(Tariffs t, double kva) {
  final rows = t.tranches.where((r) => r.resource == 'electricity').toList()..sort((a, b) => a.minQty.compareTo(b.minQty));
  final latest = rows.fold<String>('', (a, r) => '${r.j['valid_from'] ?? ''}'.compareTo(a) > 0 ? '${r.j['valid_from']}' : a);
  final band = rows.where((r) => '${r.j['valid_from'] ?? ''}' == latest).toList();
  if (isEconomic(kva)) return band;
  final kept = band.where((r) => r.maxQty == null || r.maxQty! > 100).toList();
  if (kept.length == band.length || kept.isEmpty) return band;
  // Above 2 kVA the first band starts at 0 kWh (like the backend).
  return [TrancheRow({...kept.first.j, 'min_qty': 0}), ...kept.skip(1)];
}

/// "0 – 50 kWh", "Plus de 500 kWh"
String bandLabel(TrancheRow r, {String unit = 'kWh'}) => r.maxQty == null
    ? L('Plus de ${num(r.minQty)} $unit', 'Over ${num(r.minQty)} $unit', 'أكثر من ${num(r.minQty)} $unit')
    : '${r.minQty == 0 ? 0 : num(r.minQty + 1)} – ${num(r.maxQty!)} $unit';

class PowerPicker extends StatefulWidget {
  const PowerPicker({super.key, required this.kva, required this.onChanged});
  final double kva;
  final ValueChanged<double> onChanged;
  @override
  State<PowerPicker> createState() => _PowerPickerState();
}

class _PowerPickerState extends State<PowerPicker> {
  Tariffs? _tariffs;
  bool _help = false;
  late final _other = TextEditingController(text: _isListed(widget.kva) ? '' : num(widget.kva, decimals: 1, fixed: false));

  static bool _isListed(double kva) => _economicKva.contains(kva) || _normalKva.contains(kva);

  @override
  void initState() {
    super.initState();
    AppScope.read(context).api.tariffs().then((t) => mounted ? setState(() => _tariffs = t) : null).catchError((_) => null);
  }

  @override
  void dispose() {
    _other.dispose();
    super.dispose();
  }

  void _pick(double kva) {
    _other.clear();
    widget.onChanged(kva);
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final eco = isEconomic(widget.kva);
    final mil = L('mil.', 'mill.', 'مليم');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(L('Ta formule STEG', 'Your STEG plan', 'الفورمول متاع STEG'), style: T.small(tg.body).copyWith(fontSize: 14, fontWeight: FontWeight.w600)),
      const SizedBox(height: 8),
      Row(children: [
        Expanded(
          child: _Formula(
            selected: eco,
            title: L('Économique', 'Economy', 'اقتصادية'),
            sub: L('1 ou 2 kVA', '1 or 2 kVA', '1 ولا 2 kVA'),
            onTap: () => _pick(eco ? widget.kva : 2),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _Formula(
            selected: !eco,
            title: L('Normale', 'Standard', 'عادية'),
            sub: L('3 kVA et plus', '3 kVA and more', '3 kVA وأكثر'),
            onTap: () => _pick(eco ? 6 : widget.kva),
          ),
        ),
      ]),
      const SizedBox(height: 12),
      Text(L('Puissance souscrite', 'Subscribed power', 'القوة المشترك فيها'), style: T.small(tg.body).copyWith(fontWeight: FontWeight.w600)),
      const SizedBox(height: 8),
      Wrap(spacing: 8, runSpacing: 8, children: [
        for (final k in eco ? _economicKva : _normalKva)
          TgChip('${num(k)} kVA', active: widget.kva == k && _other.text.isEmpty, onTap: () => _pick(k)),
        if (!eco)
          SizedBox(
            width: 110,
            child: TextField(
              controller: _other,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              style: T.small(tg.ink).copyWith(fontSize: 14, fontWeight: FontWeight.w600),
              onChanged: (v) {
                final n = parseNum(v);
                if (n != null && n > kEconomicMaxKva && n <= 100) widget.onChanged(n);
                setState(() {});
              },
              decoration: InputDecoration(
                hintText: L('Autre', 'Other', 'أخرى'),
                constraints: const BoxConstraints(minHeight: 40, maxHeight: 40),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                suffixText: 'kVA',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(999), borderSide: BorderSide(color: tg.hairline)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(999), borderSide: BorderSide(color: tg.hairline)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(999), borderSide: BorderSide(color: tg.link, width: 2)),
              ),
            ),
          ),
      ]),
      const SizedBox(height: 12),
      Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: tg.sunken, borderRadius: BorderRadius.circular(kRadiusCtl)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(
            L('Prix du kWh selon ta consommation du mois', 'kWh price by your monthly use', 'سوم الـ kWh حسب استهلاك الشهر'),
            style: T.caption(tg.mute).copyWith(fontSize: 12, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 6),
          if (_tariffs == null)
            Text(L('Chargement…', 'Loading…', 'قاعد يتحمّل…'), style: T.small(tg.mute))
          else
            for (final r in stegBandsFor(_tariffs!, widget.kva))
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(children: [
                  Expanded(child: Text(bandLabel(r), style: T.small(tg.body))),
                  Text('${r.priceMillimes} $mil', style: T.small(tg.ink).copyWith(fontWeight: FontWeight.w700)),
                ]),
              ),
          const SizedBox(height: 6),
          Text(
            L('+ ${num(widget.kva, decimals: 1, fixed: false)} × 700 mil. par mois pour la puissance. Hors taxes.',
                '+ ${num(widget.kva, decimals: 1, fixed: false)} × 700 mill. a month for the power. Before taxes.',
                '+ ${num(widget.kva, decimals: 1, fixed: false)} × 700 مليم في الشهر للقوة. بلا أداءات.'),
            style: T.caption(tg.mute).copyWith(fontSize: 12),
          ),
        ]),
      ),
      Align(
        alignment: AlignmentDirectional.centerStart,
        child: TextButton.icon(
          onPressed: () => setState(() => _help = !_help),
          icon: Icon(_help ? LucideIcons300.chevronUp : LucideIcons300.circleHelp, size: 18, color: tg.link),
          label: Text(L('Comment choisir ?', 'How to choose?', 'كيفاش نختار؟'), style: T.small(tg.link).copyWith(fontWeight: FontWeight.w700)),
        ),
      ),
      if (_help) const PowerHelp(),
    ]);
  }
}

class _Formula extends StatelessWidget {
  const _Formula({required this.selected, required this.title, required this.sub, required this.onTap});
  final bool selected;
  final String title, sub;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return Semantics(
      selected: selected,
      button: true,
      child: Material(
        color: selected ? tg.primarySoft : tg.sunken,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(kRadiusCtl),
          side: BorderSide(color: selected ? tg.primary : Colors.transparent, width: 2),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(kRadiusCtl),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: T.h3(tg.ink)),
              Text(sub, style: T.small(tg.mute)),
            ]),
          ),
        ),
      ),
    );
  }
}

/// How to choose the subscribed power, from the STEG table (tarifsbt_fr.pdf).
class PowerHelp extends StatelessWidget {
  const PowerHelp({super.key});
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    Widget point(IconData icon, String text) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(padding: const EdgeInsets.only(top: 2), child: Icon(icon, size: 16, color: tg.link)),
            const SizedBox(width: 10),
            Expanded(child: Text(text, style: T.small(tg.body).copyWith(fontSize: 14, height: 1.5))),
          ]),
        );
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: tg.surface, borderRadius: BorderRadius.circular(kRadiusCtl), border: Border.all(color: tg.hairline)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        point(LucideIcons300.receipt,
            L('Regarde ta facture STEG : la « puissance souscrite » (en kVA) y est écrite. C\'est elle qui décide de ta formule, pas l\'appareil que tu possèdes.',
                'Look at your STEG bill: the "subscribed power" (in kVA) is printed on it. It decides your plan, not the appliances you own.',
                'شوف فاتورة STEG: « القوة المشترك فيها » (بالـ kVA) مكتوبة فيها. هي اللي تحدّد الفورمول، موش الآلات اللي عندك.')),
        point(LucideIcons300.leaf,
            L('1 ou 2 kVA = formule économique : jusqu\'à 50 kWh dans le mois, le kWh coûte 62 millimes ; de 51 à 100 kWh, 96 millimes. Au-delà, les prix rejoignent la formule normale.',
                '1 or 2 kVA = economy plan: up to 50 kWh in the month a kWh costs 62 millimes; 51 to 100 kWh, 96 millimes. Above that, prices join the standard plan.',
                '1 ولا 2 kVA = فورمول اقتصادية: حتى 50 kWh في الشهر الـ kWh بـ 62 مليم؛ من 51 لـ 100 kWh بـ 96 مليم. فوق هذا، الأسوام كيف الفورمول العادية.')),
        point(LucideIcons300.zap,
            L('3 kVA et plus = formule normale : 176 millimes jusqu\'à 200 kWh, 218 jusqu\'à 300, 341 jusqu\'à 500, 414 au-delà.',
                '3 kVA and more = standard plan: 176 millimes up to 200 kWh, 218 up to 300, 341 up to 500, 414 above.',
                '3 kVA وأكثر = فورمول عادية: 176 مليم حتى 200 kWh، 218 حتى 300، 341 حتى 500، 414 فوق.')),
        point(LucideIcons300.triangleAlert,
            L('Attention : la tranche atteinte s\'applique à tout le mois. Passer de 200 à 201 kWh fait payer les 201 kWh au prix de 218.',
                'Careful: the tranche reached applies to the whole month. Going from 200 to 201 kWh bills all 201 kWh at 218.',
                'رد بالك: الشريحة اللي توصلها تتطبّق على الشهر الكل. من 200 لـ 201 kWh، الكل يتحسب بـ 218.')),
        point(LucideIcons300.gauge,
            L('Chaque kVA coûte 700 millimes par mois (+ TVA 19 %), même sans consommer. Trop de kVA coûte pour rien ; trop peu, le disjoncteur saute quand plusieurs gros appareils tournent ensemble (clim, chauffe-eau, four).',
                'Each kVA costs 700 millimes a month (+ 19 % VAT), even with no use. Too many kVA cost for nothing; too few, the breaker trips when several big appliances run together (AC, water heater, oven).',
                'كل kVA بـ 700 مليم في الشهر (+ TVA 19 %)، حتى بلا استهلاك. برشا kVA تخلّص بلاش؛ قليل، الديجونكتور يطيح كيف برشا آلات كبار يخدمو مع بعضهم (كليما، سخّان، فور).')),
        Text(
          L('Source : tarifs STEG basse tension du 1er mai 2022, hors taxes (TVA 13 % sur l\'énergie, 5 + 1 millimes par kWh de taxes).',
              'Source: STEG low-voltage prices of 1 May 2022, before taxes (13 % VAT on energy, 5 + 1 millimes per kWh of taxes).',
              'المصدر: أسوام STEG الجهد المنخفض متاع 1 ماي 2022، بلا أداءات (TVA 13 % على الطاقة، 5 + 1 مليم لكل kWh أداءات).'),
          style: T.caption(tg.mute).copyWith(fontSize: 12),
        ),
      ]),
    );
  }
}
