"""
Разрешение споров: создание спора, автоанализ, медиация, применение решения.
"""
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional


class DisputeResolution:
    def __init__(self):
        self.disputes: List[Dict[str, Any]] = []
        self.resolution_steps = ["auto_analysis", "mediation", "arbitration", "escalation_to_management"]

    def create_dispute(
        self,
        order_id: str,
        initiator: str,
        reason: str,
        evidence: List[Any],
    ) -> Dict[str, Any]:
        dispute = {
            "id": f"DISPUTE-{len(self.disputes) + 1}",
            "order_id": order_id,
            "initiator": initiator,
            "reason": reason,
            "evidence": evidence,
            "status": "open",
            "created_at": datetime.now(),
            "resolution_deadline": datetime.now() + timedelta(days=3),
            "amount_in_dispute": self.get_order_amount(order_id),
        }
        analysis = self.auto_analyze(dispute)
        dispute["auto_analysis"] = analysis
        if analysis.get("can_auto_resolve"):
            dispute["resolution"] = analysis["resolution"]
            dispute["status"] = "resolved_auto"
        else:
            dispute["mediator"] = "mediator_1"
        self.disputes.append(dispute)
        return dispute

    def get_order_amount(self, order_id: str) -> float:
        return 5000.0

    def auto_analyze(self, dispute: Dict[str, Any]) -> Dict[str, Any]:
        reason = dispute["reason"].lower()
        if "не приехал" in reason:
            return {"can_auto_resolve": True, "resolution": "accept", "reason": "Охранник не прибыл", "refund_amount": dispute["amount_in_dispute"]}
        if "качество" in reason or "плохо" in reason:
            return {"can_auto_resolve": False, "needs_manual_review": True, "reason": "Требуется ручная проверка"}
        return {"can_auto_resolve": False, "needs_manual_review": True, "reason": "Ручное рассмотрение"}

    def resolve_dispute(self, dispute_id: str, resolution: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        dispute = next((d for d in self.disputes if d["id"] == dispute_id), None)
        if not dispute:
            return None
        dispute["status"] = "resolved"
        dispute["resolution"] = resolution
        dispute["resolved_at"] = datetime.now()
        return dispute

    def get_dispute_stats(self) -> Dict[str, Any]:
        total = len(self.disputes)
        resolved = len([d for d in self.disputes if d["status"] == "resolved"])
        auto_resolved = len([d for d in self.disputes if d["status"] == "resolved_auto"])
        return {
            "total_disputes": total,
            "resolved": resolved,
            "auto_resolved": auto_resolved,
            "auto_resolution_rate": auto_resolved / total if total else 0,
        }
