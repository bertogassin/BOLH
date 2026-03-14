import SwiftUI
import MapKit

struct OrderDetailView: View {
    let orderId: UUID
    @StateObject private var viewModel: OrderDetailViewModel

    init(orderId: UUID) {
        self.orderId = orderId
        _viewModel = StateObject(wrappedValue: OrderDetailViewModel(orderId: orderId))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if viewModel.isLoading {
                    ProgressView("Загрузка заказа...")
                }
                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundColor(.red)
                }
                StatusHeader(status: viewModel.order.status)
                OrderMapPreview(location: viewModel.order.location)
                    .frame(height: 200)
                    .cornerRadius(12)
                OrderDetailsCard(order: viewModel.order)
                RequirementsView(
                    licenses: viewModel.order.requiredLicenses,
                    experience: viewModel.order.requiredExperience,
                    guardCount: viewModel.order.guardCount
                )
                if let guard_ = viewModel.assignedGuard {
                    AssignedGuardCard(guard: guard_)
                }
            }
            .padding()
        }
        .navigationTitle("Заказ")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.load(orderId: orderId)
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    Button("Редактировать", action: viewModel.editOrder)
                    Button("Отменить", action: viewModel.cancelOrder)
                        .foregroundColor(Color(hex: "FF3B30"))
                } label: {
                    Image(systemName: "ellipsis")
                }
            }
        }
    }
}

struct StatusHeader: View {
    let status: OrderStatus

    var body: some View {
        HStack {
            Circle()
                .fill(statusColor)
                .frame(width: 12, height: 12)
            Text(status.displayName)
                .font(.headline)
        }
    }

    private var statusColor: Color {
        switch status {
        case .open: return Color(hex: "0055FF")
        case .matching: return Color(hex: "FF9500")
        case .matched, .accepted: return Color(hex: "00C48C")
        case .inProgress: return Color(hex: "AF52DE")
        case .completed: return .gray
        case .cancelled: return Color(hex: "FF3B30")
        }
    }
}

struct OrderMapPreview: View {
    let location: Location

    var body: some View {
        Map(coordinateRegion: .constant(MKCoordinateRegion(
            center: location.coordinate,
            span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
        )))
    }
}

struct OrderDetailsCard: View {
    let order: Order

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(order.title)
                .font(.title2)
                .fontWeight(.bold)
            if !order.description.isEmpty {
                Text(order.description)
                    .font(.body)
                    .foregroundColor(.secondary)
            }
            Divider()
            DetailRow(icon: "calendar", text: order.formattedDate)
            DetailRow(icon: "clock", text: order.formattedTime)
            DetailRow(icon: "location", text: order.location.address ?? "—")
            DetailRow(icon: "person.2", text: "\(order.guardCount) охранников")
            Divider()
            HStack {
                Text("Бюджет")
                    .font(.headline)
                Spacer()
                Text("\(Int(order.budgetMin))-\(Int(order.budgetMax)) ₽")
                    .font(.title3)
                    .fontWeight(.semibold)
                    .foregroundColor(Color(hex: "0055FF"))
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
}

struct DetailRow: View {
    let icon: String
    let text: String

    var body: some View {
        HStack {
            Image(systemName: icon)
                .frame(width: 24)
                .foregroundColor(.secondary)
            Text(text)
        }
    }
}

struct RequirementsView: View {
    let licenses: [LicenseType]
    let experience: Int
    let guardCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Требования")
                .font(.headline)
            HStack {
                ForEach(licenses.prefix(5)) { license in
                    LicenseBadge(type: license, small: true)
                }
            }
            Text("Опыт: \(experience == 0 ? "Не важно" : "\(experience)+ лет")")
                .font(.subheadline)
            Text("Охранников: \(guardCount)")
                .font(.subheadline)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
}

struct AssignedGuardCard: View {
    let guard: Guard

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Исполнитель")
                .font(.headline)
            HStack {
                AsyncImage(url: guard.avatarUrl) { image in
                    image.resizable()
                } placeholder: {
                    Circle()
                        .fill(Color.gray.opacity(0.3))
                        .overlay(Text(guard.firstName.prefix(1)).font(.title2))
                }
                .frame(width: 60, height: 60)
                .clipShape(Circle())
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(guard.firstName) \(guard.lastName)")
                        .font(.headline)
                    HStack {
                        Image(systemName: "star.fill")
                            .foregroundColor(.yellow)
                        Text(String(format: "%.1f", guard.rating))
                        Text("(\(guard.reviewCount) отзывов)")
                            .foregroundColor(.secondary)
                    }
                    .font(.subheadline)
                }
                Spacer()
                Button("Чат") {}
                    .buttonStyle(.bordered)
            }
            HStack {
                ForEach(guard.licenses.prefix(3)) { license in
                    LicenseBadge(type: license, small: true)
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
}
