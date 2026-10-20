import SwiftUI

/// The main screen: the camera on top with Moffy in it, Moffy's words and the big buttons below.
struct HelperView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper
    @State private var showSettings = false
    @State private var showTyping = false

    var body: some View {
        VStack(spacing: 12) {
            GeometryReader { geo in
                StageView(size: geo.size, showSettings: $showSettings)
                    .onAppear { helper.stageSize = geo.size }
                    .onChange(of: geo.size) { _, size in helper.stageSize = size }
            }
            .clipShape(RoundedRectangle(cornerRadius: 30, style: .continuous))
            .padding(.horizontal, 12)

            BottomPanel(showTyping: $showTyping)
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
        }
        .padding(.top, 4)
        .background(Theme.cream.ignoresSafeArea())
        .onAppear { helper.appeared() }
        .sheet(isPresented: $showSettings) {
            SettingsView().inheritingAppEnvironment(settings: settings, helper: helper)
        }
        .sheet(isPresented: $showTyping) {
            TypeQuestionView { text in helper.ask(typed: text) }
                .inheritingAppEnvironment(settings: settings, helper: helper)
        }
    }
}

/// The camera area. Moffy lives here, and hops over to whatever he points at.
private struct StageView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper
    let size: CGSize
    @Binding var showSettings: Bool

    private var cameraVisible: Bool { helper.cameraOn && helper.camera.isAuthorized }
    private var moffySize: CGFloat { cameraVisible ? 110 : min(210, size.width * 0.5) }

    private var target: CGPoint? {
        guard cameraVisible, let point = helper.reply.point else { return nil }
        return CGPoint(x: point.x * size.width, y: point.y * size.height)
    }

    var body: some View {
        ZStack {
            if cameraVisible {
                CameraPreview(session: helper.camera.session)
            } else {
                noCamera
            }

            if let target {
                PointerView(target: target, moffyCenter: moffyCenter, moffySize: moffySize,
                            label: helper.reply.pointLabel, fontSize: settings.textSize.body, bounds: size)
                    .id(helper.reply.id)
                    .transition(.opacity)
            }

            MoffyView(mood: helper.mood, size: moffySize, look: look, wordPulse: helper.speaker.wordPulse)
                .position(moffyCenter)
                .animation(.spring(response: 0.42, dampingFraction: 0.58), value: moffyCenter)

            topButtons
        }
        .frame(width: size.width, height: size.height)
        // The stage is a picture, so it keeps left/right as they are even in Hebrew.
        .environment(\.layoutDirection, .leftToRight)
    }

    /// Where Moffy stands: next to the thing he points at, or in his corner.
    private var moffyCenter: CGPoint {
        let half = moffySize / 2
        let margin: CGFloat = 14
        func clamp(_ p: CGPoint) -> CGPoint {
            CGPoint(x: min(max(p.x, half + margin), size.width - half - margin),
                    y: min(max(p.y, half + margin + 50), size.height - half - margin))
        }
        if let target {
            let below = target.y < size.height * 0.45
            let side: CGFloat = target.x > size.width / 2 ? -1 : 1
            return clamp(CGPoint(x: target.x + side * moffySize * 0.7,
                                 y: target.y + (below ? 1 : -1) * moffySize * 1.25))
        }
        if cameraVisible {
            let x = settings.lang == .hebrew ? size.width - half - margin : half + margin
            return clamp(CGPoint(x: x, y: size.height - half - margin))
        }
        return CGPoint(x: size.width / 2, y: size.height * 0.45)
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
        ZStack {
            LinearGradient(colors: [Theme.blush, Theme.cream], startPoint: .top, endPoint: .bottom)
            if !helper.camera.isAuthorized && helper.cameraOn {
                VStack {
                    Spacer()
                    Text(settings.t("I can't see yet. Please allow the camera in the phone's Settings.",
                                    "אני עוד לא רואה. אפשר לאשר את המצלמה בהגדרות של הטלפון."))
                        .font(.system(size: settings.textSize.body * 0.85, weight: .semibold, design: .rounded))
                        .foregroundStyle(Theme.inkSoft)
                        .multilineTextAlignment(.center)
                        .padding(20)
                }
            }
        }
    }

    private var topButtons: some View {
        VStack {
            HStack {
                RoundIconButton(systemImage: helper.cameraOn ? "video.fill" : "video.slash.fill",
                                label: helper.cameraOn ? settings.t("Hide camera", "להסתיר מצלמה")
                                                       : settings.t("Show camera", "להראות מצלמה")) {
                    helper.setCamera(on: !helper.cameraOn)
                }
                Spacer()
                RoundIconButton(systemImage: "gearshape.fill", label: settings.t("Settings", "הגדרות")) {
                    showSettings = true
                }
            }
            Spacer()
        }
        .padding(12)
    }
}

private struct RoundIconButton: View {
    let systemImage: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Theme.ink)
                .frame(width: 56, height: 56)
                .background(Circle().fill(.regularMaterial))
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel(label)
    }
}

/// Moffy's words in big letters, the big talk button, and three helper buttons.
private struct BottomPanel: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper
    @Binding var showTyping: Bool

    var body: some View {
        VStack(spacing: 12) {
            caption
            talkButton
            HStack(spacing: 10) {
                SmallButton(title: settings.t("Say again", "שוב"), systemImage: "speaker.wave.2.fill") {
                    helper.sayAgain()
                }
                SmallButton(title: settings.t("Type", "לכתוב"), systemImage: "keyboard") {
                    showTyping = true
                }
                SmallButton(title: settings.t("Start over", "מההתחלה"), systemImage: "arrow.counterclockwise") {
                    helper.startOver()
                }
            }
        }
    }

    private var caption: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(captionTitle)
                .font(.system(size: settings.textSize.title, weight: .heavy, design: .rounded))
                .foregroundStyle(Theme.ink)
                .lineLimit(2)
                .minimumScaleFactor(0.6)
            if !captionBody.isEmpty {
                Text(captionBody)
                    .font(.system(size: settings.textSize.body, weight: .medium, design: .rounded))
                    .foregroundStyle(Theme.inkSoft)
                    .lineLimit(5)
                    .minimumScaleFactor(0.6)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(Color.white))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Theme.blush, lineWidth: 2))
        .animation(.easeInOut(duration: 0.2), value: captionTitle)
    }

    private var captionTitle: String {
        switch helper.phase {
        case .listening: return settings.t("I'm listening…", "אני מקשיב…")
        case .thinking: return settings.t("Let me look…", "רגע, אני מסתכל…")
        case .ready: return helper.reply.caption
        }
    }

    private var captionBody: String {
        switch helper.phase {
        case .listening:
            return helper.listener.transcript.isEmpty
                ? settings.t("Tell me what you need. Tap the button when you're done.", "ספרו לי מה צריך. לחצו על הכפתור כשסיימתם.")
                : "“\(helper.listener.transcript)”"
        case .thinking: return ""
        case .ready: return helper.reply.say
        }
    }

    private var talkButton: some View {
        Button { helper.talkButtonTapped() } label: {
            HStack(spacing: 14) {
                switch helper.phase {
                case .thinking:
                    ProgressView().tint(.white).scaleEffect(1.4)
                case .listening:
                    Image(systemName: "checkmark.circle.fill")
                default:
                    Image(systemName: "mic.fill")
                }
                Text(talkTitle)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            .font(.system(size: settings.textSize.button + 4, weight: .heavy, design: .rounded))
            .foregroundStyle(Color.white)
            .frame(maxWidth: .infinity, minHeight: 96)
            .background(
                RoundedRectangle(cornerRadius: 30, style: .continuous)
                    .fill(helper.phase == .listening ? Theme.pinkDeep : Theme.pink)
                    .shadow(color: Theme.pink.opacity(0.4), radius: 12, y: 6)
            )
            .overlay(ListeningGlow(active: helper.phase == .listening))
        }
        .buttonStyle(PressableStyle())
        .disabled(helper.phase == .thinking)
    }

    private var talkTitle: String {
        switch helper.phase {
        case .ready: return settings.t("Tap and talk", "לחצו ודברו")
        case .listening: return settings.t("I'm done", "סיימתי")
        case .thinking: return settings.t("Thinking…", "חושב…")
        }
    }
}

private struct SmallButton: View {
    @EnvironmentObject private var settings: AppSettings
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: systemImage)
                    .font(.system(size: 22, weight: .bold))
                Text(title)
                    .font(.system(size: max(settings.textSize.body - 4, 17), weight: .bold, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            .foregroundStyle(Theme.pinkDeep)
            .frame(maxWidth: .infinity, minHeight: 68)
            .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Color.white))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Theme.pink.opacity(0.5), lineWidth: 2))
        }
        .buttonStyle(PressableStyle())
    }
}

/// A soft pulsing ring around the talk button while Moffy listens.
private struct ListeningGlow: View {
    let active: Bool
    @State private var pulse = false

    var body: some View {
        RoundedRectangle(cornerRadius: 30, style: .continuous)
            .stroke(Theme.pink, lineWidth: 4)
            .scaleEffect(pulse ? 1.06 : 1)
            .opacity(active ? (pulse ? 0 : 0.9) : 0)
            .onAppear {
                withAnimation(.easeOut(duration: 1.1).repeatForever(autoreverses: false)) { pulse = true }
            }
            .allowsHitTesting(false)
    }
}
