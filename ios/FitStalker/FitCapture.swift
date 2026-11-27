import AVFoundation
import PhotosUI
import SwiftUI
import UIKit

struct FitCapture: View {
    @Environment(\.dismiss) private var dismiss
    let api: FitAPI
    let garments: [FitAPI.Garment]
    let scanEnabled: Bool
    private let categories = ["tops", "bottoms", "outerwear", "shoes", "accessories", "dresses"]

    @State private var picked: PhotosPickerItem?
    @State private var camera = false
    @State private var image: UIImage?
    @State private var output: UIImage?
    @State private var outputURL: URL?
    @State private var uploaded: FitAPI.Photo?
    @State private var selectedGarments: [String] = []
    @State private var tryOn = false
    @State private var consent = false
    @State private var name = ""
    @State private var category = "tops"
    @State private var scan: FitAPI.Scan?
    @State private var selectedScanIndex: Int?
    @State private var progress = ""
    @State private var error = ""

    init(api: FitAPI, garments: [FitAPI.Garment], scanEnabled: Bool) {
        self.api = api
        self.garments = garments
        self.scanEnabled = scanEnabled
    }

    var body: some View {
        NavigationStack {
            Form {
                if !garments.isEmpty {
                    Picker("Action", selection: $tryOn) {
                        Text("Add item").tag(false)
                        Text("Try it on").tag(true)
                    }.pickerStyle(.segmented)
                }
                Section {
                    if let visible = output ?? image {
                        Image(uiImage: visible)
                            .resizable().scaledToFit().frame(maxHeight: 360)
                            .frame(maxWidth: .infinity)
                            .accessibilityLabel(output == nil ? "Selected photo" : "AI outfit preview")
                    }
                    if let outputURL {
                        ShareLink(item: outputURL) { Label("Share preview", systemImage: "square.and.arrow.up") }
                        Text("AI preview. Garment details and fit may vary.").font(.footnote)
                    }
                    if UIImagePickerController.isSourceTypeAvailable(.camera) {
                        Button("Take photo", systemImage: "camera") { Task { await openCamera() } }
                    }
                    PhotosPicker(selection: $picked, matching: .images) {
                        Label(image == nil ? "Choose photo" : "Choose another", systemImage: "photo")
                    }
                } footer: {
                    Text(tryOn ? "Choose a clear full-body photo." : "Photograph one closet piece in good light.")
                }
                if image != nil {
                    if tryOn {
                        Section("Closet pieces") {
                            ForEach(garments) { garment in
                                Button {
                                    if selectedGarments.contains(garment.id) { selectedGarments.removeAll { $0 == garment.id } }
                                    else if selectedGarments.count < 4 { selectedGarments.append(garment.id) }
                                } label: {
                                    Label(garment.name, systemImage: selectedGarments.contains(garment.id) ? "checkmark.circle.fill" : "circle")
                                }
                                .disabled(selectedGarments.count == 4 && !selectedGarments.contains(garment.id))
                            }
                        }
                        Section {
                            Toggle("Allow Google to process this photo and the selected pieces", isOn: $consent)
                            Button("Create preview") { run("Creating preview", render) }
                                .disabled(!consent || selectedGarments.isEmpty)
                        }
                    } else {
                        if scanEnabled {
                            Section("Identify clothing") {
                                Toggle("Allow Google to process this photo", isOn: $consent)
                                Button("Scan photo") { run("Scanning photo", identify) }.disabled(!consent)
                                if let scan {
                                    if scan.items.isEmpty { Text("No clothing identified. You can enter the details below.") }
                                    ForEach(scan.items.indices, id: \.self) { index in
                                        Button {
                                            selectedScanIndex = index
                                            name = scan.items[index].name
                                            category = scan.items[index].category
                                        } label: {
                                            Label(scan.items[index].name, systemImage: selectedScanIndex == index ? "checkmark.circle.fill" : "circle")
                                        }.disabled(scan.items[index].bounds == nil)
                                    }
                                }
                            }
                        }
                        Section("Save to closet") {
                            TextField("Item name", text: $name)
                            Picker("Category", selection: $category) {
                                ForEach(categories, id: \.self) { Text($0.capitalized).tag($0) }
                            }
                            Button("Save piece") { run("Saving piece", save) }
                                .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        }
                    }
                }
                if !progress.isEmpty { ProgressView(progress) }
                if !error.isEmpty { Text(error).foregroundStyle(.red) }
            }
            .disabled(!progress.isEmpty)
            .navigationTitle("Photo studio")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Done") { dismiss() }.disabled(!progress.isEmpty) }
            .interactiveDismissDisabled(!progress.isEmpty)
            .fullScreenCover(isPresented: $camera) { FitCamera { setPhoto($0) }.ignoresSafeArea() }
            .onChange(of: tryOn) {
                consent = false
                error = ""
                clearOutput()
            }
            .onChange(of: selectedGarments) { clearOutput() }
            .onChange(of: picked) {
                guard let picked else { return }
                run("Opening photo") {
                    defer { self.picked = nil }
                    guard let data = try await picked.loadTransferable(type: Data.self), let photo = UIImage(data: data) else {
                        throw FitAPI.ServiceError(text: "That photo couldn’t be opened.")
                    }
                    setPhoto(photo)
                }
            }
            .onDisappear { clearOutput() }
        }
    }

    private func clearOutput() {
        if let outputURL { try? FileManager.default.removeItem(at: outputURL) }
        outputURL = nil
        output = nil
    }

    private func setPhoto(_ photo: UIImage) {
        image = photo
        uploaded = nil
        clearOutput()
        scan = nil
        selectedScanIndex = nil
        name = ""
        consent = false
        error = ""
    }

    private func openCamera() async {
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        let granted = status == .notDetermined ? await AVCaptureDevice.requestAccess(for: .video) : status == .authorized
        if granted { camera = true }
        else { error = "Camera access is off. Choose a photo or allow Camera in Settings." }
    }

    private func run(_ message: String, _ action: @escaping () async throws -> Void) {
        guard progress.isEmpty else { return }
        error = ""
        progress = message
        Task {
            defer { progress = "" }
            do { try await action() }
            catch { self.error = error.localizedDescription }
        }
    }

    private func source() async throws -> FitAPI.Photo {
        if let uploaded { return uploaded }
        guard let image, image.size.width > 0, image.size.height > 0 else {
            throw FitAPI.ServiceError(text: "Choose a photo first.")
        }
        let ratio = min(1, 1400 / max(image.size.width, image.size.height))
        let size = CGSize(width: max(1, image.size.width * ratio), height: max(1, image.size.height * ratio))
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let resized = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        guard let jpeg = resized.jpegData(compressionQuality: 0.83) else {
            throw FitAPI.ServiceError(text: "That photo couldn’t be prepared.")
        }
        let photo = try await api.upload(jpeg)
        uploaded = photo
        return photo
    }

    private func identify() async throws {
        scan = try await api.scan(source())
        selectedScanIndex = nil
    }

    private func save() async throws {
        let color = selectedScanIndex.flatMap { scan?.items[$0].color } ?? "#777777"
        try await api.save(name: String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100)),
                           category: category, color: color, photo: source(), scan: scan, index: selectedScanIndex)
        dismiss()
    }

    private func render() async throws {
        let result = try await api.tryOn(source(), garments: selectedGarments)
        let data = try await api.image(result.imageUrl)
        guard let preview = UIImage(data: data), let jpeg = preview.jpegData(compressionQuality: 0.92) else {
            throw FitAPI.ServiceError(text: "The preview could not be opened.")
        }
        clearOutput()
        let file = FileManager.default.temporaryDirectory.appending(path: "FitStalker-\(UUID().uuidString).jpg")
        try jpeg.write(to: file, options: [.atomic, .completeFileProtection])
        output = preview
        outputURL = file
    }
}

private struct FitCamera: UIViewControllerRepresentable {
    @Environment(\.dismiss) private var dismiss
    let onPhoto: (UIImage) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ picker: UIImagePickerController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: FitCamera
        init(_ parent: FitCamera) { self.parent = parent }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.dismiss() }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let photo = info[.originalImage] as? UIImage { parent.onPhoto(photo) }
            parent.dismiss()
        }
    }
}
