/* v0.25 性能計測: play.html の読み込み→タイトル操作可能までの時間を実ブラウザで測る。
 * file:// 読み込み（Pages 配信時の回線時間は含まない。パース＋初期描画の実コストを見る）。
 * 3回測って中央値を採る。各回は新規ページ＋キャッシュ無効。 */
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '..', 'review-tools', 'node_modules', 'puppeteer-core'));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const crypto = require('crypto');
  const PF = '/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt';
  const pfSha = crypto.createHash('sha256').update(fs.readFileSync(PF)).digest('hex');
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox', '--hatch-webgl-allowed-domains-file=' + PF, '--hatch-webgl-allowed-domains-sha256=' + pfSha] });
  const url = 'file://' + path.join(__dirname, '..', 'v02', 'play.html');
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const page = await browser.newPage();
    await page.setViewport({ width: 932, height: 430, deviceScaleFactor: 2 });
    await page.setCacheEnabled(false);
    /* 同一ブラウザ内の2回目以降は前回のセーブで自動継続してしまうため、計測前に必ず消す */
    await page.evaluateOnNewDocument(() => {
      try { for (const k of Object.keys(localStorage)) if (k.startsWith('hanazono')) localStorage.removeItem(k); } catch (e) {}
    });
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForSelector('.slotcol', { timeout: 15000 });
    const tTitle = Date.now() - t0;
    const timing = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0] || {};
      return { domInteractive: Math.round(n.domInteractive || 0), domContentLoaded: Math.round(n.domContentLoadedEventEnd || 0), loadEvent: Math.round(n.loadEventEnd || 0) };
    });
    /* 初回タップ→目標画面（セーブ生成＋描画）の応答も測る */
    const t1 = Date.now();
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('監督に就任する（ふつう）')); if (b) b.click(); });
    await page.waitForFunction(() => document.getElementById('app').textContent.includes('目標を決めよう'), { timeout: 15000 });
    const tTap = Date.now() - t1;
    runs.push({ tTitle, tTap, timing });
    await page.close();
    await sleep(300);
  }
  await browser.close();
  const med = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const size = fs.statSync(path.join(__dirname, '..', 'v02', 'play.html')).size;
  console.log(JSON.stringify({ playHtmlBytes: size, runs, medianTitleMs: med(runs.map(r => r.tTitle)), medianTapMs: med(runs.map(r => r.tTap)) }, null, 2));
})().catch(e => { console.error('ERROR', e); process.exit(2); });
