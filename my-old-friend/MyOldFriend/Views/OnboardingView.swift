import SwiftUI

/// First launch, two calm screens: pick a language, then meet Moffy and allow the camera and microphone.
/// This is the only place Moffy introduces herself.
struct OnboardingView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var step = UserDefaults.standard.string(forKey: "screenshotScene") == "meet" ? 1 : 0
    @State private var asking = false

    var body: some View {
        ZStack {
            Theme.surface.ignoresSafeArea()
            if step == 0 {
                languageStep.transition(.opacity)
            } else {
                meetStep.transition(reduceMotion ? .opacity : .opacity.combined(with: .offset(y: 24)))
            }
        }
        .animation(.easeInOut(duration: 0.4), value: step)
    }

    private var languageStep: some View {
        VStack(spacing: 0) {
            Spacer()
            MoffyView(mood: .happy, size: 136)
            VStack(spacing: 8) {
                Text("My Old Friend")
                    .font(.ui(.largeTitle, .bold))
                    .foregroundStyle(Theme.ink)
                Text("AI for the third age")
                    .font(.ui(.title3, .medium))
                    .foregroundStyle(Theme.inkSecondary)
                Text("בינה מלאכותית לגיל השלישי")
                    .font(.ui(.title3, .medium))
                    .foregroundStyle(Theme.inkSecondary)
            }
            .multilineTextAlignment(.center)
            .padding(.top, 28)
            Spacer()
            VStack(spacing: 14) {
                ForEach([AppLanguage.hebrew, .english]) { language in
                    PinkButton(title: language.nativeName, minHeight: 76) {
                        settings.language = language
                        step = 1
                    }
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 20)
        }
    }

    private var meetStep: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    Spacer()
                    MoffyView(mood: asking ? .thinking : .talking, size: 104, wordPulse: helper.speaker.wordPulse)
                    Spacer()
                }
                .padding(.top, 24)

                Text(settings.t("Hi! I'm Moffy.", "שלום! אני מופי."))
                    .font(.ui(.largeTitle, .bold))
                    .foregroundStyle(Theme.ink)

                VStack(alignment: .leading, spacing: 16) {
                    row("camera.viewfinder", settings.t("Show me what you need help with.", "הראו לי במה צריך עזרה."))
                    row("mic.fill", settings.t("Tell me in your own words.", "ספרו לי במילים שלכם."))
                    row("hand.point.up.left.fill", settings.t("I'll show you exactly what to press, one step at a time.", "אני אראה לכם בדיוק על מה ללחוץ, צעד אחד בכל פעם."))
                }

                // Apple asks apps to say clearly where AI is used and what it can't do.
                Label {
                    Text(settings.t("Moffy is an AI and can make mistakes, so for money or health matters, check with someone you trust. When you ask, your question and the camera picture are sent over the internet so Moffy can understand them.",
                                    "מופי היא בינה מלאכותית ויכולה לטעות, ולכן בענייני כסף או בריאות כדאי לבדוק עם מישהו שסומכים עליו. כששואלים, השאלה ותמונת המצלמה נשלחות דרך האינטרנט כדי שמופי תוכל להבין אותן."))
                        .font(.ui(.body))
                        .foregroundStyle(Theme.inkSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                } icon: {
                    Image(systemName: "info.circle.fill").foregroundStyle(Theme.actionText)
                }
                .padding(16)
                .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Theme.hairline.opacity(0.5)))
            }
            .padding(.horizontal, 24)
        }
        .safeAreaInset(edge: .bottom) {
            PinkButton(title: settings.t("Let's start", "בואו נתחיל"), isBusy: asking, minHeight: 76) {
                Task { await allowAndStart() }
            }
            .disabled(asking)
            .padding(.horizontal, 24)
            .padding(.vertical, 12)
            .background(Theme.surface)
        }
        .onAppear {
            helper.speaker.speak(settings.t("Hi! I'm Moffy. Show me what you need help with, tell me in your own words, and I'll show you exactly what to press, one step at a time. Tap Let's start, and then tap Allow.",
                                            "שלום! אני מופי. הראו לי במה צריך עזרה, ספרו לי במילים שלכם, ואני אראה לכם בדיוק על מה ללחוץ, צעד אחד בכל פעם. לחצו על בואו נתחיל, ואחר כך על אישור."),
                                 language: settings.lang, speed: settings.speechSpeed)
        }
    }

    private func row(_ symbol: String, _ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 14) {
            Image(systemName: symbol)
                .font(.ui(.title2, .semibold))
                .foregroundStyle(Theme.actionText)
                .frame(width: 36)
            Text(text)
                .font(.ui(.title2, .semibold))
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// The system asks for the camera, then the microphone, right after the person agrees to start.
    private func allowAndStart() async {
        asking = true
        helper.speaker.stop()
        _ = await CameraService.requestAccess()
        _ = await SpeechListener.requestAccess()
        asking = false
        settings.hasOnboarded = true
    }
}
