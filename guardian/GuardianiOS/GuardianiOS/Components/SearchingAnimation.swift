// Анимация поиска исполнителя: пульсирующие круги + микротекст.
import SwiftUI

struct SearchingAnimation: View {
    @State private var isAnimating = false
    var guardsConsidering: Int = 3
    var onMatchFound: (() -> Void)?

    var body: some View {
        VStack(spacing: 20) {
            ZStack {
                Circle()
                    .fill(Color.blue.opacity(0.2))
                    .frame(width: 120, height: 120)
                    .scaleEffect(isAnimating ? 1.5 : 1)
                    .opacity(isAnimating ? 0 : 1)
                    .animation(
                        .easeInOut(duration: 2).repeatForever(autoreverses: false),
                        value: isAnimating
                    )

                Circle()
                    .fill(Color.blue.opacity(0.3))
                    .frame(width: 100, height: 100)
                    .scaleEffect(isAnimating ? 1.3 : 1)
                    .opacity(isAnimating ? 0 : 0.8)
                    .animation(
                        .easeInOut(duration: 2).repeatForever(autoreverses: false).delay(0.3),
                        value: isAnimating
                    )

                Circle()
                    .fill(Color.blue)
                    .frame(width: 80, height: 80)

                Image(systemName: "magnifyingglass")
                    .font(.system(size: 40))
                    .foregroundColor(.white)
                    .rotationEffect(.degrees(isAnimating ? 360 : 0))
                    .animation(
                        .linear(duration: 2).repeatForever(autoreverses: false),
                        value: isAnimating
                    )
            }

            Text("Ищем исполнителя")
                .font(.title2)
                .fontWeight(.semibold)

            HStack(spacing: 4) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(Color.green)
                        .frame(width: 8, height: 8)
                        .opacity(isAnimating ? 1 : 0.3)
                        .animation(
                            .easeInOut(duration: 0.8).repeatForever().delay(Double(index) * 0.2),
                            value: isAnimating
                        )
                }
                Text("\(guardsConsidering) охранника рассматривают заказ")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.leading, 4)
            }

            ProgressView(value: 0.7)
                .progressViewStyle(.linear)
                .tint(.blue)
                .frame(width: 200)

            Text("Обычно занимается 1–2 минуты")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .onAppear {
            isAnimating = true
        }
    }
}
