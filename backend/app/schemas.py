"""Pydantic models: what the API accepts and returns.

FastAPI validates every request against these classes and answers 422 on
any error, before our code runs. The reading payload rules are the
"Validation rules" table of the blueprint. The response models also feed the
interactive docs at /docs, which the frontend team can use as a contract.
"""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StrictBool, field_validator

Resource = Literal["electricity", "water"]


# --- Auth ---------------------------------------------------------------------


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=200)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: UserOut


# --- Device reading (POST /api/readings) ----------------------------------------


class _Strict(BaseModel):
    model_config = ConfigDict(extra="ignore", allow_inf_nan=False)


class ElectricityIn(_Strict):
    voltage_v: float = Field(ge=0, le=300)
    current_a: float = Field(ge=0, le=100)
    power_w: float = Field(ge=0, le=23000)
    energy_kwh: float = Field(ge=0)  # cumulative; "never lower" is checked at ingest
    frequency_hz: float = Field(ge=45, le=65)
    power_factor: float = Field(ge=0, le=1)


class WaterIn(_Strict):
    flow_l_min: float = Field(ge=0, le=60)
    total_l: float = Field(ge=0)  # cumulative; "never lower" is checked at ingest
    pulses_delta: int = Field(ge=0)
    calib_pulses_per_l: int | None = Field(default=None, gt=0, le=10000)


class ReadingIn(_Strict):
    """The JSON the ESP32 (or the simulator) sends every 5 s.

    `electricity` or `water` may be null when that sensor did not answer:
    the backend then raises a "sensor_fault" alert instead of inventing a value.
    """

    device_id: str = Field(min_length=1, max_length=64)
    timestamp: AwareDatetime  # ISO 8601 with offset, e.g. 2026-11-21T16:06:00+01:00
    electricity: ElectricityIn | None = None
    water: WaterIn | None = None
    signal_ok: StrictBool


class DemoCommand(BaseModel):
    """Instruction for the simulator, returned in the ingest response (demo only)."""

    type: Literal["spike"]
    extra_w: float
    duration_s: int
    energy_kwh: float


class IngestOut(BaseModel):
    id: int
    device_id: str
    ts: datetime
    alerts_created: int
    commands: list[DemoCommand] = []


# --- Readings for charts (GET /api/readings) -----------------------------------


class SeriesPoint(BaseModel):
    ts: datetime  # start of the bucket (or the reading time for raw points)
    # Electricity points: average power and energy used in the bucket.
    power_w: float | None = None
    max_power_w: float | None = None
    energy_kwh: float | None = None
    # Water points: average flow and litres used in the bucket.
    flow_l_min: float | None = None
    volume_l: float | None = None
    reliable: bool = True  # False when every reading of the bucket had signal_ok false


class SeriesOut(BaseModel):
    resource: Resource
    bucket: Literal["raw", "minute", "hour", "day"]
    start: datetime
    end: datetime
    points: list[SeriesPoint]


# --- Alerts and tips -------------------------------------------------------------


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    type: str
    resource: str | None
    severity: str
    message: str
    extra_cost_dt: float | None
    is_estimate: bool = True
    created_at: datetime
    acknowledged_at: datetime | None


class TipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    text: str
    saving_dt: float | None  # computed by the tariff module, never by the LLM
    source: str
    is_estimate: bool = True
    created_at: datetime


# --- Dashboard ---------------------------------------------------------------------


class DeviceStatus(BaseModel):
    id: str
    kind: str
    last_seen_at: datetime | None
    online: bool
    calib_pulses_per_l: int


class LiveElectricity(BaseModel):
    reliable: bool  # False -> show "mesure peu fiable", values are null
    fault: bool  # True -> the sensor did not answer
    power_w: float | None = None
    voltage_v: float | None = None
    current_a: float | None = None
    power_factor: float | None = None
    frequency_hz: float | None = None


class LiveWater(BaseModel):
    reliable: bool
    fault: bool
    flow_l_min: float | None = None
    total_l: float | None = None


class LiveOut(BaseModel):
    ts: datetime
    age_s: float
    stale: bool  # older than the online window: show the grey "ancien" label
    electricity: LiveElectricity
    water: LiveWater


class TrancheOut(BaseModel):
    index: int
    min_qty: float
    max_qty: float | None
    price_millimes: int
    vat_rate: float


class BillOut(BaseModel):
    qty: float
    tranche_index: int
    energy_dt: float
    vat_dt: float
    fixed_dt: float
    taxes_dt: float
    total_dt: float
    is_estimate: bool = True


class ForecastOut(BaseModel):
    available: bool
    qty: float | None  # kWh (electricity) or L (water)
    bill: BillOut | None
    assumption: str  # e.g. "au rythme moyen des 7 derniers jours"


class ElectricitySummary(BaseModel):
    month: str
    month_kwh: float
    thresholds_kwh: list[float]
    tranche: TrancheOut | None
    next_threshold_kwh: float | None
    kwh_to_next_threshold: float | None
    next_kwh_price_dt: float | None  # cost of one more kWh in the current tranche
    crossing_extra_cost_dt: float | None  # bill jump when crossing the next threshold
    bill_to_date: BillOut | None
    forecast: ForecastOut
    is_estimate: bool = True


class WaterSummary(BaseModel):
    month: str
    month_l: float
    tariff_configured: bool  # False until the SONEDE grid is entered
    tranche: TrancheOut | None
    next_threshold_m3: float | None
    bill_to_date: BillOut | None
    forecast: ForecastOut
    leak_suspected: bool
    is_estimate: bool = True


class HeavyConsumer(BaseModel):
    label: str  # "Chauffe-eau électrique ou bouilloire" (probable appliance)
    typical_w: float
    starts_today: int
    last_seen_at: datetime


class DashboardOut(BaseModel):
    generated_at: datetime
    state: Literal["empty", "ok"]  # "empty" -> "En attente de la première mesure"
    household_name: str
    subscribed_kva: float
    device: DeviceStatus | None
    live: LiveOut | None
    electricity: ElectricitySummary
    water: WaterSummary
    active_alerts: list[AlertOut]
    heavy_consumers: list[HeavyConsumer]


# --- Settings ----------------------------------------------------------------------


class SettingsOut(BaseModel):
    household_id: uuid.UUID
    name: str
    subscribed_kva: float
    alert_margin_kwh: int
    leak_start_hour: int
    leak_end_hour: int
    leak_min_minutes: int
    active_device_id: str | None
    devices: list[DeviceStatus]
    demo_mode: bool


class SettingsIn(BaseModel):
    """PUT /api/settings: send only the fields to change."""

    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=100)
    subscribed_kva: float | None = Field(default=None, gt=0, le=100)
    alert_margin_kwh: int | None = Field(default=None, ge=0, le=200)
    leak_start_hour: int | None = Field(default=None, ge=0, le=23)
    leak_end_hour: int | None = Field(default=None, ge=0, le=23)
    leak_min_minutes: int | None = Field(default=None, ge=1, le=720)
    active_device_id: str | None = None
    clear_active_device: bool = False  # true -> use all devices again


# --- Tariffs -----------------------------------------------------------------------


class TrancheRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int | None = None
    resource: Resource
    min_qty: float = Field(ge=0)
    max_qty: float | None = Field(default=None, gt=0)
    price_millimes: int = Field(ge=0, le=100000)
    vat_rate: float = Field(ge=0, lt=1)
    valid_from: date


class FeeRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int | None = None
    key: str = Field(pattern=r"^(elec|water)_[a-z0-9_]+_(per_kva|per_kwh|per_m3|per_month)$", max_length=80)
    value_millimes: float = Field(ge=0, le=1_000_000)
    valid_from: date


class TariffsIO(BaseModel):
    tranches: list[TrancheRow]
    fees: list[FeeRow]
    pricing_mode: str | None = None  # read-only, from TARIFF_PRICING_MODE

    @field_validator("tranches")
    @classmethod
    def _not_empty(cls, v: list[TrancheRow]) -> list[TrancheRow]:
        if not any(r.resource == "electricity" for r in v):
            raise ValueError("at least one electricity tranche is required")
        return v


# --- Score -------------------------------------------------------------------------


class DayScore(BaseModel):
    day: date
    score: int
    kwh: float
    budget_kwh: float | None


class BadgeOut(BaseModel):
    code: str
    label: str
    description: str
    earned: bool
    earned_at: datetime | None


class RankingOut(BaseModel):
    is_mock: bool  # True: compared with simulated similar homes (pitch mock-up)
    similar_homes: int
    better_than_pct: int
    label: str


class ChallengeOut(BaseModel):
    title: str
    description: str
    target_kwh: float | None
    current_kwh: float
    progress_pct: int
    status: Literal["en_cours", "reussi", "pas_assez_de_donnees"]


class ScoreOut(BaseModel):
    today: DayScore | None
    history: list[DayScore]
    badges: list[BadgeOut]
    ranking: RankingOut
    weekly_challenge: ChallengeOut


# --- Demo --------------------------------------------------------------------------


class SpikeIn(BaseModel):
    extra_w: float = Field(default=3500, ge=100, le=15000)
    duration_s: int = Field(default=30, ge=5, le=300)
    # kWh added during the spike (time is compressed for the demo). Empty = just
    # enough to enter the alert margin of the next threshold.
    energy_kwh: float | None = Field(default=None, ge=0, le=300)


class SpikeOut(BaseModel):
    status: Literal["queued"]
    device_id: str
    simulator_online: bool
    extra_w: float
    duration_s: int
    energy_kwh: float
    message: str
