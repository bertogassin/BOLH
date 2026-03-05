import Foundation

enum ApiClient {
    static let baseURL = "http://localhost:8080"

    static func login(email: String, password: String) async throws -> (token: String, userId: String) {
        let url = URL(string: "\(baseURL)/api/v1/auth/login")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else {
            throw NSError(domain: "ApiClient", code: 401, userInfo: [NSLocalizedDescriptionKey: "Login failed"])
        }
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let token = json?["token"] as? String else { throw NSError(domain: "ApiClient", code: -1, userInfo: [NSLocalizedDescriptionKey: "No token"]) }
        let user = json?["user"] as? [String: Any]
        let userId = user?["id"] as? String ?? ""
        return (token, userId)
    }

    static func getOrders(token: String) async throws -> [OrderListItem] {
        let url = URL(string: "\(baseURL)/api/v1/orders")!
        var req = URLRequest(url: url)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else {
            throw NSError(domain: "ApiClient", code: (resp as? HTTPURLResponse)?.statusCode ?? 0, userInfo: [NSLocalizedDescriptionKey: "Orders failed"])
        }
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let arr = json?["orders"] as? [[String: Any]] ?? []
        return arr.compactMap { o in
            guard let id = o["id"] as? String, let title = o["title"] as? String else { return nil }
            return OrderListItem(id: id, title: title, status: o["status"] as? String ?? "unknown")
        }
    }
}

struct OrderListItem: Identifiable {
    let id: String
    let title: String
    let status: String
}
