import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CircleCheck, Cpu, House, Plug } from "lucide-react";
import { api } from "../lib/api";
import { firstName, useAuth } from "../lib/auth";
import { useHouseholds } from "../lib/households";
import { applianceLabel } from "../lib/appliances";
import { L } from "../lib/i18n";
import type { ApplianceCatalogItem, ApplianceIn, DeviceCreated, HouseholdIn } from "../lib/types";
import { Field } from "../components/Field";
import { Banner } from "../components/status";
import { ApplianceEditor } from "../components/ApplianceEditor";
import { LogoMark } from "../components/Logo";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { Button, Card, cx } from "../components/ui";

type Step = "home" | "appliances" | "device";

export function cleanAppliances(items: ApplianceIn[]): ApplianceIn[] {
  const hour = (h: number | null | undefined) => (h == null || !Number.isInteger(h) || h < 0 || h > 23 ? null : h);
  return items.map((a) => ({
    ...a,
    name: a.name.trim() || applianceLabel(a.category),
    power_w: a.power_w != null && a.power_w > 0 ? a.power_w : null,
    hours_per_day: a.hours_per_day != null && a.hours_per_day >= 0 && a.hours_per_day <= 24 ? a.hours_per_day : null,
    start_hour: hour(a.start_hour),
    end_hour: hour(a.end_hour),
  }));
}

function Steps({ step }: { step: Step }) {
  const steps: { key: Step; label: string; icon: ReactNode }[] = [
    { key: "home", label: L("Mon foyer", "My home", "داري"), icon: <House size={16} /> },
    { key: "appliances", label: L("Mes appareils", "My appliances", "الآلات"), icon: <Plug size={16} /> },
    { key: "device", label: L("Mon boîtier", "My box", "البواطة"), icon: <Cpu size={16} /> },
  ];
  const at = steps.findIndex((s) => s.key === step);
  return (
    <ol className="flex gap-2" aria-label={L("Étapes", "Steps", "المراحل")}>
      {steps.map((s, i) => (
        <li
          key={s.key}
          aria-current={i === at ? "step" : undefined}
          className={cx(
            "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-[12px] font-bold",
            i === at ? "bg-chip-active text-on-chip-active" : i < at ? "bg-success-soft text-success" : "bg-surface text-mute",
          )}
        >
          {s.icon}
          <span className="hidden sm:inline">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function OnboardingPage() {
  const { user } = useAuth();
  const { households, current, refresh, switchTo } = useHouseholds();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const resume = params.get("etape") === "appareils" && current;
  const [step, setStep] = useState<Step>(resume ? "appliances" : "home");
  const [home, setHome] = useState<HouseholdIn>({
    name: L("Ma maison", "My home", "داري"),
    address: "",
    occupants: null,
    subscribed_kva: 6,
    alert_margin_kwh: 10,
  });
  const [catalog, setCatalog] = useState<ApplianceCatalogItem[]>([]);
  const [items, setItems] = useState<ApplianceIn[]>([]);
  const [device, setDevice] = useState<DeviceCreated | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.applianceCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  // Resuming the appliance step: start from what the home already has.
  useEffect(() => {
    if (resume)
      api
        .appliances()
        .then((list) =>
          setItems(
            list.map((a) => ({
              category: a.category,
              name: a.name,
              quantity: a.quantity,
              power_w: a.power_w,
              hours_per_day: a.hours_per_day,
              start_hour: a.start_hour,
              end_hour: a.end_hour,
            })),
          ),
        )
        .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveHome = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const created = await api.createHousehold({
        ...home,
        name: home.name.trim() || L("Ma maison", "My home", "داري"),
        address: home.address?.trim() || null,
      });
      switchTo(created.id);
      await refresh();
      setStep("appliances");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveAppliances = async () => {
    setError(null);
    setBusy(true);
    try {
      await api.replaceAppliances(cleanAppliances(items), true);
      await refresh();
      setStep("device");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addDevice = async (kind: "esp32" | "simulator") => {
    if (!current) return;
    setError(null);
    setBusy(true);
    try {
      setDevice(await api.addDevice(current.id, kind));
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-canvas px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <LogoMark size={40} title="" />
          <LanguageSwitch className="w-auto" />
        </div>
        <h1 className="t-display text-ink">
          {households.length > 1 || (households.length === 1 && step === "home")
            ? L("Nouveau foyer", "New home", "دار جديدة")
            : `${L("Bienvenue", "Welcome", "مرحبا")}, ${firstName(user)}`}
        </h1>
        <p className="mt-1 mb-5 text-[15px] text-mute">
          {L(
            "Trois étapes pour que Tranche Guard comprenne ton foyer.",
            "Three steps so Tranche Guard understands your home.",
            "ثلاثة مراحل باش Tranche Guard يفهم الدار متاعك.",
          )}
        </p>
        <Steps step={step} />

        <div className="mt-5">
          {error && (
            <Banner tone="broken" role="alert" className="mb-4">
              {error}
            </Banner>
          )}

          {step === "home" && (
            <Card>
              <form onSubmit={saveHome} className="space-y-4">
                <Field label={L("Nom du foyer", "Home name", "اسم الدار")} value={home.name} onChange={(e) => setHome({ ...home, name: e.target.value })} required />
                <Field
                  label={L("Adresse ou ville", "Address or city", "العنوان ولا المدينة")}
                  value={home.address ?? ""}
                  onChange={(e) => setHome({ ...home, address: e.target.value })}
                  placeholder="Tunis, La Marsa"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label={L("Occupants", "Occupants", "عدد السكان")}
                    inputMode="numeric"
                    value={home.occupants ?? ""}
                    onChange={(e) => setHome({ ...home, occupants: e.target.value ? Math.max(1, Math.min(30, Number(e.target.value) || 1)) : null })}
                    help={L("facultatif", "optional", "اختياري")}
                  />
                  <Field
                    label={L("Puissance souscrite", "Subscribed power", "القوة المشترك فيها")}
                    inputMode="decimal"
                    suffix="kVA"
                    value={home.subscribed_kva}
                    onChange={(e) => setHome({ ...home, subscribed_kva: Number(e.target.value.replace(",", ".")) || 0 })}
                    help={L("sur ta facture STEG", "on your STEG bill", "مكتوبة في فاتورة STEG")}
                  />
                </div>
                <Field
                  label={L("Marge d'alerte", "Alert margin", "هامش التنبيه")}
                  inputMode="numeric"
                  suffix="kWh"
                  value={home.alert_margin_kwh}
                  onChange={(e) => setHome({ ...home, alert_margin_kwh: Math.max(0, Math.min(200, Number(e.target.value) || 0)) })}
                  help={L(
                    `Préviens-moi ${home.alert_margin_kwh} kWh avant la tranche suivante.`,
                    `Warn me ${home.alert_margin_kwh} kWh before the next tranche.`,
                    `نبّهني ${home.alert_margin_kwh} kWh قبل الشريحة الجاية.`,
                  )}
                />
                <Button type="submit" size="lg" block disabled={busy || !(home.subscribed_kva > 0)}>
                  {L("Continuer", "Continue", "كمّل")}
                </Button>
              </form>
            </Card>
          )}

          {step === "appliances" && (
            <div className="space-y-4">
              <ApplianceEditor items={items} onChange={setItems} catalog={catalog} />
              <div className="flex flex-wrap gap-3">
                <Button size="lg" className="flex-1" onClick={saveAppliances} disabled={busy}>
                  {L("Enregistrer mes appareils", "Save my appliances", "سجّل الآلات")}
                </Button>
                <Button size="lg" variant="secondary" onClick={() => setStep("device")} disabled={busy}>
                  {L("Plus tard", "Later", "من بعد")}
                </Button>
              </div>
            </div>
          )}

          {step === "device" && (
            <Card className="space-y-4">
              <h2 className="t-h2 text-ink">{L("Ton boîtier de mesure", "Your monitoring box", "البواطة متاع القياس")}</h2>
              <p className="text-[14px] text-body">
                {L(
                  "Le boîtier ESP32 (PZEM-004T pour l'électricité, YF-S201 pour l'eau) envoie une mesure toutes les 5 s. Sans boîtier, le simulateur envoie les mêmes données.",
                  "The ESP32 box (PZEM-004T for electricity, YF-S201 for water) sends a reading every 5 s. Without one, the simulator sends the same data.",
                  "البواطة ESP32 (PZEM-004T للضو، YF-S201 للماء) تبعث قياس كل 5 ثواني. بلاش بواطة، السيمولاتور يبعث نفس المعطيات.",
                )}
              </p>
              {device ? (
                <Banner tone="info" title={L("Appareil ajouté", "Device added", "البواطة تزادت")}>
                  <p>
                    {L("Identifiant", "ID", "المعرّف")} : <strong dir="ltr">{device.device.id}</strong>
                  </p>
                  <p className="mt-1">
                    {L("Clé de l'appareil (affichée une seule fois)", "Device key (shown once)", "مفتاح البواطة (يتورّى مرة برك)")} :
                  </p>
                  <code dir="ltr" className="mt-1 block rounded-ctl bg-sunken px-3 py-2 text-[13px] break-all text-ink select-all">
                    {device.api_key}
                  </code>
                </Banner>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button variant="secondary" onClick={() => addDevice("esp32")} disabled={busy}>
                    <Cpu size={18} aria-hidden /> {L("Ajouter mon boîtier ESP32", "Add my ESP32 box", "زيد البواطة ESP32")}
                  </Button>
                  <Button variant="secondary" onClick={() => addDevice("simulator")} disabled={busy}>
                    {L("Utiliser le simulateur", "Use the simulator", "استعمل السيمولاتور")}
                  </Button>
                </div>
              )}
              <Button size="lg" block onClick={() => navigate("/", { replace: true })}>
                <CircleCheck size={18} aria-hidden /> {L("Voir mon tableau de bord", "See my dashboard", "شوف الداشبورد متاعي")}
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
