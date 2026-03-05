// Индикатор офлайн-режима и количества отложенных действий.
import SwiftUI

struct OfflineIndicator: View {
    let isOnline: Bool
    let pendingCount: Int

    var body: some View {
        if !isOnline {
            HStack {
                Image(systemName: "wifi.slash")
                Text("Вы офлайн. Изменения сохранятся")
                Spacer()
                if pendingCount > 0 {
                    Text("\(pendingCount)")
                        .padding(6)
                        .background(Color.orange)
                        .clipShape(Circle())
                        .font(.caption)
                }
            }
            .font(.caption)
            .padding(8)
            .background(Color.orange.opacity(0.2))
            .cornerRadius(8)
            .padding(.horizontal)
            .transition(.move(edge: .top))
        }
    }
}
