"""
Персонализированные рекомендации: коллаборативная фильтрация и скоринг охранников для клиента.
"""
import numpy as np
from typing import List, Dict, Any, Optional

try:
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    cosine_similarity = None


class RecommendationEngine:
    """Рекомендации охранников для клиента по истории и эмбеддингам."""

    def __init__(self):
        self.user_embeddings = None
        self.item_embeddings = None

    def recommend_guards_for_client(
        self,
        client_id: str,
        all_guards: List[Dict[str, Any]],
        client_history: Optional[Dict[str, Any]] = None,
        top_n: int = 10,
    ) -> List[Dict[str, Any]]:
        if client_history is None:
            client_history = {"previous_guards": [], "liked_guards_embeddings": [], "typical_requirements": [], "typical_location": {}}
        scores = []
        for guard in all_guards:
            score = self.calculate_guard_score(client_id, guard, client_history)
            scores.append((guard, score))
        scores.sort(key=lambda x: x[1], reverse=True)
        return [g for g, _ in scores[:top_n]]

    def calculate_guard_score(
        self,
        client_id: str,
        guard: Dict[str, Any],
        history: Dict[str, Any],
    ) -> float:
        score = 0.0
        prev = history.get("previous_guards", [])
        if guard.get("id") in prev or guard.get("guard_id") in prev:
            score += 20.0
        liked_emb = history.get("liked_guards_embeddings", [])
        if liked_emb and guard.get("embedding") is not None and cosine_similarity is not None:
            sim = np.max(cosine_similarity([guard["embedding"]], liked_emb)[0])
            score += float(sim) * 30.0
        req = history.get("typical_requirements", [])
        guard_licenses = set(guard.get("licenses", []))
        if req:
            match = len(set(req) & guard_licenses) / max(1, len(req))
            score += match * 25.0
        score += float(guard.get("rating", 0)) * 3.0
        return score

    def get_similar_users(
        self,
        user_id: int,
        user_embeddings: np.ndarray,
        top_n: int = 5,
    ) -> List[Dict[str, Any]]:
        if cosine_similarity is None or user_embeddings is None or user_id >= len(user_embeddings):
            return []
        u = user_embeddings[user_id].reshape(1, -1)
        sim = cosine_similarity(u, user_embeddings)[0]
        idx = np.argsort(sim)[::-1][1 : top_n + 1]
        return [{"user_id": int(i), "similarity": float(sim[i])} for i in idx]
