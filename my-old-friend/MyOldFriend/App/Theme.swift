import SwiftUI

enum Theme {
    static let pink = Color(red: 0.93, green: 0.42, blue: 0.62)
    static let pinkLight = Color(red: 0.97, green: 0.60, blue: 0.75)
    static let pinkDeep = Color(red: 0.75, green: 0.27, blue: 0.48)
    static let cream = Color(red: 1.00, green: 0.965, blue: 0.945)
    static let blush = Color(red: 0.98, green: 0.90, blue: 0.93)
    static let ink = Color(red: 0.16, green: 0.12, blue: 0.19)
    static let inkSoft = Color(red: 0.38, green: 0.32, blue: 0.40)
    static let night = Color(red: 0.09, green: 0.07, blue: 0.11)
}

/// A large, high-contrast button. Every tap target in the app is at least 64 points tall.
struct BigButton: View {
    @EnvironmentObject private var settings: AppSettings
    let title: String
    var systemImage: String? = nil
    var filled = true
    var height: CGFloat = 76
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: settings.textSize.button, weight: .bold))
                }
                Text(title)
                    .font(.system(size: settings.textSize.button, weight: .bold, design: .rounded))
                    .lineLimit(2)
                    .minimumScaleFactor(0.6)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity, minHeight: height)
            .padding(.horizontal, 16)
            .foregroundStyle(filled ? Color.white : Theme.pinkDeep)
            .background(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(filled ? Theme.pink : Color.white)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(Theme.pink, lineWidth: filled ? 0 : 3)
            )
        }
        .buttonStyle(PressableStyle())
    }
}

/// Buttons squish a little when pressed, so it is obvious the tap worked.
struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1)
            .animation(.spring(response: 0.2, dampingFraction: 0.6), value: configuration.isPressed)
    }
}
