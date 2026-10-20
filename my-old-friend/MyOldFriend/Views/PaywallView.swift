import StoreKit
import SwiftUI

/// The subscription screen, shown when the free questions run out or from Settings.
/// Calm and plain: what you get, the price, one pink button.
struct PaywallView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper
    @Environment(\.dismiss) private var dismiss

    static let termsURL = URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!

    var body: some View {
        let store = helper.subscription
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    Spacer()
                    MoffyView(mood: .happy, size: 96)
                    Spacer()
                }
                .padding(.top, 40)

                Text(settings.t("Keep Moffy by your side", "מופי ממשיכה לעזור כל יום"))
                    .font(.ui(.largeTitle, .bold))
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)

                VStack(alignment: .leading, spacing: 18) {
                    row("camera.viewfinder", settings.t("Help with any device, whenever you need it.",
                                                        "עזרה עם כל מכשיר, מתי שצריך."))
                    row("hand.point.up.left.fill", settings.t("One clear step at a time, out loud and in big letters.",
                                                              "צעד ברור אחד בכל פעם, בקול ובאותיות גדולות."))
                    row("shield.fill", settings.t("A warning when something looks like a scam.",
                                                  "אזהרה כשמשהו נראה כמו עוקץ."))
                }

                Label {
                    Text(settings.t("Someone in the family can buy it for you, and share it through Family Sharing.",
                                    "מישהו מהמשפחה יכול לקנות את המנוי בשבילכם ולשתף אותו דרך שיתוף משפחתי."))
                        .font(.ui(.body))
                        .foregroundStyle(Theme.inkSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                } icon: {
                    Image(systemName: "person.2.fill").foregroundStyle(Theme.actionText)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 16)
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 12) {
                Text(settings.t("\(store.price) a month", "\(store.price) לחודש"))
                    .font(.ui(.title2, .bold))
                    .foregroundStyle(Theme.ink)

                PinkButton(title: settings.t("Subscribe", "להצטרפות"), isBusy: store.isPurchasing, minHeight: 76) {
                    Task { if await store.purchase() { dismiss() } }
                }
                .disabled(store.isPurchasing)

                if let problem = store.problem {
                    Text(problem)
                        .font(.ui(.body))
                        .foregroundStyle(Theme.inkSecondary)
                        .multilineTextAlignment(.center)
                }

                Button(settings.t("Restore purchase", "שחזור רכישה")) {
                    Task {
                        await store.restore()
                        if store.isSubscribed { dismiss() }
                    }
                }
                .font(.ui(.headline))
                .foregroundStyle(Theme.actionText)
                .frame(minHeight: 44)

                Text(settings.t("Renews every month. Cancel any time in the iPhone's Settings.",
                                "מתחדש כל חודש. אפשר לבטל בכל עת בהגדרות של האייפון."))
                    .font(.ui(.footnote))
                    .foregroundStyle(Theme.inkSecondary)
                    .multilineTextAlignment(.center)

                HStack(spacing: 24) {
                    Link(settings.t("Terms of Use", "תנאי שימוש"), destination: Self.termsURL)
                    if let privacy = Backend.privacyURL {
                        Link(settings.t("Privacy Policy", "מדיניות פרטיות"), destination: privacy)
                    }
                }
                .font(.ui(.footnote, .semibold))
                .foregroundStyle(Theme.actionText)
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 12)
            .background(Theme.surface)
        }
        .background(Theme.surface.ignoresSafeArea())
        .overlay(alignment: .topTrailing) {
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.inkSecondary)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Theme.hairline.opacity(0.7)))
            }
            .accessibilityLabel(settings.t("Close", "סגירה"))
            .padding(16)
        }
    }

    private func row(_ symbol: String, _ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 14) {
            Image(systemName: symbol)
                .font(.ui(.title2, .semibold))
                .foregroundStyle(Theme.actionText)
                .frame(width: 36)
            Text(text)
                .font(.ui(.title3, .semibold))
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
