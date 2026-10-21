import CoreImage
import ImageIO
import ReplayKit

/// Watches the screen while the person uses another app, and asks Moffy for the next step each time
/// the screen settles on something new. Runs in its own small process (about 50 MB), so frames are
/// shrunk and dropped, never kept.
final class SampleHandler: RPBroadcastSampleHandler {
    private let queue = DispatchQueue(label: "com.tomerzor.myoldfriend.live")
    private let context = CIContext(options: [.cacheIntermediates: false])

    private var config: LiveConfig?
    private var history: [LiveTurn] = []
    private var startedAt = Date()
    private var lastLook = Date.distantPast
    private var lastThumb: [UInt8]?
    private var sentThumb: [UInt8]?
    private var changedAt: Date?
    private var askedOnce = false
    private var inFlight = false
    private var finishing = false
    private var counter = 0
    private let signals = LiveSignals()

    private var hebrew: Bool { config?.language == "he" }

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        queue.sync {
            config = LiveChannel.read(LiveConfig.self, from: LiveChannel.configBoard)
            history = config?.history ?? []
            startedAt = Date()
            counter = Int(Date().timeIntervalSince1970)
        }
        // A new question asked in the app while sharing: start over from it and look at the screen now.
        signals.observe(.goal) { [weak self] in
            guard let self else { return }
            self.queue.async {
                self.config = LiveChannel.read(LiveConfig.self, from: LiveChannel.configBoard)
                self.history = self.config?.history ?? []
                self.askedOnce = false
                self.sentThumb = nil
                self.startedAt = Date().addingTimeInterval(-2)
            }
        }
        LiveChannel.post(.started)
    }

    override func broadcastFinished() {
        LiveChannel.post(.stopped)
    }

    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        guard sampleBufferType == .video, let pixels = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        queue.sync { look(at: CIImage(cvPixelBuffer: pixels), now: Date()) }
    }

    // MARK: - Watching

    /// A look a few times a second: wait until the screen stops changing, then ask about it once.
    private func look(at image: CIImage, now: Date) {
        guard config != nil, !finishing, now.timeIntervalSince(lastLook) >= 0.4 else { return }
        lastLook = now
        let thumb = thumbnail(of: image)
        defer { lastThumb = thumb }

        if let lastThumb, difference(thumb, lastThumb) > 6 {
            changedAt = now
            return
        }
        guard !inFlight else { return }

        let firstLook = !askedOnce && now.timeIntervalSince(startedAt) > 1
        let settled = changedAt.map { now.timeIntervalSince($0) > 0.8 } ?? false
        let isNew = sentThumb.map { difference(thumb, $0) > 6 } ?? true
        if firstLook || (askedOnce && settled && isNew) {
            changedAt = nil
            ask(about: image, thumb: thumb)
        }
    }

    /// A 24 × 48 grey picture of the screen, enough to notice that something changed.
    private func thumbnail(of image: CIImage) -> [UInt8] {
        let width = 24, height = 48
        let small = image.transformed(by: CGAffineTransform(scaleX: CGFloat(width) / image.extent.width,
                                                            y: CGFloat(height) / image.extent.height))
        var rgba = [UInt8](repeating: 0, count: width * height * 4)
        context.render(small, toBitmap: &rgba, rowBytes: width * 4,
                       bounds: CGRect(x: 0, y: 0, width: width, height: height), format: .RGBA8, colorSpace: nil)
        var grey = [UInt8](repeating: 0, count: width * height)
        for i in 0..<(width * height) {
            grey[i] = UInt8((Int(rgba[i * 4]) * 3 + Int(rgba[i * 4 + 1]) * 6 + Int(rgba[i * 4 + 2])) / 10)
        }
        return grey
    }

    /// Average difference per pixel, from 0 to 255.
    private func difference(_ a: [UInt8], _ b: [UInt8]) -> Int {
        guard a.count == b.count, !a.isEmpty else { return 255 }
        var total = 0
        for i in 0..<a.count { total += abs(Int(a[i]) - Int(b[i])) }
        return total / a.count
    }

    // MARK: - Asking Moffy

    private func ask(about image: CIImage, thumb: [UInt8]) {
        guard let config, let url = URL(string: config.serverURL)?.appendingPathComponent("v1/ask") else { return }
        let scale = min(1, 1100 / max(image.extent.width, image.extent.height))
        let picture = image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        guard let space = CGColorSpace(name: CGColorSpace.sRGB),
              let jpeg = context.jpegRepresentation(
                of: picture, colorSpace: space,
                options: [CIImageRepresentationOption(rawValue: kCGImageDestinationLossyCompressionQuality as String): 0.6])
        else { return }

        let question = askedOnce
            ? (hebrew ? "המסך השתנה. מה הצעד הבא?" : "The screen changed. What's the next step?")
            : config.goal
        let body: [String: Any] = [
            "question": question,
            "language": config.language,
            "history": history.map { ["role": $0.role, "text": $0.text] },
            "photo": jpeg.base64EncodedString(),
            "source": "live",
            "live": true,
            "goal": config.goal,
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 60
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(config.appToken, forHTTPHeaderField: "x-app-token")
        request.setValue(config.installID, forHTTPHeaderField: "x-install-id")
        if let subscription = config.subscriptionID {
            request.setValue(subscription, forHTTPHeaderField: "x-subscription")
        }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        inFlight = true
        askedOnce = true
        sentThumb = thumb
        URLSession.shared.dataTask(with: request) { [weak self] data, response, _ in
            guard let self else { return }
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            self.queue.async { self.received(question: question, status: status, data: data) }
        }.resume()
    }

    private func received(question: String, status: Int, data: Data?) {
        inFlight = false
        counter += 1
        let json = data.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }

        guard status == 200, let reply = json?["reply"] as? [String: Any] else {
            let code = status == 0 ? "offline" : (json?["error"] as? String ?? "failed")
            LiveChannel.write(LiveReply(counter: counter, error: code), to: LiveChannel.replyBoard)
            LiveChannel.post(.reply)
            if code == "trial_over" || code == "daily_limit" { finish(hebrew ? "מופי: השאלות להיום הסתיימו." : "Moffy: no questions left for now.") }
            return
        }

        let point = reply["point"] as? [String: Any] ?? [:]
        var step = LiveReply(counter: counter)
        step.say = reply["say"] as? String ?? ""
        step.caption = reply["caption"] as? String ?? ""
        step.mood = reply["mood"] as? String ?? "explaining"
        step.step = reply["step"] as? Int ?? 0
        step.finished = reply["finished"] as? Bool ?? false
        step.pointVisible = point["visible"] as? Bool ?? false
        step.x = (point["x"] as? NSNumber)?.doubleValue ?? 0
        step.y = (point["y"] as? NSNumber)?.doubleValue ?? 0
        step.label = point["label"] as? String ?? ""

        history.append(LiveTurn(role: "user", text: question))
        history.append(LiveTurn(role: "assistant", text: json?["raw"] as? String ?? step.say))
        if history.count > 8 { history.removeFirst(history.count - 8) }

        LiveChannel.write(step, to: LiveChannel.replyBoard)
        LiveChannel.post(.reply)
        if step.finished { finish(hebrew ? "מופי: סיימנו! המשימה הושלמה." : "Moffy: All done!") }
    }

    /// Ends the broadcast a few seconds after the last step, so it can still be heard. iOS shows the
    /// message as the reason the broadcast stopped.
    private func finish(_ message: String) {
        guard !finishing else { return }
        finishing = true
        LiveChannel.post(.stopped)
        queue.asyncAfter(deadline: .now() + 4) { [weak self] in
            self?.finishBroadcastWithError(NSError(domain: "com.tomerzor.myoldfriend", code: 0,
                                                   userInfo: [NSLocalizedDescriptionKey: message]))
        }
    }
}
