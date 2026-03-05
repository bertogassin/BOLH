// Пустое состояние: у клиента нет заказов.
import SwiftUI

struct EmptyOrdersView: View {
    @State private var isAnimating = false
    var onCreateOrder: () -> Void = {}

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            ZStack {
                Circle()
                    .fill(Color.blue.opacity(0.1))
                    .frame(width: 160, height: 160)

                Image(systemName: "doc.text.magnifyingglass")
                    .font(.system(size: 80))
                    .foregroundColor(.blue)
                    .scaleEffect(isAnimating ? 1.1 : 1)
                    .animation(
                        .easeInOut(duration: 1.5).repeatForever(autoreverses: true),
                        value: isAnimating
                    )
            }

            Text("У вас пока нет заказов")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Создайте первый заказ — мы найдём лучшего охранника за пару минут")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            VStack(alignment: .leading, spacing: 12) {
                Text("Чаще всего заказывают:")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                HStack(spacing: 8) {
                    TagView(text: "Охрана мероприятия")
                    TagView(text: "Сопровождение")
                    TagView(text: "Ночная охрана")
                }
                HStack(spacing: 8) {
                    TagView(text: "Офис")
                    TagView(text: "Склад")
                    TagView(text: "Частное лицо")
                }
            }
            .padding(.top, 8)

            Spacer()

            AnimatedButton(action: onCreateOrder) {
                Text("Создать первый заказ")
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .cornerRadius(12)
            }
            .padding(.horizontal)
            .padding(.bottom, 16)
        }
        .onAppear { isAnimating = true }
    }
}

struct TagView: View {
    let text: String
    var onTap: (() -> Void)?

    var body: some View {
        Text(text)
            .font(.caption)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color(.secondarySystemBackground))
            .cornerRadius(16)
            .onTapGesture { onTap?() }
    }
}
