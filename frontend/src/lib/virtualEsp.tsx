import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError } from "./api";
import type { ReadingIn } from "./types";

// A virtual ESP32 driven from the browser (page /esp). It sends the same JSON as the
// box every few seconds, so the whole app reacts exactly as with the hardware.
// It replaces the Python simulator while it runs: two senders on one device fight
// over the timestamps and the counters.

export interface EspControls {
  power: number; // W
  flow: number; // L/min
  elecFault: boolean; // the PZEM-004T did not answer -> electricity: null
  waterFault: boolean; // the YF-S201 did not answer -> water: null
  unreliable: boolean; // signal_ok: false -> "mesure peu fiable"
  noise: boolean; // small natural variation on the power
  intervalS: number;
}

export interface EspLogEntry {
  at: number;
  ok: boolean;
  text: string;
}

interface VirtualEspCtx {
  running: boolean;
  controls: EspControls;
  setControls: (patch: Partial<EspControls>) => void;
  deviceId: string;
  setDeviceId: (v: string) => void;
  deviceKey: string;
  setDeviceKey: (v: string) => void;
  start: () => void;
  stop: () => void;
  sendNow: () => void;
  addEnergy: (kwh: number) => void;
  addWater: (litres: number) => void;
  spike: (extraW: number, seconds: number) => void;
  spikeUntil: number | null;
  counters: { energy: number; water: number } | null;
  lastSentAt: number | null;
  lastPower: number | null;
  log: EspLogEntry[];
  error: string | null;
}

const Ctx = createContext<VirtualEspCtx | null>(null);

const KEY_STORE = "tg-esp-key";
const ID_STORE = "tg-esp-device";
const read = (k: string, fallback: string) => {
  try {
    return localStorage.getItem(k) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* kept in memory only */
  }
};

const DEFAULTS: EspControls = {
  power: 450,
  flow: 0,
  elecFault: false,
  waterFault: false,
  unreliable: false,
  noise: true,
  intervalS: 5,
};

// "energy_kwh 1.5 is lower than the previous value 101.89": the meter already shows more.
const BACKWARDS = /(energy_kwh|total_l) [\d.]+ is lower than the previous value ([\d.]+)/;

/** Timer in a worker: background tabs throttle page timers, workers much less. */
function makeTicker(ms: number, onTick: () => void): () => void {
  try {
    const src = `let t; onmessage = (e) => { clearInterval(t); t = setInterval(() => postMessage(0), e.data); };`;
    const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    const worker = new Worker(url);
    worker.onmessage = onTick;
    worker.postMessage(ms);
    return () => {
      worker.terminate();
      URL.revokeObjectURL(url);
    };
  } catch {
    const t = window.setInterval(onTick, ms);
    return () => window.clearInterval(t);
  }
}

export function VirtualEspProvider({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState(false);
  const [controls, setControlsState] = useState<EspControls>(DEFAULTS);
  const [deviceId, setDeviceIdState] = useState(() => read(ID_STORE, "sim-001"));
  const [deviceKey, setDeviceKeyState] = useState(() => read(KEY_STORE, ""));
  const [log, setLog] = useState<EspLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [counters, setCounters] = useState<{ energy: number; water: number } | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [lastPower, setLastPower] = useState<number | null>(null);
  const [spikeUntil, setSpikeUntil] = useState<number | null>(null);

  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  const idRef = useRef(deviceId);
  idRef.current = deviceId;
  const keyRef = useRef(deviceKey);
  keyRef.current = deviceKey;
  // Start just above the "meter reset" tolerance (1 kWh / 5 L): the first answer
  // tells us the real counters if the database already holds bigger ones.
  const meter = useRef({ energy: 1.5, water: 5.5 });
  const pending = useRef({ kwh: 0, litres: 0 });
  const spikeRef = useRef<{ extraW: number; until: number } | null>(null);
  const busy = useRef(false);
  const stopTicker = useRef<(() => void) | null>(null);

  const push = useCallback((ok: boolean, text: string) => {
    setLog((l) => [{ at: Date.now(), ok, text }, ...l].slice(0, 12));
  }, []);

  const stop = useCallback(() => {
    stopTicker.current?.();
    stopTicker.current = null;
    setRunning(false);
  }, []);

  const tick = useCallback(async () => {
    if (busy.current || !keyRef.current) return;
    busy.current = true;
    try {
      const c = controlsRef.current;
      const now = Date.now();
      const sp = spikeRef.current && now < spikeRef.current.until ? spikeRef.current : null;
      if (!sp && spikeRef.current) {
        spikeRef.current = null;
        setSpikeUntil(null);
      }
      let power = c.power;
      if (c.noise && power > 0) power *= 1 + (Math.random() - 0.5) * 0.06;
      if (sp) power += sp.extraW;
      power = Math.min(23000, Math.max(0, Math.round(power * 10) / 10));
      const flow = Math.min(60, Math.max(0, Math.round(c.flow * 100) / 100));
      const dE = (power * c.intervalS) / 3600 / 1000 + pending.current.kwh;
      const dW = (flow * c.intervalS) / 60 + pending.current.litres;

      for (let attempt = 0; attempt < 4; attempt++) {
        const energy = meter.current.energy + dE;
        const water = meter.current.water + dW;
        const voltage = Math.round((230 + (c.noise ? (Math.random() - 0.5) * 3 : 0)) * 10) / 10;
        const payload: ReadingIn = {
          device_id: idRef.current,
          timestamp: new Date().toISOString(),
          electricity: c.elecFault
            ? null
            : {
                voltage_v: voltage,
                current_a: Math.round((power / (voltage * 0.93)) * 100) / 100,
                power_w: power,
                energy_kwh: Math.round(energy * 1000) / 1000,
                frequency_hz: 50,
                power_factor: 0.93,
              },
          water: c.waterFault
            ? null
            : {
                flow_l_min: flow,
                total_l: Math.round(water * 100) / 100,
                pulses_delta: Math.round(((flow * c.intervalS) / 60) * 450),
                calib_pulses_per_l: 450,
              },
          signal_ok: !c.unreliable,
        };
        try {
          const res = await api.sendReading(payload, keyRef.current);
          meter.current = { energy, water };
          pending.current = { kwh: 0, litres: 0 };
          setCounters({ ...meter.current });
          setLastSentAt(Date.now());
          setLastPower(c.elecFault ? null : power);
          setError(null);
          const parts = [
            c.elecFault ? "élec : null" : `${Math.round(power)} W`,
            c.waterFault ? "eau : null" : `${flow} L/min`,
          ];
          if (c.unreliable) parts.push("signal_ok: false");
          push(true, `${parts.join(" · ")}${res.alerts_created ? ` · ${res.alerts_created} alerte(s)` : ""}`);
          // Like the simulator: honour "Simuler un pic" from Réglages.
          for (const cmd of res.commands ?? []) {
            if (cmd.type === "spike") {
              spikeRef.current = { extraW: cmd.extra_w, until: Date.now() + cmd.duration_s * 1000 };
              setSpikeUntil(spikeRef.current.until);
              pending.current.kwh += cmd.energy_kwh;
              push(true, `pic reçu : +${Math.round(cmd.extra_w)} W pendant ${cmd.duration_s} s`);
              window.setTimeout(() => void tick(), 50);
            }
          }
          break;
        } catch (err) {
          const e = err as ApiError;
          const m = e.message?.match(BACKWARDS);
          if (e.status === 422 && m) {
            if (m[1] === "energy_kwh") meter.current.energy = parseFloat(m[2]);
            else meter.current.water = parseFloat(m[2]);
            continue; // retry from the meter's real value
          }
          if (e.status === 409) {
            push(false, "refusé : un autre appareil envoie aussi (le simulateur Python tourne ?)");
          } else if (e.status === 401 || e.status === 403) {
            setError(
              e.status === 401
                ? "Clé refusée : copie DEVICE_API_KEY depuis backend/.env."
                : `Cette clé n'est pas celle de l'appareil ${idRef.current}.`,
            );
            stop();
          } else {
            push(false, `refusé ${e.status || ""} : ${e.message}`);
          }
          break;
        }
      }
    } finally {
      busy.current = false;
    }
  }, [push, stop]);

  const start = useCallback(() => {
    if (!keyRef.current) {
      setError("Entre la clé de l'appareil d'abord.");
      return;
    }
    stopTicker.current?.();
    setError(null);
    setRunning(true);
    void tick();
    stopTicker.current = makeTicker(controlsRef.current.intervalS * 1000, () => void tick());
  }, [tick]);

  // Changing the interval while running restarts the timer.
  useEffect(() => {
    if (!stopTicker.current) return;
    stopTicker.current();
    stopTicker.current = makeTicker(controls.intervalS * 1000, () => void tick());
  }, [controls.intervalS, tick]);

  useEffect(() => () => stopTicker.current?.(), []);

  const value = useMemo<VirtualEspCtx>(
    () => ({
      running,
      controls,
      setControls: (patch) => setControlsState((c) => ({ ...c, ...patch })),
      deviceId,
      setDeviceId: (v) => {
        // Another device has its own meter: never carry this one's counter over, or the
        // first reading would add the whole difference as consumption.
        if (v !== idRef.current) {
          meter.current = { energy: 1.5, water: 5.5 };
          pending.current = { kwh: 0, litres: 0 };
          setCounters(null);
        }
        setDeviceIdState(v);
        write(ID_STORE, v);
      },
      deviceKey,
      setDeviceKey: (v) => {
        setDeviceKeyState(v);
        write(KEY_STORE, v);
      },
      start,
      stop,
      sendNow: () => void tick(),
      addEnergy: (kwh) => {
        pending.current.kwh += kwh;
        push(true, `+${kwh.toFixed(1).replace(".", ",")} kWh au prochain envoi`);
        if (stopTicker.current) void tick();
      },
      addWater: (litres) => {
        pending.current.litres += litres;
        if (stopTicker.current) void tick();
      },
      spike: (extraW, seconds) => {
        spikeRef.current = { extraW, until: Date.now() + seconds * 1000 };
        setSpikeUntil(spikeRef.current.until);
        if (stopTicker.current) void tick();
      },
      spikeUntil,
      counters,
      lastSentAt,
      lastPower,
      log,
      error,
    }),
    [running, controls, deviceId, deviceKey, start, stop, tick, push, spikeUntil, counters, lastSentAt, lastPower, log, error],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVirtualEsp(): VirtualEspCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useVirtualEsp outside VirtualEspProvider");
  return v;
}
