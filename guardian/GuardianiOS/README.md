# GuardianiOS

Нативное iOS-приложение (Swift, SwiftUI). Открыть в Xcode: **File → New → Project → App**, затем добавьте папки `Models`, `Views`, `ViewModels` и существующие файлы.

- **Models/Order.swift** — Order, Requirements, Location, LicenseType, OrderStatus (цены не в модели).
- **Views/CreateOrderView.swift** — форма нового заказа (название, лицензии, бюджет, локация, время).
- **ViewModels/CreateOrderViewModel.swift** — состояние формы и вызов API (POST /api/v1/orders).

Требуется Xcode 15+, iOS 17+.
