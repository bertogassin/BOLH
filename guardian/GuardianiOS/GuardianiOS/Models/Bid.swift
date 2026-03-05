import Foundation

struct Bid: Identifiable, Codable {
    let id: UUID
    let bidderType: UserType
    let bidderId: UUID
    let title: String
    let description: String
    let availableLicenses: [LicenseType]
    let workLocation: Location
    let workRadius: Double
    let pricePerHour: Double
    let validUntil: Date
    var active: Bool
}
