import ReplayKit
import SwiftUI

/// iOS's own "start broadcast" control, which only it may show. It sits hidden behind our big pink
/// button, and the pink button taps it.
final class BroadcastPickerHolder {
    fileprivate weak var picker: RPSystemBroadcastPickerView?

    func open() {
        guard let picker else { return }
        for case let button as UIButton in picker.subviews {
            button.sendActions(for: .touchUpInside)
        }
    }
}

struct BroadcastPicker: UIViewRepresentable {
    let holder: BroadcastPickerHolder

    func makeUIView(context: Context) -> RPSystemBroadcastPickerView {
        let picker = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 44, height: 44))
        picker.preferredExtension = "com.tomerzor.myoldfriend.broadcast"
        picker.showsMicrophoneButton = false
        holder.picker = picker
        return picker
    }

    func updateUIView(_ picker: RPSystemBroadcastPickerView, context: Context) {
        holder.picker = picker
    }
}
