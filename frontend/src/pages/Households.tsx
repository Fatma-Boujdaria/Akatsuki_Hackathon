import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Cpu, House, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { useHouseholds } from "../lib/households";
import { L } from "../lib/i18n";
import { time } from "../lib/format";
import type { ApplianceCatalogItem, ApplianceIn, DeviceCreated, Household, HouseholdIn } from "../lib/types";
import { Field } from "../components/Field";
import { Banner } from "../components/status";
import { ApplianceEditor } from "../components/ApplianceEditor";
import { Button, Card, PageHeader, SectionLabel, cx } from "../components/ui";
import { cleanAppliances } from "./Onboarding";

function HouseholdForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial: HouseholdIn;
  onSubmit: (h: HouseholdIn) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [h, setH] = useState<HouseholdIn>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ ...h, name: h.name.trim(), address: h.address?.trim() || null });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="mt-3 space-y-3 border-t border-hairline pt-3">
      <Field label={L("Nom", "Name", "الاسم")} value={h.name} onChange={(e) => setH({ ...h, name: e.target.value })} required />
      <Field label={L("Adresse ou ville", "Address or city", "العنوان ولا المدينة")} value={h.address ?? ""} onChange={(e) => setH({ ...h, address: e.target.value })} />
      <div className="grid grid-cols-3 gap-3">
        <Field
          label={L("Occupants", "Occupants", "السكان")}
          inputMode="numeric"
          value={h.occupants ?? ""}
          onChange={(e) => setH({ ...h, occupants: e.target.value ? Math.max(1, Math.min(30, Number(e.target.value) || 1)) : null })}
        />
        <Field
          label="kVA"
          inputMode="decimal"
          value={h.subscribed_kva}
          onChange={(e) => setH({ ...h, subscribed_kva: Number(e.target.value.replace(",", ".")) || 0 })}
        />
        <Field
          label={L("Marge", "Margin", "الهامش")}
          inputMode="numeric"
          suffix="kWh"
          value={h.alert_margin_kwh}
          onChange={(e) => setH({ ...h, alert_margin_kwh: Math.max(0, Math.min(200, Number(e.target.value) || 0)) })}
        />
      </div>
      {error && (
        <Banner tone="broken" role="alert">
          {error}
        </Banner>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !h.name.trim() || !(h.subscribed_kva > 0)}>
          {submitLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {L("Annuler", "Cancel", "إلغاء")}
        </Button>
      </div>
    </form>
  );
}

function HouseholdCard({ h, isCurrent }: { h: Household; isCurrent: boolean }) {
  const { switchTo, refresh, households } = useHouseholds();
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [device, setDevice] = useState<DeviceCreated | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");

  const addDevice = async (kind: "esp32" | "simulator") => {
    setError(null);
    try {
      setDevice(await api.addDevice(h.id, kind));
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async () => {
    setError(null);
    try {
      await api.deleteHousehold(h.id);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Card className={cx(isCurrent && "ring-2 ring-link")}>
      <div className="flex items-start gap-3">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-ctl bg-tile text-water-ink">
          <House size={20} strokeWidth={1.8} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-extrabold text-ink">{h.name}</h2>
          <p className="text-[13px] text-mute">
            {[h.address, `${h.subscribed_kva} kVA`, h.occupants ? L(`${h.occupants} pers.`, `${h.occupants} people`, `${h.occupants} أشخاص`) : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-1 text-[12px] text-mute">
            {L(`${h.appliance_count} appareil(s) déclaré(s)`, `${h.appliance_count} appliance(s) declared`, `${h.appliance_count} آلة مصرّح بيها`)}
            {h.unread_alerts > 0 && <span className="font-bold text-harissa"> · {L(`${h.unread_alerts} alerte(s)`, `${h.unread_alerts} alert(s)`, `${h.unread_alerts} تنبيه`)}</span>}
          </p>
        </div>
        {isCurrent ? (
          <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-success-soft px-2.5 text-[12px] font-bold text-success">
            <Check size={14} aria-hidden /> {L("Affiché", "Shown", "معروضة")}
          </span>
        ) : (
          <Button variant="secondary" onClick={() => switchTo(h.id)}>
            {L("Afficher", "Show", "اعرض")}
          </Button>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        {h.devices.length === 0 ? (
          <p className="text-[13px] text-mute">{L("Aucun boîtier pour l'instant.", "No box yet.", "ما فماش بواطة لتوّا.")}</p>
        ) : (
          h.devices.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-ctl bg-sunken px-3 py-2 text-[13px]">
              <span className="inline-flex items-center gap-2 font-semibold text-ink">
                <Cpu size={16} aria-hidden /> {d.id} · {d.kind === "simulator" ? L("simulateur", "simulator", "سيمولاتور") : "ESP32"}
              </span>
              <span className={d.online ? "font-bold text-success" : "text-mute"}>
                {d.online
                  ? L("En ligne", "Online", "متصل")
                  : d.last_seen_at
                    ? `${L("vu à", "seen at", "آخر مرة")} ${time(d.last_seen_at)}`
                    : L("jamais connecté", "never connected", "عمرو ما تكونيكطا")}
              </span>
            </div>
          ))
        )}
      </div>

      {device && (
        <Banner tone="info" className="mt-3" title={L("Clé de l'appareil (affichée une seule fois)", "Device key (shown once)", "مفتاح البواطة (يتورّى مرة برك)")}>
          <p dir="ltr">{device.device.id}</p>
          <code dir="ltr" className="mt-1 block rounded-ctl bg-sunken px-3 py-2 text-[13px] break-all text-ink select-all">
            {device.api_key}
          </code>
        </Banner>
      )}
      {error && (
        <Banner tone="broken" role="alert" className="mt-3">
          {error}
        </Banner>
      )}

      {mode === "view" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setMode("edit")}>
            <Pencil size={16} aria-hidden /> {L("Modifier", "Edit", "بدّل")}
          </Button>
          <Button variant="secondary" onClick={() => addDevice("esp32")}>
            <Plus size={16} aria-hidden /> ESP32
          </Button>
          <Button variant="secondary" onClick={() => addDevice("simulator")}>
            <Plus size={16} aria-hidden /> {L("Simulateur", "Simulator", "سيمولاتور")}
          </Button>
          <Button variant="danger" onClick={() => setMode("delete")} disabled={households.length <= 1} title={households.length <= 1 ? L("Garde au moins un foyer", "Keep at least one home", "خلّي على الأقل دار وحدة") : undefined}>
            <Trash2 size={16} aria-hidden /> {L("Supprimer", "Delete", "فسخ")}
          </Button>
        </div>
      )}
      {mode === "edit" && (
        <HouseholdForm
          initial={{ name: h.name, address: h.address, occupants: h.occupants, subscribed_kva: h.subscribed_kva, alert_margin_kwh: h.alert_margin_kwh }}
          submitLabel={L("Enregistrer", "Save", "سجّل")}
          onCancel={() => setMode("view")}
          onSubmit={async (body) => {
            await api.updateHousehold(h.id, body);
            await refresh();
            setMode("view");
          }}
        />
      )}
      {mode === "delete" && (
        <div className="mt-3 space-y-3 rounded-ctl bg-grenade-soft p-3">
          <p className="text-[14px] text-grenade">
            {L(
              "Supprimer ce foyer efface ses boîtiers, toutes ses mesures, alertes, conseils, scores et appareils. C'est définitif.",
              "Deleting this home erases its boxes and all its readings, alerts, tips, scores and appliances. This cannot be undone.",
              "فسخ الدار هذي يفسخ البواطات والقياسات والتنبيهات والنصائح والآلات الكل. ما يرجعش.",
            )}
          </p>
          <Field
            label={L(`Tape « ${h.name} » pour confirmer`, `Type "${h.name}" to confirm`, `اكتب « ${h.name} » باش تأكّد`)}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="danger" disabled={confirmName.trim() !== h.name} onClick={remove}>
              {L("Supprimer définitivement", "Delete for good", "فسخ نهائيا")}
            </Button>
            <Button variant="secondary" onClick={() => setMode("view")}>
              {L("Annuler", "Cancel", "إلغاء")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function CurrentAppliances() {
  const { current, refresh } = useHouseholds();
  const [catalog, setCatalog] = useState<ApplianceCatalogItem[]>([]);
  const [items, setItems] = useState<ApplianceIn[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.applianceCatalog().then(setCatalog).catch(() => undefined);
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
      .catch((err) => setError((err as Error).message));
  }, [current?.id]);

  const save = async () => {
    if (!items) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.replaceAppliances(cleanAppliances(items), true);
      await refresh();
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="appareils" className="scroll-mt-24">
      <SectionLabel>
        {L("Appareils de", "Appliances of", "الآلات متاع")} « {current?.name} »
      </SectionLabel>
      {items === null ? (
        <p className="px-1 text-[13px] text-mute">{error ?? L("Chargement…", "Loading…", "قاعد يتحمّل…")}</p>
      ) : (
        <div className="space-y-3">
          <ApplianceEditor items={items} onChange={(x) => { setItems(x); setSaved(false); }} catalog={catalog} />
          {error && (
            <Banner tone="broken" role="alert">
              {error}
            </Banner>
          )}
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={busy}>
              {L("Enregistrer les appareils", "Save appliances", "سجّل الآلات")}
            </Button>
            {saved && <span className="text-[13px] font-bold text-success">{L("Enregistré", "Saved", "تسجّل")}</span>}
          </div>
        </div>
      )}
    </section>
  );
}

export function HouseholdsPage() {
  const { households, current, refresh, switchTo } = useHouseholds();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(params.get("nouveau") === "1");

  useEffect(() => {
    if (params.get("nouveau")) setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <PageHeader
        back="/profil"
        title={L("Mes foyers", "My homes", "دياري")}
        aside={
          !adding && (
            <Button onClick={() => setAdding(true)}>
              <Plus size={18} aria-hidden /> {L("Ajouter", "Add", "زيد")}
            </Button>
          )
        }
      />
      <p className="mb-4 text-[14px] text-mute">
        {L(
          "Résidence principale, secondaire, maison des parents, location : chaque foyer a ses boîtiers, ses mesures, ses alertes et ses réglages.",
          "Main home, second home, parents' house, rental: each home has its own boxes, readings, alerts and settings.",
          "الدار الأصلية، دار الصيف، دار الوالدين، دار للكراء: كل دار عندها البواطات والقياسات والتنبيهات متاعها.",
        )}
      </p>

      {adding && (
        <Card className="mb-3">
          <h2 className="t-h3 text-ink">{L("Nouveau foyer", "New home", "دار جديدة")}</h2>
          <HouseholdForm
            initial={{ name: "", address: "", occupants: null, subscribed_kva: 6, alert_margin_kwh: 10 }}
            submitLabel={L("Créer", "Create", "اعمل")}
            onCancel={() => setAdding(false)}
            onSubmit={async (body) => {
              const created = await api.createHousehold(body);
              switchTo(created.id);
              await refresh();
              setAdding(false);
              navigate("/bienvenue?etape=appareils");
            }}
          />
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {households.map((h) => (
          <HouseholdCard key={h.id} h={h} isCurrent={h.id === current?.id} />
        ))}
      </div>

      {current && <CurrentAppliances key={current.id} />}

    </>
  );
}
