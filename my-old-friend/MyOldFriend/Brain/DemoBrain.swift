import CoreGraphics
import UIKit

/// Practice mode, used until an API key is added in Settings.
/// Moffy can't really see yet, but everything else (voice, hopping, pointing) works.
struct DemoBrain: MoffyBrain {
    func reply(to question: String, photo: UIImage?, history: [ChatTurn], language: AppLanguage) async throws -> MoffyReply {
        try await Task.sleep(nanoseconds: 1_200_000_000)
        let he = language == .hebrew
        if photo != nil {
            return MoffyReply(
                say: he
                    ? "אני עוד במצב תרגול, אז אני לא באמת רואה. אבל ככה אני מראה לכם על מה ללחוץ! בקשו ממי שעוזר לכם להוסיף לי מפתח בהגדרות."
                    : "I'm still in practice mode, so I can't really see yet. But this is how I'll show you what to press! Ask your helper to add my key in Settings.",
                caption: he ? "מצב תרגול" : "Practice mode",
                mood: .happy,
                point: CGPoint(x: 0.5, y: 0.45),
                pointLabel: he ? "כאן!" : "Here!"
            )
        }
        return MoffyReply(
            say: he
                ? "שמעתי אתכם! אני עוד במצב תרגול. בקשו ממי שעוזר לכם להוסיף לי מפתח בהגדרות, ואז אוכל לעזור באמת."
                : "I heard you! I'm still in practice mode. Ask your helper to add my key in Settings, and then I can really help.",
            caption: he ? "מצב תרגול" : "Practice mode",
            mood: .happy
        )
    }
}
