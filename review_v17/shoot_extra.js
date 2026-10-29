/* v0.17 追加撮影: 成長レポート表示時の月頭指示／ダークモードでの月頭指示（ユーザー実機はダーク配色） */
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '..', 'review-tools', 'node_modules', 'puppeteer-core'));
const { JSDOM } = require(path.join(__dirname, '..', 'test', 'node_modules', 'jsdom'));
const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const HTML = fs.readFileSync(path.join(ROOT, 'v02', 'play.html'), 'utf8');
const report = { errors: [] };

function baseSave() {
  const dom = new JSDOM(HTML, { url: 'http://localhost/v02/', runScripts: 'dangerously', pretendToBeVisual: true });
  const document = dom.window.document;
  const click = (sub) => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(sub)); if (b) b.click(); };
  click('監督に就任する（ふつう）');
  const st = JSON.parse(dom.window.localStorage.getItem('hanazono.v02'));
  dom.window.close();
  return st;
}
async function newPage(browser, seedJson, dark) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1060, height: 600 });
  if (dark) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  page.on('pageerror', e => report.errors.push('pageerror: ' + e.message));
  await page.evaluateOnNewDocument((sj) => {
    try { localStorage.removeItem('hanazono.v02'); if (sj) localStorage.setItem('hanazono.v02', sj); } catch (e) {}
  }, seedJson || null);
  await page.goto('file://' + path.join(ROOT, 'v02', 'play.html'), { waitUntil: 'load' });
  await sleep(700);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('グラウンドへ戻る'));
    if (b) b.click();
  });
  await sleep(300);
  return page;
}
const metrics = (page) => page.evaluate(() => ({
  docSW: document.documentElement.scrollWidth, docSH: document.documentElement.scrollHeight,
  hudH: (() => { const h = document.querySelector('.hud'); return h ? Math.round(h.getBoundingClientRect().height) : null; })()
}));

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox'] });

  /* 成長レポートあり：ヒーローパネルと濃緑ボードが左カラムに共存する */
  const st = baseSave();
  st.goalSet = true; st.monthIdx = 1; st.board = null; st.summary = null; st.recruit = null;
  st.monthLog = ['🏃 朝練に1年生全員が揃った'];
  const p0 = st.players[0], p1 = st.players[1];
  st.growReport = {
    label: '4月',
    rows: [
      { name: p0.name, stats: { spd: 3, tak: 2 }, trust: 5, total: 5, focus: true },
      { name: p1.name, stats: { sta: 1 }, trust: 0, total: 1, focus: false }
    ]
  };
  const pa = await newPage(browser, JSON.stringify(st), false);
  report.growth = await metrics(pa);
  await pa.screenshot({ path: path.join(SHOTS, '18_inst_growth.png') });
  await pa.close();

  /* ダークモードの月頭指示（photo-6 と同じ状況） */
  const st2 = baseSave();
  st2.goalSet = true; st2.board = null; st2.summary = null; st2.recruit = null;
  st2.rep = 170;
  st2.monthLog = ['🌸 スカウト成功！ 高橋 颯太（SO）が入部を決めた'];
  const pb = await newPage(browser, JSON.stringify(st2), true);
  report.dark = await metrics(pb);
  await pb.screenshot({ path: path.join(SHOTS, '19_inst_dark.png') });
  await pb.close();

  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'report_extra.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error('SHOOT ERROR', e); process.exit(1); });
