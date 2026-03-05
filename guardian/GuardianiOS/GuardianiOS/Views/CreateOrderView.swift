// Многошаговое создание заказа. Бюджет скрыт от исполнителей.

import SwiftUI
import MapKit

struct CreateOrderView: View {
    @Environment(\.dismiss) var dismiss
    @StateObject private var viewModel = CreateOrderViewModel()
    @State private var step = 1

    var body: some View {
        NavigationView {
            VStack {
                ProgressView(value: Double(step), total: 4)
                    .tint(Color(hex: "0055FF"))
                    .padding()
                TabView(selection: $step) {
                    StepBasicInfo(viewModel: viewModel).tag(1)
                    StepLicensesAndRequirements(viewModel: viewModel).tag(2)
                    StepLocationAndTime(viewModel: viewModel).tag(3)
                    StepReviewAndConfirm(viewModel: viewModel).tag(4)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                HStack {
                    if step > 1 {
                        Button("Назад") {
                            withAnimation { step -= 1 }
                        }
                        .buttonStyle(.bordered)
                    }
                    Spacer()
                    if step < 4 {
                        Button("Далее") {
                            withAnimation { step += 1 }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Color(hex: "0055FF"))
                    } else {
                        Button("Создать заказ") {
                            viewModel.createOrder()
                            dismiss()
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Color(hex: "0055FF"))
                    }
                }
                .padding()
            }
            .navigationTitle("Новый заказ")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                }
            }
        }
    }
}

struct StepBasicInfo: View {
    @ObservedObject var viewModel: CreateOrderViewModel

    var body: some View {
        Form {
            Section("Основная информация") {
                TextField("Название", text: $viewModel.title)
                TextField("Описание (необязательно)", text: $viewModel.descriptionText, axis: .vertical)
                    .lineLimit(3...6)
            }
            Section("Количество охранников") {
                Stepper("\(viewModel.guardCount) чел.", value: $viewModel.guardCount, in: 1...10)
            }
            Section("Требуемый опыт") {
                Picker("Опыт работы", selection: $viewModel.requiredExperience) {
                    Text("Не важно").tag(0)
                    Text("1 год").tag(1)
                    Text("2 года").tag(2)
                    Text("3+ лет").tag(3)
                }
            }
        }
    }
}

struct StepLicensesAndRequirements: View {
    @ObservedObject var viewModel: CreateOrderViewModel

    let licenses: [(type: String, name: String, icon: String)] = [
        ("weapon", "Оружие", "🔫"),
        ("medical", "Медицина", "💊"),
        ("driving", "Водительские", "🚗"),
        ("aviation", "Авиация", "🛩️"),
        ("maritime", "Морская", "⚓"),
        ("crowd_control", "Работа с толпой", "👥"),
        ("k9", "Кинолог", "🐕"),
        ("technical", "Технические", "📡")
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Выберите требуемые лицензии")
                    .font(.headline)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    ForEach(licenses, id: \.type) { license in
                        LicenseSelectCard(
                            license: (license.type, license.name, license.icon),
                            isSelected: viewModel.selectedLicenseTypes.contains(license.type),
                            onTap: {
                                if viewModel.selectedLicenseTypes.contains(license.type) {
                                    viewModel.selectedLicenseTypes.remove(license.type)
                                } else {
                                    viewModel.selectedLicenseTypes.insert(license.type)
                                }
                            }
                        )
                    }
                }
                Text("Специальные требования")
                    .font(.headline)
                TextField("Дополнительные требования...", text: $viewModel.specialRequirements, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(3)
            }
            .padding()
        }
    }
}

struct StepLocationAndTime: View {
    @ObservedObject var viewModel: CreateOrderViewModel
    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 55.7558, longitude: 37.6173),
        span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
    )

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                Map(coordinateRegion: $region, interactionModes: .all)
                    .frame(height: 250)
                    .cornerRadius(12)
                TextField("Адрес", text: $viewModel.address)
                    .textFieldStyle(.roundedBorder)
                DatePicker("Начало", selection: $viewModel.startTime, in: Date()...)
                DatePicker("Конец", selection: $viewModel.endTime, in: viewModel.startTime...)
                Divider()
                VStack(alignment: .leading, spacing: 8) {
                    Text("Бюджет (скрыт от исполнителей)")
                        .font(.headline)
                    HStack {
                        VStack(alignment: .leading) {
                            Text("От").font(.caption).foregroundColor(.secondary)
                            TextField("Мин", value: $viewModel.budgetMin, format: .number)
                                .keyboardType(.numberPad)
                                .textFieldStyle(.roundedBorder)
                        }
                        Text("—")
                        VStack(alignment: .leading) {
                            Text("До").font(.caption).foregroundColor(.secondary)
                            TextField("Макс", value: $viewModel.budgetMax, format: .number)
                                .keyboardType(.numberPad)
                                .textFieldStyle(.roundedBorder)
                        }
                        Text("₽")
                    }
                }
            }
            .padding()
        }
    }
}

struct StepReviewAndConfirm: View {
    @ObservedObject var viewModel: CreateOrderViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(viewModel.title)
                    .font(.title2)
                    .fontWeight(.bold)
                if !viewModel.descriptionText.isEmpty {
                    Text(viewModel.descriptionText)
                        .foregroundColor(.secondary)
                }
                Divider()
                LabeledContent("Охранников", value: "\(viewModel.guardCount)")
                LabeledContent("Опыт", value: viewModel.requiredExperience == 0 ? "Не важно" : "\(viewModel.requiredExperience)+ лет")
                if !viewModel.selectedLicenseTypes.isEmpty {
                    Text("Требуемые лицензии")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Text(viewModel.selectedLicenseTypes.joined(separator: ", "))
                        .font(.caption)
                }
                Divider()
                LabeledContent("Адрес", value: viewModel.address)
                LabeledContent("Начало", value: viewModel.startTime.formatted(date: .long, time: .shortened))
                LabeledContent("Конец", value: viewModel.endTime.formatted(date: .long, time: .shortened))
                Divider()
                HStack {
                    Text("Бюджет").font(.headline)
                    Spacer()
                    Text("\(Int(viewModel.budgetMin))-\(Int(viewModel.budgetMax)) ₽")
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundColor(Color(hex: "0055FF"))
                }
            }
            .padding()
        }
    }
}
