"""Tips (DT from the tariff module), LLM safeguard, score and badges, settings, tariffs."""

from datetime import timedelta

import pytest

from app import clock
from app.services import consumption, llm
from app.services import tariff as tariff_engine
from tests.conftest import login, make_user, payload, post_reading
from tests.test_alerts_dashboard import last_counters, seed_month


def test_tips_dt_values_come_from_the_tariff_module(client, home, auth, db, frozen):
    seed_month(db, 0.4, frozen, hours=72)  # forecast well above 200 kWh
    energy, water = last_counters(db)
    post_reading(client, payload(frozen.now, energy_kwh=energy + 0.1, total_l=water))
    tips = client.get("/api/tips", headers=auth).json()
    by_code = {t["code"]: t for t in tips}

    assert tips[0]["code"] == "threshold"  # most important first
    status = consumption.resource_status(db, home, "electricity", clock.now_utc())
    expected = tariff_engine.saving_dt(status.tariff, 6.0, status.usage.forecast_qty, 200)
    assert by_code["threshold"]["saving_dt"] == pytest.approx(expected, abs=0.001)
    assert by_code["threshold"]["source"] == "rule"
    assert by_code["offpeak"]["saving_dt"] == 0 and "ne change pas ta facture" in by_code["offpeak"]["text"]
    assert all(t["is_estimate"] for t in tips)


def test_tips_are_reused_for_a_minute(client, home, auth, db, frozen):
    seed_month(db, 0.1, frozen, hours=24)
    first = client.get("/api/tips", headers=auth).json()
    frozen.advance(seconds=30)
    assert [t["id"] for t in client.get("/api/tips", headers=auth).json()] == [t["id"] for t in first]
    frozen.advance(seconds=31)
    assert [t["id"] for t in client.get("/api/tips", headers=auth).json()] != [t["id"] for t in first]


def test_llm_number_check():
    original = "Réduis d'environ 18 kWh (≈ 2,1 kWh par jour). Économie estimée : 9,23 DT."
    assert llm.same_numbers(original, "Baisse ta conso de 18 kWh, soit 2,1 kWh par jour : tu gagnes 9,23 DT !")
    assert not llm.same_numbers(original, "Baisse ta conso de 20 kWh, soit 2,1 kWh par jour : tu gagnes 9,23 DT !")
    assert not llm.same_numbers(original, "Baisse de 18 kWh (2,1 kWh/jour) : 9,23 DT, et 5 % de CO2 en moins.")


def test_llm_rewording_is_used_only_when_numbers_survive(monkeypatch):
    class FakeBlock:
        type = "text"
        text = '{"tips": ["Coupe 18 kWh et garde 9,23 DT !", "Ça fera 12 DT."]}'

    class FakeResponse:
        stop_reason = "end_turn"
        content = [FakeBlock()]

    class FakeClient:
        class beta:
            class messages:
                @staticmethod
                def create(**kwargs):
                    assert kwargs["output_config"]["format"]["type"] == "json_schema"
                    return FakeResponse()

    monkeypatch.setattr(llm, "_get_client", lambda: FakeClient())
    monkeypatch.setattr(llm.get_settings(), "llm_api_key", "fake")
    result = llm.reword_tips(["Réduis de 18 kWh : 9,23 DT économisés.", "Économie : 0 DT."])
    assert result == ["Coupe 18 kWh et garde 9,23 DT !", None]  # 2nd changed a number: rejected


def test_llm_failure_falls_back_to_templates(monkeypatch):
    def boom():
        raise RuntimeError("no network")

    monkeypatch.setattr(llm, "_get_client", boom)
    monkeypatch.setattr(llm.get_settings(), "llm_api_key", "fake")
    assert llm.reword_tips(["Économie : 3 DT."]) is None


def test_score_badges_ranking_challenge(client, home, auth, db, frozen):
    seed_month(db, 0.05, frozen, hours=24 * 9)  # 9 days at 4.8 kWh/day: under the 200 kWh budget
    body = client.get("/api/score", headers=auth).json()

    assert body["today"] is not None and 20 <= body["today"]["score"] <= 100
    assert len(body["history"]) == 7
    assert all(d["score"] == 100 for d in body["history"][:-1])  # 4.8 kWh/day < ~20 kWh/day budget
    earned = {b["code"] for b in body["badges"] if b["earned"]}
    assert {"premiere_mesure", "journee_sobre", "semaine_sobre", "sous_le_seuil"} <= earned
    assert body["ranking"]["is_mock"] is True and "simulation" in body["ranking"]["label"]
    assert body["weekly_challenge"]["status"] in {"en_cours", "reussi"}
    # Called twice: same rows updated, not duplicated (unique household/day).
    assert len(client.get("/api/score", headers=auth).json()["history"]) == 7


def test_score_is_never_punitive():
    from app.services.score import day_score

    assert day_score(5, 6) == 100
    assert day_score(12, 6) == 50
    assert day_score(1000, 6) == 20


def test_settings_read_and_update(client, home, auth):
    body = client.get("/api/settings", headers=auth).json()
    assert body["subscribed_kva"] == 6 and body["alert_margin_kwh"] == 10
    assert {d["id"] for d in body["devices"]} == {"sim-001", "tg-001"}

    updated = client.put("/api/settings", headers=auth, json={"subscribed_kva": 9, "alert_margin_kwh": 15,
                                                               "active_device_id": "tg-001"}).json()
    assert updated["subscribed_kva"] == 9 and updated["active_device_id"] == "tg-001"
    assert client.put("/api/settings", headers=auth, json={"clear_active_device": True}).json()["active_device_id"] is None


def test_settings_validation(client, home, auth, db):
    assert client.put("/api/settings", headers=auth, json={"subscribed_kva": 0}).status_code == 422
    assert client.put("/api/settings", headers=auth, json={"leak_start_hour": 5}).status_code == 422  # == end
    assert client.put("/api/settings", headers=auth, json={"unknown": 1}).status_code == 422
    make_user(db, "autre@example.tn")
    assert client.put("/api/settings", headers=auth, json={"active_device_id": "ghost"}).status_code == 422


def test_tariffs_read_for_members_edit_for_admin(client, home, auth, db, frozen):
    tariffs = client.get("/api/tariffs", headers=auth).json()
    assert [t["price_millimes"] for t in tariffs["tranches"]] == [176, 218, 341, 414]
    assert tariffs["pricing_mode"] == "all_kwh"
    assert client.put("/api/tariffs", headers=auth, json=tariffs).status_code == 403

    make_user(db, "admin@example.tn", role="admin", with_household=False)
    admin = login(client, "admin@example.tn")
    tariffs["tranches"][0]["price_millimes"] = 180
    saved = client.put("/api/tariffs", headers=admin, json=tariffs)
    assert saved.status_code == 200 and saved.json()["tranches"][0]["price_millimes"] == 180

    post_reading(client, payload(frozen.now))
    price = client.get("/api/dashboard", headers=auth).json()["electricity"]["next_kwh_price_dt"]
    assert price == pytest.approx((180 * 1.07 + 10) / 1000, abs=0.001)  # new price used at once


def test_tariff_grid_must_be_contiguous(client, home, db):
    make_user(db, "admin@example.tn", role="admin", with_household=False)
    admin = login(client, "admin@example.tn")
    grid = {
        "tranches": [
            {"resource": "electricity", "min_qty": 0, "max_qty": 200, "price_millimes": 176, "vat_rate": 0.07, "valid_from": "2026-01-01"},
            {"resource": "electricity", "min_qty": 250, "max_qty": None, "price_millimes": 218, "vat_rate": 0.07, "valid_from": "2026-01-01"},
        ],
        "fees": [],
    }
    assert client.put("/api/tariffs", headers=admin, json=grid).status_code == 422
    grid["tranches"][1]["min_qty"] = 200
    grid["fees"] = [{"key": "bad key", "value_millimes": 5, "valid_from": "2026-01-01"}]
    assert client.put("/api/tariffs", headers=admin, json=grid).status_code == 422
