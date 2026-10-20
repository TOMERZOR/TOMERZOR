import CoreGraphics
import Foundation
import UIKit

/// One answer from Moffy.
struct MoffyReply: Identifiable, Equatable {
    let id = UUID()
    var say: String
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
        return MoffyReply(say: wire.say, caption: wire.caption, mood: mood,
                          point: point, pointLabel: wire.point.label,
                          step: max(wire.step, 0), finished: wire.finished, raw: text)
    }
}
