import SwiftUI
import MapKit
import CoreLocation

@MainActor
final class OrderMapViewModel: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var orders: [Order] = []
    @Published var showingOrderForm = false
    @Published var userCoordinate: CLLocationCoordinate2D?
    @Published var locationError: String?

    private let locationManager = CLLocationManager()

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
    }

    func centerOnUser() {
        let status = locationManager.authorizationStatus
        switch status {
        case .authorizedWhenInUse, .authorizedAlways:
            locationManager.requestLocation()
            locationError = nil
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
            locationError = nil
        case .restricted, .denied:
            locationError = "Нет доступа к геолокации. Разрешите доступ в настройках."
        @unknown default:
            locationError = "Не удалось определить доступ к геолокации."
        }
    }

    func createOrder() {
        showingOrderForm = true
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            let status = manager.authorizationStatus
            if status == .authorizedWhenInUse || status == .authorizedAlways {
                manager.requestLocation()
            } else if status == .denied || status == .restricted {
                locationError = "Нет доступа к геолокации. Разрешите доступ в настройках."
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let last = locations.last else { return }
        Task { @MainActor in
            userCoordinate = last.coordinate
            locationError = nil
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            locationError = error.localizedDescription
        }
    }
}
