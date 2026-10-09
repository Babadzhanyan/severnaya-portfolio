"""PostgreSQL хранит версии и переключает актуальный срез одной транзакцией."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


class Database:
    def __init__(self, dsn: str):
        self.dsn = dsn

    def connect(self):
        return psycopg.connect(self.dsn, connect_timeout=5, row_factory=dict_row)

    def initialize(self):
        sql = (Path(__file__).resolve().parents[1] / "schema.sql").read_text(encoding="utf-8")
        with self.connect() as conn:
            conn.execute(sql)

    def healthy(self):
        with self.connect() as conn:
            return conn.execute("SELECT current_database() AS database, version() AS version").fetchone()

    def metadata(self):
        with self.connect() as conn:
            return conn.execute("SELECT c.*, v.source_hash, v.google_signature, v.created_at AS synced_at, v.snapshot->>'sourceContractHash' AS contract_hash FROM current_snapshot c LEFT JOIN versions v ON v.id=c.version_id WHERE c.singleton").fetchone()

    def read(self):
        with self.connect() as conn:
            return conn.execute("SELECT c.*, v.source_hash, v.snapshot, v.google_signature, v.created_at AS synced_at FROM current_snapshot c LEFT JOIN versions v ON v.id=c.version_id WHERE c.singleton").fetchone()

    def save(self, portfolio: dict, source_hash: str, signature: str | None):
        records = portfolio["initiatives"]
        with self.connect() as conn:
            # Блокировка защищает единую точку переключения при запуске второго процесса
            conn.execute("SELECT pg_advisory_xact_lock(710080010)")
            version = conn.execute("INSERT INTO versions(source_hash,snapshot,google_signature) VALUES(%s,%s,%s) ON CONFLICT(source_hash) DO UPDATE SET google_signature=EXCLUDED.google_signature RETURNING id", (source_hash, Jsonb(portfolio), signature)).fetchone()
            version_id = version["id"]
            conn.execute("DELETE FROM initiatives")
            with conn.cursor() as cursor:
                cursor.executemany("INSERT INTO initiatives(code,record,source_hash,version_id) VALUES(%s,%s,%s,%s)", [(i["code"], Jsonb(i), source_hash, version_id) for i in records])
            conn.execute("UPDATE current_snapshot SET version_id=%s, checked_at=now(), last_attempt_at=now(), source_status='ok',last_error=NULL WHERE singleton", (version_id,))
        return version_id

    def checked(self):
        with self.connect() as conn:
            conn.execute("UPDATE current_snapshot SET checked_at=now(),last_attempt_at=now(),source_status='ok',last_error=NULL WHERE singleton")

    def error(self, message):
        with self.connect() as conn:
            conn.execute("UPDATE current_snapshot SET last_attempt_at=now(),source_status='error',last_error=%s WHERE singleton", (message[:500],))


def iso(value):
    return value.isoformat() if isinstance(value, datetime) else value


def source_status(row: dict, stale_seconds: float):
    checked_at = row.get("checked_at")
    age = (datetime.now(timezone.utc) - checked_at).total_seconds() if checked_at else None
    state = "waiting" if row.get("version_id") is None else "error" if row.get("source_status") == "error" else "stale" if age is None or age > stale_seconds else "ok"
    labels = {"waiting": "Источник ожидает первый проверенный срез", "ok": "Google Sheets проверен", "stale": "Показан сохранённый проверенный срез", "error": "Показан сохранённый срез / источник требует проверки"}
    return {"state": state, "label": labels[state], "provider": "PostgreSQL / Google Sheets", "source_hash": row.get("source_hash"), "checked_at": iso(checked_at), "last_attempt_at": iso(row.get("last_attempt_at")), "synced_at": iso(row.get("synced_at")), "version_id": row.get("version_id"), "poll_seconds": 15, "error": row.get("last_error")}
