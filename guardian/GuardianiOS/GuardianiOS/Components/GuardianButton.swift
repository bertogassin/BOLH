// Атомы: Primary, Secondary, Destructive. Высота 56px, тактильный отклик.

import SwiftUI

enum GuardianButtonStyle {
    case primary
    case secondary
    case destructive
}

struct GuardianButton: View {
    let title: String
    let style: GuardianButtonStyle
    let action: () -> Void
    var isEnabled: Bool = true

    var body: some View {
        Button(action: {
            if isEnabled {
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
                action()
            }
        }) {
            Text(title)
                .font(.headline)
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .foregroundColor(foregroundColor)
                .background(backgroundColor)
                .overlay(overlay)
                .cornerRadius(12)
                .opacity(isEnabled ? 1 : 0.5)
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
    }

    private var foregroundColor: Color {
        switch style {
        case .primary, .destructive: return .white
        case .secondary: return Color(hex: "0055FF")
        }
    }

    private var backgroundColor: Color {
        switch style {
        case .primary: return Color(hex: "0055FF")
        case .secondary: return Color.clear
        case .destructive: return Color(hex: "FF3B30")
        }
    }

    @ViewBuilder
    private var overlay: some View {
        if style == .secondary {
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(hex: "0055FF"), lineWidth: 2)
        } else {
            EmptyView()
        }
    }
}

#Preview {
    VStack(spacing: 16) {
        GuardianButton(title: "Создать заказ", style: .primary) {}
        GuardianButton(title: "Отмена", style: .secondary) {}
        GuardianButton(title: "Удалить", style: .destructive) {}
    }
    .padding()
}
