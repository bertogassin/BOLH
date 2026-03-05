# Retention engine: push/email by segment (new, at-risk, loyal, seasonal)
from datetime import datetime
from typing import List, Dict, Any, Optional
import random
import hashlib

class RetentionEngine:
    def __init__(self):
        self.push_templates = {
            "welcome_push": "Добро пожаловать, {name}!",
            "first_order_reminder": "Скидка {discount}% на первый заказ.",
            "come_back_discount": "Вернитесь — скидка {discount}%.",
            "loyalty_milestone": "Заказов: {orders}. Награда: {reward}.",
            "referral_invite": "Пригласите друга: {bonus} ₽. Код: {code}.",
        }

    def get_retention_actions(self, user: Dict[str, Any]) -> List[Dict[str, Any]]:
        actions = []
        days_since = user.get("days_since_last_order", 0)
        total_orders = user.get("total_orders", 0)
        if days_since <= 7:
            actions.extend(self._new_user_actions(user))
        elif days_since >= 14:
            actions.append({"type": "push", "template": "come_back_discount", "data": {"discount": 15}, "delay": 0})
        elif total_orders >= 5:
            if total_orders % 10 == 0:
                actions.append({"type": "push", "template": "loyalty_milestone", "data": {"orders": total_orders, "reward": "Бесплатный час"}, "delay": 0})
            if not user.get("has_referred"):
                actions.append({"type": "push", "template": "referral_invite", "data": {"bonus": 1000, "code": self._ref_code(str(user.get("id", "")))}, "delay": 0})
        return actions

    def _new_user_actions(self, user: Dict[str, Any]) -> List[Dict[str, Any]]:
        out = []
        if user.get("days_since_registration") == 1:
            out.append({"type": "push", "template": "welcome_push", "data": {"name": user.get("first_name", "Пользователь")}, "delay": 3600})
        elif user.get("days_since_registration") == 3 and user.get("total_orders", 0) == 0:
            out.append({"type": "push", "template": "first_order_reminder", "data": {"discount": 10}, "delay": 0})
        return out

    def _ref_code(self, user_id: str) -> str:
        return hashlib.md5(f"{user_id}_{datetime.now().isoformat()}".encode()).hexdigest()[:8].upper()


class ABTestManager:
    def __init__(self):
        self.active_tests = {}

    def create_test(self, name: str, variants: dict, traffic_split: float = 0.5) -> str:
        tid = f"{name}_{int(datetime.now().timestamp())}"
        self.active_tests[tid] = {"name": name, "variants": variants, "traffic_split": traffic_split, "participants": {k: 0 for k in variants}, "conversions": {k: 0 for k in variants}}
        return tid

    def assign_variant(self, user_id: str, test_id: str) -> Optional[Dict[str, Any]]:
        t = self.active_tests.get(test_id)
        if not t or random.random() > t["traffic_split"]:
            return None
        v = random.choice(list(t["variants"].keys()))
        t["participants"][v] = t["participants"].get(v, 0) + 1
        return {"test_id": test_id, "variant": v, "variant_data": t["variants"][v]}

    def track_conversion(self, user_id: str, test_id: str, variant: str):
        if test_id in self.active_tests:
            self.active_tests[test_id]["conversions"][variant] = self.active_tests[test_id]["conversions"].get(variant, 0) + 1
