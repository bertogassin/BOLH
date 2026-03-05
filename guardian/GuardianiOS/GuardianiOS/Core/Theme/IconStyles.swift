import SwiftUI

struct IconGradient {
    static let primary = LinearGradient(
        colors: [Color(hex: "0055FF"), Color(hex: "0044CC")],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let success = LinearGradient(
        colors: [Color(hex: "00C48C"), Color(hex: "00A875")],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let warning = LinearGradient(
        colors: [Color(hex: "FF9500"), Color(hex: "E68600")],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let error = LinearGradient(
        colors: [Color(hex: "FF3B30"), Color(hex: "E6352B")],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

struct IconShadow: ViewModifier {
    func body(content: Content) -> some View {
        content
            .shadow(color: Color.black.opacity(0.15), radius: 8, x: 0, y: 4)
            .shadow(color: Color.black.opacity(0.1), radius: 2, x: 0, y: 2)
    }
}

extension View {
    func iconShadow() -> some View {
        modifier(IconShadow())
    }
}

struct ProfessionalIconWithBadge: View {
    let icon: GuardianIcon
    let badgeCount: Int

    var body: some View {
        ZStack(alignment: .topTrailing) {
            ProfessionalIcon(icon: icon, size: 24)

            if badgeCount > 0 {
                Text("\(min(badgeCount, 99))")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.white)
                    .padding(4)
                    .background(
                        LinearGradient(
                            colors: [Color.red, Color.red.opacity(0.8)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .clipShape(Circle())
                    .offset(x: 6, y: -6)
            }
        }
    }
}
