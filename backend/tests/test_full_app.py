"""Phase 2: sign-up, password reset, profile, several homes, appliances, assistant,
insights, history, notifications, support and the admin panel."""

from datetime import timedelta

from app.models import Alert, Household, User
from tests.conftest import PASSWORD, login, make_user, payload, post_reading


def _register(client, email="nouveau@example.tn", password="un-bon-mot-de-passe"):
    return client.post(
        "/api/auth/register", json={"full_name": "Nour Ben Ali", "email": email, "password": password, "language": "fr"}
    )


# --- Accounts --------------------------------------------------------------------------


def test_register_verify_then_login(client):
    r = _register(client)
    assert r.status_code == 201, r.text
    code = r.json()["dev_code"]  # DEMO_MODE and no SMTP: the code comes back for the demo
    assert code and len(code) == 6

    # Not verified yet: login is refused with a code the app understands.
    refused = client.post("/api/auth/login", json={"email": "nouveau@example.tn", "password": "un-bon-mot-de-passe"})
    assert refused.status_code == 403 and refused.json()["detail"]["code"] == "email_not_verified"

    bad = client.post("/api/auth/verify-email", json={"email": "nouveau@example.tn", "code": "000000" if code != "000000" else "111111"})
    assert bad.status_code == 400
    ok = client.post("/api/auth/verify-email", json={"email": "nouveau@example.tn", "code": code})
    assert ok.status_code == 200 and ok.json()["user"]["full_name"] == "Nour Ben Ali"
    assert client.post(
        "/api/auth/login", json={"email": "nouveau@example.tn", "password": "un-bon-mot-de-passe"}
    ).status_code == 200


def test_email_must_be_unique(client, home):
    r = _register(client, email="FOYER@example.tn")
    assert r.status_code == 409


def test_password_rules(client):
    r = client.post("/api/auth/register", json={"full_name": "A B", "email": "x@example.tn", "password": "court"})
    assert r.status_code == 422


def test_forgot_and_reset_password(client, home):
    headers = login(client, "foyer@example.tn")
    unknown = client.post("/api/auth/forgot-password", json={"email": "ghost@example.tn"})
    assert unknown.status_code == 200 and unknown.json()["dev_code"] is None  # no hint the account is missing
    sent = client.post("/api/auth/forgot-password", json={"email": "foyer@example.tn"})
    code = sent.json()["dev_code"]
    r = client.post(
        "/api/auth/reset-password", json={"email": "foyer@example.tn", "code": code, "new_password": "nouveau-secret-42"}
    )
    assert r.status_code == 204
    # Old sessions end, the new password works, the code cannot be used twice.
    assert client.get("/api/auth/me", headers=headers).status_code == 401
    login(client, "foyer@example.tn", "nouveau-secret-42")
    again = client.post(
        "/api/auth/reset-password", json={"email": "foyer@example.tn", "code": code, "new_password": "encore-autre-42"}
    )
    assert again.status_code == 400


def test_remember_me_gives_a_longer_session(client, home, frozen):
    r = client.post("/api/auth/login", json={"email": "foyer@example.tn", "password": PASSWORD, "remember": True})
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    frozen.advance(days=10)
    assert client.get("/api/auth/me", headers=headers).status_code == 200


def test_profile_language_and_notification_prefs(client, auth):
    r = client.patch(
        "/api/auth/me",
        headers=auth,
        json={"full_name": "Amine", "language": "ar", "notify_prefs": {"threshold": True, "leak": False, "push": True}},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["language"] == "ar" and body["notify_prefs"]["leak"] is False and body["notify_prefs"]["push"] is True


def test_change_password_logs_out_other_sessions(client, auth):
    other = login(client, "foyer@example.tn")
    r = client.post(
        "/api/auth/change-password", headers=auth, json={"current_password": PASSWORD, "new_password": "tout-nouveau-99"}
    )
    assert r.status_code == 200
    fresh = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.get("/api/auth/me", headers=other).status_code == 401
    assert client.get("/api/auth/me", headers=fresh).status_code == 200


def test_delete_account_removes_households(client, auth, db, home):
    home_id = home.id
    wrong = client.request("DELETE", "/api/auth/me", headers=auth, json={"password": "nope", "confirm": "SUPPRIMER"})
    assert wrong.status_code == 400
    r = client.request("DELETE", "/api/auth/me", headers=auth, json={"password": PASSWORD, "confirm": "SUPPRIMER"})
    assert r.status_code == 204
    db.expunge_all()
    assert db.query(User).filter_by(email="foyer@example.tn").first() is None
    assert db.get(Household, home_id) is None


def test_suspended_account_cannot_log_in(client, db, home):
    admin, _ = make_user(db, "admin@example.tn", role="admin", with_household=False)
    admin_h = login(client, "admin@example.tn")
    users = client.get("/api/admin/users?q=foyer", headers=admin_h).json()
    assert len(users) == 1 and "password_hash" not in users[0]
    r = client.patch(f"/api/admin/users/{users[0]['id']}", headers=admin_h, json={"status": "suspended"})
    assert r.status_code == 200 and r.json()["status"] == "suspended"
    refused = client.post("/api/auth/login", json={"email": "foyer@example.tn", "password": PASSWORD})
    assert refused.status_code == 403


# --- Several households -------------------------------------------------------------------


def test_households_are_separate(client, auth, db):
    r = client.post("/api/households", headers=auth, json={"name": "Maison des parents", "subscribed_kva": 3})
    assert r.status_code == 201
    second = r.json()["id"]
    homes = client.get("/api/households", headers=auth).json()
    assert len(homes) == 2 and "Maison des parents" in [h["name"] for h in homes]

    # The dashboard follows X-Household-Id.
    dash = client.get("/api/dashboard", headers={**auth, "X-Household-Id": second}).json()
    assert dash["household_name"] == "Maison des parents" and dash["state"] == "empty"

    # Another account's household is never reachable.
    make_user(db, "voisin@example.tn")
    voisin = login(client, "voisin@example.tn")
    assert client.get("/api/dashboard", headers={**voisin, "X-Household-Id": second}).status_code == 404
    assert client.delete(f"/api/households/{second}", headers=voisin).status_code == 404

    device = client.post(f"/api/households/{second}/devices", headers=auth, json={"kind": "simulator"})
    assert device.status_code == 201 and len(device.json()["api_key"]) > 20
    assert client.delete(f"/api/households/{second}", headers=auth).status_code == 204
    assert len(client.get("/api/households", headers=auth).json()) == 1


# --- Appliances, insights, history, assistant ----------------------------------------------


def test_appliances_profile_and_estimates(client, auth):
    catalog = client.get("/api/appliances/catalog", headers=auth).json()
    assert any(c["category"] == "air_conditioner" for c in catalog)
    r = client.post(
        "/api/appliances",
        headers=auth,
        json={"category": "air_conditioner", "name": "Clim", "quantity": 1, "power_w": 1000, "hours_per_day": 4},
    )
    assert r.status_code == 201 and r.json()["estimated_kwh_month"] == 120.0  # 1 kW x 4 h x 30 d
    typical = client.post("/api/appliances", headers=auth, json={"category": "refrigerator", "name": "Frigo"}).json()
    assert typical["effective_power_w"] > 0 and typical["power_w"] is None
    assert client.post("/api/appliances", headers=auth, json={"category": "rocket", "name": "x"}).status_code == 422

    bulk = client.post(
        "/api/appliances/bulk",
        headers=auth,
        json={"items": [{"category": "lighting", "name": "Ampoules", "quantity": 6, "power_w": 60, "hours_per_day": 4}]},
    )
    assert bulk.status_code == 200 and len(client.get("/api/appliances", headers=auth).json()) == 1


def _month_of_readings(client, frozen, kwh_per_day=6.0, days=3):
    t0 = frozen.now - timedelta(days=days)
    energy = 100.0
    for i in range(days * 24 + 1):
        post_reading(client, payload(t0 + timedelta(hours=i), energy_kwh=energy, power_w=300))
        energy += kwh_per_day / 24


def test_insights_history_and_assistant(client, auth, frozen):
    client.post(
        "/api/appliances",
        headers=auth,
        json={"category": "air_conditioner", "name": "Clim salon", "power_w": 1200, "hours_per_day": 5},
    )
    _month_of_readings(client, frozen)

    insights = client.get("/api/insights", headers=auth).json()
    assert insights["status"] in ("normal", "attention", "warning", "critical", "unavailable")
    assert insights["breakdown"][0]["name"] == "Clim salon" and insights["breakdown"][0]["share_pct"] == 100

    history = client.get("/api/history?months=3", headers=auth).json()["months"]
    assert len(history) == 3 and history[-1]["partial"] is True and history[-1]["kwh"] > 0

    for lang, question in (
        ("fr", "Combien vais-je payer ce mois-ci ?"),
        ("en", "How many kWh are left before the next tranche?"),
        ("ar", "علاش الاستهلاك متاعي زاد؟"),
    ):
        r = client.post("/api/assistant/chat", headers=auth, json={"message": question, "language": lang})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["answer"] and body["source"] == "rule" and len(body["suggestions"]) == 3
        assert {f["kind"] for f in body["facts"]} <= {"measured", "forecast", "assumption", "profile"}
    assert client.post("/api/assistant/chat", headers=auth, json={"message": "facture"}).json()["intent"] == "bill"


def test_assistant_never_claims_appliance_measurement(client, auth, frozen):
    client.post("/api/appliances", headers=auth, json={"category": "water_heater", "name": "Chauffe-eau"})
    _month_of_readings(client, frozen)
    answer = client.post(
        "/api/assistant/chat", headers=auth, json={"message": "Quels appareils pèsent le plus ?", "language": "fr"}
    ).json()["answer"]
    assert "pas une mesure" in answer


def test_profile_tips_have_params(client, auth, frozen):
    client.post(
        "/api/appliances",
        headers=auth,
        json={"category": "air_conditioner", "name": "Clim", "power_w": 1500, "hours_per_day": 6},
    )
    _month_of_readings(client, frozen)
    tips = client.get("/api/tips", headers=auth).json()
    ac = next(t for t in tips if t["code"] == "ac")
    assert ac["params"]["save_kwh"] > 0 and ac["saving_dt"] is not None


# --- Notifications, support, admin ----------------------------------------------------------


def test_notifications_across_households(client, auth, db, home):
    other = Household(user_id=home.user_id, name="Location", subscribed_kva=3)
    db.add(other)
    db.flush()
    for h, msg in ((home, "a"), (other, "b")):
        db.add(Alert(household_id=h.id, type="threshold", resource="electricity", severity="warning", message=msg))
    db.commit()
    rows = client.get("/api/notifications?status=unread", headers=auth).json()
    assert {r["household_name"] for r in rows} == {home.name, "Location"}
    other_row = next(r for r in rows if r["household_name"] == "Location")
    one = client.post(f"/api/notifications/{other_row['id']}/read", headers=auth)
    assert one.status_code == 200 and one.json()["acknowledged_at"] is not None
    make_user(db, "voisin@example.tn")
    voisin = login(client, "voisin@example.tn")
    assert client.post(f"/api/notifications/{rows[0]['id']}/read", headers=voisin).status_code == 404
    assert client.post("/api/notifications/read-all", headers=auth).json()["updated"] == 1
    assert client.get("/api/notifications?status=unread", headers=auth).json() == []


def test_support_ticket_reaches_admin(client, auth, db):
    r = client.post(
        "/api/support/tickets",
        headers=auth,
        json={"category": "device", "subject": "Boîtier hors ligne", "message": "Mon boîtier ne remonte plus rien."},
    )
    assert r.status_code == 201
    make_user(db, "admin@example.tn", role="admin", with_household=False)
    admin_h = login(client, "admin@example.tn")
    tickets = client.get("/api/admin/tickets", headers=admin_h).json()
    assert tickets[0]["subject"] == "Boîtier hors ligne"
    closed = client.patch(f"/api/admin/tickets/{tickets[0]['id']}", headers=admin_h, json={"status": "closed"})
    assert closed.json()["status"] == "closed"


def test_admin_only_and_tariff_audit(client, auth, db):
    for path in ("/api/admin/users", "/api/admin/households", "/api/admin/devices", "/api/admin/system"):
        assert client.get(path, headers=auth).status_code == 403
    make_user(db, "admin@example.tn", role="admin", with_household=False)
    admin_h = login(client, "admin@example.tn")
    system = client.get("/api/admin/system", headers=admin_h).json()
    assert system["database_ok"] is True and system["email_mode"] == "log"
    assert client.get("/api/admin/devices", headers=admin_h).json()[0]["id"] in ("sim-001", "tg-001")

    tariffs = client.get("/api/tariffs", headers=admin_h).json()  # the admin has no household
    tariffs["tranches"][0]["price_millimes"] = 180
    assert client.put("/api/tariffs", headers=admin_h, json=tariffs).status_code == 200
    audit = client.get("/api/admin/tariff-audit", headers=admin_h).json()
    assert audit[0]["admin_email"] == "admin@example.tn" and "176 -> 180" in audit[0]["summary"]
