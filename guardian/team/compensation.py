"""
Система оплаты и мотивации: вилки окладов, бонус по KPI, опционы.
"""
from typing import Dict, Any


class CompensationSystem:
    def __init__(self):
        self.salary_bands = {
            "entry": {"min": 50000, "mid": 70000, "max": 90000},
            "mid": {"min": 90000, "mid": 120000, "max": 150000},
            "senior": {"min": 150000, "mid": 180000, "max": 220000},
            "lead": {"min": 200000, "mid": 250000, "max": 300000},
            "director": {"min": 250000, "mid": 300000, "max": 400000},
            "executive": {"min": 300000, "mid": 400000, "max": 500000},
        }
        self.equity_pool = 0.15
        self._equity_grants = {
            "entry": {"shares": 5000, "vesting": "4 years, 1 year cliff", "value_at_ipo": 50000},
            "mid": {"shares": 15000, "vesting": "4 years, 1 year cliff", "value_at_ipo": 150000},
            "senior": {"shares": 30000, "vesting": "4 years, 1 year cliff", "value_at_ipo": 300000},
            "lead": {"shares": 50000, "vesting": "4 years, 1 year cliff", "value_at_ipo": 500000},
            "director": {"shares": 100000, "vesting": "4 years, 1 year cliff", "value_at_ipo": 1000000},
        }

    def get_base_salary(self, role: str, level: str, location: str) -> float:
        band = self.salary_bands.get(level, self.salary_bands["entry"])
        return band["mid"]

    def get_bonus_target(self, level: str) -> float:
        return 0.15 if level in ("entry", "mid") else 0.20

    def calculate_bonus_multiplier(self, performance: Dict[str, float]) -> float:
        weights = {"company_okrs": 0.3, "team_okrs": 0.3, "individual_okrs": 0.4}
        score = sum(performance.get(k, 0) * w for k, w in weights.items())
        return min(2.0, max(0.5, 0.5 + score * 1.5))

    def get_equity_grant(self, role: str, level: str) -> Dict[str, Any]:
        return self._equity_grants.get(level, self._equity_grants["entry"])

    def calculate_equity_value(self, equity: Dict[str, Any]) -> float:
        return equity.get("value_at_ipo", 0)

    def get_benefits_package(self, location: str) -> Dict[str, Any]:
        return {"health": 5000, "other": 2000, "total_value": 7000}

    def calculate_compensation(
        self,
        role: str,
        level: str,
        location: str,
        performance: Dict[str, float],
    ) -> Dict[str, Any]:
        base = self.get_base_salary(role, level, location)
        bonus_target = self.get_bonus_target(level)
        mult = self.calculate_bonus_multiplier(performance)
        bonus = base * bonus_target * mult
        equity = self.get_equity_grant(role, level)
        benefits = self.get_benefits_package(location)
        return {
            "base_salary": base,
            "bonus": bonus,
            "total_cash": base + bonus,
            "equity_value": self.calculate_equity_value(equity),
            "benefits_value": benefits["total_value"],
            "total_compensation": base + bonus + benefits["total_value"],
            "equity": equity,
        }
