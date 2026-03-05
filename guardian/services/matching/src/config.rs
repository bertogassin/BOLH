// Настраиваемые параметры алгоритма подбора.

use std::time::Duration;

#[derive(Debug, Clone)]
pub struct AlgorithmConfig {
    pub weights: ScoringWeights,
    pub priority_free_agents: bool,
    pub price_importance: f64,
    pub max_search_radius: u32,
    pub max_candidates: usize,
    pub match_timeout: Duration,
    pub bid_validity_max: Duration,
}

#[derive(Debug, Clone)]
pub struct ScoringWeights {
    pub reputation: f64,
    pub price: f64,
    pub experience: f64,
    pub distance: f64,
    pub response_rate: f64,
    pub completion_rate: f64,
}

impl Default for AlgorithmConfig {
    fn default() -> Self {
        Self {
            weights: ScoringWeights {
                reputation: 0.3,
                price: 0.2,
                experience: 0.15,
                distance: 0.15,
                response_rate: 0.1,
                completion_rate: 0.1,
            },
            priority_free_agents: true,
            price_importance: 0.7,
            max_search_radius: 50_000,
            max_candidates: 100,
            match_timeout: Duration::from_secs(3600),
            bid_validity_max: Duration::from_secs(30 * 86400),
        }
    }
}
