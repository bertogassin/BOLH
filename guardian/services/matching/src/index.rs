// Indexes for fast candidate lookup. O(log n) / spatial search.

use domain::{BidId, GeoPoint, LicenseType};
use rust_decimal::Decimal;
use std::collections::{BTreeMap, HashMap, HashSet};

/// Spatial index: radius query from a point (simplified hash map + filter).
#[allow(dead_code)]
pub struct SpatialIndex {
    by_id: HashMap<BidId, GeoPoint>,
}

#[allow(dead_code)]
impl SpatialIndex {
    pub fn new() -> Self {
        Self {
            by_id: HashMap::new(),
        }
    }
    pub fn insert(&mut self, bid_id: BidId, point: &GeoPoint) {
        self.by_id.insert(bid_id, point.clone());
    }
    pub fn remove(&mut self, bid_id: &BidId) {
        self.by_id.remove(bid_id);
    }
    /// Radius query (radius_m in meters, simplified square approximation).
    pub fn query_radius(&self, center: &GeoPoint, radius_m: f64) -> Vec<BidId> {
        let lat_deg = radius_m / 111_320.0;
        let lon_deg = radius_m / (111_320.0 * center.lat.to_radians().cos());
        self.by_id
            .iter()
            .filter(|(_, p)| {
                (p.lat - center.lat).abs() <= lat_deg && (p.lon - center.lon).abs() <= lon_deg
            })
            .map(|(id, _)| *id)
            .collect()
    }
}

impl Default for SpatialIndex {
    fn default() -> Self {
        Self::new()
    }
}

/// Index by license type.
pub struct LicenseIndex {
    by_license: HashMap<LicenseType, HashSet<BidId>>,
}

impl LicenseIndex {
    pub fn new() -> Self {
        Self {
            by_license: HashMap::new(),
        }
    }
    pub fn insert(&mut self, license: LicenseType, bid_id: BidId) {
        self.by_license
            .entry(license)
            .or_default()
            .insert(bid_id);
    }
    #[allow(dead_code)]
    pub fn remove(&mut self, license: &LicenseType, bid_id: &BidId) {
        if let Some(set) = self.by_license.get_mut(license) {
            set.remove(bid_id);
        }
    }
    pub fn get(&self, license: &LicenseType) -> impl Iterator<Item = BidId> + '_ {
        self.by_license
            .get(license)
            .into_iter()
            .flatten()
            .copied()
    }
}

impl Default for LicenseIndex {
    fn default() -> Self {
        Self::new()
    }
}

/// Price index (range query).
pub struct PriceIndex {
    by_price: BTreeMap<Decimal, HashSet<BidId>>,
}

impl PriceIndex {
    pub fn new() -> Self {
        Self {
            by_price: BTreeMap::new(),
        }
    }
    pub fn insert(&mut self, price: Decimal, bid_id: BidId) {
        self.by_price
            .entry(price)
            .or_default()
            .insert(bid_id);
    }
    #[allow(dead_code)]
    pub fn remove(&mut self, price: &Decimal, bid_id: &BidId) {
        if let Some(set) = self.by_price.get_mut(price) {
            set.remove(bid_id);
        }
    }
    pub fn query_range(&self, min: Decimal, max: Decimal) -> HashSet<BidId> {
        self.by_price
            .range(min..=max)
            .flat_map(|(_price, set): (&Decimal, &HashSet<BidId>)| set.iter().copied())
            .collect()
    }
}

impl Default for PriceIndex {
    fn default() -> Self {
        Self::new()
    }
}
