/* v0.10 実ブラウザレビュー撮影: 効果音トグル／遊び方ガイド／再開時あらすじ／実績一覧／紺ジャージ
 * 横向き 1060×600、play.html を対象にする。シードセーブは jsdom で実物を作って注入する。 */
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '..', 'review-tools', 'node_modules', 'puppeteer-core'));
const { JSDOM } = require(path.join(__dirname, '..', 'test', 'node_modules', 'jsdom'));

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const report = { errors: [] };

function buildSeed() {
  const html = fs.readFileSync(path.join(ROOT, 'v02', 'play.html'), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/v02/', runScripts: 'dangerously', pretendToBeVisual: true });
  const { window } = dom;
  const btn = (sub) => [...window.document.querySelectorAll('button')].find(b => b.textContent.includes(sub));
  btn('監督に就任する（ふつう）').click();
  const st = JSON.parse(window.localStorage.getItem('hanazono.v02'));
  st.career.hana = 2; st.career.hanaWins = 1; st.career.hanaTitles = 0;
  st.rep = 80;
  st.obs = []; for (let i = 0; i < 12; i++) st.obs.push({ name: 'OB' + i, pos: 'PR', avg: 70, year: 1, tries: 0, plays: 0 });
  st.history = [{ year: 1, power: 50, result: '予選決勝敗退' }, { year: 2, power: 61, result: '花園出場（初戦敗退）' }];
  window.close();
  return JSON.stringify(st);
}

async function newPage(browser, seed) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1060, height: 600 });
  page.on('console', m => { if (m.type() === 'error') report.errors.push('console: ' + m.text()); });
  page.on('pageerror', e => report.errors.push('pageerror: ' + e.message));
  await page.evaluateOnNewDocument((seedJson) => {
    try {
      localStorage.removeItem('hanazono.v02');
      localStorage.removeItem('hanazono.sound');
      if (seedJson) localStorage.setItem('hanazono.v02', seedJson);
    } catch (e) {}
  }, seed || null);
  await page.goto('file://' + path.join(ROOT, 'v02', 'play.html'), { waitUntil: 'load' });
  await sleep(700);
  return page;
}
const metrics = (page) => page.evaluate(() => ({
  docSW: document.documentElement.scrollWidth, docSH: document.documentElement.scrollHeight,
  bodyText: document.getElementById('app').textContent.replace(/\s+/g, ' ').slice(0, 400)
}));
const clickText = async (page, sub) => {
  const ok = await page.evaluate((s) => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(s));
    if (b) { b.click(); return true; } return false;
  }, sub);
  await sleep(450);
  return ok;
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox'] });

  /* 1) タイトル（新規）: バージョン表記と遊び方/サウンドボタン */
  const p1 = await newPage(browser, null);
  report.title = await metrics(p1);
  report.titleButtons = await p1.evaluate(() => [...document.querySelectorAll('.title-card button')].map(b => b.textContent));
  report.titleHasV10 = report.title.bodyText.includes('v0.10');
  await p1.screenshot({ path: path.join(SHOTS, '01_title.png') });

  /* 2) 遊び方ガイド */
  report.guideClicked = await clickText(p1, '遊び方');
  report.guide = await metrics(p1);
  report.guideOk = await p1.evaluate(() => {
    const t = document.getElementById('app').textContent;
    return t.includes('1年の流れ') && t.includes('画面の見方') && t.includes('監督のコツ');
  });
  await p1.screenshot({ path: path.join(SHOTS, '02_guide.png') });
  await clickText(p1, 'タイトルへ戻る');
  await p1.close();

  /* 3) シードセーブで再開: あらすじ → 記録室の実績 → 選手詳細（紺ジャージ） → HUD */
  const seed = buildSeed();
  const p2 = await newPage(browser, seed);
  report.digest = await p2.evaluate(() => {
    const d = document.getElementById('digest');
    return d ? { shown: true, text: d.textContent.replace(/\s+/g, ' ').slice(0, 220) } : { shown: false };
  });
  await p2.screenshot({ path: path.join(SHOTS, '03_digest.png') });
  await clickText(p2, 'グラウンドへ戻る');
  report.digestClosed = await p2.evaluate(() => document.getElementById('digest') === null);
  report.hudButtons = await p2.evaluate(() => [...document.querySelectorAll('.hud button')].map(b => b.textContent));
  await p2.screenshot({ path: path.join(SHOTS, '04_hud.png') });

  await clickText(p2, '記録・OB');
  report.records = await metrics(p2);
  report.achv = await p2.evaluate(() => {
    const rows = [...document.querySelectorAll('.achv')];
    const card = document.querySelector('.card.grow.scroll');
    if (card) card.scrollTop = card.scrollHeight;
    return { rows: rows.length, got: rows.filter(r => r.classList.contains('got')).length,
      names: rows.map(r => (r.classList.contains('got') ? '✓' : '・') + r.textContent.replace(/\s+/g, ' ').slice(0, 40)) };
  });
  await sleep(300);
  await p2.screenshot({ path: path.join(SHOTS, '05_records_achv.png') });

  await clickText(p2, '選手一覧');
  await p2.evaluate(() => { const r = document.querySelector('tr.prow'); if (r) r.click(); });
  await sleep(450);
  report.jersey = await p2.evaluate(() => {
    const svg = document.querySelector('.portrait svg');
    return svg ? { navy: svg.innerHTML.includes('#1b2a52'), green: svg.innerHTML.includes('#166534'), whiteBand: svg.innerHTML.includes('#f7f3e6') } : null;
  });
  report.squad = await metrics(p2);
  await p2.screenshot({ path: path.join(SHOTS, '06_squad_detail.png') });
  await p2.close();

  await browser.close();
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error('SHOOT ERROR', e); process.exit(1); });
