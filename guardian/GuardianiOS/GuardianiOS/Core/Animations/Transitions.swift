import SwiftUI

struct SlideTransition: ViewModifier {
    let isPresented: Bool

    func body(content: Content) -> some View {
        content
            .offset(y: isPresented ? 0 : UIScreen.main.bounds.height)
            .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isPresented)
    }
}

struct CardAppear: ViewModifier {
    @State private var appeared = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(appeared ? 1 : 0.9)
            .opacity(appeared ? 1 : 0)
            .onAppear {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                    appeared = true
                }
            }
    }
}

struct PulsatingView: View {
    @State private var isAnimating = false

    var body: some View {
        Circle()
            .fill(Color(hex: "0055FF"))
            .frame(width: 12, height: 12)
            .scaleEffect(isAnimating ? 1.5 : 1)
            .opacity(isAnimating ? 0 : 1)
            .onAppear {
                withAnimation(
                    .easeInOut(duration: 1).repeatForever(autoreverses: false)
                ) {
                    isAnimating = true
                }
            }
    }
}
