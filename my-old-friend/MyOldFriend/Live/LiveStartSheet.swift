import SwiftUI

/// Explains "Guide me on screen" in three big steps, then starts iOS screen sharing. Shown every time,
/// because the system screen that follows is not one people see often.
struct LiveStartSheet: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var helper: Helper
    @Environment(\.dismiss) private var dismiss
    @State private var picker = BroadcastPickerHolder()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    Text(settings.t("Moffy will guide you on the screen", "מופי תדריך אתכם על המסך"))
                        .font(.ui(.largeTitle, .bold))
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    step(1, settings.t("Tap “Start Broadcast”.", "לחצו על ״התחלת שידור״."))
                    step(2, settings.t("Go to the app you need help with.", "עברו לאפליקציה שבה צריך עזרה."))
                    step(3, settings.t("Moffy will say each step out loud and show it at the top of the screen.",
                                       "מופי תגיד כל שלב בקול ותראה אותו בראש המסך."))
                    Text(settings.t("To stop, tap the red bar at the top of the screen.",
                                    "כדי לעצור, לוחצים על הפס האדום בראש המסך."))
                        .font(.ui(.title3))
                        .foregroundStyle(Theme.inkSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(settings.t("Moffy sees your screen only while sharing is on, and doesn't keep it.",
                                    "מופי רואה את המסך רק בזמן השיתוף, ולא שומרת אותו."))
                        .font(.ui(.body))
                        .foregroundStyle(Theme.inkSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(24)
            }
            .safeAreaInset(edge: .bottom) {
                ZStack {
                    BroadcastPicker(holder: picker)
                        .frame(width: 44, height: 44)
                        .opacity(0.02)
                        .allowsHitTesting(false)
                    PinkButton(title: settings.t("Got it, let's start", "הבנתי, בואו נתחיל"), systemImage: "rectangle.on.rectangle") {
                        picker.open()
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 12)
                .background(Theme.surface)
            }
            .background(Theme.surface)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(settings.t("Cancel", "ביטול")) { dismiss() }
                        .font(.ui(.headline))
                }
            }
        }
        .onAppear { helper.prepareLive() }
        .onChange(of: helper.liveGuide.isLive) { _, live in if live { dismiss() } }
    }

    private func step(_ number: Int, _ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 14) {
            Text("\(number)")
                .font(.ui(.title2, .bold))
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Theme.action))
            Text(text)
                .font(.ui(.title2, .semibold))
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
