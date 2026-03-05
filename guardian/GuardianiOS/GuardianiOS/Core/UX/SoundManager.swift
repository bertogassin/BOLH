// Звуковые подсказки (опционально) + связка с haptic.
import UIKit

final class SoundManager {
    static let shared = SoundManager()

    private init() {}

    /// Воспроизвести тип события; haptic вызывается всегда при необходимости.
    func play(_ sound: String, haptic: Bool = true) {
        if haptic {
            switch sound {
            case "success":
                HapticManager.shared.success()
            case "error":
                HapticManager.shared.error()
            case "tap":
                HapticManager.shared.buttonTap()
            case "match":
                HapticManager.shared.matchFound()
            default:
                HapticManager.shared.buttonTap()
            }
        }
        // Звуковые файлы (tap.mp3, success.mp3 и т.д.) можно добавить в Assets и загружать через AVAudioPlayer
    }
}
