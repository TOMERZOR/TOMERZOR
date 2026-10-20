import AVFoundation

/// Moffy's voice. Reads answers aloud slowly and clearly, in Hebrew or English.
final class Speaker: NSObject, ObservableObject, AVSpeechSynthesizerDelegate {
    @Published private(set) var isSpeaking = false
    /// Goes up by one for every word spoken, so Moffy can bounce along.
    @Published private(set) var wordPulse = 0

    private let synthesizer = AVSpeechSynthesizer()

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    func speak(_ text: String, language: AppLanguage, speed: Double) {
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        stop()
        AudioSessionSetup.configure()
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = Self.bestVoice(for: language.voiceCode)
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * Float(speed)
        utterance.pitchMultiplier = 1.1
        utterance.preUtteranceDelay = 0.1
        synthesizer.speak(utterance)
    }

    func stop() {
        if synthesizer.isSpeaking { synthesizer.stopSpeaking(at: .immediate) }
    }

    /// Uses the nicest voice installed on the phone for the language.
    private static func bestVoice(for code: String) -> AVSpeechSynthesisVoice? {
        let voices = AVSpeechSynthesisVoice.speechVoices().filter { $0.language == code }
        return voices.max { $0.quality.rawValue < $1.quality.rawValue } ?? AVSpeechSynthesisVoice(language: code)
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { self.isSpeaking = true }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, willSpeakRangeOfSpeechString characterRange: NSRange, utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { self.wordPulse += 1 }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { self.isSpeaking = synthesizer.isSpeaking }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { self.isSpeaking = synthesizer.isSpeaking }
    }
}
