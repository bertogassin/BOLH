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
        """
        Базовая цена по району.
        Поддерживает:
        - `location["zone_tier"]` -> premium | business | standard | suburban
        - fallback по координатам (`lat/lon`) для офлайн-режима.
        """
        zone_tier = str(location.get("zone_tier", "")).lower()
        by_tier = {
            "premium": 2400.0,
            "business": 2000.0,
            "standard": 1600.0,
            "suburban": 1300.0,
        }
        if zone_tier in by_tier:
            return by_tier[zone_tier]

        lat = float(location.get("lat", location.get("latitude", 0.0)))
        lon = float(location.get("lon", location.get("longitude", 0.0)))
        # Грубая гео-эвристика: ближе к центру города -> выше базовая ставка.
        city_center_lat, city_center_lon = 55.7558, 37.6173
        dist = abs(lat - city_center_lat) + abs(lon - city_center_lon)
        if dist < 0.03:
            return 2200.0
        if dist < 0.08:
            return 1800.0
        if dist < 0.2:
            return 1500.0
        return 1300.0

    def get_avg_guards_in_area(self, location: dict) -> int:
        """
        Среднее число охранников в районе.
        Если API уже передал `avg_guards_in_area`, используем его.
        Иначе — вычисляем по уровню зоны.
        """
        explicit = location.get("avg_guards_in_area")
        if explicit is not None:
            try:
                return max(1, int(explicit))
            except (TypeError, ValueError):
                pass

        zone_tier = str(location.get("zone_tier", "")).lower()
        default_by_tier = {
            "premium": 12,
            "business": 18,
            "standard": 26,
            "suburban": 32,
        }
        return default_by_tier.get(zone_tier, 20)

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
