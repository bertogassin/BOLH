// Guardio Mobile App - Tauri Backend Library
// Provides native APIs and Rust core integration

use bolh_core::{
    crypto::CryptoService,
    geo::GeoService,
    validation::ValidationService,
};

// Crypto commands
#[tauri::command]
fn encrypt_data(plaintext: String, key: String) -> Result<String, String> {
    CryptoService::encrypt_aes256(&plaintext, &key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn decrypt_data(ciphertext: String, key: String) -> Result<String, String> {
    CryptoService::decrypt_aes256(&ciphertext, &key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn hash_password(password: String) -> Result<String, String> {
    CryptoService::hash_password(&password)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn verify_password(password: String, hash: String) -> bool {
    CryptoService::verify_password(&password, &hash)
}

#[tauri::command]
fn generate_key() -> String {
    CryptoService::generate_key()
}

// Geo commands
#[tauri::command]
fn calculate_distance(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    GeoService::calculate_distance(lat1, lng1, lat2, lng2)
}

#[tauri::command]
fn point_in_geofence(
    point_lat: f64,
    point_lng: f64,
    center_lat: f64,
    center_lng: f64,
    radius_km: f64,
) -> bool {
    GeoService::point_in_geofence(point_lat, point_lng, center_lat, center_lng, radius_km)
}

// Validation commands
#[tauri::command]
fn validate_phone(phone: String) -> bool {
    ValidationService::validate_phone_kz(&phone)
}

#[tauri::command]
fn validate_email(email: String) -> bool {
    ValidationService::validate_email(&email)
}

#[tauri::command]
fn validate_iin(iin: String) -> bool {
    ValidationService::validate_iin(&iin)
}

#[tauri::command]
fn validate_card(card: String) -> bool {
    ValidationService::validate_card(&card)
}

#[tauri::command]
fn check_password_strength(password: String) -> serde_json::Value {
    let strength = ValidationService::check_password_strength(&password);
    serde_json::json!({
        "level": format!("{:?}", strength.level),
        "score": strength.score,
        "has_lowercase": strength.has_lowercase,
        "has_uppercase": strength.has_uppercase,
        "has_digit": strength.has_digit,
        "has_special": strength.has_special,
        "length": strength.length
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Crypto
            encrypt_data,
            decrypt_data,
            hash_password,
            verify_password,
            generate_key,
            // Geo
            calculate_distance,
            point_in_geofence,
            // Validation
            validate_phone,
            validate_email,
            validate_iin,
            validate_card,
            check_password_strength,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
