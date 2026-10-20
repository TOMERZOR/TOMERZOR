import AVFoundation
import SwiftUI
import UIKit

/// Shows the live camera, filling its area the same way `ImagePrep.crop` cuts the snapshot,
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
    /// Cuts the middle of the picture to the shape of the screen area, like the live preview does.
    static func crop(_ image: UIImage, toAspect aspect: CGFloat) -> UIImage {
        guard let cgImage = image.cgImage, aspect > 0 else { return image }
        let width = CGFloat(cgImage.width)
        let height = CGFloat(cgImage.height)
        var rect = CGRect(x: 0, y: 0, width: width, height: height)
        if width / height > aspect {
            rect.size.width = height * aspect
            rect.origin.x = (width - rect.width) / 2
        } else {
            rect.size.height = width / aspect
            rect.origin.y = (height - rect.height) / 2
        }
        guard let cropped = cgImage.cropping(to: rect.integral) else { return image }
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
