"""Команда внедрения и штатное подразделение сохраняют отдельные назначения."""
import copy
import json
from pathlib import Path
import unittest

from app.config import BASE, Settings, source_config
from app.source import SourceError, fetch_response, project_response


class OwnershipProjection(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = source_config()
        cls.response = fetch_response(Settings("ownership_source_only"), cls.config)
        cls.original = project_response(cls.response, cls.config)

    def scenario(self, group="Автоматика", employee="Калашников Алексей"):
        response = copy.deepcopy(self.response)
        block = next(b for b in self.config["blocks"] if b["key"] == "initiatives")
        row = next(r for r in response["table"]["rows"][block["feedFirst"]-1:block["feedLast"]] if r["c"][0] and r["c"][0].get("v") == "s:ИТ-177")
        row["c"][2] = {"v": "z:" if group is None else "s:" + group}
        row["c"][3] = {"v": "s:" + employee}
        row["c"][37] = {"v": "s:Автоматика: Мулюха Дмитрий / Проектный офис: Калашников Алексей"}
        data = project_response(response, self.config)
        return data, next(i for i in data["initiatives"] if i["code"] == "ИТ-177")

    def test_cross_functional_team_keeps_native_group(self):
        _, card = self.scenario()
        self.assertEqual(card["it_group"], "Автоматика")
        self.assertEqual(card["initiative_lead"], "Калашников Алексей")
        self.assertEqual(card["staff_department"], "Проектный офис")
        self.assertEqual(card["staff_curator"], "Петров Дмитрий")
        self.assertEqual(card["curator"], "Мулюха Дмитрий")
        self.assertEqual(card["team"], "Автоматика: Мулюха Дмитрий / Проектный офис: Калашников Алексей")

    def test_selected_unknown_team_requests_curator(self):
        _, card = self.scenario(group="Совместная команда")
        self.assertEqual(card["it_group"], "Совместная команда")
        self.assertEqual(card["staff_department"], "Проектный офис")
        self.assertEqual(card["curator"], "Требуется куратор")

    def test_empty_group_uses_employee_department(self):
        _, card = self.scenario(group=None)
        self.assertEqual(card["it_group"], "Проектный офис")
        self.assertEqual(card["curator"], "Петров Дмитрий")

    def test_team_curator_survives_employee_question(self):
        _, card = self.scenario(employee="Требуется назначение")
        self.assertEqual(card["it_group"], "Автоматика")
        self.assertEqual(card["curator"], "Мулюха Дмитрий")
        self.assertIsNone(card["staff_department"])
        self.assertIsNone(card["staff_curator"])

    def test_identity_primary_customers_and_finance_survive(self):
        data, _ = self.scenario()
        self.assertEqual(len(data["initiatives"]), len(self.original["initiatives"]))
        retained = ["code", "_source_row", "title", "customer", "digital_layer", "stage", "annual_effect", "gross_2027", "net_2027", "one_off_2027", "run_2027", "sources"]
        original = {i["code"]: i for i in self.original["initiatives"]}
        for card in data["initiatives"]:
            for key in retained:
                self.assertEqual(card[key], original[card["code"]][key], card["code"] + " / " + key)
        self.assertEqual(sum(i["provenance"]["fields"]["customer"]["origin"] == "primary" for i in data["initiatives"]), 99)

    def source_location_case(self, code="ИТ-177", configured=False, legacy=False):
        response, config = copy.deepcopy(self.response), copy.deepcopy(self.config)
        config.pop("sourcePartitionPolicy", None)
        block = next(b for b in config["blocks"] if b["key"] == "initiatives")
        offset, row = next((n, r) for n, r in enumerate(response["table"]["rows"][block["feedFirst"]-1:block["feedLast"]]) if r["c"][0] and r["c"][0].get("v") == "s:" + code)
        import re
        raw = row["c"][44]["v"][2:]
        match = re.search(r"Паспортные метаданные: (\{[^\n]+\})", raw)
        metadata = json.loads(match[1])
        metadata["source_location"] = {"sheet_id": 123 if configured else 807030037, "sheet": "Архив" if configured else "Новые идеи", "row": 99 if configured else 8}
        row["c"][44] = {"v": "s:" + raw.replace(match[1], json.dumps(metadata, ensure_ascii=False))}
        virtual_row = str(block["firstSourceRow"] + offset)
        config.setdefault("recordLocations", {}).pop(virtual_row, None)
        if configured:
            config["recordLocations"][virtual_row] = {"sheetId": 807030037, "sheetName": "Новые идеи", "row": 3}
        if legacy:
            config.pop("recordLocations", None)
        return response, config

    def test_metadata_points_to_actual_idea_sheet(self):
        response, config = self.source_location_case(legacy=True)
        card = next(i for i in project_response(response, config)["initiatives"] if i["code"] == "ИТ-177")
        self.assertEqual(card["_source_sheet_id"], 807030037)
        self.assertEqual(card["_source_row"], 8)
        self.assertEqual(card["_source_sheet"], "Новые идеи")

    def test_promotion_to_main_uses_current_physical_row(self):
        response, config = self.source_location_case()
        config["ideasSheetId"] = 807030037
        card = next(i for i in project_response(response, config)["initiatives"] if i["code"] == "ИТ-177")
        self.assertEqual(card["_source_sheet_id"], config["masterSheetId"])
        self.assertEqual(card["_source_row"], card["_row"] - 4)
        self.assertEqual(card["collection"], "projects")
        self.assertEqual(card["provenance"]["origin"], "addition")

    def test_current_config_coordinate_overrides_archive(self):
        response, config = self.source_location_case(configured=True)
        config["ideasSheetId"] = 807030037
        card = next(i for i in project_response(response, config)["initiatives"] if i["code"] == "ИТ-177")
        self.assertEqual(card["_source_sheet_id"], 807030037)
        self.assertEqual(card["_source_row"], 3)
        self.assertEqual(card["_source_sheet"], "Новые идеи")
        self.assertEqual(card["collection"], "ideas")

    def test_primary_source_keeps_main_sheet(self):
        response, config = self.source_location_case(code="ИТ-001", configured=True)
        with self.assertRaisesRegex(SourceError, "Первичная инициатива ИТ-001"):
            project_response(response, config)

    def test_current_ranges_override_old_metadata(self):
        response, config = self.source_location_case(code="ИТ-129", configured=True)
        config["sourcePartitionPolicy"] = "ranges"
        card = next(i for i in project_response(response, config)["initiatives"] if i["code"] == "ИТ-129")
        original = next(i for i in self.original["initiatives"] if i["code"] == "ИТ-129")
        self.assertEqual(card["_source_sheet_id"], original["_source_sheet_id"])
        self.assertEqual(card["_source_row"], original["_source_row"])


if __name__ == "__main__":
    unittest.main()
