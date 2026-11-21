import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../state/app_state.dart';
import '../theme.dart';
import '../util/tranche.dart';
import '../widgets/logo.dart';
import '../widgets/status.dart';
import 'alerts_screen.dart';
import 'challenges_screen.dart';
import 'electricity_screen.dart';
import 'home_screen.dart';
import 'settings_screen.dart';
import 'water_screen.dart';

/// App frame: living logo + settings in the top bar, bottom nav for one-handed use.
class Shell extends StatefulWidget {
  const Shell({super.key});
  @override
  State<Shell> createState() => ShellState();

  static ShellState of(BuildContext context) => context.findAncestorStateOfType<ShellState>()!;
}

class ShellState extends State<Shell> {
  int _index = 0;

  /// Switch tab from inside a screen (e.g. "Voir le conseil" -> Alertes).
  void go(int index) => setState(() => _index = index);

  static const _tabs = [
    (LucideIcons300.house, 'Accueil'),
    (LucideIcons300.zap, 'Électricité'),
    (LucideIcons300.droplet, 'Eau'),
    (LucideIcons300.bell, 'Alertes'),
    (LucideIcons300.award, 'Défis'),
  ];

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final tg = context.tg;
    final tranche = app.tranche;
    final logoState = app.dashboard == null
        ? LogoState.loading
        : switch (tranche?.state) {
            TrancheState.near => LogoState.near,
            TrancheState.crossed => LogoState.crossed,
            _ => LogoState.normal,
          };
    final alertCount = app.dashboard?.activeAlerts.length ?? 0;

    final body = switch (_index) {
      0 => const HomeScreen(),
      1 => const ElectricityScreen(),
      2 => const WaterScreen(),
      3 => const AlertsScreen(),
      _ => const ChallengesScreen(),
    };

    return Scaffold(
      appBar: AppBar(
        backgroundColor: tg.canvas,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        elevation: 0,
        titleSpacing: 16,
        toolbarHeight: 60,
        shape: Border(bottom: BorderSide(color: tg.hairline)),
        title: GestureDetector(onTap: () => go(0), child: Logo(size: 30, state: logoState)),
        actions: [
          IconButton(
            tooltip: 'Réglages',
            iconSize: 24,
            constraints: const BoxConstraints(minWidth: kTap, minHeight: kTap),
            icon: Icon(LucideIcons300.slidersVertical, color: tg.ink),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen())),
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: Column(
        children: [
          if (app.dashboardError != null && app.dashboard != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
              child: Pill('Connexion au serveur perdue', tone: PillTone.broken, icon: const Icon(LucideIcons300.wifiOff)),
            ),
          Expanded(child: KeyedSubtree(key: ValueKey(_index), child: body)),
        ],
      ),
      bottomNavigationBar: DecoratedBox(
        decoration: BoxDecoration(color: tg.surface, border: Border(top: BorderSide(color: tg.hairline))),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(4, 8, 4, 6),
            child: Row(
              children: [
                for (var i = 0; i < _tabs.length; i++)
                  Expanded(
                    child: _NavItem(
                      icon: _tabs[i].$1,
                      label: _tabs[i].$2,
                      active: i == _index,
                      badge: i == 3 ? alertCount : 0,
                      onTap: () => go(i),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({required this.icon, required this.label, required this.active, required this.badge, required this.onTap});
  final IconData icon;
  final String label;
  final bool active;
  final int badge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return Semantics(
      selected: active,
      button: true,
      label: badge > 0 ? '$label, $badge alerte${badge > 1 ? 's' : ''} active${badge > 1 ? 's' : ''}' : label,
      excludeSemantics: true,
      child: InkResponse(
        onTap: onTap,
        radius: 36,
        child: SizedBox(
          height: 56,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Stack(clipBehavior: Clip.none, children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: 56,
                  height: 32,
                  decoration: BoxDecoration(
                    color: active ? tg.primarySoft : Colors.transparent,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Icon(icon, size: 22, color: active ? tg.primary : tg.body),
                ),
                if (badge > 0)
                  Positioned(
                    right: 8,
                    top: -4,
                    child: Container(
                      constraints: const BoxConstraints(minWidth: 18),
                      height: 18,
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: tg.harissa, borderRadius: BorderRadius.circular(999)),
                      child: Text('$badge',
                          style: TextStyle(
                              fontFamily: T.inter,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: tg.isDark ? TG.navy : Colors.white)),
                    ),
                  ),
              ]),
              const SizedBox(height: 4),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.fade,
                softWrap: false,
                style: TextStyle(
                  fontFamily: T.inter,
                  fontSize: 12,
                  height: 1.2,
                  fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                  color: active ? tg.ink : tg.mute,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Scrollable page with pull-to-refresh and the 16 px gutter.
class PageList extends StatelessWidget {
  const PageList({super.key, required this.children, required this.onRefresh});
  final List<Widget> children;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: context.tg.primary,
      backgroundColor: context.tg.surface,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(kGutter, 20, kGutter, 32),
        children: [
          for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 14), children[i]],
        ],
      ),
    );
  }
}
