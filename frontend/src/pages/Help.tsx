import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Cpu, Gauge, LifeBuoy, Send, Sparkles, Wrench } from "lucide-react";
import { api } from "../lib/api";
import { usePoll } from "../lib/usePoll";
import { L } from "../lib/i18n";
import { dateTime, num } from "../lib/format";
import { Field, SelectField } from "../components/Field";
import { Banner } from "../components/status";
import { Button, Card, CardHeader, PageHeader, SectionLabel, cx } from "../components/ui";

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group rounded-card bg-surface">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[14px] font-bold text-ink [&::-webkit-details-marker]:hidden">
        {q}
        <ChevronDown size={18} className="shrink-0 text-mute transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="px-4 pb-4 text-[14px] leading-[22px] text-body">{children}</div>
    </details>
  );
}

function TrancheTable() {
  const tariffs = usePoll((s) => api.tariffs(s), 0);
  const rows = (tariffs.data?.tranches ?? []).filter((t) => t.resource === "electricity");
  if (!rows.length) return null;
  const latest = rows.reduce((a, b) => (b.valid_from > a ? b.valid_from : a), rows[0].valid_from);
  return (
    <table className="mt-3 w-full text-[13px]">
      <thead>
        <tr className="text-mute">
          <th className="py-1.5 text-start font-semibold">{L("Consommation du mois", "Monthly use", "استهلاك الشهر")}</th>
          <th className="py-1.5 text-end font-semibold">{L("Prix / kWh", "Price / kWh", "السوم / kWh")}</th>
          <th className="py-1.5 text-end font-semibold">{L("TVA", "VAT", "TVA")}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-hairline">
        {rows
          .filter((t) => t.valid_from === latest)
          .map((t) => (
            <tr key={t.min_qty} className="text-ink">
              <td className="py-2">
                {t.max_qty == null
                  ? L(`Plus de ${num(t.min_qty)} kWh`, `Over ${num(t.min_qty)} kWh`, `أكثر من ${num(t.min_qty)} kWh`)
                  : `${num(t.min_qty)} – ${num(t.max_qty)} kWh`}
              </td>
              <td className="py-2 text-end font-bold">{t.price_millimes} {L("mil.", "mill.", "مليم")}</td>
              <td className="py-2 text-end">{Math.round(t.vat_rate * 100)} %</td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

function ContactForm() {
  const [category, setCategory] = useState("problem");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tickets = usePoll((s) => api.myTickets(s), 0, [sent]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createTicket({ category, subject: subject.trim(), message: message.trim() });
      setSent(true);
      setSubject("");
      setMessage("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const status = (s: string) =>
    s === "open" ? L("ouvert", "open", "مفتوح") : s === "answered" ? L("répondu", "answered", "تجاوب") : L("fermé", "closed", "مسكّر");

  return (
    <Card id="contact" className="scroll-mt-24">
      <CardHeader title={L("Contacter le support", "Contact support", "اتصل بالدعم")} />
      <form onSubmit={submit} className="space-y-3">
        <SelectField label={L("Sujet", "Topic", "الموضوع")} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="problem">{L("Un problème", "A problem", "مشكلة")}</option>
          <option value="device">{L("Mon boîtier", "My box", "البواطة")}</option>
          <option value="billing">{L("Facture et tarifs", "Bill and tariffs", "الفاتورة والأسوام")}</option>
          <option value="question">{L("Une question", "A question", "سؤال")}</option>
          <option value="feedback">{L("Une idée, un avis", "An idea, feedback", "فكرة ولا رأي")}</option>
        </SelectField>
        <Field label={L("Titre", "Title", "العنوان")} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
        <div>
          <label htmlFor="msg" className="mb-2 block text-[14px] font-semibold text-body">
            {L("Message", "Message", "الرسالة")}
          </label>
          <textarea
            id="msg"
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={5000}
            className="block w-full rounded-ctl border border-hairline bg-surface px-4 py-3 text-[15px] text-ink focus:border-link focus:ring-2 focus:ring-link/25 focus:outline-none"
          />
        </div>
        {sent && (
          <Banner tone="info" role="status">
            {L("Message envoyé. Le support te répond par e-mail.", "Message sent. Support replies by email.", "الرسالة تبعثت. الدعم يجاوبك بالإيميل.")}
          </Banner>
        )}
        {error && (
          <Banner tone="broken" role="alert">
            {error}
          </Banner>
        )}
        <Button type="submit" disabled={busy || subject.trim().length < 3 || message.trim().length < 10}>
          <Send size={16} aria-hidden className="rtl:-scale-x-100" /> {L("Envoyer", "Send", "ابعث")}
        </Button>
      </form>
      {!!tickets.data?.length && (
        <div className="mt-5">
          <h3 className="mb-2 text-[13px] font-bold text-mute">{L("Mes messages", "My messages", "الرسائل متاعي")}</h3>
          <ul className="divide-y divide-hairline">
            {tickets.data.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                <span className="min-w-0 truncate font-semibold text-ink">{t.subject}</span>
                <span className="shrink-0 text-mute">
                  {dateTime(t.created_at)} · <span className={cx("font-bold", t.status === "open" ? "text-elec-ink" : "text-success")}>{status(t.status)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export function HelpPage() {
  return (
    <>
      <PageHeader back="/profil" title={L("Aide et support", "Help and support", "المساعدة والدعم")} />

      <Link to="/assistant" className="mb-3 flex items-center gap-3 rounded-card bg-surface p-4 no-underline hover:bg-sunken">
        <span className="inline-flex size-11 items-center justify-center rounded-ctl bg-elec-soft text-elec-ink">
          <Sparkles size={20} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-ink">{L("Une question rapide ?", "A quick question?", "عندك سؤال سريع؟")}</span>
          <span className="block text-[13px] text-mute">{L("L'assistant répond tout de suite.", "The assistant answers right away.", "المساعد يجاوبك توّا.")}</span>
        </span>
      </Link>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-5">
        <div className="space-y-2.5">
          <SectionLabel className="pt-0">
            <span className="inline-flex items-center gap-1.5">
              <LifeBuoy size={15} aria-hidden /> {L("Questions fréquentes", "Frequently asked questions", "أسئلة متكرّرة")}
            </span>
          </SectionLabel>
          <Faq q={L("C'est quoi une tranche STEG ?", "What is a STEG tranche?", "شنية الشريحة متاع STEG؟")}>
            <p>
              {L(
                "La STEG facture l'électricité par tranches mensuelles : plus tu consommes dans le mois, plus le prix du kWh monte. D'après la grille utilisée ici, dès que tu passes un seuil (200, 300 puis 500 kWh), c'est tout le mois qui est facturé au prix de la nouvelle tranche. Une petite différence de kWh peut donc coûter cher.",
                "STEG bills electricity by monthly tranches: the more you use in a month, the higher the price per kWh. With the grid used here, once you pass a threshold (200, 300 then 500 kWh), the whole month is billed at the new tranche's price, so a few kWh can cost a lot.",
                "الـ STEG تفوتر الضو بالشرائح كل شهر: كل ما تستهلك أكثر، سوم الـ kWh يطلع. حسب الجدول هذا، كيف تتعدّى حدّ (200، 300، 500 kWh)، الشهر الكل يتحسب بسوم الشريحة الجديدة.",
              )}
            </p>
            <TrancheTable />
            <p className="mt-2 text-[12px] text-mute">
              {L(
                "Grille à vérifier sur une vraie facture STEG ; ajoute aussi la redevance de puissance (kVA), la TVA et les taxes municipales.",
                "Grid to be checked on a real STEG bill; the power fee (kVA), VAT and municipal taxes are added too.",
                "الجدول لازم يتثبّت في فاتورة حقيقية؛ تتزاد زادة معلوم القوة (kVA) والـ TVA والأداءات البلدية.",
              )}
            </p>
          </Faq>
          <Faq q={L("Pourquoi « estimation » partout ?", "Why \"estimate\" everywhere?", "علاش « تقدير » في كل بلاصة؟")}>
            {L(
              "Le boîtier mesure à ± 2 à 5 % près : c'est assez pour prévenir et conseiller, pas pour facturer. Les montants sont calculés avec les tarifs enregistrés et ne remplacent pas ta facture officielle.",
              "The box measures within ± 2 to 5 %: enough to warn and advise, not to bill. Amounts are computed with the stored tariffs and do not replace your official bill.",
              "البواطة تقيس بفرق ± 2 حتى 5 %: يكفي باش ننبّهوك وننصحوك، موش باش نفوترو. المبالغ محسوبة بالأسوام المسجّلة وما تعوّضش الفاتورة الرسمية.",
            )}
          </Faq>
          <Faq q={L("Comment est calculée la prévision ?", "How is the forecast computed?", "كيفاش يتحسب التوقّع؟")}>
            {L(
              "On prend ton rythme moyen des 7 derniers jours et on le prolonge jusqu'à la fin du mois. Avec moins d'une heure de mesures, il n'y a pas de prévision. Tes appareils déclarés servent aux conseils, pas à la mesure.",
              "We take your average pace over the last 7 days and extend it to the end of the month. With less than an hour of readings there is no forecast. Declared appliances feed the tips, not the measurement.",
              "ناخذو الريتم متاعك في 7 أيام اللي فاتو ونكمّلوه لآخر الشهر. كان القياسات أقل من ساعة، ما فماش توقّع. الآلات المصرّح بيها للنصائح، موش للقياس.",
            )}
          </Faq>
          <Faq q={L("Le boîtier mesure-t-il chaque appareil ?", "Does the box measure each appliance?", "البواطة تقيس كل آلة؟")}>
            {L(
              "Non. Il mesure toute la maison au compteur. La répartition par appareil est une estimation d'après ce que tu déclares. Les « gros consommateurs probables » viennent des sauts de puissance détectés.",
              "No. It measures the whole house at the meter. The split per appliance is an estimate from what you declare. \"Probable heavy consumers\" come from detected power steps.",
              "لا. تقيس الدار الكل عند الكونتور. التقسيم على الآلات تقدير حسب اللي صرّحت بيه.",
            )}
          </Faq>
          <Faq q={L("Comment marche la détection de fuite ?", "How does leak detection work?", "كيفاش نكتشفو التسريب؟")}>
            {L(
              "Si l'eau coule sans s'arrêter pendant 2 h entre 01:00 et 05:00, une alerte de fuite probable part. Tu peux régler cette fenêtre dans Paramètres.",
              "If water flows non-stop for 2 h between 01:00 and 05:00, a probable-leak alert is sent. You can change this window in Settings.",
              "كان الماء يجري بلا وقفة ساعتين بين 01:00 و05:00، يجيك تنبيه تسريب. تنجم تبدّل الوقت في الإعدادات.",
            )}
          </Faq>
          <Faq q={L("Pourquoi pas de montant pour l'eau ?", "Why no amount for water?", "علاش ما فماش مبلغ للماء؟")}>
            {L(
              "La grille SONEDE et sa période de facturation n'ont pas encore été vérifiées sur une vraie facture. Tu vois les litres et les fuites ; les montants et alertes de tranche eau arrivent une fois la grille saisie par l'administrateur.",
              "The SONEDE grid and billing period have not been checked on a real bill yet. You see litres and leaks; water amounts and tranche alerts come once the admin enters the grid.",
              "جدول SONEDE مازال ما تثبّتش في فاتورة حقيقية. تشوف اللترات والتسريبات؛ المبالغ تجي كيف الأدمين يدخّل الجدول.",
            )}
          </Faq>
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Cpu size={18} aria-hidden /> {L("Le boîtier Tranche Guard", "The Tranche Guard box", "بواطة Tranche Guard")}
                </span>
              }
            />
            <ul className="space-y-2 text-[14px] text-body">
              <li>• {L("ESP32 + PZEM-004T : tension, courant, puissance et énergie.", "ESP32 + PZEM-004T: voltage, current, power and energy.", "ESP32 + PZEM-004T: الجهد، التيار، القوة والطاقة.")}</li>
              <li>• {L("YF-S201 après le compteur SONEDE : débit d'eau (≈ 450 impulsions par litre, à calibrer).", "YF-S201 after the SONEDE meter: water flow (≈ 450 pulses per litre, to calibrate).", "YF-S201 بعد كونتور SONEDE: دبي الماء (≈ 450 نبضة في اللتر).")}</li>
              <li>• {L("Une mesure toutes les 5 s par Wi-Fi ; le total d'eau reste en mémoire si le boîtier redémarre.", "One reading every 5 s over Wi-Fi; the water total is kept if the box restarts.", "قياس كل 5 ثواني بالويفي؛ مجموع الماء يتحفظ كان البواطة تعاود تشعل.")}</li>
              <li>• {L("Il ne remplace jamais le disjoncteur de la maison.", "It never replaces the home's circuit breaker.", "عمرها ما تعوّض الديجونكتور متاع الدار.")}</li>
            </ul>
          </Card>
          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Wrench size={18} aria-hidden /> {L("Dépannage", "Troubleshooting", "حل المشاكل")}
                </span>
              }
            />
            <dl className="space-y-3 text-[14px]">
              <div>
                <dt className="font-bold text-ink">{L("« Appareil hors ligne »", "\"Device offline\"", "« البواطة مقطوعة »")}</dt>
                <dd className="text-body">{L("Vérifie l'alimentation du boîtier et le Wi-Fi (ou le partage de connexion du téléphone).", "Check the box's power and Wi-Fi (or the phone hotspot).", "ثبّت في الكورون والويفي (ولا البارتاج متاع التليفون).")}</dd>
              </div>
              <div>
                <dt className="font-bold text-ink">{L("« Mesure peu fiable »", "\"Unreliable reading\"", "« قياس موش مضمون »")}</dt>
                <dd className="text-body">{L("Le capteur sature ou le signal est mauvais : aucune valeur n'est inventée. Vérifie le câblage du PZEM et du capteur d'eau.", "The sensor saturates or the signal is bad: no value is made up. Check the PZEM and water sensor wiring.", "الكابتور مشبّع ولا السينيال ضعيف: ما نخترعو حتى رقم. ثبّت في الخيوط.")}</dd>
              </div>
              <div>
                <dt className="font-bold text-ink">{L("Le total ne bouge plus", "The total stopped moving", "المجموع ما عادش يتحرك")}</dt>
                <dd className="text-body">{L("Ouvre Contrôle démo pour voir la dernière mesure reçue, ou utilise le simulateur.", "Open Demo control to see the last reading received, or use the simulator.", "حل التحكم في الديمو باش تشوف آخر قياس، ولا استعمل السيمولاتور.")}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Gauge size={18} aria-hidden /> {L("Les états de consommation", "Consumption states", "حالات الاستهلاك")}
                </span>
              }
            />
            <ul className="space-y-1.5 text-[14px] text-body">
              <li><strong className="text-success">{L("Normal", "Normal", "عادي")}</strong> · {L("dans le rythme attendu", "within the expected range", "في الريتم العادي")}</li>
              <li><strong className="text-water-ink">{L("Attention", "Attention", "رد بالك")}</strong> · {L("hausse ou prévision au-dessus du seuil", "rising, or forecast above the threshold", "زيادة ولا توقّع فوق الحد")}</li>
              <li><strong className="text-harissa">{L("Avertissement", "Warning", "تحذير")}</strong> · {L("dans la marge avant la tranche suivante", "inside the margin before the next tranche", "في الهامش قبل الشريحة الجاية")}</li>
              <li><strong className="text-grenade">{L("Critique", "Critical", "خطير")}</strong> · {L("seuil franchi ou fuite probable", "threshold crossed or probable leak", "تعدّيت الحد ولا تسريب")}</li>
              <li><strong className="text-mute">{L("Mesure indisponible", "Reading unavailable", "القياس موش متوفر")}</strong> · {L("boîtier hors ligne ou mesure peu fiable", "box offline or unreliable reading", "البواطة مقطوعة ولا القياس موش مضمون")}</li>
            </ul>
          </Card>
          <ContactForm />
        </div>
      </div>
    </>
  );
}
