import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper
    @Environment(\.dismiss) private var dismiss
    @State private var keyDraft = ""
    @State private var hasKey = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    section(settings.t("Language", "שפה")) {
                        HStack(spacing: 12) {
                            ForEach([AppLanguage.hebrew, .english]) { language in
                                choice(language.nativeName, selected: settings.lang == language) {
                                    settings.language = language
                                }
                            }
                        }
                    }

                    section(settings.t("Letter size", "גודל האותיות")) {
                        HStack(spacing: 12) {
                            ForEach(TextSize.allCases) { size in
                                Button { settings.textSize = size } label: {
                                    Text("A")
                                        .font(.system(size: size.title, weight: .heavy, design: .rounded))
                                        .frame(maxWidth: .infinity, minHeight: 72)
                                }
                                .buttonStyle(ChoiceStyle(selected: settings.textSize == size))
                            }
                        }
                    }

                    section(settings.t("Moffy's voice", "הקול של מופי")) {
                        HStack(spacing: 12) {
                            choice(settings.t("Slow", "לאט"), selected: settings.speechSpeed < 0.8) {
                                settings.speechSpeed = 0.7
                                helper.speaker.speak(settings.t("This is how I sound.", "ככה אני נשמע."), language: settings.lang, speed: 0.7)
                            }
                            choice(settings.t("Normal", "רגיל"), selected: settings.speechSpeed >= 0.8) {
                                settings.speechSpeed = 0.85
                                helper.speaker.speak(settings.t("This is how I sound.", "ככה אני נשמע."), language: settings.lang, speed: 0.85)
                            }
                        }
                        Toggle(isOn: $settings.readAloud) {
                            Text(settings.t("Read answers out loud", "להקריא תשובות בקול"))
                                .font(.system(size: settings.textSize.body, weight: .semibold, design: .rounded))
                        }
                        .tint(Theme.pink)
                        .padding(.top, 4)
                    }

                    caregiverSection
                }
                .padding(20)
            }
            .background(Theme.cream.ignoresSafeArea())
            .navigationTitle(settings.t("Settings", "הגדרות"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(settings.t("Done", "סיום")) { dismiss() }
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                }
            }
            .safeAreaInset(edge: .bottom) {
                BigButton(title: settings.t("Done", "סיום"), systemImage: "checkmark") { dismiss() }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 8)
                    .background(Theme.cream)
            }
        }
        .onAppear { hasKey = helper.hasKey }
    }

    /// For the family member or friend who sets the app up.
    private var caregiverSection: some View {
        section(settings.t("For the helper who sets this up", "למי שמתקין את האפליקציה")) {
            HStack(spacing: 10) {
                Circle().fill(hasKey ? Color.green : Color.orange).frame(width: 14, height: 14)
                Text(hasKey
                     ? settings.t("Connected to Claude", "מחובר ל-Claude")
                     : settings.t("Practice mode (no key yet)", "מצב תרגול (אין מפתח עדיין)"))
                    .font(.system(size: 18, weight: .semibold, design: .rounded))
            }
            Text(settings.t("Paste an Anthropic API key from console.anthropic.com. It is stored encrypted on this phone only. Use this for testing on your own phones; before publishing the app, the key should move to a server.",
                            "הדביקו מפתח API של Anthropic מהאתר console.anthropic.com. הוא נשמר מוצפן בטלפון הזה בלבד. זה מתאים לבדיקות בטלפונים שלכם; לפני פרסום האפליקציה צריך להעביר את המפתח לשרת."))
                .font(.system(size: 16, design: .rounded))
                .foregroundStyle(Theme.inkSoft)
            SecureField("sk-ant-…", text: $keyDraft)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .font(.system(size: 18, design: .monospaced))
                .padding(14)
                .background(RoundedRectangle(cornerRadius: 14).fill(Color.white))
                .environment(\.layoutDirection, .leftToRight)
            HStack(spacing: 12) {
                Button(settings.t("Save key", "שמירת מפתח")) {
                    Keychain.save(keyDraft.trimmingCharacters(in: .whitespacesAndNewlines), account: Keychain.apiKeyAccount)
                    keyDraft = ""
                    hasKey = helper.hasKey
                }
                .buttonStyle(.borderedProminent)
                .disabled(keyDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                if hasKey {
                    Button(settings.t("Remove key", "מחיקת מפתח"), role: .destructive) {
                        Keychain.delete(account: Keychain.apiKeyAccount)
                        hasKey = helper.hasKey
                    }
                    .buttonStyle(.bordered)
                }
            }
            .font(.system(size: 18, weight: .semibold, design: .rounded))
            Text(settings.t("Model: ", "מודל: ") + ClaudeBrain.model)
                .font(.system(size: 14, design: .monospaced))
                .foregroundStyle(Theme.inkSoft)
        }
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(size: settings.textSize.body, weight: .heavy, design: .rounded))
                .foregroundStyle(Theme.ink)
            content()
        }
    }

    private func choice(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: settings.textSize.button, weight: .bold, design: .rounded))
                .frame(maxWidth: .infinity, minHeight: 72)
        }
        .buttonStyle(ChoiceStyle(selected: selected))
    }
}

private struct ChoiceStyle: ButtonStyle {
    let selected: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(selected ? Color.white : Theme.pinkDeep)
            .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(selected ? Theme.pink : Color.white))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Theme.pink, lineWidth: 3))
            .scaleEffect(configuration.isPressed ? 0.95 : 1)
            .animation(.spring(response: 0.2, dampingFraction: 0.6), value: configuration.isPressed)
    }
}
