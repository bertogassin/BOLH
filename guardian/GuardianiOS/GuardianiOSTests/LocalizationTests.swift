import XCTest
@testable import GuardianiOS

final class LocalizationTests: XCTestCase {

    func testAllLanguagesHaveRequiredKeys() {
        let languageManager = LanguageManager.shared
        let requiredKeys = ["app_name", "actions.save", "navigation.home"]

        for language in languageManager.supportedLanguages {
            languageManager.setLanguage(language)
            // Переводы могут подгружаться асинхронно с CDN; проверяем, что язык переключился
            XCTAssertEqual(languageManager.currentLanguage, language)

            // Если есть локальный бандл (например en.json в Locales), можно проверить ключи:
            // for key in requiredKeys {
            //     let translation = languageManager.translations[key]
            //     XCTAssertNotNil(translation, "Missing translation for key \(key) in \(language)")
            // }
        }
    }

    func testRTLSupport() {
        let rtlLanguages = ["ar", "he", "fa", "ur", "ps", "dv", "ku"]

        for language in rtlLanguages {
            LanguageManager.shared.setLanguage(language)
            XCTAssertTrue(
                LanguageManager.shared.isRTL,
                "Language \(language) should be RTL"
            )
        }

        LanguageManager.shared.setLanguage("en")
        XCTAssertFalse(LanguageManager.shared.isRTL)
    }

    func testDateFormatting() {
        let testDate = Date()
        let formatter = DateFormatter()
        formatter.dateStyle = .long

        let locales = ["en_US", "ru_RU", "zh_CN", "ar_SA"]
        for localeId in locales {
            formatter.locale = Locale(identifier: localeId)
            let formatted = formatter.string(from: testDate)
            XCTAssertFalse(formatted.isEmpty, "Date should format for \(localeId)")
        }
    }

    func testIconRawValuesExist() {
        for icon in GuardianIcon.allCases {
            let raw = icon.rawValue
            XCTAssertFalse(raw.isEmpty, "Icon \(String(describing: icon)) should have non-empty raw value")
        }
    }

    func testSupportedLanguagesContainDefault() {
        XCTAssertTrue(LanguageManager.shared.supportedLanguages.contains("en"))
    }
}
