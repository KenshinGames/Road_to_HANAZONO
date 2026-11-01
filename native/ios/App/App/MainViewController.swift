import UIKit
import Capacitor

/// アプリの画面（Capacitor の WebView）。ゲーム向けの調整とセーブ保管庫の登録だけを足す。
/// ステータスバーとホームインジケータの非表示は Capacitor 標準の SystemBars（capacitor.config.json の plugins.SystemBars.hidden）で行う。
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(HanazonoStorePlugin())
    }

    /// 下端からのスワイプは2回目でホームに戻る（下端のボタンを押した時の誤操作を防ぐ）
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .bottom }
}
