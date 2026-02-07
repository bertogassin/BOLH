//! Geolocation module
//! 
//! Distance calculations, geofencing, route tracking

use std::f64::consts::PI;
use serde::{Deserialize, Serialize};

const EARTH_RADIUS_KM: f64 = 6371.0;

pub struct GeoService;

impl GeoService {
    /// Calculate distance between two points using Haversine formula
    pub fn calculate_distance(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
        let lat1_rad = lat1.to_radians();
        let lat2_rad = lat2.to_radians();
        let delta_lat = (lat2 - lat1).to_radians();
        let delta_lng = (lng2 - lng1).to_radians();

        let a = (delta_lat / 2.0).sin().powi(2)
            + lat1_rad.cos() * lat2_rad.cos() * (delta_lng / 2.0).sin().powi(2);
        let c = 2.0 * a.sqrt().asin();

        EARTH_RADIUS_KM * c
    }

    /// Calculate bearing from one point to another
    pub fn calculate_bearing(from_lat: f64, from_lng: f64, to_lat: f64, to_lng: f64) -> f64 {
        let lat1 = from_lat.to_radians();
        let lat2 = to_lat.to_radians();
        let delta_lng = (to_lng - from_lng).to_radians();

        let x = delta_lng.sin() * lat2.cos();
        let y = lat1.cos() * lat2.sin() - lat1.sin() * lat2.cos() * delta_lng.cos();

        let bearing = x.atan2(y).to_degrees();
        (bearing + 360.0) % 360.0
    }

    /// Check if a point is within a circular geofence
    pub fn point_in_geofence(
        point_lat: f64,
        point_lng: f64,
        center_lat: f64,
        center_lng: f64,
        radius_km: f64,
    ) -> bool {
        let distance = Self::calculate_distance(point_lat, point_lng, center_lat, center_lng);
        distance <= radius_km
    }

    /// Get bounding box for a circular area
    pub fn get_bounding_box(center_lat: f64, center_lng: f64, radius_km: f64) -> BoundingBox {
        let lat_delta = (radius_km / EARTH_RADIUS_KM) * (180.0 / PI);
        let lng_delta = lat_delta / center_lat.to_radians().cos();

        BoundingBox {
            min_lat: center_lat - lat_delta,
            max_lat: center_lat + lat_delta,
            min_lng: center_lng - lng_delta,
            max_lng: center_lng + lng_delta,
        }
    }

    /// Estimate travel time based on distance and speed
    pub fn estimate_travel_time(distance_km: f64, speed_kmh: f64) -> f64 {
        if speed_kmh <= 0.0 {
            return 0.0;
        }
        (distance_km / speed_kmh) * 60.0 // Returns minutes
    }

    /// Calculate total route distance from a list of points
    pub fn calculate_route_distance(points: &[GeoPoint]) -> f64 {
        if points.len() < 2 {
            return 0.0;
        }

        points
            .windows(2)
            .map(|w| Self::calculate_distance(w[0].lat, w[0].lng, w[1].lat, w[1].lng))
            .sum()
    }

    /// Find the nearest point from a list
    pub fn find_nearest(
        from_lat: f64,
        from_lng: f64,
        points: &[GeoPoint],
    ) -> Option<(usize, f64)> {
        points
            .iter()
            .enumerate()
            .map(|(i, p)| (i, Self::calculate_distance(from_lat, from_lng, p.lat, p.lng)))
            .min_by(|a, b| a.1.partial_cmp(&b.1).unwrap())
    }

    /// Rank guards by distance and other factors
    pub fn rank_guards(
        guards: Vec<GuardLocation>,
        user_lat: f64,
        user_lng: f64,
        max_distance_km: Option<f64>,
    ) -> Vec<RankedGuard> {
        let mut ranked: Vec<RankedGuard> = guards
            .into_iter()
            .map(|g| {
                let distance = Self::calculate_distance(user_lat, user_lng, g.lat, g.lng);
                let score = Self::calculate_guard_score(&g, distance);
                RankedGuard {
                    id: g.id,
                    lat: g.lat,
                    lng: g.lng,
                    distance_km: distance,
                    rating: g.rating,
                    is_available: g.is_available,
                    score,
                }
            })
            .filter(|g| {
                max_distance_km.map_or(true, |max| g.distance_km <= max)
            })
            .collect();

        ranked.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
        ranked
    }

    fn calculate_guard_score(guard: &GuardLocation, distance: f64) -> f64 {
        let distance_score = 100.0 / (1.0 + distance);
        let rating_score = guard.rating * 20.0;
        let availability_score = if guard.is_available { 50.0 } else { 0.0 };
        
        distance_score + rating_score + availability_score
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoPoint {
    pub lat: f64,
    pub lng: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub min_lat: f64,
    pub max_lat: f64,
    pub min_lng: f64,
    pub max_lng: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardLocation {
    pub id: i64,
    pub lat: f64,
    pub lng: f64,
    pub rating: f64,
    pub is_available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RankedGuard {
    pub id: i64,
    pub lat: f64,
    pub lng: f64,
    pub distance_km: f64,
    pub rating: f64,
    pub is_available: bool,
    pub score: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_distance_calculation() {
        // Almaty to Astana ~1200km
        let distance = GeoService::calculate_distance(43.238949, 76.945465, 51.169392, 71.449074);
        assert!((distance - 1200.0).abs() < 100.0);
    }

    #[test]
    fn test_geofence() {
        let center_lat = 43.238949;
        let center_lng = 76.945465;
        
        // Point inside (1km away)
        assert!(GeoService::point_in_geofence(43.247, 76.945, center_lat, center_lng, 2.0));
        
        // Point outside (10km away)
        assert!(!GeoService::point_in_geofence(43.35, 76.945, center_lat, center_lng, 2.0));
    }

    #[test]
    fn test_bearing() {
        let bearing = GeoService::calculate_bearing(43.238949, 76.945465, 51.169392, 71.449074);
        assert!(bearing > 0.0 && bearing < 360.0);
    }
}
