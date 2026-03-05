// Анимация нажатия кнопки: scale + haptic.
import SwiftUI

struct AnimatedButton<Content: View>: View {
    let action: () -> Void
    @ViewBuilder let content: Content

    @State private var scale: CGFloat = 1
    @State private var opacity: Double = 1
    @State private var pressed = false

    init(action: @escaping () -> Void, @ViewBuilder content: () -> Content) {
        self.action = action
        self.content = content()
    }

    var body: some View {
        Button {
            HapticManager.shared.buttonTap()
            withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                scale = 0.95
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                    scale = 1
                }
                action()
            }
        } label: {
            content
                .scaleEffect(scale)
                .opacity(opacity)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    if !pressed {
                        pressed = true
                        withAnimation(.easeInOut(duration: 0.1)) {
                            scale = 0.97
                            opacity = 0.9
                        }
                    }
                }
                .onEnded { _ in
                    pressed = false
                    withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                        scale = 1
                        opacity = 1
                    }
                }
        )
    }
}
