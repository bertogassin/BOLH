import Foundation

final class TokenStore: ObservableObject {
    private let key = "guardian_ios_token"
    @Published var token: String? {
        didSet { UserDefaults.standard.set(token, forKey: key) }
    }

    init() {
        self.token = UserDefaults.standard.string(forKey: key)
    }

    func clear() {
        token = nil
    }
}
