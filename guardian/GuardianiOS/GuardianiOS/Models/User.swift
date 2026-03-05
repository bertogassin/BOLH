import Foundation

enum UserType: String, Codable, CaseIterable {
    case client
    case guard_
    case agency

    enum CodingKeys: String, CodingKey {
        case client, agency
        case guard_ = "guard"
    }
}

struct User: Identifiable, Codable {
    let id: UUID
    let email: String
    let phone: String
    let userType: UserType
    let firstName: String
    let lastName: String
    var avatarUrl: URL?
    var verified: Bool
    var reputationScore: Double
}
