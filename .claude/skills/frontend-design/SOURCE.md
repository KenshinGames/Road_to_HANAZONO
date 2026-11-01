# このフォルダについて

- 中身は Anthropic 公式の `frontend-design` スキル（プラグイン版 1.1.1）を、そのまま写したもの。
  - 出どころ：https://github.com/anthropics/claude-plugins-official の `plugins/frontend-design/skills/frontend-design/`
  - 写した時点のコミット：a7ba5b93db0c7c8d17f3f1d25853adca79598a1a（2026-10-30）
  - ライセンス：Apache License 2.0（同じフォルダの `LICENSE.txt`）。`SKILL.md` は書き換えていない。
- 入れた理由（2026-11-01）：作者が「全セッションで使えるように」と希望した。ただ、claude.ai で有効にしたプラグインはクラウドのセッションに読み込まれず、スマホからはスキルのアップロードもできない。そこで、リポジトリの `.claude/skills/` に置いた。こうすると、HANAZONO のクラウドのセッションとローカルの Claude Code で自動的に読み込まれる。
- **HANAZONO での優先順位**：`HANDOVER.md` §4 の作者の決定事項（横画面固定、枠の入れ子禁止、操作画面のテキストは最小限、調子の顔アイコンとランクの色など）と `DESIGN.md` の判断が、このスキルの一般論より優先する。スキル自身も「依頼の言葉が常に勝つ」としている。
- **後で消す条件**：作者が claude.ai のアカウントに同じスキルを入れたら、二重にならないようこのフォルダを消す。公式の更新は自動では入らないので、更新するときは上の出どころから写し直す。
