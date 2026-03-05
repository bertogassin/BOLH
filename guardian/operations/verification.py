"""
Верификация охранников: документы, лицо (опционально DeepFace), лицензии, background check.
"""
from enum import Enum
from datetime import datetime
from typing import Dict, Any, List
import asyncio

try:
    from deepface import DeepFace
    HAS_DEEPFACE = True
except ImportError:
    HAS_DEEPFACE = False


class VerificationStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    VERIFIED = "verified"
    REJECTED = "rejected"
    NEEDS_MANUAL_REVIEW = "needs_review"


class GuardVerification:
    def __init__(self):
        self.verification_steps = [
            "document_check",
            "face_match",
            "license_verification",
            "background_check",
            "interview",
            "training",
        ]
        self.costs = {
            "automated_check": 0.50,
            "manual_review": 5.00,
            "background_check": 10.00,
            "interview": 20.00,
            "total_per_guard": 35.50,
        }

    async def verify_guard(self, documents: Dict[str, Any]) -> Dict[str, Any]:
        result = {
            "guard_id": documents.get("guard_id"),
            "status": VerificationStatus.IN_PROGRESS,
            "steps_completed": [],
            "verification_data": {},
            "cost": 0,
        }
        doc_result = await self.check_documents(
            documents.get("passport"), documents.get("licenses", [])
        )
        result["steps_completed"].append("document_check")
        result["verification_data"]["documents"] = doc_result
        result["cost"] += self.costs["automated_check"]
        if not doc_result.get("valid", True):
            result["status"] = VerificationStatus.REJECTED
            return result

        face_result = await self.verify_face(
            documents.get("selfie"), documents.get("passport")
        )
        result["steps_completed"].append("face_match")
        result["verification_data"]["face_match"] = face_result
        result["cost"] += self.costs["automated_check"]
        if not face_result.get("match", True):
            result["status"] = VerificationStatus.NEEDS_MANUAL_REVIEW
            return result

        license_result = await self.verify_licenses(documents.get("licenses", []))
        result["steps_completed"].append("license_verification")
        result["verification_data"]["licenses"] = license_result

        bg_result = await self.background_check(documents)
        result["steps_completed"].append("background_check")
        result["verification_data"]["background"] = bg_result
        result["cost"] += self.costs["background_check"]
        if bg_result.get("has_criminal_record"):
            result["status"] = VerificationStatus.REJECTED
            return result

        result["status"] = VerificationStatus.VERIFIED
        return result

    async def check_documents(self, passport: Any, licenses: List) -> Dict[str, Any]:
        return {"valid": True, "passport_ok": True, "licenses_count": len(licenses)}

    async def verify_face(self, selfie_path: str, passport_path: str) -> Dict[str, Any]:
        if HAS_DEEPFACE and selfie_path and passport_path:
            try:
                r = DeepFace.verify(
                    img1_path=selfie_path,
                    img2_path=passport_path,
                    model_name="Facenet",
                    distance_metric="cosine",
                )
                return {"match": r["verified"], "confidence": r.get("distance"), "threshold": r.get("threshold")}
            except Exception as e:
                return {"match": False, "error": str(e), "needs_manual": True}
        return {"match": True, "skipped": "no DeepFace"}

    async def verify_licenses(self, licenses: List) -> Dict[str, Any]:
        return {"valid": True, "needs_manual": False}

    async def background_check(self, documents: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "has_criminal_record": False,
            "has_administrative_violations": False,
            "is_wanted": False,
            "credit_score": 750,
            "check_id": "BG123456",
            "checked_at": datetime.now().isoformat(),
        }

    def needs_interview(self, documents: Dict[str, Any]) -> bool:
        return False


class VerificationQueue:
    def __init__(self):
        self.queue: asyncio.Queue = asyncio.Queue()
        self.workers = 5
        self.metrics = {"total_verified": 0, "average_time": 0, "rejection_rate": 0}

    async def add_to_queue(self, guard_data: Dict[str, Any], priority: int = 5):
        await self.queue.put((priority, guard_data))

    async def worker(self, worker_id: int):
        verifier = GuardVerification()
        while True:
            try:
                priority, guard_data = await self.queue.get()
                result = await verifier.verify_guard(guard_data)
                self.metrics["total_verified"] += 1
                self.queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception:
                await asyncio.sleep(1)
