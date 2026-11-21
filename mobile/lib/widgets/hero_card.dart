import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../theme.dart';
import '../util/format.dart';
import '../util/tranche.dart';
import 'status.dart';
import 'tranche_bar.dart';
import 'ui.dart';

/// Principle 01, one number leads: the kWh left before the next tranche.
class HeroCard extends StatelessWidget {
  const HeroCard({super.key, required this.data, required this.view, this.ageS});

  final Dashboard data;
  final TrancheView view;
  final double? ageS;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final e = data.electricity;
    final forecastBill = e.forecast.available ? e.forecast.bill : null;
    final near = view.state == TrancheState.near;
    final noTranche = view.state == TrancheState.top || view.state == TrancheState.none;

    return TgCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Label('Électricité · ${monthName(data.generatedAt)}')),
              DevicePill(live: data.live, device: data.device, ageS: ageS, compact: true),
            ],
          ),
          const SizedBox(height: 18),
          if (noTranche) ...[
            Text('Ce mois-ci', style: T.body(tg.body).copyWith(fontSize: 19)),
            const SizedBox(height: 4),
            Text(kwh(view.used), style: T.hero(tg.ink)),
            const SizedBox(height: 6),
            Text(
              view.state == TrancheState.top
                  ? 'dernière tranche · ${view.currentBandLabel}'
                  : 'grille tarifaire non configurée',
              style: T.body(tg.body),
            ),
          ] else ...[
            if (view.state == TrancheState.crossed)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text('Tranche ${view.currentBandLabel} atteinte',
                    style: T.small(tg.harissa).copyWith(fontWeight: FontWeight.w600, fontSize: 15)),
              ),
            Row(children: [
              if (near) ...[Icon(LucideIcons300.triangleAlert, size: 18, color: tg.harissa), const SizedBox(width: 6)],
              Text('Encore', style: T.body(near ? tg.harissa : tg.body).copyWith(fontSize: 19)),
            ]),
            const SizedBox(height: 4),
            Semantics(
              liveRegion: true,
              child: Text(kwh(view.left ?? 0), style: T.hero(tg.ink)),
            ),
            const SizedBox(height: 6),
            Text('avant la tranche ${view.nextBandLabel}', style: T.body(tg.body)),
          ],
          const SizedBox(height: 18),
          TrancheBar(view: view, nextKwhPrice: e.nextKwhPriceDt),
          const SizedBox(height: 16),
          const Divider(),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Label('Prochain kWh'),
                  const SizedBox(height: 4),
                  Text(e.nextKwhPriceDt != null ? dtUnit(e.nextKwhPriceDt!) : '—', style: T.h1(tg.ink)),
                ]),
              ),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Label('Fin du mois'),
                  const SizedBox(height: 4),
                  if (forecastBill != null) ...[
                    Text(dtRound(forecastBill.totalDt), style: T.h1(tg.ink)),
                    const Estimation(),
                  ] else
                    Text('pas encore assez de mesures', style: T.small(tg.mute)),
                ]),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
