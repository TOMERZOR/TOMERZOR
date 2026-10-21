import Foundation
import UIKit

/// The link between the app and the screen-broadcast extension while Moffy guides someone through
/// another app. A free Apple ID can't use App Groups, so the two talk through named pasteboards
/// (shared by apps from the same developer) and Darwin notifications (a ping with no data).
enum LiveChannel {
    /// App → extension: where the server is and what the person wants to do.
    static let configBoard = "com.tomerzor.myoldfriend.live.config"
    /// Extension → app: Moffy's latest step.
    static let replyBoard = "com.tomerzor.myoldfriend.live.reply"
    private static let dataType = "com.tomerzor.myoldfriend.live.json"

    enum Signal: String {
        case started = "com.tomerzor.myoldfriend.live.started"
        case reply = "com.tomerzor.myoldfriend.live.reply"
        case stopped = "com.tomerzor.myoldfriend.live.stopped"
    }

    static func write<T: Encodable>(_ value: T, to board: String) {
        guard let data = try? JSONEncoder().encode(value),
              let pasteboard = UIPasteboard(name: UIPasteboard.Name(board), create: true) else { return }
        pasteboard.setData(data, forPasteboardType: dataType)
    }

    static func read<T: Decodable>(_ type: T.Type, from board: String) -> T? {
        guard let pasteboard = UIPasteboard(name: UIPasteboard.Name(board), create: false),
              let data = pasteboard.data(forPasteboardType: dataType) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    static func post(_ signal: Signal) {
        CFNotificationCenterPostNotification(CFNotificationCenterGetDarwinNotifyCenter(),
                                             CFNotificationName(signal.rawValue as CFString), nil, nil, true)
    }
}

/// Listens for the other side's pings. Handlers run on the main queue.
final class LiveSignals {
    private var handlers: [String: () -> Void] = [:]

    func observe(_ signal: LiveChannel.Signal, _ handler: @escaping () -> Void) {
        handlers[signal.rawValue] = handler
        CFNotificationCenterAddObserver(
            CFNotificationCenterGetDarwinNotifyCenter(),
            Unmanaged.passUnretained(self).toOpaque(),
            { _, observer, name, _, _ in
                guard let observer, let name else { return }
                let signals = Unmanaged<LiveSignals>.fromOpaque(observer).takeUnretainedValue()
                let key = name.rawValue as String
                DispatchQueue.main.async { signals.handlers[key]?() }
            },
            signal.rawValue as CFString, nil, .deliverImmediately)
    }

    deinit {
        CFNotificationCenterRemoveEveryObserver(CFNotificationCenterGetDarwinNotifyCenter(),
                                                Unmanaged.passUnretained(self).toOpaque())
    }
}

/// What the app hands the extension when a guided session starts.
struct LiveConfig: Codable {
    var serverURL: String
    var appToken: String
    var installID: String
    var subscriptionID: String?
    /// "he" or "en".
    var language: String
    /// What the person asked for, for example "how do I send a photo to my granddaughter".
    var goal: String
    var history: [LiveTurn]
}

struct LiveTurn: Codable {
    var role: String
    var text: String
}

/// One step from Moffy, or a problem (`error` is the server's code, such as "trial_over").
struct LiveReply: Codable {
    var counter: Int
    var say: String = ""
    var caption: String = ""
    var mood: String = "explaining"
    var step: Int = 0
    var finished: Bool = false
    var pointVisible: Bool = false
    var x: Double = 0
    var y: Double = 0
    var label: String = ""
    var error: String? = nil
}
