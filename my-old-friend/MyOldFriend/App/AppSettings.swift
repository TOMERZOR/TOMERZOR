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

/// The smallest letters the app will show. Text still grows further with the iPhone's own text size.
enum TextSize: Int, CaseIterable, Identifiable {
    case large, extraLarge, huge

    var id: Int { rawValue }
    var minimum: DynamicTypeSize { [.xLarge, .xxxLarge, .accessibility2][rawValue] }
    /// Size of the sample "A" on the settings button.
    var sample: CGFloat { [24, 31, 40][rawValue] }
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
    @Published var useCamera: Bool {
        didSet { defaults.set(useCamera, forKey: "useCamera") }
    }
    /// When the person agreed, on the welcome screen, to send questions and pictures to the AI services.
    @Published var agreedToAIAt: Date? {
        didSet { defaults.set(agreedToAIAt, forKey: "agreedToAIAt") }
    }

    init() {
        language = defaults.string(forKey: "language").flatMap(AppLanguage.init(rawValue:))
        hasOnboarded = defaults.bool(forKey: "hasOnboarded")
        textSize = TextSize(rawValue: defaults.integer(forKey: "textSize")) ?? .large
        speechSpeed = defaults.object(forKey: "speechSpeed") as? Double ?? 0.85
        readAloud = defaults.object(forKey: "readAloud") as? Bool ?? true
        useCamera = defaults.object(forKey: "useCamera") as? Bool ?? true
        agreedToAIAt = defaults.object(forKey: "agreedToAIAt") as? Date
    }

    var lang: AppLanguage { language ?? .english }

    /// Picks the English or Hebrew version of a piece of text.
    func t(_ english: String, _ hebrew: String) -> String {
        lang == .hebrew ? hebrew : english
    }
}
