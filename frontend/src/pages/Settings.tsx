import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { Cpu, Monitor, Moon, Plus, Sun, Trash2, Zap } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useData } from "../lib/data";
import { useTheme, type ThemeChoice } from "../lib/theme";
import { usePoll } from "../lib/usePoll";
import { dateTime, num } from "../lib/format";
import { Field, SelectField } from "../components/Field";
import { L } from "../lib/i18n";
import { AccountSettings } from "../components/AccountSettings";
import { Banner, Pill } from "../components/status";
import { Button, ButtonLink, Card, CardHeader, IconTile, Label, PageHeader, Segmented, Skeleton, cx } from "../components/ui";
import type { FeeRow, Resource, Settings, SpikeOut, Tariffs, TrancheRow } from "../lib/types";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

function SaveRow({ busy, saved, error, disabled }: { busy: boolean; saved: boolean; error: string | null; disabled?: boolean }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <Button type="submit" disabled={busy || disabled}>
        {busy ? L("Enregistrement…", "Saving…", "قاعد يسجّل…") : L("Enregistrer", "Save", "سجّل")}
      </Button>
      {saved && !error && <span className="t-small font-bold text-success" role="status">{L("Enregistré.", "Saved.", "تسجّل.")}</span>}
      {error && (
        <span className="t-small text-grenade" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function useSaver() {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      await fn();
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, saved, error, run };
}

// ---- Household --------------------------------------------------------------------

function HouseholdForm({ s, onSaved }: { s: Settings; onSaved: (s: Settings) => void }) {
  const [name, setName] = useState(s.name);
  const [kva, setKva] = useState(String(s.subscribed_kva));
  const [margin, setMargin] = useState(String(s.alert_margin_kwh));
  const saver = useSaver();

  const kvaNum = Number(kva.replace(",", "."));
  const marginNum = Number(margin);
  const kvaError = !kva || !(kvaNum > 0 && kvaNum <= 100) ? L("Indique une puissance entre 1 et 100 kVA.", "Enter a power between 1 and 100 kVA.", "اكتب قوة بين 1 و100 kVA.") : null;
  const marginError = !Number.isInteger(marginNum) || marginNum < 1 || marginNum > 50 ? L("Choisis une valeur entre 1 et 50.", "Pick a value between 1 and 50.", "اختار قيمة بين 1 و50.") : null;
  const nameError = !name.trim() ? L("Donne un nom à ton foyer.", "Give your home a name.", "عطي اسم للدار.") : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (kvaError || marginError || nameError) return;
    void saver.run(async () =>
      onSaved(await api.updateSettings({ name: name.trim(), subscribed_kva: kvaNum, alert_margin_kwh: marginNum })),
    );
  };

  return (
    <Card>
      <CardHeader title={L("Foyer", "Home", "الدار")} />
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label={L("Nom du foyer", "Home name", "اسم الدار")} value={name} onChange={(e) => setName(e.target.value)} error={nameError} maxLength={100} />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label={L("Puissance souscrite (kVA)", "Subscribed power (kVA)", "القوة المشترك فيها (kVA)")}
            inputMode="decimal"
            value={kva}
            onChange={(e) => setKva(e.target.value)}
            help={L("Indiquée sur ta facture STEG.", "Shown on your STEG bill.", "مكتوبة في فاتورة STEG.")}
            error={kva !== String(s.subscribed_kva) ? kvaError : null}
            suffix="kVA"
          />
          <Field
            label={L("Marge d'alerte (kWh)", "Alert margin (kWh)", "هامش التنبيه (kWh)")}
            inputMode="numeric"
            value={margin}
            onChange={(e) => setMargin(e.target.value.replace(/[^\d]/g, ""))}
            help={L(L("Choisis une valeur entre 1 et 50.", "Pick a value between 1 and 50.", "اختار قيمة بين 1 و50."), "Pick a value between 1 and 50.", "اختار قيمة بين 1 و50.")}
            error={margin !== String(s.alert_margin_kwh) ? marginError : null}
            suffix="kWh"
          />
        </div>
        <SaveRow {...saver} disabled={!!(kvaError || marginError || nameError)} />
      </form>
    </Card>
  );
}

// ---- Leak window ------------------------------------------------------------------

function LeakForm({ s, onSaved }: { s: Settings; onSaved: (s: Settings) => void }) {
  const [start, setStart] = useState(s.leak_start_hour);
  const [end, setEnd] = useState(s.leak_end_hour);
  const [minutes, setMinutes] = useState(String(s.leak_min_minutes));
  const saver = useSaver();
  const minNum = Number(minutes);
  const sameError = start === end ? L("Le début et la fin doivent être différents.", "Start and end must differ.", "البداية والنهاية لازم يختلفو.") : null;
  const minError = !Number.isInteger(minNum) || minNum < 1 || minNum > 720 ? L("Choisis une durée entre 1 et 720 minutes.", "Pick a duration between 1 and 720 minutes.", "اختار مدة بين 1 و720 دقيقة.") : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (sameError || minError) return;
    void saver.run(async () =>
      onSaved(await api.updateSettings({ leak_start_hour: start, leak_end_hour: end, leak_min_minutes: minNum })),
    );
  };

  return (
    <Card id="fuites" className="scroll-mt-24">
      <CardHeader title={L("Surveillance des fuites", "Leak watch", "مراقبة التسريبات")} />
      <p className="t-small -mt-2 mb-5 text-mute">
        {L(
          "La nuit, personne ne devrait utiliser d'eau. Une eau qui coule sans arrêt dans cette fenêtre déclenche une alerte.",
          "At night nobody should use water. Water running non-stop in this window raises an alert.",
          "في الليل ما لازم حد يستعمل الماء. كان الماء يجري بلا وقفة في الوقت هذا، يجيك تنبيه.",
        )}
      </p>
      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="grid grid-cols-2 gap-5">
          <SelectField label={L("Début", "Start", "البداية")} value={start} onChange={(e) => setStart(Number(e.target.value))} error={sameError}>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hh(h)}
              </option>
            ))}
          </SelectField>
          <SelectField label={L("Fin", "End", "النهاية")} value={end} onChange={(e) => setEnd(Number(e.target.value))}>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hh(h)}
              </option>
            ))}
          </SelectField>
        </div>
        <Field
          label={L("Durée avant l'alerte (minutes)", "Duration before the alert (minutes)", "المدة قبل التنبيه (دقايق)")}
          inputMode="numeric"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value.replace(/[^\d]/g, ""))}
          help={L("120 min par défaut. Pour la démo, mets 2 min.", "120 min by default. For the demo, use 2 min.", "120 دقيقة عادة. للديمو حط 2 دقايق.")}
          error={minutes !== String(s.leak_min_minutes) ? minError : null}
          suffix="min"
        />
        <SaveRow {...saver} disabled={!!(sameError || minError)} />
      </form>
    </Card>
  );
}

// ---- Devices ----------------------------------------------------------------------

function DevicesCard({ s, onSaved }: { s: Settings; onSaved: (s: Settings) => void }) {
  const saver = useSaver();
  const choose = (id: string | null) =>
    void saver.run(async () =>
      onSaved(await api.updateSettings(id ? { active_device_id: id } : { clear_active_device: true })),
    );
  const options: { id: string | null; title: string; sub: string; online?: boolean; seen?: string | null }[] = [
    ...s.devices.map((d) => ({
      id: d.id,
      title: d.kind === "simulator" ? `${L("Simulateur", "Simulator", "سيمولاتور")} · ${d.id}` : `${L("Boîtier ESP32", "ESP32 box", "بواطة ESP32")} · ${d.id}`,
      sub: d.kind === "simulator" ? L("Envoie le même JSON que la box", "Sends the same JSON as the box", "يبعث نفس الـ JSON متاع البواطة") : "PZEM-004T · YF-S201",
      online: d.online,
      seen: d.last_seen_at,
    })),
    { id: null, title: L("Tous les appareils", "All devices", "البواطات الكل"), sub: L("Additionne les mesures de chaque appareil", "Adds up every device's readings", "يجمع القياسات الكل") },
  ];

  return (
    <Card id="appareil" className="scroll-mt-24">
      <CardHeader title={L("Appareil actif", "Active device", "البواطة المستعملة")} />
      <div role="radiogroup" aria-label={L("Appareil actif", "Active device", "البواطة المستعملة")} className="space-y-2.5">
        {options.map((o) => {
          const active = o.id === s.active_device_id;
          return (
            <button
              key={o.id ?? "all"}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={saver.busy}
              onClick={() => !active && choose(o.id)}
              className={cx(
                "flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-ctl border px-4 py-3 text-start transition-colors disabled:cursor-wait",
                active ? "border-primary bg-primary-soft" : "border-hairline bg-surface hover:bg-sunken",
              )}
            >
              <span
                aria-hidden
                className={cx(
                  "inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                  active ? "border-primary" : "border-control",
                )}
              >
                {active && <span className="size-2.5 rounded-full bg-primary" />}
              </span>
              <IconTile tone="neutral" size={32}>
                <Cpu size={16} strokeWidth={1.5} />
              </IconTile>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-ink">{o.title}</span>
                <span className="block font-mono text-[12px] text-mute">{o.sub}</span>
              </span>
              {o.online !== undefined &&
                (o.online ? (
                  <Pill tone="live">{L("En direct", "Live", "مباشر")}</Pill>
                ) : (
                  <Pill tone="neutral">{o.seen ? `${L("vu", "seen", "آخر مرة")} ${dateTime(o.seen)}` : L("jamais vu", "never seen", "عمرو ما تشاف")}</Pill>
                ))}
            </button>
          );
        })}
      </div>
      {saver.error && <p className="t-small mt-3 text-grenade">{saver.error}</p>}
    </Card>
  );
}

// ---- Demo control ---------------------------------------------------------------------

function DemoCard({ onDone }: { onDone: () => void }) {
  const [result, setResult] = useState<SpikeOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const spike = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.spike());
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card id="demo" className="scroll-mt-24">
      <CardHeader title={L("Contrôle démo", "Demo control", "التحكم في الديمو")} aside={<Pill tone="neutral">DEMO_MODE</Pill>} />
      <p className="t-body text-body">
        {L(
          "Ajoute un pic de +3,5 kW pendant 30 s au simulateur et assez de kWh pour entrer dans la marge d'alerte. L'alerte de tranche et les conseils apparaissent en une dizaine de secondes.",
          "Adds a +3.5 kW spike for 30 s to the simulator and enough kWh to enter the alert margin. The tranche alert and tips show up within about ten seconds.",
          "يزيد قمة +3,5 kW لمدة 30 ثانية للسيمولاتور وkWh كافية باش تدخل في هامش التنبيه. التنبيه والنصائح يبانو في عشرة ثواني تقريبا.",
        )}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={spike} disabled={busy}>
          <Zap size={18} strokeWidth={1.75} aria-hidden />
          {busy ? L("Envoi…", "Sending…", "قاعد يبعث…") : L("Simuler un pic", "Simulate a spike", "اعمل قمة")}
        </Button>
        <ButtonLink to="/esp" variant="secondary">
          <Cpu size={18} strokeWidth={1.5} aria-hidden /> {L("Contrôle ESP", "ESP control", "التحكم في ESP")}
        </ButtonLink>
      </div>
      <p className="t-small mt-3 text-mute">
        {L(
          "Contrôle ESP : un boîtier virtuel dans le navigateur. Règle la puissance, le débit, les pannes et le compteur à la main, sans le simulateur Python.",
          "ESP control: a virtual box in the browser. Set power, flow, faults and the meter by hand, without the Python simulator.",
          "التحكم في ESP: بواطة افتراضية في المتصفح. بدّل القوة والدبي والأعطال والكونتور بيدك.",
        )}
      </p>
      {result && (
        <Banner tone={result.simulator_online ? "info" : "headsup"} className="mt-4" role="status">
          {result.message}
          <span className="mt-1 block font-mono text-[12px] text-mute">
            {result.device_id} · +{num(result.extra_w)} W · {result.duration_s} s · +{num(result.energy_kwh, 1)} kWh
          </span>
        </Banner>
      )}
      {error && (
        <Banner tone="broken" className="mt-4" role="alert">
          {error}
        </Banner>
      )}
    </Card>
  );
}

// ---- Tariff grid (admin edits) ----------------------------------------------------------

type Draft = Tariffs;

export function TariffCard({ isAdmin }: { isAdmin: boolean }) {
  const tariffs = usePoll((s) => api.tariffs(s), 0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const saver = useSaver();
  const editing = draft !== null;
  const data = draft ?? tariffs.data;

  const setTranche = (i: number, patch: Partial<TrancheRow>) =>
    setDraft((d) => d && { ...d, tranches: d.tranches.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const setFee = (i: number, patch: Partial<FeeRow>) =>
    setDraft((d) => d && { ...d, fees: d.fees.map((f, j) => (j === i ? { ...f, ...patch } : f)) });

  const addBand = (resource: Resource) =>
    setDraft((d) => {
      if (!d) return d;
      const rows = d.tranches.filter((t) => t.resource === resource).sort((a, b) => a.min_qty - b.min_qty);
      const last = rows[rows.length - 1];
      const validFrom = last?.valid_from ?? new Date().toISOString().slice(0, 10);
      const tranches = d.tranches.map((t) => (t === last ? { ...t, max_qty: t.max_qty ?? t.min_qty + 10 } : t));
      const min = last ? (last.max_qty ?? last.min_qty + 10) : 0;
      return {
        ...d,
        tranches: [...tranches, { resource, min_qty: min, max_qty: null, price_millimes: 0, vat_rate: 0.07, valid_from: validFrom }],
      };
    });

  const removeBand = (i: number) => setDraft((d) => d && { ...d, tranches: d.tranches.filter((_, j) => j !== i) });

  const save = () =>
    void saver.run(async () => {
      if (!draft) return;
      await api.updateTariffs({ tranches: draft.tranches, fees: draft.fees });
      setDraft(null);
      await tariffs.refresh();
    });

  const groups: { resource: Resource; title: string; unit: string }[] = [
    { resource: "electricity", title: L("Électricité · STEG", "Electricity · STEG", "الضو · STEG"), unit: "kWh" },
    { resource: "water", title: L("Eau · SONEDE", "Water · SONEDE", "الماء · SONEDE"), unit: "m³" },
  ];

  const numInput = "w-full min-h-10 rounded-[8px] border border-control/60 bg-surface px-2 font-mono text-[13px] text-ink tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25";

  return (
    <Card id="tarifs" className="scroll-mt-24">
      <CardHeader
        title={L("Grille tarifaire", "Tariff grid", "جدول الأسوام")}
        aside={
          isAdmin && !editing && tariffs.data ? (
            <Button variant="secondary" onClick={() => setDraft(structuredClone(tariffs.data!))}>
              Modifier
            </Button>
          ) : !isAdmin ? (
            <Pill tone="neutral">{L("lecture seule", "read only", "قراءة برك")}</Pill>
          ) : undefined
        }
      />
      {!data ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="space-y-7">
          {groups.map((g) => {
            const rows = data.tranches
              .map((t, i) => ({ t, i }))
              .filter(({ t }) => t.resource === g.resource)
              .sort((a, b) => a.t.min_qty - b.t.min_qty);
            return (
              <div key={g.resource}>
                <Label className="mb-2">{g.title}</Label>
                {rows.length === 0 && !editing ? (
                  <p className="t-small text-mute">{L("Pas encore de grille. Les montants en DT de l'eau s'activeront dès qu'elle sera saisie.", "No grid yet. Water DT amounts will turn on once it is entered.", "ما فماش جدول لتوّا. مبالغ الماء تتفعّل كيف يتدخّل.")}</p>
                ) : (
                  <div className="-mx-1 overflow-x-auto">
                    <table className="w-full min-w-[460px] border-separate border-spacing-1 text-start">
                      <thead>
                        <tr className="t-label text-mute">
                          <th className="font-medium">De ({g.unit})</th>
                          <th className="font-medium">À ({g.unit})</th>
                          <th className="font-medium">Prix (millimes)</th>
                          <th className="font-medium">TVA (%)</th>
                          {editing && <th className="sr-only">Supprimer</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(({ t, i }) => (
                          <tr key={i} className="t-data text-ink">
                            {editing ? (
                              <>
                                <td><input aria-label="De" className={numInput} inputMode="decimal" value={t.min_qty} onChange={(e) => setTranche(i, { min_qty: Number(e.target.value) || 0 })} /></td>
                                <td><input aria-label="À" className={numInput} inputMode="decimal" placeholder="∞" value={t.max_qty ?? ""} onChange={(e) => setTranche(i, { max_qty: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                                <td><input aria-label="Prix en millimes" className={numInput} inputMode="numeric" value={t.price_millimes} onChange={(e) => setTranche(i, { price_millimes: Math.round(Number(e.target.value) || 0) })} /></td>
                                <td><input aria-label="TVA en pourcent" className={numInput} inputMode="decimal" value={+(t.vat_rate * 100).toFixed(2)} onChange={(e) => setTranche(i, { vat_rate: (Number(e.target.value) || 0) / 100 })} /></td>
                                <td className="w-11">
                                  <button type="button" aria-label="Supprimer la tranche" onClick={() => removeBand(i)} className="inline-flex size-10 cursor-pointer items-center justify-center rounded-[8px] text-mute hover:bg-grenade-soft hover:text-grenade">
                                    <Trash2 size={16} strokeWidth={1.5} />
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="border-t border-hairline py-2">{num(t.min_qty)}</td>
                                <td className="border-t border-hairline py-2">{t.max_qty == null ? L("et plus", "and more", "وأكثر") : num(t.max_qty)}</td>
                                <td className="border-t border-hairline py-2">{num(t.price_millimes)}</td>
                                <td className="border-t border-hairline py-2">{num(t.vat_rate * 100)} %</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {editing && (
                  <Button variant="ghost" className="mt-1 -ml-3 !px-3" onClick={() => addBand(g.resource)}>
                    <Plus size={16} strokeWidth={1.75} aria-hidden /> Ajouter une tranche
                  </Button>
                )}
              </div>
            );
          })}

          <div>
            <Label className="mb-2">{L("Redevances et taxes", "Fees and taxes", "المعاليم والأداءات")}</Label>
            <ul className="divide-y divide-hairline">
              {data.fees.map((f, i) => (
                <li key={f.key} className="flex items-center justify-between gap-4 py-2">
                  <span className="min-w-0 truncate font-mono text-[12px] text-body">{f.key}</span>
                  {editing ? (
                    <input aria-label={`Montant ${f.key} en millimes`} className={`${numInput} !w-28 text-right`} inputMode="decimal" value={f.value_millimes} onChange={(e) => setFee(i, { value_millimes: Number(e.target.value) || 0 })} />
                  ) : (
                    <span className="t-data text-ink">{num(f.value_millimes, 1, false)} mill.</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[13px] text-mute">
              Mode de calcul : {data.pricing_mode === "progressive" ? "progressif (chaque tranche à son prix)" : "la tranche atteinte s'applique à tout le mois"}.
            </p>
          </div>

          {editing && (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={save} disabled={saver.busy}>
                {saver.busy ? L("Enregistrement…", "Saving…", "قاعد يسجّل…") : L("Enregistrer la grille", "Save the grid", "سجّل الجدول")}
              </Button>
              <Button variant="secondary" onClick={() => setDraft(null)}>
                Annuler
              </Button>
              {saver.error && <span className="t-small text-grenade" role="alert">{saver.error}</span>}
            </div>
          )}
          {!editing && saver.saved && <p className="t-small text-primary" role="status">Grille enregistrée.</p>}
        </div>
      )}
    </Card>
  );
}

// ---- Page -------------------------------------------------------------------------------

export function SettingsPage() {
  const { settings, dashboard } = useData();
  const { user } = useAuth();
  const { choice, setChoice } = useTheme();
  const { hash } = useLocation();
  const s = settings.data;

  useEffect(() => {
    if (hash && s) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash, s]);

  const onSaved = () => {
    void settings.refresh();
    void dashboard.refresh();
  };

  return (
    <>
      <PageHeader back="/profil" label={s ? s.name : L("Mon foyer", "My home", "داري")} title={L("Paramètres", "Settings", "الإعدادات")} />
      {!s ? (
        settings.error ? (
          <Banner tone="broken" title={L("Impossible de charger les réglages", "Could not load the settings", "ما نجّمناش نحمّلو الإعدادات")}>{settings.error}</Banner>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 sm:gap-5 lg:grid-cols-2">
          <div className="grid grid-cols-1 gap-4 sm:gap-5">
            <HouseholdForm key={`h-${s.household_id}-${s.name}-${s.subscribed_kva}-${s.alert_margin_kwh}`} s={s} onSaved={onSaved} />
            <LeakForm key={`l-${s.leak_start_hour}-${s.leak_end_hour}-${s.leak_min_minutes}`} s={s} onSaved={onSaved} />
            <TariffCard isAdmin={user?.role === "admin"} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:gap-5">
            {s.demo_mode && <DemoCard onDone={() => void dashboard.refresh()} />}
            <DevicesCard s={s} onSaved={onSaved} />
            <Card>
              <CardHeader title={L("Apparence", "Appearance", "المظهر")} />
              <Segmented<ThemeChoice>
                label={L("Thème", "Theme", "الثيم")}
                value={choice}
                onChange={setChoice}
                options={[
                  { value: "system", label: L("Système", "System", "النظام"), icon: <Monitor size={16} strokeWidth={1.5} /> },
                  { value: "light", label: L("Clair", "Light", "فاتح"), icon: <Sun size={16} strokeWidth={1.5} /> },
                  { value: "dark", label: L("Sombre", "Dark", "غامق"), icon: <Moon size={16} strokeWidth={1.5} /> },
                ]}
              />
            </Card>
            <AccountSettings />
          </div>
        </div>
      )}
    </>
  );
}
