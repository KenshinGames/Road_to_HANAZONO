/* v0.9.1 実ブラウザレビュー撮影: タイトル画面の全面写真背景（横向き/縦向き、play.html と index.html の同一表示） */
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '..', 'review-tools', 'node_modules', 'puppeteer-core'));

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const report = { errors: [] };

async function newPage(browser, file, w, h) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  page.on('console', m => { if (m.type() === 'error') report.errors.push('console: ' + m.text()); });
  page.on('pageerror', e => report.errors.push('pageerror: ' + e.message));
  await page.evaluateOnNewDocument(() => { try { localStorage.removeItem('hanazono.v02'); } catch (e) {} });
  await page.goto('file://' + path.join(ROOT, 'v02', file), { waitUntil: 'load' });
  await sleep(700);
  return page;
}
const titleInfo = (page) => page.evaluate(() => {
  const tp = document.querySelector('.titlephoto');
  const out = { hasTitlephoto: !!tp, versionShown: document.getElementById('app').textContent.includes('v0.9.1'),
    docSW: document.documentElement.scrollWidth, docSH: document.documentElement.scrollHeight,
    buttons: [...document.querySelectorAll('.titlephoto button')].map(b => b.textContent) };
  if (tp) {
    const cs = getComputedStyle(tp);
    out.bgIsDataUri = cs.backgroundImage.includes('data:image/jpeg');
    const r = tp.getBoundingClientRect();
    out.photoRect = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    out.childrenRects = [...tp.children].map(el => {
      const b = el.getBoundingClientRect();
      return { cls: el.className, top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) };
    });
  }
  return out;
});

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox'] });

  /* 1) 横向き 1060×600: play.html のタイトル */
  const p1 = await newPage(browser, 'play.html', 1060, 600);
  report.landPlay = await titleInfo(p1);
  await p1.screenshot({ path: path.join(SHOTS, '01_title_landscape_play.png') });
  /* 難易度ボタンが押せることも確認（目標画面へ遷移） */
  await p1.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('監督に就任する（ふつう）')); if (b) b.click(); });
  await sleep(400);
  report.afterStart = await p1.evaluate(() => document.getElementById('app').textContent.includes('目標を決めよう'));
  await p1.close();

  /* 2) 横向き 1060×600: index.html のタイトル（同一表示の確認） */
  const p2 = await newPage(browser, 'index.html', 1060, 600);
  report.landIndex = await titleInfo(p2);
  await p2.screenshot({ path: path.join(SHOTS, '02_title_landscape_index.png') });
  await p2.close();

  /* 3) 縦向き 390×844: play.html のタイトル（致命的に崩れないこと） */
  const p3 = await newPage(browser, 'play.html', 390, 844);
  report.portrait = await titleInfo(p3);
  await p3.screenshot({ path: path.join(SHOTS, '03_title_portrait.png') });
  await p3.close();

  await browser.close();
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error('SHOOT ERROR', e); process.exit(1); });
