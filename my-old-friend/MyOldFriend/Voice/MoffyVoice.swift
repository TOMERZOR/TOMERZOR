import CryptoKit
import Foundation

/// Moffy's natural voice (ElevenLabs), made by Moffy's server. Every clip is saved on the phone the
/// first time it is played, and the server keeps one copy for everyone, so the same words are never
/// generated (or paid for) twice: "Say again", repeated phrases and the app's fixed lines are free.
enum MoffyVoice {
    /// Must match `VOICES` and `VOICE_MODEL` in `server/src/index.ts`, so a new voice gets new files.
    /// Hebrew: "Yael – Gentle, Confident Ad". English: "Emily – Trustworthy, Warm, Conversational".
    static let hebrewVoiceID = "d4eLZ8u5dfBCsjp4YPyz"
    static let englishVoiceID = "zHGX9VSXpW8cGSDRCqy0"
    static let model = "eleven_v4"

    /// False in practice mode (no server set up); then Moffy uses the iPhone's own voice.
    static var isAvailable: Bool { Backend.isConfigured }

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

    /// The clip for these words: from the phone if it was made before, otherwise fetched once and saved.
    static func clip(for text: String, language: AppLanguage) async throws -> URL {
        let file = cacheFile(for: text, language: language)
        if FileManager.default.fileExists(atPath: file.path) { return file }

        let data = try await Backend.post("v1/speak", [
            "text": text,
            "language": language == .hebrew ? "he" : "en",
        ], timeout: 30)
        guard !data.isEmpty else { throw Backend.Failure.status(200, "empty") }
        try FileManager.default.createDirectory(at: cacheFolder, withIntermediateDirectories: true)
        try data.write(to: file, options: .atomic)
        return file
    }

    /// Fetches and saves these lines in the background, so they play instantly later.
    static func prepare(_ lines: [(text: String, language: AppLanguage)]) {
        guard isAvailable else { return }
        Task.detached(priority: .utility) {
            for line in lines {
                _ = try? await clip(for: line.text, language: line.language)
            }
        }
    }
}
