import CoreGraphics
import Foundation
import UIKit

/// One answer from Moffy.
struct MoffyReply: Identifiable, Equatable {
    let id = UUID()
    var say: String
    /// The same words written for the voice (Hebrew nikud where a word could be misread). Empty means use `say`.
    var speak: String = ""
    var caption: String
    var mood: MoffyMood
    /// Where to point, from 0 to 1 across and down the camera picture. Nil means don't point.
    var point: CGPoint? = nil
    var pointLabel: String = ""
    /// 1, 2, 3… when this is a step of a task; 0 for a question, a clarification or a plain answer.
    var step: Int = 0
    /// True when the task is complete.
    var finished: Bool = false
    /// The exact text that came back from Claude, kept for the conversation history.
    var raw: String = ""
    /// Subscription or free questions left, from the server.
    var access: ServerAccess? = nil

    /// What the voice reads.
    var spoken: String { speak.isEmpty ? say : speak }

    /// A step is waiting to be done, so the main button offers "Done, next step".
    var isOpenStep: Bool { step > 0 && !finished }
}

struct ChatTurn {
    enum Role: String { case user, assistant }
    let role: Role
    let text: String
}

protocol MoffyBrain {
    func reply(to question: String, photo: UIImage?, history: [ChatTurn], language: AppLanguage) async throws -> MoffyReply
}

enum BrainError: Error {
    case offline
    /// The server refused the app or is missing its keys: the developer's problem, not the user's.
    case notSetUp
    /// The free questions are used up and there is no subscription.
    case trialOver
    /// The subscriber's fair-use limit for today.
    case dailyLimit
    case busy
    case refused
    case unreadable
    case other(String)
}

extension MoffyReply {
    private struct Wire: Decodable {
        struct Point: Decodable {
            let visible: Bool
            let x: Double
            let y: Double
            let label: String
        }
        let say: String
        let speak: String?
        let caption: String
        let mood: String
        let step: Int
        let finished: Bool
        let point: Point
    }

    /// Reads Claude's JSON answer.
    static func parse(_ text: String) throws -> MoffyReply {
        guard let data = text.data(using: .utf8),
              let wire = try? JSONDecoder().decode(Wire.self, from: data) else {
            throw BrainError.unreadable
        }
        let mood: MoffyMood
        switch wire.mood {
        case "happy": mood = .happy
        case "thinking": mood = .thinking
        case "worried": mood = .worried
        default: mood = .talking
        }
        var point: CGPoint? = nil
        if wire.point.visible {
            point = CGPoint(x: min(max(wire.point.x, 0.02), 0.98), y: min(max(wire.point.y, 0.02), 0.98))
        }
        return MoffyReply(say: wire.say, speak: wire.speak ?? "", caption: wire.caption, mood: mood,
                          point: point, pointLabel: wire.point.label,
                          step: max(wire.step, 0), finished: wire.finished, raw: text)
    }
}
