import Foundation
import Capacitor

/// セーブの控え（二重化）。Web 側の native-boot.js が localStorage の hanazono.* を丸ごと渡してくるので、
/// Application Support の JSON ファイル1つに原子的に書く（端末・iCloud バックアップの対象）。
/// 起動時に localStorage が消えていた場合だけ、Web 側がここから書き戻す。正はあくまで localStorage。
@objc(HanazonoStorePlugin)
public class HanazonoStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HanazonoStorePlugin"
    public let jsName = "HanazonoStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "load", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise)
    ]

    private let queue = DispatchQueue(label: "hanazono.store")

    private var fileURL: URL? {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
            .appendingPathComponent("hanazono-save.json")
    }

    @objc func load(_ call: CAPPluginCall) {
        queue.async {
            var data = [String: String]()
            if let url = self.fileURL,
               let raw = try? Data(contentsOf: url),
               let obj = try? JSONSerialization.jsonObject(with: raw) as? [String: String] {
                data = obj
            }
            call.resolve(["data": data])
        }
    }

    @objc func save(_ call: CAPPluginCall) {
        guard let obj = call.getObject("data") else {
            call.reject("data がありません")
            return
        }
        var data = [String: String]()
        for (key, value) in obj {
            if let text = value as? String { data[key] = text }
        }
        queue.async {
            do {
                guard let url = self.fileURL else { throw CocoaError(.fileNoSuchFile) }
                try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
                let raw = try JSONSerialization.data(withJSONObject: data)
                try raw.write(to: url, options: .atomic)
                call.resolve()
            } catch {
                call.reject("セーブの控えを書けませんでした: \(error.localizedDescription)")
            }
        }
    }
}
