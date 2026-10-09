"""Факт внедрения сохраняет стадию, исходную дату и отдельный финансовый допуск."""
import copy
import json
import re
import unittest

from app.config import BASE, Settings, source_config
from app.source import SourceError, fetch_response, normalize_execution_fact, project_response


class ExecutionProjection(unittest.TestCase):
    def test_month_precision_keeps_original_and_normalizes_position(self):
        fact = {"state": "completed", "audited": True, "scope_complete": True,
                "actual_finish": "2026-09", "actual_finish_precision": "month",
                "actual_finish_raw": "09.2026", "financial_effect_confirmed": False}
        result = normalize_execution_fact(fact)
        self.assertEqual(result["actual_finish"], "2026-09-01")
        self.assertEqual(result["actual_finish_raw"], "09.2026")
        self.assertFalse(result["financial_effect_confirmed"])
        self.assertEqual(fact["actual_finish"], "2026-09")

    def test_incomplete_and_invalid_dates_keep_source_pending(self):
        for fact in [{"state": "completed", "audited": False, "scope_complete": True},
                     {"state": "completed", "audited": True, "scope_complete": False},
                     {"state": "completed", "audited": True, "scope_complete": True,
                      "actual_finish": "2026-02-31", "actual_finish_precision": "day"}]:
            with self.assertRaises(SourceError):
                normalize_execution_fact(fact)

    def test_planned_month_keeps_source_precision(self):
        fact = {"state": "in_progress", "audited": True, "scope_complete": True,
                "planned_end": {"value": "2026-09", "precision": "month", "raw": "09.2026", "source": "Описание!I21"}}
        result = normalize_execution_fact(fact)
        self.assertEqual(result["planned_end"]["value"], "2026-09")
        self.assertEqual(result["planned_end"]["precision"], "month")
        with self.assertRaises(SourceError):
            normalize_execution_fact({**fact, "planned_end": {"value": "2026-13", "precision": "month"}})

    def test_full_projection_preserves_source_stage_and_finance(self):
        cfg = source_config()
        response = fetch_response(Settings("execution_source_only"), cfg)
        block = next(b for b in cfg["blocks"] if b["key"] == "initiatives")
        row = next(r for r in response["table"]["rows"][block["feedFirst"] - 1:block["feedLast"]]
                   if r["c"][0] and r["c"][0].get("v") == "s:ИТ-106")
        before = project_response(copy.deepcopy(response), cfg)
        raw = row["c"][44]["v"][2:]
        match = re.search(r"Паспортные метаданные: (\{[^\n]+\})", raw)
        metadata = json.loads(match[1])
        metadata["execution_fact"] = {"state": "completed", "work_status": "Выполнено",
            "audited": True, "scope_complete": True, "actual_finish": "2026-09",
            "actual_finish_precision": "month", "actual_finish_raw": "09.2026",
            "basis": "user_confirmation", "source_status": "В работе", "financial_effect_confirmed": False}
        row["c"][44] = {"v": "s:" + raw.replace(match[1], json.dumps(metadata, ensure_ascii=False))}
        row["c"][4] = {"v": "s:L4 Реализация"}
        result = project_response(response, cfg)
        card = next(i for i in result["initiatives"] if i["code"] == "ИТ-106")
        original = next(i for i in before["initiatives"] if i["code"] == "ИТ-106")
        self.assertEqual(card["stage"], "L4 Реализация")
        self.assertEqual(card["execution_fact"]["source_status"], "В работе")
        self.assertEqual(card["execution_fact"]["actual_finish"], "2026-09-01")
        for field in ["title", "initiative_lead", "customer", "annual_effect", "finance_status", "_source_row", "_source_sheet_id"]:
            self.assertEqual(card[field], original[field])
        self.assertEqual(len(result["initiatives"]), len(before["initiatives"]))


if __name__ == "__main__":
    unittest.main()
