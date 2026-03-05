"""
Антифрод: Isolation Forest по признакам активности пользователя.
"""
import numpy as np
import joblib
from pathlib import Path
from typing import List, Dict, Any

try:
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
except ImportError:
    IsolationForest = None
    StandardScaler = None


class FraudDetectionSystem:
    """Обнаружение подозрительной активности."""

    def __init__(self):
        self.model = None
        self.scaler = None
        if IsolationForest is not None:
            self.model = IsolationForest(contamination=0.05, random_state=42, n_estimators=200)
            self.scaler = StandardScaler()
        self._feature_names = [
            "orders_per_day",
            "cancellation_rate",
            "response_time_avg",
            "payment_method_changes",
            "device_changes",
            "ip_changes",
            "geo_velocity",
            "night_activity_ratio",
            "price_consistency",
            "review_score_avg",
        ]

    def extract_features(self, user_activity: List[Dict[str, Any]]) -> np.ndarray:
        out = []
        for activity in user_activity:
            vec = [
                activity.get("orders_per_day", 0),
                activity.get("cancellation_rate", 0),
                activity.get("response_time_avg", 0),
                activity.get("payment_method_changes", 0),
                activity.get("device_changes", 0),
                activity.get("ip_changes", 0),
                activity.get("geo_velocity", 0),
                activity.get("night_activity_ratio", 0),
                activity.get("price_consistency", 1),
                activity.get("review_score_avg", 5),
            ]
            out.append(vec)
        return np.array(out, dtype=float)

    def train(self, historical_activities: List[Dict[str, Any]]):
        if self.model is None:
            return self
        X = self.extract_features(historical_activities)
        X = self.scaler.fit_transform(X)
        self.model.fit(X)
        Path("models").mkdir(exist_ok=True)
        joblib.dump(self.model, "models/fraud_model.pkl")
        joblib.dump(self.scaler, "models/fraud_scaler.pkl")
        return self

    def predict_fraud_risk(self, user_activity: Dict[str, Any]) -> dict:
        if self.model is None:
            return {"risk_level": "low", "risk_score": 0.0, "needs_review": False}
        X = self.extract_features([user_activity])
        X = self.scaler.transform(X)
        pred = self.model.predict(X)[0]
        score = self.model.score_samples(X)[0]
        risk_score = float(1 - (score + 0.5))
        risk_score = max(0, min(1, risk_score))
        return {
            "risk_level": "high" if pred == -1 else "low",
            "risk_score": risk_score,
            "needs_review": pred == -1,
        }

    def real_time_monitoring(self, action: Dict[str, Any]) -> dict:
        risk_score = action.get("risk_score", 0.0)
        if risk_score > 0.8:
            return {
                "allowed": False,
                "reason": "Подозрительная активность",
                "requires_verification": True,
            }
        if risk_score > 0.5:
            return {"allowed": True, "requires_2fa": True, "risk_score": risk_score}
        return {"allowed": True, "risk_score": risk_score}
