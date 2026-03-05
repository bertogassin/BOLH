// Онбординг: приветствие, выбор роли, завершение.
import SwiftUI

struct OnboardingView: View {
    @State private var currentPage = 0
    @AppStorage("hasCompletedOnboarding") var hasCompletedOnboarding = false
    @State private var selectedRole: UserType = .client

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color.blue.opacity(0.1), Color.purple.opacity(0.1)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack {
                if currentPage < 3 {
                    HStack(spacing: 8) {
                        ForEach(0..<3, id: \.self) { index in
                            Circle()
                                .fill(index <= currentPage ? Color.blue : Color.gray.opacity(0.3))
                                .frame(width: 8, height: 8)
                                .animation(.spring(), value: currentPage)
                        }
                    }
                    .padding(.top, 50)
                }

                Spacer()

                switch currentPage {
                case 0:
                    WelcomeView()
                case 1:
                    RoleSelectionView(selectedRole: $selectedRole)
                case 2:
                    if selectedRole == .client {
                        ClientOnboardingView()
                    } else {
                        GuardOnboardingView()
                    }
                default:
                    EmptyView()
                }

                Spacer()

                VStack(spacing: 12) {
                    if currentPage < 2 {
                        Button {
                            withAnimation(.spring()) { currentPage += 1 }
                        } label: {
                            Text("Далее")
                                .font(.headline)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.blue)
                                .cornerRadius(12)
                        }

                        Button("Пропустить") {
                            withAnimation { hasCompletedOnboarding = true }
                        }
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    } else if currentPage == 2 {
                        Button {
                            withAnimation { hasCompletedOnboarding = true }
                        } label: {
                            Text("Начать")
                                .font(.headline)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.blue)
                                .cornerRadius(12)
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 30)
            }
        }
    }
}

struct WelcomeView: View {
    @State private var animate = false

    var body: some View {
        VStack(spacing: 30) {
            ZStack {
                Circle()
                    .fill(Color.blue.opacity(0.2))
                    .frame(width: 200, height: 200)
                    .scaleEffect(animate ? 1.2 : 1)
                Circle()
                    .fill(Color.blue.opacity(0.3))
                    .frame(width: 160, height: 160)
                    .scaleEffect(animate ? 1.1 : 1)
                Image(systemName: "shield.fill")
                    .font(.system(size: 80))
                    .foregroundColor(.blue)
                    .scaleEffect(animate ? 1.1 : 1)
            }
            .animation(
                .easeInOut(duration: 1.5).repeatForever(autoreverses: true),
                value: animate
            )

            Text("Добро пожаловать в Guardian")
                .font(.largeTitle)
                .fontWeight(.bold)
                .multilineTextAlignment(.center)

            Text("Безопасность, которая всегда рядом")
                .font(.title3)
                .foregroundColor(.secondary)

            VStack(alignment: .leading, spacing: 16) {
                FeatureRow(icon: "bolt.shield.fill", text: "Быстрый подбор за минуты")
                FeatureRow(icon: "lock.shield.fill", text: "Только проверенные специалисты")
                FeatureRow(icon: "creditcard.fill", text: "Безопасная оплата")
            }
            .padding(.top, 20)
        }
        .onAppear { animate = true }
    }
}

struct FeatureRow: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(.blue)
                .frame(width: 30)
            Text(text)
                .font(.body)
            Spacer()
        }
    }
}

struct RoleSelectionView: View {
    @Binding var selectedRole: UserType

    var body: some View {
        VStack(spacing: 24) {
            Text("Кто вы?")
                .font(.title)
                .fontWeight(.bold)

            VStack(spacing: 12) {
                ForEach([UserType.client, .guard_, .agency], id: \.self) { role in
                    Button {
                        selectedRole = role
                    } label: {
                        HStack {
                            Image(systemName: role == .client ? "person.fill" : role == .guard_ ? "shield.fill" : "building.2.fill")
                                .foregroundColor(selectedRole == role ? .white : .blue)
                            Text(roleTitle(role))
                                .foregroundColor(selectedRole == role ? .white : .primary)
                            Spacer()
                            if selectedRole == role {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.white)
                            }
                        }
                        .padding()
                        .background(selectedRole == role ? Color.blue : Color(.secondarySystemBackground))
                        .cornerRadius(12)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal)
        }
    }

    private func roleTitle(_ role: UserType) -> String {
        switch role {
        case .client: return "Клиент (заказчик)"
        case .guard_: return "Охранник"
        case .agency: return "Агентство"
        }
    }
}

struct ClientOnboardingView: View {
    var body: some View {
        VStack(spacing: 16) {
            Text("Создайте заказ за минуту")
                .font(.title2)
                .fontWeight(.semibold)
            Text("Укажите где, когда и какие нужны лицензии. Мы подберём охранника.")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
    }
}

struct GuardOnboardingView: View {
    var body: some View {
        VStack(spacing: 16) {
            Text("Получайте заказы")
                .font(.title2)
                .fontWeight(.semibold)
            Text("Создайте задание — алгоритм будет присылать подходящие заказы.")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
    }
}
