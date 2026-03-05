"""
Стратегия к IPO: фазы, метрики, оценка (DCF/comparables), питч для инвесторов.
"""
from datetime import datetime, timedelta
from typing import Dict, Any
import numpy as np


class IPOStrategy:
    def __init__(self):
        self.milestones = []
        self.metrics_targets = {}

    def create_roadmap(self, current_date: datetime) -> Dict[str, Any]:
        return {
            "phase_1": {
                "name": "Product-Market Fit",
                "duration": "6 months",
                "goals": {"users": 100_000, "revenue_mrr": 500_000, "retention_30d": 0.4},
            },
            "phase_2": {
                "name": "Scaling Operations",
                "duration": "12 months",
                "goals": {"users": 1_000_000, "revenue_mrr": 5_000_000, "retention_30d": 0.5, "gross_margin": 0.3},
            },
            "phase_3": {
                "name": "International Expansion",
                "duration": "12 months",
                "goals": {"users": 5_000_000, "revenue_mrr": 25_000_000, "countries": 10},
            },
            "phase_4": {
                "name": "Pre-IPO",
                "duration": "6 months",
                "goals": {"users": 10_000_000, "revenue_arr": 500_000_000, "gross_margin": 0.4, "ebitda_margin": 0.15},
            },
        }

    def calculate_valuation(self, metrics: Dict[str, float]) -> Dict[str, float]:
        dcf = self._dcf(metrics.get("revenue_arr", 0))
        comp = self._comparables(metrics)
        return {"dcf": dcf, "comparables": comp, "average": (dcf + comp) / 2}

    def _dcf(self, revenue_arr: float) -> float:
        if revenue_arr <= 0:
            return 0.0
        cf = revenue_arr * 0.2
        terminal = cf * 1.03 / 0.07
        return cf / 1.1 + terminal / (1.1 ** 5)

    def _comparables(self, metrics: Dict[str, float]) -> float:
        ev_revenue = 3.5
        return (metrics.get("revenue_arr") or 0) * ev_revenue

    def generate_investor_pitch(self) -> Dict[str, Any]:
        return {
            "problem": "Рынок охраны фрагментирован и непрозрачен",
            "solution": "Guardian — платформа с умным подбором и закрытыми ценами",
            "market_size": "TAM $100B, SAM $30B, SOM $10B",
            "business_model": "Комиссия 15–20% с заказа",
            "traction": {"users": "1M+", "guards": "50k+", "revenue": "$50M ARR", "growth": "300% YoY"},
            "competitive_advantage": ["Алгоритм подбора", "Закрытые цены", "Двойная верификация"],
            "use_of_funds": {"product": "30%", "marketing": "40%", "international": "20%", "reserves": "10%"},
        }
