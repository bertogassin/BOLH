"""
Модель движения денежных средств: помесячный прогноз, runway, оценка.
"""
from datetime import datetime, timedelta
from typing import Dict, Any, List

try:
    import pandas as pd
    HAS_PD = True
except ImportError:
    HAS_PD = False


class CashFlowModel:
    def __init__(self):
        self.starting_cash = 10_000_000
        self.arr = 0
        self.mrr = 0

    def calculate_monthly_revenue(self, month: int) -> float:
        """Рост выручки по месяцам (упрощённо)."""
        base = 500_000
        growth = 1.05
        return base * (growth ** (month - 1))

    def calculate_monthly_expenses(self, month: int) -> float:
        """Расходы по месяцам."""
        base = 600_000
        return base * (1.02 ** (month - 1))

    def project_monthly(self, months: int = 36) -> Any:
        cash = self.starting_cash
        cash_flow: List[Dict[str, Any]] = []
        for month in range(1, months + 1):
            revenue = self.calculate_monthly_revenue(month)
            expenses = self.calculate_monthly_expenses(month)
            net = revenue - expenses
            cash += net
            burn = expenses - revenue if expenses > revenue else 0
            runway = cash / burn if burn > 0 else float("inf")
            cash_flow.append({
                "month": month,
                "revenue": revenue,
                "expenses": expenses,
                "net_cash_flow": net,
                "cash_balance": cash,
                "burn_rate": burn,
                "runway_months": runway,
                "arr": revenue * 12,
            })
        if HAS_PD:
            return pd.DataFrame(cash_flow)
        return cash_flow

    def calculate_runway(self, current_cash: float = None, current_burn: float = None) -> Dict[str, Any]:
        current_cash = current_cash or self.starting_cash
        current_burn = current_burn or self.calculate_monthly_expenses(1)
        runway = current_cash / current_burn if current_burn > 0 else float("inf")
        return {
            "current_cash": current_cash,
            "monthly_burn": current_burn,
            "runway_months": runway,
            "runway_date": datetime.now() + timedelta(days=min(runway, 3650) * 30),
            "needs_funding": runway < 12,
        }

    def calculate_valuation(self, arr: float = None) -> Dict[str, float]:
        arr = arr or self.arr or 50_000_000
        revenue_multiple = 8.0
        valuation_by_revenue = arr * revenue_multiple
        dcf_value = arr * 3  # упрощённый DCF
        comparable_value = arr * 4
        return {
            "revenue_multiple": valuation_by_revenue,
            "dcf": dcf_value,
            "comparable": comparable_value,
            "average": (valuation_by_revenue + dcf_value + comparable_value) / 3,
        }
