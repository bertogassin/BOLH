// Пустое состояние чата: нет сообщений.
import SwiftUI

struct EmptyChatView: View {
    let userName: String
    var onQuickReply: ((String) -> Void)?

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 60))
                .foregroundColor(.blue.opacity(0.5))

            Text("Нет сообщений")
                .font(.title3)
                .fontWeight(.medium)

            Text("Напишите \(userName) первым")
                .font(.body)
                .foregroundColor(.secondary)

            VStack(alignment: .leading, spacing: 8) {
                Text("Быстрые сообщения:")
                    .font(.caption)
                    .foregroundColor(.secondary)

                HStack {
                    QuickReplyButton(text: "Здравствуйте!", action: onQuickReply)
                    QuickReplyButton(text: "Когда будете?", action: onQuickReply)
                }
                HStack {
                    QuickReplyButton(text: "Спасибо", action: onQuickReply)
                    QuickReplyButton(text: "До связи", action: onQuickReply)
                }
            }
            .padding(.top, 8)
        }
    }
}

struct QuickReplyButton: View {
    let text: String
    var action: ((String) -> Void)?

    var body: some View {
        Button {
            action?(text)
        } label: {
            Text(text)
                .font(.caption)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(.secondarySystemBackground))
                .cornerRadius(16)
        }
        .buttonStyle(.plain)
    }
}
