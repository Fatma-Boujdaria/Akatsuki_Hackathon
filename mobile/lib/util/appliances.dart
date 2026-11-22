import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import 'i18n.dart';

// Same list as frontend/src/lib/appliances.tsx. Typical values come from the backend
// catalogue (/api/appliances/catalog), the source of truth for estimates.

const catalogOrder = [
  'air_conditioner',
  'refrigerator',
  'washing_machine',
  'television',
  'water_heater',
  'oven',
  'microwave',
  'dishwasher',
  'computer',
  'lighting',
  'electric_heater',
  'fan',
  'iron',
  'kettle',
  'router',
  'water_pump',
];

IconData applianceIcon(String category) => switch (category) {
      'air_conditioner' => LucideIcons300.airVent,
      'refrigerator' => LucideIcons300.refrigerator,
      'washing_machine' => LucideIcons300.washingMachine,
      'television' => LucideIcons300.tv,
      'water_heater' => LucideIcons300.heater,
      'oven' => LucideIcons300.cookingPot,
      'microwave' => LucideIcons300.microwave,
      'dishwasher' => LucideIcons300.utensils,
      'computer' => LucideIcons300.laptop,
      'lighting' => LucideIcons300.lamp,
      'electric_heater' => LucideIcons300.flame,
      'fan' => LucideIcons300.fan,
      'iron' => LucideIcons300.shirt,
      'kettle' => LucideIcons300.coffee,
      'router' => LucideIcons300.router,
      'water_pump' => LucideIcons300.waves,
      _ => LucideIcons300.plug,
    };

String applianceLabel(String category) => switch (category) {
      'air_conditioner' => L('Climatiseur', 'Air conditioner', 'كليماتيزور'),
      'refrigerator' => L('Réfrigérateur', 'Refrigerator', 'فريجيدار'),
      'washing_machine' => L('Machine à laver', 'Washing machine', 'ماكينة صابون'),
      'television' => L('Télévision', 'Television', 'تلفزة'),
      'water_heater' => L('Chauffe-eau électrique', 'Electric water heater', 'سخّان ماء كهربائي'),
      'oven' => L('Four électrique', 'Electric oven', 'فور كهربائي'),
      'microwave' => L('Micro-ondes', 'Microwave', 'ميكروأوند'),
      'dishwasher' => L('Lave-vaisselle', 'Dishwasher', 'ماكينة ماعون'),
      'computer' => L('Ordinateur', 'Computer', 'أورديناتور'),
      'lighting' => L('Éclairage (par ampoule)', 'Lighting (per bulb)', 'الضو (لكل لمبة)'),
      'electric_heater' => L('Chauffage électrique', 'Electric heater', 'شوفاج كهربائي'),
      'fan' => L('Ventilateur', 'Fan', 'مروحة'),
      'iron' => L('Fer à repasser', 'Iron', 'مكواة'),
      'kettle' => L('Bouilloire', 'Kettle', 'بوايلوار'),
      'router' => L('Box internet', 'Internet box', 'مودام'),
      'water_pump' => L('Pompe à eau', 'Water pump', 'بومبة ماء'),
      _ => L('Autre appareil', 'Other appliance', 'آلة أخرى'),
    };

/// kWh a month for one line of the profile (an estimate, never a measurement).
double estimateKwh(ApplianceIn a, List<ApplianceCatalogItem> catalog) {
  ApplianceCatalogItem? typical;
  for (final c in catalog) {
    if (c.category == a.category) typical = c;
  }
  final power = a.powerW ?? typical?.typicalPowerW ?? 100;
  final hours = a.hoursPerDay ?? typical?.typicalHoursPerDay ?? 1;
  return a.quantity * power * hours * 30 / 1000;
}

/// Values the API accepts: empty name -> the category label, out-of-range numbers -> typical.
List<ApplianceIn> cleanAppliances(List<ApplianceIn> items) {
  int? hour(int? h) => h == null || h < 0 || h > 23 ? null : h;
  return [
    for (final a in items)
      ApplianceIn(
        category: a.category,
        name: a.name.trim().isEmpty ? applianceLabel(a.category) : a.name.trim(),
        quantity: a.quantity.clamp(1, 100),
        powerW: a.powerW != null && a.powerW! > 0 ? a.powerW : null,
        hoursPerDay: a.hoursPerDay != null && a.hoursPerDay! >= 0 && a.hoursPerDay! <= 24 ? a.hoursPerDay : null,
        startHour: hour(a.startHour),
        endHour: hour(a.endHour),
      ),
  ];
}

ApplianceIn copyAppliance(ApplianceIn a,
        {String? name, int? quantity, double? Function()? powerW, double? Function()? hoursPerDay, int? Function()? startHour, int? Function()? endHour}) =>
    ApplianceIn(
      category: a.category,
      name: name ?? a.name,
      quantity: quantity ?? a.quantity,
      powerW: powerW != null ? powerW() : a.powerW,
      hoursPerDay: hoursPerDay != null ? hoursPerDay() : a.hoursPerDay,
      startHour: startHour != null ? startHour() : a.startHour,
      endHour: endHour != null ? endHour() : a.endHour,
    );

/// "1,5" or "1.5" -> 1.5; empty or not a number -> null.
double? parseNum(String v) => v.trim().isEmpty ? null : double.tryParse(v.trim().replaceAll(',', '.'));
