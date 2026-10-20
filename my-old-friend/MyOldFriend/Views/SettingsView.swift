import StoreKit
import SwiftUI

/// Settings use the standard grouped list, so they look and behave like the iPhone's own Settings.
struct SettingsView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper
    @Environment(\.dismiss) private var dismiss
    @State private var showPaywall = false
    @State private var showManage = false

    var body: some View {
        NavigationStack {
            Form {
                Section(settings.t("Language", "שפה")) {
                    Picker(settings.t("Language", "שפה"), selection: Binding(
                        get: { settings.lang },
                        set: { settings.language = $0 })) {
                        ForEach(AppLanguage.allCases) { Text($0.nativeName).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }

                Section(settings.t("Letter size", "גודל האותיות")) {
                    HStack(spacing: 12) {
                        ForEach(TextSize.allCases) { size in
                            Button { settings.textSize = size } label: {
                                Text("A")
                                    .font(.system(size: size.sample, weight: .bold))
                                    .frame(maxWidth: .infinity, minHeight: 64)
                            }
                            .buttonStyle(ChoiceStyle(selected: settings.textSize == size))
                            .accessibilityLabel(settings.t("Letter size \(size.rawValue + 1)", "גודל אותיות \(size.rawValue + 1)"))
                            .accessibilityAddTraits(settings.textSize == size ? .isSelected : [])
                        }
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }

                Section {
                    Toggle(settings.t("Read answers out loud", "להקריא תשובות בקול"), isOn: $settings.readAloud)
                    Toggle(settings.t("Speak slowly", "לדבר לאט"), isOn: Binding(
                        get: { settings.speechSpeed < 0.8 },
                        set: { slow in
                            settings.speechSpeed = slow ? 0.7 : 0.85
                            helper.speaker.speak(Helper.voiceSample(settings.lang),
                                                 language: settings.lang, speed: settings.speechSpeed)
                        }))
                    Toggle(settings.t("Use the camera", "להשתמש במצלמה"), isOn: Binding(
                        get: { settings.useCamera },
                        set: { helper.setCamera(on: $0) }))
                } header: {
                    Text(settings.t("Moffy", "מופי"))
                } footer: {
                    Text(settings.t("With the camera off, Moffy helps from your words alone.",
                                    "כשהמצלמה כבויה, מופי עוזרת רק לפי מה שאומרים לה."))
                }

                subscriptionSection

                Section(settings.t("About", "אודות")) {
                    Text(settings.t("My Old Friend is AI for the third age. Moffy is an AI and can make mistakes. Your questions and camera pictures are sent over the internet to Claude, an AI by Anthropic, so Moffy can answer, and Moffy's words are sent to ElevenLabs to be spoken.",
                                    "החבר הוותיק שלי היא בינה מלאכותית לגיל השלישי. מופי היא בינה מלאכותית ויכולה לטעות. השאלות ותמונות המצלמה נשלחות דרך האינטרנט ל-Claude, בינה מלאכותית של Anthropic, כדי שמופי תוכל לענות, והמילים של מופי נשלחות ל-ElevenLabs כדי להקריא אותן."))
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
            .font(.ui(.title3))
            .tint(Theme.action)
            .scrollContentBackground(.hidden)
            .background(Theme.surface)
            .navigationTitle(settings.t("Settings", "הגדרות"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(settings.t("Done", "סיום")) { dismiss() }
                        .font(.ui(.headline, .bold))
                }
            }
        }
        .manageSubscriptionsSheet(isPresented: $showManage)
        .sheet(isPresented: $showPaywall) {
            PaywallView().inheritingAppEnvironment(settings: settings, helper: helper)
        }
    }

    private var subscriptionSection: some View {
        let store = helper.subscription
        return Section(settings.t("Subscription", "המנוי")) {
            if store.isSubscribed {
                Label(settings.t("Your subscription is active", "המנוי פעיל"), systemImage: "checkmark.circle.fill")
                    .foregroundStyle(Theme.ink)
                Button(settings.t("Manage subscription", "ניהול המנוי")) { showManage = true }
            } else {
                Text(trialText(store.trialLeft))
                    .foregroundStyle(Theme.ink)
                PinkButton(title: settings.t("Subscribe – \(store.price) a month", "להצטרפות – \(store.price) לחודש"),
                           minHeight: 60) { showPaywall = true }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))
                Button(settings.t("Restore purchase", "שחזור רכישה")) {
                    Task { await store.restore() }
                }
            }
        }
    }

    private func trialText(_ left: Int) -> String {
        switch left {
        case ...0: return settings.t("The free questions are used up.", "השאלות בחינם נגמרו.")
        case 1: return settings.t("1 free question left.", "נשארה שאלה אחת בחינם.")
        default: return settings.t("\(left) free questions left.", "נשארו \(left) שאלות בחינם.")
        }
    }
}

private struct ChoiceStyle: ButtonStyle {
    let selected: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(selected ? Color.white : Theme.ink)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(selected ? Theme.action : Theme.card))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(selected ? Color.clear : Theme.hairline, lineWidth: 1))
            .opacity(configuration.isPressed ? 0.85 : 1)
    }
}
