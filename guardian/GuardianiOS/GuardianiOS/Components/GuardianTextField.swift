// Поле ввода: высота 56px, скругление 12px, состояние ошибки, опционально show/hide для пароля.

import SwiftUI

struct GuardianTextField: View {
    let placeholder: String
    @Binding var text: String
    var isSecure: Bool = false
    var error: String? = nil

    @State private var showPassword = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                if isSecure && !showPassword {
                    SecureField(placeholder, text: $text)
                        .textFieldStyle(GuardianFieldStyle())
                } else {
                    TextField(placeholder, text: $text)
                        .textFieldStyle(GuardianFieldStyle())
                }
                if isSecure {
                    Button {
                        showPassword.toggle()
                    } label: {
                        Image(systemName: showPassword ? "eye.slash" : "eye")
                            .foregroundColor(Color(hex: "6C707B"))
                    }
                }
            }
            .frame(height: 56)
            .padding(.horizontal, 16)
            .background(Color(.systemBackground))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(error != nil ? Color(hex: "FF3B30") : Color(hex: "E5E7EB"), lineWidth: 1)
            )
            if let error = error {
                Text(error)
                    .font(.caption)
                    .foregroundColor(Color(hex: "FF3B30"))
            }
        }
    }
}

struct GuardianFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
    }
}
