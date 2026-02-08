"""
Guardio Rapidos - ML Ranking Service
Fast API service for intelligent guard ranking using ML
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
from geopy.distance import geodesic

app = FastAPI(
    title="Guardio ML Service",
    description="Machine Learning service for guard ranking",
    version="1.0.0"
)

# ============================================================================
# Models
# ============================================================================

class Guard(BaseModel):
    id: int
    rating: float
    total_orders: int
    price_per_hour: float
    is_verified: bool
    latitude: float
    longitude: float
    response_time_avg: Optional[float] = 5.0  # minutes
    completion_rate: Optional[float] = 0.95

class RankRequest(BaseModel):
    guards: List[Guard]
    user_lat: float
    user_lng: float
    max_distance_km: Optional[float] = 10.0
    weights: Optional[dict] = None

class RankedGuard(BaseModel):
    id: int
    score: float
    distance_km: float
    score_breakdown: dict

class RankResponse(BaseModel):
    ranked_guards: List[RankedGuard]
    total: int
    algorithm: str = "weighted_ensemble"

# ============================================================================
# Ranking Algorithm
# ============================================================================

DEFAULT_WEIGHTS = {
    "distance": 0.30,
    "rating": 0.25,
    "price": 0.15,
    "verified": 0.10,
    "experience": 0.10,
    "response_time": 0.05,
    "completion_rate": 0.05
}

def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in km using Haversine formula"""
    return geodesic((lat1, lng1), (lat2, lng2)).kilometers

def normalize(value: float, min_val: float, max_val: float, inverse: bool = False) -> float:
    """Normalize value to 0-1 range"""
    if max_val == min_val:
        return 1.0
    normalized = (value - min_val) / (max_val - min_val)
    if inverse:
        normalized = 1.0 - normalized
    return max(0.0, min(1.0, normalized))

def rank_guards(request: RankRequest) -> List[RankedGuard]:
    """
    Rank guards using weighted ensemble scoring
    
    Score = Σ(weight_i * normalized_feature_i)
    """
    weights = request.weights or DEFAULT_WEIGHTS
    results = []
    
    # Pre-calculate stats for normalization
    if not request.guards:
        return []
    
    distances = []
    for guard in request.guards:
        dist = calculate_distance(
            request.user_lat, request.user_lng,
            guard.latitude, guard.longitude
        )
        distances.append(dist)
    
    ratings = [g.rating for g in request.guards]
    prices = [g.price_per_hour for g in request.guards]
    orders = [g.total_orders for g in request.guards]
    
    min_dist, max_dist = min(distances), max(distances)
    min_rating, max_rating = min(ratings), max(ratings)
    min_price, max_price = min(prices), max(prices)
    min_orders, max_orders = min(orders), max(orders)
    
    for i, guard in enumerate(request.guards):
        distance = distances[i]
        
        # Skip if too far
        if distance > request.max_distance_km:
            continue
        
        # Calculate normalized scores
        dist_score = normalize(distance, min_dist, max_dist, inverse=True)
        rating_score = normalize(guard.rating, min_rating, max_rating)
        price_score = normalize(guard.price_per_hour, min_price, max_price, inverse=True)
        verified_score = 1.0 if guard.is_verified else 0.0
        experience_score = normalize(guard.total_orders, min_orders, max_orders)
        response_score = normalize(guard.response_time_avg, 1, 30, inverse=True)
        completion_score = guard.completion_rate
        
        # Weighted sum
        total_score = (
            weights["distance"] * dist_score +
            weights["rating"] * rating_score +
            weights["price"] * price_score +
            weights["verified"] * verified_score +
            weights["experience"] * experience_score +
            weights["response_time"] * response_score +
            weights["completion_rate"] * completion_score
        )
        
        results.append(RankedGuard(
            id=guard.id,
            score=round(total_score * 100, 2),
            distance_km=round(distance, 2),
            score_breakdown={
                "distance": round(dist_score * 100, 1),
                "rating": round(rating_score * 100, 1),
                "price": round(price_score * 100, 1),
                "verified": round(verified_score * 100, 1),
                "experience": round(experience_score * 100, 1),
                "response_time": round(response_score * 100, 1),
                "completion_rate": round(completion_score * 100, 1)
            }
        ))
    
    # Sort by score descending
    results.sort(key=lambda x: x.score, reverse=True)
    return results

# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "ml-ranking", "version": "1.0.0"}

@app.post("/rank", response_model=RankResponse)
async def rank_endpoint(request: RankRequest):
    """Rank guards by relevance to user location and preferences"""
    try:
        ranked = rank_guards(request)
        return RankResponse(
            ranked_guards=ranked,
            total=len(ranked),
            algorithm="weighted_ensemble"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict-demand")
async def predict_demand(lat: float, lng: float, hour: int):
    """Predict guard demand for a location/time (ML model)"""
    # Simple heuristic for now - can be replaced with trained model
    base_demand = 0.5
    
    # Peak hours (evening)
    if 18 <= hour <= 22:
        base_demand += 0.3
    # Late night
    elif 22 <= hour or hour <= 6:
        base_demand += 0.2
    
    return {
        "predicted_demand": round(base_demand, 2),
        "confidence": 0.75,
        "recommended_surge": 1.0 + (base_demand * 0.5)
    }

@app.get("/weights")
async def get_default_weights():
    """Get default ranking weights"""
    return DEFAULT_WEIGHTS

# ============================================================================
# Run
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
