"""Физические ссылки полей сохраняют логическую схему после перестановки."""
import copy
import unittest
from app.config import load_data, source_config
from app.source import source_cell_location


class PhysicalFieldLocations(unittest.TestCase):
    def setUp(self):
        self.cfg = source_config()
        self.schema = load_data("schema.json")
        self.blocks = {b["key"]: b for b in self.cfg["blocks"]}

    def location(self, block, offset, column):
        value = self.blocks[block]
        return source_cell_location(self.cfg, self.schema, value, value["feedFirst"] - 1 + offset, column)

    def test_moved_columns_preserve_primary_and_idea_rows(self):
        self.assertEqual(self.location("initiatives", 0, 3), "Реестр инициатив!H3")
        self.assertEqual(self.location("initiatives", 0, 4), "Реестр инициатив!D3")
        self.assertEqual(self.location("initiatives", 172, 3), "Новые идеи!H3")
        self.assertEqual(self.location("initiatives", 299, 16), "Новые идеи!E130")
        self.assertEqual(self.location("stageDeadlines", 299, 0), "Новые идеи!AY130")
        self.assertEqual(self.location("digitalLayers", 172, 0), "Новые идеи!BD3")
        self.assertEqual(self.location("priorityInputs", 172, 5), "Новые идеи!BJ3")
        self.assertEqual(len(self.schema["columns"]), 58)

    def test_legacy_layout_and_other_transport_blocks_keep_locations(self):
        self.cfg = copy.deepcopy(self.cfg)
        self.cfg.pop("physicalColumns", None)
        self.assertEqual(self.location("initiatives", 0, 3), "Реестр инициатив!E3")
        self.assertEqual(self.location("stageDeadlines", 299, 0), "Новые идеи!AV130")
        self.assertEqual(self.location("resources", 0, 2), "Ресурсы инициатив!D3")
        self.assertEqual(source_cell_location(self.cfg, self.schema, None, 321, 5), "Данные сайта!G323")
