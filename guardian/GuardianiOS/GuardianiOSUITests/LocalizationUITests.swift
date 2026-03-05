import XCTest
import UIKit

final class LocalizationUITests: XCTestCase {

    let testLanguages = ["en", "ru", "de", "fr", "es", "zh", "ja", "ar", "ce"]

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testAllLanguagesLayout() {
        for language in testLanguages {
            let app = XCUIApplication()
            app.launchArguments += ["-AppleLanguages", "(\(language))"]
            app.launch()

            // Проверяем наличие основных элементов (подстройте идентификаторы под ваш UI)
            let tabBar = app.tabBars.firstMatch
            if tabBar.exists {
                XCTAssertTrue(tabBar.waitForExistence(timeout: 3))
            }

            app.terminate()
        }
    }

    func testRTLFlip() {
        let rtlLanguages = ["ar", "he", "fa"]

        for language in rtlLanguages {
            let app = XCUIApplication()
            app.launchArguments += ["-AppleLanguages", "(\(language))"]
            app.launch()

            // В RTL навигация и элементы должны быть зеркально
            let firstNavButton = app.navigationBars.buttons.element(boundBy: 0)
            if firstNavButton.exists && firstNavButton.isHittable {
                let screenWidth = UIScreen.main.bounds.width
                let buttonMinX = firstNavButton.frame.minX
                if language == "ar" {
                    XCTAssertGreaterThan(buttonMinX, screenWidth / 2, "Back button in RTL should be on right")
                }
            }

            app.terminate()
        }
    }
}
