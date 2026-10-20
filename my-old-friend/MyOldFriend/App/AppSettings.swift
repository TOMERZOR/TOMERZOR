import SwiftUI

enum AppLanguage: String, CaseIterable, Identifiable {
    case english = "en"
    case hebrew = "he"

    var id: String { rawValue }
    var locale: Locale { Locale(identifier: self == .hebrew ? "he-IL" : "en-US") }
    var voiceCode: String { self == .hebrew ? "he-IL" : "en-US" }
    var layoutDirection: LayoutDirection { self == .hebrew ? .rightToLeft : .leftToRight }
    var nativeName: String { self == .hebrew ? "עברית" : "English" }
}

enum TextSize: Int, CaseIterable, Identifiable {
    case large, extraLarge, huge

    var id: Int { rawValue }
    var title: CGFloat { [28, 34, 42][rawValue] }
    var body: CGFloat { [22, 26, 32][rawValue] }
    var button: CGFloat { [24, 28, 32][rawValue] }
}

/// Everything the person (or their helper) can change. Saved on the phone.
final class AppSettings: ObservableObject {
    private let defaults = UserDefaults.standard

    @Published var language: AppLanguage? {
        didSet { defaults.set(language?.rawValue, forKey: "language") }
    }
    @Published var hasOnboarded: Bool {
        didSet { defaults.set(hasOnboarded, forKey: "hasOnboarded") }
    }
    @Published var textSize: TextSize {
        didSet { defaults.set(textSize.rawValue, forKey: "textSize") }
    }
    /// 1.0 is the phone's normal talking speed. Older ears usually like it a bit slower.
    @Published var speechSpeed: Double {
        didSet { defaults.set(speechSpeed, forKey: "speechSpeed") }
    }
    @Published var readAloud: Bool {
        didSet { defaults.set(readAloud, forKey: "readAloud") }
    }

    init() {
        language = defaults.string(forKey: "language").flatMap(AppLanguage.init(rawValue:))
        hasOnboarded = defaults.bool(forKey: "hasOnboarded")
        textSize = TextSize(rawValue: defaults.integer(forKey: "textSize")) ?? .large
        speechSpeed = defaults.object(forKey: "speechSpeed") as? Double ?? 0.85
        readAloud = defaults.object(forKey: "readAloud") as? Bool ?? true
    }

    var lang: AppLanguage { language ?? .english }

    /// Picks the English or Hebrew version of a piece of text.
    func t(_ english: String, _ hebrew: String) -> String {
        lang == .hebrew ? hebrew : english
    }
}
