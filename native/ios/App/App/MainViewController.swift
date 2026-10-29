import UIKit
import Capacitor

/// アプリの画面（Capacitor の WebView）。ゲーム向けの調整とセーブ保管庫の登録だけを足す。
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(HanazonoStorePlugin())
    }

    /// 画面下のホームインジケータを目立たせない（下端に操作ボタンが並ぶため）
    override var prefersHomeIndicatorAutoHidden: Bool { true }

    /// 下端からのスワイプは2回目でホームに戻る（下端のボタンを押した時の誤操作を防ぐ）
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .bottom }
}
