"""
Предсказание спроса на охрану по районам и времени.
Использует XGBoost; признаки: время, день недели, локация, лаги, погода/события (заглушки).
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import joblib
from datetime import datetime, timedelta
from pathlib import Path

try:
    import xgboost as xgb
    HAS_XGB = True
except ImportError:
    HAS_XGB = False


class DemandForecastModel:
    """Модель предсказания спроса на охрану (заказы в районе на ближайшие дни)."""

    def __init__(self):
        if HAS_XGB:
            self.model = xgb.XGBRegressor(
                n_estimators=300,
                max_depth=10,
                learning_rate=0.05,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=42,
            )
        else:
            self.model = RandomForestRegressor(n_estimators=200, max_depth=10, random_state=42)
        self.feature_columns = None
        self._holidays = set()

    def _get_holidays(self):
        if self._holidays:
            return self._holidays
        # Минимальный набор праздников (РФ)
        base = datetime(2020, 1, 1).date()
        for _ in range(365 * 3):
            d = base + timedelta(days=_)
            if d.month == 1 and d.day <= 8:
                self._holidays.add(d)
            if d.month == 5 and d.day in (1, 9):
                self._holidays.add(d)
        return self._holidays

    def _get_location_cluster(self, lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
        """Упрощённая кластеризация по сетке 0.1°."""
        return (np.floor(lat * 10).astype(int) * 1000 + np.floor(lon * 10).astype(int)).astype(int)

    def prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        if "datetime" not in df.columns and "date" in df.columns:
            df["datetime"] = pd.to_datetime(df["date"])
        dt = df["datetime"].dt
        df["hour"] = dt.hour
        df["day_of_week"] = dt.dayofweek
        df["day_of_month"] = dt.day
        df["month"] = dt.month
        df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
        df["is_holiday"] = df["datetime"].dt.date.isin(self._get_holidays()).astype(int)
        df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
        df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
        df["dow_sin"] = np.sin(2 * np.pi * df["day_of_week"] / 7)
        df["dow_cos"] = np.cos(2 * np.pi * df["day_of_week"] / 7)
        if "latitude" in df.columns and "longitude" in df.columns:
            df["location_cluster"] = self._get_location_cluster(
                df["latitude"].values, df["longitude"].values
            )
        else:
            df["location_cluster"] = 0
        if "orders_count" in df.columns:
            df["demand_lag_1d"] = df.groupby("location_cluster")["orders_count"].shift(1)
            df["demand_lag_7d"] = df.groupby("location_cluster")["orders_count"].shift(7)
            df["demand_rolling_mean_7d"] = df.groupby("location_cluster")["orders_count"].transform(
                lambda x: x.rolling(7, min_periods=1).mean()
            )
        df = df.fillna(0)
        return df

    def train(self, historical_data: pd.DataFrame):
        df = self.prepare_features(historical_data)
        target = "orders_count"
        if target not in df.columns:
            raise ValueError("historical_data must contain 'orders_count' and 'datetime'")
        exclude = ["datetime", "date", target, "latitude", "longitude"]
        self.feature_columns = [c for c in df.columns if c not in exclude and df[c].dtype in (np.number,)]
        X = df[self.feature_columns]
        y = df[target]
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        if HAS_XGB:
            self.model.fit(
                X_train, y_train,
                eval_set=[(X_test, y_test)],
                verbose=False,
            )
        else:
            self.model.fit(X_train, y_train)
        print(f"Train R²: {self.model.score(X_train, y_train):.3f}")
        print(f"Test R²: {self.model.score(X_test, y_test):.3f}")
        return self

    def create_prediction_features(self, location: dict, dt: datetime) -> list:
        """Один вектор признаков для (location, dt)."""
        row = {
            "hour": dt.hour,
            "day_of_week": dt.weekday(),
            "day_of_month": dt.day,
            "month": dt.month,
            "is_weekend": 1 if dt.weekday() >= 5 else 0,
            "is_holiday": 1 if dt.date() in self._get_holidays() else 0,
            "hour_sin": np.sin(2 * np.pi * dt.hour / 24),
            "hour_cos": np.cos(2 * np.pi * dt.hour / 24),
            "dow_sin": np.sin(2 * np.pi * dt.weekday() / 7),
            "dow_cos": np.cos(2 * np.pi * dt.weekday() / 7),
            "location_cluster": self._get_location_cluster(
                np.array([location.get("lat", 55.75)]),
                np.array([location.get("lon", 37.61)]),
            )[0],
            "demand_lag_1d": 0,
            "demand_lag_7d": 0,
            "demand_rolling_mean_7d": 0,
        }
        return [row.get(c, 0) for c in self.feature_columns]

    def predict_demand(self, location: dict, datetime_range: list) -> list:
        if self.feature_columns is None:
            raise RuntimeError("Train model first")
        predictions = []
        for dt in datetime_range:
            feats = self.create_prediction_features(location, dt)
            pred = self.model.predict([feats])[0]
            predictions.append({"datetime": dt, "predicted_orders": max(0, int(pred))})
        return predictions

    def get_hot_zones(self, current_time: datetime, zones: list) -> list:
        if self.feature_columns is None:
            return sorted(zones, key=lambda z: 0)[:10]
        out = []
        for zone in zones:
            loc = {"lat": zone.get("latitude", zone.get("lat", 55.75)), "lon": zone.get("longitude", zone.get("lon", 37.61))}
            feats = self.create_prediction_features(loc, current_time)
            pred = self.model.predict([feats])[0]
            out.append({
                "zone": zone,
                "demand": float(pred),
                "latitude": loc["lat"],
                "longitude": loc["lon"],
            })
        out.sort(key=lambda x: x["demand"], reverse=True)
        return out[:10]

    def save(self, path: str = "models/demand_forecast"):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"model": self.model, "feature_columns": self.feature_columns}, path + ".pkl")

    @classmethod
    def load(cls, path: str = "models/demand_forecast"):
        obj = cls()
        data = joblib.load(path + ".pkl")
        obj.model = data["model"]
        obj.feature_columns = data["feature_columns"]
        return obj
