// Модель заказа. Бюджет и цены скрыты от исполнителей в API; на клиенте отображаем только свою вилку.

import Foundation

struct Order: Identifiable, Codable {
    let id: UUID
    let title: String
    let description: String
    let requiredLicenses: [LicenseType]
    let requiredExperience: Int
    let guardCount: Int
    let budgetMin: Double
    let budgetMax: Double
    let location: Location
    let startTime: Date
    let endTime: Date
    let status: OrderStatus
}

extension Order {
    var duration: TimeInterval {
        endTime.timeIntervalSince(startTime)
    }

    var formattedDuration: String {
        let formatter = DateComponentsFormatter()
        formatter.allowedUnits = [.hour, .minute]
        formatter.unitsStyle = .abbreviated
        return formatter.string(from: duration) ?? ""
    }

    var formattedDate: String {
        let f = DateFormatter()
        f.dateStyle = .medium
        return f.string(from: startTime)
    }

    var formattedTime: String {
        let f = DateFormatter()
        f.timeStyle = .short
        return "\(f.string(from: startTime)) – \(f.string(from: endTime))"
    }
}

enum OrderStatus: String, Codable, CaseIterable {
    case open
    case matching
    case matched
    case accepted
    case inProgress
    case completed
    case cancelled

    var displayName: String {
        switch self {
        case .open: return "Открыт"
        case .matching: return "Подбор"
        case .matched: return "Исполнитель найден"
        case .accepted: return "Подтвержден"
        case .inProgress: return "В работе"
        case .completed: return "Завершен"
        case .cancelled: return "Отменен"
        }
    }
}

enum LicenseType: String, Codable, CaseIterable, Identifiable {
    case weapon
    case medical
    case driving
    case aviation
    case maritime
    case crowd_control
    case k9
    case technical
    case security
    case other

    var id: Self { self }

    var displayName: String {
        switch self {
        case .weapon: return "Оружие"
        case .medical: return "Медицина"
        case .driving: return "Водительские"
        case .aviation: return "Авиация"
        case .maritime: return "Морская"
        case .crowd_control: return "Работа с толпой"
        case .k9: return "Кинолог"
        case .technical: return "Технические"
        case .security: return "Охрана"
        case .other: return "Другое"
        }
    }

    var icon: String {
        switch self {
        case .weapon: return "🔫"
        case .medical: return "💊"
        case .driving: return "🚗"
        case .aviation: return "🛩️"
        case .maritime: return "⚓"
        case .crowd_control: return "👥"
        case .k9: return "🐕"
        case .technical: return "📡"
        case .security: return "🛡️"
        case .other: return "📄"
        }
    }
}

struct Requirements: Codable {
    let title: String
    let description: String
    let requiredLicenses: [LicenseType]
    let guardCount: Int
}
