import CryptoKit
import Foundation

/// Moffy's natural voice, from ElevenLabs. Every clip is saved on the phone the first time it is
/// made, so the same words are never generated (or paid for) twice: "Say again", repeated phrases
/// and the app's fixed lines all play from the saved file.
struct ElevenLabsVoice {
    /// Hebrew: "Yael – Gentle, Confident Ad". English: "Emily – Trustworthy, Warm, Conversational".
    /// Both are warm female voices from the ElevenLabs voice library.
    static let hebrewVoiceID = "d4eLZ8u5dfBCsjp4YPyz"
    static let englishVoiceID = "zHGX9VSXpW8cGSDRCqy0"
    /// eleven_v3 speaks both Hebrew and English naturally.
    static let model = "eleven_v3"
    static let keyAccount = "elevenlabs-api-key"

    let apiKey: String

    enum VoiceError: Error { case failed(Int) }

    /// The voice to use, or nil when no ElevenLabs key has been added in Settings.
    static func current() -> ElevenLabsVoice? {
        guard let key = Keychain.load(account: keyAccount), !key.isEmpty else { return nil }
        return ElevenLabsVoice(apiKey: key)
    }

    static func voiceID(for language: AppLanguage) -> String {
        language == .hebrew ? hebrewVoiceID : englishVoiceID
    }

    static var cacheFolder: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("MoffyVoice", isDirectory: true)
    }

    /// One file per voice, model and exact text.
    static func cacheFile(for text: String, language: AppLanguage) -> URL {
        let identity = "\(voiceID(for: language))|\(model)|\(text)"
        let name = SHA256.hash(data: Data(identity.utf8)).map { String(format: "%02x", $0) }.joined()
        return cacheFolder.appendingPathComponent(name).appendingPathExtension("mp3")
    }

    /// The clip for these words: from the phone if it was made before, otherwise made once and saved.
    func clip(for text: String, language: AppLanguage) async throws -> URL {
        let file = Self.cacheFile(for: text, language: language)
        if FileManager.default.fileExists(atPath: file.path) { return file }

        var components = URLComponents(string: "https://api.elevenlabs.io/v1/text-to-speech/\(Self.voiceID(for: language))")!
        components.queryItems = [URLQueryItem(name: "output_format", value: "mp3_44100_128")]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue(apiKey, forHTTPHeaderField: "xi-api-key")
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue("audio/mpeg", forHTTPHeaderField: "accept")
        let body: [String: Any] = [
            "text": text,
            "model_id": Self.model,
            "voice_settings": ["stability": 0.5, "similarity_boost": 0.75, "speed": 0.92],
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200, !data.isEmpty else { throw VoiceError.failed(status) }
        try FileManager.default.createDirectory(at: Self.cacheFolder, withIntermediateDirectories: true)
        try data.write(to: file, options: .atomic)
        return file
    }

    /// Makes and saves these lines in the background, so they play instantly later.
    func prepare(_ lines: [(text: String, language: AppLanguage)]) {
        Task.detached(priority: .utility) {
            for line in lines {
                _ = try? await clip(for: line.text, language: line.language)
            }
        }
    }
}
