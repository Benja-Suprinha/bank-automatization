import re
from dataclasses import dataclass
from datetime import datetime


class ParseError(ValueError):
    pass


@dataclass(frozen=True)
class ParsedTransaction:
    amount: int
    currency: str
    merchant: str
    occurred_at: str
    card_last4: str


def parse_cencosud(title: str, body: str) -> ParsedTransaction:
    amount_match = re.search(r"\b(?:CLP\s*)?([\d.,]+)\s+en\s+(.+?)\s+el\s+", body, re.IGNORECASE)
    date_match = re.search(r"\bel\s+(\d{2}/\d{2}/\d{2,4})\b", body, re.IGNORECASE)
    card_match = re.search(r"(?:terminada|terminado)\s+en\s+(\d{4})\b", body, re.IGNORECASE)
    if not amount_match:
        raise ParseError("No se encontró el monto y comercio")
    if not date_match:
        raise ParseError("No se encontró la fecha de compra")
    if not card_match:
        raise ParseError("No se encontró la tarjeta")
    raw_amount, merchant = amount_match.groups()
    try:
        amount = int(raw_amount.replace(".", "").replace(",", ""))
        date_format = "%d/%m/%Y" if len(date_match.group(1)) == 10 else "%d/%m/%y"
        occurred_at = datetime.strptime(date_match.group(1), date_format).date().isoformat()
    except ValueError as exc:
        raise ParseError("Monto o fecha inválidos") from exc
    return ParsedTransaction(amount, "CLP", merchant.strip(), occurred_at, card_match.group(1))
