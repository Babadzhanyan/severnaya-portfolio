"""Единственное направление обновления: Google Sheets → PostgreSQL."""
from __future__ import annotations

import logging

import httpx

from .calculations import InputError, production_case
from .config import Settings, load_data, source_config
from .database import Database
from .source import PROJECTOR_VERSION, NotModified, SourceError, fetch_response, finite_tree, json_hash, project_response

log = logging.getLogger("pmo.sync")


def sync_once(database: Database, settings: Settings, *, fetcher=fetch_response):
    metadata = database.metadata() or {}
    try:
        config = source_config()
        contract_hash = json_hash({"config": config, "schema": load_data("schema.json"), "projector": PROJECTOR_VERSION})
        signature = metadata.get("google_signature") if metadata.get("contract_hash") == contract_hash else None
        response = fetcher(settings, config, signature)
        portfolio = project_response(response, config, minimum_records=settings.source_min_records)
        if portfolio.get("production_input"):
            # Нативная модель проходит тот же проверочный расчёт до переключения среза
            finite_tree(production_case(portfolio["production_input"]))
        source_hash = json_hash({"table": response["table"], "config": config, "projector": PROJECTOR_VERSION, "schema": portfolio["schema"]})
        if source_hash == metadata.get("source_hash"):
            database.checked()
            return {"state": "unchanged", "hash": source_hash}
        version = database.save(portfolio, source_hash, response.get("sig"))
        log.info("Срез Google сохранён: %s инициатив / версия %s", len(portfolio["initiatives"]), version)
        return {"state": "updated", "hash": source_hash, "version": version, "records": len(portfolio["initiatives"])}
    except NotModified:
        if metadata.get("version_id") is None:
            database.error("Источник требует первый полный срез")
            return {"state": "error"}
        database.checked()
        return {"state": "unchanged", "hash": metadata.get("source_hash")}
    except (SourceError, InputError, ValueError, TypeError, KeyError, AttributeError, OverflowError, ZeroDivisionError, httpx.HTTPError) as exc:
        message = str(exc) if isinstance(exc, (SourceError, InputError)) else "Google Sheets требует повторную проверку загрузки и структуры"
        database.error(message)
        log.warning("Сохранён предыдущий срез: %s", message)
        return {"state": "error", "error": message}
