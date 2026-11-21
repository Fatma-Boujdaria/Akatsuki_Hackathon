import type { ReactNode } from "react";
import { Droplet, TriangleAlert, WifiOff, CircleAlert } from "lucide-react";
import type { Alert } from "../lib/types";
import type { TrancheView } from "../lib/tranche";
import { dayMonth } from "../lib/format";
import type { BannerTone } from "./status";

// Principle 02, red means broken: Grenade for leaks and sensor faults; a tranche
// that is near or crossed is a Harissa heads-up; an offline box is neutral info.

export interface AlertLook {
  tone: BannerTone;
  title: string;
  icon: ReactNode;
  /** Order on screen: broken first. */
  rank: number;
}

export function alertLook(alert: Alert, tranche?: TrancheView | null): AlertLook {
  switch (alert.type) {
    case "leak":
      return {
        tone: "broken",
        title: "Fuite probable",
        icon: <Droplet size={20} strokeWidth={1.75} className="text-grenade" />,
        rank: 0,
      };
    case "sensor_fault":
      return {
        tone: "broken",
        title: alert.resource === "water" ? "Capteur d'eau en panne" : "Capteur d'électricité en panne",
        icon: <CircleAlert size={20} strokeWidth={1.75} className="text-grenade" />,
        rank: 1,
      };
    case "threshold": {
      let title = "Tranche suivante en vue";
      if (alert.resource === "electricity" && tranche) {
        if (tranche.state === "near") title = "Tranche suivante bientôt";
        else if (tranche.crossingDate) title = `Tranche suivante vers le ${dayMonth(tranche.crossingDate)}`;
        else if (tranche.state === "crossed") title = "Tranche dépassée";
      } else if (alert.resource === "water") title = "Tranche d'eau suivante bientôt";
      return {
        tone: "headsup",
        title,
        icon: <TriangleAlert size={20} strokeWidth={1.75} className="text-harissa" />,
        rank: 2,
      };
    }
    case "device_offline":
      return {
        tone: "info",
        title: "Appareil hors ligne",
        icon: <WifiOff size={20} strokeWidth={1.75} className="text-ink" />,
        rank: 3,
      };
    default:
      return {
        tone: "info",
        title: "Information",
        icon: <CircleAlert size={20} strokeWidth={1.75} className="text-ink" />,
        rank: 4,
      };
  }
}

/** Short title for lists, independent of the current tranche state. */
export function alertKind(alert: Alert): string {
  switch (alert.type) {
    case "leak":
      return "Fuite probable";
    case "sensor_fault":
      return "Capteur en panne";
    case "threshold":
      return alert.resource === "water" ? "Tranche d'eau" : "Tranche STEG";
    case "device_offline":
      return "Appareil hors ligne";
    default:
      return "Alerte";
  }
}

export function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort((a, b) => alertLook(a).rank - alertLook(b).rank || b.created_at.localeCompare(a.created_at));
}
