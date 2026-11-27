import Foundation

struct FitAPI {
    static let site = URL(string: "https://fitstalker.com")!
    private let session = URLSession.shared

    struct User: Decodable { let username: String }
    struct Account: Decodable { let user: User?; let recoveryCode: String? }
    struct Garment: Decodable, Identifiable {
        let id: String
        let name: String
        let category: String
        let imageUrl: String
    }
    struct Closet: Decodable { let garments: [Garment] }
    struct Photo: Decodable {
        let imageUrl: String
        var id: String { String(imageUrl.split(separator: "/").last ?? "") }
    }
    struct Piece: Decodable {
        struct Bounds: Decodable { let left, top, right, bottom: Double }
        let name, category, color: String
        let bounds: Bounds?
    }
    struct Scan: Decodable { let id: String; let items: [Piece] }
    struct Capability: Decodable { let enabled: Bool }
    struct ServiceError: LocalizedError {
        let text: String
        var errorDescription: String? { text }
    }

    private func response(_ path: String, method: String = "GET", body: Data? = nil, type: String? = nil) async throws -> Data {
        var request = URLRequest(url: URL(string: path, relativeTo: Self.site)!)
        request.httpMethod = method
        request.timeoutInterval = 100
        request.cachePolicy = .reloadIgnoringLocalCacheData
        if method != "GET" { request.setValue(Self.site.absoluteString, forHTTPHeaderField: "Origin") }
        if let body {
            request.setValue(type ?? "application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = body
        }
        let (data, response) = try await session.data(for: request)
        guard let result = response as? HTTPURLResponse, (200..<300).contains(result.statusCode) else {
            struct Failure: Decodable { let error: String }
            let error = try? JSONDecoder().decode(Failure.self, from: data)
            throw ServiceError(text: error?.error ?? "FitStalker couldn’t finish. Try again.")
        }
        return data
    }

    private func json<T: Decodable>(_ path: String, method: String = "GET", input: [String: Any]? = nil) async throws -> T {
        let body = try input.map { try JSONSerialization.data(withJSONObject: $0) }
        return try JSONDecoder().decode(T.self, from: await response(path, method: method, body: body))
    }

    func account() async throws -> Account { try await json("/api/session") }
    func authenticate(action: String, username: String, password: String, recoveryCode: String = "") async throws -> Account {
        var input = ["action": action, "username": username, "password": password]
        if action == "recover" { input["recoveryCode"] = recoveryCode }
        return try await json("/api/auth", method: "POST", input: input)
    }
    func signOut() async throws {
        _ = try await response("/api/auth", method: "POST", body: Data("{\"action\":\"signout\"}".utf8))
    }
    func deleteAccount(password: String) async throws {
        let body = try JSONSerialization.data(withJSONObject: ["password": password])
        _ = try await response("/api/account", method: "DELETE", body: body)
    }
    func closet() async throws -> Closet { try await json("/api/wardrobe") }
    func remove(_ garment: Garment) async throws {
        _ = try await response("/api/garments/\(garment.id)", method: "DELETE")
    }
    func image(_ path: String) async throws -> Data {
        guard path.range(of: #"^/api/images/[a-zA-Z0-9_-]{1,80}$"#, options: .regularExpression) != nil else {
            throw ServiceError(text: "This image is unavailable.")
        }
        return try await response(path)
    }
    func upload(_ jpeg: Data) async throws -> Photo {
        let boundary = UUID().uuidString
        var body = Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"file\"; filename=\"fit.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".utf8)
        body.append(jpeg)
        body.append(Data("\r\n--\(boundary)--\r\n".utf8))
        let result = try await response("/api/uploads", method: "POST", body: body, type: "multipart/form-data; boundary=\(boundary)")
        return try JSONDecoder().decode(Photo.self, from: result)
    }
    func scan(_ upload: Photo) async throws -> Scan {
        try await json("/api/discovery", method: "POST", input: ["agent": "detect", "imageId": upload.id])
    }
    func save(name: String, category: String, color: String, photo: Photo, scan: Scan? = nil, index: Int? = nil) async throws {
        var input: [String: Any] = ["name": name, "category": category, "color": color]
        if let scan, let index {
            input["scan"] = ["id": scan.id, "itemIndex": index] as [String: Any]
        } else {
            input["imageUrl"] = photo.imageUrl
        }
        let body = try JSONSerialization.data(withJSONObject: input)
        _ = try await response("/api/garments", method: "POST", body: body)
    }
    func enabled(_ path: String) async -> Bool {
        let result: Capability? = try? await json(path)
        return result?.enabled ?? false
    }
    func tryOn(_ photo: Photo, garments: [String]) async throws -> Photo {
        try await json("/api/try-on", method: "POST", input: [
            "agent": "try-on", "photoUrl": photo.imageUrl, "garmentIds": garments, "consent": true,
        ])
    }
}
