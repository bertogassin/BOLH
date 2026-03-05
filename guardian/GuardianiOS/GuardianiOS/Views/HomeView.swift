import SwiftUI

struct HomeView: View {
    let token: String?
    @StateObject private var viewModel: HomeViewModel

    init(token: String?) {
        self.token = token
        _viewModel = StateObject(wrappedValue: HomeViewModel(token: token))
    }

    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    GreetingHeader(user: viewModel.currentUser)
                    QuickActionsGrid()
                    if viewModel.userType == .client {
                        if viewModel.loading {
                            ProgressView("Загрузка заказов...")
                        } else {
                            ActiveOrdersSectionApi(orders: viewModel.apiOrders)
                        }
                    }
                    if viewModel.userType == .guard_ || viewModel.userType == .agency {
                        ActiveBidsSection(bids: viewModel.activeBids)
                    }
                }
                .padding()
            }
            .navigationTitle("Главная")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { viewModel.showNotifications() }) {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: "bell")
                            if viewModel.unreadNotifications > 0 {
                                Circle()
                                    .fill(Color(hex: "FF3B30"))
                                    .frame(width: 8, height: 8)
                                    .offset(x: 8, y: -8)
                            }
                        }
                    }
                }
            }
        }
    }
}

struct GreetingHeader: View {
    let user: User?

    var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 0..<12: return "Доброе утро"
        case 12..<18: return "Добрый день"
        default: return "Добрый вечер"
        }
    }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(greeting),")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                Text(user?.firstName ?? "Загрузка...")
                    .font(.title2)
                    .fontWeight(.bold)
            }
            Spacer()
            if let user = user {
                AsyncImage(url: user.avatarUrl) { image in
                    image.resizable()
                } placeholder: {
                    Circle()
                        .fill(Color.gray.opacity(0.3))
                        .overlay(Text(user.firstName.prefix(1)).font(.title2))
                }
                .frame(width: 50, height: 50)
                .clipShape(Circle())
            }
        }
    }
}

struct QuickActionsGrid: View {
    let actions: [QuickAction] = [
        QuickAction(icon: "plus.circle.fill", title: "Новый заказ", color: Color(hex: "0055FF")),
        QuickAction(icon: "doc.text.fill", title: "Мои заказы", color: Color(hex: "AF52DE")),
        QuickAction(icon: "creditcard.fill", title: "Платежи", color: Color(hex: "00C48C")),
        QuickAction(icon: "message.fill", title: "Чаты", color: Color(hex: "FF9500"))
    ]

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
            ForEach(actions) { action in
                VStack(spacing: 8) {
                    Image(systemName: action.icon)
                        .font(.title)
                        .foregroundColor(.white)
                        .frame(width: 50, height: 50)
                        .background(action.color)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    Text(action.title)
                        .font(.caption)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(Color(.secondarySystemBackground))
                .cornerRadius(12)
            }
        }
    }
}

struct ActiveOrdersSection: View {
    let orders: [Order]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Активные заказы")
                    .font(.headline)
                Spacer()
                Button("Все") {}
                    .font(.subheadline)
            }
            if orders.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "doc.text")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                    Text("Нет активных заказов")
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color(.secondarySystemBackground))
                .cornerRadius(12)
            } else {
                ForEach(orders.prefix(3)) { order in
                    OrderCard(order: order)
                }
            }
        }
    }
}

struct ActiveOrdersSectionApi: View {
    let orders: [OrderListItem]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Мои заказы")
                .font(.headline)
            if orders.isEmpty {
                Text("Нет заказов")
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .cornerRadius(12)
            } else {
                ForEach(orders) { order in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(order.title).font(.headline)
                        Text(order.status).font(.subheadline).foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .cornerRadius(12)
                }
            }
        }
    }
}

struct ActiveBidsSection: View {
    let bids: [Bid]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Активные задания")
                    .font(.headline)
                Spacer()
                Button("Все") {}
                    .font(.subheadline)
            }
            if bids.isEmpty {
                Text("Нет активных заданий")
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding()
            } else {
                ForEach(bids.prefix(3)) { bid in
                    BidCard(bid: bid)
                }
            }
        }
    }
}

struct BidCard: View {
    let bid: Bid

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(bid.title)
                    .font(.headline)
                Spacer()
                Text("\(Int(bid.pricePerHour)) ₽/час")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(Color(hex: "0055FF"))
            }
            Text(bid.description)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .lineLimit(2)
            HStack {
                ForEach(bid.availableLicenses.prefix(3)) { license in
                    LicenseBadge(type: license, small: true)
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
}
