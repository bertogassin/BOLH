import SwiftUI

/// Управление языком и загрузка переводов с CDN/локально.
final class LanguageManager: ObservableObject {
    static let shared = LanguageManager()

    @Published var currentLanguage: String = "en"
    @Published var translations: [String: String] = [:]

    let supportedLanguages: [String] = [
        "en", "ru", "de", "fr", "es", "it", "pt", "nl", "pl", "uk", "ro",
        "cs", "el", "hu", "sv", "da", "fi", "no", "sk", "bg", "hr",
        "lt", "sl", "lv", "et", "mt", "ga", "zh", "ja", "ko", "hi",
        "th", "vi", "id", "ms", "tl", "my", "km", "lo", "bn", "ta",
        "te", "mr", "ur", "pa", "gu", "kn", "ml", "si", "ne", "ar",
        "he", "fa", "tr", "ku", "ps", "dv", "ce", "av", "os", "ab",
        "kbd", "dar", "inh", "lez", "lbe", "sw", "ha", "yo", "ig",
        "am", "so", "st", "zu", "xh", "rw", "qu", "gn", "ay", "nah"
    ]

    static let rtlLanguages = ["ar", "he", "fa", "ur", "ps", "dv", "ku"]

    var isRTL: Bool {
        Self.rtlLanguages.contains(currentLanguage)
    }

    init() {
        detectSystemLanguage()
    }

    func detectSystemLanguage() {
        let preferredLanguage = Locale.preferredLanguages.first ?? "en"
        let languageCode = String(preferredLanguage.prefix(2))

        if supportedLanguages.contains(languageCode) {
            currentLanguage = languageCode
        } else {
            currentLanguage = "en"
        }
        loadLanguage(currentLanguage)
    }

    func setLanguage(_ code: String) {
        guard supportedLanguages.contains(code) else { return }
        currentLanguage = code
        loadLanguage(code)
    }

    func loadLanguage(_ code: String) {
        Task {
            await downloadTranslations(for: code)
        }
    }

    func string(_ key: String) -> String {
        translations[key] ?? key
    }

    private func downloadTranslations(for language: String) async {
        guard let url = URL(string: "https://cdn.guardian.app/locales/\(language).json") else {
            loadBundledFallback(language)
            return
        }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]

            await MainActor.run {
                self.translations = self.flattenJSON(json ?? [:], prefix: "")
            }
        } catch {
            loadBundledFallback(language)
        }
    }

    private func loadBundledFallback(_ language: String) {
        if let url = Bundle.main.url(forResource: language, withExtension: "json", subdirectory: "Locales"),
           let data = try? Data(contentsOf: url),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            translations = flattenJSON(json, prefix: "")
        } else if let url = Bundle.main.url(forResource: "en", withExtension: "json", subdirectory: "Locales"),
                  let data = try? Data(contentsOf: url),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            translations = flattenJSON(json, prefix: "")
        }
    }

    private func flattenJSON(_ dict: [String: Any], prefix: String) -> [String: String] {
        var out: [String: String] = [:]
        for (key, value) in dict {
            let fullKey = prefix.isEmpty ? key : "\(prefix).\(key)"
            if let str = value as? String {
                out[fullKey] = str
            } else if let nested = value as? [String: Any] {
                out.merge(flattenJSON(nested, prefix: fullKey)) { _, b in b }
            }
        }
        return out
    }
}
