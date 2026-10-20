import SwiftUI

/// For people who prefer typing, or when it's too noisy to talk.
struct TypeQuestionView: View {
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @FocusState private var focused: Bool
    let onAsk: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 14) {
                MoffyView(mood: .listening, size: 64)
                Text(settings.t("Write your question", "כתבו את השאלה"))
                    .font(.system(size: settings.textSize.title, weight: .heavy, design: .rounded))
                    .foregroundStyle(Theme.ink)
            }
            TextField(settings.t("For example: how do I make the letters bigger?",
                                 "לדוגמה: איך מגדילים את האותיות?"),
                      text: $text, axis: .vertical)
                .font(.system(size: settings.textSize.body + 2, weight: .medium, design: .rounded))
                .lineLimit(3...8)
                .focused($focused)
                .padding(18)
                .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Color.white))
                .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(Theme.pink, lineWidth: 3))
            BigButton(title: settings.t("Ask Moffy", "לשאול את מופי"), systemImage: "paperplane.fill") {
                onAsk(text)
                dismiss()
            }
            .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            BigButton(title: settings.t("Cancel", "ביטול"), filled: false, height: 64) { dismiss() }
            Spacer()
        }
        .padding(20)
        .background(Theme.cream.ignoresSafeArea())
        .onAppear { focused = true }
        .presentationDetents([.large])
    }
}
