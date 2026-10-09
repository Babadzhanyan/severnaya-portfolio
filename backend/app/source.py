"""Типизированный поток Google Sheets преобразуется в совместимый PMOData."""
from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode, urlsplit

import httpx

from .config import FEED_SHEET_ID, SPREADSHEET_ID, Settings, load_data, source_config, strict_json

PROJECTOR_VERSION = "12.3"

class SourceError(ValueError):
    """Проверка источника сохраняет предыдущий срез."""


class NotModified(Exception):
    """Google подтвердил сохранённую версию потока."""


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def json_hash(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def decode_value(cell):
    if cell is None or cell.get("v") is None:
        return None
    value = cell["v"]
    if not isinstance(value, str):
        raise SourceError("Google Sheets передаёт ячейку для повторной проверки")
    prefix, body = value[:2], value[2:]
    if prefix == "z:":
        return None
    if prefix == "s:":
        return body
    if prefix == "b:" and body in ("0", "1"):
        return body == "1"
    if prefix == "n:":
        normalized = re.sub(r"[\s\u00a0]", "", body).replace(",", ".", 1)
        if re.fullmatch(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?", normalized, flags=re.ASCII):
            number = float(normalized)
            if math.isfinite(number):
                return int(number) if number.is_integer() else number
        raise SourceError("Google Sheets передаёт число для повторной проверки")
    if prefix == "e:":
        raise SourceError("Google Sheets сообщает об ошибке исходной ячейки")
    raise SourceError("Google Sheets передаёт ячейку для повторной проверки")


def date_text(value):
    if not value:
        return ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if not math.isfinite(value) or abs(value) > 1000000:
            raise SourceError("Дата требует проверенный серийный номер")
        return (datetime(1899, 12, 30, tzinfo=timezone.utc) + timedelta(days=value)).date().isoformat()
    return str(value)[:10]


def date_time_text(value):
    if value is None or value == "":
        return ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if not math.isfinite(value) or abs(value) > 1000000:
            raise SourceError("Дата требует проверенный серийный номер")
        return (datetime(1899, 12, 30, tzinfo=timezone(timedelta(hours=3))) + timedelta(days=value)).isoformat(timespec="seconds")
    text = str(value)
    if re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}", text) and not re.search(r"(?:Z|[+-]\d{2}:\d{2})$", text):
        return text + "+03:00"
    return text


def display(value):
    text = str(value or "").replace("—", "–")
    text = re.sub(r"Гипотеза:\s*", "", text, flags=re.I)
    text = re.sub(r"Гипотез(?:ами|ах|ам|ой|а|ы|у|е)?(?=$|\s|[.,:;!?])", "", text, flags=re.I)
    return re.sub(r"[ \t]{2,}", " ", text)


def normalize_execution_fact(value):
    if value is None:
        return None
    states = {"completed", "in_progress", "planned", "paused", "cancelled", "unknown"}
    if (not isinstance(value, dict) or not isinstance(value.get("state"), str)
            or value["state"] not in states or value.get("audited") is not True
            or type(value.get("scope_complete")) is not bool):
        raise SourceError("Факт исполнения требует проверку статуса и источника")
    precision, date = value.get("actual_finish_precision"), value.get("actual_finish")
    if precision == "month" and isinstance(date, str) and re.fullmatch(r"\d{4}-\d{2}", date):
        date += "-01"
    if precision not in (None, "month", "day") or precision and date is None:
        raise SourceError("Фактическая дата требует проверку точности источника")
    if date is not None:
        if not isinstance(date, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
            raise SourceError("Фактическая дата требует проверку точности источника")
        try:
            datetime.strptime(date, "%Y-%m-%d")
        except ValueError as exc:
            raise SourceError("Фактическая дата требует проверку точности источника") from exc
    if value["state"] == "completed" and not value["scope_complete"]:
        raise SourceError("Завершение требует подтверждение полного состава работ")
    result = {**value, "actual_finish": date, "actual_finish_precision": precision}
    end = value.get("planned_end")
    if end is not None:
        if not isinstance(end, dict) or end.get("precision") not in (None, "month", "day"):
            raise SourceError("Плановый срок требует проверку точности источника")
        raw, position = end.get("value"), end.get("value")
        if end.get("precision") == "month" and isinstance(raw, str) and re.fullmatch(r"\d{4}-\d{2}", raw):
            position += "-01"
        if end.get("precision") and position is None:
            raise SourceError("Плановый срок требует проверку точности источника")
        if position is not None:
            if not isinstance(position, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", position):
                raise SourceError("Плановый срок требует проверку точности источника")
            try:
                datetime.strptime(position, "%Y-%m-%d")
            except ValueError as exc:
                raise SourceError("Плановый срок требует проверку точности источника") from exc
        result["planned_end"] = {**end, "value": raw, "precision": end.get("precision")}
    return result


TABLES = {
    "staff": "employee it_group role curator assignment_status assigned_count in_work_count historical_count source",
    "parameters": "code process name unit value period source approved_by approved_at readiness applicability",
    "plan": "code result start end owner predecessor readiness",
    "resources": "code it_group total_hours q1 q2 q3 q4 confirmed_by confirmed_at readiness decision capacity_status",
    "decisions": "code type date approved_by document conditions readiness",
    "actuals": "code date actual_cost forecast_cost actual_hours forecast_hours actual_metric actual_effect forecast_finish source readiness",
    "capacity": "it_group q1 q2 q3 q4 remaining_q1 remaining_q2 remaining_q3 remaining_q4 confirmed_by confirmed_at",
    "levers": "code method quantity_parameter price_parameter baseline target metric annual_ebitda ebitda_2027 cash_2027 readiness year_fraction coverage ramp cash_realization labor_monetization one_off_ebitda_cost running_ebitda_cost quantity price unit source risk_expected physical_hours gross_ebitda_2027 mechanism effect_group decision effect_role effect_start cash_cost_ratio cash_per_hour",
    "ledger": "code title it_group lead stage decision effect_group effect_role confirmation annual_potential ebitda_2027 cash_2027 hours",
    "previousSnapshot": "code stage decision effect_group effect_role annual_potential ebitda_2027 cash_2027 hours confirmation year method",
    "tracker": "stage count count_delta confirmed_count annual_potential ebitda_2027 ebitda_delta cash_2027 hours hours_estimates action codes",
    "annualHistory": "name _1 _2 _3 value _5 unit period _8 source _10",
}
DATE_FIELDS = {"start", "end", "date", "confirmed_at", "forecast_finish", "effect_start", "approved_at"}


def finite_tree(value, *, depth=0):
    if depth > 30:
        raise SourceError("Источник требует допустимую глубину структуры")
    if isinstance(value, float) and not math.isfinite(value):
        raise SourceError("Источник требует конечные числовые значения")
    if isinstance(value, dict):
        for item in value.values():
            finite_tree(item, depth=depth + 1)
    elif isinstance(value, list):
        for item in value:
            finite_tree(item, depth=depth + 1)


def source_cell_location(cfg, schema, block, index, column):
    def column_text(number):
        result = ""
        while number:
            number, rest = divmod(number - 1, 26)
            result = chr(65 + rest) + result
        return result

    actual = cfg.get("actualBlocks", {}).get(block["key"], {}) if block else {}
    if not actual:
        return cfg["feedSheetName"] + "!" + column_text(column + 2) + str(index + 2)
    offset = index + 1 - block["feedFirst"]
    passport = block["key"] in ("initiatives", "stageDeadlines", "digitalLayers", "priorityInputs")
    if passport and cfg.get("sourcePartitionPolicy") == "ranges":
        main = cfg["actualBlocks"]["initiatives"]
        count = int(re.search(r"(\d+)$", main["sourceRange"])[1]) - main["firstDataRow"] + 1
        if offset >= count:
            actual = cfg["actualBlocks"]["ideas"]
            offset -= count
    physical = None
    if passport:
        field = schema["columns"][block["firstSourceColumn"] + column - 1]
        physical = cfg.get("physicalColumns", {}).get(str(actual["sheetId"]), {}).get(field["key"])
        if not physical:
            physical = column_text(cfg["actualBlocks"]["initiatives"]["firstColumn"] + block["firstSourceColumn"] + column - 1)
    cell = (physical or column_text(actual["firstColumn"] + column)) + str(actual["firstDataRow"] + offset)
    return actual["sheetName"] + "!" + cell


def project_response(response: dict, config=None, *, minimum_records=190):
    cfg = config or source_config()
    schema = load_data("schema.json")
    if response.get("status") != "ok" or not isinstance(response.get("table", {}).get("rows"), list):
        raise SourceError("Google Sheets ожидает доступ по ссылке и исправные формулы")
    rows = response["table"]["rows"]
    blocks = {b["key"]: b for b in cfg["blocks"]}
    expected_rows = max(b["feedLast"] for b in cfg["blocks"])
    if len(rows) != expected_rows or len(response["table"].get("cols", [])) != cfg["transportColumns"]:
        raise SourceError("Требуется полный состав данных Google Sheets")
    if len(schema.get("columns", [])) != cfg["masterColumns"] or "initiatives" not in blocks or "stageDeadlines" not in blocks:
        raise SourceError("Требуется полный состав паспортных полей")
    if cfg["masterColumns"] >= 52:
        digital = blocks.get("digitalLayers")
        main = blocks["initiatives"]
        if (not digital or digital["sheet"] != main["sheet"] or digital["firstSourceColumn"] != 52
                or digital["firstSourceRow"] != main["firstSourceRow"] or digital["columns"] != 1
                or digital["feedLast"] - digital["feedFirst"] != main["feedLast"] - main["feedFirst"]):
            raise SourceError("Цифровой уровень требует полный блок каждой строки реестра")
    if cfg["masterColumns"] >= 58:
        priority = blocks.get("priorityInputs")
        main = blocks["initiatives"]
        if (not priority or priority["sheet"] != main["sheet"] or priority["firstSourceColumn"] != 53
                or priority["firstSourceRow"] != main["firstSourceRow"] or priority["columns"] != 6
                or priority["feedLast"] - priority["feedFirst"] != main["feedLast"] - main["feedFirst"]):
            raise SourceError("Приоритеты требуют полный блок каждой строки реестра")
    if cfg.get("schemaVersion", 0) >= 12:
        annual = blocks.get("annualActualInputJSON")
        if not annual or annual["columns"] != 1 or annual["feedLast"] != annual["feedFirst"]:
            raise SourceError("Годовой расчёт требует полный блок исходных данных")
    finite_tree(response)
    # Все ячейки потока проходят проверку, включая резервные строки между блоками
    decoded = []
    for index, row in enumerate(rows):
        cells = row.get("c", [])
        values = []
        for column in range(cfg["transportColumns"]):
            try:
                values.append(decode_value(cells[column] if column < len(cells) else None))
            except SourceError as exc:
                block = next((b for b in cfg["blocks"] if b["feedFirst"] <= index + 1 <= b["feedLast"] and column < b["columns"]), None)
                location = source_cell_location(cfg, schema, block, index, column)
                raise SourceError(f"{exc} / источник {location}") from exc
        decoded.append(values)
    grids: dict[str, dict[tuple[int, int], Any]] = {}
    for b in cfg["blocks"]:
        grid = grids.setdefault(b["sheet"], {})
        for offset in range(b["feedLast"] - b["feedFirst"] + 1):
            for col in range(b["columns"]):
                grid[b["firstSourceRow"] + offset, b["firstSourceColumn"] + col] = decoded[b["feedFirst"] - 1 + offset][col]

    def get(row, col, sheet=None):
        sheet = sheet or blocks["initiatives"]["sheet"]
        return grids.get(sheet, {}).get((row, col))

    def column_no(column):
        number = 0
        for char in column:
            number = number * 26 + ord(char) - 64
        return number

    def table(key, fields):
        b = blocks[key]
        result = []
        for offset in range(b["feedLast"] - b["feedFirst"] + 1):
            row = b["firstSourceRow"] + offset
            record = {"_row": row}
            for col, field in enumerate(fields):
                value = get(row, b["firstSourceColumn"] + col, b["sheet"])
                record[field] = date_text(value) if field in DATE_FIELDS else value
            if record[fields[0]]:
                result.append(record)
        return result

    data = {key: table(key, fields.split()) for key, fields in TABLES.items()}
    data["annualHistory"] = [{key: r[key] for key in ("name", "value", "unit", "period", "source")} for r in data["annualHistory"]]
    initiatives, unique = [], set()
    first = blocks["initiatives"]["firstSourceRow"]
    count = blocks["initiatives"]["feedLast"] - blocks["initiatives"]["feedFirst"] + 1
    for row in range(first, first + count):
        code = get(row, 1)
        if not code:
            continue
        if not isinstance(code, str) or not re.fullmatch(r"ИТ-[0-9]{3}", code) or code in unique:
            raise SourceError("Реестр требует уникальные коды ИТ-001")
        unique.add(code)
        record = {"_row": row, "_source_row": row - 4}
        for field in schema["columns"]:
            value = get(row, column_no(field["column"]))
            record[field["key"]] = date_time_text(value) if field["type"] == "datetime" else date_text(value) if field["type"] == "date" else value
        if not record.get("title") or not record.get("initiative_lead"):
            raise SourceError("Каждый паспорт требует название и ответственного")
        if "digital_layer" in record:
            levels = schema.get("lists", {}).get("digital_layer", [])
            allowed_levels = set(levels) | {value.split(" ", 1)[0] for value in levels}
            if record["digital_layer"] not in (None, "", "Уточнить уровень") and record["digital_layer"] not in allowed_levels:
                raise SourceError(f"Цифровой уровень {code} требует значение Ц0–Ц5 из справочника")
        raw = str(record.get("sources") or "")
        match = re.search(r"Паспортные метаданные: (\{[^\n]+\})", raw)
        try:
            metadata = strict_json(match[1]) if match else {}
        except ValueError as exc:
            raise SourceError(f"Требуется проверка происхождения {code}") from exc
        finite_tree(metadata)
        configured_location = cfg.get("recordLocations", {}).get(str(row))
        if cfg.get("sourcePartitionPolicy") == "ranges":
            main, idea = cfg.get("actualBlocks", {}).get("initiatives"), cfg.get("actualBlocks", {}).get("ideas")
            match = re.search(r":[A-Z]+(\d+)$", str((main or {}).get("sourceRange", "")))
            count = int(match[1]) - int((main or {}).get("firstDataRow", 0)) + 1 if match else 0
            if not 1 <= count <= 500 or not isinstance(idea, dict):
                raise SourceError("Диапазоны реестра требуют проверку состава")
            boundary = blocks["initiatives"]["firstSourceRow"] + count
            configured_location = {"sheetId": idea["sheetId"], "sheetName": idea["sheetName"], "row": idea["firstDataRow"] + row - boundary} if row >= boundary else None
        if configured_location and metadata.get("primary"):
            raise SourceError(f"Первичная инициатива {code} требует строку основного реестра")
        if configured_location is not None and not isinstance(configured_location, dict):
            raise SourceError(f"Источник {code} требует проверенный лист и строку")
        location = ({"sheet_id": configured_location.get("sheetId"), "sheet": configured_location.get("sheetName"),
                     "row": configured_location.get("row")} if configured_location else
                    {"sheet_id": cfg["masterSheetId"], "sheet": schema["sheet"], "row": row - 4}
                    if "recordLocations" in cfg else metadata.get("source_location"))
        if "recordLocations" in cfg or "source_location" in metadata:
            if (not isinstance(location, dict) or type(location.get("row")) is not int or location["row"] < 3
                    or type(location.get("sheet_id")) is not int or location["sheet_id"] < 0
                    or location["sheet_id"] > 9007199254740991 or location["row"] > 9007199254740991):
                raise SourceError(f"Источник {code} требует проверенный лист и строку")
            record["_source_row"] = location["row"]
            record["_source_sheet_id"] = location["sheet_id"]
            record["_source_sheet"] = str(location.get("sheet") or "")
        else:
            record["_source_sheet_id"] = cfg["masterSheetId"]
            record["_source_sheet"] = schema["sheet"]
        if "ideasSheetId" in cfg:
            record["collection"] = "ideas" if record["_source_sheet_id"] == cfg["ideasSheetId"] else "projects"
        record["provenance"] = {
            "assessment": metadata.get("assessment"),
            "legal_obligations": metadata.get("legal_obligations", []),
            "legal_review": metadata.get("legal_review"),
            "calendar_alignment": metadata.get("calendar_alignment"),
            "origin": "primary" if metadata.get("primary") else "addition",
            "original_title": metadata.get("original_title"),
            "original_code": metadata.get("original_code"),
            "code_is_primary": metadata.get("code_is_primary"),
            "sources": metadata.get("primary_occurrences", []),
            "retired_aliases": metadata.get("aliases") or [],
            "merged_titles": metadata.get("merged_titles") or [],
            "fields": {key: {"origin": "formula" if value.get("kind") == "Расчёт" else "primary" if value.get("kind") in ("Первичный источник", "Три первичных файла") else "addition", "category": value.get("kind"), "source": value.get("reason")} for key, value in metadata.get("fields", {}).items()},
        }
        record["execution_fact"] = normalize_execution_fact(metadata.get("execution_fact"))
        record["candidate_employee"] = display(record.get("initiative_lead") or "Требуется назначение")
        record["business_stage"] = str(record.get("process") or "Требуется привязка").split(" / ")[0]
        additional = re.search(r"Дополнительные участки: ([^\n]+)", raw)
        record["additional_business_stages"] = [v for v in (additional[1] if additional else "").split(", ") if v and v != "Связи уточняет владелец"]
        member = next((s for s in data["staff"] if s["employee"] == record["candidate_employee"]), None)
        record["staff_department"] = member.get("it_group") if member else None
        record["staff_curator"] = member.get("curator") if member else None
        delivery_group = str(record.get("it_group") or "").strip()
        coordinator = next((s for s in data["staff"] if s["it_group"] == delivery_group), None) if delivery_group else member
        if not delivery_group and member:
            record["it_group"] = member["it_group"]
        record["curator"] = display((coordinator.get("curator") if coordinator else None) or "Требуется куратор")
        initiatives.append(record)
    if len(initiatives) < max(minimum_records, cfg.get("sourceLimits", {}).get("expectedRecords", 1)) or len(initiatives) > cfg.get("sourceLimits", {}).get("maximumRecords", 500):
        raise SourceError("Реестр требует проверку полноты состава инициатив")
    retired = set()
    for record in initiatives:
        aliases = record["provenance"]["retired_aliases"]
        if not isinstance(aliases, list):
            raise SourceError("Прежние коды требуют проверенный список")
        for alias in aliases:
            if not isinstance(alias, str) or not re.fullmatch(r"ИТ-[0-9]{3}", alias) or alias in unique or alias in retired:
                raise SourceError("Прежний код закрепляется за одной действующей инициативой")
            retired.add(alias)
    director = next((r["employee"] for r in data["staff"] if re.match(r"^(?:Руководитель (?:отдела|департамента) ИТ|Директор)", str(r["role"]), re.I)), "Сергей Белов")
    result = {
        "schemaVersion": cfg["schemaVersion"], "projectionVersion": PROJECTOR_VERSION, "sourceMode": "google",
        "sourceUrl": f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit#gid={cfg['masterSheetId']}",
        "receivedAt": utc_now(), "asOf": date_text(get(1, 10, "Реестр инициатив")),
        "previousAsOf": date_text(get(2325, 3, "Реестр инициатив")), "snapshotMethod": get(2325, 7, "Реестр инициатив"),
        "pmoCurator": get(2325, 9, "Реестр инициатив"), "portfolioCurator": get(2325, 9, "Реестр инициатив"), "director": director,
        "fileName": "Google Sheets / Портфель инициатив ИТ 2027", "cacheReady": True, "dirty": False,
        "initiatives": initiatives, **data, "schema": schema,
        "provenance": {i["code"]: i["provenance"] for i in initiatives},
        "layoutLocations": cfg.get("actualBlocks", {}),
        "retiredAliasCount": len(retired), "originalRecordCount": len(initiatives) + len(retired),
        "sourceContractHash": json_hash({"config": cfg, "schema": schema, "projector": PROJECTOR_VERSION}),
    }
    # Новые нативные блоки сохраняются вместе с портфелем и доступны калькулятору
    for key in ("productionInputJSON", "productionScenario", "productionInput", "productionInputs", "production_input"):
        if key in blocks:
            b = blocks[key]
            native = get(b["firstSourceRow"], b["firstSourceColumn"], b["sheet"])
            try:
                result["production_input"] = strict_json(native) if isinstance(native, str) else native
                if not isinstance(result["production_input"], dict):
                    raise SourceError("Производственный расчёт требует заполненный объект Google")
                result["productionInput"] = result["production_input"]
                finite_tree(result["production_input"])
            except ValueError as exc:
                raise SourceError("Производственный расчёт требует проверку структуры Google") from exc
    if "annualActualInputJSON" in blocks:
        block = blocks["annualActualInputJSON"]
        native = get(block["firstSourceRow"], block["firstSourceColumn"], block["sheet"])
        try:
            annual = strict_json(native) if isinstance(native, str) else native
            if not isinstance(annual, dict):
                raise SourceError("Годовой расчёт требует заполненный объект Google")
            finite_tree(annual)
            result["annualActualInput"] = annual
        except ValueError as exc:
            raise SourceError("Годовой расчёт требует проверку исходных данных") from exc
    for key, fields in cfg.get("additionalTables", {}).items():
        if key in blocks:
            result[key] = table(key, fields)
    source_tables = {
        "mechanisms": "process metric quantity_base multiplier",
        "basketInput": "kind product baseline_yield target_yield baseline_price target_price packaging_cost other_variable_cost delivery_storage_cost additional_demand_kg source confirmation",
        "basketCalc": "kind product baseline_kg target_kg baseline_revenue target_revenue baseline_variable_cost target_variable_cost delta_contribution additional_kg excess_demand_kg readiness",
        "productionCapacity": "code resource unit baseline_flow target_flow norm resources clean_hours capacity loading source confirmation",
    }
    result["modelTables"] = {}
    existing = set(TABLES) | {"snapshot", "initiatives", "stageDeadlines", "digitalLayers", "previous_meta"}
    for key, block in blocks.items():
        if key not in existing:
            result["modelTables"][key] = {
                "values": [decoded[row - 1][:block["columns"]] for row in range(block["feedFirst"], block["feedLast"] + 1)],
                "sourceSheet": block["sheet"], "sourceRange": block.get("sourceRange"),
            }
        if key in source_tables:
            result[key] = table(key, source_tables[key].split())
    finite_tree(result)
    return result


def source_url(config, signature=None):
    if config.get("spreadsheetId") != SPREADSHEET_ID or config.get("feedSheetId") != FEED_SHEET_ID:
        raise SourceError("Источник должен соответствовать согласованному реестру Google")
    if not re.fullmatch(r"B2:AU[1-9]\d{0,5}", config.get("feedRange", "")):
        raise SourceError("Диапазон потока требует проверенную конфигурацию")
    query = {"gid": FEED_SHEET_ID, "range": config["feedRange"], "headers": 0, "tqx": "out:json" + (f";sig:{signature}" if signature and re.fullmatch(r"[\w-]{1,128}", signature) else "")}
    url = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq?" + urlencode(query)
    if urlsplit(url).hostname != "docs.google.com":
        raise SourceError("Источник требует согласованный адрес Google")
    return url


def parse_response(content: bytes):
    try:
        text = content.decode("utf-8").strip()
        match = re.fullmatch(r"(?:/\*.*?\*/\s*)?google\.visualization\.Query\.setResponse\((.*)\);?", text, flags=re.S)
        if not match:
            raise SourceError("Google Sheets передаёт структуру для повторной проверки")
        response = strict_json(match[1])
        if response.get("status") == "error" and any(e.get("reason") == "not_modified" for e in response.get("errors", [])):
            raise NotModified
        return response
    except (UnicodeError, ValueError, TypeError) as exc:
        if isinstance(exc, SourceError):
            raise
        raise SourceError("Google Sheets передаёт структуру для повторной проверки") from exc


def fetch_response(settings: Settings, config=None, signature=None):
    cfg = config or source_config()
    body = bytearray()
    with httpx.Client(timeout=httpx.Timeout(12), follow_redirects=False) as client:
        with client.stream("GET", source_url(cfg, signature), headers={"Accept": "application/json", "User-Agent": "Severnaya-PMO/10"}) as response:
            response.raise_for_status()
            for chunk in response.iter_bytes():
                body.extend(chunk)
                if len(body) > settings.source_max_bytes:
                    raise SourceError("Источник превышает допустимый объём потока")
    return parse_response(bytes(body))
