// Sharding Matching Engine by order_id for horizontal scaling.

use std::hash::{Hash, Hasher};

use domain::OrderId;

/// Returns shard number by order ID (consistent hashing).
pub fn shard_for_order(order_id: &OrderId, shard_count: usize) -> usize {
    if shard_count == 0 {
        return 0;
    }
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    order_id.0.hash(&mut hasher);
    (hasher.finish() as usize) % shard_count
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn shard_deterministic() {
        let id = OrderId(Uuid::new_v4());
        let a = shard_for_order(&id, 5);
        let b = shard_for_order(&id, 5);
        assert_eq!(a, b);
    }

    #[test]
    fn shard_in_range() {
        let id = OrderId(Uuid::new_v4());
        for n in 1..=20 {
            let s = shard_for_order(&id, n);
            assert!(s < n, "shard {} must be < {}", s, n);
        }
    }
}
