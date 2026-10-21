import ActivityKit
import AVFoundation
import UIKit
import UserNotifications

/// "Guide me on screen": while the person uses another app, the broadcast extension (MoffyBroadcast)
/// watches the screen and asks Moffy for each next step. This side speaks the step, keeps the Live
/// Activity up to date, and shows a notification banner when the app is in the background.
@MainActor
final class LiveGuide: ObservableObject {
    @Published private(set) var isLive = false
    @Published private(set) var latest: LiveReply?

    var onStarted: (() -> Void)?
    var onReply: ((LiveReply) -> Void)?
    /// `true` when Moffy said the task is done, `false` when the person stopped sharing.
    var onEnded: ((Bool) -> Void)?

    private let signals = LiveSignals()
    private var activity: Activity<MoffyLiveAttributes>?
    private var keepAlive: AVAudioPlayer?
    private var lastCounter: Int?
    private var hebrew = false

    init() {
        signals.observe(.started) { [weak self] in Task { @MainActor in self?.started() } }
        signals.observe(.reply) { [weak self] in Task { @MainActor in self?.replyArrived() } }
        signals.observe(.stopped) { [weak self] in Task { @MainActor in self?.stopped() } }
    }

    /// Hands the extension what it needs. Called when the "start sharing" sheet opens.
    func prepare(goal: String, history: [ChatTurn], language: AppLanguage) {
        hebrew = language == .hebrew
        guard let server = Backend.baseURL else { return }
        let config = LiveConfig(
            serverURL: server.absoluteString,
            appToken: Backend.appToken,
            installID: InstallID.value.uuidString.lowercased(),
            subscriptionID: Backend.subscriptionID,
            language: language == .hebrew ? "he" : "en",
            goal: goal,
            history: history.suffix(8).map { LiveTurn(role: $0.role.rawValue, text: $0.text) })
        LiveChannel.write(config, to: LiveChannel.configBoard)
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    /// A new question while sharing: the extension starts over from it and looks at the screen again.
    func newGoal(_ goal: String, history: [ChatTurn], language: AppLanguage) {
        guard isLive, let server = Backend.baseURL else { return }
        let config = LiveConfig(
            serverURL: server.absoluteString,
            appToken: Backend.appToken,
            installID: InstallID.value.uuidString.lowercased(),
            subscriptionID: Backend.subscriptionID,
            language: language == .hebrew ? "he" : "en",
            goal: goal,
            history: history.suffix(8).map { LiveTurn(role: $0.role.rawValue, text: $0.text) })
        LiveChannel.write(config, to: LiveChannel.configBoard)
        LiveChannel.post(.goal)
    }

    // MARK: - Signals from the extension

    private func started() {
        guard !isLive else { return }
        isLive = true
        latest = nil
        lastCounter = LiveChannel.read(LiveReply.self, from: LiveChannel.replyBoard)?.counter
        startKeepAlive()
        startActivity()
        onStarted?()
    }

    private func replyArrived() {
        guard let reply = LiveChannel.read(LiveReply.self, from: LiveChannel.replyBoard),
              reply.counter != lastCounter else { return }
        lastCounter = reply.counter
        if !isLive { started() }
        latest = reply
        if reply.error == nil {
            updateActivity(with: reply)
            notifyIfInBackground(reply)
        }
        onReply?(reply)
    }

    private func stopped() {
        guard isLive else { return }
        isLive = false
        let finished = latest?.finished ?? false
        endActivity()
        // Let the last words finish before the app may be suspended.
        DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in
            guard let self, !self.isLive else { return }
            self.stopKeepAlive()
        }
        onEnded?(finished)
    }

    // MARK: - Live Activity

    private func state(from reply: LiveReply?) -> MoffyLiveAttributes.ContentState {
        MoffyLiveAttributes.ContentState(
            step: reply?.step ?? 0,
            caption: reply?.caption ?? (hebrew ? "מסתכלת על המסך…" : "Looking at the screen…"),
            say: reply?.say ?? "",
            hasPoint: reply?.pointVisible ?? false,
            x: reply?.x ?? 0,
            y: reply?.y ?? 0,
            mood: reply?.mood ?? "thinking",
            finished: reply?.finished ?? false)
    }

    private func startActivity() {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        activity = try? Activity<MoffyLiveAttributes>.request(
            attributes: MoffyLiveAttributes(hebrew: hebrew),
            content: ActivityContent(state: state(from: nil), staleDate: nil),
            pushType: nil)
    }

    private func updateActivity(with reply: LiveReply) {
        guard let activity else { return }
        let content = ActivityContent(state: state(from: reply), staleDate: nil)
        Task { await activity.update(content) }
    }

    private func endActivity() {
        guard let activity else { return }
        let content = ActivityContent(state: state(from: latest), staleDate: nil)
        self.activity = nil
        Task { await activity.end(content, dismissalPolicy: .after(Date().addingTimeInterval(10))) }
    }

    // MARK: - Banner while in another app

    private func notifyIfInBackground(_ reply: LiveReply) {
        guard UIApplication.shared.applicationState != .active, !reply.say.isEmpty else { return }
        let content = UNMutableNotificationContent()
        content.title = hebrew ? "מופי · שלב \(max(reply.step, 1))" : "Moffy · Step \(max(reply.step, 1))"
        content.body = reply.say
        content.interruptionLevel = .timeSensitive
        let request = UNNotificationRequest(identifier: "moffy-live", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }

    // MARK: - Staying awake

    /// While a session is live the app plays silence, so iOS keeps it running in the background and
    /// Moffy can speak each step. It stops as soon as the session ends.
    private func startKeepAlive() {
        AudioSessionSetup.configure()
        guard keepAlive == nil, let player = try? AVAudioPlayer(data: Self.silence) else { return }
        player.numberOfLoops = -1
        player.volume = 0
        player.play()
        keepAlive = player
    }

    private func stopKeepAlive() {
        keepAlive?.stop()
        keepAlive = nil
    }

    /// One second of silence as a WAV file (16-bit mono, 8 kHz).
    private static let silence: Data = {
        let sampleRate: UInt32 = 8000
        let samples = Data(count: Int(sampleRate) * 2)
        var data = Data()
        func append<T: FixedWidthInteger>(_ value: T) { withUnsafeBytes(of: value.littleEndian) { data.append(contentsOf: $0) } }
        data.append(contentsOf: Array("RIFF".utf8)); append(UInt32(36 + samples.count))
        data.append(contentsOf: Array("WAVE".utf8)); data.append(contentsOf: Array("fmt ".utf8))
        append(UInt32(16)); append(UInt16(1)); append(UInt16(1)); append(sampleRate)
        append(sampleRate * 2); append(UInt16(2)); append(UInt16(16))
        data.append(contentsOf: Array("data".utf8)); append(UInt32(samples.count))
        data.append(samples)
        return data
    }()
}
