"""Конфигурация серверного чтения с фиксированным источником Google."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
SPREADSHEET_ID = "1stFDS_18dulhc96CSybYdXDk3RyvMvsSO9HxPkTvB4g"
FEED_SHEET_ID = 907270027


def strict_json(text: str | bytes):
    def reject_constant(value):
        raise ValueError("JSON требует конечные числовые значения")

    try:
        return json.loads(text, parse_constant=reject_constant)
    except RecursionError as exc:
        raise ValueError("Структура JSON требует допустимую глубину") from exc


def load_data(name: str):
    return strict_json((BASE / "data" / name).read_text(encoding="utf-8"))


def source_config():
    # В рабочем каталоге читается тот же контракт, что использует React
    # Контейнер использует проверенную копию data/live_config.json
    frontend = BASE.parent / "frontend" / "src" / "data" / "live-config.js"
    if frontend.exists():
        text = frontend.read_text(encoding="utf-8").strip()
        if not text.startswith("export default ") or not text.endswith(";"):
            raise ValueError("Конфигурация источника требует проверенную структуру")
        result = strict_json(text[len("export default "):-1])
    else:
        result = load_data("live_config.json")
    if result.get("spreadsheetId") != SPREADSHEET_ID or result.get("feedSheetId") != FEED_SHEET_ID:
        raise ValueError("Источник должен соответствовать согласованному реестру Google")
    return result


@dataclass(frozen=True)
class Settings:
    database_url: str
    poll_seconds: float = 15
    stale_seconds: float = 45
    source_max_bytes: int = 32 * 1024 * 1024
    request_max_bytes: int = 256 * 1024
    source_min_records: int = 190
    cors_origins: tuple[str, ...] = (
        "https://babadzhanyan.github.io",
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:4173", "http://127.0.0.1:4173",
    )

    @classmethod
    def from_env(cls):
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise ValueError("DATABASE_URL задаёт подключение к PostgreSQL")
        origins = os.environ.get("CORS_ORIGINS")
        poll = float(os.environ.get("PMO_POLL_SECONDS", "15"))
        stale = float(os.environ.get("PMO_STALE_SECONDS", "45"))
        minimum = int(os.environ.get("PMO_SOURCE_MIN_RECORDS", "190"))
        if not 15 <= poll <= 3600 or not poll <= stale <= 86400 or not 1 <= minimum <= 500:
            raise ValueError("Интервалы и минимальный состав источника требуют проверенные значения")
        values = dict(database_url=url, poll_seconds=poll, stale_seconds=stale, source_min_records=minimum)
        if origins:
            parsed = tuple(v.strip().rstrip("/") for v in origins.split(",") if v.strip())
            if any(v == "*" or not v.startswith(("https://", "http://localhost:", "http://127.0.0.1:")) for v in parsed):
                raise ValueError("CORS_ORIGINS требует точные адреса сайта и локальной проверки")
            values["cors_origins"] = parsed
        return cls(**values)
