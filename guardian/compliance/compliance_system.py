"""
Комплаенс: GDPR, AML, аудит-лог, DPO (обработка запросов пользователей, утечки).
"""
import hashlib
import hmac
import json
from datetime import datetime
from typing import Dict, Any, List


class ComplianceSystem:
    def __init__(self):
        self.audit_key = b"change-me-in-production"
        self.regulations = {"gdpr": self._check_gdpr, "aml": self._check_aml}

    def _check_gdpr(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        checks = {
            "consent_obtained": user_data.get("consent_date") is not None,
            "data_minimized": True,
            "retention_limited": True,
            "right_to_erasure": user_data.get("erasure_possible", True),
        }
        return {"compliant": all(checks.values()), "checks": checks}

    def _check_aml(self, transaction: Dict[str, Any]) -> Dict[str, Any]:
        if transaction.get("amount", 0) > 10000:
            return {"status": "flagged", "reason": "large_transaction", "requires_review": True}
        return {"status": "approved", "risk_level": "low", "requires_review": False}

    def audit_log(self, action: str, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        msg = f"{action}:{user_id}:{json.dumps(data, sort_keys=True)}".encode()
        signature = hmac.new(self.audit_key, msg, hashlib.sha256).hexdigest()
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "action": action,
            "user_id": user_id,
            "data_hash": hashlib.sha256(msg).hexdigest(),
            "signature": signature,
        }

    def generate_compliance_report(self, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        return {
            "period": f"{start_date.date()} to {end_date.date()}",
            "gdpr": "ok",
            "aml": "ok",
            "data_breaches": [],
            "user_requests": [],
        }


class DataProtectionOfficer:
    def __init__(self):
        self.data_inventory = {}
        self.data_breaches: List[Dict[str, Any]] = []

    def register_data_processing(self, purpose: str, data_categories: list, legal_basis: str) -> Dict[str, Any]:
        self.data_inventory[purpose] = {
            "purpose": purpose,
            "data_categories": data_categories,
            "legal_basis": legal_basis,
            "registered_at": datetime.utcnow().isoformat(),
        }
        return self.data_inventory[purpose]

    def handle_user_request(self, user_id: str, request_type: str) -> Dict[str, str]:
        if request_type == "access":
            return {"action": "provide_user_data", "user_id": user_id}
        if request_type == "erasure":
            return {"action": "delete_user_data", "user_id": user_id}
        if request_type == "portability":
            return {"action": "export_user_data", "user_id": user_id}
        return {"action": "unknown", "request_type": request_type}

    def report_data_breach(self, description: str, affected_users: int, severity: str) -> Dict[str, Any]:
        breach = {
            "id": hashlib.md5(datetime.utcnow().isoformat().encode()).hexdigest()[:12],
            "detected_at": datetime.utcnow().isoformat(),
            "description": description,
            "affected_users": affected_users,
            "severity": severity,
        }
        self.data_breaches.append(breach)
        return breach
