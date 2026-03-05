// Контекстная подсказка (tip) с действием и свайпом для закрытия.
import SwiftUI

struct Tip: Identifiable {
    let id: String
    let title: String
    let message: String
    let icon: String
}

struct TipView: View {
    let tip: Tip
    let onAction: () -> Void
    let onDismiss: () -> Void

    @State private var offset: CGFloat = 0

    var body: some View {
        HStack(spacing: 16) {
            Circle()
                .fill(Color.blue.opacity(0.1))
                .frame(width: 40, height: 40)
                .overlay(Image(systemName: tip.icon).foregroundColor(.blue))

            VStack(alignment: .leading, spacing: 4) {
                Text(tip.title)
                    .font(.headline)
                Text(tip.message)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button("OK", action: onAction)
                .buttonStyle(.borderedProminent)
                .controlSize(.small)

            Button {
                onDismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.1), radius: 10, x: 0, y: 5)
        )
        .padding(.horizontal)
        .offset(x: offset)
        .gesture(
            DragGesture()
                .onChanged { offset = $0.translation.width }
                .onEnded { gesture in
                    if abs(gesture.translation.width) > 100 {
                        withAnimation { onDismiss() }
                    } else {
                        withAnimation { offset = 0 }
                    }
                }
        )
        .transition(.move(edge: .top).combined(with: .opacity))
    }
}
