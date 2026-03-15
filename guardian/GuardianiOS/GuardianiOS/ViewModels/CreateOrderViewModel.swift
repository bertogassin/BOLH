import Foundation
import CoreLocation

@MainActor
final class CreateOrderViewModel: ObservableObject {
    @Published var title = ""
    @Published var descriptionText = ""
    @Published var selectedLicenses: Set<LicenseType> = []
    @Published var selectedLicenseTypes: Set<String> = []
    @Published var guardCount = 1
    @Published var requiredExperience = 0
    @Published var specialRequirements = ""
    @Published var address = ""
    @Published var budgetMin: Double = 0
    @Published var budgetMax: Double = 1000
    @Published var location: CLLocationCoordinate2D?
    @Published var startTime = Date()
    @Published var endTime = Date().addingTimeInterval(3600)
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var createdOrder: Order?

    var isValid: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
            && budgetMin >= 0
            && budgetMax > budgetMin
            && endTime > startTime
    }

    func toggleLicense(_ license: LicenseType) {
        if selectedLicenses.contains(license) {
            selectedLicenses.remove(license)
        } else {
            selectedLicenses.insert(license)
        }
    }

    func createOrder() async -> Bool {
        guard isValid else {
            errorMessage = "Проверьте обязательные поля и диапазон времени/бюджета."
            return false
        }
        isLoading = true
        errorMessage = nil

        defer { isLoading = false }

        guard let token = UserDefaults.standard.string(forKey: "guardian_ios_token"), !token.isEmpty else {
            errorMessage = "Требуется авторизация."
            return false
        }

        let coordinate = location ?? CLLocationCoordinate2D(latitude: 55.7558, longitude: 37.6173)
        let request = CreateOrderRequest(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            description: descriptionText.trimmingCharacters(in: .whitespacesAndNewlines),
            requiredLicenses: selectedLicenseTypes.sorted(),
            budgetMin: budgetMin,
            budgetMax: budgetMax,
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            startTime: startTime,
            endTime: endTime,
            guardCount: max(1, guardCount)
        )

        do {
            createdOrder = try await ApiClient.createOrder(token: token, request: request)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}
