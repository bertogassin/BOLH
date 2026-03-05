import SwiftUI

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var currentUser: User?
    @Published var userType: UserType = .client
    @Published var activeOrders: [Order] = []
    @Published var apiOrders: [OrderListItem] = []
    @Published var activeBids: [Bid] = []
    @Published var unreadNotifications: Int = 0
    @Published var loading = false

    func showNotifications() {}

    init(token: String?) {
        currentUser = User(
            id: UUID(),
            email: "user@example.com",
            phone: "",
            userType: .client,
            firstName: "",
            lastName: "",
            avatarUrl: nil,
            verified: false,
            reputationScore: 0
        )
        userType = .client
        if let token = token {
            loading = true
            Task {
                do {
                    let list = try await ApiClient.getOrders(token: token)
                    await MainActor.run { apiOrders = list }
                } catch {}
                await MainActor.run { loading = false }
            }
        }
    }
}
