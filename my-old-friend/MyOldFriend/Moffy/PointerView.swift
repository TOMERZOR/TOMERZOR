import SwiftUI

/// The ring Moffy draws around the thing to press, with a dotted path from him to it.
/// It draws in once, then breathes slowly. With Reduce Motion it simply fades in and stays still.
struct PointerView: View {
    let target: CGPoint
    let moffyCenter: CGPoint
    let moffySize: CGFloat
    let label: String
    let bounds: CGSize

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var drawn: CGFloat = 0
    @State private var breathe = false

    private let ringSize: CGFloat = 78

    var body: some View {
        let dx = target.x - moffyCenter.x
        let dy = target.y - moffyCenter.y
        let distance = max(sqrt(dx * dx + dy * dy), 1)
        let unit = CGPoint(x: dx / distance, y: dy / distance)
        let start = CGPoint(x: moffyCenter.x + unit.x * moffySize * 0.62,
                            y: moffyCenter.y + unit.y * moffySize * 0.62)
        let end = CGPoint(x: target.x - unit.x * ringSize * 0.6,
                          y: target.y - unit.y * ringSize * 0.6)
        let showPath = distance > moffySize * 0.62 + ringSize * 0.6 + 16

        ZStack {
            if showPath {
                Line(from: start, to: end)
                    .trim(from: 0, to: drawn)
                    .stroke(Color.white, style: StrokeStyle(lineWidth: 10, lineCap: .round, dash: [0.5, 15]))
                Line(from: start, to: end)
                    .trim(from: 0, to: drawn)
                    .stroke(Theme.moffy, style: StrokeStyle(lineWidth: 6, lineCap: .round, dash: [0.5, 15]))
            }

            ZStack {
                Circle()
                    .stroke(Color.white, lineWidth: 10)
                    .opacity(drawn)
                Circle()
                    .trim(from: 0, to: drawn)
                    .stroke(Theme.moffy, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            .frame(width: ringSize, height: ringSize)
            .scaleEffect(breathe ? 1.06 : 1)
            .position(target)

            if !label.isEmpty {
                Text(label)
                    .font(.rounded(.title3, .bold))
                    .foregroundStyle(Color.white)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Theme.action))
                    .overlay(Capsule().stroke(Color.white, lineWidth: 2))
                    .frame(maxWidth: bounds.width * 0.8)
                    .fixedSize(horizontal: false, vertical: true)
                    .position(labelPosition)
                    .opacity(drawn)
            }
        }
        .allowsHitTesting(false)
        .accessibilityElement()
        .accessibilityLabel(label)
        .onAppear {
            if reduceMotion {
                withAnimation(.easeIn(duration: 0.25)) { drawn = 1 }
                return
            }
            withAnimation(.easeInOut(duration: 0.5).delay(0.25)) { drawn = 1 }
            withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true).delay(0.8)) { breathe = true }
        }
    }

    /// The label sits above the ring, or below it when the ring is near the top.
    private var labelPosition: CGPoint {
        let offset = ringSize * 0.5 + 34
        let y = target.y - offset < 40 ? target.y + offset : target.y - offset
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
