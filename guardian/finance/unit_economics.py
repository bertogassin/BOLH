"""
Юнит-экономика: LTV, CAC, окупаемость по каналам, когортный LTV.
"""
from typing import Dict, List, Any


class UnitEconomics:
    def __init__(self):
        self.assumptions = {
            "avg_order_value": 5000,
            "platform_fee": 0.15,
            "orders_per_user_per_year": 12,
            "user_lifetime_years": 3,
            "cac": {"paid": 2000, "organic": 200, "referral": 500},
        }

    def calculate_ltv(self, user_type: str = "client") -> Dict[str, Any]:
        if user_type == "client":
            annual_revenue = (
                self.assumptions["avg_order_value"]
                * self.assumptions["orders_per_user_per_year"]
                * self.assumptions["platform_fee"]
            )
            ltv = annual_revenue * self.assumptions["user_lifetime_years"]
            return {
                "annual_revenue": annual_revenue,
                "ltv": ltv,
                "ltv_by_channel": {
                    "paid": ltv - self.assumptions["cac"]["paid"],
                    "organic": ltv - self.assumptions["cac"]["organic"],
                    "referral": ltv - self.assumptions["cac"]["referral"],
                },
            }
        elif user_type == "guard":
            avg_orders_per_month = 20
            avg_order_value = 3000
            platform_fee = 0.15
            monthly_revenue = avg_orders_per_month * avg_order_value * platform_fee
            annual_revenue = monthly_revenue * 12
            ltv = annual_revenue * 2
            return {
                "monthly_revenue": monthly_revenue,
                "annual_revenue": annual_revenue,
                "ltv": ltv,
            }
        return {}

    def calculate_cac_payback(self) -> Dict[str, Any]:
        monthly_margin = (
            self.assumptions["avg_order_value"]
            * self.assumptions["orders_per_user_per_year"]
            / 12
            * self.assumptions["platform_fee"]
        )
        payback = {}
        for channel, cac in self.assumptions["cac"].items():
            months = cac / monthly_margin if monthly_margin else 0
            payback[channel] = {
                "cac": cac,
                "monthly_margin": monthly_margin,
                "months_to_payback": months,
                "profitable": months < 18,
            }
        return payback

    def get_retention_rate(self, cohort_month: int, month: int) -> float:
        """Упрощённая кривая удержания."""
        if month <= 1:
            return 1.0
        if month <= 3:
            return 0.6 - (month - 1) * 0.1
        if month <= 12:
            return max(0.2, 0.4 - (month - 3) * 0.02)
        return 0.2

    def calculate_cohort_ltv(self, cohort_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        results = []
        for cohort in cohort_data:
            ltv_by_month = []
            for month in range(1, 25):
                retention = self.get_retention_rate(cohort.get("month", 1), month)
                revenue = (
                    cohort.get("size", 100)
                    * self.assumptions["avg_order_value"]
                    * self.assumptions["platform_fee"]
                    * retention
                )
                cum = sum(
                    cohort.get("size", 100)
                    * self.assumptions["avg_order_value"]
                    * self.assumptions["platform_fee"]
                    * self.get_retention_rate(cohort.get("month", 1), m)
                    for m in range(1, month + 1)
                )
                ltv_by_month.append(cum / cohort.get("size", 100))
            results.append({
                "cohort_month": cohort.get("month"),
                "ltv_12m": ltv_by_month[11] if len(ltv_by_month) > 11 else 0,
                "ltv_24m": ltv_by_month[23] if len(ltv_by_month) > 23 else 0,
                "ltv_by_month": ltv_by_month,
            })
        return results
