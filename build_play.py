#!/usr/bin/env python3
"""play.html 生成: index.html に style.css / game.js をインライン化し、
アイコンリンク2か所を icon-512.png 由来の 256px PNG data URI に置換する。"""
import base64, io, os
from PIL import Image

base = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'v02') + '/'
html = open(base + 'index.html', encoding='utf-8').read()
css = open(base + 'style.css', encoding='utf-8').read()
js = open(base + 'game.js', encoding='utf-8').read()

img = Image.open(base + 'icons/icon-512.png').convert('RGB').resize((256, 256), Image.LANCZOS)
buf = io.BytesIO()
img.save(buf, 'PNG', optimize=True)
b64 = base64.b64encode(buf.getvalue()).decode()

out = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>')
out = out.replace('<link rel="icon" type="image/png" href="icons/icon-180.png">',
                  '<link rel="icon" type="image/png" href="data:image/png;base64,' + b64 + '">')
out = out.replace('<link rel="apple-touch-icon" href="icons/icon-180.png">',
                  '<link rel="apple-touch-icon" href="data:image/png;base64,' + b64 + '">')
out = out.replace('<script src="game.js"></script>', '<script>\n' + js + '\n</script>')
assert 'style.css' not in out and 'game.js' not in out, 'external refs remain!'
open(base + 'play.html', 'w', encoding='utf-8').write(out)
print('play.html built:', len(out.encode('utf-8')), 'bytes')
