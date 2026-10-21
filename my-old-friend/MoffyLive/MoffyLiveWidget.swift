import ActivityKit
import SwiftUI
import WidgetKit

@main
struct MoffyLiveBundle: WidgetBundle {
    var body: some Widget {
        MoffyLiveActivity()
    }
}

/// The step Moffy is guiding through, on the Lock Screen and in the Dynamic Island, while the person
/// uses another app. Same look as the app: white, Moffy pink, big letters.
struct MoffyLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: MoffyLiveAttributes.self) { context in
            LockScreenStep(state: context.state, hebrew: context.attributes.hebrew)
                .activityBackgroundTint(Color.white)
                .activitySystemActionForegroundColor(Live.pink)
        } dynamicIsland: { context in
            let state = context.state
            let hebrew = context.attributes.hebrew
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    MoffyFace(size: 44).padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    StepBadge(step: state.step, hebrew: hebrew)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(state.caption)
                        .font(.headline.weight(.bold))
                        .lineLimit(2)
                        .multilineTextAlignment(.center)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack(alignment: .center, spacing: 12) {
                        MiniScreen(state: state, height: 70)
                        Text(state.say)
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.85))
                            .lineLimit(3)
                            .frame(maxWidth: .infinity, alignment: hebrew ? .trailing : .leading)
                            .multilineTextAlignment(hebrew ? .trailing : .leading)
                    }
                    .environment(\.layoutDirection, hebrew ? .rightToLeft : .leftToRight)
                }
            } compactLeading: {
                MoffyFace(size: 22)
            } compactTrailing: {
                if state.hasPoint && !state.finished {
                    Circle().fill(Live.pink).frame(width: 12, height: 12)
                        .overlay(Circle().stroke(Color.white, lineWidth: 2))
                } else {
                    Text(state.finished ? "✓" : "\(max(state.step, 1))")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Live.pinkLight)
                }
            } minimal: {
                MoffyFace(size: 20)
            }
            .keylineTint(Live.pink)
        }
    }
}

private enum Live {
    static let pink = Color(red: 0xD6 / 255, green: 0x33 / 255, blue: 0x6F / 255)
    static let pinkLight = Color(red: 0xF7 / 255, green: 0x99 / 255, blue: 0xBF / 255)
    static let moffy = Color(red: 0xED / 255, green: 0x6B / 255, blue: 0x9E / 255)
    static let moffyDeep = Color(red: 0xBF / 255, green: 0x45 / 255, blue: 0x7A / 255)
    static let ink = Color(red: 0x24 / 255, green: 0x1B / 255, blue: 0x27 / 255)
    static let inkSecondary = Color(red: 0x5A / 255, green: 0x4D / 255, blue: 0x5F / 255)
}

private struct LockScreenStep: View {
    let state: MoffyLiveAttributes.ContentState
    let hebrew: Bool

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            MoffyFace(size: 48)
            VStack(alignment: .leading, spacing: 4) {
                StepBadge(step: state.step, hebrew: hebrew)
                Text(state.caption.isEmpty ? (hebrew ? "מסתכלת על המסך…" : "Looking at the screen…") : state.caption)
                    .font(.title3.weight(.bold))
                    .foregroundStyle(Live.ink)
                    .lineLimit(2)
                if !state.say.isEmpty {
                    Text(state.say)
                        .font(.subheadline)
                        .foregroundStyle(Live.inkSecondary)
                        .lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            MiniScreen(state: state, height: 92)
        }
        .padding(16)
        .environment(\.layoutDirection, hebrew ? .rightToLeft : .leftToRight)
    }
}

private struct StepBadge: View {
    let step: Int
    let hebrew: Bool

    var body: some View {
        Text(hebrew ? "מופי · שלב \(max(step, 1))" : "Moffy · Step \(max(step, 1))")
            .font(.caption.weight(.bold))
            .foregroundStyle(Live.pink)
    }
}

/// Moffy as in the app: a pink rounded square on a deeper pink base, with two white pill eyes.
private struct MoffyFace: View {
    let size: CGFloat

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.3, style: .continuous)
                .fill(Live.moffyDeep)
                .offset(y: size * 0.07)
            RoundedRectangle(cornerRadius: size * 0.3, style: .continuous)
                .fill(LinearGradient(colors: [Live.pinkLight, Live.moffy], startPoint: .top, endPoint: .bottom))
            HStack(spacing: size * 0.14) {
                Capsule().fill(.white).frame(width: size * 0.13, height: size * 0.36)
                Capsule().fill(.white).frame(width: size * 0.13, height: size * 0.36)
            }
        }
        .frame(width: size, height: size)
        .accessibilityLabel("Moffy")
    }
}

/// A small drawing of the phone's screen with a pink dot where to tap.
private struct MiniScreen: View {
    let state: MoffyLiveAttributes.ContentState
    let height: CGFloat

    var body: some View {
        let width = height * 0.46
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: width * 0.18, style: .continuous)
                .fill(Color.gray.opacity(0.18))
            RoundedRectangle(cornerRadius: width * 0.18, style: .continuous)
                .stroke(Live.ink.opacity(0.55), lineWidth: 2)
            if state.hasPoint {
                Circle()
                    .fill(Live.pink)
                    .frame(width: 12, height: 12)
                    .overlay(Circle().stroke(Color.white, lineWidth: 2.5))
                    .position(x: min(max(state.x, 0.08), 0.92) * width, y: min(max(state.y, 0.05), 0.95) * height)
            }
        }
        .frame(width: width, height: height)
        // The drawing is the real screen, so left and right stay as they are in Hebrew too.
        .environment(\.layoutDirection, .leftToRight)
        .accessibilityHidden(true)
    }
}
