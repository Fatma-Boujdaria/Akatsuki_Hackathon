"""Application settings, read from environment variables or the .env file.

Every secret (database password, JWT secret, device key, LLM key) lives in
.env, which is git-ignored. Nothing secret is written in the code.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Database -----------------------------------------------------------
    # Supabase gives "postgresql://..."; db.py converts it to the psycopg driver.
    # Empty -> local SQLite file, handy for a quick start without Supabase.
    database_url: str = ""
    # Connections this backend keeps open. The whole team shares one Supabase
    # pooler, so stay small: at most 3 + 2 = 5 per running backend.
    db_pool_size: int = 3
    db_max_overflow: int = 2

    # --- Security -----------------------------------------------------------
    jwt_secret: str = Field(min_length=32)  # required: the app refuses to start without it
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 12 * 60  # a demo day without logging in again
    jwt_remember_days: int = 30  # "Se souvenir de moi" on the login screen
    device_api_key: str | None = None  # key of the demo simulator device (seed script)

    # --- Email (verification codes, password reset) -------------------------
    # Empty SMTP_HOST: emails are written to the server log instead of being sent,
    # and in DEMO_MODE the code is also returned to the screen (dev_code).
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "Tranche Guard <no-reply@trancheguard.tn>"
    smtp_starttls: bool = True
    email_code_minutes: int = 30  # validity of a verification or reset code
    email_rate_limit_per_hour: int = 5  # codes sent per email address and hour

    # --- Optional LLM (tip wording only, never numbers) ----------------------
    llm_api_key: str | None = None
    llm_model: str = "claude-opus-5-5"
    llm_timeout_s: float = 8.0

    # --- Behaviour ----------------------------------------------------------
    demo_mode: bool = True
    timezone: str = "Africa/Tunis"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # "all_kwh": the tranche reached prices every kWh of the month (blueprint formula).
    # "progressive": each kWh band is priced at its own tranche. Switch after
    # checking a real STEG bill (open question in the PRD).
    tariff_pricing_mode: Literal["all_kwh", "progressive"] = "all_kwh"

    device_online_window_s: int = 30  # no reading for 30 s -> "Appareil hors ligne"
    offline_alert_after_s: int = 300  # no reading for 5 min -> device_offline alert
    forecast_window_days: int = 7  # moving-average window of the end-of-month forecast
    tips_refresh_s: int = 60  # tips are recomputed at most once a minute

    login_rate_limit_per_min: int = 5
    ingest_rate_limit_per_min: int = 60  # the device sends 12/min; leaves room for retries

    @property
    def email_configured(self) -> bool:
        return bool(self.smtp_host)

    @property
    def show_dev_codes(self) -> bool:
        """Demo without SMTP: the code is shown on screen so sign-up still works."""
        return self.demo_mode and not self.email_configured

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
