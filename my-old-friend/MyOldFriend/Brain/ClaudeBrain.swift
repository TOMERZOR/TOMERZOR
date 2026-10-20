import Foundation
import UIKit

/// Asks Claude (through the Anthropic Messages API) what Moffy should say and where he should point.
struct ClaudeBrain: MoffyBrain {
    static let model = "claude-opus-5-5"

    let apiKey: String
    var endpoint = URL(string: "https://api.anthropic.com/v1/messages")!

    func reply(to question: String, photo: UIImage?, history: [ChatTurn], language: AppLanguage) async throws -> MoffyReply {
        // Earlier turns are sent as plain text only: old photos are dropped to keep each question cheap.
        var messages: [[String: Any]] = history.map { turn -> [String: Any] in ["role": turn.role.rawValue, "content": turn.text] }

        var content: [[String: Any]] = []
        if let photo, let jpeg = ImagePrep.jpeg(photo) {
            content.append([
                "type": "image",
                "source": ["type": "base64", "media_type": "image/jpeg", "data": jpeg.base64EncodedString()],
            ])
        }
        var text = MoffyPrompt.languageNote(language)
        if photo == nil { text += " " + MoffyPrompt.noPhotoNote(language) }
        text += "\n\n" + question
        content.append(["type": "text", "text": text])
        messages.append(["role": "user", "content": content])

        let body: [String: Any] = [
            "model": Self.model,
            "max_tokens": 8000,
            "system": MoffyPrompt.system,
            "messages": messages,
            // Low effort keeps answers quick; Moffy's replies are short.
            "output_config": [
                "effort": "low",
                "format": ["type": "json_schema", "schema": MoffyPrompt.replySchema] as [String: Any],
            ] as [String: Any],
            // If a safety check declines a request, the API retries it on a suitable other model.
            "fallbacks": "default",
        ]

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 90
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.setValue("server-side-fallback-2026-07-01", forHTTPHeaderField: "anthropic-beta")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw BrainError.offline
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        switch status {
        case 200: break
        case 401, 403: throw BrainError.badKey
        case 429, 500...599: throw BrainError.busy
        default: throw BrainError.other("HTTP \(status): \(String(data: data, encoding: .utf8) ?? "")")
        }

        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw BrainError.unreadable
        }
        if json["stop_reason"] as? String == "refusal" { throw BrainError.refused }

        let blocks = json["content"] as? [[String: Any]] ?? []
        let answer = blocks
            .filter { $0["type"] as? String == "text" }
            .compactMap { $0["text"] as? String }
            .joined()
        return try MoffyReply.parse(answer)
    }
}
