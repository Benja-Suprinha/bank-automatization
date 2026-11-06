from app.parsers.cencosud import ParseError, parse_cencosud


VALID_BODY = "Realizaste una compra por CLP 27,132 en JUMBO ONECLICK el 06/11/26 con tu tarjeta terminada en 2612"
PAYLOAD = {
    "source": "cencosud",
    "title": "Aprobamos tu compra",
    "body": VALID_BODY,
    "received_at": "2026-11-06T09:11:00-03:00",
    "client_event_id": "event-1",
}


def test_parser_valid():
    parsed = parse_cencosud(PAYLOAD["title"], VALID_BODY)
    assert parsed.amount == 27132
    assert parsed.merchant == "JUMBO ONECLICK"
    assert parsed.occurred_at == "2026-11-06"
    assert parsed.card_last4 == "2612"


def test_parser_invalid():
    try:
        parse_cencosud("title", "not a bank notification")
    except ParseError as error:
        assert "monto" in str(error)
    else:
        raise AssertionError("Expected ParseError")


def test_authentication(client):
    response = client.post("/api/v1/notifications", json=PAYLOAD)
    assert response.status_code == 401
    assert client.post("/api/v1/notifications", json=PAYLOAD, headers={"X-API-Key": "test-key"}).status_code == 201


def test_duplicate_is_idempotent(client):
    headers = {"X-API-Key": "test-key"}
    first = client.post("/api/v1/notifications", json=PAYLOAD, headers=headers)
    second = client.post("/api/v1/notifications", json=PAYLOAD, headers=headers)
    assert first.status_code == 201
    assert second.status_code == 201
    assert second.json()["id"] == first.json()["id"]
    assert len(client.get("/api/v1/transactions", headers=headers).json()) == 1


def test_unparsed_is_saved_and_listed(client):
    headers = {"X-API-Key": "test-key"}
    payload = {**PAYLOAD, "client_event_id": "bad-1", "body": "mensaje sin datos"}
    response = client.post("/api/v1/notifications", json=payload, headers=headers)
    assert response.status_code == 202
    assert response.json()["status"] == "unparsed"
    assert response.json()["parse_error"]
    listed = client.get("/api/v1/notifications?status=unparsed", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1


def test_transaction_can_be_created_and_deleted(client):
    headers = {"X-API-Key": "test-key"}
    payload = {
        "source": "manual",
        "amount": 4500,
        "merchant": "CAFETERIA TEST",
        "description": "Prueba de CRUD",
        "occurred_at": "2026-11-06",
        "category": "Alimentación",
    }
    created = client.post("/api/v1/transactions", json=payload, headers=headers)
    assert created.status_code == 201
    transaction_id = created.json()["id"]
    assert created.json()["amount"] == 4500
    deleted = client.delete(f"/api/v1/transactions/{transaction_id}", headers=headers)
    assert deleted.status_code == 204
    assert client.get("/api/v1/transactions", headers=headers).json() == []
