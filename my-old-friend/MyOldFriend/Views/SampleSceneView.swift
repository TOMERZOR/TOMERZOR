import SwiftUI

/// A TV remote on a wooden table, drawn in code. Stands in for the camera in simulator
/// screenshots (the simulator has no camera). Only shown by test-build screenshot scenes.
struct SampleSceneView: View {
    /// Where the red power button is, as a fraction of the area. Moffy points here.
    static let powerButton = CGPoint(x: 0.6, y: 0.17)

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let unit = min(w, h)

            ZStack {
                LinearGradient(colors: [Color(hex: 0x9A6847), Color(hex: 0x6E432A)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                ForEach(0..<12, id: \.self) { i in
                    Capsule()
                        .fill(Color.black.opacity(0.06))
                        .frame(width: w * 1.2, height: 3)
                        .rotationEffect(.degrees(-4))
                        .position(x: w / 2, y: h * (CGFloat(i) + 0.5) / 12)
                }

                RoundedRectangle(cornerRadius: unit * 0.09, style: .continuous)
                    .fill(LinearGradient(colors: [Color(hex: 0x3B3B42), Color(hex: 0x1F1F24)],
                                         startPoint: .top, endPoint: .bottom))
                    .frame(width: w * 0.44, height: h * 0.9)
                    .shadow(color: .black.opacity(0.45), radius: 14, x: 6, y: 10)
                    .position(x: w * 0.5, y: h * 0.53)

                button(Color(hex: 0xD83A34), size: unit * 0.1, at: Self.powerButton, in: geo.size, symbol: "power")
                button(Color(hex: 0x55555E), size: unit * 0.07, at: CGPoint(x: 0.4, y: 0.17), in: geo.size, symbol: "rectangle.portrait.and.arrow.right")

                ForEach(0..<9, id: \.self) { i in
                    let x = 0.39 + CGFloat(i % 3) * 0.11
                    let y = 0.29 + CGFloat(i / 3) * 0.075
                    Text("\(i + 1)")
                        .font(.system(size: unit * 0.045, weight: .semibold, design: .rounded))
                        .foregroundStyle(Color.white.opacity(0.85))
                        .frame(width: unit * 0.085, height: unit * 0.085)
                        .background(Circle().fill(Color(hex: 0x4A4A52)))
                        .position(x: w * x, y: h * y)
                }

                Circle()
                    .fill(Color(hex: 0x4A4A52))
                    .frame(width: unit * 0.28, height: unit * 0.28)
                    .position(x: w * 0.5, y: h * 0.6)
                Circle()
                    .fill(Color(hex: 0x6A6A74))
                    .frame(width: unit * 0.12, height: unit * 0.12)
                    .overlay(Text("OK").font(.system(size: unit * 0.035, weight: .bold)).foregroundStyle(.white))
                    .position(x: w * 0.5, y: h * 0.6)

                ForEach(Array(["plus", "minus"].enumerated()), id: \.offset) { index, symbol in
                    button(Color(hex: 0x4A4A52), size: unit * 0.075,
                           at: CGPoint(x: 0.42, y: 0.75 + CGFloat(index) * 0.07), in: geo.size, symbol: symbol)
                    button(Color(hex: 0x4A4A52), size: unit * 0.075,
                           at: CGPoint(x: 0.58, y: 0.75 + CGFloat(index) * 0.07), in: geo.size,
                           symbol: index == 0 ? "chevron.up" : "chevron.down")
                }

                HStack(spacing: unit * 0.02) {
                    ForEach([0xD83A34, 0x3BA55C, 0xE8C341, 0x3C78D8], id: \.self) { hex in
                        Capsule().fill(Color(hex: UInt32(hex))).frame(width: unit * 0.05, height: unit * 0.025)
                    }
                }
                .position(x: w * 0.5, y: h * 0.92)
            }
        }
        .accessibilityHidden(true)
    }

    private func button(_ color: Color, size: CGFloat, at point: CGPoint, in area: CGSize, symbol: String) -> some View {
        Circle()
            .fill(color)
            .frame(width: size, height: size)
            .overlay(Image(systemName: symbol).font(.system(size: size * 0.42, weight: .bold)).foregroundStyle(.white))
            .position(x: area.width * point.x, y: area.height * point.y)
    }
}

#Preview {
    SampleSceneView().frame(height: 420)
}
