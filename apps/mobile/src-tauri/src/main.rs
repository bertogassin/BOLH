// Guardio Mobile App - Tauri Backend
// Desktop entry point

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    guardio_mobile::run();
}
