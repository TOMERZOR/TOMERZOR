import SwiftUI
import UIKit

/// The app's colors. Bright pink belongs to Moffy only; the deeper rose is the one action color.
/// Contrast (WCAG): ink on surface 15.5:1, secondary on card 7.9:1, white on action 5.7:1,
/// action text on card 6.5:1 (dark: 7.6:1). Every color has a dark-mode variant.
enum Theme {
    // Moffy himself. Never used for text.
    static let moffy = Color(hex: 0xED6B9E)
    static let moffyLight = Color(hex: 0xF799BF)
    static let moffyDeep = Color(hex: 0xBF457A)

    static let surface = Color(light: 0xFBF6F3, dark: 0x17131A)
    static let card = Color(light: 0xFFFFFF, dark: 0x241E27)
    static let hairline = Color(light: 0xEADFE4, dark: 0x3A3140)
    static let ink = Color(light: 0x241B27, dark: 0xF6EEF2)
    static let inkSecondary = Color(light: 0x5A4D5F, dark: 0xC8BCC6)
    /// Filled buttons (white text on top).
    static let action = Color(light: 0xB8336A, dark: 0xB8336A)
    /// Action-colored text and icons on cards.
    static let actionText = Color(light: 0xA82D60, dark: 0xFF8DBA)
}

extension Color {
    init(hex: UInt32) {
        self.init(uiColor: UIColor(hex: hex))
    }

    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255,
                  green: CGFloat((hex >> 8) & 0xFF) / 255,
                  blue: CGFloat(hex & 0xFF) / 255,
                  alpha: 1)
    }
}

extension Font {
    /// SF Rounded in a system text style, so it grows with the iPhone's text size setting.
    static func rounded(_ style: Font.TextStyle, _ weight: Font.Weight = .regular) -> Font {
        .system(style, design: .rounded, weight: weight)
    }
}

/// The one big filled button style. Every tap target is at least 64 points tall.
struct BigButton: View {
    let title: String
    var systemImage: String? = nil
    var minHeight: CGFloat = 72
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label {
                Text(title)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
            } icon: {
                if let systemImage { Image(systemName: systemImage) }
            }
            .font(.rounded(.title2, .bold))
            .foregroundStyle(Color.white)
            .frame(maxWidth: .infinity, minHeight: minHeight)
            .padding(.horizontal, 16)
            .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Theme.action))
        }
        .buttonStyle(PressableStyle())
    }
}

/// A quiet text button for secondary choices.
struct QuietButton: View {
    let title: String
    var systemImage: String? = nil
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label {
                Text(title).lineLimit(1).minimumScaleFactor(0.7)
            } icon: {
                if let systemImage { Image(systemName: systemImage) }
            }
            .font(.rounded(.title3, .semibold))
            .foregroundStyle(Theme.actionText)
            .frame(maxWidth: .infinity, minHeight: 56)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle())
    }
}

/// Buttons dip slightly when pressed, so it's clear the tap worked.
struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.85 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}
