import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../screens/households_screen.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/i18n.dart';

/// "Ma maison ▾ / Tunis · en direct" of the design's header: opens the account's homes.
class HouseholdSwitcher extends StatelessWidget {
  const HouseholdSwitcher({super.key});

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final app = AppScope.of(context);
    final d = app.dashboard;
    final current = app.currentHousehold;
    final online = d?.device?.online == true && d?.live != null && d!.live!.stale == false;
    final place = current?.address?.split(',').first.trim();
    final status = d == null
        ? L('chargement…', 'loading…', 'قاعد يتحمّل…')
        : d.empty
            ? L('aucune mesure', 'no reading yet', 'ما فماش قياس')
            : online
                ? L('en direct', 'live', 'مباشر')
                : L('hors ligne', 'offline', 'مقطوع');
    return Semantics(
      button: true,
      label: L('Changer de foyer', 'Switch home', 'بدّل الدار'),
      child: InkWell(
        borderRadius: BorderRadius.circular(kRadiusCtl),
        onTap: () => showHouseholdSheet(context),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: kTap),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
            Row(mainAxisSize: MainAxisSize.min, children: [
              Flexible(
                child: Text(current?.name ?? d?.householdName ?? L('Ma maison', 'My home', 'داري'),
                    overflow: TextOverflow.ellipsis, style: T.h2(tg.ink).copyWith(fontWeight: FontWeight.w700)),
              ),
              const SizedBox(width: 6),
              Icon(LucideIcons300.chevronDown, size: 16, color: tg.ink),
            ]),
            Row(mainAxisSize: MainAxisSize.min, children: [
              if (online) ...[
                Container(width: 6, height: 6, decoration: BoxDecoration(color: tg.success, shape: BoxShape.circle)),
                const SizedBox(width: 6),
              ],
              Flexible(
                child: Text('${place != null && place.isNotEmpty ? '$place · ' : ''}$status',
                    overflow: TextOverflow.ellipsis, style: T.caption(tg.mute).copyWith(fontSize: 12)),
              ),
            ]),
          ]),
        ),
      ),
    );
  }
}

Future<void> showHouseholdSheet(BuildContext context) {
  final tg = context.tg;
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: tg.surface,
    showDragHandle: true,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusCard))),
    builder: (sheet) {
      final app = AppScope.of(sheet);
      final current = app.currentHousehold;
      return SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text(L('Mes foyers', 'My homes', 'دياري'), style: T.h2(tg.ink)),
          ),
          for (final h in app.households)
            InkWell(
              onTap: () {
                app.switchHousehold(h.id);
                Navigator.pop(sheet);
              },
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 56),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Row(children: [
                    Icon(LucideIcons300.house, size: 20, color: tg.mute),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(h.name, style: T.small(tg.ink).copyWith(fontSize: 14, fontWeight: FontWeight.w700)),
                        Text(
                          '${(h.address ?? '').isNotEmpty ? h.address : '${h.subscribedKva.toStringAsFixed(0)} kVA'}'
                          '${h.unreadAlerts > 0 ? ' · ${h.unreadAlerts} ${L('alerte(s)', 'alert(s)', 'تنبيه')}' : ''}',
                          style: T.caption(tg.mute).copyWith(fontSize: 12),
                        ),
                      ]),
                    ),
                    if (h.id == current?.id) Icon(LucideIcons300.check, size: 20, color: tg.link),
                  ]),
                ),
              ),
            ),
          Divider(color: tg.hairline, height: 1),
          InkWell(
            onTap: () {
              Navigator.pop(sheet);
              Navigator.of(context).push(MaterialPageRoute(builder: (_) => const HouseholdsScreen(adding: true)));
            },
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 56),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(children: [
                  Icon(LucideIcons300.plus, size: 20, color: tg.link),
                  const SizedBox(width: 12),
                  Text(L('Ajouter un foyer', 'Add a home', 'زيد دار'),
                      style: T.small(tg.link).copyWith(fontSize: 14, fontWeight: FontWeight.w700)),
                ]),
              ),
            ),
          ),
          const SizedBox(height: 8),
        ]),
      );
    },
  );
}
