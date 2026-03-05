import SwiftUI

struct BidsView: View {
    @StateObject private var viewModel = BidsViewModel()
    @State private var selectedTab = 0

    var body: some View {
        NavigationView {
            VStack {
                Picker("", selection: $selectedTab) {
                    Text("Активные").tag(0)
                    Text("История").tag(1)
                }
                .pickerStyle(.segmented)
                .padding()
                List {
                    if selectedTab == 0 {
                        ForEach(viewModel.activeBids) { bid in
                            BidCard(bid: bid)
                                .swipeActions {
                                    Button("Деактивировать") {
                                        viewModel.deactivateBid(bid.id)
                                    }
                                    .tint(Color(hex: "FF9500"))
                                }
                        }
                    } else {
                        ForEach(viewModel.historyBids) { bid in
                            BidCard(bid: bid)
                        }
                    }
                }
                .listStyle(.plain)
            }
            .navigationTitle("Мои задания")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        viewModel.showCreateBidSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $viewModel.showCreateBidSheet) {
                CreateBidView()
            }
        }
    }
}

struct CreateBidView: View {
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            Form {
                Text("Создание задания (форма)")
            }
            .navigationTitle("Новое задание")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                }
            }
        }
    }
}
