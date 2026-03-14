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

    static func getOrderById(token: String, orderId: UUID) async throws -> Order {
        let url = URL(string: "\(baseURL)/api/v1/orders/\(orderId.uuidString)")!
        var req = URLRequest(url: url)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else {
            throw NSError(
                domain: "ApiClient",
                code: (resp as? HTTPURLResponse)?.statusCode ?? 0,
                userInfo: [NSLocalizedDescriptionKey: "Order loading failed"]
            )
        }
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let rawOrder = (json?["order"] as? [String: Any]) ?? [:]
        guard let parsed = mapOrder(rawOrder) else {
            throw NSError(domain: "ApiClient", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid order payload"])
        }
        return parsed
    }

    static func createOrder(token: String, request: CreateOrderRequest) async throws -> Order {
        let url = URL(string: "\(baseURL)/api/v1/orders")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let payload: [String: Any] = [
            "title": request.title,
            "description": request.description,
            "required_licenses": request.requiredLicenses,
            "budget_min": request.budgetMin,
            "budget_max": request.budgetMax,
            "latitude": request.latitude,
            "longitude": request.longitude,
            "start_time": request.startTimeISO8601,
            "end_time": request.endTimeISO8601,
            "guard_count": request.guardCount
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, http.statusCode == 201 else {
            let details = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            throw NSError(
                domain: "ApiClient",
                code: (resp as? HTTPURLResponse)?.statusCode ?? 0,
                userInfo: [NSLocalizedDescriptionKey: details ?? "Order creation failed"]
            )
        }

        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let rawOrder = (json?["order"] as? [String: Any]) ?? [:]
        guard let parsed = mapOrder(rawOrder) else {
            throw NSError(domain: "ApiClient", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid order payload"])
        }
        return parsed
    }

    private static func mapOrder(_ raw: [String: Any]) -> Order? {
        guard
            let idRaw = raw["id"] as? String,
            let id = UUID(uuidString: idRaw),
            let title = raw["title"] as? String
        else { return nil }

        let description = raw["description"] as? String ?? ""
        let requiredRaw = raw["required_licenses"] as? [String] ?? []
        let requiredLicenses = requiredRaw.map(mapLicenseType)
        let requiredExperience = 0
        let guardCount = raw["guard_count"] as? Int ?? 1
        let budgetMin = raw["budget_min"] as? Double ?? 0
        let budgetMax = raw["budget_max"] as? Double ?? budgetMin
        let latitude = raw["latitude"] as? Double ?? 55.7558
        let longitude = raw["longitude"] as? Double ?? 37.6173
        let startTime = parseISODate(raw["start_time"]) ?? Date()
        let endTime = parseISODate(raw["end_time"]) ?? Date().addingTimeInterval(3600)
        let status = mapOrderStatus(raw["status"] as? String)

        return Order(
            id: id,
            title: title,
            description: description,
            requiredLicenses: requiredLicenses,
            requiredExperience: requiredExperience,
            guardCount: max(1, guardCount),
            budgetMin: budgetMin,
            budgetMax: max(budgetMin, budgetMax),
            location: Location(latitude: latitude, longitude: longitude, address: nil),
            startTime: startTime,
            endTime: endTime > startTime ? endTime : startTime.addingTimeInterval(3600),
            status: status
        )
    }

    private static func parseISODate(_ value: Any?) -> Date? {
        guard let raw = value as? String else { return nil }
        return Date.iso8601Full.date(from: raw) ?? Date.iso8601Internet.date(from: raw)
    }

    private static func mapLicenseType(_ value: String) -> LicenseType {
        switch value.lowercased() {
        case "weapon":
            return .weapon
        case "medical":
            return .medical
        case "driving":
            return .driving
        case "aviation":
            return .aviation
        case "maritime":
            return .maritime
        case "crowd_control":
            return .crowd_control
        case "k9":
            return .k9
        case "technical":
            return .technical
        case "security":
            return .security
        default:
            return .other
        }
    }

    private static func mapOrderStatus(_ value: String?) -> OrderStatus {
        switch (value ?? "").lowercased() {
        case "open", "published", "active":
            return .open
        case "matching":
            return .matching
        case "matched":
            return .matched
        case "accepted":
            return .accepted
        case "in_progress":
            return .inProgress
        case "completed":
            return .completed
        case "cancelled":
            return .cancelled
        default:
            return .open
        }
    }
}

struct OrderListItem: Identifiable {
    let id: String
    let title: String
    let status: String
}

struct CreateOrderRequest {
    let title: String
    let description: String
    let requiredLicenses: [String]
    let budgetMin: Double
    let budgetMax: Double
    let latitude: Double
    let longitude: Double
    let startTime: Date
    let endTime: Date
    let guardCount: Int

    var startTimeISO8601: String { Date.iso8601Internet.string(from: startTime) }
    var endTimeISO8601: String { Date.iso8601Internet.string(from: endTime) }
}

private extension Date {
    static let iso8601Internet: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static let iso8601Full: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
