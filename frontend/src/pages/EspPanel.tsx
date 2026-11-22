import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Cpu, Droplet, Eye, EyeOff, Pause, Play, Send, TriangleAlert, Zap } from "lucide-react";
import { useData } from "../lib/data";
import { useVirtualEsp } from "../lib/virtualEsp";
import { useNow } from "../lib/usePoll";
import { flow as fmtFlow, kwh, kwhValue, num, time, watts } from "../lib/format";
import { Button, Card, CardHeader, IconTile, Label, PageHeader, Segmented, cx } from "../components/ui";
import { Banner, LiveDot, Pill } from "../components/status";
import { Field } from "../components/Field";
import { L } from "../lib/i18n";
import { TrancheBar } from "../components/TrancheBar";

// "Contrôle ESP": a virtual box for the demo and for testing every screen state.

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-medium transition-colors",
        active ? "border-primary bg-primary-soft text-primary" : "border-hairline bg-surface text-body hover:bg-sunken",
      )}
    >
      {children}
    </button>
  );
}

function Switch({ checked, onChange, label, help, tone }: { checked: boolean; onChange: (v: boolean) => void; label: string; help: string; tone: "broken" | "headsup" }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full cursor-pointer items-center gap-4 rounded-ctl px-1 py-2 text-left hover:bg-sunken"
    >
      <span
        aria-hidden
        className={cx(
          "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? (tone === "broken" ? "bg-grenade" : "bg-harissa") : "bg-control/50",
        )}
      >
        <span className={cx("absolute top-0.5 size-5 rounded-full bg-white transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-ink">{label}</span>
        <span className="block text-[13px] leading-5 text-mute">{help}</span>
      </span>
    </button>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={Math.min(value, max)}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-11 w-full cursor-pointer accent-primary"
    />
  );
}

function ConnectionCard() {
  const esp = useVirtualEsp();
  const { settings } = useData();
  const [showKey, setShowKey] = useState(false);
  const c = esp.controls;
  const simulatorDevice = settings.data?.devices.find((d) => d.kind === "simulator")?.id;
  return (
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="t-h3 text-ink">Boîtier</h2>
          {esp.running ? (
            <Pill tone="live" icon={<LiveDot />}>
              envoie toutes les {c.intervalS} s
            </Pill>
          ) : (
            <Pill tone="neutral" icon={<Cpu size={14} strokeWidth={1.75} />}>
              à l'arrêt
            </Pill>
          )}
        </div>
        <div className="space-y-4">
          <Field
            label="Appareil"
            value={esp.deviceId}
            onChange={(ev) => esp.setDeviceId(ev.target.value.trim())}
            help={simulatorDevice ? `Le simulateur de ton foyer est ${simulatorDevice}.` : "sim-001 par défaut."}
            disabled={esp.running}
          />
          <div className="relative">
            <Field
              label="Clé de l'appareil (DEVICE_API_KEY)"
              type={showKey ? "text" : "password"}
              autoComplete="off"
              value={esp.deviceKey}
              onChange={(ev) => esp.setDeviceKey(ev.target.value.trim())}
              help="Dans backend/.env, la ligne DEVICE_API_KEY=… Gardée dans ce navigateur seulement."
              disabled={esp.running}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              aria-label={showKey ? "Masquer la clé" : "Afficher la clé"}
              className="absolute top-[30px] right-1 inline-flex size-11 cursor-pointer items-center justify-center rounded-ctl text-mute hover:text-ink"
            >
              {showKey ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
            </button>
          </div>
          <div>
            <p className="mb-1.5 text-[15px] font-semibold text-ink">Fréquence d'envoi</p>
            <Segmented
              label="Fréquence d'envoi"
              value={String(c.intervalS)}
              onChange={(v) => esp.setControls({ intervalS: Number(v) })}
              options={[
                { value: "2", label: "2 s" },
                { value: "5", label: "5 s (ESP32)" },
                { value: "10", label: "10 s" },
              ]}
            />
          </div>
          {esp.error && <Banner tone="broken" role="alert">{esp.error}</Banner>}
          <div className="flex flex-wrap gap-3">
            {esp.running ? (
              <Button variant="secondary" onClick={esp.stop}>
                <Pause size={18} strokeWidth={1.75} aria-hidden /> {L("Arrêter", "Stop", "وقّف")}
              </Button>
            ) : (
              <Button onClick={esp.start} disabled={!esp.deviceKey}>
                <Play size={18} strokeWidth={1.75} aria-hidden /> {L("Démarrer", "Start", "ابدا")}
              </Button>
            )}
            <Button variant="secondary" onClick={esp.sendNow} disabled={!esp.deviceKey}>
              <Send size={16} strokeWidth={1.75} aria-hidden /> Envoyer maintenant
            </Button>
          </div>
        </div>
      </Card>
  );
}

/** The device of the home shown in the app that this page should send as. */
function homeSender(s: { active_device_id: string | null; devices: { id: string; kind: string }[] } | null | undefined) {
  if (!s) return null;
  const active = s.devices.find((d) => d.id === s.active_device_id);
  return (active ?? s.devices.find((d) => d.kind === "simulator") ?? s.devices[0])?.id ?? null;
}

export function EspPanelPage() {
  const esp = useVirtualEsp();
  const { dashboard, tranche, settings } = useData();
  const homeIds = settings.data?.devices.map((d) => d.id) ?? [];
  const sender = homeSender(settings.data);
  const otherHome = !!settings.data && !homeIds.includes(esp.deviceId);
  // The device id is remembered in this browser: after switching home or account it may
  // belong to another home, which then gets the kWh while this page shows 0.
  useEffect(() => {
    if (otherHome && sender && !esp.running) esp.setDeviceId(sender);
  }, [otherHome, sender, esp.running]); // eslint-disable-line react-hooks/exhaustive-deps
  const nowMs = useNow(1000);
  const c = esp.controls;
  const e = dashboard.data?.electricity;
  const margin = settings.data?.alert_margin_kwh ?? 10;
  const next = e?.next_threshold_kwh ?? null;
  const used = e?.month_kwh ?? 0;
  const toMargin = next != null ? Math.max(0.5, next - margin + 1 - used) : null;
  const toCross = next != null ? Math.max(0.5, next - used + 2) : null;
  const spiking = esp.spikeUntil != null && esp.spikeUntil > nowMs;

  return (
    <>
      <PageHeader
        back="/profil"
        label={L("Démo · boîtier virtuel", "Demo · virtual box", "ديمو · بواطة افتراضية")}
        title={L("Contrôle démo", "Demo control", "التحكم في الديمو")}
        aside={
          esp.running ? (
            <Button variant="secondary" onClick={esp.stop}>
              <Pause size={18} strokeWidth={1.75} aria-hidden /> {L("Arrêter", "Stop", "وقّف")}
            </Button>
          ) : (
            <Button onClick={esp.start} disabled={!esp.deviceKey}>
              <Play size={18} strokeWidth={1.75} aria-hidden /> {L("Démarrer", "Start", "ابدا")}
            </Button>
          )
        }
      />

      {otherHome && esp.running && (
        <Banner tone="headsup" role="alert" className="mb-4">
          {L(
            `Ce boîtier envoie en tant que ${esp.deviceId}, qui n'est pas un appareil de ce foyer : ses kWh vont ailleurs. Arrête-le, il reprendra avec ${sender ?? "l'appareil du foyer"}.`,
            `This box sends as ${esp.deviceId}, which is not a device of this home: its kWh go elsewhere. Stop it and it will switch to ${sender ?? "the home's device"}.`,
            `البواطة تبعث باسم ${esp.deviceId}، موش جهاز متاع الدار هذي: الـkWh تمشي لبلاصة أخرى. وقّفها وترجع تبعث بـ${sender ?? "جهاز الدار"}.`,
          )}
        </Banner>
      )}

      <div className="grid grid-cols-1 items-start gap-4 sm:gap-5 lg:grid-cols-12">
        {/* On a phone the key and Start come first */}
        <div className="lg:hidden">
          <ConnectionCard />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:col-span-7">
          {/* Power */}
          <Card>
            <div className="mb-3 flex items-center gap-3">
              <IconTile tone="elec" size={36}>
                <Zap size={18} strokeWidth={1.5} />
              </IconTile>
              <Label as="h2">Puissance · W</Label>
              {spiking && <Pill tone="headsup" className="ml-auto">pic en cours</Pill>}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <p className="t-hero text-ink">{watts(c.power)}</p>
              {c.noise && <span className="t-small mb-1 text-mute">± 3 % de variation</span>}
            </div>
            <Slider label="Puissance en watts" value={c.power} min={0} max={8000} step={10} onChange={(v) => esp.setControls({ power: v })} />
            <div className="flex flex-wrap gap-2">
              {[
                ["Veille", 120],
                ["Soirée", 650],
                ["Climatiseur", 1350],
                ["Chauffe-eau", 2100],
                ["Four", 3000],
                ["Tout ensemble", 6500],
              ].map(([label, w]) => (
                <Chip key={label} active={c.power === w} onClick={() => esp.setControls({ power: w as number })}>
                  {label} · {num(w as number)} W
                </Chip>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field
                label="Valeur exacte (W)"
                inputMode="numeric"
                value={String(c.power)}
                onChange={(ev) => esp.setControls({ power: Math.min(23000, Math.max(0, Number(ev.target.value.replace(/\D/g, "")) || 0)) })}
                help="Jusqu'à 23 000 W (limite du capteur)."
                suffix="W"
              />
              <div className="flex items-end">
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] text-body">
                  <input
                    type="checkbox"
                    checked={c.noise}
                    onChange={(ev) => esp.setControls({ noise: ev.target.checked })}
                    className="size-5 accent-primary"
                  />
                  Variation naturelle
                </label>
              </div>
            </div>
          </Card>

          {/* Water */}
          <Card>
            <div className="mb-3 flex items-center gap-3">
              <IconTile tone="water" size={36}>
                <Droplet size={18} strokeWidth={1.5} />
              </IconTile>
              <Label as="h2">Débit · L/min</Label>
            </div>
            <p className="t-hero text-ink">{fmtFlow(c.flow)}</p>
            <Slider label="Débit en litres par minute" value={c.flow} min={0} max={15} step={0.1} onChange={(v) => esp.setControls({ flow: v })} />
            <div className="flex flex-wrap gap-2">
              {[
                ["Fermé", 0],
                ["Fuite", 0.4],
                ["Robinet", 4],
                ["Douche", 8],
                ["Bain", 12],
              ].map(([label, f]) => (
                <Chip key={label} active={c.flow === f} onClick={() => esp.setControls({ flow: f as number })}>
                  {label} · {num(f as number, 1, false)} L/min
                </Chip>
              ))}
            </div>
            <p className="t-small mt-4 text-mute">
              Démo de fuite : dans <Link to="/reglages#fuites" className="font-semibold text-primary hover:underline">Réglages</Link>, mets
              la fenêtre de nuit sur l'heure actuelle et la durée sur 2 min, puis choisis « Fuite » ici.
            </p>
          </Card>

          {/* Month meter */}
          <Card>
            <CardHeader title="Compteur du mois" aside={<Label as="span">{e ? `${kwhValue(used)} kWh ce mois` : "kWh"}</Label>} />
            {tranche && <TrancheBar view={tranche} nextKwhPrice={e?.next_kwh_price_dt} showHeader className="mb-5" />}
            <p className="t-small mb-3 text-mute">
              Ajoute des kWh d'un coup, comme si le temps passait vite. Le compteur ne recule jamais, comme un vrai compteur.
            </p>
            <div className="flex flex-wrap gap-2">
              {[1, 5, 15].map((k) => (
                <Button key={k} variant="secondary" onClick={() => esp.addEnergy(k)} disabled={!esp.running}>
                  +{k} kWh
                </Button>
              ))}
              {toMargin != null && (
                <Button onClick={() => esp.addEnergy(Math.round(toMargin * 10) / 10)} disabled={!esp.running}>
                  Entrer dans la marge (+{kwhValue(toMargin)} kWh)
                </Button>
              )}
              {toCross != null && (
                <Button variant="secondary" onClick={() => esp.addEnergy(Math.round(toCross * 10) / 10)} disabled={!esp.running}>
                  Dépasser {num(next ?? 0)} kWh (+{kwhValue(toCross)})
                </Button>
              )}
            </div>
            {!esp.running && <p className="t-small mt-3 text-mute">Démarre le boîtier pour envoyer des kWh.</p>}
          </Card>

          {/* Faults */}
          <Card>
            <CardHeader title="Pannes et signal" />
            <div className="divide-y divide-hairline">
              <Switch
                checked={c.elecFault}
                onChange={(v) => esp.setControls({ elecFault: v })}
                tone="broken"
                label="Capteur d'électricité muet"
                help="Envoie electricity: null → alerte « Capteur en panne »."
              />
              <Switch
                checked={c.waterFault}
                onChange={(v) => esp.setControls({ waterFault: v })}
                tone="broken"
                label="Capteur d'eau muet"
                help="Envoie water: null → alerte « Capteur en panne »."
              />
              <Switch
                checked={c.unreliable}
                onChange={(v) => esp.setControls({ unreliable: v })}
                tone="headsup"
                label="Signal peu fiable"
                help="Envoie signal_ok: false → « Mesure peu fiable », aucune valeur affichée."
              />
            </div>
            <p className="t-small mt-3 text-mute">
              Pour « Appareil hors ligne », clique sur Arrêter : après 30 s le tableau de bord passe en « ancien », après 5 min
              l'alerte arrive.
            </p>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:col-span-5">
          <div className="hidden lg:block">
            <ConnectionCard />
          </div>

          {/* Spike */}
          <Card>
            <CardHeader title="Pic de démo" />
            <p className="t-small mb-4 text-body">
              Ajoute de la puissance pendant un moment, comme un gros appareil qui démarre. « Simuler un pic » dans Réglages
              marche aussi avec ce boîtier.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => esp.spike(3500, 30)} disabled={!esp.running}>
                <Zap size={18} strokeWidth={1.75} aria-hidden /> +3 500 W · 30 s
              </Button>
              <Button variant="secondary" onClick={() => esp.spike(8000, 15)} disabled={!esp.running}>
                +8 000 W · 15 s
              </Button>
            </div>
          </Card>

          {/* What was sent */}
          <Card>
            <CardHeader title="Envoyé à l'API" aside={<Label as="span">POST /api/readings</Label>} />
            <dl className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <Label as="dt">Compteur élec.</Label>
                <dd className="t-data text-ink">{esp.counters ? `${num(esp.counters.energy, 3)} kWh` : "—"}</dd>
              </div>
              <div>
                <Label as="dt">Compteur eau</Label>
                <dd className="t-data text-ink">{esp.counters ? `${num(esp.counters.water, 1)} L` : "—"}</dd>
              </div>
              <div>
                <Label as="dt">Dernier envoi</Label>
                <dd className="t-data text-ink">{esp.lastSentAt ? time(new Date(esp.lastSentAt)) : "—"}</dd>
              </div>
              <div>
                <Label as="dt">Tableau de bord</Label>
                <dd className="t-data text-ink">{e ? kwh(used) : "—"}</dd>
              </div>
            </dl>
            {esp.log.length === 0 ? (
              <p className="t-small text-mute">Rien envoyé pour l'instant.</p>
            ) : (
              <ul className="space-y-1.5 font-mono text-[12px] leading-5">
                {esp.log.map((l, i) => (
                  <li key={`${l.at}-${i}`} className={cx("flex gap-2", l.ok ? "text-body" : "text-grenade")}>
                    <span className="shrink-0 text-mute">{time(new Date(l.at))}</span>
                    <span className="min-w-0">{l.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Banner tone="info" icon={<TriangleAlert size={20} strokeWidth={1.75} className="text-ink" />}>
            Ce boîtier virtuel remplace le simulateur Python : arrête-le (Ctrl+C) avant de démarrer, sinon les deux se
            contredisent. Il continue d'envoyer quand tu changes de page dans l'application, et s'arrête si tu fermes l'onglet.
          </Banner>
        </div>
      </div>
    </>
  );
}
