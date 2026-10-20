import Foundation
import UIKit

/// Asks Moffy's server what to say and where to point. The server passes the question and photo to
/// Claude with Moffy's instructions (see `server/src`), so the Claude key never sits on the phone.
struct ServerBrain: MoffyBrain {
    func reply(to question: String, photo: UIImage?, history: [ChatTurn], language: AppLanguage) async throws -> MoffyReply {
        // Earlier turns go as plain text only: old photos are dropped to keep each question cheap.
        var body: [String: Any] = [
            "question": question,
            "language": language == .hebrew ? "he" : "en",
            "history": history.map { ["role": $0.role.rawValue, "text": $0.text] },
        ]
        if let photo, let jpeg = ImagePrep.jpeg(photo) {
            body["photo"] = jpeg.base64EncodedString()
        }

        let data: Data
        do {
            data = try await Backend.post("v1/ask", body, timeout: 90)
        } catch Backend.Failure.offline {
            throw BrainError.offline
        } catch Backend.Failure.status(let status, let code) {
            switch code {
            case "busy": throw BrainError.busy
            case "refused": throw BrainError.refused
            case "unauthorized", "server_setup": throw BrainError.notSetUp
            default: throw BrainError.other("HTTP \(status) \(code)")
            }
        }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let raw = json["raw"] as? String else {
            throw BrainError.unreadable
        }
        return try MoffyReply.parse(raw)
    }
}
