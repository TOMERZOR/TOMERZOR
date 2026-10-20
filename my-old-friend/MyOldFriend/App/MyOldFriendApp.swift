import SwiftUI

@main
struct MyOldFriendApp: App {
    @StateObject private var settings: AppSettings
    @StateObject private var helper: Helper

    init() {
        let settings = AppSettings()
        _settings = StateObject(wrappedValue: settings)
        _helper = StateObject(wrappedValue: Helper(settings: settings))
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .inheritingAppEnvironment(settings: settings, helper: helper)
        }
    }
}

extension View {
    /// Shared settings, language direction (Hebrew right-to-left) and colors. Sheets need it passed again.
    func inheritingAppEnvironment(settings: AppSettings, helper: Helper) -> some View {
        environmentObject(settings)
            .environmentObject(helper)
            .environment(\.layoutDirection, settings.lang.layoutDirection)
            .environment(\.locale, settings.lang.locale)
            .dynamicTypeSize(settings.textSize.minimum ... .accessibility4)
            .tint(Theme.action)
    }
}

struct RootView: View {
    @EnvironmentObject private var settings: AppSettings

    var body: some View {
        Group {
            if settings.hasOnboarded {
                HelperView()
            } else {
                OnboardingView()
            }
        }
        .animation(.easeInOut(duration: 0.35), value: settings.hasOnboarded)
    }
}
