import SwiftUI

/// Устанавливает направление интерфейса (LTR/RTL) в зависимости от текущего языка.
struct RTLSupport: ViewModifier {
    @ObservedObject var languageManager = LanguageManager.shared

    var isRTL: Bool {
        languageManager.isRTL
    }

    func body(content: Content) -> some View {
        content
            .environment(\.layoutDirection, isRTL ? .rightToLeft : .leftToRight)
    }
}

extension View {
    func withRTLSupport() -> some View {
        modifier(RTLSupport())
    }
}
