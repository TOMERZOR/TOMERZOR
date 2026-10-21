import ActivityKit
import Foundation

/// The Live Activity on the Lock Screen and in the Dynamic Island while Moffy guides someone through
/// another app: the current step, and where on the screen to tap.
struct MoffyLiveAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var step: Int
        var caption: String
        var say: String
        /// Whether there is a place to tap; `x` and `y` are fractions of the screen from the top left.
        var hasPoint: Bool
        var x: Double
        var y: Double
        var mood: String
        var finished: Bool
    }

    var hebrew: Bool
}
