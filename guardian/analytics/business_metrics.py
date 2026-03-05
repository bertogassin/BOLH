"""
Бизнес-метрики и KPI: DAU/MAU, заказы, выручка, LTV/CAC, ретеншн, match rate.
"""
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Dict, List, Optional


@dataclass
class BusinessMetrics:
    daily_active_users: int
    monthly_active_users: int
    new_users_daily: int
    user_retention_7d: float
    user_retention_30d: float
    orders_daily: int
    orders_monthly: int
    average_order_value: float
    order_completion_rate: float
    active_guards: int
    guards_retention: float
    average_guard_rating: float
    revenue_daily: float
    revenue_monthly: float
    gross_profit_margin: float
    customer_lifetime_value: float
    customer_acquisition_cost: float
    match_success_rate: float
    average_match_time: float
    platform_fee_revenue: float
    take_rate: float

    @property
    def ltv_cac_ratio(self) -> float:
        if self.customer_acquisition_cost <= 0:
            return 0.0
        return self.customer_lifetime_value / self.customer_acquisition_cost

    @property
    def roi(self) -> float:
        if self.customer_acquisition_cost <= 0:
            return 0.0
        return (self.customer_lifetime_value - self.customer_acquisition_cost) / self.customer_acquisition_cost


class MetricsCalculator:
    """Расчёт метрик по данным БД/агрегатам."""

    def get_daily_stats(self, d: date) -> dict:
        """Заглушка: запрос к БД."""
        return {
            "dau": 0,
            "mau": 0,
            "new_users": 0,
            "orders": 0,
            "orders_monthly": 0,
            "avg_order_value": 0.0,
            "completion_rate": 0.0,
            "active_guards": 0,
            "guards_retention": 0.0,
            "avg_guard_rating": 0.0,
            "match_success_rate": 0.0,
            "avg_match_time": 0.0,
        }

    def get_cohort_stats(self, d: date) -> dict:
        return {"retention_7d": 0.0, "retention_30d": 0.0}

    def get_financial_stats(self, d: date) -> dict:
        return {
            "revenue": 0.0,
            "revenue_monthly": 0.0,
            "margin": 0.0,
            "fees": 0.0,
            "take_rate": 0.0,
        }

    def get_average_order_value(self) -> float:
        return 0.0

    def get_purchase_frequency(self) -> float:
        return 0.0

    def get_churn_rate(self) -> float:
        return 0.0

    def get_marketing_spend(self, d: date) -> float:
        return 0.0

    def get_new_customers(self, d: date) -> int:
        return 0

    def calculate_ltv(self, d: date) -> float:
        avg_order = self.get_average_order_value()
        freq = self.get_purchase_frequency()
        churn = self.get_churn_rate()
        lifespan = 1 / churn if churn > 0 else 365
        return avg_order * freq * lifespan

    def calculate_cac(self, d: date) -> float:
        spend = self.get_marketing_spend(d)
        new_c = self.get_new_customers(d)
        return spend / new_c if new_c else 0.0

    def calculate_daily_metrics(self, d: date) -> BusinessMetrics:
        daily = self.get_daily_stats(d)
        cohort = self.get_cohort_stats(d)
        financial = self.get_financial_stats(d)
        return BusinessMetrics(
            daily_active_users=daily["dau"],
            monthly_active_users=daily["mau"],
            new_users_daily=daily["new_users"],
            user_retention_7d=cohort["retention_7d"],
            user_retention_30d=cohort["retention_30d"],
            orders_daily=daily["orders"],
            orders_monthly=daily["orders_monthly"],
            average_order_value=daily["avg_order_value"],
            order_completion_rate=daily["completion_rate"],
            active_guards=daily["active_guards"],
            guards_retention=daily["guards_retention"],
            average_guard_rating=daily["avg_guard_rating"],
            revenue_daily=financial["revenue"],
            revenue_monthly=financial["revenue_monthly"],
            gross_profit_margin=financial["margin"],
            customer_lifetime_value=self.calculate_ltv(d),
            customer_acquisition_cost=self.calculate_cac(d),
            match_success_rate=daily["match_success_rate"],
            average_match_time=daily["avg_match_time"],
            platform_fee_revenue=financial["fees"],
            take_rate=financial["take_rate"],
        )
