import Foundation

/// The app's own server (the `server` folder), which holds the Claude and ElevenLabs keys so nobody
/// who installs the app has to set anything up. Its address and token come from `Backend.plist`,
/// which is kept out of git; without it the app runs in practice mode.
enum Backend {
    private static let config: [String: Any] = {
        guard let url = Bundle.main.url(forResource: "Backend", withExtension: "plist"),
              let data = try? Data(contentsOf: url),
              let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any]
        else { return [:] }
        return plist
    }()

    static let baseURL: URL? = {
        guard let text = config["ServerURL"] as? String, !text.isEmpty, !text.contains("YOUR-") else { return nil }
        return URL(string: text)
    }()

    static let appToken = config["AppToken"] as? String ?? ""

    static var isConfigured: Bool { baseURL != nil }

    /// The privacy policy the server publishes, for the subscription screen and the welcome screen.
    static var privacyURL: URL? { baseURL?.appendingPathComponent("privacy") }

    /// Apple's subscription number while the person is subscribed; the server checks it with Apple.
    static var subscriptionID: String? {
        get { UserDefaults.standard.string(forKey: "subscriptionID") }
        set { UserDefaults.standard.set(newValue, forKey: "subscriptionID") }
    }

    enum Failure: Error { case notConfigured, offline, status(Int, String) }

    /// POSTs JSON to the server and returns the body of a 200 answer.
    static func post(_ path: String, _ body: [String: Any], timeout: TimeInterval) async throws -> Data {
        guard let baseURL else { throw Failure.notConfigured }
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.timeoutInterval = timeout
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(appToken, forHTTPHeaderField: "x-app-token")
        request.setValue(InstallID.value.uuidString.lowercased(), forHTTPHeaderField: "x-install-id")
        if let subscriptionID { request.setValue(subscriptionID, forHTTPHeaderField: "x-subscription") }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw Failure.offline
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else {
            let code = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String ?? ""
            throw Failure.status(status, code)
        }
        return data
    }
}
