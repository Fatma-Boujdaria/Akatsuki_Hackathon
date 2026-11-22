import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/format.dart';
import '../util/i18n.dart';
import '../widgets/fields.dart';
import '../widgets/power_picker.dart';
import '../widgets/status.dart';
import '../widgets/ui.dart';
import 'assistant_screen.dart';
import 'home_screen.dart';

// "Aide et support" (frontend/src/pages/Help.tsx): FAQ, the box, troubleshooting,
// consumption states and the contact form.

class HelpScreen extends StatelessWidget {
  const HelpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    Widget bullet(String t) => Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text('• $t', style: T.small(tg.body).copyWith(fontSize: 14, height: 1.5)),
        );
    Widget trouble(String q, String a) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(q, style: T.small(tg.ink).copyWith(fontSize: 14, fontWeight: FontWeight.w700)),
            Text(a, style: T.small(tg.body).copyWith(fontSize: 14, height: 1.5)),
          ]),
        );
    Widget state(String name, Color c, String what) => Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text.rich(TextSpan(style: T.small(tg.body).copyWith(fontSize: 14), children: [
            TextSpan(text: name, style: TextStyle(color: c, fontWeight: FontWeight.w700)),
            TextSpan(text: ' · $what'),
          ])),
        );
    Widget title(IconData icon, String t) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(children: [
            Icon(icon, size: 18, color: tg.ink),
            const SizedBox(width: 8),
            Expanded(child: Text(t, style: T.h3(tg.ink))),
          ]),
        );

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(kGutter, 12, kGutter, 40),
          children: [
            PageHeader(back: true, title: L('Aide et support', 'Help and support', 'المساعدة والدعم')),
            LinkCard(
              icon: LucideIcons300.sparkles,
              tone: Tone.elec,
              title: L('Une question rapide ?', 'A quick question?', 'عندك سؤال سريع؟'),
              sub: L('L\'assistant répond tout de suite.', 'The assistant answers right away.', 'المساعد يجاوبك توّا.'),
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AssistantScreen())),
            ),
            SectionLabel(L('Questions fréquentes', 'Frequently asked questions', 'أسئلة متكرّرة')),
            _Faq(
              q: L('C\'est quoi une tranche STEG ?', 'What is a STEG tranche?', 'شنية الشريحة متاع STEG؟'),
              children: [
                Text(L(
                  'La STEG facture l\'électricité par tranches mensuelles : plus tu consommes dans le mois, plus le prix du kWh monte. D\'après la grille utilisée ici, dès que tu passes un seuil (200, 300 puis 500 kWh), c\'est tout le mois qui est facturé au prix de la nouvelle tranche. Une petite différence de kWh peut donc coûter cher.',
                  'STEG bills electricity by monthly tranches: the more you use in a month, the higher the price per kWh. With the grid used here, once you pass a threshold (200, 300 then 500 kWh), the whole month is billed at the new tranche\'s price, so a few kWh can cost a lot.',
                  'الـ STEG تفوتر الضو بالشرائح كل شهر: كل ما تستهلك أكثر، سوم الـ kWh يطلع. حسب الجدول هذا، كيف تتعدّى حدّ (200، 300، 500 kWh)، الشهر الكل يتحسب بسوم الشريحة الجديدة.',
                )),
                const _TrancheTable(),
                const SizedBox(height: 8),
                Text(
                  L('Grille à vérifier sur une vraie facture STEG ; ajoute aussi la redevance de puissance (kVA), la TVA et les taxes municipales.',
                      'Grid to be checked on a real STEG bill; the power fee (kVA), VAT and municipal taxes are added too.',
                      'الجدول لازم يتثبّت في فاتورة حقيقية؛ تتزاد زادة معلوم القوة (kVA) والـ TVA والأداءات البلدية.'),
                  style: T.caption(tg.mute).copyWith(fontSize: 12),
                ),
              ],
            ),
            _Faq(q: L('Pourquoi « estimation » partout ?', 'Why "estimate" everywhere?', 'علاش « تقدير » في كل بلاصة؟'), children: [
              Text(L(
                'Le boîtier mesure à ± 2 à 5 % près : c\'est assez pour prévenir et conseiller, pas pour facturer. Les montants sont calculés avec les tarifs enregistrés et ne remplacent pas ta facture officielle.',
                'The box measures within ± 2 to 5 %: enough to warn and advise, not to bill. Amounts are computed with the stored tariffs and do not replace your official bill.',
                'البواطة تقيس بفرق ± 2 حتى 5 %: يكفي باش ننبّهوك وننصحوك، موش باش نفوترو. المبالغ محسوبة بالأسوام المسجّلة وما تعوّضش الفاتورة الرسمية.',
              )),
            ]),
            _Faq(q: L('Comment est calculée la prévision ?', 'How is the forecast computed?', 'كيفاش يتحسب التوقّع؟'), children: [
              Text(L(
                'On prend ton rythme moyen des 7 derniers jours et on le prolonge jusqu\'à la fin du mois. Avec moins d\'une heure de mesures, il n\'y a pas de prévision. Tes appareils déclarés servent aux conseils, pas à la mesure.',
                'We take your average pace over the last 7 days and extend it to the end of the month. With less than an hour of readings there is no forecast. Declared appliances feed the tips, not the measurement.',
                'ناخذو الريتم متاعك في 7 أيام اللي فاتو ونكمّلوه لآخر الشهر. كان القياسات أقل من ساعة، ما فماش توقّع. الآلات المصرّح بيها للنصائح، موش للقياس.',
              )),
            ]),
            _Faq(q: L('Le boîtier mesure-t-il chaque appareil ?', 'Does the box measure each appliance?', 'البواطة تقيس كل آلة؟'), children: [
              Text(L(
                'Non. Il mesure toute la maison au compteur. La répartition par appareil est une estimation d\'après ce que tu déclares. Les « gros consommateurs probables » viennent des sauts de puissance détectés.',
                'No. It measures the whole house at the meter. The split per appliance is an estimate from what you declare. "Probable heavy consumers" come from detected power steps.',
                'لا. تقيس الدار الكل عند الكونتور. التقسيم على الآلات تقدير حسب اللي صرّحت بيه.',
              )),
            ]),
            _Faq(q: L('Comment marche la détection de fuite ?', 'How does leak detection work?', 'كيفاش نكتشفو التسريب؟'), children: [
              Text(L(
                'Si l\'eau coule sans s\'arrêter pendant 2 h entre 01:00 et 05:00, une alerte de fuite probable part. Tu peux régler cette fenêtre dans Paramètres.',
                'If water flows non-stop for 2 h between 01:00 and 05:00, a probable-leak alert is sent. You can change this window in Settings.',
                'كان الماء يجري بلا وقفة ساعتين بين 01:00 و05:00، يجيك تنبيه تسريب. تنجم تبدّل الوقت في الإعدادات.',
              )),
            ]),
            _Faq(q: L('Quelle puissance (kVA) choisir ?', 'Which power (kVA) should I choose?', 'أنا قوة (kVA) نختار؟'), children: const [PowerHelp()]),
            _Faq(q: L('Comment est calculée la facture d\'eau ?', 'How is the water bill computed?', 'كيفاش تتحسب فاتورة الماء؟'), children: [
              Text(L(
                'La SONEDE facture par trimestre, avec des tranches payées chacune à son prix (hors taxes) : 0 à 20 m³ à 200 millimes le m³, 21 à 40 m³ à 740, 41 à 70 m³ à 1 040, 71 à 100 m³ à 1 490, 101 à 150 m³ à 1 770, au-delà de 150 m³ à 2 310. Cartheco prend ton eau du mois, la projette sur le trimestre pour trouver la tranche, puis montre la part du mois.',
                'SONEDE bills every quarter, with bands each paid at its own price (before taxes): 0 to 20 m³ at 200 millimes per m³, 21 to 40 m³ at 740, 41 to 70 m³ at 1,040, 71 to 100 m³ at 1,490, 101 to 150 m³ at 1,770, over 150 m³ at 2,310. The app takes your month\'s water, projects it over the quarter to find the band, then shows the month\'s share.',
                'الـ SONEDE تفوتر كل ثلاثي، كل شريحة بسومها (بلا أداءات): من 0 لـ 20 م³ بـ 200 مليم للمتر، 21 لـ 40 بـ 740، 41 لـ 70 بـ 1040، 71 لـ 100 بـ 1490، 101 لـ 150 بـ 1770، فوق 150 بـ 2310. التطبيق ياخذ ماء الشهر، يحسبو على الثلاثي باش يلقى الشريحة، ويوري نصيب الشهر.',
              )),
              const SizedBox(height: 8),
              Text(L('Borne fontaine : 200 millimes/m³. Tourisme : 2 310 millimes/m³.', 'Public fountain: 200 millimes/m³. Tourism: 2,310 millimes/m³.', 'الحنفية العمومية: 200 مليم/م³. السياحة: 2310 مليم/م³.'),
                  style: T.caption(tg.mute).copyWith(fontSize: 12)),
            ]),
            const SizedBox(height: 12),
            TgCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                title(LucideIcons300.cpu, L('Le boîtier Cartheco', 'The Cartheco box', 'بواطة Cartheco')),
                bullet(L('ESP32 + PZEM-004T : tension, courant, puissance et énergie.', 'ESP32 + PZEM-004T: voltage, current, power and energy.', 'ESP32 + PZEM-004T: الجهد، التيار، القوة والطاقة.')),
                bullet(L('YF-S201 après le compteur SONEDE : débit d\'eau (≈ 450 impulsions par litre, à calibrer).',
                    'YF-S201 after the SONEDE meter: water flow (≈ 450 pulses per litre, to calibrate).', 'YF-S201 بعد كونتور SONEDE: دبي الماء (≈ 450 نبضة في اللتر).')),
                bullet(L('Une mesure toutes les 5 s par Wi-Fi ; le total d\'eau reste en mémoire si le boîtier redémarre.',
                    'One reading every 5 s over Wi-Fi; the water total is kept if the box restarts.', 'قياس كل 5 ثواني بالويفي؛ مجموع الماء يتحفظ كان البواطة تعاود تشعل.')),
                bullet(L('Il ne remplace jamais le disjoncteur de la maison.', 'It never replaces the home\'s circuit breaker.', 'عمرها ما تعوّض الديجونكتور متاع الدار.')),
              ]),
            ),
            const SizedBox(height: 12),
            TgCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                title(LucideIcons300.wrench, L('Dépannage', 'Troubleshooting', 'حل المشاكل')),
                trouble(L('« Appareil hors ligne »', '"Device offline"', '« البواطة مقطوعة »'),
                    L('Vérifie l\'alimentation du boîtier et le Wi-Fi (ou le partage de connexion du téléphone).', 'Check the box\'s power and Wi-Fi (or the phone hotspot).',
                        'ثبّت في الكورون والويفي (ولا البارتاج متاع التليفون).')),
                trouble(L('« Mesure peu fiable »', '"Unreliable reading"', '« قياس موش مضمون »'),
                    L('Le capteur sature ou le signal est mauvais : aucune valeur n\'est inventée. Vérifie le câblage du PZEM et du capteur d\'eau.',
                        'The sensor saturates or the signal is bad: no value is made up. Check the PZEM and water sensor wiring.', 'الكابتور مشبّع ولا السينيال ضعيف: ما نخترعو حتى رقم. ثبّت في الخيوط.')),
                trouble(L('Le total ne bouge plus', 'The total stopped moving', 'المجموع ما عادش يتحرك'),
                    L('Ouvre Contrôle démo sur le site web pour voir la dernière mesure reçue, ou utilise le simulateur.',
                        'Open Demo control on the website to see the last reading received, or use the simulator.', 'حل التحكم في الديمو في الموقع باش تشوف آخر قياس، ولا استعمل السيمولاتور.')),
              ]),
            ),
            const SizedBox(height: 12),
            TgCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                title(LucideIcons300.gauge, L('Les états de consommation', 'Consumption states', 'حالات الاستهلاك')),
                state(L('Normal', 'Normal', 'عادي'), tg.success, L('dans le rythme attendu', 'within the expected range', 'في الريتم العادي')),
                state(L('Attention', 'Attention', 'رد بالك'), tg.waterInk, L('hausse ou prévision au-dessus du seuil', 'rising, or forecast above the threshold', 'زيادة ولا توقّع فوق الحد')),
                state(L('Avertissement', 'Warning', 'تحذير'), tg.harissa, L('dans la marge avant la tranche suivante', 'inside the margin before the next tranche', 'في الهامش قبل الشريحة الجاية')),
                state(L('Critique', 'Critical', 'خطير'), tg.grenade, L('seuil franchi ou fuite probable', 'threshold crossed or probable leak', 'تعدّيت الحد ولا تسريب')),
                state(L('Mesure indisponible', 'Reading unavailable', 'القياس موش متوفر'), tg.mute,
                    L('boîtier hors ligne ou mesure peu fiable', 'box offline or unreliable reading', 'البواطة مقطوعة ولا القياس موش مضمون')),
              ]),
            ),
            const SizedBox(height: 12),
            const _ContactForm(),
          ],
        ),
      ),
    );
  }
}

class _Faq extends StatefulWidget {
  const _Faq({required this.q, required this.children});
  final String q;
  final List<Widget> children;
  @override
  State<_Faq> createState() => _FaqState();
}

class _FaqState extends State<_Faq> {
  bool _open = false;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: tg.surface,
        borderRadius: BorderRadius.circular(kRadiusCard),
        clipBehavior: Clip.antiAlias,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Semantics(
            button: true,
            expanded: _open,
            child: InkWell(
              onTap: () => setState(() => _open = !_open),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 48),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(children: [
                    Expanded(child: Text(widget.q, style: T.small(tg.ink).copyWith(fontSize: 14, fontWeight: FontWeight.w700))),
                    AnimatedRotation(
                      turns: _open ? 0.5 : 0,
                      duration: const Duration(milliseconds: 180),
                      child: Icon(LucideIcons300.chevronDown, size: 18, color: tg.mute),
                    ),
                  ]),
                ),
              ),
            ),
          ),
          if (_open)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: DefaultTextStyle.merge(
                style: T.small(tg.body).copyWith(fontSize: 14, height: 1.55),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: widget.children),
              ),
            ),
        ]),
      ),
    );
  }
}

class _TrancheTable extends StatefulWidget {
  const _TrancheTable();
  @override
  State<_TrancheTable> createState() => _TrancheTableState();
}

class _TrancheTableState extends State<_TrancheTable> {
  Tariffs? _t;
  @override
  void initState() {
    super.initState();
    AppScope.read(context).api.tariffs().then((t) => mounted ? setState(() => _t = t) : null).catchError((_) => null);
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final rows = (_t?.tranches ?? const <TrancheRow>[]).where((r) => r.resource == 'electricity').toList()
      ..sort((a, b) => a.minQty.compareTo(b.minQty));
    if (rows.isEmpty) return const SizedBox.shrink();
    final latest = rows.fold<String>('', (a, r) => '${r.j['valid_from'] ?? ''}'.compareTo(a) > 0 ? '${r.j['valid_from']}' : a);
    final head = T.small(tg.mute).copyWith(fontWeight: FontWeight.w600);
    final cell = T.small(tg.ink);
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(children: [
        Row(children: [
          Expanded(flex: 5, child: Text(L('Consommation du mois', 'Monthly use', 'استهلاك الشهر'), style: head)),
          Expanded(flex: 3, child: Text(L('Prix / kWh', 'Price / kWh', 'السوم / kWh'), textAlign: TextAlign.end, style: head)),
          Expanded(flex: 2, child: Text(L('TVA', 'VAT', 'TVA'), textAlign: TextAlign.end, style: head)),
        ]),
        for (final r in rows.where((r) => '${r.j['valid_from'] ?? ''}' == latest)) ...[
          Divider(height: 12, color: tg.hairline),
          Row(children: [
            Expanded(
              flex: 5,
              child: Text(
                r.maxQty == null
                    ? L('Plus de ${num(r.minQty)} kWh', 'Over ${num(r.minQty)} kWh', 'أكثر من ${num(r.minQty)} kWh')
                    : '${num(r.minQty)} – ${num(r.maxQty!)} kWh',
                style: cell,
              ),
            ),
            Expanded(flex: 3, child: Text('${r.priceMillimes} ${L('mil.', 'mill.', 'مليم')}', textAlign: TextAlign.end, style: cell.copyWith(fontWeight: FontWeight.w700))),
            Expanded(flex: 2, child: Text('${(r.vatRate * 100).round()} %', textAlign: TextAlign.end, style: cell)),
          ]),
        ],
      ]),
    );
  }
}

class _ContactForm extends StatefulWidget {
  const _ContactForm();
  @override
  State<_ContactForm> createState() => _ContactFormState();
}

class _ContactFormState extends State<_ContactForm> {
  String _category = 'problem';
  final _subject = TextEditingController();
  final _message = TextEditingController();
  bool _sent = false, _busy = false;
  String? _error;
  List<Ticket>? _tickets;

  @override
  void initState() {
    super.initState();
    _loadTickets();
  }

  void _loadTickets() {
    AppScope.read(context).api.myTickets().then((t) => mounted ? setState(() => _tickets = t) : null).catchError((_) => null);
  }

  @override
  void dispose() {
    _subject.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final api = AppScope.read(context).api;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await api.createTicket(category: _category, subject: _subject.text.trim(), message: _message.text.trim());
      _subject.clear();
      _message.clear();
      setState(() => _sent = true);
      _loadTickets();
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final categories = [
      ('problem', L('Un problème', 'A problem', 'مشكلة')),
      ('device', L('Mon boîtier', 'My box', 'البواطة')),
      ('billing', L('Facture et tarifs', 'Bill and tariffs', 'الفاتورة والأسوام')),
      ('question', L('Une question', 'A question', 'سؤال')),
      ('feedback', L('Une idée, un avis', 'An idea, feedback', 'فكرة ولا رأي')),
    ];
    String status(String s) => switch (s) {
          'open' => L('ouvert', 'open', 'مفتوح'),
          'answered' => L('répondu', 'answered', 'تجاوب'),
          _ => L('fermé', 'closed', 'مسكّر'),
        };
    return TgCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(L('Contacter le support', 'Contact support', 'اتصل بالدعم'), style: T.h3(tg.ink)),
        const SizedBox(height: 12),
        Text(L('Sujet', 'Topic', 'الموضوع'), style: T.small(tg.body).copyWith(fontSize: 14, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          initialValue: _category,
          isExpanded: true,
          dropdownColor: tg.surface,
          borderRadius: BorderRadius.circular(kRadiusCtl),
          style: T.body(tg.ink),
          icon: Icon(LucideIcons300.chevronDown, size: 18, color: tg.mute),
          items: [for (final (v, label) in categories) DropdownMenuItem(value: v, child: Text(label))],
          onChanged: (v) => setState(() => _category = v ?? _category),
        ),
        const SizedBox(height: 12),
        TgField(label: L('Titre', 'Title', 'العنوان'), controller: _subject, maxLength: 150, onChanged: (_) => setState(() {})),
        const SizedBox(height: 12),
        TgField(label: L('Message', 'Message', 'الرسالة'), controller: _message, maxLines: 5, maxLength: 5000, onChanged: (_) => setState(() {})),
        if (_sent) ...[
          const SizedBox(height: 12),
          TgBanner(
            tone: BannerTone.success,
            child: Text(L('Message envoyé. Le support te répond par e-mail.', 'Message sent. Support replies by email.', 'الرسالة تبعثت. الدعم يجاوبك بالإيميل.')),
          ),
        ],
        if (_error != null) ...[const SizedBox(height: 12), TgBanner(tone: BannerTone.broken, child: Text(_error!))],
        const SizedBox(height: 12),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: Btn(
            L('Envoyer', 'Send', 'ابعث'),
            icon: LucideIcons300.send,
            onPressed: _busy || _subject.text.trim().length < 3 || _message.text.trim().length < 10 ? null : _submit,
          ),
        ),
        if (_tickets != null && _tickets!.isNotEmpty) ...[
          const SizedBox(height: 18),
          Text(L('Mes messages', 'My messages', 'الرسائل متاعي'), style: T.label(tg.mute)),
          for (final t in _tickets!) ...[
            Divider(height: 16, color: tg.hairline),
            Row(children: [
              Expanded(child: Text(t.subject, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.small(tg.ink).copyWith(fontWeight: FontWeight.w600))),
              Text('${dateTime(t.createdAt)} · ', style: T.small(tg.mute)),
              Text(status(t.status), style: T.small(t.status == 'open' ? tg.elecInk : tg.success).copyWith(fontWeight: FontWeight.w700)),
            ]),
          ],
        ],
      ]),
    );
  }
}
