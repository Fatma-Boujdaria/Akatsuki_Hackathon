import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowUp, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { useI18n, L } from "../lib/i18n";
import { useData } from "../lib/data";
import type { ChatFact, ChatOut, ChatTurn } from "../lib/types";
import { kwh } from "../lib/format";
import { Card, Chip, PageHeader, cx } from "../components/ui";
import { StatusBadge } from "./Home";

interface Message {
  role: "user" | "assistant";
  text: string;
  out?: ChatOut;
  error?: boolean;
}

const KIND: Record<ChatFact["kind"], { label: () => string; cls: string }> = {
  measured: { label: () => L("mesuré", "measured", "مقاس"), cls: "bg-success-soft text-success" },
  forecast: { label: () => L("prévision", "forecast", "توقّع"), cls: "bg-elec-soft text-elec-ink" },
  assumption: { label: () => L("hypothèse", "assumption", "فرضية"), cls: "bg-sunken text-mute" },
  profile: { label: () => L("profil déclaré", "declared profile", "بروفيل مصرّح"), cls: "bg-water-soft text-water-ink" },
};

function starters(): string[] {
  return [
    L("Combien vais-je probablement payer ce mois-ci ?", "How much will I probably pay this month?", "قداش باش نخلص الشهر هذا تقريبا؟"),
    L("Combien de kWh me restent avant la prochaine tranche ?", "How many kWh are left before the next tranche?", "قداش باقيلي kWh قبل الشريحة الجاية؟"),
    L("Pourquoi ma consommation a-t-elle augmenté ?", "Why has my consumption increased?", "علاش الاستهلاك متاعي زاد؟"),
    L("Quels appareils pèsent le plus ?", "Which of my appliances weigh the most?", "أنا الآلات اللي تاكل برشا ضو؟"),
    L("Comment réduire ma prochaine facture ?", "How can I reduce my next bill?", "كيفاش ننقّص الفاتورة الجاية؟"),
  ];
}

function Facts({ facts }: { facts: ChatFact[] }) {
  if (!facts.length) return null;
  return (
    <dl className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {facts.map((f, i) => (
        <div key={i} className="flex items-center justify-between gap-2 rounded-ctl bg-sunken px-3 py-2">
          <dt className="min-w-0 text-[12px] text-mute">
            {f.label}
            <span className={cx("ms-1.5 inline-flex rounded-full px-1.5 text-[10px] font-bold", KIND[f.kind].cls)}>{KIND[f.kind].label()}</span>
          </dt>
          <dd className="shrink-0 text-[13px] font-bold text-ink" dir="ltr">
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AssistantPage() {
  const { lang } = useI18n();
  const { insights } = useData();
  const [params, setParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const history: ChatTurn[] = messages.slice(-10).map((m) => ({ role: m.role, text: m.text.slice(0, 3900) }));
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    try {
      const out = await api.chat(q, lang, history);
      setMessages((m) => [...m, { role: "assistant", text: out.answer, out }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", text: (err as Error).message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  // /assistant?q=... from the dashboard asks right away (once, even when effects run twice in dev).
  const asked = useRef(false);
  useEffect(() => {
    const q = params.get("q");
    if (q && !asked.current) {
      asked.current = true;
      setParams({}, { replace: true });
      void ask(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(input);
  };

  const last = [...messages].reverse().find((m) => m.out)?.out;
  const suggestions = last?.suggestions ?? starters().slice(0, 3);
  const i = insights.data;

  return (
    <div className="flex min-h-[calc(100dvh-140px)] flex-col">
      <PageHeader
        title={L("Assistant IA", "AI assistant", "المساعد الذكي")}
        aside={i ? <StatusBadge status={i.status} /> : undefined}
      />

      {messages.length === 0 && (
        <Card className="mb-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-ctl bg-elec-soft text-elec-ink">
              <Sparkles size={22} strokeWidth={1.8} aria-hidden />
            </span>
            <div>
              <p className="text-[15px] font-bold text-ink">
                {L("Pose-moi une question sur ta consommation.", "Ask me about your consumption.", "اسألني على الاستهلاك متاعك.")}
              </p>
              <p className="mt-1 text-[13px] text-mute">
                {L(
                  "Je sépare toujours ce qui est mesuré de ce qui est prévu. Les montants en DT viennent du calcul des tarifs, jamais de l'IA, et ce sont des estimations.",
                  "I always separate what is measured from what is forecast. DT amounts come from the tariff engine, never from the AI, and they are estimates.",
                  "ديما نفرّق بين المقاس والمتوقّع. المبالغ بالدينار تجي من حساب الأسوام، موش من الذكاء الاصطناعي، وهي تقديرات.",
                )}
              </p>
              {i?.forecast_kwh != null && (
                <p className="mt-2 text-[13px] text-body">
                  {L("Prévision du mois", "Month forecast", "توقّع الشهر")} : <strong>{kwh(i.forecast_kwh)}</strong>
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {starters().map((s) => (
              <Chip key={s} onClick={() => void ask(s)} className="h-auto min-h-10 py-2 text-start whitespace-normal">
                {s}
              </Chip>
            ))}
          </div>
        </Card>
      )}

      <div className="flex-1 space-y-3" aria-live="polite">
        {messages.map((m, idx) =>
          m.role === "user" ? (
            <div key={idx} className="flex justify-end">
              <p className="max-w-[85%] rounded-[20px] rounded-ee-md bg-bahr px-4 py-2.5 text-[15px] text-white">{m.text}</p>
            </div>
          ) : (
            <div key={idx} className="flex justify-start">
              <div className={cx("max-w-[92%] rounded-[20px] rounded-es-md px-4 py-3", m.error ? "bg-grenade-soft text-grenade" : "bg-surface text-ink")}>
                <p className="text-[15px] leading-[23px] whitespace-pre-line">{m.text}</p>
                {m.out && <Facts facts={m.out.facts} />}
                {m.out?.source === "llm" && (
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-mute">
                    <Sparkles size={12} aria-hidden /> {L("reformulé par IA · chiffres calculés", "worded by AI · figures computed", "صياغة بالذكاء الاصطناعي · الأرقام محسوبة")}
                  </p>
                )}
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-[20px] bg-surface px-4 py-4" aria-label={L("L'assistant écrit", "The assistant is typing", "المساعد قاعد يكتب")}>
              {[0, 1, 2].map((k) => (
                <span key={k} className="tg-live-dot size-2 rounded-full bg-mute" style={{ animationDelay: `${k * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={end} />
      </div>

      <div className="sticky bottom-[calc(82px+env(safe-area-inset-bottom))] -mx-4 mt-4 space-y-2 bg-canvas px-4 pt-2 pb-3 lg:bottom-0 lg:mx-0 lg:px-0">
        {messages.length > 0 && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            {suggestions.map((s) => (
              <Chip key={s} onClick={() => void ask(s)} disabled={busy}>
                {s}
              </Chip>
            ))}
          </div>
        )}
        <form onSubmit={submit} className="flex items-center gap-2">
          <label htmlFor="ask" className="sr-only">
            {L("Ta question", "Your question", "السؤال متاعك")}
          </label>
          <input
            id="ask"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={1000}
            placeholder={L("Écris ta question…", "Type your question…", "اكتب سؤالك…")}
            className="min-h-[52px] flex-1 rounded-full border border-hairline bg-surface px-5 text-[15px] text-ink placeholder:text-control focus:border-link focus:ring-2 focus:ring-link/25 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label={L("Envoyer", "Send", "ابعث")}
            className="inline-flex size-[52px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-40"
          >
            <ArrowUp size={22} strokeWidth={2.2} />
          </button>
        </form>
        <p className="text-center text-[11px] text-mute">
          {L(
            "Les estimations ne remplacent pas ta facture officielle. Un compteur global ne mesure pas chaque appareil.",
            "Estimates do not replace your official bill. A whole-house meter does not measure each appliance.",
            "التقديرات ما تعوّضش الفاتورة الرسمية. الكونتور يقيس الدار الكل، موش كل آلة.",
          )}
        </p>
      </div>
    </div>
  );
}
