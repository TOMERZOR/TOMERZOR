import Foundation
import Security

/// A random ID for this phone, kept in the Keychain so it survives deleting and reinstalling the
/// app. The server counts the free questions by it. It says nothing about the person.
enum InstallID {
    static let value: UUID = {
        if let saved = load(), let id = UUID(uuidString: saved) { return id }
        let id = UUID()
        save(id.uuidString)
        return id
    }()

    private static let service = "com.tomerzor.myoldfriend"
    private static let account = "install-id"

    private static func load() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private static func save(_ value: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: Data(value.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemAdd(query as CFDictionary, nil)
    }
}
