// Пустое состояние: у охранника нет заданий.
import SwiftUI

struct EmptyBidsView: View {
    var onCreateBid: () -> Void = {}
    var onFillLater: (() -> Void)?

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "shield.slash")
                .font(.system(size: 80))
                .foregroundColor(.orange)

            Text("У вас нет активных заданий")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Создайте задание, чтобы алгоритм мог подбирать вам заказы")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            HStack {
                Image(systemName: "rublesign.circle.fill")
                    .foregroundColor(.green)
                Text("Охранники рядом зарабатывают в среднем")
                Text("45 000 ₽/мес")
                    .fontWeight(.bold)
            }
            .font(.subheadline)
            .padding()
            .background(Color.green.opacity(0.1))
            .cornerRadius(12)

            Spacer()

            VStack(spacing: 12) {
                AnimatedButton(action: onCreateBid) {
                    Text("Создать задание")
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .cornerRadius(12)
                }

                if let onFillLater = onFillLater {
                    Button("Заполнить позже", action: onFillLater)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 16)
        }
    }
}
