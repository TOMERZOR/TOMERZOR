import SwiftUI

/// First launch: pick a language, meet Moffy, allow the camera and microphone.
struct OnboardingView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper
    @State private var step = 0
    @State private var asking = false

    var body: some View {
        ZStack {
            Theme.cream.ignoresSafeArea()
            if step == 0 {
                languageStep.transition(.asymmetric(insertion: .opacity, removal: .move(edge: .leading).combined(with: .opacity)))
            } else {
                meetStep.transition(.move(edge: .trailing).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.45, dampingFraction: 0.8), value: step)
    }

    private var languageStep: some View {
        VStack(spacing: 28) {
            Spacer()
            MoffyView(mood: .happy, size: 190)
            VStack(spacing: 6) {
                Text("My Old Friend")
                    .font(.system(size: 40, weight: .heavy, design: .rounded))
                Text("החבר הוותיק שלי")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(Theme.inkSoft)
            }
            .foregroundStyle(Theme.ink)
            Spacer()
            VStack(spacing: 16) {
                ForEach([AppLanguage.hebrew, .english]) { language in
                    BigButton(title: language.nativeName, height: 88) {
                        settings.language = language
                        step = 1
                    }
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
    }

    private var meetStep: some View {
        VStack(spacing: 24) {
            Spacer()
            MoffyView(mood: asking ? .thinking : .talking, size: 170, wordPulse: helper.speaker.wordPulse)
            Text(settings.t("Hi! I'm Moffy.", "שלום! אני מופי."))
                .font(.system(size: settings.textSize.title + 6, weight: .heavy, design: .rounded))
                .foregroundStyle(Theme.ink)
            Text(intro)
                .font(.system(size: settings.textSize.body, weight: .medium, design: .rounded))
                .foregroundStyle(Theme.inkSoft)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 28)
            Spacer()
            BigButton(title: settings.t("Let's start", "בואו נתחיל"), systemImage: "hand.thumbsup.fill", height: 88) {
                Task { await allowAndStart() }
            }
            .disabled(asking)
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
        .onAppear {
            helper.speaker.speak(settings.t("Hi! I'm Moffy. ", "שלום! אני מופי. ") + intro,
                                 language: settings.lang, speed: settings.speechSpeed)
        }
    }

    private var intro: String {
        settings.t("I can look through your camera and help you with phones, computers, the TV and more, one small step at a time. The phone will now ask if I may use the camera and microphone. Please tap Allow.",
                   "אני יכול להסתכל דרך המצלמה ולעזור לכם עם הטלפון, המחשב, הטלוויזיה ועוד, צעד קטן אחד בכל פעם. עכשיו הטלפון ישאל אם מותר לי להשתמש במצלמה ובמיקרופון. לחצו על \"אישור\".")
    }

    private func allowAndStart() async {
        asking = true
        helper.speaker.stop()
        _ = await CameraService.requestAccess()
        _ = await SpeechListener.requestAccess()
        asking = false
        settings.hasOnboarded = true
    }
}
