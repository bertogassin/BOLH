// Доступность: подписи для VoiceOver и живые регионы.
import SwiftUI

struct AccessibleOrderCardModifier: ViewModifier {
    let orderTitle: String
    let orderAddress: String
    let orderDate: String

    func body(content: Content) -> some View {
        content
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Заказ: \(orderTitle)")
            .accessibilityValue("Адрес: \(orderAddress), Время: \(orderDate)")
            .accessibilityHint("Дважды нажмите для просмотра деталей")
            .accessibilityAddTraits(.isButton)
    }
}

extension View {
    func accessibleOrderCard(orderTitle: String, orderAddress: String, orderDate: String) -> some View {
        modifier(AccessibleOrderCardModifier(
            orderTitle: orderTitle,
            orderAddress: orderAddress,
            orderDate: orderDate
        ))
    }
}

/// Обновления текста озвучиваются VoiceOver (живой регион).
struct LiveRegionView: View {
    let status: String

    var body: some View {
        Text(status)
            .font(.headline)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(status)
    }
}
