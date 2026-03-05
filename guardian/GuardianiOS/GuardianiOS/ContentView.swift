import SwiftUI

struct ContentView: View {
    @Environment(\.colorScheme) var colorScheme
    @StateObject private var tokenStore = TokenStore()

    var body: some View {
        if tokenStore.token != nil {
            GuardianApp(theme: colorScheme == .dark ? .dark : .light, tokenStore: tokenStore)
        } else {
            LoginView(tokenStore: tokenStore)
        }
    }
}

struct GuardianApp: View {
    let theme: GuardianTheme
    @ObservedObject var tokenStore: TokenStore
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView(token: tokenStore.token)
                .tabItem {
                    Label("Главная", systemImage: "house")
                }
                .tag(0)
            OrderMapView()
                .tabItem {
                    Label("Карта", systemImage: "map")
                }
                .tag(1)
            Text("Заказы")
                .tabItem {
                    Label("Заказы", systemImage: "doc.text")
                }
                .tag(2)
            Text("Чаты")
                .tabItem {
                    Label("Чаты", systemImage: "message")
                }
                .tag(3)
            BidsView()
                .tabItem {
                    Label("Задания", systemImage: "person.2")
                }
                .tag(4)
        }
        .environment(\.guardianTheme, theme)
    }
}

#Preview {
    ContentView()
}
