# review_v28 — v0.28（v1.3）「iOS 移植の着手・セーブの引き継ぎコード・iPhone 実寸のレイアウト」監査・確認記録

作成：2026-10-30（Claude Code）。発端は Takada の指示「iOS移植しましょ！」。
作者の決定3点：Mac と Apple Developer 登録は用意済み／音はマナーモードに従う／Web 版のセーブを iOS 版へ持っていけるようにする。

## 変更点

1. **iOS 版の土台（native/）**：Capacitor 8.6（Swift Package Manager）。ゲーム本体は v02 の game.js・style.css をそのまま使い、
   `scripts/build-www.mjs` が iOS 用 index.html を組み立てる。Xcode 内の public もコミット（Mac で Node なしにビルドできる）。
   横画面のみ・iPhone 専用・全画面・日本語・ステータスバー／ホームインジケータ非表示（SystemBars）・下端スワイプは2回目で反応・
   長押しで文字選択しない・音は .ambient（消音スイッチに従う）。
2. **セーブの二重化**：localStorage の hanazono.* を Application Support の hanazono-save.json に写す自前プラグイン（HanazonoStore）と
   起動処理（native-boot.js）。localStorage が空なら控えから書き戻して起動。正は localStorage。キー名・値は不変。
3. **引き継ぎコード（Web・iOS 共通）**：設定 → 📦 引き継ぎ。3スロット分を `HANAZONO1:` ＋ base64 ＋ FNV-1a 検査値の1行に。
   検査を通ったものだけ、中身を見せて2段階の確認で置き換える。端末ごとの設定は運ばない。乱数は使わない。
4. **iPhone 実寸のレイアウト**：CSS 幅 760〜960px の横画面（ノッチのある iPhone の横向き）だけ、ホームインジケータ分の余白・
   HUD（校名と音ボタンの文字を隠す）・活動カード・指示のボタン列・セレクト・タイトル・キーマン対比を詰め、月頭指示の操作カラムを広げた。
5. **バージョン表記 v1.3**。ゲームの数値・判定・乱数消費・セーブ形式・localStorage キーは不変。

## 監査で見つけたこと（iPhone の実寸）

- 最初の Actions 実行（iPhone 17 Pro シミュレータ、874×402）で、タイトルの見出しが画面の上に押し出されていた。
  原因は (a) 874×402 が「縦 400px 以下」の詰め方の境をわずかに超えること、(b) ホームインジケータ分の下余白（21px）。
- さらに、従来の監査寸法 932×430／932×380 は**ノッチなし・全幅**の想定で、932×430 は実は Pro Max の寸法だった。
  作者の実機 iPhone 15 Pro は 852×393 で、アプリでも Safari でも左右 59px・下 21px のセーフエリアが引かれ、中身の幅は約 710px
  （932 監査は 904px）。この差で HUD のはみ出し、週次の上段の見切れ、活動カードと情報欄の重なり、セレクトの切れが出ていた。
- そこで `shoot.js` に **IOS=1**（iPhone アプリの実寸の模擬）を追加：play.html の `env(safe-area-inset-*)` を機種ごとの固定値に
  置き換えたコピーを、横画面の CSS 寸法で開いて同じ33画面を監査する（Chromium は env() の値を外から与えられないため）。
  | タグ | 寸法 | セーフエリア（左右／下） | 機種 |
  |---|---|---|---|
  | _ip15p | 852×393 | 59／21 | iPhone 15 Pro（作者の実機）・15・16 |
  | _ipmini | 812×375 | 50／21 | iPhone 12/13 mini（ノッチ機で最小） |
  | _ip17p | 874×402 | 62／20 | iPhone 16 Pro・17 Pro |
  | _ippm | 932×430 | 59／21 | iPhone 14/15 Pro Max・Plus |
  | _ip17pm | 956×440 | 62／20 | iPhone 16/17 Pro Max |
- 調整前：IOS=1 で約50画面に問題（HUD 46件・見切れ 26件・選手一覧と活動カードの重なり・セレクトの切れ 8件など）。
  調整後：**5機種×33画面＝165画面で3点ゼロ**。

## QA

- 新規 `test/qa_v28.js`（57項目）：引き継ぎの往復一致（2スロット入りの端末 → 別の端末）、検査（空欄・別の文字列・途中で切れた・
  書き換わった・セーブなし）、2段階の確認と「やめる」、端末ごとの設定を運ばないこと、乱数を使わないこと、セーブの無い端末では
  書き出さないこと。iOS の殻（public と v02 の同期、Info.plist、Swift の登録、SystemBars、.ambient）。native-boot.js を偽の
  ネイティブ橋で検証（書き戻し・写し・上書きしない・Web では素通り・応答なしでも起動し控えを書かない）。iPhone 帯の CSS。
- 旧 QA の追随：バージョン期待値 v1.3 のみ（qa_v10〜v18・v22〜v27、各行に理由コメント）。
- 回帰：`regression.log`（qa_proto〜qa_v28 の28本）すべてパス。
- **ソーク同値性**：`soak_v19_ab.js 2 20` の出力 `soak_v28_2x20.log` は v1.1 の公式ログ（review_v26/soak_v26_20y.log）の
  先頭2キャリアと行単位で完全一致。

## 実ブラウザ監査（`shoot.js`）

- **ライト：69画面（従来61＋引き継ぎ4種×2寸法）で3点ゼロ、コンソールエラー0**（`report.json`）。
- **ダーク：同じ69画面で3点ゼロ、エラー0**（`report_dark.json`。初回は screenshots_dark が無く中断したため作成して再実行。run_all.sh で作るよう修正）。
- **iPhone 実寸（IOS=1）：5機種×33画面＝165画面で3点ゼロ、エラー0**（`report_ios.json`）。タイトル見出しの上端は
  15 Pro 26px／mini 19px／17 Pro 27px／Pro Max 54px／17 Pro Max 65px（合格の目安 8px 以上）。
- 枠の入れ子（.card の中の .card）は全画面で0件。長文段落の残存は従来どおりガイドと寸評のみ。

## GitHub Actions（macOS、Xcode 26.6）

- `.github/workflows/ios-build.yml`：署名なしでシミュレータ向けにビルド → シミュレータ（iPhone 15 Pro・17 Pro）でアプリを起動 →
  ①新規起動でタイトルが出て控えファイルが書かれること、②アプリを入れ直して控えファイルだけ置くと localStorage に書き戻され
  3年目のセーブで再開すること、を確認。スクリーンショットは成果物と、縮小版をログ（base64）にも出す。
- 初回の実行で Capacitor 8 の制約（prefersHomeIndicatorAutoHidden をサブクラスで上書きできない）を検出し、SystemBars 設定に切り替えた。
- 調整後の実行で、iPhone 15 Pro・17 Pro とも、タイトルの見出しが画面内に収まり、HUD が1行に収まることを実機相当の WebKit・フォントで確認。

## 未対応（今回の範囲外）

- iPhone SE 系（667×375）は固定レイアウトの帯（横 760px 以上）の外で、ページ全体のスクロール表示になる。iPad は iPhone アプリとして動く。
- 正式アイコン・ストア素材・プライバシーポリシー・IAP（docs/IOS.md §7）。
- 実機での最終確認（docs/IOS.md §8 のチェックリスト）。
