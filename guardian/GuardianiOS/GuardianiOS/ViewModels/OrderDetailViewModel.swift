import SwiftUI

@MainActor
final class OrderDetailViewModel: ObservableObject {
    @Published var order: Order
    @Published var assignedGuard: Guard?
    @Published var isLoading = false
    @Published var errorMessage: String?

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

    func load(orderId: UUID) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        guard let token = UserDefaults.standard.string(forKey: "guardian_ios_token"), !token.isEmpty else {
            errorMessage = "Требуется авторизация."
            return
        }

        do {
            order = try await ApiClient.getOrderById(token: token, orderId: orderId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func editOrder() {}
    func cancelOrder() {}
}
