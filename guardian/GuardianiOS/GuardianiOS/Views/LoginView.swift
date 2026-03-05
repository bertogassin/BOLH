import SwiftUI

struct LoginView: View {
    @ObservedObject var tokenStore: TokenStore
    @State private var email = ""
    @State private var password = ""
    @State private var loading = false
    @State private var error: String?

    var body: some View {
        VStack(spacing: 24) {
            Text("Guardian")
                .font(.title.bold())
            VStack(alignment: .leading, spacing: 8) {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .autocapitalization(.none)
                    .textFieldStyle(.roundedBorder)
                SecureField("Пароль", text: $password)
                    .textContentType(.password)
                    .textFieldStyle(.roundedBorder)
            }
            .padding(.horizontal, 24)
            if let err = error {
                Text(err)
                    .font(.caption)
                    .foregroundColor(.red)
            }
            if loading {
                ProgressView()
            } else {
                Button("Войти") {
                    guard !email.isEmpty, !password.isEmpty else { return }
                    loading = true
                    error = nil
                    Task {
                        do {
                            let (token, _) = try await ApiClient.login(email: email, password: password)
                            await MainActor.run {
                                tokenStore.token = token
                                loading = false
                            }
                        } catch {
                            await MainActor.run {
                                self.error = error.localizedDescription
                                loading = false
                            }
                        }
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(email.isEmpty || password.isEmpty)
            }
        }
        .padding()
    }
}
