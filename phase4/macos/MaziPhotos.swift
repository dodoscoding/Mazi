import SwiftUI
import Photos
import CryptoKit

extension PHAssetResource {
    var componentLabel: String {
        switch type {
        case .photo: return "Original photo"
        case .video: return "Original video"
        case .audio: return "Audio"
        case .alternatePhoto: return "Alternate photo"
        case .fullSizePhoto: return "Edited photo"
        case .fullSizeVideo: return "Edited video"
        case .adjustmentData: return "Edit instructions"
        case .adjustmentBasePhoto: return "Edit base photo"
        case .pairedVideo: return "Live Photo video"
        case .fullSizePairedVideo: return "Edited Live Photo video"
        default: return "Additional original resource"
        }
    }
    var maziFilename: String {
        #if compiler(>=6.4)
        if #available(macOS 27, *) { return filename ?? "resource-\(type.rawValue)" }
        #endif
        return originalFilename
    }
}

struct LibraryItem: Identifiable {
    let id: String
    let asset: PHAsset
    let resources: [PHAssetResource]
}

@MainActor final class PhotosModel: NSObject, ObservableObject, PHPhotoLibraryChangeObserver {
    @Published var items: [LibraryItem] = []
    @Published var albums: [(String, String)] = []
    @Published var selected: Set<String> = []
    @Published var album = ""
    @Published var kind = "all"
    @Published var from = Calendar.current.date(byAdding: .year, value: -10, to: Date())!
    @Published var through = Date()
    @Published var email = ""
    @Published var password = ""
    @Published var connection = ""
    @Published var status = "Sign in to your local Mazi archive, then allow Photos access."
    @Published var busy = false
    var task: Task<Void, Never>?
    var requestID: PHAssetResourceDataRequestID?
    var observing = false
    let session = URLSession(configuration: .ephemeral)
    let base = URL(string: "http://127.0.0.1:8002")!

    override init() {
        super.init()
        connection = UserDefaults.standard.string(forKey: "source") ?? ""
        selected = Set(UserDefaults.standard.stringArray(forKey: "selected") ?? [])
    }

    nonisolated func photoLibraryDidChange(_ changeInstance: PHChange) {
        Task { @MainActor in
            self.stop()
            self.status = "Photos changed. Review the refreshed selection before resuming. Completed resources stay in Mazi."
            self.reload()
            if !self.connection.isEmpty {
                let authorized = (try? self.permission()) != nil
                _ = try? await self.post("api/sources/state", ["id": self.connection, "enabled": false, "permission": authorized ? "authorized" : "revoked"])
            }
        }
    }

    func stop() {
        task?.cancel()
        if let id = requestID { PHAssetResourceManager.default().cancelDataRequest(id) }
        requestID = nil
    }

    func permission() throws {
        let state = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        guard state == .authorized || state == .limited else {
            throw NSError(domain: "Mazi", code: 1, userInfo: [NSLocalizedDescriptionKey: "Photos permission is unavailable. No new resources will be read."])
        }
    }

    func authorize() {
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { _ in
            Task { @MainActor in
                do {
                    try self.permission()
                    if !self.observing { PHPhotoLibrary.shared().register(self); self.observing = true }
                    self.reload(); self.status = "Select photos to transfer. Only selected resources leave this Mac." }
                catch { self.status = error.localizedDescription }
            }
        }
    }

    func reload() {
        do { try permission() } catch { items = []; status = error.localizedDescription; return }
        albums = []
        PHAssetCollection.fetchAssetCollections(with: .album, subtype: .any, options: nil).enumerateObjects { collection, _, _ in
            self.albums.append((collection.localIdentifier, collection.localizedTitle ?? "Untitled album"))
        }
        let options = PHFetchOptions()
        let end = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: through))!
        var predicates = [NSPredicate(format: "creationDate >= %@ AND creationDate < %@", Calendar.current.startOfDay(for: from) as NSDate, end as NSDate)]
        if kind != "all" { predicates.append(NSPredicate(format: "mediaType == %d", kind == "image" ? PHAssetMediaType.image.rawValue : PHAssetMediaType.video.rawValue)) }
        options.predicate = NSCompoundPredicate(andPredicateWithSubpredicates: predicates)
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
        // Bound the metadata inventory without fetching image bytes or iCloud originals.
        options.fetchLimit = 1000
        let result: PHFetchResult<PHAsset>
        if !album.isEmpty, let collection = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [album], options: nil).firstObject {
            result = PHAsset.fetchAssets(in: collection, options: options)
        } else { result = PHAsset.fetchAssets(with: options) }
        items = []
        result.enumerateObjects { asset, _, _ in
            self.items.append(LibraryItem(id: asset.localIdentifier, asset: asset, resources: PHAssetResource.assetResources(for: asset)))
        }
        selected.formIntersection(Set(items.map(\.id)))
    }

    func post(_ path: String, _ body: [String: Any]) async throws -> [String: Any] {
        var request = URLRequest(url: base.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await session.data(for: request)
        let value = (try JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode) else {
            throw NSError(domain: "Mazi", code: 2, userInfo: [NSLocalizedDescriptionKey: value["error"] as? String ?? "Mazi request failed"])
        }
        return value
    }

    func signIn() {
        task = Task {
            do { _ = try await post("api/login", ["email": email, "password": password]); password = ""; status = "Signed in. Allow Photos access to inspect your library." }
            catch { status = error.localizedDescription }
        }
    }

    func bytes(_ resource: PHAssetResource) async throws -> Data {
        try permission()
        let options = PHAssetResourceRequestOptions()
        options.isNetworkAccessAllowed = true
        options.progressHandler = { progress in Task { @MainActor in self.status = "Retrieving selected resource from Photos / iCloud: \(Int(progress * 100))%" } }
        return try await withCheckedThrowingContinuation { continuation in
            let buffer = ResourceBuffer()
            requestID = PHAssetResourceManager.default().requestData(for: resource, options: options, dataReceivedHandler: { data in
                buffer.append(data)
            }, completionHandler: { error in
                if let error { continuation.resume(throwing: error) }
                else if let data = buffer.result() { continuation.resume(returning: data) }
                else { continuation.resume(throwing: NSError(domain: "Mazi", code: 3, userInfo: [NSLocalizedDescriptionKey: "Resource exceeds the 25 MiB local limit; it was not uploaded."])) }
            })
        }
    }

    func transfer() {
        guard !busy else { return }
        UserDefaults.standard.set(connection, forKey: "source")
        UserDefaults.standard.set(Array(selected), forKey: "selected")
        let selection = items.filter { selected.contains($0.id) }
        let selectedAlbum = album
        busy = true
        task = Task {
            var outcomes: [String] = []
            defer { busy = false; requestID = nil }
            do {
                try permission()
                let state = PHPhotoLibrary.authorizationStatus(for: .readWrite) == .limited ? "limited" : "authorized"
                _ = try await post("api/sources/state", ["id": connection, "enabled": true, "permission": state])
                for item in selection {
                    for (index, resource) in item.resources.enumerated() {
                        try Task.checkCancellation(); try permission()
                        guard PHAsset.fetchAssets(withLocalIdentifiers: [item.id], options: nil).firstObject != nil else { throw CancellationError() }
                        status = "Reading \(resource.maziFilename) (component \(index + 1) of \(item.resources.count))"
                        do {
                            let data = try await bytes(resource)
                            try Task.checkCancellation(); try permission()
                            let hash = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
                            let formatter = DateFormatter(); formatter.dateFormat = "yyyy-MM-dd"; formatter.locale = Locale(identifier: "en_US_POSIX")
                            guard let created = item.asset.creationDate else { outcomes.append("\(resource.maziFilename): missing capture date; not uploaded"); continue }
                            // Every PhotoKit resource gets its own stable identity; changes create a new version.
                            let metadata: [String: Any] = ["item": item.id, "component": "\(resource.type.rawValue):\(resource.maziFilename)", "version": hash,
                                "filename": resource.maziFilename, "date": formatter.string(from: created), "capture_date": formatter.string(from: created),
                                "kind": item.asset.mediaType == .video ? "video" : "image", "albums": selectedAlbum.isEmpty ? [] : [selectedAlbum]]
                            let transfer = try await post("api/sources/begin", ["connection": connection, "metadata": metadata, "size": data.count, "sha256": hash])
                            guard let id = transfer["id"] as? String else { throw CancellationError() }
                            if transfer["state"] as? String == "UPLOADING" {
                                var offset = transfer["received"] as? Int ?? 0
                                while offset < data.count {
                                    try Task.checkCancellation(); try permission()
                                    guard PHAsset.fetchAssets(withLocalIdentifiers: [item.id], options: nil).firstObject != nil else { throw CancellationError() }
                                    let end = min(data.count, offset + 512 * 1024)
                                    _ = try await post("api/sources/chunk", ["id": id, "offset": offset, "data": data.subdata(in: offset..<end).base64EncodedString()])
                                    offset = end; status = "\(resource.maziFilename): \(offset) / \(data.count) bytes"
                                }
                            }
                            try Task.checkCancellation(); try permission()
                            _ = try await post("api/sources/finish", ["id": id])
                            outcomes.append("\(resource.maziFilename): transferred; see web outcomes for preview status")
                        } catch {
                            if Task.isCancelled { throw CancellationError() }
                            try permission()
                            outcomes.append("\(resource.maziFilename): \(error.localizedDescription)")
                        }
                    }
                }
                status = outcomes.isEmpty ? "No selected resources." : outcomes.joined(separator: "\n")
            } catch {
                status = "Transfer stopped: \(error.localizedDescription). Select Resume to reuse completed chunks."
                // A cancelled task cannot reliably make a network request; use a fresh task to fence the server.
                let authorized = (try? permission()) != nil
                Task { _ = try? await post("api/sources/state", ["id": connection, "enabled": false, "permission": authorized ? "authorized" : "revoked"]) }
            }
        }
    }
}

// PhotoKit callbacks may arrive off the main actor. Keep the bounded buffer synchronized.
final class ResourceBuffer: @unchecked Sendable {
    private let lock = NSLock()
    private var data = Data()
    private var oversized = false
    func append(_ chunk: Data) { lock.lock(); defer { lock.unlock() }; if data.count + chunk.count > 25 * 1024 * 1024 { oversized = true; data.removeAll(); }; if !oversized { data.append(chunk) } }
    func result() -> Data? { lock.lock(); defer { lock.unlock() }; return oversized ? nil : data }
}

@main struct MaziPhotosApp: App {
    @StateObject private var model = PhotosModel()
    var body: some Scene {
        WindowGroup("Mazi Photos") {
            VStack(alignment: .leading, spacing: 12) {
                Text("Choose what you bring along.").font(.largeTitle)
                Text("Foreground transfer to your local archive. Originals, edits and Live Photo components are kept separately.")
                HStack { TextField("Mazi email", text: $model.email); SecureField("Password", text: $model.password); Button("Sign in", action: model.signIn) }.disabled(model.busy)
                TextField("Apple source ID from Places & sources", text: $model.connection).disabled(model.busy)
                HStack { Button("Allow Photos access", action: model.authorize); Picker("Album", selection: $model.album) { Text("All albums").tag(""); ForEach(model.albums, id: \.0) { Text($0.1).tag($0.0) } }; Picker("Media", selection: $model.kind) { Text("Photos & videos").tag("all"); Text("Photos").tag("image"); Text("Videos").tag("video") } }.disabled(model.busy)
                HStack { DatePicker("From", selection: $model.from, displayedComponents: .date); DatePicker("Through", selection: $model.through, displayedComponents: .date); Button("Refresh selection", action: model.reload) }.disabled(model.busy)
                Text("Up to 1,000 metadata records. Narrow the date range for larger libraries. No image bytes are read until you transfer.").font(.caption)
                List(model.items) { item in
                    Toggle(isOn: Binding(get: { model.selected.contains(item.id) }, set: { if $0 { model.selected.insert(item.id) } else { model.selected.remove(item.id) } })) {
                        VStack(alignment: .leading) { Text(item.resources.first?.maziFilename ?? item.id); Text("\(item.resources.count) resources · " + item.resources.map { "\($0.componentLabel): \($0.maziFilename)" }.joined(separator: ", ")).font(.caption) }
                    }.disabled(model.busy)
                }
                HStack { Button("Transfer / Resume selected", action: model.transfer).disabled(model.busy || model.selected.isEmpty || model.connection.isEmpty); Button("Stop", action: model.stop).disabled(!model.busy) }
                ScrollView { Text(model.status).textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading) }.frame(height: 100)
            }.padding(24).frame(minWidth: 800, minHeight: 620)
        }
    }
}
