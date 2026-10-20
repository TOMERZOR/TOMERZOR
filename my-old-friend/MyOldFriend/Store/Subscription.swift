import StoreKit
import SwiftUI

/// What the server says about this phone: subscribed, or how many free questions are left.
struct ServerAccess: Equatable {
    var subscribed: Bool
    var trialLeft: Int
}

/// The monthly subscription, through Apple (StoreKit 2). The server checks it with Apple before
/// answering; the app only needs to know whether to show the subscription screen.
@MainActor
final class Subscription: ObservableObject {
    static let productID = "com.tomerzor.myoldfriend.monthly"
    /// Shown until the App Store answers (and in the simulator screenshots).
    static let fallbackPrice = "₪24.90"
    static let trialQuestions = 20

    @Published private(set) var product: Product?
    @Published private(set) var isSubscribed = false
    @Published private(set) var isPurchasing = false
    /// Free questions left, as the server last reported.
    @Published private(set) var trialLeft: Int
    @Published var showPaywall = false
    @Published var problem: String?

    private var updates: Task<Void, Never>?

    init() {
        trialLeft = UserDefaults.standard.object(forKey: "trialLeft") as? Int ?? Self.trialQuestions
        // Renewals, refunds and purchases made on another device arrive here.
        updates = Task.detached { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let transaction) = result { await transaction.finish() }
                await self?.refresh()
            }
        }
        Task {
            await refresh()
            product = try? await Product.products(for: [Self.productID]).first
        }
    }

    var price: String { product?.displayPrice ?? Self.fallbackPrice }

    /// Reads the active subscription (the person's own, or shared by family) from the App Store.
    func refresh() async {
        var active: Transaction?
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result,
               transaction.productID == Self.productID,
               transaction.revocationDate == nil {
                active = transaction
            }
        }
        isSubscribed = active != nil
        Backend.subscriptionID = active.map { String($0.originalID) }
    }

    /// True when the person is subscribed afterwards.
    func purchase() async -> Bool {
        problem = nil
        isPurchasing = true
        defer { isPurchasing = false }
        do {
            if product == nil { product = try await Product.products(for: [Self.productID]).first }
            guard let product else {
                problem = unavailableText
                return false
            }
            let result = try await product.purchase(options: [.appAccountToken(InstallID.value)])
            if case .success(.verified(let transaction)) = result {
                await transaction.finish()
            }
            await refresh()
        } catch {
            problem = unavailableText
        }
        return isSubscribed
    }

    /// For a new phone, or after reinstalling: asks the App Store for earlier purchases.
    func restore() async {
        problem = nil
        try? await AppStore.sync()
        await refresh()
    }

    func update(from access: ServerAccess?) {
        guard let access else { return }
        trialLeft = access.trialLeft
        UserDefaults.standard.set(access.trialLeft, forKey: "trialLeft")
    }

    /// The server said the free questions are used up.
    func trialEnded() {
        update(from: ServerAccess(subscribed: false, trialLeft: 0))
        showPaywall = true
    }

    private var unavailableText: String {
        UserDefaults.standard.string(forKey: "language") == "he"
            ? "החנות של Apple לא זמינה כרגע. נסו שוב עוד מעט."
            : "The App Store isn't available right now. Please try again in a little while."
    }
}

/// The two things Moffy says about the subscription.
extension Helper {
    enum AccessLine: CaseIterable { case trialOver, dailyLimit }

    static func accessLine(_ kind: AccessLine, _ language: AppLanguage) -> MoffyReply {
        let he = language == .hebrew
        func t(_ en: String, _ hebrew: String) -> String { he ? hebrew : en }
        switch kind {
        case .trialOver:
            return MoffyReply(say: t("That was the last free question. To keep me helping you every day, you can join the monthly subscription, or ask someone in the family to set it up for you.",
                                     "השאלות בחינם נגמרו. כדי שאמשיך לעזור לכם כל יום, אפשר להצטרף למנוי החודשי, או לבקש ממישהו מהמשפחה לסדר את זה בשבילכם."),
                              caption: t("Join to keep going", "ממשיכים עם מנוי"), mood: .talking)
        case .dailyLimit:
            return MoffyReply(say: t("We did a lot today! Let's carry on tomorrow, I'll be right here.",
                                     "עשינו הרבה היום! בואו נמשיך מחר, אני כאן."),
                              caption: t("Let's continue tomorrow", "נמשיך מחר"), mood: .happy)
        }
    }
}
