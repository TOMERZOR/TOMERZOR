import SwiftUI

/// The pulsing ring Moffy draws around the thing to press, with a dotted arrow from him to it.
struct PointerView: View {
    let target: CGPoint
    let moffyCenter: CGPoint
    let moffySize: CGFloat
    let label: String
    let fontSize: CGFloat
    let bounds: CGSize

    @State private var pulse = false

    private let ringSize: CGFloat = 76

    var body: some View {
        let dx = target.x - moffyCenter.x
        let dy = target.y - moffyCenter.y
        let distance = max(sqrt(dx * dx + dy * dy), 1)
        let unit = CGPoint(x: dx / distance, y: dy / distance)
        let start = CGPoint(x: moffyCenter.x + unit.x * moffySize * 0.62,
                            y: moffyCenter.y + unit.y * moffySize * 0.62)
        let end = CGPoint(x: target.x - unit.x * (ringSize * 0.62),
                          y: target.y - unit.y * (ringSize * 0.62))
        let showArrow = distance > moffySize * 0.62 + ringSize * 0.62 + 12

        ZStack {
            if showArrow {
                Line(from: start, to: end)
                    .stroke(Color.white, style: StrokeStyle(lineWidth: 11, lineCap: .round, dash: [1, 16]))
                Line(from: start, to: end)
                    .stroke(Theme.pink, style: StrokeStyle(lineWidth: 7, lineCap: .round, dash: [1, 16]))
                ArrowHead(tip: end, direction: unit)
                    .fill(Theme.pink)
                    .overlay(ArrowHead(tip: end, direction: unit).stroke(Color.white, lineWidth: 3))
            }

            Circle()
                .fill(Theme.pink.opacity(0.18))
                .frame(width: ringSize, height: ringSize)
                .scaleEffect(pulse ? 1.45 : 1)
                .opacity(pulse ? 0 : 1)
                .position(target)
            Circle()
                .stroke(Color.white, lineWidth: 10)
                .frame(width: ringSize, height: ringSize)
                .position(target)
            Circle()
                .stroke(Theme.pink, lineWidth: 6)
                .frame(width: ringSize, height: ringSize)
                .scaleEffect(pulse ? 1.08 : 0.94)
                .position(target)

            if !label.isEmpty {
                Text(label)
                    .font(.system(size: fontSize * 0.8, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color.white)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Theme.pinkDeep))
                    .overlay(Capsule().stroke(Color.white, lineWidth: 3))
                    .frame(maxWidth: bounds.width * 0.8)
                    .fixedSize(horizontal: false, vertical: true)
                    .position(labelPosition)
            }
        }
        .allowsHitTesting(false)
        .onAppear {
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) {
                pulse = true
            }
        }
    }

    /// The label sits above the ring, or below it when the ring is near the top.
    private var labelPosition: CGPoint {
        let offset = ringSize * 0.5 + fontSize * 1.1
        let y = target.y - offset < fontSize * 1.2 ? target.y + offset : target.y - offset
        let halfWidth = bounds.width * 0.4
        let x = min(max(target.x, halfWidth), bounds.width - halfWidth)
        return CGPoint(x: x, y: y)
    }
}

private struct Line: Shape {
    let from: CGPoint
    let to: CGPoint

    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: from)
        path.addLine(to: to)
        return path
    }
}

private struct ArrowHead: Shape {
    let tip: CGPoint
    let direction: CGPoint

    func path(in rect: CGRect) -> Path {
        let length: CGFloat = 26
        let width: CGFloat = 15
        let back = CGPoint(x: tip.x - direction.x * length, y: tip.y - direction.y * length)
        let normal = CGPoint(x: -direction.y, y: direction.x)
        var path = Path()
        path.move(to: tip)
        path.addLine(to: CGPoint(x: back.x + normal.x * width, y: back.y + normal.y * width))
        path.addLine(to: CGPoint(x: back.x - normal.x * width, y: back.y - normal.y * width))
        path.closeSubpath()
        return path
    }
}
