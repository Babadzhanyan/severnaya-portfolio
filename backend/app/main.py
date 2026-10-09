"""Открытое чтение портфеля и личные расчёты производственного эффекта."""
from __future__ import annotations

import asyncio
import contextlib
import logging
import math
from contextlib import asynccontextmanager
from pathlib import Path

import psycopg
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from .calculations import InputError, production_case
from .config import Settings, load_data, strict_json
from .database import Database, iso, source_status
from .source import finite_tree, json_hash
from .sync import sync_once

log = logging.getLogger("pmo.api")


def validate_request(value):
    nodes = 0

    def visit(item, depth=0):
        nonlocal nodes
        nodes += 1
        if nodes > 20000 or depth > 16:
            raise InputError("Расчёт требует допустимый объём структуры")
        if isinstance(item, dict):
            if len(item) > 500:
                raise InputError("Расчёт требует допустимое число полей")
            for key, child in item.items():
                if len(key) > 200:
                    raise InputError("Название поля требует допустимую длину")
                visit(child, depth + 1)
        elif isinstance(item, list):
            if len(item) > 500:
                raise InputError("Расчёт требует до 500 строк одного списка")
            for child in item:
                visit(child, depth + 1)
        elif isinstance(item, str) and len(item) > 4096:
            raise InputError("Текст расчёта требует до 4096 знаков в поле")
        elif isinstance(item, (int, float)) and not isinstance(item, bool) and (not math.isfinite(item) or abs(item) > 1e15):
            raise InputError("Значение расчёта требует конечное число в допустимых пределах")

    if not isinstance(value, dict):
        raise InputError("Расчёт требует объект с производственной базой")
    visit(value)


def create_app(settings: Settings | None = None, *, background_sync=True):
    settings = settings or Settings.from_env()
    database = Database(settings.database_url)

    async def poll():
        while True:
            started = asyncio.get_running_loop().time()
            try:
                await asyncio.to_thread(sync_once, database, settings)
            except psycopg.Error:
                log.exception("PostgreSQL требует восстановления подключения")
            elapsed = asyncio.get_running_loop().time() - started
            await asyncio.sleep(max(0.1, settings.poll_seconds - elapsed))

    @asynccontextmanager
    async def lifespan(app):
        await asyncio.to_thread(database.initialize)
        task = asyncio.create_task(poll()) if background_sync else None
        yield
        if task:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    app = FastAPI(title="Портфель инициатив ИТ «Северной»", version="10.0", lifespan=lifespan)
    app.state.database = database
    app.state.settings = settings
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type", "If-None-Match"], expose_headers=["ETag", "X-PMO-Source-Hash", "X-PMO-Checked-At"])

    @app.exception_handler(psycopg.Error)
    async def database_error(request, exc):
        log.error("Ошибка PostgreSQL: %s", type(exc).__name__)
        return JSONResponse(status_code=503, content={"detail": "Хранилище ожидает восстановления подключения"})

    @app.get("/api/health")
    async def health():
        healthy = await asyncio.to_thread(database.healthy)
        row = await asyncio.to_thread(database.metadata)
        status = source_status(row, settings.stale_seconds)
        return {"status": "ok" if row["version_id"] else "waiting", "database": "PostgreSQL", "database_version": healthy["version"].split(")")[0] + ")", "source_status": status, "deployment": "Серверная часть / адрес задаётся при размещении"}

    @app.get("/api/portfolio")
    async def portfolio(request: Request):
        row = await asyncio.to_thread(database.read)
        if row is None or row.get("snapshot") is None:
            raise HTTPException(503, "Источник ожидает первый проверенный срез")
        status = source_status(row, settings.stale_seconds)
        status["poll_seconds"] = settings.poll_seconds
        # Метка источника входит в ETag: переход к сохранённому срезу меняет ответ
        etag = json_hash({"hash": row["source_hash"], "status": status})
        headers = {"Cache-Control": "no-cache", "ETag": '"' + etag + '"', "X-PMO-Source-Hash": row["source_hash"], "X-PMO-Checked-At": iso(row["checked_at"]) or ""}
        if request.headers.get("if-none-match") == headers["ETag"]:
            return Response(status_code=304, headers=headers)
        return JSONResponse({"portfolio": row["snapshot"], "synced_at": iso(row["synced_at"]), "source_status": status}, headers=headers)

    @app.get("/api/calculators/source")
    async def calculators_source():
        catalog = load_data("production_source_inputs.json")
        row = await asyncio.to_thread(database.read)
        native = row.get("snapshot", {}).get("production_input") if row and row.get("snapshot") else None
        catalog["production_input"] = native
        audit = load_data("master_v65_source_audit.json")
        catalog["source_metadata"] = {
            "auditFile": "master_v65_source_audit.json",
            "source_file_name": Path(audit["source"]).name,
            "source_pdf_pages": audit["pages"],
            "source_sha256": audit["sha256"],
            "case_boundaries": audit["case_boundaries"],
            "scope_note": "Расчёт бройлера за январь – июнь 2026 и годовой контур всего завода сохраняют свои периоды и состав продукции",
            "classification_note": "Прочие 13% включают субпродукты, механическую обвалку и родительскую птицу; EBITDA требует классификации расходов и амортизации",
        }
        return {"source_inputs": catalog, "production_input": native, "example": load_data("production_example.json"), "schema": load_data("production_input_schema.json"), "source_status": source_status(row, settings.stale_seconds) if row else {"state": "waiting"}, "source_mode": "google" if native else "catalog", "source_label": "Производственный расчёт Google Sheets" if native else "Справочник исходных данных / требуется загрузка нативной модели Google"}

    @app.post("/api/calculations/production")
    async def production(request: Request):
        media = request.headers.get("content-type", "").split(";")[0].strip().lower()
        if media != "application/json":
            raise HTTPException(415, "Расчёт принимает JSON")
        body = bytearray()
        async for chunk in request.stream():
            if len(body) + len(chunk) > settings.request_max_bytes:
                raise HTTPException(413, "Расчёт требует объём до 256 КБ")
            body.extend(chunk)
        try:
            value = strict_json(bytes(body))
            validate_request(value)
            result = await asyncio.to_thread(production_case, value)
            finite_tree(result)
            return result
        except (InputError, ValueError, TypeError, KeyError, AttributeError, OverflowError, ZeroDivisionError, UnicodeError) as exc:
            detail = str(exc) if isinstance(exc, InputError) else "Поля расчёта требуют проверку структуры и допустимых значений"
            raise HTTPException(422, detail) from exc

    return app
