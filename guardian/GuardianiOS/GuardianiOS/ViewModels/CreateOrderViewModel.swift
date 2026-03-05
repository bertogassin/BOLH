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

    func createOrder() {
        guard isValid else { return }
        isLoading = true
        errorMessage = nil
        // TODO: API call to POST /api/v1/orders
        isLoading = false
    }
}
