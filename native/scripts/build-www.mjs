// iOS 版の Web 資産（native/www）を Web 版のソース（v02）から組み立てる。
// game.js・style.css はそのまま写し、index.html だけを iOS 向けに差し替える：
//   - Web 版専用の head 要素（ホーム画面アイコン・apple-mobile-web-app 系）を外す
//   - game.js の代わりに native-boot.js を読む（セーブの二重化と音の設定のあとで game.js を読む）
//   - iOS だけのスタイル native.css を style.css の後に足す
// 使い方：node scripts/build-www.mjs（npm run sync なら続けて cap sync ios まで行う）
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src = join(root, '..', 'v02');
const out = join(root, 'www');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

let html = readFileSync(join(src, 'index.html'), 'utf8');
const dropped = [
  /^\s*<meta name="apple-mobile-web-app-[^>]*>\n/gm,
  /^\s*<meta name="mobile-web-app-capable"[^>]*>\n/gm,
  /^\s*<link rel="(?:icon|apple-touch-icon)"[^>]*>\n/gm
];
for (const re of dropped) html = html.replace(re, '');
const css = '<link rel="stylesheet" href="style.css">';
const js = '<script src="game.js"></script>';
if (!html.includes(css) || !html.includes(js)) throw new Error('v02/index.html の形が想定と違う（style.css／game.js の読み込みが見つからない）');
html = html.replace(css, css + '\n<link rel="stylesheet" href="native.css">');
html = html.replace(js, '<script src="native-boot.js"></script>');
if (/apple-touch-icon|apple-mobile-web-app|game\.js/.test(html)) throw new Error('Web 版専用の要素が残っている');
writeFileSync(join(out, 'index.html'), html);

copyFileSync(join(src, 'style.css'), join(out, 'style.css'));
copyFileSync(join(src, 'game.js'), join(out, 'game.js'));
copyFileSync(join(root, 'web', 'native-boot.js'), join(out, 'native-boot.js'));
copyFileSync(join(root, 'web', 'native.css'), join(out, 'native.css'));
console.log('www を組み立てました:', out);
