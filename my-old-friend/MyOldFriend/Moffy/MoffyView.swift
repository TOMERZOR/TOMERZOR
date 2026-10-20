import SwiftUI

enum MoffyMood: String, Equatable {
    case idle, listening, thinking, talking, happy, pointing, worried
}

/// Moffy: a pink rounded square with two white eyes.
/// He bobs, blinks, hops when his mood changes, squishes on every spoken word,
/// and his eyes follow whatever he is looking at.
struct MoffyView: View {
    var mood: MoffyMood
    var size: CGFloat = 160
    /// Where Moffy looks, from -1 to 1 on each axis. (0, 0) is straight at you.
    var look: CGSize = .zero
    /// Changes once per spoken word, so Moffy bounces along with his voice.
    var wordPulse: Int = 0

    @State private var hop: CGFloat = 0
    @State private var squash: CGFloat = 1

    var body: some View {
        TimelineView(.animation) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            figure(time: t)
        }
        .frame(width: size, height: size * 1.12)
        .onChange(of: mood) { _, newMood in
            if newMood != .idle { jump() }
        }
        .onChange(of: wordPulse) { _, _ in squish() }
        .accessibilityElement()
        .accessibilityLabel("Moffy")
    }

    private func figure(time t: Double) -> some View {
        let speed: Double = mood == .listening ? 3.2 : (mood == .thinking ? 1.4 : 2.2)
        let bob = CGFloat(sin(t * speed)) * size * 0.03
        let blink = mood != .happy && t.truncatingRemainder(dividingBy: 3.6) < 0.14
        let sway = mood == .thinking ? sin(t * 1.6) * 7 : Double(look.width) * 9
        let wiggle = mood == .happy ? sin(t * 9) * 3 : 0
        let lift = -(hop + bob)

        return ZStack(alignment: .bottom) {
            // Shadow on the floor shrinks when he jumps.
            Ellipse()
                .fill(Color.black.opacity(0.18))
                .frame(width: size * 0.7 * (1 - min(hop / size, 0.3)), height: size * 0.09)
                .blur(radius: 3)

            character(blink: blink, time: t)
                .scaleEffect(x: 2 - squash, y: squash, anchor: .bottom)
                .rotationEffect(.degrees(sway + wiggle), anchor: .bottom)
                .offset(y: lift - size * 0.06)
        }
        .frame(width: size, height: size * 1.12, alignment: .bottom)
    }

    private func character(blink: Bool, time t: Double) -> some View {
        let corner = size * 0.26
        let eyeShift = CGSize(width: look.width * size * 0.07, height: look.height * size * 0.06)

        return ZStack {
            RoundedRectangle(cornerRadius: corner, style: .continuous)
                .fill(Theme.pinkDeep)
                .offset(y: size * 0.035)
            RoundedRectangle(cornerRadius: corner, style: .continuous)
                .fill(LinearGradient(colors: [Theme.pinkLight, Theme.pink],
                                     startPoint: .top, endPoint: .bottom))
            Capsule()
                .fill(Color.white.opacity(0.35))
                .frame(width: size * 0.42, height: size * 0.05)
                .offset(x: -size * 0.08, y: -size * 0.39)
            HStack(spacing: size * 0.2) {
                MoffyEye(mood: mood, blink: blink, size: size, side: -1)
                MoffyEye(mood: mood, blink: blink, size: size, side: 1)
            }
            .offset(x: eyeShift.width, y: eyeShift.height - size * 0.06)
            if mood == .thinking {
                ThinkingDots(time: t, size: size)
                    .offset(x: size * 0.42, y: -size * 0.55)
            }
        }
        .frame(width: size, height: size * 0.92)
    }

    private func jump() {
        withAnimation(.spring(response: 0.18, dampingFraction: 0.55)) {
            hop = size * 0.22
            squash = 1.06
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.17) {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.45)) {
                hop = 0
                squash = 0.88
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.14) {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.4)) { squash = 1 }
            }
        }
    }

    private func squish() {
        withAnimation(.easeOut(duration: 0.07)) { squash = 0.93 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
            withAnimation(.spring(response: 0.22, dampingFraction: 0.45)) { squash = 1 }
        }
    }
}

private struct MoffyEye: View {
    let mood: MoffyMood
    let blink: Bool
    let size: CGFloat
    /// -1 for the left eye, 1 for the right eye.
    let side: CGFloat

    var body: some View {
        switch mood {
        case .happy:
            HappyEye()
                .stroke(Color.white, style: StrokeStyle(lineWidth: size * 0.065, lineCap: .round, lineJoin: .round))
                .frame(width: size * 0.15, height: size * 0.08)
        default:
            Capsule()
                .fill(Color.white)
                .frame(width: size * 0.085, height: height)
                .scaleEffect(y: blink ? 0.1 : 1)
                .rotationEffect(.degrees(mood == .worried ? Double(side) * -14 : 0))
        }
    }

    private var height: CGFloat {
        switch mood {
        case .listening, .pointing: return size * 0.26
        case .thinking: return size * 0.17
        case .worried: return size * 0.15
        default: return size * 0.22
        }
    }
}

/// A smiling "^" eye for happy moments.
private struct HappyEye: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.maxY),
                          control: CGPoint(x: rect.midX, y: rect.minY - rect.height * 0.9))
        return path
    }
}

private struct ThinkingDots: View {
    let time: Double
    let size: CGFloat

    var body: some View {
        HStack(spacing: size * 0.04) {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(Theme.pink)
                    .frame(width: size * 0.07, height: size * 0.07)
                    .offset(y: CGFloat(sin(time * 5 - Double(i) * 0.8)) * size * 0.04)
            }
        }
    }
}

#Preview {
    VStack(spacing: 30) {
        HStack {
            MoffyView(mood: .idle, size: 120)
            MoffyView(mood: .happy, size: 120)
        }
        HStack {
            MoffyView(mood: .thinking, size: 120)
            MoffyView(mood: .pointing, size: 120, look: CGSize(width: 1, height: -0.5))
        }
    }
    .padding()
    .background(Theme.cream)
}
