import SwiftUI

/// A TV remote on a wooden table, drawn in code. Stands in for the camera in simulator
/// screenshots (the simulator has no camera). Only shown by test-build screenshot scenes.
struct SampleSceneView: View {
    /// Where the red power button is, as a fraction of the frame Moffy looks through. Moffy points here.
    static let powerButton = CGPoint(x: 0.6, y: 0.17)

    /// The frame Moffy looks through, in this view's coordinates. The remote is drawn inside it.
    var focus: CGRect

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let unit = min(focus.width, focus.height)

            ZStack {
                LinearGradient(colors: [Color(hex: 0x9A6847), Color(hex: 0x6E432A)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                ForEach(0..<16, id: \.self) { i in
                    Capsule()
                        .fill(Color.black.opacity(0.06))
                        .frame(width: w * 1.2, height: 3)
                        .rotationEffect(.degrees(-4))
                        .position(x: w / 2, y: h * (CGFloat(i) + 0.5) / 16)
                }

                RoundedRectangle(cornerRadius: unit * 0.09, style: .continuous)
                    .fill(LinearGradient(colors: [Color(hex: 0x3B3B42), Color(hex: 0x1F1F24)],
                                         startPoint: .top, endPoint: .bottom))
                    .frame(width: focus.width * 0.44, height: focus.height * 0.92)
                    .shadow(color: .black.opacity(0.45), radius: 14, x: 6, y: 10)
                    .position(spot(0.5, 0.53))

                button(Color(hex: 0xD83A34), size: unit * 0.1, at: spot(Self.powerButton.x, Self.powerButton.y), symbol: "power")
                button(Color(hex: 0x55555E), size: unit * 0.07, at: spot(0.4, 0.17), symbol: "rectangle.portrait.and.arrow.right")

                ForEach(0..<9, id: \.self) { i in
                    Text("\(i + 1)")
                        .font(.system(size: unit * 0.045, weight: .semibold))
                        .foregroundStyle(Color.white.opacity(0.85))
                        .frame(width: unit * 0.085, height: unit * 0.085)
                        .background(Circle().fill(Color(hex: 0x4A4A52)))
                        .position(spot(0.39 + CGFloat(i % 3) * 0.11, 0.29 + CGFloat(i / 3) * 0.075))
                }

                Circle()
                    .fill(Color(hex: 0x4A4A52))
                    .frame(width: unit * 0.28, height: unit * 0.28)
                    .position(spot(0.5, 0.6))
                Circle()
                    .fill(Color(hex: 0x6A6A74))
                    .frame(width: unit * 0.12, height: unit * 0.12)
                    .overlay(Text("OK").font(.system(size: unit * 0.035, weight: .bold)).foregroundStyle(.white))
                    .position(spot(0.5, 0.6))

                ForEach(Array(["plus", "minus"].enumerated()), id: \.offset) { index, symbol in
                    button(Color(hex: 0x4A4A52), size: unit * 0.075,
                           at: spot(0.42, 0.75 + CGFloat(index) * 0.07), symbol: symbol)
                    button(Color(hex: 0x4A4A52), size: unit * 0.075,
                           at: spot(0.58, 0.75 + CGFloat(index) * 0.07),
                           symbol: index == 0 ? "chevron.up" : "chevron.down")
                }

                HStack(spacing: unit * 0.02) {
                    ForEach([0xD83A34, 0x3BA55C, 0xE8C341, 0x3C78D8], id: \.self) { hex in
                        Capsule().fill(Color(hex: UInt32(hex))).frame(width: unit * 0.05, height: unit * 0.025)
                    }
                }
                .position(spot(0.5, 0.92))
            }
        }
        .accessibilityHidden(true)
    }

    /// A point inside the frame, from fractions across and down.
    private func spot(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
        CGPoint(x: focus.minX + focus.width * x, y: focus.minY + focus.height * y)
    }

    private func button(_ color: Color, size: CGFloat, at point: CGPoint, symbol: String) -> some View {
        Circle()
            .fill(color)
            .frame(width: size, height: size)
            .overlay(Image(systemName: symbol).font(.system(size: size * 0.42, weight: .bold)).foregroundStyle(.white))
            .position(point)
    }
}

#Preview {
    SampleSceneView(focus: CGRect(x: 16, y: 120, width: 360, height: 420))
}

#if DEBUG
/// A drawn iPhone Settings screen, standing in for a screenshot in simulator screenshots.
struct SampleScreenshotView: View {
    /// The middle of the "Display & Brightness" row, as a fraction of the picture.
    static let displayRow = CGPoint(x: 0.5, y: 0.31)

    var hebrew: Bool

    private var rows: [(String, Color)] {
        [(hebrew ? "כללי" : "General", .gray),
         (hebrew ? "מרכז הבקרה" : "Control Center", .gray),
         (hebrew ? "תצוגה ובהירות" : "Display & Brightness", .blue),
         (hebrew ? "מסך הבית" : "Home Screen", .indigo),
         (hebrew ? "נגישות" : "Accessibility", .blue),
         (hebrew ? "רקע" : "Wallpaper", .cyan),
         (hebrew ? "צלילים" : "Sounds", .red)]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(hebrew ? "הגדרות" : "Settings")
                .font(.system(size: 34, weight: .bold))
                .frame(height: 41)
                .padding(.horizontal, 20)
                .padding(.top, 70)
                .padding(.bottom, 16)
            VStack(spacing: 0) {
                ForEach(rows.indices, id: \.self) { index in
                    HStack(spacing: 14) {
                        RoundedRectangle(cornerRadius: 7).fill(rows[index].1).frame(width: 30, height: 30)
                        Text(rows[index].0).font(.system(size: 17)).foregroundStyle(.black)
                        Spacer()
                        Image(systemName: "chevron.forward").foregroundStyle(.gray)
                    }
                    .frame(height: 52)
                    .padding(.horizontal, 16)
                    Rectangle().fill(Color(white: 0.88)).frame(height: 1)
                }
            }
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .padding(.horizontal, 16)
            Spacer(minLength: 0)
        }
        .frame(width: 390, height: 844)
        .background(Color(white: 0.95))
        .environment(\.layoutDirection, hebrew ? .rightToLeft : .leftToRight)
    }
}
#endif
