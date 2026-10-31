import UIKit
import Capacitor
import QuickLook
import ARKit

/// The web app's screen, with the native AR plugin registered.
class LivingRoomViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ARQuickLookPlugin())
    }
}

/// Shows a USDZ built by the web app (one item or a whole room) in AR Quick Look.
/// Pinch-to-scale is off, so items always stay at their real size.
@objc(ARQuickLookPlugin)
public class ARQuickLookPlugin: CAPPlugin, CAPBridgedPlugin, QLPreviewControllerDataSource, QLPreviewControllerDelegate {
    public let identifier = "ARQuickLookPlugin"
    public let jsName = "ARQuickLook"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "present", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
    ]

    private var fileURL: URL?

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": ARWorldTrackingConfiguration.isSupported])
    }

    @objc func present(_ call: CAPPluginCall) {
        guard let base64 = call.getString("data"), let data = Data(base64Encoded: base64) else {
            call.reject("No model data")
            return
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("LivingRoom-\(UUID().uuidString).usdz")
        do {
            try data.write(to: url, options: .atomic)
        } catch {
            call.reject("Could not save the model")
            return
        }
        DispatchQueue.main.async {
            if let old = self.fileURL { try? FileManager.default.removeItem(at: old) }
            self.fileURL = url
            let preview = QLPreviewController()
            preview.dataSource = self
            preview.delegate = self
            self.bridge?.viewController?.present(preview, animated: true)
            call.resolve()
        }
    }

    public func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
        fileURL == nil ? 0 : 1
    }

    public func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
        let item = ARQuickLookPreviewItem(fileAt: fileURL!)
        item.allowsContentScaling = false
        return item
    }

    public func previewControllerDidDismiss(_ controller: QLPreviewController) {
        if let url = fileURL { try? FileManager.default.removeItem(at: url) }
        fileURL = nil
    }
}
