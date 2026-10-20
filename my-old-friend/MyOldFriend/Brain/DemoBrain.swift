import CoreGraphics
import UIKit

/// Practice mode, used until an API key is added in Settings.
/// Moffy can't really see yet, but everything else (voice, hopping, pointing) works.
struct DemoBrain: MoffyBrain {
    func reply(to question: String, photo: UIImage?, history: [ChatTurn], language: AppLanguage) async throws -> MoffyReply {
        try await Task.sleep(nanoseconds: 1_200_000_000)
        let he = language == .hebrew
        let step = history.count / 2 + 1
        if photo != nil {
            return MoffyReply(
                say: he
                    ? "אני עדיין במצב תרגול, אז אני לא באמת רואה. כך אראה לכם על מה ללחוץ. כדי שאוכל לעזור באמת, צריך להוסיף מפתח בהגדרות."
                    : "I'm still in practice mode, so I can't really see yet. This is how I'll show you what to press. To get real help, add a key in Settings.",
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
                ? "שמעתי אתכם. אני עדיין במצב תרגול. כדי שאוכל לעזור באמת, צריך להוסיף מפתח בהגדרות."
                : "I heard you. I'm still in practice mode. To get real help, add a key in Settings.",
            caption: he ? "מצב תרגול" : "Practice mode",
            mood: .happy
        )
    }
}
