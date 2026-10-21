import SwiftUI

/// The main screen. The camera fills the whole screen; a frame marks what Moffy sees; a status line
/// at the top; Moffy's answer in a card at the bottom; one pink button to act.
struct HelperView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper
    @State private var showSettings = UserDefaults.standard.string(forKey: "screenshotScene") == "settings"
    @State private var showTyping = false
    @State private var showLive = false
    @State private var controlHeight: CGFloat = 77

    var body: some View {
        GeometryReader { geo in
            let layout = StageLayout(size: geo.size, insets: geo.safeAreaInsets, controlHeight: controlHeight)
            VStack(spacing: 0) {
                TopBar(showSettings: $showSettings)
                    .frame(height: layout.topBar)
                Spacer(minLength: 0)
                BottomPanel(cardHeight: layout.cardReserve, showTyping: $showTyping, showLive: $showLive, controlHeight: $controlHeight)
            }
            // The picture is a background, so it reaches the screen edges without moving the controls.
            .background(alignment: .topLeading) {
                StageView(layout: layout)
                    .ignoresSafeArea()
            }
            .onAppear { report(layout) }
            .onChange(of: layout.compact) { _, _ in report(layout) }
        }
        .background(Theme.surface.ignoresSafeArea())
        .onAppear { helper.appeared() }
        // Feel it as well as see it: a tap when listening starts and stops, a soft knock when Moffy answers.
        .sensoryFeedback(trigger: helper.phase) { old, new in
            if new == .listening { return .start }
            if old == .listening { return .stop }
            return nil
        }
        .sensoryFeedback(.impact(weight: .light), trigger: helper.reply?.id)
        .sheet(isPresented: $showSettings) {
            SettingsView().inheritingAppEnvironment(settings: settings, helper: helper)
        }
        .sheet(isPresented: $showTyping) {
            TypeQuestionView { text in helper.ask(typed: text) }
                .inheritingAppEnvironment(settings: settings, helper: helper)
        }
        .sheet(isPresented: $showLive) {
            LiveStartSheet().inheritingAppEnvironment(settings: settings, helper: helper)
        }
        .sheet(isPresented: Binding(get: { helper.subscription.showPaywall },
                                    set: { helper.subscription.showPaywall = $0 })) {
            PaywallView().inheritingAppEnvironment(settings: settings, helper: helper)
        }
    }

    /// Tells the helper which part of the picture is inside the frame, for the snapshot.
    private func report(_ layout: StageLayout) {
        helper.screenSize = layout.screenSize
        helper.viewfinder = layout.onScreen(layout.compact)
    }
}

/// Where things go. `size` and the frames are in safe-area coordinates; `onScreen` converts.
struct StageLayout {
    let size: CGSize
    let insets: EdgeInsets
    let controlHeight: CGFloat
    let topBar: CGFloat = 68

    /// The space kept for the answer card above the button.
    var cardReserve: CGFloat { min(max(size.height * 0.35, 220), 340) }
    private var controlTop: CGFloat { size.height - controlHeight - 8 }

    /// The frame while Moffy listens, looks or answers; the card sits below it.
    var compact: CGRect {
        let bottom = max(controlTop - 12 - cardReserve - 14, topBar + 160)
        return CGRect(x: 16, y: topBar, width: size.width - 32, height: bottom - topBar)
    }

    /// The frame while waiting: it reaches down to the button.
    var expanded: CGRect {
        CGRect(x: 16, y: topBar, width: size.width - 32, height: max(controlTop - 16 - topBar, 160))
    }

    var screenSize: CGSize {
        CGSize(width: size.width + insets.leading + insets.trailing, height: size.height + insets.top + insets.bottom)
    }

    func onScreen(_ rect: CGRect) -> CGRect {
        rect.offsetBy(dx: insets.leading, dy: insets.top)
    }
}

/// Everything drawn on the picture, in whole-screen coordinates: camera, frame, pointer, Moffy.
private struct StageView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.openURL) private var openURL
    let layout: StageLayout

    private var cameraVisible: Bool { helper.showsSampleScene || (helper.cameraOn && helper.camera.isAuthorized) }
    /// A picture is in the frame: the live camera, or the newest picture from Photos.
    private var pictureVisible: Bool { cameraVisible || helper.attachedPhoto != nil }
    private var moffySize: CGFloat { pictureVisible ? 83 : 160 }
    private var frame: CGRect { layout.onScreen(helper.showsCard ? layout.compact : layout.expanded) }
    private var answerFrame: CGRect { layout.onScreen(layout.compact) }

    /// Where the picture Moffy answered about is drawn: the whole frame for the camera, or the
    /// photo fitted inside it.
    private var pictureRect: CGRect {
        guard let photo = helper.attachedPhoto else { return answerFrame }
        return Self.fit(photo.size, in: answerFrame)
    }

    private var target: CGPoint? {
        guard pictureVisible, helper.phase == .ready, let point = helper.reply?.point else { return nil }
        return CGPoint(x: pictureRect.minX + point.x * pictureRect.width,
                       y: pictureRect.minY + point.y * pictureRect.height)
    }

    static func fit(_ size: CGSize, in rect: CGRect) -> CGRect {
        guard size.width > 0, size.height > 0 else { return rect }
        let scale = min(rect.width / size.width, rect.height / size.height)
        let fitted = CGSize(width: size.width * scale, height: size.height * scale)
        return CGRect(x: rect.midX - fitted.width / 2, y: rect.midY - fitted.height / 2, width: fitted.width, height: fitted.height)
    }

    var body: some View {
        let screen = layout.screenSize
        ZStack {
            if let photo = helper.attachedPhoto {
                Theme.surface
                let shown = Self.fit(photo.size, in: frame)
                Image(uiImage: photo)
                    .resizable()
                    .frame(width: shown.width, height: shown.height)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .shadow(color: .black.opacity(0.2), radius: 12, y: 4)
                    .position(x: shown.midX, y: shown.midY)
                    .accessibilityLabel(settings.t("Your latest picture", "התמונה האחרונה שלכם"))
                    .transition(.opacity)
            } else if helper.showsSampleScene {
                SampleSceneView(focus: answerFrame)
            } else if cameraVisible {
                CameraPreview(session: helper.camera.session)
                    .transition(.opacity)
            } else {
                Theme.surface
            }

            if pictureVisible {
                FrameMask(hole: frame)
                    .fill(Color.black.opacity(0.3), style: FillStyle(eoFill: true))
                    .allowsHitTesting(false)
                FrameCorners(rect: frame)
                    .stroke(helper.phase == .thinking ? Theme.moffy : Color.white,
                            style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round))
                    .shadow(color: .black.opacity(0.25), radius: 3)
                    .allowsHitTesting(false)
            } else {
                noCameraText
            }

            if helper.attachedPhoto != nil {
                if helper.phase == .ready {
                    GlassCircleButton(systemImage: "camera.fill", label: settings.t("Back to the camera", "חזרה למצלמה"), size: 56) {
                        helper.removePhoto()
                    }
                    .position(x: settings.lang == .hebrew ? frame.minX + 40 : frame.maxX - 40, y: frame.minY + 40)
                }
            } else if helper.phase == .ready && helper.reply?.point == nil {
                LatestPhotoButton()
                    .position(x: settings.lang == .hebrew ? frame.minX + 58 : frame.maxX - 58, y: frame.maxY - 66)
            }

            if let target {
                PointerView(target: target, moffyCenter: moffyCenter, moffySize: moffySize,
                            label: helper.reply?.pointLabel ?? "", bounds: screen)
                    .id(helper.reply?.id)
                    .transition(.opacity)
            }

            MoffyView(mood: helper.mood, size: moffySize, look: look, wordPulse: helper.speaker.wordPulse)
                .position(moffyCenter)
                .animation(reduceMotion ? nil : .spring(response: 0.5, dampingFraction: 0.78), value: moffyCenter)
        }
        .frame(width: screen.width, height: screen.height)
        .animation(reduceMotion ? .easeInOut(duration: 0.2) : .spring(response: 0.45, dampingFraction: 0.85), value: frame)
        .animation(.easeInOut(duration: 0.3), value: pictureVisible)
        // The picture is the real world, so left and right stay as they are in Hebrew too.
        .environment(\.layoutDirection, .leftToRight)
    }

    /// Moffy stands in the bottom corner of the frame, or beside the thing he points at.
    private var moffyCenter: CGPoint {
        let half = moffySize / 2
        if !pictureVisible {
            return CGPoint(x: frame.midX, y: frame.minY + frame.height * 0.4)
        }
        let area = answerFrame.insetBy(dx: half + 8, dy: half * 1.04 + 8)
        func clamp(_ p: CGPoint) -> CGPoint {
            CGPoint(x: min(max(p.x, area.minX), area.maxX), y: min(max(p.y, area.minY), area.maxY))
        }
        if let target, helper.attachedPhoto != nil {
            // A screenshot is narrower than the frame: stand in the empty space beside it, level with the target.
            let left = pictureRect.minX - half - 10
            let right = pictureRect.maxX + half + 10
            let roomLeft = left - half >= answerFrame.minX
            let roomRight = right + half <= answerFrame.maxX
            if roomLeft || roomRight {
                let x = roomRight && (!roomLeft || target.x <= pictureRect.midX) ? right : left
                return CGPoint(x: x, y: min(max(target.y, area.minY), area.maxY))
            }
        }
        if let target {
            let below = target.y < answerFrame.midY
            let side: CGFloat = target.x > answerFrame.midX ? -1 : 1
            return clamp(CGPoint(x: target.x + side * moffySize * 0.95,
                                 y: target.y + (below ? 1 : -1) * moffySize * 1.5))
        }
        let x = settings.lang == .hebrew ? frame.maxX - half - 10 : frame.minX + half + 10
        return CGPoint(x: x, y: frame.maxY - half * 1.04 - 10)
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

    private var noCameraText: some View {
        VStack(spacing: 8) {
            if helper.cameraOn && !helper.camera.isAuthorized {
                Text(settings.t("Moffy can't see yet.", "מופי עוד לא רואה."))
                    .font(.ui(.title3, .semibold))
                    .foregroundStyle(Theme.ink)
                Button(settings.t("Allow the camera", "לאשר את המצלמה")) {
                    if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                }
                .font(.ui(.title3, .semibold))
                .foregroundStyle(Theme.actionText)
                .frame(minHeight: 44)
            } else {
                Text(settings.t("Camera is off. Moffy helps from your words.", "המצלמה כבויה. מופי עוזרת לפי מה שאומרים לה."))
                    .font(.ui(.title3))
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: frame.width - 32)
        .position(x: frame.midX, y: moffyCenter.y + moffySize * 0.75 + 40)
    }
}

/// The shortcut to the newest screenshot or photo: its thumbnail, or a picture icon before Photos
/// access is given.
private struct LatestPhotoButton: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper

    var body: some View {
        Button { helper.useLatestPhoto() } label: {
            VStack(spacing: 6) {
                Group {
                    if let thumbnail = helper.latestPhoto.thumbnail {
                        Image(uiImage: thumbnail)
                            .resizable()
                            .scaledToFill()
                    } else {
                        Image(systemName: "photo.on.rectangle.angled")
                            .font(.system(size: 26, weight: .semibold))
                            .foregroundStyle(Theme.actionText)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .background(Theme.card)
                    }
                }
                .frame(width: 64, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color.white, lineWidth: 3))
                .shadow(color: .black.opacity(0.3), radius: 6, y: 2)
                Text(settings.t("Last picture", "תמונה אחרונה"))
                    .font(.ui(.footnote, .semibold))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(.ultraThinMaterial))
            }
            .frame(width: 100)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel(settings.t("Ask about my last screenshot or photo", "לשאול על צילום המסך או התמונה האחרונה"))
    }
}

/// Darkens everything outside the frame, so it's clear what Moffy is looking at.
private struct FrameMask: Shape {
    var hole: CGRect

    var animatableData: CGRect.AnimatableData {
        get { hole.animatableData }
        set { hole.animatableData = newValue }
    }

    func path(in rect: CGRect) -> Path {
        var path = Path(rect)
        path.addRoundedRect(in: hole, cornerSize: CGSize(width: 28, height: 28), style: .continuous)
        return path
    }
}

/// Four rounded corner marks around the frame, like a camera viewfinder.
private struct FrameCorners: Shape {
    var rect: CGRect

    var animatableData: CGRect.AnimatableData {
        get { rect.animatableData }
        set { rect.animatableData = newValue }
    }

    func path(in _: CGRect) -> Path {
        let arm: CGFloat = 34
        let radius: CGFloat = 22
        var path = Path()
        let corners: [(CGPoint, CGFloat, CGFloat)] = [
            (CGPoint(x: rect.minX, y: rect.minY), 1, 1),
            (CGPoint(x: rect.maxX, y: rect.minY), -1, 1),
            (CGPoint(x: rect.minX, y: rect.maxY), 1, -1),
            (CGPoint(x: rect.maxX, y: rect.maxY), -1, -1),
        ]
        for (corner, dx, dy) in corners {
            path.move(to: CGPoint(x: corner.x, y: corner.y + dy * (arm + radius)))
            path.addLine(to: CGPoint(x: corner.x, y: corner.y + dy * radius))
            path.addQuadCurve(to: CGPoint(x: corner.x + dx * radius, y: corner.y), control: corner)
            path.addLine(to: CGPoint(x: corner.x + dx * (arm + radius), y: corner.y))
        }
        return path
    }
}

/// The status line at the top and the settings button.
private struct TopBar: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper
    @Binding var showSettings: Bool

    var body: some View {
        ZStack {
            if let status {
                HStack(spacing: 8) {
                    if helper.phase == .thinking {
                        ProgressView().controlSize(.small)
                    } else if helper.liveGuide.isLive {
                        Image(systemName: "rectangle.on.rectangle")
                            .foregroundStyle(Theme.actionText)
                    } else {
                        Image(systemName: helper.phase == .listening ? "waveform" : "camera.viewfinder")
                            .foregroundStyle(Theme.actionText)
                    }
                    Text(status)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                .font(.ui(.headline, .semibold))
                .foregroundStyle(Theme.ink)
                .padding(.horizontal, 16)
                .frame(minHeight: 44)
                .background(Capsule().fill(.ultraThinMaterial))
                .overlay(Capsule().stroke(Color.white.opacity(0.4), lineWidth: 1))
                .padding(.horizontal, 76)
                .transition(.opacity)
                .accessibilityElement(children: .combine)
            }
            HStack {
                Spacer()
                GlassCircleButton(systemImage: "gearshape.fill", label: settings.t("Settings", "הגדרות"), size: 52) {
                    showSettings = true
                }
            }
            .padding(.horizontal, 16)
        }
        .animation(.easeInOut(duration: 0.25), value: status)
    }

    private var status: String? {
        if helper.liveGuide.isLive && helper.phase != .listening {
            return settings.t("Moffy is watching your screen", "מופי מסתכלת על המסך שלכם")
        }
        switch helper.phase {
        case .listening: return settings.t("Listening…", "מקשיבה…")
        case .thinking: return settings.t("Looking…", "מסתכלת…")
        case .ready:
            if helper.reply != nil { return nil }
            if helper.attachedPhoto != nil { return settings.t("Ask about the picture", "שאלו על התמונה") }
            return helper.cameraOn
                ? settings.t("Point at what needs help", "כוונו למה שצריך עזרה בו")
                : settings.t("Tell me what you need", "ספרו לי מה צריך")
        }
    }
}

/// The answer card and the button bar.
private struct BottomPanel: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let cardHeight: CGFloat
    @Binding var showTyping: Bool
    @Binding var showLive: Bool
    @Binding var controlHeight: CGFloat
    @State private var stopPicker = BroadcastPickerHolder()

    var body: some View {
        VStack(spacing: 12) {
            if helper.showsCard {
                AnswerCard(maxHeight: cardHeight)
                    .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
            }
            controls
                .background(GeometryReader { proxy in
                    Color.clear
                        .onAppear { controlHeight = proxy.size.height }
                        .onChange(of: proxy.size.height) { _, height in controlHeight = height }
                })
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        .animation(reduceMotion ? .easeInOut(duration: 0.2) : .spring(response: 0.45, dampingFraction: 0.85), value: helper.showsCard)
    }

    private var controls: some View {
        VStack(spacing: 10) {
            if helper.liveGuide.isLive {
                // Tapping iOS's own control again offers "Stop Broadcast".
                ZStack {
                    BroadcastPicker(holder: stopPicker)
                        .frame(width: 44, height: 44)
                        .opacity(0.02)
                        .allowsHitTesting(false)
                    OutlineButton(title: settings.t("Stop sharing the screen", "הפסקת שיתוף המסך"), systemImage: "stop.circle") {
                        stopPicker.open()
                    }
                }
            } else if helper.phase == .ready && helper.reply != nil && Backend.isConfigured {
                OutlineButton(title: settings.t("Guide me on screen", "הראו לי על המסך"), systemImage: "rectangle.on.rectangle") {
                    showLive = true
                }
                .accessibilityHint(settings.t("Moffy watches your screen and tells you each step",
                                              "מופי מסתכלת על המסך ואומרת כל שלב"))
            }
            HStack(alignment: .top, spacing: 12) {
                PinkButton(title: primary.title, systemImage: primary.icon, isBusy: helper.phase == .thinking, action: primary.action)
                    .disabled(helper.phase == .thinking)
                    .accessibilityHint(primary.hint)
                GlassCircleButton(systemImage: secondary.icon, label: secondary.label, size: 72, action: secondary.action)
                    .disabled(helper.phase != .ready)
                    .opacity(helper.phase == .ready ? 1 : 0.5)
            }
        }
    }

    private var primary: (title: String, icon: String, hint: String, action: () -> Void) {
        let t = settings.t
        switch helper.phase {
        case .listening:
            return (t("I'm done", "סיימתי"), "stop.circle.fill", t("Stops listening", "מפסיקה להקשיב"), { helper.talkButtonTapped() })
        case .thinking:
            return (t("Looking…", "מסתכלת…"), "", "", {})
        case .ready:
            if helper.reply?.isOpenStep == true {
                return (t("Done, next step", "עשיתי, לשלב הבא"), "checkmark",
                        t("Moffy looks again and gives the next step", "מופי מסתכלת שוב ונותנת את השלב הבא"), { helper.stepDone() })
            }
            if helper.reply?.finished == true {
                return (t("Ask something else", "לשאול משהו אחר"), "mic.fill", t("Starts listening", "מתחילה להקשיב"), { helper.talkButtonTapped() })
            }
            return (t("Tap and talk", "לחצו ודברו"), "mic.fill", t("Starts listening", "מתחילה להקשיב"), { helper.talkButtonTapped() })
        }
    }

    private var secondary: (icon: String, label: String, action: () -> Void) {
        if helper.reply?.isOpenStep == true {
            return ("mic.fill", settings.t("Ask a question instead", "לשאול שאלה במקום"), { helper.talkButtonTapped() })
        }
        return ("keyboard", settings.t("Type instead", "לכתוב במקום"), { showTyping = true })
    }
}

/// A white button with a pink outline, for the quieter choice next to the big pink one.
private struct OutlineButton: View {
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.ui(.title3, .semibold))
                .foregroundStyle(Theme.actionText)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .frame(maxWidth: .infinity, minHeight: 56)
                .background(Capsule().fill(Theme.card))
                .overlay(Capsule().stroke(Theme.action, lineWidth: 2))
                .shadow(color: .black.opacity(0.1), radius: 8, y: 3)
        }
        .buttonStyle(PressableStyle())
    }
}

/// What Moffy says, or what Moffy hears, in a white card.
private struct AnswerCard: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper
    let maxHeight: CGFloat
    @State private var contentHeight: CGFloat = 120

    var body: some View {
        // As tall as the words need, up to the space kept for it; longer answers scroll.
        ScrollView {
            content
                .background(GeometryReader { proxy in
                    Color.clear
                        .onAppear { contentHeight = proxy.size.height }
                        .onChange(of: proxy.size.height) { _, height in contentHeight = height }
                })
        }
        .scrollBounceBehavior(.basedOnSize)
        .frame(height: min(contentHeight, maxHeight))
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(Theme.card)
                .shadow(color: .black.opacity(0.18), radius: 24, y: 8)
        )
        .overlay(alignment: .topTrailing) {
            if helper.phase == .ready && helper.reply != nil {
                Button { helper.startOver() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.inkSecondary)
                        .frame(width: 36, height: 36)
                        .background(Circle().fill(Theme.hairline))
                        .frame(width: 48, height: 48)
                        .contentShape(Rectangle())
                }
                .buttonStyle(PressableStyle())
                .padding(6)
                .accessibilityLabel(settings.t("Start over", "להתחיל מחדש"))
            }
        }
        .accessibilityElement(children: .contain)
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 8) {
            switch helper.phase {
            case .listening:
                Text(helper.listener.transcript.isEmpty
                     ? settings.t("Tell me what you need.", "ספרו לי מה צריך.")
                     : "“\(helper.listener.transcript)”")
                    .font(.ui(.title2, .semibold))
                    .foregroundStyle(helper.listener.transcript.isEmpty ? Theme.inkSecondary : Theme.ink)
            case .thinking:
                Text("“\(helper.lastQuestion)”")
                    .font(.ui(.title3))
                    .foregroundStyle(Theme.inkSecondary)
            case .ready:
                if let reply = helper.reply {
                    if reply.step > 0 {
                        Text(settings.t("STEP \(reply.step)", "שלב \(reply.step)"))
                            .font(.ui(.subheadline, .bold))
                            .tracking(1.2)
                            .foregroundStyle(Theme.actionText)
                            .padding(.trailing, 44)
                    }
                    Text(reply.caption)
                        .font(.ui(.title, .bold))
                        .foregroundStyle(Theme.ink)
                        .padding(.trailing, 44)
                    Text(reply.say)
                        .font(.ui(.title3))
                        .foregroundStyle(Theme.inkSecondary)
                    Button { helper.sayAgain() } label: {
                        Label(settings.t("Say again", "להגיד שוב"), systemImage: "speaker.wave.2.fill")
                            .font(.ui(.headline, .semibold))
                            .foregroundStyle(Theme.actionText)
                            .frame(minHeight: 44)
                    }
                    .buttonStyle(PressableStyle())
                }
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.vertical, 18)
    }
}
