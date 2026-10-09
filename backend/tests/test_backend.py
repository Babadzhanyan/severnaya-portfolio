"""Интеграционная проверка настоящей PostgreSQL и атомарной синхронизации."""
import copy
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch
from uuid import uuid4

import psycopg
from psycopg import sql
from psycopg.conninfo import make_conninfo
from fastapi.testclient import TestClient

from app.config import BASE, Settings, load_data, source_config
from app.database import Database
from app.main import create_app
from app.source import SourceError, date_text, date_time_text, decode_value, fetch_response, project_response, source_url
from app.sync import sync_once


@unittest.skipUnless(os.environ.get("PMO_TEST_DATABASE_URL"), "PMO_TEST_DATABASE_URL задаёт настоящую PostgreSQL")
class PostgreSQLIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base_dsn = os.environ["PMO_TEST_DATABASE_URL"]
        cls.namespace = "pmo_test_" + uuid4().hex[:12]
        with psycopg.connect(cls.base_dsn) as conn:
            conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(cls.namespace)))
        cls.dsn = make_conninfo(cls.base_dsn, options="-c search_path=" + cls.namespace)
        cls.settings = Settings(cls.dsn)
        cls.database = Database(cls.dsn)
        cls.database.initialize()
        cls.config = source_config()
        cls.response = fetch_response(cls.settings, cls.config)
        cls.portfolio = project_response(cls.response, cls.config)
        (BASE / "work").mkdir(exist_ok=True)
        (BASE / "work" / "latest_response.json").write_text(json.dumps(cls.response, ensure_ascii=False))
        (BASE / "work" / "latest_config.json").write_text(json.dumps(cls.config, ensure_ascii=False))

    @classmethod
    def tearDownClass(cls):
        with psycopg.connect(cls.base_dsn) as conn:
            conn.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(cls.namespace)))

    def setUp(self):
        with self.database.connect() as conn:
            conn.execute("DELETE FROM initiatives")
            conn.execute("UPDATE current_snapshot SET version_id=NULL,checked_at=NULL,last_attempt_at=NULL,source_status='waiting',last_error=NULL")
            conn.execute("DELETE FROM versions")
        self.fetch = lambda settings, config, signature: copy.deepcopy(self.response)
        with patch("app.sync.source_config", return_value=self.config):
            result = sync_once(self.database, self.settings, fetcher=self.fetch)
        self.assertEqual(result["state"], "updated")
        self.saved = self.database.read()

    def invalid_sync(self, response):
        fetch = lambda settings, config, signature: response
        with patch("app.sync.source_config", return_value=self.config):
            result = sync_once(self.database, self.settings, fetcher=fetch)
        self.assertEqual(result["state"], "error")
        current = self.database.read()
        self.assertEqual(current["source_hash"], self.saved["source_hash"])
        self.assertEqual(current["snapshot"], self.saved["snapshot"])
        with self.database.connect() as conn:
            self.assertEqual(conn.execute("SELECT count(*) AS n FROM versions").fetchone()["n"], 1)
            self.assertEqual(conn.execute("SELECT count(*) AS n FROM initiatives").fetchone()["n"], len(self.portfolio["initiatives"]))

    def test_real_google_and_unique_postgresql_records(self):
        self.assertGreaterEqual(len(self.portfolio["initiatives"]), 195)
        self.assertEqual(len(self.portfolio["schema"]["columns"]), self.config["masterColumns"])
        with self.database.connect() as conn:
            actual = conn.execute("SELECT count(*) AS n,count(DISTINCT code) AS unique_codes FROM initiatives").fetchone()
        self.assertEqual(actual["n"], actual["unique_codes"])

    def test_digital_layer_public_snapshot_and_stable_identity(self):
        self.assertEqual(self.config["masterColumns"], 58)
        self.assertEqual(len(self.portfolio["schema"]["columns"]), 58)
        levels = self.portfolio["schema"]["lists"]["digital_layer"]
        self.assertEqual(len(levels), 6)
        identities = {i["code"]: (i["_source_row"], i["provenance"]["retired_aliases"]) for i in self.portfolio["initiatives"]}
        previous = load_data("identity_baseline_v10.json")
        self.assertEqual(set(identities) - set(previous), {"ИТ-129", "ИТ-209", "ИТ-210", "ИТ-211", "ИТ-212"})
        self.assertTrue(set(previous) <= set(identities))
        self.assertEqual({code: aliases for code, (_, aliases) in identities.items() if code in previous and code != "ИТ-127"},
                         {code: row["retired_aliases"] for code, row in previous.items() if code != "ИТ-127"})
        self.assertEqual(identities["ИТ-127"][1], [])
        for card in self.portfolio["initiatives"]:
            actual = self.config["actualBlocks"]
            main = actual["initiatives"]
            main_count = int(main["sourceRange"].split(":")[-1].lstrip("ABCDEFGHIJKLMNOPQRSTUVWXYZ")) - main["firstDataRow"] + 1
            first = next(b["firstSourceRow"] for b in self.config["blocks"] if b["key"] == "initiatives")
            idea = card["_row"] >= first + main_count
            source = actual["ideas"] if idea else main
            expected_row = source["firstDataRow"] + card["_row"] - first - (main_count if idea else 0)
            expected_sheet = source["sheetId"]
            self.assertEqual(card["_source_row"], expected_row, card["code"])
            self.assertEqual(card["_source_sheet_id"], expected_sheet, card["code"])
        with TestClient(create_app(self.settings, background_sync=False)) as client:
            published = client.get("/api/portfolio").json()["portfolio"]
        self.assertEqual(published["schemaVersion"], 12)
        self.assertEqual({i["code"]: (i["_source_row"], i["provenance"]["retired_aliases"]) for i in published["initiatives"]}, identities)
        self.assertTrue(all(i.get("digital_layer") in levels for i in published["initiatives"]))
        projects = [i for i in published["initiatives"] if i.get("collection") == "projects"]
        ideas = [i for i in published["initiatives"] if i.get("collection") == "ideas"]
        self.assertEqual(len(projects), 172)
        self.assertEqual(len(ideas), 28)
        self.assertEqual(sum(i["execution_fact"]["state"] == "completed" for i in projects), 52)
        self.assertEqual(sum(i["execution_fact"]["state"] == "in_progress" for i in projects), 50)
        self.assertTrue(all(i["stage"] == "L4 Реализация" for i in projects if i["execution_fact"]["state"] in {"completed", "in_progress"}))
        self.assertTrue(all(i["stage"] == "L0 Входящие предложения" for i in ideas))
        self.assertEqual(sum(len(i["provenance"]["retired_aliases"]) for i in published["initiatives"]), 12)

    def test_assessment_and_legal_links_survive_projection(self):
        cards = self.portfolio["initiatives"]
        self.assertEqual(len(cards), 200)
        self.assertEqual(sum(isinstance(i["provenance"]["assessment"], dict) for i in cards), 200)
        self.assertEqual(sum(bool(i["provenance"]["legal_obligations"]) for i in cards), 58)
        self.assertEqual(sum(len(i["provenance"]["legal_obligations"]) for i in cards), 95)
        self.assertTrue(all(i["provenance"]["legal_review"] for i in cards if i["provenance"]["legal_obligations"]))
        self.assertTrue(all(i["action_due"] == "2026-10-13T18:00:00+03:00" for i in cards))

    def test_calendar_alignment_keeps_source_precision(self):
        response = copy.deepcopy(self.response)
        block = next(b for b in self.config["blocks"] if b["key"] == "initiatives")
        row = next(r for r in response["table"]["rows"][block["feedFirst"] - 1:block["feedLast"]]
                   if r["c"][0] and r["c"][0].get("v") == "s:ИТ-001")
        raw = row["c"][44]["v"][2:]
        import re
        match = re.search(r"Паспортные метаданные: (\{[^\n]+\})", raw)
        metadata = json.loads(match[1])
        calendar = {"source_deadline_raw":"09.2026", "precision":"month", "technical_date":"2026-09-01", "precedes_jan1":True}
        metadata["calendar_alignment"] = calendar
        row["c"][44] = {"v":"s:" + raw.replace(match[1], json.dumps(metadata, ensure_ascii=False))}
        card = next(i for i in project_response(response, self.config)["initiatives"] if i["code"] == "ИТ-001")
        self.assertEqual(card["provenance"]["calendar_alignment"], calendar)

    def test_missing_digital_block_preserves_last_good(self):
        config = copy.deepcopy(self.config)
        config["blocks"] = [b for b in config["blocks"] if b["key"] != "digitalLayers"]
        with self.assertRaises(SourceError):
            project_response(self.response, config)

    def test_missing_priority_block_preserves_last_good(self):
        config = copy.deepcopy(self.config)
        config["blocks"] = [b for b in config["blocks"] if b["key"] != "priorityInputs"]
        with patch("app.sync.source_config", return_value=config):
            result = sync_once(self.database, self.settings, fetcher=self.fetch)
        self.assertEqual(result["state"], "error")
        self.assertEqual(self.database.read()["snapshot"], self.saved["snapshot"])

    def test_missing_annual_case_preserves_last_good(self):
        config = copy.deepcopy(self.config)
        config["blocks"] = [b for b in config["blocks"] if b["key"] != "annualActualInputJSON"]
        with patch("app.sync.source_config", return_value=config):
            result = sync_once(self.database, self.settings, fetcher=self.fetch)
        self.assertEqual(result["state"], "error")
        self.assertEqual(self.database.read()["snapshot"], self.saved["snapshot"])

    def test_invalid_digital_layer_preserves_last_good(self):
        response = copy.deepcopy(self.response)
        block = next(b for b in self.config["blocks"] if b["key"] == "digitalLayers")
        response["table"]["rows"][block["feedFirst"] - 1]["c"][0] = {"v": "s:L2 Оценка"}
        self.invalid_sync(response)

    def test_partial_source_preserves_last_good(self):
        response = copy.deepcopy(self.response)
        response["table"]["rows"].pop()
        self.invalid_sync(response)

    def test_duplicate_code_preserves_last_good(self):
        response = copy.deepcopy(self.response)
        block = next(b for b in self.config["blocks"] if b["key"] == "initiatives")
        valid = [r for r in response["table"]["rows"][block["feedFirst"] - 1:block["feedLast"]] if r["c"][0] and r["c"][0].get("v", "").startswith("s:ИТ-")]
        valid[1]["c"][0] = copy.deepcopy(valid[0]["c"][0])
        self.invalid_sync(response)

    def test_error_cell_preserves_last_good(self):
        response = copy.deepcopy(self.response)
        response["table"]["rows"][1]["c"][2] = {"v": "e:#REF!"}
        self.invalid_sync(response)

    def test_nonfinite_cell_preserves_last_good(self):
        response = copy.deepcopy(self.response)
        response["table"]["rows"][1]["c"][6] = {"v": "n:1e309"}
        self.invalid_sync(response)

    def test_missing_master_title_preserves_last_good(self):
        response = copy.deepcopy(self.response)
        response["table"]["rows"][1]["c"][1] = {"v": "z:"}
        self.invalid_sync(response)

    def test_hash_repeat_creates_one_version(self):
        with patch("app.sync.source_config", return_value=self.config):
            result = sync_once(self.database, self.settings, fetcher=self.fetch)
        self.assertEqual(result["state"], "unchanged")
        with self.database.connect() as conn:
            self.assertEqual(conn.execute("SELECT count(*) AS n FROM versions").fetchone()["n"], 1)

    def test_error_status_changes_etag_and_keeps_data(self):
        with TestClient(create_app(self.settings, background_sync=False)) as client:
            saved = client.get("/api/portfolio")
            self.database.error("Источник требует проверки")
            current = client.get("/api/portfolio", headers={"If-None-Match": saved.headers["etag"]})
            self.assertEqual(current.status_code, 200)
            self.assertEqual(current.json()["source_status"]["state"], "error")
            self.assertEqual(current.json()["portfolio"], saved.json()["portfolio"])

    def test_transaction_rollback_keeps_pointer_and_rows(self):
        broken = copy.deepcopy(self.portfolio)
        broken["initiatives"][1]["code"] = broken["initiatives"][0]["code"]
        with self.assertRaises(psycopg.errors.UniqueViolation):
            self.database.save(broken, "a" * 64, "bad-fixture")
        current = self.database.read()
        self.assertEqual(current["source_hash"], self.saved["source_hash"])
        with self.database.connect() as conn:
            self.assertEqual(conn.execute("SELECT count(*) AS n FROM versions").fetchone()["n"], 1)

    def test_api_and_new_instance_restore_saved_data(self):
        with TestClient(create_app(self.settings, background_sync=False)) as client:
            response = client.get("/api/portfolio")
            self.assertEqual(response.status_code, 200)
            wrapper = response.json()
            self.assertEqual(wrapper["source_status"]["source_hash"], self.saved["source_hash"])
            self.assertEqual(wrapper["portfolio"]["initiatives"], self.saved["snapshot"]["initiatives"])
            self.assertEqual(client.get("/api/portfolio", headers={"If-None-Match": response.headers["etag"]}).status_code, 304)
            self.assertEqual(client.get("/api/health").json()["database"], "PostgreSQL")
        with TestClient(create_app(self.settings, background_sync=False)) as restarted:
            self.assertEqual(restarted.get("/api/portfolio").json()["source_status"]["source_hash"], self.saved["source_hash"])

    def test_cors_exact_origin(self):
        with TestClient(create_app(self.settings, background_sync=False)) as client:
            accepted = client.get("/api/health", headers={"Origin": "https://babadzhanyan.github.io"})
            self.assertEqual(accepted.headers["access-control-allow-origin"], "https://babadzhanyan.github.io")
            rejected = client.get("/api/health", headers={"Origin": "https://example.net"})
            self.assertNotIn("access-control-allow-origin", rejected.headers)

    def test_calculator_valid_and_unknown_approval(self):
        expected = load_data("production_example_result.json")
        with TestClient(create_app(self.settings, background_sync=False)) as client:
            response = client.post("/api/calculations/production", json=load_data("production_example.json"))
            self.assertEqual(response.status_code, 200)
            actual = response.json()
            self.assertAlmostEqual(actual["period_delta_ebitda"], expected["period_delta_ebitda"], places=4)
            self.assertIsNone(actual["approved_delta_ebitda"])
            self.assertIsNone(actual["approved_annual_run_rate_delta"])
            catalog = client.get("/api/calculators/source").json()
            self.assertIn("production_input", catalog["source_inputs"])
            self.assertIn("schema", catalog)
            self.assertIn("example", catalog)
            self.assertEqual(catalog["source_inputs"]["source_metadata"]["source_pdf_pages"], 17)
            if self.portfolio.get("production_input"):
                self.assertEqual(catalog["production_input"], self.portfolio["production_input"])
                self.assertEqual(catalog["source_mode"], "google")

    def test_calculator_bad_type_nonfinite_and_bounds(self):
        with TestClient(create_app(self.settings, background_sync=False)) as client:
            for body in (b'[]', b'{"baseline":null}', b'{"value":NaN}', b'{"value":Infinity}', b'{"value":1e309}'):
                response = client.post("/api/calculations/production", content=body, headers={"Content-Type": "application/json"})
                self.assertEqual(response.status_code, 422)
            deep = b'{"nested":' + b'[' * 1500 + b'0' + b']' * 1500 + b'}'
            self.assertEqual(client.post("/api/calculations/production", content=deep, headers={"Content-Type": "application/json"}).status_code, 422)
            wrong = load_data("production_example.json")
            wrong["baseline"]["period"] = 9
            self.assertEqual(client.post("/api/calculations/production", json=wrong).status_code, 422)
            large = b'{"source":"' + b'a' * (256 * 1024) + b'"}'
            self.assertEqual(client.post("/api/calculations/production", content=large, headers={"Content-Type": "application/json"}).status_code, 413)
            self.assertEqual(client.post("/api/calculations/production", content="{}").status_code, 415)


class DecoderChecks(unittest.TestCase):
    def test_localized_number_and_empty_value(self):
        self.assertEqual(decode_value({"v": "n:46 299,"}), 46299)
        self.assertIsNone(decode_value({"v": "z:"}))
        self.assertFalse(decode_value({"v": "b:0"}))

    def test_date_serial_with_time_preserves_day(self):
        self.assertEqual(date_text(46299.75), "2026-10-04")

    def test_deadline_serial_preserves_moscow_time(self):
        self.assertEqual(date_time_text(46308.75), "2026-10-13T18:00:00+03:00")
        self.assertEqual(date_time_text("2026-10-13T18:00:00"), "2026-10-13T18:00:00+03:00")
        self.assertEqual(date_time_text("2026-10-13T15:00:00Z"), "2026-10-13T15:00:00Z")

    def test_arbitrary_source_rejected(self):
        config = source_config()
        config["spreadsheetId"] = "foreign"
        with self.assertRaises(SourceError):
            source_url(config)


if __name__ == "__main__":
    unittest.main()
