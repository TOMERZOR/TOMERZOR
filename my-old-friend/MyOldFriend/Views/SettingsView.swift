import SwiftUI

/// Settings use the standard grouped list, so they look and behave like the iPhone's own Settings.
struct SettingsView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper
    @Environment(\.dismiss) private var dismiss
    @State private var keyDraft = ""
    @State private var hasKey = false

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
                                    .font(.system(size: size.sample, weight: .bold, design: .rounded))
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
                            helper.speaker.speak(settings.t("This is how I sound.", "ככה אני נשמע."),
                                                 language: settings.lang, speed: settings.speechSpeed)
                        }))
                    Toggle(settings.t("Use the camera", "להשתמש במצלמה"), isOn: Binding(
                        get: { settings.useCamera },
                        set: { helper.setCamera(on: $0) }))
                } header: {
                    Text(settings.t("Moffy", "מופי"))
                } footer: {
                    Text(settings.t("With the camera off, Moffy helps from your words alone.",
                                    "כשהמצלמה כבויה, מופי עוזר רק לפי מה שאומרים לו."))
                }

                caregiverSection

                Section(settings.t("About", "אודות")) {
                    Text(settings.t("My Old Friend is AI for the third age. Moffy is an AI and can make mistakes. Your questions and camera pictures are sent over the internet to Claude, an AI by Anthropic, so he can answer.",
                                    "החבר הוותיק שלי היא בינה מלאכותית לגיל השלישי. מופי הוא בינה מלאכותית ויכול לטעות. השאלות ותמונות המצלמה נשלחות דרך האינטרנט ל-Claude, בינה מלאכותית של Anthropic, כדי שיוכל לענות."))
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
            .font(.rounded(.title3))
            .tint(Theme.action)
            .scrollContentBackground(.hidden)
            .background(Theme.surface)
            .navigationTitle(settings.t("Settings", "הגדרות"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(settings.t("Done", "סיום")) { dismiss() }
                        .font(.rounded(.headline, .bold))
                }
            }
        }
        .onAppear { hasKey = helper.hasKey }
    }

    /// For the family member or friend who sets the app up.
    private var caregiverSection: some View {
        Section {
            Label(hasKey ? settings.t("Connected", "מחובר") : settings.t("Practice mode, no key yet", "מצב תרגול, אין מפתח עדיין"),
                  systemImage: hasKey ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                .foregroundStyle(hasKey ? Color.green : Color.orange)
            SecureField(settings.t("Paste API key", "הדביקו מפתח API"), text: $keyDraft)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .font(.system(.body, design: .monospaced))
            Button(settings.t("Save key", "שמירת מפתח")) {
                Keychain.save(keyDraft.trimmingCharacters(in: .whitespacesAndNewlines), account: Keychain.apiKeyAccount)
                keyDraft = ""
                hasKey = helper.hasKey
            }
            .disabled(keyDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            if hasKey {
                Button(settings.t("Remove key", "מחיקת מפתח"), role: .destructive) {
                    Keychain.delete(account: Keychain.apiKeyAccount)
                    hasKey = helper.hasKey
                }
            }
        } header: {
            Text(settings.t("For the helper who sets this up", "למי שמתקין את האפליקציה"))
        } footer: {
            Text(settings.t("An Anthropic API key from console.anthropic.com, stored encrypted on this phone only. Model: ",
                            "מפתח API של Anthropic מהאתר console.anthropic.com, נשמר מוצפן בטלפון הזה בלבד. מודל: ") + ClaudeBrain.model)
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
