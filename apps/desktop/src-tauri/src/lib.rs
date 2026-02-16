// BOLH Desktop App - Tauri Backend Library
// Same core APIs as mobile (crypto, geo, validation)

use bolh_core::{
    crypto::CryptoService,
    geo::GeoService,
    validation::ValidationService,
};

#[tauri::command]
fn encrypt_data(plaintext: String, key: String) -> Result<String, String> {
    CryptoService::encrypt_aes256(&plaintext, &key).map_err(|e| e.to_string())
}

#[tauri::command]
fn decrypt_data(ciphertext: String, key: String) -> Result<String, String> {
    CryptoService::decrypt_aes256(&ciphertext, &key).map_err(|e| e.to_string())
}

#[tauri::command]
fn hash_password(password: String) -> Result<String, String> {
    CryptoService::hash_password(&password).map_err(|e| e.to_string())
}

#[tauri::command]
fn verify_password(password: String, hash: String) -> bool {
    CryptoService::verify_password(&password, &hash)
}

#[tauri::command]
fn generate_key() -> String {
    CryptoService::generate_key()
}

#[tauri::command]
fn calculate_distance(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    GeoService::calculate_distance(lat1, lng1, lat2, lng2)
}

#[tauri::command]
fn validate_phone(phone: String) -> bool {
    ValidationService::validate_phone_kz(&phone)
}

#[tauri::command]
fn validate_email(email: String) -> bool {
    ValidationService::validate_email(&email)
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            encrypt_data,
            decrypt_data,
            hash_password,
            verify_password,
            generate_key,
            calculate_distance,
            validate_phone,
            validate_email,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
