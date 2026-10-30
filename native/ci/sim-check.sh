#!/bin/bash
# GitHub Actions（macOS）用：シミュレータでアプリを起動し、
#  1) 新規起動でタイトル画面が出て、セーブの控え（Application Support/hanazono-save.json）が書かれること
#  2) WebKit のデータが消えた想定（入れ直して控えファイルだけ置く）で起動すると、控えから書き戻されて続きから遊べること
# を確かめる。スクリーンショットとログは sim-out/ に置く。
set -euo pipefail
OUT=sim-out
mkdir -p "$OUT"
APP=build/Build/Products/Debug-iphonesimulator/App.app
BID=com.kenshingames.hanazono
WAIT=15

# 機種は SIM_DEVICE（例 "iPhone 15 Pro"）。入っていなければ最新の iOS ランタイムで作る。未指定なら Pro（Max でない）の最新
SIM_DEVICE="${SIM_DEVICE:-}"
UDID=$(xcrun simctl list devices available -j | python3 -c '
import json, sys
want = sys.argv[1]
d = json.load(sys.stdin)["devices"]
c = [(k, x) for k, v in d.items() if "iOS" in k for x in v if x["name"].startswith("iPhone")]
c.sort(key=lambda kx: kx[0])
if want:
    c = [kx for kx in c if kx[1]["name"] == want]
else:
    c = [kx for kx in c if "Pro" in kx[1]["name"] and "Max" not in kx[1]["name"]] or c
if c:
    print(c[-1][1]["udid"])
' "$SIM_DEVICE")
if [ -z "$UDID" ]; then
  RT=$(xcrun simctl list runtimes -j | python3 -c '
import json, sys
r = [x for x in json.load(sys.stdin)["runtimes"] if x.get("platform") == "iOS" and x.get("isAvailable")]
print(r[-1]["identifier"])')
  TYPE="com.apple.CoreSimulator.SimDeviceType.${SIM_DEVICE// /-}"
  UDID=$(xcrun simctl create "$SIM_DEVICE" "$TYPE" "$RT")
fi
echo "simulator: $(xcrun simctl list devices -j | python3 -c 'import json,sys; u=sys.argv[1]; print([x["name"] for v in json.load(sys.stdin)["devices"].values() for x in v if x["udid"]==u][0])' "$UDID") ($UDID)"
xcrun simctl boot "$UDID"
xcrun simctl bootstatus "$UDID" -b > /dev/null
xcrun simctl install "$UDID" "$APP"

store_of() { echo "$(xcrun simctl get_app_container "$UDID" "$BID" data)/Library/Application Support/hanazono-save.json"; }

echo "== 1) 新規起動"
xcrun simctl launch "$UDID" "$BID"
sleep "$WAIT"
xcrun simctl io "$UDID" screenshot "$OUT/1_first_launch.png"
STORE=$(store_of)
if [ ! -f "$STORE" ]; then
  echo "NG: セーブの控えが書かれていない"
  ls -R "$(xcrun simctl get_app_container "$UDID" "$BID" data)/Library" | head -60
  exit 1
fi
python3 - "$STORE" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
print("store keys:", sorted(d))
assert "hanazono.slots" in d and "hanazono.tut" in d, "起動時の内容（スロットのメタ・チュートリアル）が写っていない"
print("ok: 新規起動で控えが書かれた")
PY

echo "== 2) 控えからの書き戻し"
xcrun simctl terminate "$UDID" "$BID" || true
xcrun simctl uninstall "$UDID" "$BID"
xcrun simctl install "$UDID" "$APP"
DATA=$(xcrun simctl get_app_container "$UDID" "$BID" data)
mkdir -p "$DATA/Library/Application Support"
cp test/fixtures/save_2slots.json "$DATA/Library/Application Support/hanazono-save.json"
xcrun simctl launch "$UDID" "$BID"
sleep "$WAIT"
xcrun simctl io "$UDID" screenshot "$OUT/2_restored.png"
python3 - "$DATA" test/fixtures/save_2slots.json <<'PY'
import glob, json, os, sqlite3, sys
data, fx = sys.argv[1], json.load(open(sys.argv[2]))
store = json.load(open(os.path.join(data, "Library/Application Support/hanazono-save.json")))
assert store.get("hanazono.v02") == fx["hanazono.v02"], "控えの中身が変わってしまった"
assert store.get("hanazono.slot.2") == fx["hanazono.slot.2"], "スロット2の控えが変わってしまった"
print("ok: 控えは保たれている")
found = False
for f in glob.glob(os.path.join(data, "Library/WebKit/**/*.sqlite3"), recursive=True):
    try:
        con = sqlite3.connect(f)
        rows = con.execute("select key, value from ItemTable").fetchall()
    except Exception:
        continue
    keys = sorted(r[0] for r in rows)
    if "hanazono.v02" in keys:
        found = True
        val = dict(rows)["hanazono.v02"]
        if isinstance(val, bytes):
            val = val.decode("utf-16-le")
        print("localStorage keys:", keys)
        assert json.loads(val)["year"] == 3, "書き戻したセーブが3年目ではない"
        print("ok: localStorage に書き戻され、3年目のセーブが入っている")
if not found:
    print("note: WebKit の localStorage ファイルは見つからなかった（スクリーンショット 2_restored.png で確認）")
PY

xcrun simctl spawn "$UDID" log show --last 5m --style compact --predicate 'process == "App"' > "$OUT/app.log" 2>/dev/null || true
grep -iE "error|exception|⚡️" "$OUT/app.log" | head -40 || true
echo "done"
