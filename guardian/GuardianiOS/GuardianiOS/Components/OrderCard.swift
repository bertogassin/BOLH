import SwiftUI
import MapKit

struct OrderCard: View {
    let order: Order

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(order.title)
                    .font(.headline)
                Spacer()
                Text(order.status.displayName)
                    .font(.caption)
                    .foregroundColor(statusColor(order.status))
            }
            Text("\(order.formattedDate) • \(order.formattedTime)")
                .font(.subheadline)
                .foregroundColor(.secondary)
            if let addr = order.location.address {
                Text(addr)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            HStack {
                ForEach(order.requiredLicenses.prefix(3)) { license in
                    LicenseBadge(type: license, small: true)
                }
                if order.requiredLicenses.count > 3 {
                    Text("+\(order.requiredLicenses.count - 3)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            Button("Подробнее") {}
                .font(.subheadline)
                .foregroundColor(Color(hex: "0055FF"))
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }

    private func statusColor(_ status: OrderStatus) -> Color {
        switch status {
        case .open: return Color(hex: "0055FF")
        case .matching: return Color(hex: "FF9500")
        case .matched, .accepted: return Color(hex: "00C48C")
        case .inProgress: return Color(hex: "AF52DE")
        case .completed: return .gray
        case .cancelled: return Color(hex: "FF3B30")
        }
    }
}

struct QuickAction: Identifiable {
    let id = UUID()
    let icon: String
    let title: String
    let color: Color
}
