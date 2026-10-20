import SwiftUI

/// For people who prefer typing, or when it's too noisy to talk.
struct TypeQuestionView: View {
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @FocusState private var focused: Bool
    let onAsk: (String) -> Void

    private var isEmpty: Bool { text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                TextField(settings.t("For example: how do I make the letters bigger?",
                                     "לדוגמה: איך מגדילים את האותיות?"),
                          text: $text, axis: .vertical)
                    .font(.rounded(.title2))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(3...8)
                    .focused($focused)
                    .padding(18)
                    .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Theme.card))
                    .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Theme.hairline, lineWidth: 1))
                BigButton(title: settings.t("Ask Moffy", "לשאול את מופי"), systemImage: "paperplane.fill") {
                    onAsk(text)
                    dismiss()
                }
                .disabled(isEmpty)
                .opacity(isEmpty ? 0.5 : 1)
                Spacer()
            }
            .padding(20)
            .background(Theme.surface.ignoresSafeArea())
            .navigationTitle(settings.t("Write your question", "כתבו את השאלה"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(settings.t("Cancel", "ביטול")) { dismiss() }
                        .font(.rounded(.headline))
                }
            }
        }
        .onAppear { focused = true }
    }
}
