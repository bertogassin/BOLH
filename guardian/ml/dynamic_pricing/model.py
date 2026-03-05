"""
Динамическое ценообразование: базовая цена × срочность × сложность × дефицит охранников.
"""
from datetime import datetime
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class OrderContext:
    location: dict
    start_time: datetime
    required_licenses: List[str]
    budget_min: float
    budget_max: float


class DynamicPricingEngine:
    """Расчёт оптимальной цены по спросу/предложению и контексту заказа."""

    def __init__(self):
        self.supply_demand_ratio = 1.0

    def get_base_price(self, location: dict) -> float:
        """Базовая цена по району (заглушка: можно подгружать из БД/кэша)."""
        return 1500.0

    def get_avg_guards_in_area(self, location: dict) -> int:
        """Среднее число охранников в районе (заглушка)."""
        return 20

    def calculate_optimal_price(
        self,
        order: OrderContext,
        available_guards: List[dict],
        historical_data: Optional[dict] = None,
    ) -> float:
        base = self.get_base_price(order.location)
        hours_until = (order.start_time - datetime.now()).total_seconds() / 3600
        urgency_multiplier = max(1.0, 2.0 - hours_until / 24)
        complexity_multiplier = 1.0 + 0.1 * len(order.required_licenses)
        guard_count = len(available_guards)
        avg_guards = self.get_avg_guards_in_area(order.location)
        scarcity_multiplier = max(1.0, avg_guards / max(1, guard_count))
        optimal = base * urgency_multiplier * complexity_multiplier * scarcity_multiplier
        optimal = max(order.budget_min, min(order.budget_max, optimal))
        return round(optimal / 100) * 100

    def predict_surge_pricing(self, location: dict, time: datetime) -> dict:
        """Предсказание пикового множителя (как Uber)."""
        demand = self._get_demand(location, time)
        supply = self._get_supply(location, time)
        if supply == 0:
            surge_multiplier = 3.0
        else:
            ratio = demand / supply
            surge_multiplier = 1.0 + min(2.0, (ratio - 1.0) * 0.5)
        return {
            "multiplier": surge_multiplier,
            "demand": demand,
            "supply": supply,
            "is_surge": surge_multiplier > 1.2,
        }

    def _get_demand(self, location: dict, time: datetime) -> float:
        return 10.0

    def _get_supply(self, location: dict, time: datetime) -> float:
        return 8.0
