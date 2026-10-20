import AVFoundation
import SwiftUI
import UIKit

/// Shows the live camera, filling the whole screen the same way `ImagePrep.crop` assumes,
/// so a spot in the picture Moffy sees is the same spot on screen.
struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.previewLayer.session = session
        view.previewLayer.videoGravity = .resizeAspectFill
        view.backgroundColor = .black
        return view
    }

    func updateUIView(_ uiView: PreviewView, context: Context) {}

    final class PreviewView: UIView {
        override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
    }
}

enum ImagePrep {
    /// Cuts out the part of the picture inside `rect`, where the picture fills `screenSize` the way the
    /// live preview does (scaled to fill, centered). So a spot in the snapshot is the same spot on screen.
    static func crop(_ image: UIImage, screenSize: CGSize, rect: CGRect) -> UIImage {
        guard let cgImage = image.cgImage, screenSize.width > 0, screenSize.height > 0,
              rect.width > 0, rect.height > 0 else { return image }
        let width = CGFloat(cgImage.width)
        let height = CGFloat(cgImage.height)
        let scale = max(screenSize.width / width, screenSize.height / height)
        let offsetX = (screenSize.width - width * scale) / 2
        let offsetY = (screenSize.height - height * scale) / 2
        let pixels = CGRect(x: (rect.minX - offsetX) / scale,
                            y: (rect.minY - offsetY) / scale,
                            width: rect.width / scale,
                            height: rect.height / scale)
            .intersection(CGRect(x: 0, y: 0, width: width, height: height))
        guard !pixels.isNull, let cropped = cgImage.cropping(to: pixels.integral) else { return image }
        return UIImage(cgImage: cropped)
    }

    /// Shrinks the picture (Claude doesn't need more than ~1280 pixels) and turns it into JPEG.
    static func jpeg(_ image: UIImage, maxSide: CGFloat = 1280) -> Data? {
        let longest = max(image.size.width, image.size.height)
        let scale = min(1, maxSide / max(longest, 1))
        let size = CGSize(width: (image.size.width * scale).rounded(), height: (image.size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let resized = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        return resized.jpegData(compressionQuality: 0.7)
    }
}
