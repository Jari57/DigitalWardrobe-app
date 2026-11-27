import SwiftUI
import UIKit

@main
struct FitStalkerApp: App {
    var body: some Scene { WindowGroup { FitHome().tint(Color(red: 0.36, green: 0.20, blue: 0.48)) } }
}

struct FitHome: View {
    let api = FitAPI()
    @State private var user: FitAPI.User?
    @State private var ready = false
    @State private var garments: [FitAPI.Garment] = []
    @State private var capture = false
    @State private var account = false
    @State private var tryOn = false
    @State private var scanEnabled = false
    @State private var removing: FitAPI.Garment?
    @State private var error = ""

    var body: some View {
        NavigationStack {
            Group {
                if !ready {
                    ProgressView("Opening FitStalker")
                } else if user == nil {
                    FitLogin(api: api) { user = $0 }
                } else {
                    VStack(spacing: 0) {
                        if !error.isEmpty { Text(error).font(.footnote).padding() }
                        if garments.isEmpty {
                            ContentUnavailableView("Your closet starts here", systemImage: "hanger", description: Text("Photograph one item to add your first piece."))
                        } else {
                            List(garments) { garment in
                                HStack(spacing: 14) {
                                    FitThumbnail(api: api, path: garment.imageUrl)
                                    VStack(alignment: .leading) {
                                        Text(garment.name).font(.headline)
                                        Text(garment.category.capitalized).font(.footnote).foregroundStyle(.secondary)
                                    }
                                }
                                .swipeActions(allowsFullSwipe: false) {
                                    Button("Remove", role: .destructive) { removing = garment }
                                }
                            }
                            .listStyle(.plain)
                            .refreshable { await loadCloset() }
                        }
                        Button("Add a piece", systemImage: "camera") { capture = true }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.large)
                            .padding()
                    }
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Account", systemImage: "person.crop.circle") { account = true }
                        }
                    }
                }
            }
            .navigationTitle(user == nil ? "FitStalker" : "My Closet")
            .task {
                user = try? await api.account().user
                ready = true
            }
            .task(id: user?.username) { await loadCloset() }
            .confirmationDialog("Remove this closet piece?", isPresented: Binding(
                get: { removing != nil },
                set: { if !$0 { removing = nil } }
            ), presenting: removing) { garment in
                Button("Remove \(garment.name)", role: .destructive) {
                    Task {
                        do { try await api.remove(garment); await loadCloset() }
                        catch { self.error = error.localizedDescription }
                    }
                }
            }
            .sheet(isPresented: $capture, onDismiss: { Task { await loadCloset() } }) {
                FitCapture(api: api, garments: tryOn ? garments : [], scanEnabled: scanEnabled)
            }
            .sheet(isPresented: $account) {
                FitAccount(api: api, username: user?.username ?? "") {
                    user = nil
                    garments = []
                    tryOn = false
                    scanEnabled = false
                    account = false
                }
            }
        }
    }

    private func loadCloset() async {
        guard let username = user?.username else { return }
        do {
            async let closet = api.closet()
            async let tryOnCapability = api.enabled("/api/try-on")
            async let scanCapability = api.enabled("/api/discovery")
            let (loaded, enabled, canScan) = try await (closet, tryOnCapability, scanCapability)
            guard user?.username == username else { return }
            garments = loaded.garments
            tryOn = enabled
            scanEnabled = canScan
            error = ""
        } catch is CancellationError {
            return
        } catch {
            guard user?.username == username else { return }
            self.error = error.localizedDescription
        }
    }
}

private struct FitThumbnail: View {
    let api: FitAPI
    let path: String
    @State private var image: UIImage?
    var body: some View {
        Group {
            if let image { Image(uiImage: image).resizable().scaledToFit() }
            else { Image(systemName: "hanger").foregroundStyle(.secondary) }
        }
        .frame(width: 60, height: 68)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
        .accessibilityHidden(true)
        .task(id: path) {
            image = nil
            if let data = try? await api.image(path) { image = UIImage(data: data) }
        }
    }
}

private struct FitLogin: View {
    let api: FitAPI
    let onLogin: (FitAPI.User) -> Void
    @State private var action = "signin"
    @State private var username = ""
    @State private var password = ""
    @State private var recovery = ""
    @State private var result: FitAPI.Account?
    @State private var busy = false
    @State private var error = ""

    var body: some View {
        Form {
            if let result, let user = result.user, let code = result.recoveryCode {
                Section("Save your recovery code") {
                    Text("Keep this code somewhere safe. You’ll need it if you forget your password.")
                    Text(code).font(.system(.body, design: .monospaced)).textSelection(.enabled)
                    Button("Continue to closet") { onLogin(user) }
                }
            } else {
                Section {
                    TextField("Username", text: $username)
                        .textContentType(.username).textInputAutocapitalization(.never).autocorrectionDisabled()
                    if action == "recover" {
                        TextField("Recovery code", text: $recovery).textInputAutocapitalization(.never).autocorrectionDisabled()
                    }
                    SecureField(action == "signin" ? "Password" : "New password (12+ characters)", text: $password)
                        .textContentType(action == "signin" ? .password : .newPassword)
                    Button(action == "signup" ? "Create account" : action == "recover" ? "Reset password" : "Sign in") {
                        Task { await submit() }
                    }
                    .disabled(busy || username.isEmpty || password.isEmpty || (action == "recover" && recovery.isEmpty))
                    if busy { ProgressView() }
                    if !error.isEmpty { Text(error).foregroundStyle(.red) }
                }
                Section {
                    if action != "signin" { Button("Back to sign in") { changeMode("signin") } }
                    if action == "signin" {
                        Button("Create an account") { changeMode("signup") }
                        Button("Forgot password?") { changeMode("recover") }
                    }
                    Link("Privacy policy", destination: FitAPI.site.appending(path: "privacy"))
                }
            }
        }
    }

    private func changeMode(_ mode: String) {
        action = mode
        password = ""
        recovery = ""
        error = ""
    }

    private func submit() async {
        busy = true
        error = ""
        defer { busy = false }
        do {
            let reply = try await api.authenticate(action: action, username: username, password: password, recoveryCode: recovery)
            guard let user = reply.user else { return }
            password = ""
            if reply.recoveryCode == nil { onLogin(user) }
            else { result = reply }
        } catch { self.error = error.localizedDescription }
    }
}

private struct FitAccount: View {
    @Environment(\.dismiss) private var dismiss
    let api: FitAPI
    let username: String
    let onSignOut: () -> Void
    @State private var password = ""
    @State private var deleting = false
    @State private var busy = false
    @State private var error = ""

    var body: some View {
        NavigationStack {
            Form {
                Section { Text(username) }
                Section {
                    Link("Privacy policy", destination: FitAPI.site.appending(path: "privacy"))
                    Link("Terms", destination: FitAPI.site.appending(path: "terms"))
                    Link("Contact support", destination: URL(string: "mailto:support@fitstalker.com")!)
                }
                Section {
                    Button("Sign out") { Task { await perform { try await api.signOut() } } }
                    if !deleting {
                        Button("Delete account", role: .destructive) { deleting = true }
                    } else {
                        Text("Permanently delete your closet, photos, and account.")
                        SecureField("Confirm your password", text: $password).textContentType(.password)
                        Button("Permanently delete account", role: .destructive) {
                            Task { await perform { try await api.deleteAccount(password: password) } }
                        }
                        .disabled(password.isEmpty)
                        Button("Cancel deletion") { deleting = false; password = "" }
                    }
                    if busy { ProgressView() }
                    if !error.isEmpty { Text(error).foregroundStyle(.red) }
                }
                .disabled(busy)
            }
            .navigationTitle("Account")
            .toolbar { Button("Done") { dismiss() }.disabled(busy) }
        }
    }

    private func perform(_ action: () async throws -> Void) async {
        busy = true
        error = ""
        defer { busy = false }
        do { try await action(); onSignOut() }
        catch { self.error = error.localizedDescription }
    }
}
