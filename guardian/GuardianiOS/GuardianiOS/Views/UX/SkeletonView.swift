// Скелетон загрузки (shimmer).
import SwiftUI

struct SkeletonView: View {
    @State private var isAnimating = false

    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Circle()
                    .fill(Color.gray.opacity(0.3))
                    .frame(width: 50, height: 50)
                VStack(alignment: .leading, spacing: 8) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.gray.opacity(0.3))
                        .frame(width: 150, height: 20)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.gray.opacity(0.3))
                        .frame(width: 100, height: 16)
                }
                Spacer()
            }

            ForEach(0..<3, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.gray.opacity(0.3))
                    .frame(height: 100)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(
                                LinearGradient(
                                    colors: [.clear, .white.opacity(0.3), .clear],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .offset(x: isAnimating ? 400 : -400)
                            .mask(RoundedRectangle(cornerRadius: 12))
                    )
            }
        }
        .padding()
        .onAppear {
            withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                isAnimating = true
            }
        }
    }
}

struct AdaptiveSkeleton<Content: View>: View {
    let content: Content
    let isLoading: Bool

    init(isLoading: Bool, @ViewBuilder content: () -> Content) {
        self.isLoading = isLoading
        self.content = content()
    }

    var body: some View {
        ZStack {
            content
                .opacity(isLoading ? 0 : 1)
            if isLoading {
                SkeletonView()
            }
        }
    }
}
