// GUARDIAN — светлая и тёмная темы. Следование системной теме.

import SwiftUI

struct GuardianTheme {
    let background: Color
    let surface: Color
    let primary: Color
    let secondary: Color
    let text: Color
    let textSecondary: Color
    let border: Color
    let success: Color
    let error: Color
    let warning: Color
}

extension GuardianTheme {
    static let light = GuardianTheme(
        background: Color(hex: "F8F9FC"),
        surface: .white,
        primary: Color(hex: "0055FF"),
        secondary: Color(hex: "6C707B"),
        text: Color(hex: "1A1E2B"),
        textSecondary: Color(hex: "6C707B"),
        border: Color(hex: "E5E7EB"),
        success: Color(hex: "00C48C"),
        error: Color(hex: "FF3B30"),
        warning: Color(hex: "FF9500")
    )

    static let dark = GuardianTheme(
        background: Color(hex: "0A0C10"),
        surface: Color(hex: "1C1E24"),
        primary: Color(hex: "0055FF"),
        secondary: Color(hex: "9A9DA5"),
        text: .white,
        textSecondary: Color(hex: "9A9DA5"),
        border: Color(hex: "2C2E34"),
        success: Color(hex: "00C48C"),
        error: Color(hex: "FF3B30"),
        warning: Color(hex: "FF9500")
    )
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// Environment key для темы
struct GuardianThemeKey: EnvironmentKey {
    static let defaultValue: GuardianTheme = .light
}

extension EnvironmentValues {
    var guardianTheme: GuardianTheme {
        get { self[GuardianThemeKey.self] }
        set { self[GuardianThemeKey.self] = newValue }
    }
}
