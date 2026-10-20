import SwiftUI

/// Settings use the standard grouped list, so they look and behave like the iPhone's own Settings.
struct SettingsView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper
    @Environment(\.dismiss) private var dismiss
    @State private var claudeDraft = ""
    @State private var voiceDraft = ""
    @State private var hasKey = false
    @State private var hasVoiceKey = false

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

                claudeSection
                voiceSection

                Section(settings.t("About", "אודות")) {
                    Text(settings.t("My Old Friend is AI for the third age. Moffy is an AI and can make mistakes. Your questions and camera pictures are sent over the internet to Claude, an AI by Anthropic, so Moffy can answer. With a voice key, Moffy's words are sent to ElevenLabs to be spoken.",
                                    "החבר הוותיק שלי היא בינה מלאכותית לגיל השלישי. מופי היא בינה מלאכותית ויכולה לטעות. השאלות ותמונות המצלמה נשלחות דרך האינטרנט ל-Claude, בינה מלאכותית של Anthropic, כדי שמופי תוכל לענות. עם מפתח קול, המילים של מופי נשלחות ל-ElevenLabs כדי להקריא אותן."))
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
        .onAppear {
            hasKey = helper.hasKey
            hasVoiceKey = helper.hasVoiceKey
        }
    }

    /// For the family member or friend who sets the app up: the Claude key.
    private var claudeSection: some View {
        Section {
            status(hasKey, on: settings.t("Connected to Claude", "מחובר ל-Claude"),
                   off: settings.t("Practice mode, no key yet", "מצב תרגול, אין מפתח עדיין"))
            keyField(settings.t("Paste Claude API key", "הדביקו מפתח API של Claude"), text: $claudeDraft)
            keyButtons(draft: $claudeDraft, has: hasKey, account: Keychain.apiKeyAccount) {
                hasKey = helper.hasKey
            }
        } header: {
            Text(settings.t("For the helper who sets this up", "למי שמתקין את האפליקציה"))
        } footer: {
            Text(settings.t("An Anthropic API key from console.anthropic.com, stored encrypted on this phone only. Model: ",
                            "מפתח API של Anthropic מהאתר console.anthropic.com, נשמר מוצפן בטלפון הזה בלבד. מודל: ") + ClaudeBrain.model)
        }
    }

    /// The ElevenLabs key, for Moffy's natural voice.
    private var voiceSection: some View {
        Section {
            status(hasVoiceKey, on: settings.t("Natural voice is on", "הקול הטבעי פעיל"),
                   off: settings.t("Using the iPhone's voice", "משתמשת בקול של האייפון"))
            keyField(settings.t("Paste ElevenLabs key (voice)", "הדביקו מפתח ElevenLabs (קול)"), text: $voiceDraft)
            keyButtons(draft: $voiceDraft, has: hasVoiceKey, account: ElevenLabsVoice.keyAccount) {
                hasVoiceKey = helper.hasVoiceKey
                if hasVoiceKey { helper.prepareVoice() }
            }
        } header: {
            Text(settings.t("Moffy's voice", "הקול של מופי"))
        } footer: {
            Text(settings.t("From elevenlabs.io (Profile, API keys), stored encrypted on this phone only. Each new answer is made once and saved on the phone; repeats and fixed phrases play from the saved copy for free.",
                            "מהאתר elevenlabs.io (פרופיל, מפתחות API), נשמר מוצפן בטלפון הזה בלבד. כל תשובה חדשה נוצרת פעם אחת ונשמרת בטלפון; חזרות ומשפטים קבועים מתנגנים מהעותק השמור בחינם."))
        }
    }

    private func status(_ isOn: Bool, on: String, off: String) -> some View {
        Label(isOn ? on : off, systemImage: isOn ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
            .foregroundStyle(isOn ? Color.green : Color.orange)
    }

    private func keyField(_ placeholder: String, text: Binding<String>) -> some View {
        SecureField(placeholder, text: text)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .font(.system(.body, design: .monospaced))
    }

    @ViewBuilder
    private func keyButtons(draft: Binding<String>, has: Bool, account: String, changed: @escaping () -> Void) -> some View {
        let trimmed = draft.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines)
        PinkButton(title: settings.t("Save key", "שמירת מפתח"), minHeight: 56) {
            Keychain.save(trimmed, account: account)
            draft.wrappedValue = ""
            changed()
        }
        .disabled(trimmed.isEmpty)
        .listRowBackground(Color.clear)
        .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))
        if has {
            Button(settings.t("Remove key", "מחיקת מפתח"), role: .destructive) {
                Keychain.delete(account: account)
                changed()
            }
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
