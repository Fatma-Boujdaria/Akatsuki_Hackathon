import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../theme.dart';
import '../util/appliances.dart';
import '../util/format.dart' as f;
import '../util/i18n.dart';
import 'ui.dart';

// The home's appliance profile (frontend/src/components/ApplianceEditor.tsx): what is in
// the home, how many, how long it runs. It gives an ESTIMATED baseline, never a
// measurement of one appliance.

class ApplianceEditor extends StatefulWidget {
  const ApplianceEditor({super.key, required this.items, required this.onChanged, required this.catalog});
  final List<ApplianceIn> items;
  final ValueChanged<List<ApplianceIn>> onChanged;
  final List<ApplianceCatalogItem> catalog;

  @override
  State<ApplianceEditor> createState() => _ApplianceEditorState();
}

class _ApplianceEditorState extends State<ApplianceEditor> {
  String? _open;

  List<ApplianceIn> get items => widget.items;

  int _byCat(String c) => items.indexWhere((i) => i.category == c);

  ApplianceCatalogItem? _typical(String c) {
    for (final t in widget.catalog) {
      if (t.category == c) return t;
    }
    return null;
  }

  void _toggle(String category) {
    final idx = _byCat(category);
    if (idx >= 0) {
      if (_open == category) {
        widget.onChanged([...items]..removeAt(idx));
        setState(() => _open = null);
      } else {
        setState(() => _open = category);
      }
      return;
    }
    widget.onChanged([
      ...items,
      ApplianceIn(category: category, name: applianceLabel(category), quantity: category == 'lighting' ? 6 : 1),
    ]);
    setState(() => _open = category);
  }

  void _update(int idx, ApplianceIn a) => widget.onChanged([...items]..[idx] = a);

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final total = items.fold<double>(0, (s, a) => s + estimateKwh(a, widget.catalog));
    final month = L('mois', 'month', 'شهر');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(
        L('Touche un appareil pour l\'ajouter, touche-le encore pour le retirer. Laisse vide ce que tu ne connais pas : on prend une valeur typique.',
            'Tap an appliance to add it, tap again to remove it. Leave empty what you don\'t know: a typical value is used.',
            'انقر على آلة باش تزيدها، وعاود انقر باش تنحّيها. اللي ما تعرفوش خلّيه فارغ: ناخذو قيمة عادية.'),
        style: T.small(tg.mute),
      ),
      const SizedBox(height: 12),
      for (final cat in catalogOrder) ...[
        _CatalogTile(
          category: cat,
          item: _byCat(cat) >= 0 ? items[_byCat(cat)] : null,
          typical: _typical(cat),
          catalog: widget.catalog,
          open: _open == cat,
          onTap: () => _toggle(cat),
          onChanged: (a) => _update(_byCat(cat), a),
        ),
        const SizedBox(height: 10),
      ],
      for (var i = 0; i < items.length; i++)
        if (items[i].category == 'custom') ...[
          _CustomTile(
            key: ObjectKey(items[i].category + i.toString()),
            item: items[i],
            catalog: widget.catalog,
            onChanged: (a) => _update(i, a),
            onRemove: () => widget.onChanged([...items]..removeAt(i)),
          ),
          const SizedBox(height: 10),
        ],
      Btn(
        L('Ajouter un appareil personnalisé', 'Add a custom appliance', 'زيد آلة خاصة'),
        kind: BtnKind.secondary,
        icon: LucideIcons300.plus,
        expand: true,
        onPressed: () => widget.onChanged([...items, ApplianceIn(category: 'custom', name: '')]),
      ),
      const SizedBox(height: 12),
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: tg.sunken, borderRadius: BorderRadius.circular(kRadiusCard)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${L('Profil estimé', 'Estimated profile', 'البروفيل المقدّر')} : ≈ ${f.kwh(total)} / $month',
              style: T.h3(tg.ink)),
          const SizedBox(height: 4),
          Text(
            L('Une estimation d\'après ce que tu déclares, pas une mesure appareil par appareil : ton boîtier mesure la maison entière.',
                'An estimate from what you declare, not a per-appliance measurement: your box measures the whole house.',
                'تقدير على حساب اللي صرّحت بيه، موش قياس لكل آلة: البواطة تقيس الدار الكل.'),
            style: T.caption(tg.mute).copyWith(fontSize: 12, height: 1.4),
          ),
        ]),
      ),
    ]);
  }
}

class _CatalogTile extends StatelessWidget {
  const _CatalogTile({
    required this.category,
    required this.item,
    required this.typical,
    required this.catalog,
    required this.open,
    required this.onTap,
    required this.onChanged,
  });
  final String category;
  final ApplianceIn? item;
  final ApplianceCatalogItem? typical;
  final List<ApplianceCatalogItem> catalog;
  final bool open;
  final VoidCallback onTap;
  final ValueChanged<ApplianceIn> onChanged;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final selected = item != null;
    final sub = selected
        ? '× ${item!.quantity} · ≈ ${f.kwh(estimateKwh(item!, catalog))}/${L('mois', 'mo', 'شهر')}'
        : typical != null
            ? '≈ ${f.num(typical!.typicalPowerW)} W · ${f.num(typical!.typicalHoursPerDay, decimals: 1, fixed: false)} h/${L('j', 'd', 'نهار')}'
            : '';
    return Container(
      decoration: BoxDecoration(
        color: tg.surface,
        borderRadius: BorderRadius.circular(kRadiusCard),
        border: Border.all(color: selected ? tg.link : Colors.transparent, width: 2),
      ),
      padding: const EdgeInsets.all(10),
      child: Column(children: [
        Semantics(
          selected: selected,
          button: true,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(kRadiusCtl),
            child: Row(children: [
              IconTile(icon: applianceIcon(category), tone: selected ? Tone.elec : Tone.neutral),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(applianceLabel(category), style: T.small(tg.ink).copyWith(fontSize: 14, fontWeight: FontWeight.w700)),
                  if (sub.isNotEmpty) Text(sub, style: T.caption(tg.mute).copyWith(fontSize: 12)),
                ]),
              ),
              if (selected) Icon(LucideIcons300.check, size: 20, color: tg.link),
            ]),
          ),
        ),
        if (selected && open) _ItemDetails(item: item!, typical: typical, catalog: catalog, onChanged: onChanged),
      ]),
    );
  }
}

class _CustomTile extends StatelessWidget {
  const _CustomTile({super.key, required this.item, required this.catalog, required this.onChanged, required this.onRemove});
  final ApplianceIn item;
  final List<ApplianceCatalogItem> catalog;
  final ValueChanged<ApplianceIn> onChanged;
  final VoidCallback onRemove;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: tg.surface,
        borderRadius: BorderRadius.circular(kRadiusCard),
        border: Border.all(color: tg.link, width: 2),
      ),
      child: Column(children: [
        Row(children: [
          IconTile(icon: applianceIcon('custom'), tone: Tone.elec),
          const SizedBox(width: 12),
          Expanded(
            child: Text(item.name.isEmpty ? L('Appareil personnalisé', 'Custom appliance', 'آلة خاصة') : item.name,
                style: T.small(tg.ink).copyWith(fontSize: 14, fontWeight: FontWeight.w700)),
          ),
        ]),
        _ItemDetails(item: item, catalog: catalog, onChanged: onChanged, onRemove: onRemove),
      ]),
    );
  }
}

class _ItemDetails extends StatelessWidget {
  const _ItemDetails({required this.item, this.typical, required this.catalog, required this.onChanged, this.onRemove});
  final ApplianceIn item;
  final ApplianceCatalogItem? typical;
  final List<ApplianceCatalogItem> catalog;
  final ValueChanged<ApplianceIn> onChanged;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    String fmt(num? v) => v == null ? '' : f.num(v.toDouble(), decimals: 1, fixed: false);
    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.only(top: 10),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: tg.hairline))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (item.category == 'custom') ...[
          SmallField(
            label: L('Nom de l\'appareil', 'Appliance name', 'اسم الآلة'),
            initial: item.name,
            text: true,
            onChanged: (v) => onChanged(copyAppliance(item, name: v)),
          ),
          const SizedBox(height: 10),
        ],
        Row(children: [
          Expanded(child: Text(L('Quantité', 'Quantity', 'العدد'), style: T.small(tg.body).copyWith(fontSize: 14, fontWeight: FontWeight.w600))),
          QtyStepper(value: item.quantity, onChanged: (q) => onChanged(copyAppliance(item, quantity: q))),
        ]),
        const SizedBox(height: 10),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: SmallField(
              label: L('Puissance', 'Power', 'القوة'),
              suffix: 'W',
              initial: fmt(item.powerW),
              hint: typical != null ? fmt(typical!.typicalPowerW) : '100',
              help: L('si tu la connais', 'if you know it', 'كان تعرفها'),
              onChanged: (v) => onChanged(copyAppliance(item, powerW: () => parseNum(v))),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: SmallField(
              label: L('Usage par jour', 'Use per day', 'الاستعمال في النهار'),
              suffix: 'h',
              initial: fmt(item.hoursPerDay),
              hint: typical != null ? fmt(typical!.typicalHoursPerDay) : '1',
              onChanged: (v) => onChanged(copyAppliance(item, hoursPerDay: () => parseNum(v))),
            ),
          ),
        ]),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(
            child: SmallField(
              label: L('Souvent de', 'Usually from', 'عادة من'),
              suffix: 'h',
              initial: item.startHour?.toString() ?? '',
              hint: '—',
              onChanged: (v) => onChanged(copyAppliance(item, startHour: () => parseNum(v)?.round())),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: SmallField(
              label: L('jusqu\'à', 'until', 'حتى'),
              suffix: 'h',
              initial: item.endHour?.toString() ?? '',
              hint: '—',
              onChanged: (v) => onChanged(copyAppliance(item, endHour: () => parseNum(v)?.round())),
            ),
          ),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(
            child: Text(
              '≈ ${f.kwh(estimateKwh(item, catalog))} / ${L('mois', 'month', 'شهر')} · ${L('estimation', 'estimate', 'تقدير')}',
              style: T.small(tg.mute),
            ),
          ),
          if (onRemove != null)
            IconButton(
              tooltip: L('Retirer', 'Remove', 'نحّي'),
              onPressed: onRemove,
              style: IconButton.styleFrom(backgroundColor: tg.grenadeSoft),
              icon: Icon(LucideIcons300.trash2, size: 18, color: tg.grenade),
            ),
        ]),
      ]),
    );
  }
}

/// − 2 + with 44 px round buttons.
class QtyStepper extends StatelessWidget {
  const QtyStepper({super.key, required this.value, required this.onChanged, this.min = 1, this.max = 100});
  final int value, min, max;
  final ValueChanged<int> onChanged;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    Widget round(IconData icon, String label, int next) => Semantics(
          button: true,
          label: label,
          excludeSemantics: true,
          child: Material(
            color: tg.sunken,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => onChanged(next.clamp(min, max)),
              child: SizedBox.square(dimension: kTap, child: Icon(icon, size: 16, color: tg.ink)),
            ),
          ),
        );
    return Row(mainAxisSize: MainAxisSize.min, children: [
      round(LucideIcons300.minus, L('Moins', 'Less', 'أقل'), value - 1),
      SizedBox(width: 36, child: Text('$value', textAlign: TextAlign.center, style: T.h3(tg.ink).copyWith(fontSize: 16, fontWeight: FontWeight.w800))),
      round(LucideIcons300.plus, L('Plus', 'More', 'أكثر'), value + 1),
    ]);
  }
}

/// A compact field that keeps its own text (numbers typed with , or .).
class SmallField extends StatefulWidget {
  const SmallField({
    super.key,
    required this.label,
    required this.initial,
    required this.onChanged,
    this.suffix,
    this.hint,
    this.help,
    this.text = false,
  });
  final String label, initial;
  final String? suffix, hint, help;
  final bool text;
  final ValueChanged<String> onChanged;
  @override
  State<SmallField> createState() => _SmallFieldState();
}

class _SmallFieldState extends State<SmallField> {
  late final _c = TextEditingController(text: widget.initial);
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(widget.label, style: T.small(tg.body).copyWith(fontWeight: FontWeight.w600)),
      const SizedBox(height: 6),
      TextField(
        controller: _c,
        keyboardType: widget.text ? TextInputType.text : const TextInputType.numberWithOptions(decimal: true),
        onChanged: widget.onChanged,
        style: T.body(tg.ink).copyWith(fontWeight: FontWeight.w500),
        decoration: InputDecoration(
          hintText: widget.hint,
          constraints: const BoxConstraints(minHeight: 48),
          suffixIcon: widget.suffix == null
              ? null
              : Padding(
                  padding: const EdgeInsetsDirectional.only(end: 12),
                  child: Align(widthFactor: 1, child: Text(widget.suffix!, style: T.small(tg.mute))),
                ),
        ),
      ),
      if (widget.help != null) ...[const SizedBox(height: 4), Text(widget.help!, style: T.caption(tg.mute).copyWith(fontSize: 12))],
    ]);
  }
}
