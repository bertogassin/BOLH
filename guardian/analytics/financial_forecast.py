"""
Прогноз выручки и заказов: простой тренд + сезонность без Prophet.
При установленном prophet можно заменить на Prophet.
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional

try:
    from sklearn.linear_model import LinearRegression
except ImportError:
    LinearRegression = None


class FinancialForecaster:
    """Прогноз выручки/заказов на N периодов вперёд."""

    def __init__(self):
        self.revenue_coef_ = None
        self.orders_coef_ = None
        self._trend_revenue = None
        self._trend_orders = None

    def prepare_data(self, dates: List[datetime], revenue: List[float], orders: Optional[List[float]] = None) -> pd.DataFrame:
        df = pd.DataFrame({"ds": pd.to_datetime(dates), "y": revenue})
        df["ordinal"] = df["ds"].map(lambda x: x.toordinal())
        if orders is not None:
            df["orders"] = orders
        return df

    def train(self, historical_data: pd.DataFrame):
        """Простой линейный тренд по дате."""
        if historical_data is None or len(historical_data) < 2:
            return self
        df = historical_data.copy()
        if "ordinal" not in df.columns and "ds" in df.columns:
            df["ordinal"] = pd.to_datetime(df["ds"]).map(lambda x: x.toordinal())
        X = df[["ordinal"]].values
        y_rev = df["y"].values if "y" in df.columns else df["revenue"].values
        if LinearRegression is not None:
            self._trend_revenue = LinearRegression().fit(X, y_rev)
        if "orders" in df.columns and LinearRegression is not None:
            self._trend_orders = LinearRegression().fit(X, df["orders"].values)
        return self

    def forecast(self, periods: int = 90, last_date: Optional[datetime] = None) -> pd.DataFrame:
        if last_date is None:
            last_date = datetime.utcnow()
        dates = [last_date + timedelta(days=i) for i in range(1, periods + 1)]
        ordinals = np.array([[d.toordinal()] for d in dates])
        rev = self._trend_revenue.predict(ordinals) if self._trend_revenue is not None else np.zeros(periods)
        ords = self._trend_orders.predict(ordinals) if self._trend_orders is not None else np.zeros(periods)
        return pd.DataFrame({
            "date": dates,
            "revenue_forecast": np.maximum(0, rev),
            "orders_forecast": np.maximum(0, ords),
        })
