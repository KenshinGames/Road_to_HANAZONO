/* v0.19 実ブラウザレビュー撮影: 週次プランニング（練習メニュー様式の週次画面）。
 * 横向き 1060×600、play.html を対象にする。週次画面（4月・第1週／第2週、6月の試合月、
 * 8月の合宿写真、旧盤面セーブからの移行直後）、月頭指示、対戦確認、ガイドを撮影し、
 * 各画面でドキュメントはみ出しと可視要素同士の衝突を計測する（監査は review_v17 と同方式）。 */
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '..', 'review-tools', 'node_modules', 'puppeteer-core'));
const { JSDOM } = require(path.join(__dirname, '..', 'test', 'node_modules', 'jsdom'));

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const report = { errors: [], screens: {}, facts: {} };
const HTML = fs.readFileSync(path.join(ROOT, 'v02', 'play.html'), 'utf8');

function jsdomWith(saveJson) {
  return new JSDOM(HTML, {
    url: 'http://localhost/v02/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window) { if (saveJson) window.localStorage.setItem('hanazono.v02', saveJson); }
  });
}
function helpers(window) {
  const document = window.document;
  return {
    click: (sub) => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(sub)); if (b) b.click(); },
    state: () => JSON.parse(window.localStorage.getItem('hanazono.v02'))
  };
}
function baseSave() {
  const dom = jsdomWith(null);
  const h = helpers(dom.window);
  h.click('監督に就任する（ふつう）');
  const st = h.state();
  dom.window.close();
  return st;
}
/* 6月（練習試合の月）の第2週：試合月の週次画面 */
function juneWeeklySave() {
  const st = baseSave();
  st.monthIdx = 2; st.goalSet = true; st.summary = null; st.recruit = null;
  st.board = { weekly: true, week: 1, log: ['🏉 スクラム強化。田中（パワー+2）が伸びた', '🧘 メンタル調整。チームの空気を整えた'], dlg: null, picks: ['scrum', 'mental'] };
  return JSON.stringify(st);
}
/* 8月（合宿・写真バナー）の第1週 */
function augustWeeklySave() {
  const st = baseSave();
  st.monthIdx = 4; st.goalSet = true; st.summary = null; st.recruit = null;
  st.board = { weekly: true, week: 0, log: [], dlg: null, picks: [] };
  return JSON.stringify(st);
}
/* 旧盤面（すごろく）途中セーブ：読み込みで週次へ移行される様子を見る */
function legacyMidSave() {
  const st = baseSave();
  st.monthIdx = 0; st.goalSet = true; st.summary = null; st.recruit = null;
  const cells = [];
  for (let i = 0; i < 11; i++) cells.push({ t: 'pS', done: i < 5 });
  cells.push({ t: 'end', done: false });
  st.board = { cells, pos: 5, hand: [{ n: 1 }, { n: 2 }, { n: 3 }], log: ['💪 練習。山田（スピード+2）'] };
  return JSON.stringify(st);
}

async function newPage(browser, seedJson) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1060, height: 600 });
  page.on('console', m => { if (m.type() === 'error') report.errors.push('console: ' + m.text()); });
  page.on('pageerror', e => report.errors.push('pageerror: ' + e.message));
  await page.evaluateOnNewDocument((sj) => {
    try {
      localStorage.removeItem('hanazono.v02');
      localStorage.removeItem('hanazono.sound');
      if (sj) localStorage.setItem('hanazono.v02', sj);
    } catch (e) {}
  }, seedJson || null);
  await page.goto('file://' + path.join(ROOT, 'v02', 'play.html'), { waitUntil: 'load' });
  await sleep(700);
  return page;
}
/* はみ出し＋衝突の監査（review_v17 と同方式。可視矩形同士で判定。v0.19 の要素も対象に追加） */
const audit = (page) => page.evaluate(() => {
  const out = { docSW: document.documentElement.scrollWidth, docSH: document.documentElement.scrollHeight, issues: [] };
  const hud = document.querySelector('.hud');
  if (hud) out.hudH = Math.round(hud.getBoundingClientRect().height);
  function visibleRect(el) {
    let r = el.getBoundingClientRect();
    let v = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    let n = el.parentElement;
    while (n && n !== document.body) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll|hidden)/.test(cs.overflowY) || /(auto|scroll|hidden)/.test(cs.overflowX)) {
        const b = n.getBoundingClientRect();
        v.left = Math.max(v.left, b.left); v.top = Math.max(v.top, b.top);
        v.right = Math.min(v.right, b.right); v.bottom = Math.min(v.bottom, b.bottom);
      }
      n = n.parentElement;
    }
    v.width = v.right - v.left; v.height = v.bottom - v.top;
    return v;
  }
  const els = [...document.querySelectorAll('#app button, #app select, #app .card, #app .hud, #app .actionbar, #app .wcard, #app .wstatus, #app .wscene')];
  const rs = els.map(e => ({ el: e, v: visibleRect(e) })).filter(x => x.v.width > 0 && x.v.height > 0);
  rs.forEach(x => {
    if (x.v.right > 1061 || x.v.bottom > 601 || x.v.left < -1 || x.v.top < -1) {
      out.issues.push('overflow(visible): ' + (x.el.className || x.el.tagName) + ' [' + [x.v.left, x.v.top, x.v.right, x.v.bottom].map(Math.round).join(',') + ']');
    }
  });
  const inter = rs.filter(x => x.el.tagName === 'BUTTON' || x.el.tagName === 'SELECT');
  for (let i = 0; i < inter.length; i++) for (let j = i + 1; j < inter.length; j++) {
    const a = inter[i], b = inter[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ix = Math.min(a.v.right, b.v.right) - Math.max(a.v.left, b.v.left);
    const iy = Math.min(a.v.bottom, b.v.bottom) - Math.max(a.v.top, b.v.top);
    if (ix > 2 && iy > 2) out.issues.push('overlap(visible): ' + a.el.textContent.replace(/\s+/g, ' ').slice(0, 24) + ' <> ' + b.el.textContent.replace(/\s+/g, ' ').slice(0, 24));
  }
  return out;
});
async function snap(page, name) {
  const a = await audit(page);
  report.screens[name] = a;
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
}
const clickText = async (page, sub) => {
  const ok = await page.evaluate((s) => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(s));
    if (b) { b.click(); return true; } return false;
  }, sub);
  await sleep(350);
  return ok;
};
const clickCard = async (page, sub) => {
  const ok = await page.evaluate((s) => {
    const c = [...document.querySelectorAll('.wcard')].find(x => x.textContent.includes(s));
    if (c) { c.click(); return true; } return false;
  }, sub);
  await sleep(350);
  return ok;
};

(async () => {
  const crypto = require('crypto');
  const PF = '/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt';
  const pfSha = crypto.createHash('sha256').update(fs.readFileSync(PF)).digest('hex');
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox', '--hatch-webgl-allowed-domains-file=' + PF, '--hatch-webgl-allowed-domains-sha256=' + pfSha] });

  /* 00〜02: 新規開始→月頭指示→週次画面（第1週→第2週）→おまかせで月末まで */
  const p0 = await newPage(browser, null);
  await clickText(p0, '監督に就任する');
  if (await p0.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('目標を決めて')))) {
    await clickText(p0, '目標を決めて');
  }
  await snap(p0, '00_inst');
  await clickText(p0, '指示を確定');
  report.facts.weeklyFacts = await p0.evaluate(() => ({
    cards: document.querySelectorAll('.wcard').length,
    hasStatus: !!document.querySelector('.wstatus'),
    hasScene: !!document.querySelector('.wscene'),
    weekText: (document.querySelector('.wtitle') || {}).textContent || null,
    autoBtn: [...document.querySelectorAll('button')].some(b => b.textContent.includes('おまかせ'))
  }));
  await snap(p0, '01_weekly_april_w1');
  await clickCard(p0, 'スクラム強化');
  report.facts.afterOneWeek = await p0.evaluate(() => ({
    title: (document.querySelector('.wtitle') || {}).textContent || null,
    logLines: document.querySelectorAll('.log > div').length
  }));
  await snap(p0, '02_weekly_april_w2');
  await clickText(p0, 'おまかせ');
  report.facts.autoReachedNextMonth = await p0.evaluate(() =>
    [...document.querySelectorAll('button')].some(b => b.textContent.includes('指示を確定')));
  await p0.close();

  /* 03: 6月（試合月）第2週の週次画面 → 04: 週を進め切ると対戦確認 */
  const p1 = await newPage(browser, juneWeeklySave());
  await snap(p1, '03_weekly_june_match');
  for (let i = 0; i < 4; i++) await clickCard(p1, '休養・ケア');
  report.facts.juneReachedPreMatch = await p1.evaluate(() =>
    [...document.querySelectorAll('button')].some(b => b.textContent.includes('キックオフ')));
  await snap(p1, '04_prematch');
  await p1.close();

  /* 05: 8月合宿（写真バナー）の週次画面 */
  const p2 = await newPage(browser, augustWeeklySave());
  report.facts.augustPhoto = await p2.evaluate(() => !!document.querySelector('.wscene .photobanner'));
  await snap(p2, '05_weekly_august_camp');
  await p2.close();

  /* 06: 旧盤面セーブの移行直後（第3週から再開） */
  const p3 = await newPage(browser, legacyMidSave());
  report.facts.migrated = await p3.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('hanazono.v02'));
    return { weekly: !!(st.board && st.board.weekly), week: st.board && st.board.week, cards: document.querySelectorAll('.wcard').length };
  });
  await snap(p3, '06_weekly_migrated');
  await p3.close();

  /* 07: ガイド（週次プランニングの手順） */
  const p4 = await newPage(browser, null);
  await clickText(p4, '遊び方');
  report.facts.guideWeekly = await p4.evaluate(() =>
    document.getElementById('app').textContent.includes('週次プランニング'));
  await snap(p4, '07_guide');
  await p4.close();

  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error('ERROR', e); process.exit(2); });
