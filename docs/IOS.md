# iOS 版の作り方・配り方（Road to HANAZONO）

作成：2026-10-30（Claude Code）。読み手：Kenshin Takada（Mac で Xcode を操作する人）と、次に引き継ぐセッション。

---

## 1. しくみ（1分で）

- iOS 版は **Capacitor 8** という「WebView の殻」で、中身は Web 版と同じ `v02/game.js`・`v02/style.css` です。
  ゲームを直すときは今までどおり `v02/` を直せば、iOS 版にも同じ変更が入ります。
- 殻は `native/` にあります。Xcode プロジェクトは `native/ios/App/App.xcodeproj`。
- iOS だけに足しているもの：
  | 何を | どこで |
  |---|---|
  | 横画面のみ・iPhone 専用・全画面・ステータスバー非表示・日本語 | `native/ios/App/App/Info.plist`、プロジェクト設定 |
  | 音はマナーモード（消音スイッチ）に従う・他アプリの音楽と混ざる | `AppDelegate.swift`（.ambient）＋ `native/web/native-boot.js` |
  | セーブの二重化（下の §5） | `HanazonoStorePlugin.swift` ＋ `native-boot.js` |
  | 下端に並ぶボタンを押した時にホームへ戻ってしまう誤操作を防ぐ（下端スワイプは2回目で反応） | `MainViewController.swift` |
  | 長押しで文字が選択されない（引き継ぎコードの欄は除く） | `native/web/native.css` |
- GitHub の「Actions → iOS build」が、`native/`・`v02/` を変えて push するたびに Mac 上で自動ビルドし、
  シミュレータで起動してスクリーンショットを撮ります（成果物 `ios-simulator` に入っています）。

## 2. Mac で自分の iPhone に入れる（初回）

1. リポジトリを Mac に clone（または pull）して **main** を開く。
2. 最新の Xcode で `native/ios/App/App.xcodeproj` を開く。
   初回は Swift パッケージ（Capacitor 本体）の取得が自動で始まるので、左下の進捗が終わるまで1〜2分待つ。
   **Node.js や npm は不要**（ゲームの中身は `native/ios/App/App/public/` にコミット済み）。
3. 左の一覧で一番上の「App」→ TARGETS の「App」→ **Signing & Capabilities** タブ。
   - **Team** に自分の Apple Developer のチームを選ぶ。
   - Bundle Identifier は `com.kenshingames.hanazono`。**App Store Connect に登録すると以後は変えられない**ので、
     別の ID にしたい場合はこの時点で変える（変えたら `native/capacitor.config.json` の appId も同じ値に）。
4. iPhone をケーブルでつなぐ。初回だけ iPhone の「設定 → プライバシーとセキュリティ → デベロッパモード」を ON（再起動あり）。
5. Xcode 上部の実行先で自分の iPhone を選び、▶（Run）。ホーム画面に「HANAZONO」が入って起動します。

## 3. TestFlight で配る（自分の iPhone に普段使いで入れる・人に配る）

1. https://appstoreconnect.apple.com → 「アプリ」→ ＋ →「新規 App」
   - プラットフォーム iOS／名前（App Store 上で他と重複できない。例：Road to HANAZONO）／主言語 日本語／
     バンドル ID `com.kenshingames.hanazono`／SKU は任意（例 hanazono）。
2. Xcode の実行先を「Any iOS Device (arm64)」にして、メニュー **Product → Archive**。
3. 終わると Organizer が開くので **Distribute App → App Store Connect → Upload**（あとは既定のまま）。
4. App Store Connect の **TestFlight** タブで処理完了（10〜30分）を待ち、内部テスターに自分を追加。
   iPhone の TestFlight アプリから入れられます。
- 2回目以降のアップロードは、TARGETS「App」→ General の **Build** を 1 つ増やす（同じ番号は受け付けられない）。
- 暗号化（輸出規制）の質問は Info.plist で「使っていない」と申告済みなので出ません。

## 4. Web 版のセーブを iOS 版へ移す（引き継ぎコード、v1.3）

1. Web 版（Pages）で **⚙ 設定 → 📦 引き継ぎ → 📋 コードをコピー**。
2. 同じ iPhone ならそのまま、別の端末ならメモ・メール・AirDrop で送る。
   （コードは数万文字になるので、LINE のメッセージには入りきりません）
3. iOS 版で **⚙ 設定 → 📦 引き継ぎ** → 右の欄に貼り付け → 中身（各スロットの年・月・部の格）を確認 →
   **📥 読み込む → 本当に置き換える**。
- 3スロット分がまとめて移ります。音・BGM・時短の設定は端末ごとのものなので移りません。
- 逆向き（iOS → Web）や機種変更にも同じ手順が使えます。

## 5. セーブの扱い（変えてはいけないこと）

- ゲームは Web 版と同じく localStorage（キー `hanazono.*`）に保存します。iOS 版ではそれを丸ごと、
  アプリの Application Support にある `hanazono-save.json` にも写しています（端末バックアップ・iCloud バックアップの対象）。
- WebKit が容量逼迫などで localStorage を消した場合、次の起動時に `hanazono-save.json` から書き戻してから始まります。
  localStorage にデータがある時は控えで上書きしません（正は localStorage）。
- **変えてはいけないもの**：
  - Bundle ID（変えると別アプリ扱いになり、セーブも控えも引き継がれない）
  - `capacitor.config.json` の `server.hostname`／`server.iosScheme`（未設定＝既定の `capacitor://localhost`。
    変えると localStorage の置き場所が変わる）
  - localStorage のキー名（HANDOVER §5 のとおり）

## 6. ゲームを直した後に iOS 版へ反映する

```bash
cd native
npm install        # 初回だけ
npm run sync       # v02 から www を組み立てて、Xcode の public へ写す
```

- `npm run sync` を忘れると、iOS 版だけ古い中身のままになります。
  `test/qa_v28.js` と Actions の「Web assets in the Xcode project match v02」が同期漏れを検出します。
- `v02/play.html`（Web の単一ファイル版）は iOS 版では使いません（`build_play.py` は Web 用）。

## 7. App Store に出すまでに残っていること

| # | 項目 | 内容 |
|---|---|---|
| 1 | 正式アイコン | いまは暫定（タイトルの夕景の切り出し、ロゴなし）。1024×1024・透過なしの PNG を `Assets.xcassets/AppIcon` に入れる。Gilbert のロゴが写る `icon-256.png` 系は使わない（商標） |
| 2 | スクリーンショット | 6.9 インチ（iPhone の Pro Max 系）横向きを最低1枚。シミュレータで撮れる |
| 3 | プライバシーポリシー URL | データを集めないアプリでも必須。GitHub Pages に1ページ置けば足りる |
| 4 | App のプライバシー | 「データを収集しない」と申告（通信・解析・広告なし） |
| 5 | 年齢レーティング | 質問票に答える（暴力・ギャンブル等なし） |
| 6 | 説明文・キーワード・サポート URL・価格（無料） | App Store Connect で入力 |
| 7 | IAP（追加要素のみ・ガチャなし） | DESIGN.md の v1.0 定義に含まれる。最初は無料で出して後から足すか、揃えてから出すかは作者の判断 |

## 8. 実機で確かめてほしいこと（チェックリスト）

- [ ] 起動してタイトルが出る（左右どちら向きの横画面でも、ノッチ／Dynamic Island 側に文字が隠れない）
- [ ] マナーモード ON で無音、OFF で BGM・効果音が鳴る。他のアプリで音楽を流したままでも止まらない
- [ ] ホームに戻って戻ると BGM が再開する
- [ ] 画面下端のボタンを押しても、うっかりホームに戻らない
- [ ] 長押しで文字が選択されない
- [ ] 引き継ぎ：Web 版のコードを貼って読み込める
- [ ] アプリを消さずに新しいビルドを入れ直しても、セーブが残っている
