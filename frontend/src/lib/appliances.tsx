import {
  AirVent,
  Coffee,
  CookingPot,
  Fan,
  Flame,
  Heater,
  Lamp,
  Laptop,
  Microwave,
  Plug,
  Refrigerator,
  Router,
  Shirt,
  Tv,
  Utensils,
  WashingMachine,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { L } from "./i18n";

// Typical values mirror backend/app/services/appliances.py (CATALOG). The backend is the
// source of truth for estimates; these only fill the form and its placeholders.
export const CATALOG_ORDER = [
  "air_conditioner",
  "refrigerator",
  "washing_machine",
  "television",
  "water_heater",
  "oven",
  "microwave",
  "dishwasher",
  "computer",
  "lighting",
  "electric_heater",
  "fan",
  "iron",
  "kettle",
  "router",
  "water_pump",
] as const;

const ICONS: Record<string, LucideIcon> = {
  air_conditioner: AirVent,
  refrigerator: Refrigerator,
  washing_machine: WashingMachine,
  television: Tv,
  water_heater: Heater,
  oven: CookingPot,
  microwave: Microwave,
  dishwasher: Utensils,
  computer: Laptop,
  lighting: Lamp,
  electric_heater: Flame,
  fan: Fan,
  iron: Shirt,
  kettle: Coffee,
  router: Router,
  water_pump: Waves,
  custom: Plug,
};

export function applianceIcon(category: string, size = 20) {
  const Icon = ICONS[category] ?? Plug;
  return <Icon size={size} strokeWidth={1.8} aria-hidden />;
}

export function applianceLabel(category: string): string {
  switch (category) {
    case "air_conditioner":
      return L("Climatiseur", "Air conditioner", "كليماتيزور");
    case "refrigerator":
      return L("Réfrigérateur", "Refrigerator", "فريجيدار");
    case "washing_machine":
      return L("Machine à laver", "Washing machine", "ماكينة صابون");
    case "television":
      return L("Télévision", "Television", "تلفزة");
    case "water_heater":
      return L("Chauffe-eau électrique", "Electric water heater", "سخّان ماء كهربائي");
    case "oven":
      return L("Four électrique", "Electric oven", "فور كهربائي");
    case "microwave":
      return L("Micro-ondes", "Microwave", "ميكروأوند");
    case "dishwasher":
      return L("Lave-vaisselle", "Dishwasher", "ماكينة ماعون");
    case "computer":
      return L("Ordinateur", "Computer", "أورديناتور");
    case "lighting":
      return L("Éclairage (par ampoule)", "Lighting (per bulb)", "الضو (لكل لمبة)");
    case "electric_heater":
      return L("Chauffage électrique", "Electric heater", "شوفاج كهربائي");
    case "fan":
      return L("Ventilateur", "Fan", "مروحة");
    case "iron":
      return L("Fer à repasser", "Iron", "مكواة");
    case "kettle":
      return L("Bouilloire", "Kettle", "بوايلوار");
    case "router":
      return L("Box internet", "Internet box", "مودام");
    case "water_pump":
      return L("Pompe à eau", "Water pump", "بومبة ماء");
    default:
      return L("Autre appareil", "Other appliance", "آلة أخرى");
  }
}
