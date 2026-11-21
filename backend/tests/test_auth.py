"""Login, tokens, rate limit and protected routes."""

import jwt

from tests.conftest import PASSWORD, login


def test_login_and_me(client, home):
    response = client.post("/api/auth/login", json={"email": "FOYER@example.tn ", "password": PASSWORD})
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer" and body["user"]["role"] == "household"
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200 and me.json()["email"] == "foyer@example.tn"


def test_wrong_password_and_unknown_email(client, home):
    assert client.post("/api/auth/login", json={"email": "foyer@example.tn", "password": "nope"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "ghost@example.tn", "password": "x"}).status_code == 401


def test_login_is_rate_limited(client, home):
    codes = [
        client.post("/api/auth/login", json={"email": "foyer@example.tn", "password": "bad"}).status_code
        for _ in range(6)
    ]
    assert codes[:5] == [401] * 5 and codes[5] == 429


def test_protected_routes_need_a_valid_token(client, home):
    for path in ("/api/dashboard", "/api/alerts", "/api/tips", "/api/score", "/api/settings", "/api/tariffs"):
        assert client.get(path).status_code == 401
    forged = jwt.encode({"sub": "00000000-0000-0000-0000-000000000000", "exp": 9999999999}, "a-different-secret-that-is-long-enough-123")
    assert client.get("/api/dashboard", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_expired_token_is_rejected(client, home, frozen):
    headers = login(client, "foyer@example.tn")
    frozen.advance(hours=13)  # tokens last 12 h
    assert client.get("/api/auth/me", headers=headers).status_code == 401
