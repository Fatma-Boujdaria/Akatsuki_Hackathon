import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../state/app_state.dart';
import '../theme.dart';
import '../util/i18n.dart';
import '../widgets/household_switcher.dart';
import '../widgets/status.dart';
import 'alerts_screen.dart';
import 'challenges_screen.dart';
import 'electricity_screen.dart';
import 'home_screen.dart';
import 'profile_screen.dart';
import 'water_screen.dart';

/// App frame of the design: floating pill navigation (Accueil, Électricité, Eau, Défis,
/// Profil); the home picker, bell and avatar sit on the home screen only.
class Shell extends StatefulWidget {
  const Shell({super.key});
  @override
  State<Shell> createState() => ShellState();

  static ShellState of(BuildContext context) => context.findAncestorStateOfType<ShellState>()!;
}

class ShellState extends State<Shell> {
  int _index = 0;

  /// Switch tab from inside a screen (e.g. "Voir l'eau" -> Eau).
  void go(int index) => setState(() => _index = index);

  /// Alerts and tips, above the tabs (bell, "Voir le conseil").
  void openAlerts({bool tips = false}) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => AlertsScreen(showTips: tips)));

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final tabs = [
      (LucideIcons300.house, L('Accueil', 'Home', 'الرئيسية')),
      (LucideIcons300.zap, L('Électricité', 'Electricity', 'الضو')),
      (LucideIcons300.droplet, L('Eau', 'Water', 'الماء')),
      (LucideIcons300.trophy, L('Défis', 'Challenges', 'التحديات')),
      (LucideIcons300.userRound, L('Profil', 'Profile', 'حسابي')),
    ];
    final alertCount = app.dashboard?.activeAlerts.length ?? 0;

    final body = switch (_index) {
      0 => const HomeScreen(),
      1 => const ElectricityScreen(),
      2 => const WaterScreen(),
      3 => const ChallengesScreen(),
      _ => const ProfileScreen(),
    };

    return Scaffold(
      extendBody: true,
      body: SafeArea(
        bottom: false,
        child: Column(children: [
          if (_index == 0) const HomeHeader(),
          if (app.dashboardError != null && app.dashboard != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(kGutter, 8, kGutter, 0),
              child: Pill(L('Connexion au serveur perdue', 'Server connection lost', 'الاتصال بالسرفور مقطوع'),
                  tone: PillTone.broken, icon: const Icon(LucideIcons300.wifiOff)),
            ),
          Expanded(child: KeyedSubtree(key: ValueKey('$_index-${app.householdEpoch}'), child: body)),
        ]),
      ),
      bottomNavigationBar: _PillNav(tabs: tabs, index: _index, onTap: go, profileDot: alertCount > 0),
    );
  }
}

/// "Ma maison ▾ / Tunis · en direct", bell (Chams dot when an alert is open) and avatar.
class HomeHeader extends StatelessWidget {
  const HomeHeader({super.key});
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final app = AppScope.of(context);
    final count = app.dashboard?.activeAlerts.length ?? 0;
    return Padding(
      padding: const EdgeInsets.fromLTRB(kGutter, 10, kGutter, 4),
      child: Row(children: [
        const Expanded(child: Align(alignment: AlignmentDirectional.centerStart, child: HouseholdSwitcher())),
        Semantics(
          button: true,
          label: count > 0
              ? L('Alertes, $count non lues', 'Alerts, $count unread', 'التنبيهات، $count جديدة')
              : L('Alertes', 'Alerts', 'التنبيهات'),
          excludeSemantics: true,
          child: Material(
            color: tg.surface,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => Shell.of(context).openAlerts(),
              child: SizedBox.square(
                dimension: kTap,
                child: Stack(alignment: Alignment.center, children: [
                  Icon(LucideIcons300.bell, size: 20, color: tg.ink),
                  if (count > 0)
                    PositionedDirectional(
                      end: 11,
                      top: 10,
                      child: Container(width: 8, height: 8, decoration: const BoxDecoration(color: TG.chams, shape: BoxShape.circle)),
                    ),
                ]),
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Semantics(
          button: true,
          label: L('Profil', 'Profile', 'حسابي'),
          excludeSemantics: true,
          child: Material(
            color: TG.bahr,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => Shell.of(context).go(4),
              child: SizedBox.square(
                dimension: kTap,
                child: Center(
                  child: Text(app.user?.initial ?? '?',
                      style: T.h3(Colors.white).copyWith(fontSize: 15, fontWeight: FontWeight.w700)),
                ),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}

class _PillNav extends StatelessWidget {
  const _PillNav({required this.tabs, required this.index, required this.onTap, required this.profileDot});
  final List<(IconData, String)> tabs;
  final int index;
  final ValueChanged<int> onTap;
  final bool profileDot;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(12, 0, 12, 14 + bottom),
      child: Container(
        height: 68,
        decoration: BoxDecoration(
          color: tg.surface,
          borderRadius: BorderRadius.circular(34),
          boxShadow: const [BoxShadow(color: Color(0x400D1820), blurRadius: 30, offset: Offset(0, 10))],
        ),
        child: Semantics(
          container: true,
          label: L('Navigation principale', 'Main navigation', 'القائمة الرئيسية'),
          child: Row(children: [
            for (var i = 0; i < tabs.length; i++)
              Expanded(
                child: Semantics(
                  selected: i == index,
                  button: true,
                  label: tabs[i].$2,
                  excludeSemantics: true,
                  child: InkResponse(
                    onTap: () => onTap(i),
                    radius: 34,
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Stack(clipBehavior: Clip.none, children: [
                        Icon(tabs[i].$1, size: 22, color: i == index ? tg.navActive : tg.mute),
                        if (i == 4 && profileDot)
                          const PositionedDirectional(
                            end: -4,
                            top: -2,
                            child: SizedBox.square(
                              dimension: 8,
                              child: DecoratedBox(decoration: BoxDecoration(color: TG.chams, shape: BoxShape.circle)),
                            ),
                          ),
                      ]),
                      const SizedBox(height: 3),
                      Text(
                        tabs[i].$2,
                        maxLines: 1,
                        overflow: TextOverflow.fade,
                        softWrap: false,
                        style: T.caption(i == index ? tg.navActive : tg.mute)
                            .copyWith(fontWeight: i == index ? FontWeight.w700 : FontWeight.w600),
                      ),
                    ]),
                  ),
                ),
              ),
          ]),
        ),
      ),
    );
  }
}

/// Scrollable page with pull-to-refresh, the 16 px gutter and room for the floating nav.
class PageList extends StatelessWidget {
  const PageList({super.key, required this.children, required this.onRefresh, this.top = 12});
  final List<Widget> children;
  final Future<void> Function() onRefresh;
  final double top;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: context.tg.primary,
      backgroundColor: context.tg.surface,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(kGutter, top, kGutter, 112 + MediaQuery.paddingOf(context).bottom),
        children: [
          for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 12), children[i]],
        ],
      ),
    );
  }
}
