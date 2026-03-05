"""
Аналитика в реальном времени: метрики из Redis/Kafka, WebSocket для дашборда.
Запуск: uvicorn analytics.realtime_dashboard:app --reload (при установленных fastapi, aiokafka, redis).
"""
from datetime import datetime, timedelta
from typing import Dict, Any
import json
import asyncio

# Опциональные зависимости
try:
    import redis.asyncio as redis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False


class RealtimeAnalytics:
    """Агрегация метрик в реальном времени (Redis + Kafka)."""

    def __init__(self):
        self.redis: Any = None

    async def initialize(self):
        if HAS_REDIS:
            self.redis = await redis.from_url("redis://localhost:6379")
        else:
            self.redis = None

    async def get_current_metrics(self) -> Dict[str, Any]:
        if self.redis is None:
            return {
                "orders_today": 0,
                "orders_total": 0,
                "matches_today": 0,
                "revenue_today": 0.0,
                "active_users": 0,
                "avg_response_time": 0.0,
            }
        return {
            "orders_today": int(await self.redis.get("metrics:orders:today") or 0),
            "orders_total": int(await self.redis.get("metrics:orders:total") or 0),
            "matches_today": int(await self.redis.get("metrics:matches:today") or 0),
            "revenue_today": float(await self.redis.get("metrics:revenue:today") or 0),
            "active_users": int(await self.redis.get("metrics:users:active") or 0),
            "avg_response_time": float(await self.redis.get("metrics:response_time:avg") or 0),
        }


# FastAPI app только при наличии fastapi
try:
    from fastapi import FastAPI, WebSocket
    from fastapi.responses import HTMLResponse

    app = FastAPI(title="Guardian Realtime Analytics")

    @app.get("/")
    async def root():
        return HTMLResponse("<h1>Guardian Realtime API</h1><p>WS: /ws/live</p>")

    @app.websocket("/ws/live")
    async def websocket_live(websocket: WebSocket):
        await websocket.accept()
        analytics = RealtimeAnalytics()
        await analytics.initialize()
        try:
            while True:
                metrics = await analytics.get_current_metrics()
                await websocket.send_json(metrics)
                await asyncio.sleep(1)
        except Exception:
            pass

except ImportError:
    app = None
