import Photos
import UIKit

/// The newest picture in the phone's Photos, usually the screenshot someone just took of whatever
/// confuses them. Moffy can look at it instead of through the camera.
@MainActor
final class LatestPhoto: ObservableObject {
    /// A small square of the newest picture, for the shortcut button. Nil until Photos access is given.
    @Published private(set) var thumbnail: UIImage?
    @Published private(set) var status = PHPhotoLibrary.authorizationStatus(for: .readWrite)

    var canRead: Bool { status == .authorized || status == .limited }
    /// The person said no; only the iPhone's Settings can change that now.
    var isDenied: Bool { status == .denied || status == .restricted }

    func refreshThumbnail() async {
        status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        guard canRead, let asset = Self.newestAsset() else {
            thumbnail = nil
            return
        }
        thumbnail = await Self.image(of: asset, size: CGSize(width: 180, height: 180), mode: .aspectFill)
    }

    /// The newest picture, asking for Photos access the first time.
    func newest() async -> (image: UIImage, date: Date?)? {
        if status == .notDetermined {
            status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
        }
        guard canRead, let asset = Self.newestAsset(),
              let image = await Self.image(of: asset, size: CGSize(width: 2048, height: 2048), mode: .aspectFit)
        else { return nil }
        Task { await refreshThumbnail() }
        return (image, asset.creationDate)
    }

    private static func newestAsset() -> PHAsset? {
        let options = PHFetchOptions()
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        options.fetchLimit = 1
        return PHAsset.fetchAssets(with: .image, options: options).firstObject
    }

    private static func image(of asset: PHAsset, size: CGSize, mode: PHImageContentMode) async -> UIImage? {
        let options = PHImageRequestOptions()
        options.deliveryMode = .highQualityFormat // one answer, not a blurry one first
        options.resizeMode = .fast
        options.isNetworkAccessAllowed = true // the picture may be in iCloud
        return await withCheckedContinuation { continuation in
            let answer = Once()
            PHImageManager.default().requestImage(for: asset, targetSize: size, contentMode: mode, options: options) { image, info in
                if (info?[PHImageResultIsDegradedKey] as? Bool) == true || answer.done { return }
                answer.done = true
                continuation.resume(returning: image)
            }
        }
    }

    /// Photos can call back more than once; the answer is given only once.
    private final class Once: @unchecked Sendable {
        var done = false
    }
}
