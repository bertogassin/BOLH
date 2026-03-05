import Foundation
#if canImport(CoreTelephony)
import CoreTelephony
#endif

/// Определение языка по стране SIM-карты (если доступно).
final class SIMLanguageDetector {

    private let countryToLanguage: [String: String] = [
        "RU": "ru", "UA": "uk", "BY": "ru", "KZ": "ru",
        "DE": "de", "AT": "de", "CH": "de",
        "FR": "fr", "BE": "fr", "LU": "fr",
        "ES": "es", "MX": "es", "AR": "es",
        "IT": "it", "JP": "ja", "KR": "ko",
        "CN": "zh", "TW": "zh", "SG": "zh",
        "SA": "ar", "AE": "ar", "EG": "ar",
        "IL": "he", "IR": "fa", "TR": "tr",
        "US": "en", "GB": "en", "AU": "en", "CA": "en",
        "IN": "hi", "TH": "th", "PL": "pl", "NL": "nl", "PT": "pt", "BR": "pt"
    ]

    func detectFromSIM() -> String? {
#if canImport(CoreTelephony)
        let networkInfo = CTTelephonyNetworkInfo()
        guard let carriers = networkInfo.serviceSubscriberCellularProviders?.values else {
            return nil
        }
        for carrier in carriers {
            if let countryCode = carrier.isoCountryCode?.uppercased(),
               let lang = countryToLanguage[countryCode] {
                return lang
            }
        }
#endif
        return nil
    }

    /// Применить язык по SIM, если определён и поддерживается.
    func applySIMLanguageIfSupported() {
        guard let lang = detectFromSIM(),
              LanguageManager.shared.supportedLanguages.contains(lang) else { return }
        LanguageManager.shared.setLanguage(lang)
    }
}
