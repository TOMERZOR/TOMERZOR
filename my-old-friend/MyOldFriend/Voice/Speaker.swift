import AVFoundation

/// Moffy's voice. Uses the natural ElevenLabs voice when a key is set (from the saved clip when
/// the same words were spoken before), and the iPhone's own female voice otherwise or offline.
final class Speaker: NSObject, ObservableObject, AVSpeechSynthesizerDelegate, AVAudioPlayerDelegate {
    @Published private(set) var isSpeaking = false
    /// Goes up by one on every word or syllable beat, so Moffy can nod along.
    @Published private(set) var wordPulse = 0

    private let synthesizer = AVSpeechSynthesizer()
    private var player: AVAudioPlayer?
    private var meterTimer: Timer?
    private var lastLevel: Float = -60
    private var fetch: Task<Void, Never>?
    /// Bumped on every speak or stop, so a clip that arrives late doesn't play over newer words.
    private var ticket = 0

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    /// `speed` is 0.85 for normal and 0.7 for slow (the Settings switch).
    func speak(_ text: String, language: AppLanguage, speed: Double) {
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        stop()
        AudioSessionSetup.configure()
        let current = ticket

        guard MoffyVoice.isAvailable else {
            speakWithPhoneVoice(text, language: language, speed: speed)
            return
        }
        fetch = Task { @MainActor [weak self] in
            let clip = try? await MoffyVoice.clip(for: text, language: language)
            guard let self, current == self.ticket else { return }
            if let clip, self.play(clip, speed: speed) { return }
            self.speakWithPhoneVoice(text, language: language, speed: speed)
        }
    }

    func stop() {
        ticket += 1
        fetch?.cancel()
        fetch = nil
        meterTimer?.invalidate()
        meterTimer = nil
        player?.stop()
        player = nil
        if synthesizer.isSpeaking { synthesizer.stopSpeaking(at: .immediate) }
        isSpeaking = false
    }

    // MARK: - Natural voice clip

    private func play(_ file: URL, speed: Double) -> Bool {
        guard let player = try? AVAudioPlayer(contentsOf: file) else { return false }
        player.delegate = self
        player.enableRate = true
        player.rate = Float(min(max(speed / 0.85, 0.75), 1.1))
        player.isMeteringEnabled = true
        player.prepareToPlay()
        guard player.play() else { return false }
        self.player = player
        isSpeaking = true
        lastLevel = -60
        meterTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.followLoudness()
        }
        return true
    }

    /// A nod each time the voice gets louder, roughly once per word.
    private func followLoudness() {
        guard let player, player.isPlaying else { return }
        player.updateMeters()
        let level = player.averagePower(forChannel: 0)
        if level > -30 && level - lastLevel > 4 { wordPulse += 1 }
        lastLevel = level
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        DispatchQueue.main.async {
            guard player === self.player else { return }
            self.meterTimer?.invalidate()
            self.meterTimer = nil
            self.player = nil
            self.isSpeaking = false
        }
    }

    // MARK: - The iPhone's own voice

    private func speakWithPhoneVoice(_ text: String, language: AppLanguage, speed: Double) {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = Self.femaleVoice(for: language)
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * Float(speed)
        utterance.pitchMultiplier = 1.05
        utterance.preUtteranceDelay = 0.1
        synthesizer.speak(utterance)
    }

    /// The nicest female voice installed for the language: enhanced or premium first.
    private static func femaleVoice(for language: AppLanguage) -> AVSpeechSynthesisVoice? {
        let code = language.voiceCode
        let preferred = language == .hebrew ? ["Carmit"] : ["Ava", "Samantha", "Zoe", "Allison", "Susan"]
        let voices = AVSpeechSynthesisVoice.speechVoices().filter { $0.language == code }
        func score(_ voice: AVSpeechSynthesisVoice) -> Int {
            voice.quality.rawValue * 10
                + (voice.gender == .female ? 4 : 0)
                + (preferred.contains { voice.name.contains($0) } ? 3 : 0)
        }
        return voices.max { score($0) < score($1) } ?? AVSpeechSynthesisVoice(language: code)
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { self.isSpeaking = true }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, willSpeakRangeOfSpeechString characterRange: NSRange, utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { self.wordPulse += 1 }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { self.isSpeaking = synthesizer.isSpeaking || self.player != nil }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { self.isSpeaking = synthesizer.isSpeaking || self.player != nil }
    }
}
