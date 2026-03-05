import SwiftUI

/// Шрифты с учётом языка (CJK, арабский, кавказские и т.д.).
struct LanguageAwareFont: ViewModifier {
    let style: Font.TextStyle
    @ObservedObject var languageManager = LanguageManager.shared

    private var pointSize: CGFloat {
        switch style {
        case .largeTitle: return 34
        case .title: return 28
        case .title2: return 22
        case .title3: return 20
        case .headline: return 17
        case .body: return 17
        case .callout: return 16
        case .subheadline: return 15
        case .footnote: return 13
        case .caption: return 12
        case .caption2: return 11
        @unknown default: return 17
        }
    }

    func body(content: Content) -> some View {
        Group {
            switch languageManager.currentLanguage {
            case "zh", "ja", "ko":
                content.font(.custom("PingFangSC-Regular", size: pointSize))
            case "ar", "fa", "ur":
                content.font(.custom("NotoNaskhArabic-Regular", size: pointSize))
            case "ce", "av", "inh", "lez":
                content.font(.custom("NotoSansCaucasianAlbanian-Regular", size: pointSize))
            default:
                content.font(.system(style))
            }
        }
    }
}

extension View {
    func languageAwareFont(_ style: Font.TextStyle) -> some View {
        modifier(LanguageAwareFont(style: style))
    }
}
