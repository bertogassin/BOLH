import CoreLocation

/// Определение предпочтительного языка по геолокации (страна).
final class LocationLanguageDetector: NSObject, CLLocationManagerDelegate {
    static let shared = LocationLanguageDetector()
    private let locationManager = CLLocationManager()

    private let countryLanguageMap: [String: String] = [
        "RU": "ru", "UA": "uk", "BY": "ru", "KZ": "ru",
        "DE": "de", "AT": "de", "CH": "de",
        "FR": "fr", "BE": "fr", "LU": "fr",
        "ES": "es", "MX": "es", "AR": "es",
        "IT": "it", "SM": "it", "VA": "it",
        "CN": "zh", "TW": "zh", "SG": "zh",
        "JP": "ja", "KR": "ko", "TH": "th",
        "SA": "ar", "AE": "ar", "EG": "ar",
        "IL": "he", "IR": "fa", "TR": "tr",
        "US": "en", "GB": "en", "AU": "en", "CA": "en",
        "IN": "hi", "PL": "pl", "NL": "nl", "PT": "pt", "BR": "pt"
    ]

    private var continuation: CheckedContinuation<String, Never>?

    func requestLocationAndDetectLanguage() {
        locationManager.delegate = self
        locationManager.requestWhenInUseAuthorization()
        locationManager.requestLocation()
    }

    /// Синхронный возврат текущего языка; асинхронное уточнение по геолокации выполняется в фоне.
    func detectLanguage() -> String {
        let status = locationManager.authorizationStatus

        if status == .authorizedWhenInUse || status == .authorizedAlways,
           let location = locationManager.location {
            let geocoder = CLGeocoder()
            geocoder.reverseGeocodeLocation(location) { [weak self] placemarks, _ in
                guard let self = self,
                      let countryCode = placemarks?.first?.isoCountryCode,
                      let language = self.countryLanguageMap[countryCode],
                      LanguageManager.shared.supportedLanguages.contains(language) else { return }
                DispatchQueue.main.async {
                    LanguageManager.shared.setLanguage(language)
                }
            }
        }

        return LanguageManager.shared.currentLanguage
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        let geocoder = CLGeocoder()
        geocoder.reverseGeocodeLocation(location) { [weak self] placemarks, _ in
            guard let self = self,
                  let countryCode = placemarks?.first?.isoCountryCode,
                  let language = self.countryLanguageMap[countryCode],
                  LanguageManager.shared.supportedLanguages.contains(language) else { return }
            DispatchQueue.main.async {
                LanguageManager.shared.setLanguage(language)
            }
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Оставляем язык по умолчанию (системный или en)
    }
}
