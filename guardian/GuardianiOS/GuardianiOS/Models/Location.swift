import Foundation
import CoreLocation

struct Location: Codable {
    let latitude: Double
    let longitude: Double
    var address: String?

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}
