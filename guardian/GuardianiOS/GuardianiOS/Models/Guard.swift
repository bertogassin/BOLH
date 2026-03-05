import Foundation

struct Guard: Identifiable {
    let id: UUID
    let firstName: String
    let lastName: String
    var avatarUrl: URL?
    var rating: Double
    var reviewCount: Int
    var licenses: [LicenseType]
}
