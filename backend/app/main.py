import csv
import io
import logging
import os
import time
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .database import Base, engine, get_db
from .models import Notification, Transaction
from .parsers import PARSER_REGISTRY
from .parsers.cencosud import ParseError
from .schemas import NotificationCreate, NotificationOut, TransactionCreate, TransactionOut, TransactionPatch

load_dotenv()
log_level = getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO)
log_file = os.getenv("LOG_FILE", "data/api.log")
os.makedirs(os.path.dirname(log_file) or ".", exist_ok=True)
log_formatter = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("bank_automatization.api")
logger.setLevel(log_level)
logger.propagate = False
if not logger.handlers:
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(log_formatter)
    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setFormatter(log_formatter)
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
app = FastAPI(title="Personal Bank Automatization API", version="1.0.0")
MAX_BODY_SIZE = 10 * 1024
allowed_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=allowed_origins, allow_methods=["*"], allow_headers=["*"], expose_headers=["Content-Disposition"])


@app.on_event("startup")
def create_tables() -> None:
    os.makedirs("data", exist_ok=True)
    Base.metadata.create_all(bind=engine)
    logger.info("database.ready path=%s", os.getenv("DATABASE_URL", "sqlite:///./data/app.db"))


@app.middleware("http")
async def limit_request_body(request: Request, call_next):
    started_at = time.perf_counter()
    logger.info("request.started method=%s path=%s", request.method, request.url.path)
    body = await request.body()
    if len(body) > MAX_BODY_SIZE:
        logger.warning("request.rejected method=%s path=%s reason=body_too_large bytes=%d", request.method, request.url.path, len(body))
        return Response("Request body too large", status_code=413)
    request._receive = lambda: {"type": "http.request", "body": body, "more_body": False}
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("request.failed method=%s path=%s", request.method, request.url.path)
        raise
    duration_ms = (time.perf_counter() - started_at) * 1000
    logger.info("request.completed method=%s path=%s status=%d duration_ms=%.1f", request.method, request.url.path, response.status_code, duration_ms)
    return response


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    configured_key = os.getenv("API_KEY")
    if not configured_key:
        logger.error("auth.failed reason=api_key_not_configured")
        raise HTTPException(status_code=500, detail="API_KEY no está configurada")
    if x_api_key != configured_key:
        logger.warning("auth.failed reason=invalid_api_key")
        raise HTTPException(status_code=401, detail="API key inválida")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/notifications", response_model=NotificationOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_api_key)])
def create_notification(payload: NotificationCreate, db: Session = Depends(get_db)):
    if payload.client_event_id:
        existing = db.scalar(select(Notification).options(selectinload(Notification.transaction)).where(Notification.client_event_id == payload.client_event_id))
        if existing:
            logger.info("notification.duplicate notification_id=%d source=%s", existing.id, existing.source)
            return existing
    notification = Notification(source=payload.source, title=payload.title, body=payload.body, received_at=payload.received_at.isoformat(), client_event_id=payload.client_event_id)
    db.add(notification)
    db.flush()
    try:
        parser = PARSER_REGISTRY.get(payload.source.lower())
        if parser is None:
            raise ParseError(f"No hay parser para source={payload.source}")
        parsed = parser(payload.title, payload.body)
        notification.status = "parsed"
        notification.transaction = Transaction(notification_id=notification.id, source=payload.source, amount=parsed.amount, currency=parsed.currency, merchant=parsed.merchant, occurred_at=parsed.occurred_at, card_last4=parsed.card_last4)
    except (ParseError, ValueError) as exc:
        notification.status = "unparsed"
        notification.parse_error = str(exc)
        logger.warning("notification.unparsed notification_id=%d source=%s reason=%s", notification.id, notification.source, str(exc))
    db.commit()
    db.refresh(notification)
    if notification.transaction:
        logger.info("notification.parsed notification_id=%d source=%s transaction_id=%d", notification.id, notification.source, notification.transaction.id)
    if notification.status == "unparsed":
        return JSONResponse(status_code=202, content=NotificationOut.model_validate(notification).model_dump(mode="json"))
    return notification


@app.get("/api/v1/transactions", response_model=list[TransactionOut], dependencies=[Depends(require_api_key)])
def list_transactions(status_filter: str | None = Query(default=None, alias="status"), db: Session = Depends(get_db)):
    query = select(Transaction).order_by(Transaction.id.desc())
    if status_filter:
        query = query.where(Transaction.status == status_filter)
    return list(db.scalars(query))


@app.post("/api/v1/transactions", response_model=TransactionOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_api_key)])
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db)):
    notification = Notification(source=payload.source, title="Manual transaction", body=payload.description or payload.merchant or "Created from dashboard", received_at=now_iso(), status="parsed")
    transaction = Transaction(source=payload.source, amount=payload.amount, currency=payload.currency.upper(), merchant=payload.merchant, description=payload.description, occurred_at=payload.occurred_at, card_last4=payload.card_last4, category=payload.category, status=payload.status, notification=notification)
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    logger.info("transaction.created transaction_id=%d source=%s origin=manual", transaction.id, transaction.source)
    return transaction


@app.get("/api/v1/notifications", response_model=list[NotificationOut], dependencies=[Depends(require_api_key)])
def list_notifications(status_filter: str | None = Query(default=None, alias="status"), db: Session = Depends(get_db)):
    query = select(Notification).options(selectinload(Notification.transaction)).order_by(Notification.id.desc())
    if status_filter:
        query = query.where(Notification.status == status_filter)
    return list(db.scalars(query))


@app.post("/api/v1/notifications/{notification_id}/reparse", response_model=NotificationOut, dependencies=[Depends(require_api_key)])
def reparse_notification(notification_id: int, db: Session = Depends(get_db)):
    notification = db.scalar(select(Notification).options(selectinload(Notification.transaction)).where(Notification.id == notification_id))
    if not notification:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    try:
        parser = PARSER_REGISTRY.get(notification.source.lower())
        if parser is None:
            raise ParseError(f"No hay parser para source={notification.source}")
        parsed = parser(notification.title, notification.body)
        if notification.transaction:
            transaction = notification.transaction
            transaction.amount = parsed.amount
            transaction.merchant = parsed.merchant
            transaction.occurred_at = parsed.occurred_at
            transaction.card_last4 = parsed.card_last4
            transaction.updated_at = now_iso()
        else:
            notification.transaction = Transaction(notification_id=notification.id, source=notification.source, amount=parsed.amount, currency=parsed.currency, merchant=parsed.merchant, occurred_at=parsed.occurred_at, card_last4=parsed.card_last4)
        notification.status = "parsed"
        notification.parse_error = None
    except (ParseError, ValueError) as exc:
        notification.status = "unparsed"
        notification.parse_error = str(exc)
    db.commit()
    db.refresh(notification)
    logger.info("notification.reparsed notification_id=%d source=%s status=%s", notification.id, notification.source, notification.status)
    return notification


@app.get("/api/v1/transactions/export.csv", dependencies=[Depends(require_api_key)])
def export_transactions(db: Session = Depends(get_db)):
    output = io.StringIO()
    writer = csv.writer(output)
    fields = ["id", "notification_id", "source", "amount", "currency", "merchant", "description", "occurred_at", "card_last4", "category", "status"]
    writer.writerow(fields)
    for transaction in db.scalars(select(Transaction).order_by(Transaction.id)):
        writer.writerow([getattr(transaction, field) for field in fields])
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=transactions.csv"})


@app.patch("/api/v1/transactions/{transaction_id}", response_model=TransactionOut, dependencies=[Depends(require_api_key)])
def update_transaction(transaction_id: int, payload: TransactionPatch, db: Session = Depends(get_db)):
    transaction = db.get(Transaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(transaction, field, value)
    transaction.updated_at = now_iso()
    db.commit()
    db.refresh(transaction)
    logger.info("transaction.updated transaction_id=%d fields=%s", transaction.id, ",".join(payload.model_dump(exclude_unset=True).keys()))
    return transaction


@app.delete("/api/v1/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_api_key)])
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    transaction = db.get(Transaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    db.delete(transaction)
    db.commit()
    logger.info("transaction.deleted transaction_id=%d", transaction_id)
