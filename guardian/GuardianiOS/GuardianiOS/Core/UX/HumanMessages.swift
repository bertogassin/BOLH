// Система человечных сообщений (microcopy) для всех состояний.
import SwiftUI

enum HumanMessage {
    case orderCreated
    case orderMatched
    case orderAccepted
    case orderCompleted
    case error(String)
    case waiting
    case emptyState(UserType)

    var title: String {
        switch self {
        case .orderCreated: return "Заказ создан!"
        case .orderMatched: return "Ура, нашли!"
        case .orderAccepted: return "Всё подтверждено!"
        case .orderCompleted: return "Спасибо за заказ!"
        case .error: return "Что-то пошло не так"
        case .waiting: return "Минуточку..."
        case .emptyState(.client): return "Пока тихо"
        case .emptyState(.guard_): return "Нет заданий"
        case .emptyState(.agency): return "Нет активных"
        }
    }

    var body: String {
        switch self {
        case .orderCreated:
            return "Ищем лучшего охранника. Обычно это 1–2 минуты."
        case .orderMatched:
            return "Исполнитель подобран. Посмотрите профиль и подтвердите."
        case .orderAccepted:
            return "Охранник ждёт. Свяжитесь в чате перед началом."
        case .orderCompleted:
            return "Оплата прошла. Чек отправили на email."
        case .error(let detail):
            return detail.isEmpty ? "Попробуйте ещё раз или напишите в поддержку." : detail
        case .waiting:
            return "Подождите, обрабатываем запрос."
        case .emptyState(.client):
            return "Создайте заказ — подберём охранника за пару минут."
        case .emptyState(.guard_):
            return "Создайте задание, чтобы получать заказы."
        case .emptyState(.agency):
            return "Добавьте сотрудников и задания."
        }
    }

    var icon: String {
        switch self {
        case .orderCreated: return "checkmark.circle.fill"
        case .orderMatched: return "person.badge.plus"
        case .orderAccepted: return "hand.thumbsup.fill"
        case .orderCompleted: return "star.fill"
        case .error: return "exclamationmark.triangle.fill"
        case .waiting: return "clock.fill"
        case .emptyState: return "tray"
        }
    }
}
