import AVFoundation
import Speech

/// Listens after the big button is tapped and turns speech into text.
/// It stops by itself when the person goes quiet, or when they tap the button again.
final class SpeechListener: ObservableObject {
    @Published private(set) var transcript = ""
    @Published private(set) var isListening = false

    /// Called on the main thread with whatever was heard (may be empty).
    var onFinished: ((String) -> Void)?

    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var silenceTimer: Timer?

    enum ListenError: Error { case notAllowed, unavailable }

    static func requestAccess() async -> Bool {
        let speechAllowed = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status == .authorized)
            }
        }
        let micAllowed = await AVAudioApplication.requestRecordPermission()
        return speechAllowed && micAllowed
    }

    static var isAllowed: Bool {
        SFSpeechRecognizer.authorizationStatus() == .authorized
            && AVAudioApplication.shared.recordPermission == .granted
    }

    func start(locale: Locale) throws {
        cancel()
        guard Self.isAllowed else { throw ListenError.notAllowed }
        guard let recognizer = SFSpeechRecognizer(locale: locale), recognizer.isAvailable else {
            throw ListenError.unavailable
        }

        AudioSessionSetup.configure()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.addsPunctuation = true
        self.request = request

        let input = audioEngine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0 else { throw ListenError.unavailable }
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }
        audioEngine.prepare()
        try audioEngine.start()

        transcript = ""
        isListening = true
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self, self.isListening else { return }
                if let result {
                    self.transcript = result.bestTranscription.formattedString
                    self.waitForSilence(seconds: 2.2)
                    if result.isFinal { self.finish() }
                } else if error != nil {
                    self.finish()
                }
            }
        }
        // Give people time to start talking.
        waitForSilence(seconds: 9)
    }

    /// Stop and hand over what was heard.
    func finish() {
        guard isListening else { return }
        let heard = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        tearDown()
        onFinished?(heard)
    }

    /// Stop without handing anything over.
    func cancel() {
        tearDown()
    }

    #if DEBUG
    /// Screenshot scenes: show words as if they had been heard.
    func showPreview(transcript text: String) {
        transcript = text
    }
    #endif

    private func waitForSilence(seconds: TimeInterval) {
        silenceTimer?.invalidate()
        silenceTimer = Timer.scheduledTimer(withTimeInterval: seconds, repeats: false) { [weak self] _ in
            self?.finish()
        }
    }

    private func tearDown() {
        silenceTimer?.invalidate()
        silenceTimer = nil
        if audioEngine.isRunning { audioEngine.stop() }
        audioEngine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.cancel()
        request = nil
        task = nil
        isListening = false
    }
}

enum AudioSessionSetup {
    /// One setting for both listening and talking, with Moffy's voice on the loud speaker.
    static func configure() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playAndRecord, mode: .default,
                                 options: [.defaultToSpeaker, .allowBluetoothA2DP, .duckOthers])
        try? session.setActive(true)
    }
}
