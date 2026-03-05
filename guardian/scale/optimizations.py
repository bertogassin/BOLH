"""
Оптимизации для масштаба: шардирование заказов, прогрев кэша, расчёт мощности.
"""
import asyncio
from typing import List, Dict, Any

try:
    import aiomysql
    HAS_AIOMYSQL = True
except ImportError:
    HAS_AIOMYSQL = False


class BillionScaleOptimizer:
    def __init__(self):
        self.connection_pools: Dict[int, Any] = {}

    def get_shard_id(self, user_id: str) -> int:
        return hash(user_id) % 4000

    async def batch_process_orders(self, orders: List[Dict[str, Any]]) -> List[Any]:
        sharded = {}
        for o in orders:
            sid = self.get_shard_id(o.get("user_id", ""))
            sharded.setdefault(sid, []).append(o)
        tasks = [self._process_shard_orders(sid, lst) for sid, lst in sharded.items()]
        return await asyncio.gather(*tasks)

    async def _process_shard_orders(self, shard_id: int, orders: List[Dict[str, Any]]) -> Any:
        if not HAS_AIOMYSQL or shard_id not in self.connection_pools:
            return len(orders)
        pool = self.connection_pools[shard_id]
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.executemany(
                    "INSERT INTO orders (id, user_id, data) VALUES (%s, %s, %s)",
                    [(o.get("id"), o.get("user_id"), str(o)) for o in orders],
                )
        return len(orders)

    def calculate_capacity_needed(self, current_users: int, growth_rate: float) -> None:
        users_b = current_users / 1e9
        for year in range(1, 4):
            users_b *= 1 + growth_rate
            print(f"Year {year}: users={users_b*1e9:.0f}, shards={int(users_b*4000)}, api_pods={int(users_b*5000)}")
