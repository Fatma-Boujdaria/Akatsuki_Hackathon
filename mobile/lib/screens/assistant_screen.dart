import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/format.dart';
import '../util/i18n.dart';
import '../widgets/ui.dart';
import 'home_screen.dart';

// "Assistant IA" (frontend/src/pages/Assistant.tsx): questions about the bill, the
// tranche, increases, appliances and savings. Measured, forecast and profile figures are
// kept apart; DT amounts come from the tariff engine, never from the AI.

class _Message {
  _Message(this.role, this.text, {this.out, this.error = false});
  final String role, text;
  final ChatOut? out;
  final bool error;
}

List<String> _starters() => [
      L('Combien vais-je probablement payer ce mois-ci ?', 'How much will I probably pay this month?', 'قداش باش نخلص الشهر هذا تقريبا؟'),
      L('Combien de kWh me restent avant la prochaine tranche ?', 'How many kWh are left before the next tranche?', 'قداش باقيلي kWh قبل الشريحة الجاية؟'),
      L('Pourquoi ma consommation a-t-elle augmenté ?', 'Why has my consumption increased?', 'علاش الاستهلاك متاعي زاد؟'),
      L('Quels appareils pèsent le plus ?', 'Which of my appliances weigh the most?', 'أنا الآلات اللي تاكل برشا ضو؟'),
      L('Comment réduire ma prochaine facture ?', 'How can I reduce my next bill?', 'كيفاش ننقّص الفاتورة الجاية؟'),
    ];

class AssistantScreen extends StatefulWidget {
  /// [question]: asked right away (from a dashboard link).
  const AssistantScreen({super.key, this.question});
  final String? question;
  @override
  State<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends State<AssistantScreen> {
  final _messages = <_Message>[];
  final _input = TextEditingController();
  final _scroll = ScrollController();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    if (widget.question != null) WidgetsBinding.instance.addPostFrameCallback((_) => _ask(widget.question!));
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _toEnd() => WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) {
          _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
        }
      });

  Future<void> _ask(String text) async {
    final q = text.trim();
    if (q.isEmpty || _busy) return;
    final app = AppScope.read(context);
    final history = [
      for (final m in _messages.skip(_messages.length > 10 ? _messages.length - 10 : 0))
        ChatTurn(m.role, m.text.length > 3900 ? m.text.substring(0, 3900) : m.text),
    ];
    setState(() {
      _messages.add(_Message('user', q));
      _input.clear();
      _busy = true;
    });
    _toEnd();
    try {
      final out = await app.api.chat(q, app.language.name, history);
      if (mounted) setState(() => _messages.add(_Message('assistant', out.answer, out: out)));
    } catch (e) {
      if (mounted) setState(() => _messages.add(_Message('assistant', '$e', error: true)));
    } finally {
      if (mounted) setState(() => _busy = false);
      _toEnd();
    }
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final app = AppScope.of(context);
    final i = app.insights;
    final last = _messages.reversed.where((m) => m.out != null).firstOrNull?.out;
    final suggestions = last?.suggestions ?? _starters().take(3).toList();

    return Scaffold(
      body: SafeArea(
        child: Column(children: [
          Expanded(
            child: ListView(
              controller: _scroll,
              padding: const EdgeInsets.fromLTRB(kGutter, 12, kGutter, 16),
              children: [
                PageHeader(
                  back: true,
                  title: L('Assistant IA', 'AI assistant', 'المساعد الذكي'),
                  aside: i != null ? StatusBadge(status: i.status) : null,
                ),
                if (_messages.isEmpty)
                  TgCard(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const IconTile(icon: LucideIcons300.sparkles, tone: Tone.elec),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(L('Pose-moi une question sur ta consommation.', 'Ask me about your consumption.', 'اسألني على الاستهلاك متاعك.'),
                                style: T.h3(tg.ink)),
                            const SizedBox(height: 4),
                            Text(
                              L('Je sépare toujours ce qui est mesuré de ce qui est prévu. Les montants en DT viennent du calcul des tarifs, jamais de l\'IA, et ce sont des estimations.',
                                  'I always separate what is measured from what is forecast. DT amounts come from the tariff engine, never from the AI, and they are estimates.',
                                  'ديما نفرّق بين المقاس والمتوقّع. المبالغ بالدينار تجي من حساب الأسوام، موش من الذكاء الاصطناعي، وهي تقديرات.'),
                              style: T.small(tg.mute),
                            ),
                            if (i?.forecastKwh != null) ...[
                              const SizedBox(height: 8),
                              Text.rich(TextSpan(style: T.small(tg.body), children: [
                                TextSpan(text: '${L('Prévision du mois', 'Month forecast', 'توقّع الشهر')} : '),
                                TextSpan(text: kwh(i!.forecastKwh!), style: const TextStyle(fontWeight: FontWeight.w700)),
                              ])),
                            ],
                          ]),
                        ),
                      ]),
                      const SizedBox(height: 14),
                      Wrap(spacing: 8, runSpacing: 8, children: [
                        for (final s in _starters()) _Suggestion(text: s, onTap: () => _ask(s)),
                      ]),
                    ]),
                  ),
                for (final m in _messages) ...[const SizedBox(height: 12), _Bubble(m: m)],
                if (_busy) ...[const SizedBox(height: 12), const _Typing()],
              ],
            ),
          ),
          Container(
            color: tg.canvas,
            padding: EdgeInsets.fromLTRB(kGutter, 8, kGutter, 10 + MediaQuery.viewInsetsOf(context).bottom * 0),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (_messages.isNotEmpty) ...[
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(children: [
                    for (final s in suggestions) ...[
                      TgChip(s, active: false, onTap: _busy ? () {} : () => _ask(s)),
                      const SizedBox(width: 8),
                    ],
                  ]),
                ),
                const SizedBox(height: 8),
              ],
              Row(children: [
                Expanded(
                  child: TextField(
                    controller: _input,
                    maxLength: 1000,
                    textInputAction: TextInputAction.send,
                    onSubmitted: _ask,
                    onChanged: (_) => setState(() {}),
                    style: T.body(tg.ink),
                    decoration: InputDecoration(
                      hintText: L('Écris ta question…', 'Type your question…', 'اكتب سؤالك…'),
                      counterText: '',
                      constraints: const BoxConstraints(minHeight: 52),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(999), borderSide: BorderSide(color: tg.hairline)),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(999), borderSide: BorderSide(color: tg.hairline)),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(999), borderSide: BorderSide(color: tg.link, width: 2)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Semantics(
                  button: true,
                  label: L('Envoyer', 'Send', 'ابعث'),
                  excludeSemantics: true,
                  child: Opacity(
                    opacity: _busy || _input.text.trim().isEmpty ? 0.4 : 1,
                    child: Material(
                      color: tg.primary,
                      shape: const CircleBorder(),
                      child: InkWell(
                        customBorder: const CircleBorder(),
                        onTap: _busy || _input.text.trim().isEmpty ? null : () => _ask(_input.text),
                        child: SizedBox.square(dimension: 52, child: Icon(LucideIcons300.arrowUp, size: 22, color: tg.onPrimary)),
                      ),
                    ),
                  ),
                ),
              ]),
              const SizedBox(height: 6),
              Text(
                L('Les estimations ne remplacent pas ta facture officielle. Un compteur global ne mesure pas chaque appareil.',
                    'Estimates do not replace your official bill. A whole-house meter does not measure each appliance.',
                    'التقديرات ما تعوّضش الفاتورة الرسمية. الكونتور يقيس الدار الكل، موش كل آلة.'),
                textAlign: TextAlign.center,
                style: T.caption(tg.mute),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _Suggestion extends StatelessWidget {
  const _Suggestion({required this.text, required this.onTap});
  final String text;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return Material(
      color: tg.sunken,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 40),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            child: Text(text, style: T.small(tg.chip).copyWith(fontSize: 14, fontWeight: FontWeight.w600)),
          ),
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.m});
  final _Message m;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final user = m.role == 'user';
    final radius = BorderRadiusDirectional.only(
      topStart: const Radius.circular(20),
      topEnd: const Radius.circular(20),
      bottomStart: Radius.circular(user ? 20 : 6),
      bottomEnd: Radius.circular(user ? 6 : 20),
    );
    return Align(
      alignment: user ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * (user ? 0.85 : 0.92)),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
          decoration: BoxDecoration(
            color: user ? TG.bahr : (m.error ? tg.grenadeSoft : tg.surface),
            borderRadius: radius,
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(m.text, style: T.body(user ? Colors.white : (m.error ? tg.grenade : tg.ink))),
            if (m.out != null && m.out!.facts.isNotEmpty) ...[
              const SizedBox(height: 10),
              for (final f in m.out!.facts) _Fact(f: f),
            ],
            if (m.out?.source == 'llm')
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(LucideIcons300.sparkles, size: 12, color: tg.mute),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(L('reformulé par IA · chiffres calculés', 'worded by AI · figures computed', 'صياغة بالذكاء الاصطناعي · الأرقام محسوبة'),
                        style: T.caption(tg.mute)),
                  ),
                ]),
              ),
          ]),
        ),
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.f});
  final ChatFact f;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final (label, bg, fg) = switch (f.kind) {
      'forecast' => (L('prévision', 'forecast', 'توقّع'), tg.elecSoft, tg.elecInk),
      'assumption' => (L('hypothèse', 'assumption', 'فرضية'), tg.sunken, tg.mute),
      'profile' => (L('profil déclaré', 'declared profile', 'بروفيل مصرّح'), tg.waterSoft, tg.waterInk),
      _ => (L('mesuré', 'measured', 'مقاس'), tg.successSoft, tg.success),
    };
    return Container(
      margin: const EdgeInsets.only(top: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: tg.sunken, borderRadius: BorderRadius.circular(kRadiusCtl)),
      child: Row(children: [
        Expanded(
          child: Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 6, runSpacing: 4, children: [
            Text(f.label, style: T.caption(tg.mute).copyWith(fontSize: 12)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
              child: Text(label, style: T.caption(fg).copyWith(fontSize: 10, fontWeight: FontWeight.w700)),
            ),
          ]),
        ),
        const SizedBox(width: 8),
        Text(f.value, textDirection: TextDirection.ltr, style: T.small(tg.ink).copyWith(fontWeight: FontWeight.w700)),
      ]),
    );
  }
}

/// Three dots while the assistant writes (still with reduced motion).
class _Typing extends StatefulWidget {
  const _Typing();
  @override
  State<_Typing> createState() => _TypingState();
}

class _TypingState extends State<_Typing> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..repeat();
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final reduce = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: Semantics(
        label: L('L\'assistant écrit', 'The assistant is typing', 'المساعد قاعد يكتب'),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: tg.surface, borderRadius: BorderRadius.circular(20)),
          child: AnimatedBuilder(
            animation: _c,
            builder: (_, _) => Row(mainAxisSize: MainAxisSize.min, children: [
              for (var k = 0; k < 3; k++) ...[
                if (k > 0) const SizedBox(width: 4),
                Opacity(
                  opacity: reduce ? 0.7 : 0.3 + 0.7 * (((_c.value - k * 0.2) % 1.0) < 0.5 ? 1 : 0),
                  child: Container(width: 8, height: 8, decoration: BoxDecoration(color: tg.mute, shape: BoxShape.circle)),
                ),
              ],
            ]),
          ),
        ),
      ),
    );
  }
}
