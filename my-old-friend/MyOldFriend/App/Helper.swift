import Combine
import SwiftUI

/// Runs one conversation with Moffy: listen → look through the camera → ask Claude → speak and point.
@MainActor
final class Helper: ObservableObject {
    enum Phase { case ready, listening, thinking }

    let settings: AppSettings
    let camera = CameraService()
    let listener = SpeechListener()
    let speaker = Speaker()
    let subscription = Subscription()

    @Published private(set) var phase: Phase = .ready
    /// Moffy's latest answer. Nil when there is nothing to show (the camera is all there is).
    @Published private(set) var reply: MoffyReply?
    /// What the person asked last, shown while Moffy looks.
    @Published private(set) var lastQuestion = ""
    var cameraOn: Bool { settings.useCamera }
    /// Test builds only: shows a drawn TV remote instead of the camera, for simulator screenshots.
    @Published private(set) var showsSampleScene = false

    /// The whole screen, and the frame Moffy looks through, in screen points. Set by the main screen,
    /// so the snapshot is cut to exactly what is inside the frame.
    var screenSize: CGSize = .zero
    var viewfinder: CGRect = .zero

    private var history: [ChatTurn] = []
    private var cancellables: Set<AnyCancellable> = []

    init(settings: AppSettings) {
        self.settings = settings
        // Views watch the helper; pass along changes from its parts.
        for part in [camera.objectWillChange, listener.objectWillChange, speaker.objectWillChange, settings.objectWillChange,
                     subscription.objectWillChange] {
            part.sink { [weak self] _ in self?.objectWillChange.send() }.store(in: &cancellables)
        }
        listener.onFinished = { [weak self] heard in self?.heard(heard) }
        prepareVoice()
    }

    /// Moffy's server when the app was built with one; practice mode otherwise.
    private var brain: MoffyBrain {
        Backend.isConfigured ? ServerBrain() : DemoBrain()
    }

    /// The answer card is up while Moffy listens, looks, or has something to say.
    var showsCard: Bool { phase != .ready || reply != nil }

    /// How Moffy should look right now.
    var mood: MoffyMood {
        if phase == .listening { return .listening }
        if phase == .thinking { return .thinking }
        guard let reply else { return .idle }
        if speaker.isSpeaking { return reply.point != nil ? .pointing : (reply.mood == .idle ? .talking : reply.mood) }
        return reply.mood == .talking ? .idle : reply.mood
    }

    // MARK: - Screen events

    func appeared() {
        #if DEBUG
        if let scene = UserDefaults.standard.string(forKey: "screenshotScene") {
            playScreenshotScene(scene)
            return
        }
        #endif
        AudioSessionSetup.configure()
        if cameraOn { camera.start() }
    }

    func talkButtonTapped() {
        switch phase {
        case .listening:
            listener.finish()
        case .thinking:
            break
        case .ready:
            speaker.stop()
            do {
                try listener.start(locale: settings.lang.locale)
                phase = .listening
            } catch {
                show(Self.line(.microphoneOff, settings.lang), speak: true)
            }
        }
    }

    /// "Done, next step": the person did what Moffy asked; look again and continue.
    func stepDone() {
        guard phase == .ready else { return }
        listener.cancel()
        Task { await ask(settings.t("I did that. What's next?", "עשיתי את זה. מה הלאה?")) }
    }

    func ask(typed text: String) {
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        listener.cancel()
        Task { await ask(text) }
    }

    func sayAgain() {
        guard phase == .ready, let reply else { return }
        speaker.speak(reply.say, language: settings.lang, speed: settings.speechSpeed * 0.9)
    }

    /// Clears the conversation and the card, quietly.
    func startOver() {
        listener.cancel()
        speaker.stop()
        history.removeAll()
        lastQuestion = ""
        phase = .ready
        reply = nil
    }

    func setCamera(on: Bool) {
        settings.useCamera = on
        if on { camera.start() } else { camera.stop() }
    }

    /// Saves the natural voice for the app's fixed lines on the phone, so they play instantly and
    /// offline. Lines already saved are skipped, so after the first launch this does nothing.
    private func prepareVoice() {
        var lines: [(text: String, language: AppLanguage)] = []
        for language in AppLanguage.allCases {
            for kind in FixedLine.allCases { lines.append((Self.line(kind, language).say, language)) }
            for kind in AccessLine.allCases { lines.append((Self.accessLine(kind, language).say, language)) }
            lines.append((Self.voiceSample(language), language))
        }
        MoffyVoice.prepare(lines)
    }

    // MARK: - Conversation

    private func heard(_ text: String) {
        guard phase == .listening else { return }
        if text.isEmpty {
            phase = .ready
            show(Self.line(.didNotHear, settings.lang), speak: true)
            return
        }
        Task { await ask(text) }
    }

    private func ask(_ question: String) async {
        lastQuestion = question
        phase = .thinking
        speaker.stop()
        let photo = cameraOn ? snapshot() : nil
        do {
            let answer = try await brain.reply(to: question, photo: photo, history: history, language: settings.lang)
            history.append(ChatTurn(role: .user, text: question))
            history.append(ChatTurn(role: .assistant, text: answer.raw.isEmpty ? answer.say : answer.raw))
            // Keep the last few exchanges; enough for "what's next?" without growing forever.
            if history.count > 16 { history.removeFirst(history.count - 16) }
            phase = .ready
            subscription.update(from: answer.access)
            show(answer, speak: true)
        } catch {
            phase = .ready
            show(Self.problemReply(for: error, settings.lang), speak: true)
            if case .trialOver? = error as? BrainError { subscription.trialEnded() }
        }
    }

    /// The camera picture, cut to the frame on screen.
    private func snapshot() -> UIImage? {
        guard let image = camera.snapshot() else { return nil }
        return ImagePrep.crop(image, screenSize: screenSize, rect: viewfinder)
    }

    private func show(_ newReply: MoffyReply, speak: Bool) {
        reply = newReply
        if speak && settings.readAloud {
            speaker.speak(newReply.say, language: settings.lang, speed: settings.speechSpeed)
        }
    }

    // MARK: - Fixed lines (the only words Moffy says that don't come from Claude)

    enum FixedLine: CaseIterable { case microphoneOff, didNotHear, offline, notSetUp, busy, refused, other }

    static func line(_ kind: FixedLine, _ language: AppLanguage) -> MoffyReply {
        let he = language == .hebrew
        func t(_ en: String, _ hebrew: String) -> String { he ? hebrew : en }
        switch kind {
        case .microphoneOff:
            return MoffyReply(say: t("I can't hear you yet. Please allow the microphone in the phone's Settings, or tap the keyboard button and type your question.",
                                     "אני עדיין לא שומעת אתכם. אשרו בבקשה את המיקרופון בהגדרות של הטלפון, או לחצו על המקלדת וכתבו לי."),
                              caption: t("The microphone is off", "המיקרופון כבוי"), mood: .worried)
        case .didNotHear:
            return MoffyReply(say: t("I didn't hear anything. Please tap the button and tell me how I can help.",
                                     "לא שמעתי דבר. לחצו בבקשה על הכפתור ואמרו לי במה אוכל לעזור."),
                              caption: t("Tap and talk", "לחצו ודברו"), mood: .thinking)
        case .offline:
            return MoffyReply(say: t("There's no internet connection right now. Please check that Wi-Fi is on, then try again.",
                                     "אין כרגע חיבור לאינטרנט. בדקו בבקשה שה-Wi-Fi פועל, ונסו שוב."),
                              caption: t("No internet", "אין אינטרנט"), mood: .worried)
        case .notSetUp:
            return MoffyReply(say: t("There's a problem on my side at the moment. Please try again in a few minutes.",
                                     "יש כרגע תקלה אצלי. נסו בבקשה שוב בעוד כמה דקות."),
                              caption: t("Try again later", "נסו שוב מאוחר יותר"), mood: .worried)
        case .busy:
            return MoffyReply(say: t("It's very busy right now. Please try again in a moment.",
                                     "יש כרגע עומס. נסו בבקשה שוב בעוד רגע."),
                              caption: t("Try again soon", "נסו שוב עוד רגע"), mood: .thinking)
        case .refused:
            return MoffyReply(say: t("I'm afraid I can't help with that. You're welcome to ask me something else.",
                                     "בזה לצערי אני לא יכולה לעזור. אפשר לשאול אותי על משהו אחר."),
                              caption: t("Ask something else", "שאלו משהו אחר"), mood: .worried)
        case .other:
            return MoffyReply(say: t("Something went wrong on my side. Please try again.",
                                     "משהו השתבש אצלי. נסו בבקשה שוב."),
                              caption: t("Please try again", "נסו שוב"), mood: .worried)
        }
    }

    static func voiceSample(_ language: AppLanguage) -> String {
        language == .hebrew ? "ככה אני נשמעת." : "This is how I sound."
    }

    private static func problemReply(for error: Error, _ language: AppLanguage) -> MoffyReply {
        switch error as? BrainError {
        case .offline?: return line(.offline, language)
        case .notSetUp?: return line(.notSetUp, language)
        case .busy?: return line(.busy, language)
        case .refused?: return line(.refused, language)
        case .trialOver?: return accessLine(.trialOver, language)
        case .dailyLimit?: return accessLine(.dailyLimit, language)
        default: return line(.other, language)
        }
    }
}

#if DEBUG
// MARK: - Screenshot scenes (test builds only)

/// Launch with `-screenshotScene <name>` in the simulator to show one moment of the app,
/// without a camera, microphone or server. Used by the GitHub workflow that takes screenshots.
extension Helper {
    private var sampleReply: MoffyReply {
        MoffyReply(
            say: settings.t("This is a Samsung TV remote. Press the round red power button at the top right. The TV screen will light up.",
                            "זה שלט של טלוויזיה סמסונג. לחצו על כפתור ההפעלה העגול והאדום, למעלה מימין. מסך הטלוויזיה יידלק."),
            caption: settings.t("Press the red button", "לחצו על הכפתור האדום"),
            mood: .talking,
            point: SampleSceneView.powerButton,
            pointLabel: settings.t("Power", "הפעלה"),
            step: 1)
    }

    private var sampleQuestion: String {
        settings.t("How do I turn on the TV?", "איך מדליקים את הטלוויזיה?")
    }

    func playScreenshotScene(_ scene: String) {
        settings.useCamera = scene != "nocamera"
        showsSampleScene = scene != "nocamera"
        switch scene {
        case "listening":
            phase = .listening
            listener.showPreview(transcript: sampleQuestion)
        case "thinking":
            lastQuestion = sampleQuestion
            phase = .thinking
        case "pointing":
            lastQuestion = sampleQuestion
            show(sampleReply, speak: false)
        case "demo":
            Task { await playDemo() }
        case "paywall":
            subscription.showPaywall = true
        default:
            break
        }
    }

    /// About 12 seconds: the person asks, Moffy looks, then hops over and points.
    private func playDemo() async {
        func wait(_ seconds: Double) async { try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000)) }
        await wait(1.5)
        phase = .listening
        var words: [String] = []
        for word in sampleQuestion.split(separator: " ") {
            words.append(String(word))
            listener.showPreview(transcript: words.joined(separator: " "))
            await wait(0.45)
        }
        await wait(0.8)
        listener.cancel()
        lastQuestion = sampleQuestion
        phase = .thinking
        await wait(2.2)
        phase = .ready
        show(sampleReply, speak: true)
    }
}
#endif
