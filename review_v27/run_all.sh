#!/bin/bash
# v0.27 の検証一式を逐次実行する（並列にしない）。回帰 → ソーク同値性 → 実ブラウザ監査（ライト／ダーク）
# 各 QA の出力は QA_OUT（既定 /tmp）に置く。TMPDIR は変えないこと（長いパスにすると Chromium のソケットパスが長すぎて起動しない）
cd "$(dirname "$0")/../test"
: > ../review_v27/regression.log
for f in qa_proto qa_v02 qa_v03 qa_v04 qa_v05 qa_v06 qa_v07 qa_v08 qa_v09 qa_v10 qa_v11 qa_v12 qa_v13 qa_v14 qa_v15 qa_v16 qa_v17 qa_v18 qa_v19 qa_v20 qa_v21 qa_v22 qa_v23 qa_v24 qa_v25 qa_v26 qa_v27; do
  s=$(date +%s); timeout 1500 node $f.js > ${QA_OUT:-/tmp}/rv27_$f.txt 2>&1; rc=$?; e=$(date +%s)
  echo "$f rc=$rc NG=$(grep -cE '^\s*NG\b|FAIL' ${QA_OUT:-/tmp}/rv27_$f.txt) $(tail -1 ${QA_OUT:-/tmp}/rv27_$f.txt | cut -c1-60) $((e-s))s" >> ../review_v27/regression.log
done
echo "REGRESSION DONE" >> ../review_v27/regression.log
timeout 5400 node soak_v19_ab.js 2 20 > ../review_v27/soak_v27_2x20.log 2>&1
echo "SOAK DONE rc=$?" >> ../review_v27/regression.log
cd ../review_v27
timeout 900 node shoot.js > shoot_run.log 2>&1; echo "AUDIT LIGHT rc=$? $(head -1 shoot_run.log)" >> regression.log
DARK=1 timeout 900 node shoot.js > shoot_dark.log 2>&1; echo "AUDIT DARK rc=$? $(head -1 shoot_dark.log)" >> regression.log
echo "ALL DONE" >> regression.log
