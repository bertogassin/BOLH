// Тактильный отклик (Haptics) для микровзаимодействий.
import SwiftUI
import UIKit

final class HapticManager {
    static let shared = HapticManager()

    private init() {}

    /// Лёгкое нажатие на кнопку
    func buttonTap() {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
    }

    /// Успешное действие (создание заказа)
    func success() {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
    }

    /// Ошибка
    func error() {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.error)
    }

    /// Предупреждение
    func warning() {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.warning)
    }

    /// Найден исполнитель (радостная вибрация)
    func matchFound() {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
            let impact = UIImpactFeedbackGenerator(style: .medium)
            impact.impactOccurred()
        }
    }
}
