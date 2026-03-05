import SwiftUI
import MapKit

@MainActor
final class OrderMapViewModel: ObservableObject {
    @Published var orders: [Order] = []
    @Published var showingOrderForm = false

    func centerOnUser() {
        // TODO: CLLocationManager, set region to user location
    }

    func createOrder() {
        showingOrderForm = true
    }
}
