import SwiftUI

struct LicenseBadge: View {
    let type: LicenseType
    var small: Bool = false

    var body: some View {
        HStack(spacing: 4) {
            Text(type.icon)
                .font(small ? .caption2 : .caption)
            if !small {
                Text(type.displayName)
                    .font(.caption)
            }
        }
        .padding(.horizontal, small ? 6 : 8)
        .padding(.vertical, 4)
        .background(Color(hex: "0055FF").opacity(0.15))
        .foregroundColor(Color(hex: "0055FF"))
        .cornerRadius(8)
    }
}

struct LicenseSelectCard: View {
    let license: (type: String, name: String, icon: String)
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 8) {
                Text(license.icon)
                    .font(.title)
                Text(license.name)
                    .font(.caption)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(isSelected ? Color(hex: "0055FF").opacity(0.2) : Color(.secondarySystemBackground))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color(hex: "0055FF") : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(.plain)
    }
}
