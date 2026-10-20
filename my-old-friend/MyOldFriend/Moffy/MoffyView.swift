import SwiftUI

enum MoffyMood: String, Equatable {
    case idle, listening, thinking, talking, happy, pointing, worried
}

/// Moffy: a pink rounded square with two white eyes.
///
/// His motion is calm on purpose: a slow breath and natural blinks while he waits, one small hop
/// when something happens, a gentle nod on spoken words. Eyes carry most of the feeling.
/// With Reduce Motion on he holds still and only his eyes change.
struct MoffyView: View {
    var mood: MoffyMood
    var size: CGFloat = 160
    /// Where Moffy looks, from -1 to 1 on each axis. (0, 0) is straight at you.
    var look: CGSize = .zero
    /// Changes once per spoken word, so Moffy nods along with his voice.
    var wordPulse: Int = 0

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var hop: CGFloat = 0
    @State private var squash: CGFloat = 1

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduceMotion)) { timeline in
            figure(time: reduceMotion ? 0 : timeline.date.timeIntervalSinceReferenceDate)
        }
        .frame(width: size, height: size * 1.12)
        .onChange(of: mood) { _, newMood in
            if [.happy, .pointing, .listening].contains(newMood) { jump() }
        }
        .onChange(of: wordPulse) { _, _ in nod() }
        .accessibilityElement()
        .accessibilityLabel("Moffy")
        .accessibilityHidden(true)
    }

    private func figure(time t: Double) -> some View {
        // One slow breath every ~4 seconds; a little quicker while listening.
        let breathRate = mood == .listening ? 2.2 : 1.5
        let breath = 1 + CGFloat(sin(t * breathRate)) * 0.012
        // A natural blink every 4.5 seconds, plus a quick double blink now and then.
        let cycle = t.truncatingRemainder(dividingBy: 4.5)
        let blink = !reduceMotion && mood != .happy && (cycle < 0.12 || (Int(t / 4.5) % 3 == 0 && cycle > 0.22 && cycle < 0.32))
        let tilt = mood == .thinking ? 4.0 : Double(look.width) * 6

        return ZStack(alignment: .bottom) {
            Ellipse()
                .fill(Color.black.opacity(0.14))
                .frame(width: size * 0.66 * (1 - min(hop / size, 0.3)), height: size * 0.08)
                .blur(radius: 3)

            character(blink: blink, time: t)
                .scaleEffect(x: (2 - squash) / breath, y: squash * breath, anchor: .bottom)
                .rotationEffect(.degrees(tilt), anchor: .bottom)
                .offset(y: -hop - size * 0.05)
                .animation(reduceMotion ? nil : .spring(response: 0.5, dampingFraction: 0.8), value: tilt)
        }
        .frame(width: size, height: size * 1.12, alignment: .bottom)
    }

    private func character(blink: Bool, time t: Double) -> some View {
        let corner = size * 0.26
        let eyeShift = CGSize(width: look.width * size * 0.07, height: look.height * size * 0.06)

        return ZStack {
            RoundedRectangle(cornerRadius: corner, style: .continuous)
                .fill(Theme.moffyDeep)
                .offset(y: size * 0.035)
            RoundedRectangle(cornerRadius: corner, style: .continuous)
                .fill(LinearGradient(colors: [Theme.moffyLight, Theme.moffy], startPoint: .top, endPoint: .bottom))
            Capsule()
                .fill(Color.white.opacity(0.32))
                .frame(width: size * 0.4, height: size * 0.045)
                .offset(x: -size * 0.08, y: -size * 0.38)
            HStack(spacing: size * 0.2) {
                MoffyEye(mood: mood, blink: blink, size: size, side: -1)
                MoffyEye(mood: mood, blink: blink, size: size, side: 1)
            }
            .offset(x: eyeShift.width, y: eyeShift.height - size * 0.06)
            .animation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.8), value: look)
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: mood)
            if mood == .thinking {
                ThinkingDots(time: t, size: size)
                    .offset(x: size * 0.4, y: -size * 0.56)
                    .transition(.opacity)
            }
        }
        .frame(width: size, height: size * 0.92)
    }

    /// One small, quick hop: the "I've got something!" moment.
    private func jump() {
        guard !reduceMotion else { return }
        withAnimation(.easeOut(duration: 0.16)) {
            hop = size * 0.14
            squash = 1.04
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.16) {
            withAnimation(.spring(response: 0.32, dampingFraction: 0.62)) {
                hop = 0
                squash = 1
            }
        }
    }

    /// A tiny dip on each spoken word.
    private func nod() {
        guard !reduceMotion else { return }
        withAnimation(.easeOut(duration: 0.08)) { squash = 0.975 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.09) {
            withAnimation(.easeOut(duration: 0.18)) { squash = 1 }
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
        if mood == .happy {
            HappyEye()
                .stroke(Color.white, style: StrokeStyle(lineWidth: size * 0.065, lineCap: .round, lineJoin: .round))
                .frame(width: size * 0.15, height: size * 0.08)
        } else {
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

/// Three dots that rise and fall slowly while Moffy thinks. Still with Reduce Motion.
private struct ThinkingDots: View {
    let time: Double
    let size: CGFloat

    var body: some View {
        HStack(spacing: size * 0.04) {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(Theme.moffy)
                    .frame(width: size * 0.065, height: size * 0.065)
                    .opacity(0.45 + 0.55 * max(0, sin(time * 3 - Double(i) * 0.9)))
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
    .background(Theme.surface)
}
