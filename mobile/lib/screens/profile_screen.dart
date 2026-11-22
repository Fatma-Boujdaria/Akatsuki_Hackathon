import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../state/app_state.dart';
import '../theme.dart';
import '../util/format.dart';
import '../util/i18n.dart';
import '../widgets/fields.dart';
import '../widgets/ui.dart';
import 'households_screen.dart';
import 'settings_screen.dart';
import 'shell.dart';

/// "Profil et paramètres" artboard (frontend/src/pages/Profile.tsx): the phone's hub to
/// every other section.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final app = AppScope.of(context);
    final user = app.user;
    final current = app.currentHousehold;
    final d = app.dashboard;
    final alerts = d?.activeAlerts.length ?? 0;
    final device = d?.device;
    void push(Widget w) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => w));

    return PageList(
      onRefresh: () => Future.wait([app.refreshDashboard(), app.refreshHouseholds()]),
      children: [
        PageHeader(title: L('Profil et paramètres', 'Profile and settings', 'الحساب والإعدادات')),
        TgCard(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(children: [
            Container(
              width: kTap,
              height: kTap,
              alignment: Alignment.center,
              decoration: const BoxDecoration(color: TG.bahr, shape: BoxShape.circle),
              child: Text(user?.initial ?? '?', style: T.h3(Colors.white).copyWith(fontSize: 17, fontWeight: FontWeight.w800)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(
                  '${current?.name ?? L('Ma maison', 'My home', 'داري')}${(current?.address ?? '').isNotEmpty ? ' · ${current!.address!.split(',').first.trim()}' : ''}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: T.h3(tg.ink),
                ),
                Text(user?.email ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, textDirection: TextDirection.ltr, style: T.small(tg.mute)),
              ]),
            ),
          ]),
        ),
        SectionLabel(L('Mon espace', 'My space', 'فضائي')),
        ListGroup(children: [
          ListRow(
            icon: LucideIcons300.bell,
            label: L('Alertes et notifications', 'Alerts and notifications', 'التنبيهات'),
            value: alerts > 0 ? '$alerts' : null,
            onTap: () => Shell.of(context).openAlerts(),
          ),
          ListRow(
            icon: LucideIcons300.warehouse,
            label: L('Mes foyers et appareils', 'My homes and appliances', 'دياري والآلات'),
            value: '${app.households.length}',
            onTap: () => push(const HouseholdsScreen()),
          ),
        ]),
        SectionLabel(L('Appareil', 'Device', 'البواطة')),
        ListGroup(children: [
          ListRow(
            icon: LucideIcons300.cpu,
            label: device != null ? '${L('Boîtier', 'Box', 'بواطة')} ${device.id}' : L('Aucun boîtier', 'No box', 'ما فماش بواطة'),
            valueWidget: device == null
                ? null
                : Row(mainAxisSize: MainAxisSize.min, children: [
                    if (device.online) ...[
                      Container(width: 8, height: 8, decoration: BoxDecoration(color: tg.success, shape: BoxShape.circle)),
                      const SizedBox(width: 6),
                    ],
                    Text(
                      device.online
                          ? '${L('En ligne', 'Online', 'متصل')}${d?.live != null ? ' · ${shortAge(d!.live!.ageS)}' : ''}'
                          : L('Hors ligne', 'Offline', 'مقطوع'),
                      style: T.small(device.online ? tg.success : tg.mute).copyWith(fontWeight: device.online ? FontWeight.w700 : FontWeight.w500),
                    ),
                  ]),
            onTap: () => push(const SettingsScreen()),
          ),
        ]),
        SectionLabel(L('Réglages', 'Settings', 'الإعدادات')),
        ListGroup(children: [
          ListRow(
            icon: LucideIcons300.slidersHorizontal,
            label: L('Paramètres du foyer et du compte', 'Home and account settings', 'إعدادات الدار والحساب'),
            onTap: () => push(const SettingsScreen()),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Align(alignment: AlignmentDirectional.centerStart, child: LanguageSwitch()),
          ),
        ]),
        SectionLabel(L('Compte', 'Account', 'الحساب')),
        ListGroup(children: [
          ListRow(
            icon: isRtl ? LucideIcons300.logIn : LucideIcons300.logOut,
            label: L('Se déconnecter', 'Log out', 'اخرج'),
            danger: true,
            onTap: app.logout,
          ),
        ]),
      ],
    );
  }
}
