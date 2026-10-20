import AVFoundation
import CoreImage
import UIKit

/// Runs the back camera and keeps the newest frame, so Moffy can "look" when a question is asked.
final class CameraService: NSObject, ObservableObject {
    let session = AVCaptureSession()

    @Published private(set) var isAuthorized = AVCaptureDevice.authorizationStatus(for: .video) == .authorized
    @Published private(set) var isRunning = false

    private let sessionQueue = DispatchQueue(label: "myoldfriend.camera.session")
    private let frameQueue = DispatchQueue(label: "myoldfriend.camera.frames")
    private let output = AVCaptureVideoDataOutput()
    private let frameLock = NSLock()
    private var latestFrame: CVPixelBuffer?
    private var isConfigured = false
    private let ciContext = CIContext()

    static func requestAccess() async -> Bool {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: return true
        case .notDetermined: return await AVCaptureDevice.requestAccess(for: .video)
        default: return false
        }
    }

    func start() {
        let authorized = AVCaptureDevice.authorizationStatus(for: .video) == .authorized
        isAuthorized = authorized
        guard authorized else { return }
        sessionQueue.async {
            if !self.isConfigured { self.configure() }
            if !self.session.isRunning { self.session.startRunning() }
            let running = self.session.isRunning
            DispatchQueue.main.async { self.isRunning = running }
        }
    }

    func stop() {
        sessionQueue.async {
            if self.session.isRunning { self.session.stopRunning() }
            DispatchQueue.main.async { self.isRunning = false }
        }
    }

    /// The newest camera picture, upright.
    func snapshot() -> UIImage? {
        frameLock.lock()
        let frame = latestFrame
        frameLock.unlock()
        guard let frame else { return nil }
        let image = CIImage(cvPixelBuffer: frame)
        guard let cgImage = ciContext.createCGImage(image, from: image.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }

    private func configure() {
        session.beginConfiguration()
        defer {
            session.commitConfiguration()
            isConfigured = true
        }
        session.sessionPreset = .hd1280x720

        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else { return }
        session.addInput(input)

        if (try? device.lockForConfiguration()) != nil {
            if device.isFocusModeSupported(.continuousAutoFocus) { device.focusMode = .continuousAutoFocus }
            if device.isExposureModeSupported(.continuousAutoExposure) { device.exposureMode = .continuousAutoExposure }
            device.unlockForConfiguration()
        }

        output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        output.alwaysDiscardsLateVideoFrames = true
        output.setSampleBufferDelegate(self, queue: frameQueue)
        guard session.canAddOutput(output) else { return }
        session.addOutput(output)

        // Frames arrive sideways from the sensor; turn them upright for a phone held normally.
        if let connection = output.connection(with: .video), connection.isVideoRotationAngleSupported(90) {
            connection.videoRotationAngle = 90
        }
    }
}

extension CameraService: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let frame = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        frameLock.lock()
        latestFrame = frame
        frameLock.unlock()
    }
}
