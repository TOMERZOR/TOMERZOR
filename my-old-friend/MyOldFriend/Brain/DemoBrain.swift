import CoreGraphics
import UIKit

/// Practice mode, used when the app was built without a server (no `Backend.plist`).
/// Moffy can't really see yet, but everything else (voice, hopping, pointing) works.
struct DemoBrain: MoffyBrain {
    func reply(to question: String, photo: UIImage?, fromPhotos: Bool, history: [ChatTurn], language: AppLanguage) async throws -> MoffyReply {
        try await Task.sleep(nanoseconds: 1_200_000_000)
        let he = language == .hebrew
        let step = history.count / 2 + 1
        if photo != nil {
            return MoffyReply(
                say: he
                    ? "אני עדיין במצב תרגול, אז אני לא באמת רואה. כך אראה לכם על מה ללחוץ."
                    : "I'm still in practice mode, so I can't really see yet. This is how I'll show you what to press.",
                caption: he ? "מצב תרגול" : "Practice mode",
                mood: .talking,
                point: CGPoint(x: 0.5, y: 0.45),
                pointLabel: he ? "כאן" : "Here",
                step: step,
                finished: step >= 3
            )
        }
        return MoffyReply(
            say: he
                ? "שמעתי אתכם. אני עדיין במצב תרגול."
                : "I heard you. I'm still in practice mode.",
            caption: he ? "מצב תרגול" : "Practice mode",
            mood: .happy
        )
    }
}
