import SwiftUI

@MainActor
final class OrderDetailViewModel: ObservableObject {
    @Published var order: Order
    @Published var assignedGuard: Guard?

    init(orderId: UUID) {
        order = Order(
            id: orderId,
            title: "Охрана мероприятия",
            description: "Нужна охрана с оружием для мероприятия.",
            requiredLicenses: [.weapon, .medical],
            requiredExperience: 2,
            guardCount: 2,
            budgetMin: 1000,
            budgetMax: 2000,
            location: Location(latitude: 55.7558, longitude: 37.6173, address: "ул. Тверская, 7, Москва"),
            startTime: Date(),
            endTime: Date().addingTimeInterval(3600 * 6),
            status: .open
        )
    }

    convenience init() {
        self.init(orderId: UUID())
    }

    func load(orderId: UUID) {
        // TODO: fetch order by id
    }

    func editOrder() {}
    func cancelOrder() {}
}
