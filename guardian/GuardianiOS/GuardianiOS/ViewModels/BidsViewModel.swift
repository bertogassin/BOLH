import SwiftUI

@MainActor
final class BidsViewModel: ObservableObject {
    @Published var activeBids: [Bid] = []
    @Published var historyBids: [Bid] = []
    @Published var showCreateBidSheet = false

    func deactivateBid(_ id: UUID) {}
}
