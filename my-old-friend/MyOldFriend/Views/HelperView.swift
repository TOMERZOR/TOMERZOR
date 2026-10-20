import SwiftUI

/// The main screen, top to bottom: what the camera sees (with Moffy in it), what Moffy says,
/// and one big button to talk. Everything else is quiet.
struct HelperView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper
    @State private var showSettings = UserDefaults.standard.string(forKey: "screenshotScene") == "settings"
    @State private var showTyping = false

    var body: some View {
        VStack(spacing: 14) {
            GeometryReader { geo in
                StageView(size: geo.size, showSettings: $showSettings)
                    .onAppear { helper.stageSize = geo.size }
                    .onChange(of: geo.size) { _, size in helper.stageSize = size }
            }
            .frame(minHeight: 220)
            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
            .padding(.horizontal, 12)

            VStack(spacing: 12) {
                CaptionCard()
                TalkButton()
                HStack(spacing: 8) {
                    QuietButton(title: settings.t("Type instead", "לכתוב במקום"), systemImage: "keyboard") {
                        showTyping = true
                    }
                    QuietButton(title: settings.t("New question", "שאלה חדשה"), systemImage: "arrow.counterclockwise") {
                        helper.startOver()
                    }
                }
            }
            .padding(.horizontal, 16)
        }
        .padding(.top, 4)
        .padding(.bottom, 4)
        .background(Theme.surface.ignoresSafeArea())
        .onAppear { helper.appeared() }
        // Feel it as well as see it: a tap when listening starts and stops, a soft knock when Moffy answers.
        .sensoryFeedback(trigger: helper.phase) { old, new in
            if new == .listening { return .start }
            if old == .listening { return .stop }
            return nil
        }
        .sensoryFeedback(.impact(weight: .light), trigger: helper.reply.id)
        .sheet(isPresented: $showSettings) {
            SettingsView().inheritingAppEnvironment(settings: settings, helper: helper)
        }
        .sheet(isPresented: $showTyping) {
            TypeQuestionView { text in helper.ask(typed: text) }
                .inheritingAppEnvironment(settings: settings, helper: helper)
        }
    }
}

/// The camera area. Moffy waits in a corner and hops over to whatever he points at.
private struct StageView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.openURL) private var openURL
    let size: CGSize
    @Binding var showSettings: Bool

    private var cameraVisible: Bool { helper.showsSampleScene || (helper.cameraOn && helper.camera.isAuthorized) }
    private var moffySize: CGFloat { cameraVisible ? 104 : min(200, size.width * 0.45) }

    private var target: CGPoint? {
        guard cameraVisible, let point = helper.reply.point else { return nil }
        return CGPoint(x: point.x * size.width, y: point.y * size.height)
    }

    var body: some View {
        ZStack {
            if helper.showsSampleScene {
                SampleSceneView()
            } else if cameraVisible {
                CameraPreview(session: helper.camera.session)
                    .transition(.opacity)
            } else {
                noCamera
            }

            if let target {
                PointerView(target: target, moffyCenter: moffyCenter, moffySize: moffySize,
                            label: helper.reply.pointLabel, bounds: size)
                    .id(helper.reply.id)
                    .transition(.opacity)
            }

            MoffyView(mood: helper.mood, size: moffySize, look: look, wordPulse: helper.speaker.wordPulse)
                .position(moffyCenter)
                .animation(reduceMotion ? nil : .spring(response: 0.5, dampingFraction: 0.78), value: moffyCenter)

            settingsButton
        }
        .frame(width: size.width, height: size.height)
        .animation(.easeInOut(duration: 0.3), value: cameraVisible)
        // The stage is a picture of the real world, so left and right stay as they are in Hebrew too.
        .environment(\.layoutDirection, .leftToRight)
    }

    /// Where Moffy stands: beside the thing he points at, or in his corner.
    private var moffyCenter: CGPoint {
        let half = moffySize / 2
        let margin: CGFloat = 16
        func clamp(_ p: CGPoint) -> CGPoint {
            CGPoint(x: min(max(p.x, half + margin), size.width - half - margin),
                    y: min(max(p.y, half + margin + 56), size.height - half - margin))
        }
        if let target {
            let below = target.y < size.height * 0.45
            let side: CGFloat = target.x > size.width / 2 ? -1 : 1
            return clamp(CGPoint(x: target.x + side * moffySize * 0.7,
                                 y: target.y + (below ? 1 : -1) * moffySize * 1.3))
        }
        if cameraVisible {
            let x = settings.lang == .hebrew ? size.width - half - margin : half + margin
            return clamp(CGPoint(x: x, y: size.height - half - margin))
        }
        return CGPoint(x: size.width / 2, y: size.height * 0.5)
    }

    private var look: CGSize {
        if let target {
            let dx = target.x - moffyCenter.x
            let dy = target.y - moffyCenter.y
            let length = max(sqrt(dx * dx + dy * dy), 1)
            return CGSize(width: dx / length, height: dy / length)
        }
        switch helper.mood {
        case .thinking: return CGSize(width: 0.6, height: -0.8)
        case .listening: return CGSize(width: 0, height: 0.3)
        default: return .zero
        }
    }

    private var noCamera: some View {
        ZStack(alignment: .bottom) {
            Theme.card
            if helper.cameraOn && !helper.camera.isAuthorized {
                VStack(spacing: 10) {
                    Text(settings.t("Moffy can't see yet.", "מופי עוד לא רואה."))
                        .font(.rounded(.title3, .bold))
                        .foregroundStyle(Theme.ink)
                    Button(settings.t("Allow the camera", "לאשר את המצלמה")) {
                        if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                    }
                    .font(.rounded(.title3, .semibold))
                    .foregroundStyle(Theme.actionText)
                    .frame(minHeight: 44)
                }
                .multilineTextAlignment(.center)
                .padding(20)
                .environment(\.layoutDirection, settings.lang.layoutDirection)
            }
        }
    }

    private var settingsButton: some View {
        VStack {
            HStack {
                Spacer()
                Button { showSettings = true } label: {
                    Image(systemName: "gearshape.fill")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .frame(width: 52, height: 52)
                        .background(Circle().fill(.regularMaterial))
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel(settings.t("Settings", "הגדרות"))
            }
            Spacer()
        }
        .padding(12)
    }
}

/// What Moffy is saying, in big letters, with a button to hear it again.
private struct CaptionCard: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.rounded(.title, .bold))
                .foregroundStyle(Theme.ink)
                .lineLimit(3)
                .minimumScaleFactor(0.75)
                .contentTransition(.opacity)
            if !message.isEmpty {
                Text(message)
                    .font(.rounded(.title3))
                    .foregroundStyle(Theme.inkSecondary)
                    .lineLimit(6)
                    .minimumScaleFactor(0.75)
                    .contentTransition(.opacity)
            }
            if helper.phase == .ready && !helper.reply.say.isEmpty {
                Button { helper.sayAgain() } label: {
                    Label(settings.t("Say again", "להגיד שוב"), systemImage: "speaker.wave.2.fill")
                        .font(.rounded(.headline, .semibold))
                        .foregroundStyle(Theme.actionText)
                        .frame(minHeight: 44)
                }
                .buttonStyle(PressableStyle())
                .transition(.opacity)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(Theme.card))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Theme.hairline, lineWidth: 1))
        .animation(.easeInOut(duration: 0.25), value: title)
        .animation(.easeInOut(duration: 0.25), value: message)
        .accessibilityElement(children: .combine)
    }

    private var title: String {
        switch helper.phase {
        case .listening: return settings.t("I'm listening…", "אני מקשיב…")
        case .thinking: return settings.t("Let me look…", "רגע, אני מסתכל…")
        case .ready: return helper.reply.caption
        }
    }

    private var message: String {
        switch helper.phase {
        case .listening:
            return helper.listener.transcript.isEmpty
                ? settings.t("Tell me what you need.", "ספרו לי מה צריך.")
                : "“\(helper.listener.transcript)”"
        case .thinking: return ""
        case .ready: return helper.reply.say
        }
    }
}

/// The one big button. Tap to talk, tap again when done.
private struct TalkButton: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper

    var body: some View {
        Button { helper.talkButtonTapped() } label: {
            HStack(spacing: 14) {
                switch helper.phase {
                case .thinking: ProgressView().tint(.white).controlSize(.large)
                case .listening: Image(systemName: "stop.circle.fill")
                case .ready: Image(systemName: "mic.fill")
                }
                Text(title)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            .font(.rounded(.title, .bold))
            .foregroundStyle(Color.white)
            .frame(maxWidth: .infinity, minHeight: 88)
            .background(RoundedRectangle(cornerRadius: 28, style: .continuous).fill(Theme.action))
            .overlay(ListeningRing(active: helper.phase == .listening))
        }
        .buttonStyle(PressableStyle())
        .disabled(helper.phase == .thinking)
        .accessibilityHint(helper.phase == .listening
                           ? settings.t("Stops listening", "מפסיק להקשיב")
                           : settings.t("Starts listening", "מתחיל להקשיב"))
    }

    private var title: String {
        switch helper.phase {
        case .ready: return settings.t("Tap and talk", "לחצו ודברו")
        case .listening: return settings.t("I'm done", "סיימתי")
        case .thinking: return settings.t("Thinking…", "חושב…")
        }
    }
}

/// A slow ring that spreads out from the button while Moffy listens. A still outline with Reduce Motion.
private struct ListeningRing: View {
    let active: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: !active || reduceMotion)) { timeline in
            let progress = reduceMotion ? 0 : timeline.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 1.8) / 1.8
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(Theme.action, lineWidth: 3)
                .padding(-CGFloat(progress) * 10)
                .opacity(active ? (reduceMotion ? 1 : 1 - progress) : 0)
        }
        .allowsHitTesting(false)
    }
}
