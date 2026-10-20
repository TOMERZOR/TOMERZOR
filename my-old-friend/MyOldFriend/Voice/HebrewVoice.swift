import Foundation

/// Nikud for the words in the app's own Hebrew sentences that the voice could read the wrong way
/// ("לחצו" as lachatzu, not lochtzu). Moffy's answers come with their own nikud from the server.
enum HebrewVoice {
    private static let words: [String: String] = [
        "לחצו": "לַחֲצוּ",
        "נסו": "נַסּוּ",
        "ונסו": "וְנַסּוּ",
        "בדקו": "בִּדְקוּ",
        "אשרו": "אַשְּׁרוּ",
        "וכתבו": "וְכִתְבוּ",
        "ואמרו": "וְאִמְרוּ",
        "דבר": "דָּבָר",
        "שאלו": "שַׁאֲלוּ",
    ]

    /// The sentence with nikud added to the words above; everything else is left as it is.
    static func vocalized(_ text: String) -> String {
        var result = ""
        var word = ""
        func flush() {
            result += words[word] ?? word
            word = ""
        }
        for character in text {
            if character.isLetter {
                word.append(character)
            } else {
                flush()
                result.append(character)
            }
        }
        flush()
        return result
    }
}
