import SwiftUI

/// Полный набор иконок платформы Guardian (имена совпадают с Assets / SVG).
enum GuardianIcon: String, CaseIterable {
    case home = "home"
    case orders = "orders"
    case bids = "bids"
    case profile = "profile"
    case settings = "settings"
    case support = "support"

    case add = "add"
    case edit = "edit"
    case delete = "delete"
    case save = "save"
    case search = "search"
    case filter = "filter"
    case share = "share"
    case download = "download"
    case upload = "upload"
    case print = "print"

    case success = "success"
    case warning = "warning"
    case error = "error"
    case info = "info"
    case pending = "pending"
    case verified = "verified"
    case blocked = "blocked"

    case weapon = "weapon"
    case medical = "medical"
    case driving = "driving"
    case aviation = "aviation"
    case maritime = "maritime"
    case crowd = "crowd"
    case k9 = "k9"
    case technical = "technical"

    case payment = "payment"
    case card = "card"
    case cash = "cash"
    case wallet = "wallet"
    case invoice = "invoice"
    case receipt = "receipt"

    case chat = "chat"
    case call = "call"
    case video = "video"
    case email = "email"
    case notification = "notification"

    case map = "map"
    case location = "location"
    case nearby = "nearby"
    case route = "route"

    case calendar = "calendar"
    case clock = "clock"
    case timer = "timer"
    case alarm = "alarm"

    case document = "document"
    case contract = "contract"
    case license = "license"
    case report = "report"

    case shield = "shield"
    case lock = "lock"
    case unlock = "unlock"
    case fingerprint = "fingerprint"
    case faceid = "faceid"

    case user = "user"
    case users = "users"
    case guardIcon = "guard"
    case agency = "agency"
    case client = "client"

    case star = "star"
    case rating = "rating"
    case review = "review"
    case like = "like"
    case dislike = "dislike"

    var image: Image {
        Image(rawValue, bundle: .main)
    }
}

struct ProfessionalIcon: View {
    let icon: GuardianIcon
    var size: CGFloat = 24
    var color: Color = .primary

    var body: some View {
        icon.image
            .resizable()
            .renderingMode(.template)
            .aspectRatio(contentMode: .fit)
            .frame(width: size, height: size)
            .foregroundColor(color)
    }
}
