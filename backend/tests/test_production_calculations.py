"""Смысловые проверки физического баланса и денежного моста."""
from copy import deepcopy
from math import isclose
import unittest

from app.calculations import InputError, production_case


def case():
    # Производственные значения взяты из факта за январь–июнь 2026.
    # Цены / ставки этого теста – числовая учебная проверка расчётного двигателя.
    return {
        "baseline": {"period": "Январь–июнь 2026", "months": 6,
                     "eggs_set": 72924750, "hatch_rate": .8639415561931991,
                     "chick_reject_rate": .010003377314396034,
                     "placed_chicks": 62372482, "live_heads": 57795460,
                     "live_kg": 140052766, "mortality_rate": .11482073581665633,
                     "fcr": 1.5889472659946222, "slaughter_yield": .80363011316749,
                     "source": "Costing2026_S&W_June.xlsx / O / Q:V", "confirmed": True},
        "routes": [{"code": "whole", "name": "Тушка", "kind": "whole",
                    "baseline_share": .6, "target_share": .6, "confirmed": True},
                   {"code": "cut", "name": "Разделка", "kind": "cut",
                    "baseline_share": .4, "target_share": .4, "confirmed": True}],
        "products": [{"code": "whole", "name": "Тушка", "kind": "sale",
                      "route_yields": {"whole": 1}, "baseline_price": 150,
                      "additional_demand_kg": 200000000, "confirmed": True},
                     {"code": "breast", "name": "Грудка", "kind": "sale",
                      "route_yields": {"cut": .4}, "baseline_price": 240,
                      "additional_demand_kg": 200000000, "confirmed": True},
                     {"code": "other", "name": "Остальные выходы", "kind": "sale",
                      "route_yields": {"cut": .6}, "baseline_price": 130,
                      "additional_demand_kg": 200000000, "confirmed": True}],
        "costs": [{"code": "feed", "name": "Корм", "driver": "feed_kg",
                   "baseline_rate": 23, "confirmed": True},
                  {"code": "chicks", "name": "Цыплята и вакцина", "driver": "placed_chicks",
                   "baseline_rate": 20, "confirmed": True},
                  {"code": "pack", "name": "Упаковка грудки", "driver": "product:breast",
                   "baseline_rate": 15, "confirmed": True}],
        "capacities": [{"code": "line", "name": "Линия", "unit": "кг",
                        "capacity_per_month": 100000000,
                        "baseline_flow_per_meat_kg": 1, "target_flow_per_meat_kg": 1,
                        "confirmed": True}],
        "baseline_fixed_expenses": 1000000, "target_fixed_expenses": 1000000,
        "costs_complete": True, "expenses_confirmed": True,
        "demand_confirmed": True, "capacity_scope_confirmed": True,
    }


class ProductionTests(unittest.TestCase):
    def test_unchanged_case_restores_observed_baseline(self):
        r = production_case(case())
        self.assertAlmostEqual(r["baseline"]["meat_kg"], 112550620.19, places=4)
        self.assertEqual(r["period_delta_ebitda"], 0)
        self.assertEqual(r["approved_delta_ebitda"], 0)
        self.assertEqual(r["baseline_period"], "Январь–июнь 2026")
        self.assertAlmostEqual(r["reconciliation"]["mortality_timing_factor"], 1.0468138657685613)

    def test_one_yield_point_uses_live_mass_once(self):
        x = case(); x["changes"] = {"slaughter_yield_pp": 1}
        r = production_case(x)
        self.assertAlmostEqual(r["target"]["meat_kg"] - r["baseline"]["meat_kg"], 1400527.66, places=4)
        self.assertEqual(r["target"]["live_kg"], r["baseline"]["live_kg"])
        self.assertEqual(r["target"]["feed_kg"], r["baseline"]["feed_kg"])

    def test_feed_efficiency_changes_feed_with_fixed_output(self):
        x = case(); x["changes"] = {"fcr_pct": -1}
        r = production_case(x)
        self.assertEqual(r["target"]["meat_kg"], r["baseline"]["meat_kg"])
        self.assertAlmostEqual(r["period_delta_ebitda"], r["baseline"]["feed_kg"] * .01 * 23, places=4)

    def test_mix_changes_weighted_price_at_same_mass(self):
        x = case(); x["routes"][0]["target_share"] = .4; x["routes"][1]["target_share"] = .6
        r = production_case(x)
        self.assertEqual(r["target"]["sold_kg"], r["baseline"]["sold_kg"])
        self.assertAlmostEqual(r["target"]["average_price"] - r["baseline"]["average_price"], .2 * (174 - 150))
        self.assertAlmostEqual(r["period_delta_ebitda"], r["baseline"]["meat_kg"] * (.2 * 24 - .2 * .4 * 15), places=4)

    def test_price_ruble_changes_revenue_by_sold_kg(self):
        x = case()
        for p in x["products"]:
            p["target_price"] = p["baseline_price"] + 1
        r = production_case(x)
        self.assertAlmostEqual(r["period_delta_ebitda"], r["target"]["sold_kg"], places=4)

    def test_full_bridge_sums_to_delta_with_interactions(self):
        x = case(); x["changes"] = {"mortality_pp": -1, "slaughter_yield_pp": .5, "fcr_pct": -2}
        x["routes"][0]["target_share"] = .3; x["routes"][1]["target_share"] = .7
        x["products"][1]["target_price"] = 245; x["costs"][0]["target_rate"] = 24
        x["target_fixed_expenses"] = 1500000
        r = production_case(x)
        self.assertAlmostEqual(r["bridge_sum"], r["period_delta_ebitda"], places=4)
        self.assertAlmostEqual(r["annual_run_rate_delta"], r["period_delta_ebitda"] * 2, places=4)

    def test_missing_expense_preserves_empty_money(self):
        x = case(); x["costs"][0]["baseline_rate"] = None
        r = production_case(x)
        self.assertIsNone(r["period_delta_ebitda"])
        self.assertIsNone(r["baseline"]["ebitda"])
        self.assertIsNone(r["approved_delta_ebitda"])

    def test_numeric_estimate_has_separate_approval_status(self):
        x = case(); x["expenses_confirmed"] = False; x["changes"] = {"slaughter_yield_pp": .1}
        r = production_case(x)
        self.assertGreater(r["period_delta_ebitda"], 0)
        self.assertIsNone(r["approved_delta_ebitda"])
        self.assertEqual(r["status"], "На согласовании")

    def test_demand_shortfall_blocks_approved_money(self):
        x = case(); x["changes"] = {"slaughter_yield_pp": 1}
        x["products"][1]["additional_demand_kg"] = 0
        r = production_case(x)
        self.assertIsNone(r["approved_delta_ebitda"])
        self.assertGreater(r["demand"][1]["excess_kg"], 0)

    def test_capacity_shortfall_blocks_approved_money(self):
        x = case(); x["capacities"][0]["capacity_per_month"] = 1
        r = production_case(x)
        self.assertIsNone(r["approved_delta_ebitda"])
        self.assertGreater(r["capacities"][0]["target_loading"], 1)

    def test_stock_capacity_uses_peak_stock(self):
        x = case()
        x["capacities"].append({"code": "store", "name": "Холодильный склад", "unit": "кг",
                                "capacity_per_month": 1000, "baseline_flow_per_meat_kg": 0,
                                "target_flow_per_meat_kg": 0, "capacity_basis": "peak_stock",
                                "baseline_peak_stock": 500, "target_peak_stock": 900, "confirmed": True})
        r = production_case(x)
        self.assertEqual(r["capacities"][1]["capacity"], 1000)
        self.assertEqual(r["capacities"][1]["target_loading"], .9)

    def test_recipe_added_mass_preserves_conservation(self):
        x = case(); x["routes"][1]["added_mass_per_kg"] = .1
        x["products"][2]["route_yields"]["cut"] = .7
        r = production_case(x)
        self.assertAlmostEqual(r["baseline"]["sold_kg"], r["baseline"]["meat_kg"] * 1.04, places=4)

    def test_incomplete_coproducts_are_rejected(self):
        x = case(); x["products"][2]["route_yields"]["cut"] = .5
        with self.assertRaises(InputError): production_case(x)

    def test_inactive_route_preserves_empty_inputs(self):
        x = case()
        x["routes"].append({"code": "deep", "name": "Глубокая переработка", "kind": "deep",
                            "baseline_share": 0, "target_share": 0})
        x["costs"].append({"code": "deep", "name": "Расходы глубокой переработки",
                           "driver": "route:deep", "baseline_rate": None})
        self.assertEqual(production_case(x)["period_delta_ebitda"], 0)
        x["routes"][2]["target_share"] = .1; x["routes"][0]["target_share"] = .5
        with self.assertRaises(InputError): production_case(x)

    def test_stock_requires_recognition_calendar(self):
        x = case(); x["products"][2]["kind"] = "stock"; x["products"][2]["baseline_price"] = 0
        r = production_case(x)
        self.assertIsNone(r["period_delta_ebitda"])
        self.assertIn("Календарь запасов", r["confirmation_fields"])

    def test_invalid_units_and_flags_are_rejected(self):
        x = case(); x["costs"][1]["unit"] = "руб/кг"
        with self.assertRaises(InputError): production_case(x)
        x = case(); x["expenses_confirmed"] = "false"
        with self.assertRaises(InputError): production_case(x)

    def test_invalid_numeric_changes_are_rejected(self):
        for changes in ({"fcr_pct": -100}, {"slaughter_yield_pp": 21}, {"mortality_pp": float("nan")}):
            x = case(); x["changes"] = changes
            with self.assertRaises(InputError): production_case(x)

    def test_current_google_price_basket_is_preserved(self):
        # Текущая Google-корзина: март 2026, 1 кг тушки, цены неизменны.
        x = case(); x["baseline"].update(months=1, live_kg=1.25, live_heads=1,
                                        slaughter_yield=.8, source="Калькуляция / март 2026")
        x["routes"][0].update(baseline_share=1, target_share=0)
        x["routes"][1].update(baseline_share=0, target_share=1)
        weights = [1, .39, .42, .069, .01, .031, .08]
        prices = [141.591388333307, 222.775249802277, 164.329787068178,
                  212.818180775812, 46.1015220082531, 83.6344887515027, 43.5216556057538]
        x["products"] = [dict(code=str(i), name=f"Продукт {i}", kind="sale",
                              route_yields={"whole" if i == 0 else "cut": weights[i]},
                              baseline_price=p) for i, p in enumerate(prices)]
        x["costs"] = []; x["costs_complete"] = False
        r = production_case(x)
        self.assertAlmostEqual(r["revenue_delta"], 35.52934095158622, places=9)
        self.assertIsNone(r["period_delta_ebitda"])


class VarianceAndEbitTests(unittest.TestCase):
    def unknown_cost_case(self):
        x = case()
        x.update(costs_complete=False, expenses_confirmed=False,
                 baseline_fixed_expenses=None, target_fixed_expenses=None)
        for c in x["costs"]:
            c.update(baseline_rate=None, target_rate=None, confirmed=False)
        x["incremental_assumptions"] = {key: True for key in ["unknown_rates_unchanged", "unknown_fixed_expenses_unchanged", "unlisted_expenses_unchanged", "price_linked_expenses_unchanged"]}
        return x

    def test_zero_change_preserves_zero_delta_and_empty_absolutes(self):
        r = production_case(self.unknown_cost_case())
        self.assertEqual(r["period_delta_ebitda"], 0)
        self.assertIsNone(r["baseline"]["ebitda"])
        self.assertIsNone(r["target"]["ebitda"])
        self.assertIsNone(r["approved_delta_ebitda"])
        self.assertEqual(r["estimate_basis"], "driver_variance")

    def test_price_one_percent_uses_known_revenue_with_unknown_costs(self):
        x = self.unknown_cost_case()
        for p in x["products"]:
            p["target_price"] = p["baseline_price"] * 1.01
        r = production_case(x)
        self.assertAlmostEqual(r["period_delta_ebitda"], r["baseline"]["revenue"] * .01, places=4)
        self.assertAlmostEqual(r["bridge_residual"], 0, places=6)
        self.assertIsNone(r["baseline"]["ebitda"])
        self.assertIsNone(r["approved_delta_ebitda"])

    def test_yield_one_point_and_unknown_changed_driver_keep_empty_delta(self):
        x = self.unknown_cost_case(); x["changes"] = {"slaughter_yield_pp": 1}
        self.assertIsNone(production_case(x)["period_delta_ebitda"])

    def test_known_changed_rate_uses_expense_variance(self):
        x = self.unknown_cost_case(); x["costs"][0].update(baseline_rate=23, target_rate=24)
        r = production_case(x)
        self.assertAlmostEqual(r["period_delta_ebitda"], -r["baseline"]["feed_kg"], places=4)
        self.assertIsNone(r["approved_delta_ebitda"])

    def test_changed_driver_with_unknown_rate_blocks_complete_cost_delta(self):
        x = case(); x["changes"] = {"slaughter_yield_pp": 1}; x["costs"][2]["baseline_rate"] = None
        r = production_case(x)
        self.assertIsNone(r["period_delta_ebitda"])

    def test_depreciation_unknown_blocks_ebit_only(self):
        r = production_case(case())
        self.assertEqual(r["period_delta_ebitda"], 0)
        self.assertIsNone(r["period_delta_ebit"])
        self.assertIsNone(r["approved_delta_ebit"])

    def test_zero_and_negative_depreciation_keep_signed_delta(self):
        for depreciation, expected in [(0, 0), (-5, 5), (5, -5)]:
            x = case(); x.update(additional_depreciation=depreciation)
            r = production_case(x)
            self.assertEqual(r["period_delta_ebit"], expected)
            self.assertEqual(r["annual_run_rate_delta_ebit"], expected * 2)
            self.assertIsNone(r["approved_delta_ebit"])

    def test_other_period_blocks_ebit_and_retains_ebitda(self):
        x = case(); x.update(additional_depreciation=0, depreciation_period="Январь–декабрь 2026")
        r = production_case(x)
        self.assertEqual(r["period_delta_ebitda"], 0)
        self.assertIsNone(r["period_delta_ebit"])
        self.assertFalse(r["depreciation_period_comparable"])

    def test_confirmed_depreciation_requires_source(self):
        x = case(); x.update(additional_depreciation=0, depreciation_confirmed=True)
        self.assertIsNone(production_case(x)["approved_delta_ebit"])
        x["depreciation_source"] = "Протокол финансовой службы / учебная проверка"
        self.assertEqual(production_case(x)["approved_delta_ebit"], 0)

    def test_invalid_depreciation_and_flags_are_rejected(self):
        for v in [True, float("nan"), float("inf"), "0"]:
            x = case(); x["additional_depreciation"] = v
            with self.assertRaises(InputError): production_case(x)
        x = case(); x["depreciation_confirmed"] = "true"
        with self.assertRaises(InputError): production_case(x)

    def test_missing_explicit_assumptions_preserves_unknown_delta(self):
        x = self.unknown_cost_case(); x.pop("incremental_assumptions")
        self.assertIsNone(production_case(x)["period_delta_ebitda"])
        for key in ["unknown_rates_unchanged", "unknown_fixed_expenses_unchanged", "unlisted_expenses_unchanged", "price_linked_expenses_unchanged"]:
            y = self.unknown_cost_case(); y["incremental_assumptions"][key] = False
            for p in y["products"]:p["target_price"] = p["baseline_price"] * 1.01
            self.assertIsNone(production_case(y)["period_delta_ebitda"])

    def test_assumption_flags_require_booleans(self):
        x = self.unknown_cost_case(); x["incremental_assumptions"]["unknown_rates_unchanged"] = "true"
        with self.assertRaises(InputError):production_case(x)

    def test_unknown_price_keeps_finance_pending_for_known_cost_variance(self):
        x = case(); x["products"][0]["baseline_price"] = None
        x["costs"][0]["target_rate"] = 24
        r = production_case(x)
        self.assertLess(r["period_delta_ebitda"], 0)
        self.assertIsNone(r["approved_delta_ebitda"])
        self.assertIn("Цены конечных продуктов", r["confirmation_fields"])

    def test_native_empty_optional_text_preserves_physics(self):
        x = self.unknown_cost_case(); x.update(depreciation_source="", depreciation_period="  ")
        before = deepcopy(x); r = production_case(x)
        self.assertGreater(r["baseline"]["meat_kg"], 0)
        self.assertEqual(r["period_delta_ebitda"], 0)
        self.assertIsNone(r["period_delta_ebit"])
        self.assertIsNone(r["approved_delta_ebit"])
        self.assertEqual(x, before)

    def test_zero_depreciation_and_empty_source_keep_approval_pending(self):
        x = case(); x.update(additional_depreciation=0, depreciation_source="", depreciation_period="", depreciation_confirmed=True)
        r = production_case(x)
        self.assertEqual(r["period_delta_ebit"], 0)
        self.assertIsNone(r["approved_delta_ebit"])
        self.assertEqual(r["depreciation_period"], x["baseline"]["period"])


if __name__ == "__main__":
    unittest.main()
