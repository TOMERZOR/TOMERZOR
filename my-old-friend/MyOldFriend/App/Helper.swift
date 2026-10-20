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

    @Published private(set) var phase: Phase = .ready
    @Published private(set) var reply: MoffyReply
    @Published var cameraOn = true
    /// The size of the camera area on screen, so the snapshot is cut to match what the person sees.
    var stageSize: CGSize = .zero

    private var history: [ChatTurn] = []
    private var greeted = false
    private var cancellables: Set<AnyCancellable> = []

    init(settings: AppSettings) {
        self.settings = settings
        reply = MoffyReply(say: "", caption: "", mood: .idle)
        // Views watch the helper; pass along changes from its parts.
        for part in [camera.objectWillChange, listener.objectWillChange, speaker.objectWillChange, settings.objectWillChange] {
            part.sink { [weak self] _ in self?.objectWillChange.send() }.store(in: &cancellables)
        }
        listener.onFinished = { [weak self] heard in self?.heard(heard) }
    }

    var hasKey: Bool { !(Keychain.load(account: Keychain.apiKeyAccount) ?? "").isEmpty }

    private var brain: MoffyBrain {
        if let key = Keychain.load(account: Keychain.apiKeyAccount), !key.isEmpty {
            return ClaudeBrain(apiKey: key)
        }
        return DemoBrain()
    }

    /// How Moffy should look right now.
    var mood: MoffyMood {
        if phase == .listening { return .listening }
        if phase == .thinking { return .thinking }
        if speaker.isSpeaking { return reply.point != nil ? .pointing : (reply.mood == .idle ? .talking : reply.mood) }
        return reply.mood == .talking ? .idle : reply.mood
    }

    // MARK: - Screen events

    func appeared() {
        AudioSessionSetup.configure()
        if cameraOn { camera.start() }
        if !greeted {
            greeted = true
            show(greeting, speak: true)
        }
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
                show(MoffyReply(
                    say: settings.t("I can't hear you yet. Please let me use the microphone in the phone's Settings, or tap Type instead.",
                                    "אני עוד לא שומע אתכם. אפשר לתת לי להשתמש במיקרופון בהגדרות של הטלפון, או ללחוץ על \"לכתוב\"."),
                    caption: settings.t("Microphone is off", "המיקרופון כבוי"),
                    mood: .worried), speak: true)
            }
        }
    }

    func ask(typed text: String) {
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        listener.cancel()
        Task { await ask(text) }
    }

    func sayAgain() {
        guard phase == .ready else { return }
        speaker.speak(reply.say, language: settings.lang, speed: settings.speechSpeed * 0.9)
    }

    func startOver() {
        listener.cancel()
        speaker.stop()
        history.removeAll()
        phase = .ready
        show(MoffyReply(
            say: settings.t("Okay, let's start fresh! What can I help you with?",
                            "בסדר, מתחילים מחדש! במה אפשר לעזור?"),
            caption: settings.t("What can I help with?", "במה אפשר לעזור?"),
            mood: .happy), speak: true)
    }

    func setCamera(on: Bool) {
        cameraOn = on
        if on { camera.start() } else { camera.stop() }
    }

    // MARK: - Conversation

    private var greeting: MoffyReply {
        MoffyReply(
            say: settings.t("Hi, I'm Moffy! Point the camera at what you need help with, then tap the big pink button and tell me.",
                            "שלום, אני מופי! כוונו את המצלמה למה שצריך עזרה בו, לחצו על הכפתור הוורוד הגדול וספרו לי."),
            caption: settings.t("Hi, I'm Moffy!", "שלום, אני מופי!"),
            mood: .happy)
    }

    private func heard(_ text: String) {
        guard phase == .listening else { return }
        if text.isEmpty {
            phase = .ready
            show(MoffyReply(
                say: settings.t("I didn't hear anything. Tap the button and talk to me.",
                                "לא שמעתי כלום. לחצו על הכפתור ודברו איתי."),
                caption: settings.t("Tap and talk", "לחצו ודברו"),
                mood: .thinking), speak: true)
            return
        }
        Task { await ask(text) }
    }

    private func ask(_ question: String) async {
        phase = .thinking
        speaker.stop()
        let photo = cameraOn ? snapshot() : nil
        do {
            let answer = try await brain.reply(to: question, photo: photo, history: history, language: settings.lang)
            history.append(ChatTurn(role: .user, text: question))
            history.append(ChatTurn(role: .assistant, text: answer.raw.isEmpty ? answer.say : answer.raw))
            // Keep the last few exchanges; enough for "what's next?" without growing forever.
            if history.count > 12 { history.removeFirst(history.count - 12) }
            phase = .ready
            show(answer, speak: true)
        } catch {
            phase = .ready
            show(problemReply(for: error), speak: true)
        }
    }

    private func snapshot() -> UIImage? {
        guard let image = camera.snapshot() else { return nil }
        guard stageSize.width > 0, stageSize.height > 0 else { return image }
        return ImagePrep.crop(image, toAspect: stageSize.width / stageSize.height)
    }

    private func show(_ newReply: MoffyReply, speak: Bool) {
        reply = newReply
        if speak && settings.readAloud {
            speaker.speak(newReply.say, language: settings.lang, speed: settings.speechSpeed)
        }
    }

    private func problemReply(for error: Error) -> MoffyReply {
        let t = settings.t
        switch error as? BrainError {
        case .offline?:
            return MoffyReply(say: t("I can't reach the internet right now. Please check that Wi-Fi is on, then try again.",
                                     "אני לא מצליח להתחבר לאינטרנט. בדקו שה-Wi-Fi דלוק ונסו שוב."),
                              caption: t("No internet", "אין אינטרנט"), mood: .worried)
        case .badKey?:
            return MoffyReply(say: t("I'm not set up properly. Please ask your helper to check my key in Settings.",
                                     "משהו בהגדרות שלי לא תקין. בקשו ממי שעוזר לכם לבדוק את המפתח בהגדרות."),
                              caption: t("Ask your helper", "בקשו עזרה"), mood: .worried)
        case .busy?:
            return MoffyReply(say: t("I'm a little busy right now. Let's try again in a moment.",
                                     "אני קצת עסוק כרגע. ננסה שוב עוד רגע."),
                              caption: t("Try again soon", "נסו שוב עוד רגע"), mood: .thinking)
        case .refused?:
            return MoffyReply(say: t("I can't help with that one. Let's try something else.",
                                     "בזה אני לא יכול לעזור. בואו ננסה משהו אחר."),
                              caption: t("Let's try something else", "ננסה משהו אחר"), mood: .worried)
        default:
            return MoffyReply(say: t("Oops, something went wrong on my side. Let's try that again.",
                                     "אופס, משהו השתבש אצלי. בואו ננסה שוב."),
                              caption: t("Let's try again", "ננסה שוב"), mood: .worried)
        }
    }
}
