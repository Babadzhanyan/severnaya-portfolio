"""Единый расчёт двух состояний производства и моста денежного результата.

Продолжает расчёт конечной корзины из effect_model/build_basket_model.mjs.
Все массы задаются в кг за исходный период, ставки – в рублях за единицу
драйвера. Доли задаются числами 0..1; изменение процентных пунктов – числом
пунктов, поэтому 1 означает +0,01 к доле. Полная себестоимость, амортизация,
капитальные платежи и перераспределение общих расходов учитываются отдельно.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from math import isclose, isfinite
import re
from typing import Any, Literal, Mapping

TOLERANCE = 1e-8


class InputError(ValueError):
    """Ошибка исходных данных, пригодная для формы расчёта."""


def _number(value: Any, name: str, minimum: float = 0) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise InputError(f"Поле «{name}» требует числовое значение")
    result = float(value)
    if not isfinite(result) or result < minimum:
        raise InputError(f"Поле «{name}» требует значение от {minimum:g}")
    return result


def _signed(value: Any, name: str) -> float:
    return _number(value, name, float("-inf"))


def _fraction(value: Any, name: str, upper: float = 1) -> float:
    result = _number(value, name)
    if result > upper:
        raise InputError(f"Поле «{name}» требует долю от 0 до {upper:g}")
    return result


def _optional(value: Any, name: str) -> float | None:
    return None if value is None else _number(value, name)


@dataclass(frozen=True)
class ProductionBaseline:
    period: str
    months: int
    eggs_set: float
    hatch_rate: float
    chick_reject_rate: float
    placed_chicks: float
    live_heads: float
    live_kg: float
    mortality_rate: float
    fcr: float
    slaughter_yield: float
    feed_kg: float | None = None
    source: str = ""
    confirmed: bool = False


@dataclass(frozen=True)
class OperationalChanges:
    eggs_pct: float = 0
    hatch_pp: float = 0
    chick_reject_pp: float = 0
    mortality_pp: float = 0
    average_weight_pct: float = 0
    fcr_pct: float = 0
    slaughter_yield_pp: float = 0


@dataclass(frozen=True)
class Route:
    code: str
    name: str
    kind: Literal["whole", "cut", "deep"]
    baseline_share: float
    target_share: float
    added_mass_per_kg: float = 0
    target_added_mass_per_kg: float | None = None
    source: str = ""
    confirmed: bool = False


@dataclass(frozen=True)
class Product:
    code: str
    name: str
    kind: Literal["sale", "loss", "stock"]
    route_yields: dict[str, float]
    baseline_price: float | None
    target_price: float | None = None
    target_route_yields: dict[str, float] | None = None
    additional_demand_kg: float | None = None
    source: str = ""
    confirmed: bool = False


@dataclass(frozen=True)
class CostItem:
    code: str
    name: str
    driver: str
    baseline_rate: float | None
    target_rate: float | None = None
    source: str = ""
    confirmed: bool = False
    unit: Literal["руб/кг", "руб/гол"] | None = None


@dataclass(frozen=True)
class Capacity:
    code: str
    name: str
    unit: Literal["кг", "гол", "упак"]
    capacity_per_month: float | None
    baseline_flow_per_meat_kg: float | None
    target_flow_per_meat_kg: float | None
    source: str = ""
    confirmed: bool = False
    capacity_basis: Literal["monthly_flow", "peak_stock"] = "monthly_flow"
    baseline_peak_stock: float | None = None
    target_peak_stock: float | None = None
    target_capacity_per_month: float | None = None


@dataclass(frozen=True)
class ProductionInputs:
    baseline: ProductionBaseline
    changes: OperationalChanges
    routes: list[Route]
    products: list[Product]
    costs: list[CostItem] = field(default_factory=list)
    capacities: list[Capacity] = field(default_factory=list)
    baseline_fixed_expenses: float | None = None
    target_fixed_expenses: float | None = None
    costs_complete: bool = False
    expenses_confirmed: bool = False
    demand_confirmed: bool = False
    capacity_scope_confirmed: bool = False
    price_basis: str = "После исключения НДС и скидок"
    currency: str = "руб"
    sources: dict[str, str] = field(default_factory=dict)
    incremental_assumptions: dict[str, bool] = field(default_factory=dict)
    additional_depreciation: float | None = None
    depreciation_confirmed: bool = False
    depreciation_source: str | None = None
    depreciation_period: str | None = None

    @classmethod
    def from_mapping(cls, data: Mapping[str, Any]) -> ProductionInputs:
        value = dict(data)
        for key in ("depreciation_source", "depreciation_period"):
            if isinstance(value.get(key), str) and not value[key].strip():
                value[key] = None
        try:
            value["baseline"] = ProductionBaseline(**value["baseline"])
            value["changes"] = OperationalChanges(**value.get("changes", {}))
            for key, model in (("routes", Route), ("products", Product),
                               ("costs", CostItem), ("capacities", Capacity)):
                value[key] = [model(**row) for row in value.get(key, [])]
            return cls(**value)
        except (TypeError, KeyError) as exc:
            raise InputError("Структура расчёта требует все обязательные поля") from exc


def _validate(data: ProductionInputs) -> None:
    b = data.baseline
    if not b.period.strip() or not b.source.strip():
        raise InputError("Производственная база требует период и источник")
    if isinstance(b.months, bool) or not isinstance(b.months, int) or not 1 <= b.months <= 12:
        raise InputError("Исходный период требует целое число месяцев от 1 до 12")
    for key in ("eggs_set", "placed_chicks", "live_heads", "live_kg", "fcr"):
        if _number(getattr(b, key), key) <= 0:
            raise InputError(f"Поле «{key}» требует положительное значение")
    for key in ("hatch_rate", "chick_reject_rate", "mortality_rate", "slaughter_yield"):
        _fraction(getattr(b, key), key)
    if b.hatch_rate <= 0 or b.slaughter_yield <= 0 or max(b.chick_reject_rate, b.mortality_rate) >= 1:
        raise InputError("База требует положительные выходы и сохранность")
    if b.feed_kg is not None:
        _number(b.feed_kg, "Корм базы")
    for key, value in asdict(data.changes).items():
        _signed(value, key)
    if data.currency != "руб" or data.price_basis != "После исключения НДС и скидок":
        raise InputError("Расчёт требует рубли и цены после исключения НДС и скидок")
    flags = [b.confirmed, data.costs_complete, data.expenses_confirmed,
             data.demand_confirmed, data.capacity_scope_confirmed, data.depreciation_confirmed]
    flags.extend(row.confirmed for rows in (data.routes, data.products, data.costs, data.capacities)
                 for row in rows)
    if any(type(flag) is not bool for flag in flags):
        raise InputError("Подтверждение требует логическое значение")
    if not data.routes or not data.products:
        raise InputError("Расчёт требует маршруты и конечные продукты")
    for kind, rows in (("маршрута", data.routes), ("продукта", data.products),
                       ("статьи расходов", data.costs), ("мощности", data.capacities)):
        codes = [row.code for row in rows]
        if any(not code.strip() for code in codes) or len(set(codes)) != len(codes):
            raise InputError(f"Код {kind} требует уникальное заполненное значение")
    routes = {row.code for row in data.routes}
    for route in data.routes:
        if route.kind not in ("whole", "cut", "deep"):
            raise InputError("Маршрут требует вид: тушка / разделка / глубокая переработка")
        for key in ("baseline_share", "target_share"):
            _fraction(getattr(route, key), key)
        _number(route.added_mass_per_kg, "Добавочная масса")
        _optional(route.target_added_mass_per_kg, "Добавочная масса цели")
    for key in ("baseline_share", "target_share"):
        if not isclose(sum(getattr(row, key) for row in data.routes), 1, abs_tol=TOLERANCE):
            raise InputError("Доли конечных маршрутов требуют сумму 100%")
    for product in data.products:
        if product.kind not in ("sale", "loss", "stock"):
            raise InputError("Выход требует вид: продажа / потери / запас")
        for mapping in (product.route_yields, product.target_route_yields or {}):
            if set(mapping) - routes:
                raise InputError("Выход продукта содержит код существующего маршрута")
            for value in mapping.values():
                _number(value, "Выход конечного продукта")
        _optional(product.baseline_price, "Цена базы")
        _optional(product.target_price, "Цена цели")
        _optional(product.additional_demand_kg, "Дополнительный спрос")
        if product.kind in ("loss", "stock") and any(
            value not in (None, 0) for value in (product.baseline_price, product.target_price)
        ):
            raise InputError("Потери и запас требуют нулевую выручку текущего периода")
    for target in (False, True):
        for route in data.routes:
            share = route.target_share if target else route.baseline_share
            if share <= TOLERANCE:
                continue
            outgoing = sum((p.target_route_yields or p.route_yields).get(route.code, 0)
                           if target else p.route_yields.get(route.code, 0)
                           for p in data.products)
            added = route.target_added_mass_per_kg if target else route.added_mass_per_kg
            if added is None:
                added = route.added_mass_per_kg
            if not isclose(outgoing, 1 + added, abs_tol=TOLERANCE):
                raise InputError(f"Маршрут «{route.name}» требует все продукты, потери и добавочную массу")
    allowed = {"feed_kg", "placed_chicks", "live_heads", "live_kg", "meat_kg", "sold_kg"}
    allowed.update(f"route:{r.code}" for r in data.routes)
    allowed.update(f"product:{p.code}" for p in data.products)
    for item in data.costs:
        if item.driver not in allowed:
            raise InputError(f"Статья «{item.name}» требует физический драйвер из расчёта")
        _optional(item.baseline_rate, "Ставка расходов базы")
        _optional(item.target_rate, "Ставка расходов цели")
        expected_unit = "руб/гол" if item.driver in ("placed_chicks", "live_heads") else "руб/кг"
        if item.unit is not None and item.unit != expected_unit:
            raise InputError(f"Статья «{item.name}» требует единицу {expected_unit}")
    for cap in data.capacities:
        if cap.unit not in ("кг", "гол", "упак"):
            raise InputError("Мощность требует единицу кг / гол / упак")
        _optional(cap.capacity_per_month, "Мощность за месяц")
        _optional(cap.baseline_flow_per_meat_kg, "Поток мощности базы")
        _optional(cap.target_flow_per_meat_kg, "Поток мощности цели")
        if cap.capacity_basis not in ("monthly_flow", "peak_stock"):
            raise InputError("Мощность требует основу: поток за месяц / пиковый запас")
        _optional(cap.baseline_peak_stock, "Пиковый запас базы")
        _optional(cap.target_peak_stock, "Пиковый запас цели")
        _optional(cap.target_capacity_per_month, "Мощность цели за месяц")
    _optional(data.baseline_fixed_expenses, "Постоянные расходы базы")
    _optional(data.target_fixed_expenses, "Постоянные расходы цели")
    allowed_assumptions = {"unknown_rates_unchanged", "unknown_fixed_expenses_unchanged", "unlisted_expenses_unchanged", "price_linked_expenses_unchanged"}
    if not isinstance(data.incremental_assumptions, dict) or set(data.incremental_assumptions) - allowed_assumptions or any(type(value) is not bool for value in data.incremental_assumptions.values()):
        raise InputError("Предпосылки прироста требуют предусмотренные логические значения")
    if data.additional_depreciation is not None:
        _signed(data.additional_depreciation, "Дополнительная амортизация")
    for value, label in ((data.depreciation_source, "Источник амортизации"),
                         (data.depreciation_period, "Период амортизации")):
        if value is not None and not isinstance(value, str):
            raise InputError(f"Поле «{label}» требует заполненный текст")


def _production_state(b: ProductionBaseline, c: OperationalChanges) -> dict[str, float]:
    hatch = _fraction(b.hatch_rate + c.hatch_pp / 100, "Выводимость цели")
    chick_reject = _fraction(b.chick_reject_rate + c.chick_reject_pp / 100, "Отбраковка цыплят цели")
    mortality = _fraction(b.mortality_rate + c.mortality_pp / 100, "Падёж цели")
    yield_ = _fraction(b.slaughter_yield + c.slaughter_yield_pp / 100, "Выход мяса цели")
    egg_factor = 1 + c.eggs_pct / 100
    weight_factor = 1 + c.average_weight_pct / 100
    fcr_factor = 1 + c.fcr_pct / 100
    if min(egg_factor, weight_factor, fcr_factor) <= 0 or min(hatch, yield_) <= 0:
        raise InputError("Цель требует положительные объёмы, массу, выходы и конверсию корма")
    placement_factor = egg_factor * hatch / b.hatch_rate * (1 - chick_reject) / (1 - b.chick_reject_rate)
    placed = b.placed_chicks * placement_factor
    live_heads = b.live_heads * placement_factor * (1 - mortality) / (1 - b.mortality_rate)
    live_kg = live_heads * (b.live_kg / b.live_heads) * weight_factor
    # Когортный разрыв периода сохраняется в наблюдаемой базе как коэффициент сверки.
    feed_base = b.feed_kg if b.feed_kg is not None else b.live_kg * b.fcr
    feed = feed_base * live_kg / b.live_kg * fcr_factor
    return {
        "eggs_set": b.eggs_set * egg_factor,
        "hatch_rate": hatch,
        "chick_reject_rate": chick_reject,
        "placed_chicks": placed,
        "mortality_rate": mortality,
        "live_heads": live_heads,
        "average_weight_kg": b.live_kg / b.live_heads * weight_factor,
        "live_kg": live_kg,
        "fcr": b.fcr * fcr_factor,
        "feed_kg": feed,
        "slaughter_yield": yield_,
        "meat_kg": live_kg * yield_,
    }


def _basket(data: ProductionInputs, state: dict[str, float], target: bool) -> dict[str, Any]:
    quantities: dict[str, float] = {}
    route_qty = {r.code: state["meat_kg"] * (r.target_share if target else r.baseline_share)
                 for r in data.routes}
    revenues: list[float | None] = []
    for product in data.products:
        yields = (product.target_route_yields or product.route_yields) if target else product.route_yields
        quantity = sum(route_qty[code] * yields.get(code, 0) for code in route_qty)
        quantities[product.code] = quantity
        price = product.target_price if target and product.target_price is not None else product.baseline_price
        revenues.append(0.0 if product.kind != "sale" or quantity == 0
                        else None if price is None else quantity * price)
    sold_kg = sum(quantities[p.code] for p in data.products if p.kind == "sale")
    loss_kg = sum(quantities[p.code] for p in data.products if p.kind == "loss")
    stock_kg = sum(quantities[p.code] for p in data.products if p.kind == "stock")
    drivers = dict(state, sold_kg=sold_kg)
    drivers.update({f"route:{key}": value for key, value in route_qty.items()})
    drivers.update({f"product:{key}": value for key, value in quantities.items()})
    costs: dict[str, float | None] = {}
    for item in data.costs:
        rate = item.target_rate if target and item.target_rate is not None else item.baseline_rate
        quantity = drivers[item.driver]
        costs[item.code] = 0.0 if quantity == 0 else None if rate is None else quantity * rate
    revenue = None if any(v is None for v in revenues) else sum(revenues)
    variable = None if not data.costs_complete or any(v is None for v in costs.values()) else sum(costs.values())
    fixed = data.target_fixed_expenses if target else data.baseline_fixed_expenses
    ebitda = None if revenue is None or variable is None or fixed is None or stock_kg > TOLERANCE else revenue - variable - fixed
    deep = sum(r.target_share if target else r.baseline_share for r in data.routes if r.kind == "deep")
    cut = sum(r.target_share if target else r.baseline_share for r in data.routes if r.kind == "cut")
    return dict(state, route_quantities=route_qty, product_quantities=quantities,
                sold_kg=sold_kg, loss_kg=loss_kg, stock_kg=stock_kg,
                cut_share=cut, deep_share=deep, processing_share=cut + deep,
                revenue=revenue, average_price=None if revenue is None or sold_kg == 0 else revenue / sold_kg,
                variable_expenses=variable, fixed_expenses=fixed, ebitda=ebitda, cost_items=costs)


def _difference(target: float | None, baseline: float | None) -> float | None:
    return None if target is None or baseline is None else target - baseline


def _variance(base_quantity: float, target_quantity: float,
              base_rate: float | None, target_rate: float | None) -> float | None:
    """Одинаковые неизвестные величины сокращаются в разнице состояний."""
    if isclose(base_quantity, target_quantity, rel_tol=1e-12, abs_tol=TOLERANCE) and base_rate == target_rate:
        return 0.0
    base_value = 0.0 if abs(base_quantity) <= TOLERANCE else None if base_rate is None else base_quantity * base_rate
    target_value = 0.0 if abs(target_quantity) <= TOLERANCE else None if target_rate is None else target_quantity * target_rate
    return _difference(target_value, base_value)


def _sum_variances(values: list[float | None]) -> float | None:
    return None if any(value is None for value in values) else sum(values)


def _revenue_variance(data: ProductionInputs, before: dict, after: dict,
                      target_prices: bool = False) -> float | None:
    return _sum_variances([
        _variance(before["product_quantities"][p.code], after["product_quantities"][p.code],
                  p.baseline_price if p.kind == "sale" else 0.0,
                  (p.target_price if target_prices and p.target_price is not None else p.baseline_price) if p.kind == "sale" else 0.0)
        for p in data.products
    ])


def _driver(state: dict, name: str) -> float:
    if name.startswith("route:"):
        return state["route_quantities"][name[6:]]
    if name.startswith("product:"):
        return state["product_quantities"][name[8:]]
    return state[name]


def _physical_unchanged(base: dict, target: dict) -> bool:
    scalars = ["eggs_set", "placed_chicks", "live_heads", "live_kg", "feed_kg", "meat_kg", "sold_kg", "loss_kg", "stock_kg"]
    values = [(base[key], target[key]) for key in scalars]
    values += [(v, target["route_quantities"][k]) for k, v in base["route_quantities"].items()]
    values += [(v, target["product_quantities"][k]) for k, v in base["product_quantities"].items()]
    return all(isclose(b, t, rel_tol=1e-12, abs_tol=TOLERANCE) for b, t in values)


def _expense_variance(data: ProductionInputs, base: dict, target: dict) -> tuple[float | None, list[dict]]:
    items = []
    for item in data.costs:
        target_rate = item.target_rate if item.target_rate is not None else item.baseline_rate
        value = _variance(_driver(base, item.driver), _driver(target, item.driver), item.baseline_rate, target_rate)
        if value == 0 and item.baseline_rate is None and target_rate is None and abs(_driver(base, item.driver)) > TOLERANCE and not data.incremental_assumptions.get("unknown_rates_unchanged", False):
            value = None
        items.append({"code": item.code, "driver": item.driver, "baseline_quantity": _driver(base, item.driver),
                      "target_quantity": _driver(target, item.driver), "baseline_rate": item.baseline_rate,
                      "target_rate": target_rate, "expense_delta": value})
    # Неполный состав затрат разрешает только изменение ставок при том же физическом состоянии.
    if not data.costs_complete and (not _physical_unchanged(base, target) or not data.incremental_assumptions.get("unlisted_expenses_unchanged", False)):
        return None, items
    expense_delta = _sum_variances([item["expense_delta"] for item in items])
    return None if expense_delta is None else -expense_delta, items


def _same_period(first: str, second: str) -> bool:
    normalize = lambda value: re.sub(r"\s+", "", value).replace("—", "–").replace("-", "–").casefold()
    return normalize(first) == normalize(second)


def production_case(inputs: ProductionInputs | Mapping[str, Any]) -> dict[str, Any]:
    """Возвращает физические результаты, прозрачный мост и допуск экономики.

    Исходный период сохраняется в результатах. Годовой темп – экстраполяция
    сопоставимого режима; сроки запуска и освоение учитывает расчёт инициативы.
    """
    data = inputs if isinstance(inputs, ProductionInputs) else ProductionInputs.from_mapping(inputs)
    _validate(data)
    base_state = _production_state(data.baseline, OperationalChanges())
    target_state = _production_state(data.baseline, data.changes)
    base = _basket(data, base_state, False)
    # Состояние между выходом и структурой даёт фиксированный порядок моста.
    after_yield = _basket(data, target_state, False)
    after_mix_data = ProductionInputs(**{**data.__dict__, "products": [
        Product(**{**p.__dict__, "target_price": p.baseline_price}) for p in data.products
    ]})
    after_mix = _basket(after_mix_data, target_state, True)
    target = _basket(data, target_state, True)
    expense_variance, variance_items = _expense_variance(data, base, target)
    fixed_variance = (0.0 if data.incremental_assumptions.get("unknown_fixed_expenses_unchanged", False) else None) if data.baseline_fixed_expenses is None and data.target_fixed_expenses is None else _difference(base["fixed_expenses"], target["fixed_expenses"])
    bridge = [
        {"code": "yield", "name": "Изменение выхода", "rub": _revenue_variance(data, base, after_yield)},
        {"code": "mix", "name": "Изменение структуры продукции", "rub": _revenue_variance(data, after_yield, after_mix)},
        {"code": "price", "name": "Изменение цены", "rub": _revenue_variance(data, after_mix, target, True)},
        {"code": "variable_cost", "name": "Изменение переменных расходов", "rub": expense_variance},
        {"code": "fixed_cost", "name": "Изменение постоянных расходов", "rub": fixed_variance},
    ]
    demand = []
    for p in data.products:
        if p.kind != "sale":
            continue
        additional = max(0.0, target["product_quantities"][p.code] - base["product_quantities"][p.code])
        excess = None if p.additional_demand_kg is None and additional > TOLERANCE else max(0.0, additional - (p.additional_demand_kg or 0))
        demand.append({"code": p.code, "name": p.name, "additional_kg": additional,
                       "demand_kg": p.additional_demand_kg, "excess_kg": excess,
                       "status": "Подтверждено" if data.demand_confirmed and excess is not None and excess <= TOLERANCE else "На согласовании"})
    capacities = []
    for c in data.capacities:
        target_capacity = c.target_capacity_per_month if c.target_capacity_per_month is not None else c.capacity_per_month
        if c.capacity_basis == "peak_stock":
            limit = c.capacity_per_month
            target_limit = target_capacity
            base_load, target_load = c.baseline_peak_stock, c.target_peak_stock
        else:
            limit = None if c.capacity_per_month is None else c.capacity_per_month * data.baseline.months
            target_limit = None if target_capacity is None else target_capacity * data.baseline.months
            base_load = None if c.baseline_flow_per_meat_kg is None else base["meat_kg"] * c.baseline_flow_per_meat_kg
            target_load = None if c.target_flow_per_meat_kg is None else target["meat_kg"] * c.target_flow_per_meat_kg
        fits = limit is not None and target_limit is not None and base_load is not None and target_load is not None and base_load <= limit + TOLERANCE and target_load <= target_limit + TOLERANCE
        capacities.append({"code": c.code, "name": c.name, "unit": c.unit,
                           "capacity": limit, "target_capacity": target_limit, "baseline_load": base_load, "target_load": target_load,
                           "target_loading": None if not target_limit or target_load is None else target_load / target_limit,
                           "status": "Подтверждено" if fits and c.confirmed else "На согласовании"})
    absolute_delta = _difference(target["ebitda"], base["ebitda"])
    if absolute_delta is None and bridge[2]["rub"] not in (None, 0) and not data.incremental_assumptions.get("price_linked_expenses_unchanged", False):
        bridge[3]["rub"] = None
    bridge_sum = _sum_variances([row["rub"] for row in bridge])
    stock_ready = base["stock_kg"] <= TOLERANCE and target["stock_kg"] <= TOLERANCE
    delta = absolute_delta if absolute_delta is not None else bridge_sum if stock_ready else None
    estimate_basis = "absolute_states" if absolute_delta is not None else "driver_variance" if delta is not None else "requires_inputs"

    # Подтверждение конечной экономики отделяет числовую оценку от допуска в портфель.
    gaps = []
    checks = {
        "Производственная база": data.baseline.confirmed,
        "Матрица конечных выходов": all(r.confirmed for r in data.routes) and all(p.confirmed for p in data.products),
        "Цены конечных продуктов": all(p.kind != "sale" or p.baseline_price is not None and (p.target_price if p.target_price is not None else p.baseline_price) is not None or abs(base["product_quantities"][p.code]) <= TOLERANCE and abs(target["product_quantities"][p.code]) <= TOLERANCE for p in data.products),
        "Состав и ставки расходов": data.costs_complete and data.expenses_confirmed and all(c.confirmed and (c.baseline_rate is not None and (c.target_rate if c.target_rate is not None else c.baseline_rate) is not None or abs(_driver(base, c.driver)) <= TOLERANCE and abs(_driver(target, c.driver)) <= TOLERANCE) for c in data.costs),
        "Постоянные расходы": data.expenses_confirmed and data.baseline_fixed_expenses is not None and data.target_fixed_expenses is not None,
        "Спрос конечных продуктов": data.demand_confirmed and all(d["status"] == "Подтверждено" for d in demand),
        "Мощности маршрутов": data.capacity_scope_confirmed and bool(capacities) and all(c["status"] == "Подтверждено" for c in capacities),
        "Календарь запасов": base["stock_kg"] <= TOLERANCE and target["stock_kg"] <= TOLERANCE,
        "Денежный расчёт": delta is not None,
    }
    for label, ready in checks.items():
        if not ready:
            gaps.append(label)
    approved = delta if not gaps else None
    annual_factor = 12 / data.baseline.months
    depreciation_period = data.depreciation_period or data.baseline.period
    period_comparable = _same_period(depreciation_period, data.baseline.period)
    delta_ebit = None if delta is None or data.additional_depreciation is None or not period_comparable else delta - data.additional_depreciation
    ebit_gaps = []
    for label, ready in {
        "Оценка EBITDA": delta is not None,
        "Дополнительная амортизация": data.additional_depreciation is not None,
        "Сопоставимый период амортизации": period_comparable,
        "Финансовое согласование EBITDA": approved is not None,
        "Финансовое согласование амортизации": data.depreciation_confirmed and bool(data.depreciation_source and data.depreciation_source.strip()),
    }.items():
        if not ready:
            ebit_gaps.append(label)
    approved_ebit = delta_ebit if not ebit_gaps else None
    return {
        "baseline_period": data.baseline.period, "months": data.baseline.months,
        "unit": "руб за исходный период", "annual_unit": "руб за год выбранного режима",
        "price_basis": data.price_basis, "sources": {"production": data.baseline.source, **data.sources},
        "baseline": base, "target": target, "bridge": bridge,
        "bridge_sum": bridge_sum, "bridge_residual": _difference(delta, bridge_sum),
        "revenue_delta": _difference(target["revenue"], base["revenue"]),
        "period_delta_ebitda": delta,
        "estimate_status": "Оценка рассчитана" if delta is not None else "Требуется расчёт",
        "incremental_assumptions": data.incremental_assumptions,
        "estimate_basis": estimate_basis, "absolute_ebitda_complete": absolute_delta is not None,
        "expense_variance_items": variance_items,
        "additional_depreciation": data.additional_depreciation,
        "depreciation_period": depreciation_period, "depreciation_period_comparable": period_comparable,
        "period_delta_ebit": delta_ebit,
        "annual_run_rate_delta_ebit": None if delta_ebit is None else delta_ebit * annual_factor,
        "approved_delta_ebit": approved_ebit,
        "approved_annual_run_rate_delta_ebit": None if approved_ebit is None else approved_ebit * annual_factor,
        "ebit_status": "Подтверждено" if approved_ebit is not None else "Оценка рассчитана" if delta_ebit is not None else "Требуется расчёт EBIT",
        "ebit_confirmation_fields": ebit_gaps,
        "annual_run_rate_delta": None if delta is None else delta * annual_factor,
        "approved_delta_ebitda": approved,
        "approved_annual_run_rate_delta": None if approved is None else approved * annual_factor,
        "status": "Подтверждено" if not gaps else "На согласовании",
        "confirmation_fields": gaps, "demand": demand, "capacities": capacities,
        "reconciliation": {
            "placement_timing_factor": data.baseline.placed_chicks / (data.baseline.eggs_set * data.baseline.hatch_rate * (1 - data.baseline.chick_reject_rate)),
            "mortality_timing_factor": data.baseline.live_heads / (data.baseline.placed_chicks * (1 - data.baseline.mortality_rate)),
            "feed_timing_factor": (data.baseline.feed_kg if data.baseline.feed_kg is not None else data.baseline.live_kg * data.baseline.fcr) / (data.baseline.live_kg * data.baseline.fcr),
            "feed_basis": "Наблюдаемый расход" if data.baseline.feed_kg is not None else "Расчётная потребность по конверсии корма",
            "method": "Наблюдаемая база × относительное изменение операционных факторов",
        },
    }
