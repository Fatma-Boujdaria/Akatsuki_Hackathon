"""The Tranche Guard assistant: answers questions about the household's consumption.

How it works:
1. The question is matched to an intent with keyword lists in French, English
   and Tunisian Arabic (Arabic script and "arabizi" Latin spelling).
2. The answer is built from FACTS computed by the backend: measured totals,
   the tariff module's bill and threshold figures, the moving-average
   forecast, and the declared appliance profile. Each fact is tagged
   measured / forecast / assumption / profile, and the answer says which is which.
3. Optional: when LLM_API_KEY is set, Claude rewrites the answer in a more
   conversational tone. Its text is kept only if every number in it already
   appears in the facts or the template answer; otherwise the template is used.

The assistant never claims to measure one appliance: a whole-house meter
cannot do that, so appliance answers always come from the declared profile.
"""

import unicodedata
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Alert, Household
from app.schemas import ChatFact, ChatIn, ChatOut
from app.services import consumption, llm
from app.services import tips as tips_service
from app.services.insights import build_insights

# --- Intent detection -------------------------------------------------------------------

KEYWORDS: dict[str, list[str]] = {
    "bill": [
        "factur", "payer", "paye", "combien", "cout", "montant", "dinar", "prix", "bill", "pay", "cost",
        "how much", "money", "price", "فاتور", "نخلص", "تخلص", "قداش", "فلوس", "flous", "9adech", "qadech",
        "fatoura", "nkhales",
    ],
    "tranche": [
        "tranche", "seuil", "palier", "reste", "restant", "avant", "threshold", "tier", "remain", "left",
        "شريح", "طرانش", "بقى", "قبل", "ba9i", "bqa", "9bal",
    ],
    "increase": [
        "pourquoi", "augment", "hausse", "plus que", "monte", "eleve", "why", "increase", "higher", "rise",
        "more than", "علاش", "زاد", "طلع", "3lech", "zed", "tla3",
    ],
    "appliances": [
        "appareil", "clim", "chauffe", "frigo", "refrigerat", "machine", "four", "lampe", "eclairage",
        "appliance", "device", "air condition", "heater", "fridge", "مكيف", "كليم", "سخان",
        "ثلاج", "فريجيدار", "ماكينة", "ضو", "klim", "frijidar",
    ],
    "reduce": [
        "reduire", "reduis", "econom", "baisser", "conseil", "astuce", "moins", "save", "reduce", "lower",
        "tip", "advice", "cut", "نقص", "نوفر", "نصيح", "وفر", "na9es", "nwaffer", "nasi7a",
    ],
    "water": [
        "eau", "fuite", "debit", "robinet", "sonede", "water", "leak", "flow", "tap", "ماء", "الماء",
        "تسريب", "تسرب", "سونيد", "fuit",
    ],
    "status": [
        "etat", "statut", "ca va", "situation", "resume", "status", "how am i", "overview", "summary",
        "كيفاش", "شنية الحالة", "الحالة", "chniya", "kifech", "lhala",
    ],
    "greeting": ["bonjour", "salut", "hello", "hi ", "hey", "عسلامة", "أهلا", "اهلا", "سلام", "aslema", "ahla"],
}
PRIORITY = ["water", "increase", "appliances", "reduce", "tranche", "bill", "status", "greeting"]


def _fold(text: str) -> str:
    """Lowercase and strip accents (French), keep Arabic letters."""
    text = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in text if not unicodedata.combining(c))


def detect_intent(message: str) -> str:
    text = f" {_fold(message)} "
    scores = {intent: sum(1 for k in words if _fold(k) in text) for intent, words in KEYWORDS.items()}
    best = max(scores.values())
    if best == 0:
        return "help"
    return next(i for i in PRIORITY if scores[i] == best)


# --- Formatting per language ------------------------------------------------------------


def fnum(value: float, lang: str, decimals: int = 0) -> str:
    text = f"{value:,.{decimals}f}"
    if lang == "en":
        return text
    return text.replace(",", " ").replace(".", ",")


def fkwh(value: float, lang: str) -> str:
    return f"{fnum(value, lang, 0 if abs(value) >= 10 else 1)} kWh"


def fdt(value: float, lang: str) -> str:
    return f"{fnum(value, lang, 2)} DT"


def fl(value: float, lang: str) -> str:
    return f"{fnum(value, lang)} L"


T = {
    "measured": {"fr": "mesuré", "en": "measured", "ar": "مقاس"},
    "month_kwh": {"fr": "Consommé ce mois-ci", "en": "Used this month", "ar": "استهلكت هالشهر"},
    "bill_to_date": {"fr": "Facture à ce jour", "en": "Bill so far", "ar": "الفاتورة لتوّا"},
    "forecast_kwh": {"fr": "Prévision fin de mois", "en": "End-of-month forecast", "ar": "التوقع آخر الشهر"},
    "forecast_bill": {"fr": "Facture prévue", "en": "Expected bill", "ar": "الفاتورة المتوقعة"},
    "next_threshold": {"fr": "Prochain seuil", "en": "Next threshold", "ar": "الشريحة الجاية"},
    "left": {"fr": "Reste avant le seuil", "en": "Left before the threshold", "ar": "قداش باقي قبل الشريحة"},
    "jump": {"fr": "Surcoût si tu le franchis", "en": "Extra cost if crossed", "ar": "الزيادة كان تتعدّاها"},
    "next_kwh": {"fr": "Prix du prochain kWh", "en": "Price of the next kWh", "ar": "سوم الـkWh الجاي"},
    "last7": {"fr": "Moyenne des 7 derniers jours", "en": "Last 7 days average", "ar": "المعدل متاع 7 أيام"},
    "before": {"fr": "Moyenne des 3 semaines d'avant", "en": "Previous 3 weeks average", "ar": "المعدل متاع 3 جمع قبل"},
    "water_month": {"fr": "Eau ce mois-ci", "en": "Water this month", "ar": "الماء هالشهر"},
    "water_forecast": {"fr": "Eau prévue fin de mois", "en": "Water forecast", "ar": "الماء المتوقع"},
    "profile": {"fr": "Profil déclaré", "en": "Declared profile", "ar": "الآلات اللي صرّحت بيها"},
    "assumption": {
        "fr": "Rythme moyen des derniers jours",
        "en": "Average pace of the last days",
        "ar": "على حساب الريتم متاع الأيام اللي فاتت",
    },
}


def tr(key: str, lang: str) -> str:
    return T[key][lang]


SUGGESTIONS = {
    "fr": [
        "Combien vais-je probablement payer ce mois-ci ?",
        "Combien de kWh me restent avant la prochaine tranche ?",
        "Pourquoi ma consommation a-t-elle augmenté ?",
        "Quels appareils pèsent le plus ?",
        "Comment réduire ma prochaine facture ?",
        "Est-ce que j'ai une fuite d'eau ?",
    ],
    "en": [
        "How much will I probably pay this month?",
        "How many kWh are left before the next tranche?",
        "Why has my consumption increased?",
        "Which of my appliances weigh the most?",
        "How can I reduce my next bill?",
        "Do I have a water leak?",
    ],
    "ar": [
        "قداش باش نخلص الشهر هذا تقريبا؟",
        "قداش باقيلي kWh قبل الشريحة الجاية؟",
        "علاش الاستهلاك متاعي زاد؟",
        "أنا الآلات اللي تاكل برشا ضو؟",
        "كيفاش ننقّص الفاتورة الجاية؟",
        "عندي تسريب ماء؟",
    ],
}
SUGGEST_FOR = {
    "bill": [1, 4, 2],
    "tranche": [0, 4, 3],
    "increase": [3, 4, 0],
    "appliances": [4, 0, 2],
    "reduce": [1, 3, 5],
    "water": [0, 4, 1],
    "status": [0, 1, 4],
    "greeting": [0, 1, 4],
    "help": [0, 1, 2],
}


@dataclass
class Draft:
    intent: str
    lines: list[str] = field(default_factory=list)
    facts: list[ChatFact] = field(default_factory=list)

    def fact(self, key: str, value: str, kind: str, lang: str) -> None:
        self.facts.append(ChatFact(label=tr(key, lang), value=value, kind=kind))


# --- Answers ------------------------------------------------------------------------------


def answer(db: Session, household: Household, body: ChatIn, now: datetime) -> ChatOut:
    lang = body.language
    intent = detect_intent(body.message)
    statuses = consumption.household_status(db, household, now)
    elec, water = statuses["electricity"], statuses["water"]
    insights = build_insights(db, household, now)
    d = Draft(intent)
    L = lambda fr, en, ar: {"fr": fr, "en": en, "ar": ar}[lang]  # noqa: E731

    month_kwh = elec.usage.month_qty
    d.fact("month_kwh", fkwh(month_kwh, lang), "measured", lang)
    has_data = month_kwh > 0 or elec.usage.forecast_available

    if not has_data and intent not in ("greeting", "help"):
        d.lines.append(
            L(
                "Je n'ai pas encore de mesures pour ce foyer. Branche le boîtier Tranche Guard ou lance le "
                "simulateur, puis repose ta question.",
                "I don't have any readings for this home yet. Plug in the Tranche Guard box or start the "
                "simulator, then ask again.",
                "مازال ما عنديش قياسات للدار هذي. ركّب البواطة متاع Tranche Guard ولا شعّل السيمولاتور، "
                "ومن بعد عاود اسألني.",
            )
        )
        return _finish(d, body, lang)

    if intent in ("bill", "status"):
        if elec.bill_to_date is not None:
            d.fact("bill_to_date", fdt(elec.bill_to_date.total_dt, lang), "measured", lang)
        if elec.forecast_bill is not None and elec.usage.forecast_qty is not None:
            d.fact("forecast_kwh", fkwh(elec.usage.forecast_qty, lang), "forecast", lang)
            d.fact("forecast_bill", fdt(elec.forecast_bill.total_dt, lang), "forecast", lang)
            d.fact("assumption", L("7 jours glissants", "rolling 7 days", "7 أيام"), "assumption", lang)
            d.lines.append(
                L(
                    f"Tu as consommé {fkwh(month_kwh, lang)} ce mois-ci (mesuré). Au rythme des derniers jours, "
                    f"tu finirais vers {fkwh(elec.usage.forecast_qty, lang)}, soit une facture STEG d'environ "
                    f"{fdt(elec.forecast_bill.total_dt, lang)} (estimation, pas une facture officielle).",
                    f"You have used {fkwh(month_kwh, lang)} this month (measured). At the pace of the last days "
                    f"you would end near {fkwh(elec.usage.forecast_qty, lang)}, a STEG bill of about "
                    f"{fdt(elec.forecast_bill.total_dt, lang)} (estimate, not an official bill).",
                    f"استهلكت {fkwh(month_kwh, lang)} هالشهر (مقاس). كان تكمّل بنفس الريتم، توصل لـ "
                    f"{fkwh(elec.usage.forecast_qty, lang)} تقريبا، يعني فاتورة STEG قريب "
                    f"{fdt(elec.forecast_bill.total_dt, lang)} (تقدير، موش فاتورة رسمية).",
                )
            )
        elif elec.bill_to_date is not None:
            d.lines.append(
                L(
                    f"Tu as consommé {fkwh(month_kwh, lang)}, soit environ {fdt(elec.bill_to_date.total_dt, lang)} "
                    f"à ce jour (estimation). Il me faut au moins 1 h de mesures pour prévoir la fin du mois.",
                    f"You have used {fkwh(month_kwh, lang)}, about {fdt(elec.bill_to_date.total_dt, lang)} so far "
                    f"(estimate). I need at least 1 h of readings to forecast the end of the month.",
                    f"استهلكت {fkwh(month_kwh, lang)}، يعني قريب {fdt(elec.bill_to_date.total_dt, lang)} لتوّا "
                    f"(تقدير). نستحق على الأقل ساعة قياسات باش نتوقع آخر الشهر.",
                )
            )

    if intent in ("tranche", "status", "bill"):
        if elec.next_threshold is None:
            d.lines.append(
                L(
                    "Tu es déjà dans la dernière tranche STEG ce mois-ci : chaque kWh coûte le prix le plus haut.",
                    "You are already in the last STEG tranche this month: every kWh costs the highest price.",
                    "راك في آخر شريحة متاع STEG هالشهر: كل kWh بأغلى سوم.",
                )
            )
        elif elec.to_next_threshold is not None:
            d.fact("next_threshold", fkwh(elec.next_threshold, lang), "measured", lang)
            d.fact("left", fkwh(elec.to_next_threshold, lang), "measured", lang)
            if elec.crossing_extra_cost_dt is not None:
                d.fact("jump", fdt(elec.crossing_extra_cost_dt, lang), "forecast", lang)
            if elec.unit_price_dt is not None:
                d.fact("next_kwh", fdt(elec.unit_price_dt, lang), "measured", lang)
            crosses = elec.billed_forecast is not None and elec.billed_forecast > elec.next_threshold
            jump = fdt(elec.crossing_extra_cost_dt or 0, lang)
            d.lines.append(
                L(
                    f"Il te reste {fkwh(elec.to_next_threshold, lang)} avant le seuil de "
                    f"{fkwh(elec.next_threshold, lang)}. Le franchir ajouterait environ {jump} à ta facture "
                    f"(estimation)."
                    + (" Au rythme actuel, la prévision le dépasse." if crosses else " Au rythme actuel, tu restes en dessous."),
                    f"You have {fkwh(elec.to_next_threshold, lang)} left before the {fkwh(elec.next_threshold, lang)} "
                    f"threshold. Crossing it would add about {jump} to your bill (estimate)."
                    + (" At the current pace, the forecast goes over it." if crosses else " At the current pace, you stay below."),
                    f"باقيلك {fkwh(elec.to_next_threshold, lang)} قبل ما توصل لـ {fkwh(elec.next_threshold, lang)}. "
                    f"كان تتعدّاها، الفاتورة تزيد قريب {jump} (تقدير)."
                    + (" بالريتم هذا، التوقع يفوتها." if crosses else " بالريتم هذا، تبقى تحتها."),
                )
            )

    if intent in ("increase", "status"):
        if insights.last7_kwh_per_day is not None:
            d.fact("last7", f"{fkwh(insights.last7_kwh_per_day, lang)}/j" if lang == "fr" else f"{fkwh(insights.last7_kwh_per_day, lang)}/d", "measured", lang)
        if insights.previous_kwh_per_day is not None:
            d.fact("before", f"{fkwh(insights.previous_kwh_per_day, lang)}/j" if lang == "fr" else f"{fkwh(insights.previous_kwh_per_day, lang)}/d", "measured", lang)
        trend = insights.trend_pct
        if trend is None:
            if intent == "increase":
                d.lines.append(
                    L(
                        "Je n'ai pas encore assez d'historique (4 semaines) pour comparer tes semaines.",
                        "I don't have enough history yet (4 weeks) to compare your weeks.",
                        "مازال ما عنديش تاريخ كافي (4 جمع) باش نقارن.",
                    )
                )
        elif trend > 5:
            d.lines.append(
                L(
                    f"Ta consommation des 7 derniers jours est {trend} % plus haute que les 3 semaines d'avant (mesuré).",
                    f"Your last 7 days are {trend} % higher than the 3 weeks before (measured).",
                    f"الاستهلاك متاع 7 أيام اللي فاتو زاد بـ {trend} % على 3 جمع قبل (مقاس).",
                )
            )
        elif trend < -5:
            d.lines.append(
                L(
                    f"Bonne nouvelle : tes 7 derniers jours sont {abs(trend)} % plus bas que les 3 semaines d'avant.",
                    f"Good news: your last 7 days are {abs(trend)} % lower than the 3 weeks before.",
                    f"خبر باهي: 7 أيام اللي فاتو نقصو بـ {abs(trend)} % على 3 جمع قبل.",
                )
            )
        elif intent == "increase":
            d.lines.append(
                L(
                    "Ta consommation est stable par rapport aux 3 semaines d'avant (moins de 5 % d'écart).",
                    "Your consumption is steady compared with the 3 weeks before (under 5 % change).",
                    "الاستهلاك متاعك ثابت مقارنة بـ 3 جمع قبل (أقل من 5 %).",
                )
            )

    if intent in ("appliances", "increase"):
        top = insights.breakdown[:3]
        if top:
            d.fact("profile", fkwh(insights.profile_kwh_month or 0, lang) + " / " + L("mois", "month", "شهر"), "profile", lang)
            names = ", ".join(f"{s.name} (~{s.share_pct} %)" for s in top)
            d.lines.append(
                L(
                    f"D'après les appareils que tu as déclarés, ceux qui pèsent le plus sont : {names}. "
                    f"C'est une estimation sur ton profil, pas une mesure appareil par appareil : "
                    f"ton compteur mesure la maison entière.",
                    f"From the appliances you declared, the heaviest are: {names}. This is an estimate from your "
                    f"profile, not a per-appliance measurement: your meter measures the whole house.",
                    f"حسب الآلات اللي صرّحت بيها، اللي تاكل أكثر هوما: {names}. هذا تقدير على حساب البروفيل "
                    f"متاعك، موش قياس لكل آلة: الكونتور يقيس الدار الكل.",
                )
            )
        else:
            d.lines.append(
                L(
                    "Tu n'as pas encore déclaré tes appareils. Ajoute-les dans « Mon foyer » pour que je puisse "
                    "estimer lesquels pèsent le plus.",
                    "You haven't declared your appliances yet. Add them in \"My home\" so I can estimate which "
                    "weigh the most.",
                    "مازلت ما صرّحتش بالآلات متاعك. زيدهم في « الدار متاعي » باش نجم نقدّر شكون ياكل أكثر.",
                )
            )

    if intent in ("reduce", "increase", "appliances"):
        tips = [t for t in tips_service.refresh_tips(db, household, now, use_llm=False) if t.code != "offpeak"]
        db.commit()
        if tips:
            for tip in tips[:3]:
                saving = fdt(tip.saving_dt, lang) if tip.saving_dt else None
                d.lines.append(f"• {tip_text(tip.code, tip.params or {}, tip.text, lang)}" + (f" ({saving})" if saving and lang != "fr" else ""))
        else:
            d.lines.append(
                L(
                    "Pas de conseil chiffré pour l'instant : continue comme ça !",
                    "No costed tip right now: keep it up!",
                    "ما فماش نصيحة بالأرقام توّا: كمّل هكّا!",
                )
            )

    if intent in ("water", "status"):
        d.fact("water_month", fl(water.usage.month_qty, lang), "measured", lang)
        if water.usage.forecast_qty is not None:
            d.fact("water_forecast", fl(water.usage.forecast_qty, lang), "forecast", lang)
        leak = db.scalar(
            select(Alert).where(Alert.household_id == household.id, Alert.type == "leak", Alert.acknowledged_at.is_(None))
        )
        if leak is not None:
            d.lines.append(
                L(
                    "Oui : une fuite probable a été détectée (débit continu la nuit). Vérifie la chasse d'eau et les "
                    "robinets, puis confirme dans Alertes.",
                    "Yes: a probable leak was detected (continuous flow at night). Check the toilet flush and the "
                    "taps, then confirm in Alerts.",
                    "إيه: فما تسريب محتمل (الماء يجري الليل الكل). ثبّت في السيفون والروبينيات، ومن بعد أكّد في التنبيهات.",
                )
            )
        else:
            d.lines.append(
                L(
                    f"Pas de fuite détectée. Tu as utilisé {fl(water.usage.month_qty, lang)} d'eau ce mois-ci (mesuré)."
                    + ("" if water.tariff else " Les tarifs SONEDE ne sont pas encore vérifiés : pas de montant en DT pour l'eau."),
                    f"No leak detected. You have used {fl(water.usage.month_qty, lang)} of water this month (measured)."
                    + ("" if water.tariff else " SONEDE prices are not verified yet: no DT amount for water."),
                    f"ما فماش تسريب. استعملت {fl(water.usage.month_qty, lang)} ماء هالشهر (مقاس)."
                    + ("" if water.tariff else " أسوام SONEDE مازالت ما تثبّتتش: ما فماش مبلغ بالدينار للماء."),
                )
            )

    if intent in ("greeting", "help") or not d.lines:
        d.lines.insert(
            0,
            L(
                "Je suis l'assistant Tranche Guard. Je peux t'expliquer ta consommation, ta facture probable, "
                "la distance à la prochaine tranche et comment économiser. Je distingue toujours ce qui est "
                "mesuré de ce qui est prévu.",
                "I'm the Tranche Guard assistant. I can explain your consumption, your likely bill, the distance "
                "to the next tranche and how to save. I always separate what is measured from what is forecast.",
                "أنا المساعد متاع Tranche Guard. نجم نفسّرلك الاستهلاك متاعك، الفاتورة المتوقعة، قداش باقي "
                "للشريحة الجاية وكيفاش توفّر. ديما نفرّق بين اللي مقاس واللي متوقّع.",
            ),
        )
    return _finish(d, body, lang)


def _finish(d: Draft, body: ChatIn, lang: str) -> ChatOut:
    text = "\n".join(d.lines)
    source = "rule"
    reworded = llm.chat_rewrite(body.message, text, [f.model_dump() for f in d.facts], lang)
    if reworded:
        text, source = reworded, "llm"
    suggestions = [SUGGESTIONS[lang][i] for i in SUGGEST_FOR.get(d.intent, SUGGEST_FOR["help"])]
    return ChatOut(intent=d.intent, answer=text, facts=d.facts, suggestions=suggestions, source=source)


# --- Tip texts in the three languages (numbers from params) ---------------------------------


def tip_text(code: str, p: dict, fallback: str, lang: str) -> str:
    if lang == "fr":
        return fallback
    n = lambda v, dec=0: fnum(float(v), lang, dec)  # noqa: E731
    texts = {
        "threshold": {
            "en": f"To stay under {n(p.get('threshold', 0))} kWh, cut about {n(p.get('cut_kwh', 0), 1)} kWh by month end "
            f"(≈ {n(p.get('per_day_kwh', 0), 1)} kWh a day).",
            "ar": f"باش تبقى تحت {n(p.get('threshold', 0))} kWh، نقّص قريب {n(p.get('cut_kwh', 0), 1)} kWh قبل آخر الشهر "
            f"(≈ {n(p.get('per_day_kwh', 0), 1)} kWh في النهار).",
        },
        "keep_pace": {
            "en": f"Well done: at this pace you stay under {n(p.get('threshold', 0))} kWh.",
            "ar": f"برافو: بالريتم هذا تبقى تحت {n(p.get('threshold', 0))} kWh.",
        },
        "leak": {
            "en": f"Fix the leak: it wastes about {n(p.get('litres_day', 0))} L a day.",
            "ar": f"صلّح التسريب: يضيّع قريب {n(p.get('litres_day', 0))} L في النهار.",
        },
        "appliance": {
            "en": f"An appliance of about {n(p.get('kw', 0), 1)} kW starts often. One hour less a day saves ≈ {n(p.get('save_kwh', 0), 1)} kWh.",
            "ar": f"فما آلة قريب {n(p.get('kw', 0), 1)} kW تشعل برشا. ساعة أقل في النهار توفّر ≈ {n(p.get('save_kwh', 0), 1)} kWh.",
        },
        "standby": {
            "en": f"Your home draws at least {n(p.get('base_w', 0))} W all the time (standby). Unplug the box, TV and chargers at night.",
            "ar": f"الدار تاكل على الأقل {n(p.get('base_w', 0))} W ديما (veille). فصّل البوكس والتلفزة والشارجورات في الليل.",
        },
        "ac": {
            "en": f"Set your air conditioner to 26 °C instead of 22 °C: ≈ {n(p.get('save_kwh', 0), 1)} kWh less (profile estimate).",
            "ar": f"حط الكليماتيزور على 26 درجة عوض 22: ≈ {n(p.get('save_kwh', 0), 1)} kWh أقل (تقدير على البروفيل).",
        },
        "water_heater": {
            "en": f"Lower the water heater to 50 °C and use a timer: ≈ {n(p.get('save_kwh', 0), 1)} kWh less (profile estimate).",
            "ar": f"نقّص السخان لـ 50 درجة وحطّو على مينوتري: ≈ {n(p.get('save_kwh', 0), 1)} kWh أقل (تقدير).",
        },
        "lighting": {
            "en": f"Replace your {n(p.get('bulbs', 0))} classic bulbs with {n(p.get('led_w', 9))} W LEDs: ≈ {n(p.get('save_kwh', 0), 1)} kWh less.",
            "ar": f"بدّل {n(p.get('bulbs', 0))} لمبة عادية بـ LED متاع {n(p.get('led_w', 9))} W: ≈ {n(p.get('save_kwh', 0), 1)} kWh أقل.",
        },
        "offpeak": {
            "en": "If you can, run the washing machine and water heater outside the evening peak. It helps the STEG grid, not your bill.",
            "ar": "كان تنجم، شعّل الماكينة والسخان برّا وقت الذروة متاع العشية. هذا يعاون STEG، موش الفاتورة.",
        },
    }
    return texts.get(code, {}).get(lang, fallback)

