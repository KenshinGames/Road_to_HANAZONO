#!/usr/bin/env python3
"""v0.29: ゲームで使う文字だけに絞った和文フォントを v02/style.css に埋め込む。

使う書体（どちらも SIL Open Font License 1.1。予約フォント名なし。ライセンス文は v02/fonts/ に同梱）
  - HZ Rounded : M PLUS Rounded 1c（Medium 500 = 本文、ExtraBold 800 = 見出し・ボタン・ラベル）
  - HZ Display : Dela Gothic One（週の見出し・スコア・総合力・ランク文字など「看板」の数字と題字だけ）

入手（npm の Google Fonts 配布パッケージ。TTF が入っている）:
  npm pack @expo-google-fonts/m-plus-rounded-1c@0.4.4 @expo-google-fonts/dela-gothic-one@0.4.1
  それぞれ tar xzf で展開し、展開先のフォルダを --src に並べて渡す（下の FONTS の相対パスで探す）。
  subset には fonttools と brotli が要る（pip install fonttools brotli）。

使い方:
  python3 tools/embed_fonts.py --src <展開先1> --src <展開先2>
  → game.js（コメントを除く）と index.html に出てくる文字＋かな・記号の基本セットで subset し、
    style.css の /* @fonts:begin */ 〜 /* @fonts:end */ の間を差し替える（無ければ先頭コメントの直後に入れる）。
  game.js に新しい漢字を足したら、このスクリプトを流し直す（流し忘れは test/qa_v29.js が検出する）。
"""
import argparse, base64, io, os, re, sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V02 = os.path.join(ROOT, 'v02')

FONTS = [
    # (family, weight range, 探すファイル名, 備考)
    ('HZ Rounded', '400 600', 'MPLUSRounded1c_500Medium.ttf', 'M PLUS Rounded 1c Medium'),
    ('HZ Rounded', '700 900', 'MPLUSRounded1c_800ExtraBold.ttf', 'M PLUS Rounded 1c ExtraBold'),
    ('HZ Display', '400 900', 'DelaGothicOne_400Regular.ttf', 'Dela Gothic One'),
]

# 文字の基本セット（ゲーム内の文字に加えて常に入れる）：ASCII、かな、全角記号、よく使う記号
BASE_RANGES = [
    (0x20, 0x7E), (0xA0, 0xFF),
    (0x2010, 0x2027), (0x2030, 0x203B), (0x2190, 0x2199), (0x2460, 0x2473),
    (0x25A0, 0x25CF), (0x2605, 0x2606),
    (0x3000, 0x303F), (0x3041, 0x3096), (0x309B, 0x309E), (0x30A1, 0x30FE),
    (0xFF01, 0xFF5E), (0xFF61, 0xFF65),
]


def strip_js_comments(src):
    src = re.sub(r'/\*[\s\S]*?\*/', '', src)
    out = []
    for line in src.split('\n'):
        out.append(re.sub(r'(^|[^:\'"\\])//.*$', r'\1', line))
    return '\n'.join(out)


def game_charset():
    js = open(os.path.join(V02, 'game.js'), encoding='utf-8').read()
    html = open(os.path.join(V02, 'index.html'), encoding='utf-8').read()
    chars = set(strip_js_comments(js) + html)
    for a, b in BASE_RANGES:
        chars.update(chr(c) for c in range(a, b + 1))
    # 絵文字・異体字セレクタ・制御文字は和文フォントの対象外（端末の絵文字フォントに任せる）
    keep = sorted(c for c in chars if 0x20 <= ord(c) <= 0xFFFF and not (0xFE00 <= ord(c) <= 0xFE0F)
                  and not (0xD800 <= ord(c) <= 0xDFFF))
    return ''.join(keep)


def find(srcs, name):
    for s in srcs:
        for dp, _, fs in os.walk(s):
            if name in fs:
                return os.path.join(dp, name)
    sys.exit('見つからない: ' + name)


def subset_woff2(path, text):
    font = TTFont(path)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']      # palt（かなの詰め）等の機能を残す
    opts.name_IDs = ['*']             # 著作権表記・ライセンス URL を残す
    opts.name_legacy = True
    opts.name_languages = ['*']
    opts.notdef_outline = True
    opts.hinting = False              # 画面表示ではヒンティング不要（容量を減らす）
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    buf = io.BytesIO()
    font.flavor = 'woff2'
    font.save(buf)
    return buf.getvalue()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', action='append', required=True, help='TTF を含む展開先フォルダ（複数可）')
    a = ap.parse_args()
    text = game_charset()
    blocks, sizes = [], []
    for fam, wt, fname, note in FONTS:
        data = subset_woff2(find(a.src, fname), text)
        sizes.append((note, len(data)))
        blocks.append("@font-face { font-family: '%s'; font-style: normal; font-weight: %s; font-display: swap; "
                      "src: url(data:font/woff2;base64,%s) format('woff2'); } /* %s */"
                      % (fam, wt, base64.b64encode(data).decode(), note))
    css_block = '\n'.join([
        '/* @fonts:begin — tools/embed_fonts.py が生成（手で編集しない）。',
        ' * M PLUS Rounded 1c: Copyright 2021 The M+ FONTS Project Authors (https://github.com/coz-m/MPLUS_FONTS)',
        ' * Dela Gothic One: Copyright 2020 The Dela Gothic Project Authors (https://github.com/syakuzen/DelaGothic)',
        ' * どちらも SIL Open Font License 1.1（https://openfontlicense.org 、全文は v02/fonts/）。ゲームで使う文字だけに subset 済み */',
    ] + blocks + [
        '/* @fonts:charset ' + text.replace('*/', '* /') + ' */',
        '/* @fonts:end */',
    ])
    path = os.path.join(V02, 'style.css')
    css = open(path, encoding='utf-8').read()
    if '/* @fonts:begin' in css:
        css = re.sub(r'/\* @fonts:begin[\s\S]*?/\* @fonts:end \*/', lambda m: css_block, css, count=1)
    else:
        first = css.index('*/') + 2
        css = css[:first] + '\n' + css_block + css[first:]
    open(path, 'w', encoding='utf-8').write(css)
    for note, n in sizes:
        print('%-30s %7.1f KB' % (note, n / 1024))
    print('文字数', len(text), '／ style.css', len(css.encode('utf-8')), 'bytes')


if __name__ == '__main__':
    main()
