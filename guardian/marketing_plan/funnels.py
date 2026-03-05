"""
Воронки конверсии: клиент, охранник, когортное удержание.
"""
from typing import Dict, List, Any


class ConversionFunnels:
    def __init__(self):
        self.funnels = {}

    def client_funnel(self) -> Dict[str, Any]:
        stages = [
            {"name": "visit", "description": "Зашел на сайт/в приложение", "conversion_to_next": 0.4, "cost_per_action": 50},
            {"name": "registration", "description": "Зарегистрировался", "conversion_to_next": 0.3, "cost_per_action": 125},
            {"name": "first_order", "description": "Создал первый заказ", "conversion_to_next": 0.7, "cost_per_action": 178},
            {"name": "payment", "description": "Оплатил заказ", "conversion_to_next": 0.9, "cost_per_action": 198},
            {"name": "repeat_order", "description": "Повторный заказ", "conversion_to_next": 0.6, "cost_per_action": 330},
        ]
        overall = 1.0
        for s in stages:
            overall *= s["conversion_to_next"]
        return {
            "name": "Client Acquisition",
            "stages": stages,
            "overall_conversion": overall,
            "cac": stages[0]["cost_per_action"] / overall if overall else 0,
        }

    def guard_funnel(self) -> Dict[str, Any]:
        stages = [
            {"name": "visit", "conversion": 0.5, "cost": 30},
            {"name": "registration", "conversion": 0.4, "cost": 75},
            {"name": "documents_uploaded", "conversion": 0.8, "cost": 94},
            {"name": "verified", "conversion": 0.6, "cost": 156},
            {"name": "first_order_completed", "conversion": 0.7, "cost": 223},
            {"name": "active_monthly", "conversion": 0.8, "cost": 279},
        ]
        return {"name": "Guard Acquisition", "stages": stages}

    def calculate_cohort_retention(self, cohort_month: int, months: int = 12) -> List[Dict[str, Any]]:
        def rate(m: int) -> float:
            if m == 1:
                return 1.0
            if m == 2:
                return 0.6
            if m == 3:
                return 0.5
            if m <= 6:
                return 0.4
            if m <= 12:
                return 0.3
            return 0.2

        return [
            {"month": m, "retention_rate": rate(m), "active_users": int(1000 * rate(m))}
            for m in range(1, months + 1)
        ]
