import SwiftUI
import UIKit

/// The app's colors. White surfaces, one pink for actions, and Moffy's own pinks for Moffy only.
/// Contrast (WCAG): ink on white 16.6:1, secondary on white 8.4:1, white on action pink 4.6:1,
/// action pink text on white 4.6:1 (dark: 7.6:1). Every color has a dark-mode variant.
enum Theme {
    // Moffy's own body colors. Never used for text.
    static let moffy = Color(hex: 0xED6B9E)
    static let moffyLight = Color(hex: 0xF799BF)
    static let moffyDeep = Color(hex: 0xBF457A)

    static let surface = Color(light: 0xFFFFFF, dark: 0x17131A)
    static let card = Color(light: 0xFFFFFF, dark: 0x241E27)
    static let hairline = Color(light: 0xEEE6EA, dark: 0x3A3140)
    static let ink = Color(light: 0x241B27, dark: 0xF6EEF2)
    static let inkSecondary = Color(light: 0x5A4D5F, dark: 0xC8BCC6)
    /// The one action color: pink buttons, the step eyebrow, the pointing label.
    static let action = Color(hex: 0xD6336F)
    /// Action-colored text and icons on cards.
    static let actionText = Color(light: 0xD6336F, dark: 0xFF8DBA)

    // The pink button is built like Moffy: a lit face on a deeper pink base.
    static let pinkTop = Color(hex: 0xE84A8A)
    static let pinkBottom = Color(hex: 0xD02A6B)
    static let pinkLip = Color(hex: 0xA81E55)
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
    /// SF Pro in a system text style, so it grows with the iPhone's text size setting.
    static func ui(_ style: Font.TextStyle, _ weight: Font.Weight = .regular) -> Font {
        .system(style, design: .default, weight: weight)
    }
}

/// The pink button for every main action: fully filled, sitting on a deeper pink base so it
/// looks pressable, and it sinks into that base when pressed. At least 72 points tall.
struct PinkButton: View {
    let title: String
    var systemImage: String? = nil
    var isBusy = false
    var minHeight: CGFloat = 72
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                if isBusy {
                    ProgressView().tint(.white).controlSize(.large)
                } else if let systemImage {
                    Image(systemName: systemImage)
                }
                Text(title)
                    .lineLimit(2)
                    .minimumScaleFactor(0.7)
                    .multilineTextAlignment(.center)
            }
            .font(.ui(.title2, .bold))
            .foregroundStyle(Color.white)
            .frame(maxWidth: .infinity, minHeight: minHeight)
            .padding(.horizontal, 18)
        }
        .buttonStyle(TactileStyle())
    }
}

/// The face moves down 4 points onto its 5-point base when pressed, with a light tap.
struct TactileStyle: ButtonStyle {
    var cornerRadius: CGFloat = 24

    func makeBody(configuration: Configuration) -> some View {
        TactileBody(configuration: configuration, cornerRadius: cornerRadius)
    }

    private struct TactileBody: View {
        let configuration: ButtonStyleConfiguration
        let cornerRadius: CGFloat
        @Environment(\.isEnabled) private var isEnabled

        var body: some View {
            let pressed = configuration.isPressed
            let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            configuration.label
                .background(shape.fill(LinearGradient(colors: [Theme.pinkTop, Theme.pinkBottom],
                                                      startPoint: .top, endPoint: .bottom)))
                .overlay(
                    shape.strokeBorder(LinearGradient(colors: [Color.white.opacity(0.25), .clear],
                                                      startPoint: .top, endPoint: .center), lineWidth: 1)
                )
                .offset(y: pressed ? 4 : 0)
                .background(
                    shape.fill(Theme.pinkLip)
                        .offset(y: 5)
                        .shadow(color: Theme.action.opacity(pressed ? 0.2 : 0.3),
                                radius: pressed ? 4 : 12, y: pressed ? 2 : 6)
                )
                .padding(.bottom, 5)
                .opacity(isEnabled ? 1 : 0.6)
                .animation(.spring(response: 0.18, dampingFraction: 0.7), value: pressed)
                .sensoryFeedback(.impact(weight: .light), trigger: pressed) { _, isPressed in isPressed }
        }
    }
}

/// A round frosted button for secondary actions over the camera (settings, keyboard).
struct GlassCircleButton: View {
    let systemImage: String
    let label: String
    var size: CGFloat = 56
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: size * 0.36, weight: .semibold))
                .foregroundStyle(Theme.ink)
                .frame(width: size, height: size)
                .background(Circle().fill(.ultraThinMaterial))
                .overlay(Circle().stroke(Color.white.opacity(0.4), lineWidth: 1))
                .shadow(color: .black.opacity(0.12), radius: 8, y: 3)
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel(label)
    }
}

/// Buttons dip slightly when pressed, so it's clear the tap worked.
struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .opacity(configuration.isPressed ? 0.85 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}
