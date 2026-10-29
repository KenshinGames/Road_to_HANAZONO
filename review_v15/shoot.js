/* v0.15 実ブラウザレビュー撮影: デザイン統一（ランク表示／選手詳細の作り替え／成長レポートのボード化／初回ヒント）
 * 横向き 1060×600、play.html を対象にする。セーブは jsdom で作った実セーブ＋表示確認用の脚色セーブ。
 * 本番コードにデバッグ導線は入れていない（localStorage へのセーブ投入のみ）。 */
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '..', 'review-tools', 'node_modules', 'puppeteer-core'));
const { JSDOM } = require(path.join(__dirname, '..', 'test', 'node_modules', 'jsdom'));

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const report = { errors: [] };
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
    text: () => document.getElementById('app').textContent.replace(/\s+/g, ' '),
    btn: (sub) => [...document.querySelectorAll('button')].find(b => b.textContent.includes(sub)),
    click: (sub) => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(sub)); if (b) b.click(); },
    state: () => JSON.parse(window.localStorage.getItem('hanazono.v02'))
  };
}
function baseSave() {
  const dom = jsdomWith(null);
  const h = helpers(dom.window);
  h.click('監督に就任する（ふつう）');
  if (h.btn('目標を決めて')) h.click('目標を決めて');
  const st = h.state();
  dom.window.close();
  return st;
}
/* 詳細・一覧の見栄え確認用：1人目を全ランク帯が見える能力にし、特能と「怪我がち」タグ、調子推移を持たせる */
function detailSave() {
  const st = baseSave();
  const p = st.players[0];
  p.stats = { spd: 92, pow: 88, pas: 76, kik: 64, tak: 55, sta: 47 };
  p.skills = ['step', 'big'];
  p.trait = { n: '怪我がち', growth: 1.15, inj: 2.2 };
  p.form = 2; p.formHist = [-1, 0, 1, 1, 2, 2];
  p.trust = 78; p.fatigue = 23;
  const q = st.players[1];
  q.stats = { spd: 71, pow: 66, pas: 58, kik: 49, tak: 81, sta: 52 };
  return JSON.stringify(st);
}
/* 成長レポート確認用（qa_v15 と同型のレポートを仕込む） */
function growthSave() {
  const st = baseSave();
  st.growReport = {
    label: '4月',
    rows: [
      { name: st.players[0].name, stats: { spd: 3, tak: 2, pas: 1 }, trust: 6, total: 6, focus: true },
      { name: st.players[1].name, stats: { pow: 4 }, trust: 2, total: 4, focus: false },
      { name: st.players[2].name, stats: { sta: 2, kik: 2 }, trust: 0, total: 4, focus: false }
    ]
  };
  st.growAcc = null;
  return JSON.stringify(st);
}
/* 記録室確認用：最終能力つき OB と旧式 OB を混ぜる */
function recordsSave() {
  const st = baseSave();
  st.obs = [
    { name: '往年の主将', pos: 'FL', avg: 83, year: 1, tries: 4, plays: 9, st: { spd: 88, pow: 91, pas: 70, kik: 40, tak: 95, sta: 66 }, path: 'プロリーグ' },
    { name: '旧時代のOB', pos: 'SH', avg: 55, year: 1, tries: 0, plays: 0 }
  ];
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
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('グラウンドへ戻る'));
    if (b) b.click();
  });
  await sleep(300);
  return page;
}
const metrics = (page) => page.evaluate(() => ({
  docSW: document.documentElement.scrollWidth, docSH: document.documentElement.scrollHeight
}));
const clickText = async (page, sub) => {
  const ok = await page.evaluate((s) => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(s));
    if (b) { b.click(); return true; } return false;
  }, sub);
  await sleep(420);
  return ok;
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox'] });

  /* 01: 選手一覧（ランク併記テーブル）＋右に詳細 */
  const p1 = await newPage(browser, detailSave());
  await clickText(p1, '選手一覧');
  report.m1 = await metrics(p1);
  report.squad = await p1.evaluate(() => ({
    rkCount: document.querySelectorAll('table.squad .rk').length,
    ranks: [...new Set([...document.querySelectorAll('table.squad .rk')].map(e => e.getAttribute('data-rank')))].sort().join('')
  }));
  await p1.screenshot({ path: path.join(SHOTS, '01_squad_list.png') });

  /* 02: 選手詳細（1人目を選択した状態。初期選択が1人目なのでそのまま詳細側を撮る） */
  report.detail = await p1.evaluate(() => {
    const d = document.querySelector('.pdetail');
    if (!d) return null;
    return {
      banner: !!d.querySelector('.pname'),
      lgRanks: d.querySelectorAll('.rkval.lg').length,
      tags: [...d.querySelectorAll('.taggrid .tag')].map(e => e.textContent + ':' + e.className),
      hasHist: !!d.querySelector('.formhist .formface')
    };
  });
  await p1.screenshot({ path: path.join(SHOTS, '02_player_detail.png') });
  await p1.close();

  /* 03: 成長レポート（濃緑ボード） */
  const p2 = await newPage(browser, growthSave());
  report.m2 = await metrics(p2);
  report.growth = await p2.evaluate(() => {
    const b = document.querySelector('.grboard');
    if (!b) return null;
    const cs = getComputedStyle(b);
    return {
      title: b.querySelector('.grtitle') ? b.querySelector('.grtitle').textContent : '',
      plates: [...b.querySelectorAll('.grplate')].map(e => e.textContent),
      items: [...b.querySelectorAll('.gritem')].map(e => e.textContent.replace(/\s+/g, ' ')),
      bg: cs.backgroundImage.slice(0, 60)
    };
  });
  await p2.screenshot({ path: path.join(SHOTS, '03_growth_report.png') });
  await p2.close();

  /* 04: 記録室（OB名鑑のランク併記） */
  const p3 = await newPage(browser, recordsSave());
  await clickText(p3, '記録・OB');
  await p3.evaluate(() => {
    const cols = document.querySelectorAll('.card.scroll');
    const el = [...document.querySelectorAll('.sec')].find(x => x.textContent.includes('OB名鑑'));
    if (el) el.scrollIntoView({ block: 'start' });
    if (cols.length) { /* 右カラム（OB名鑑側）を先頭に */ }
  });
  await sleep(350);
  report.m3 = await metrics(p3);
  report.records = await p3.evaluate(() => {
    const lines = [...document.querySelectorAll('.obstats')];
    return lines.map(e => ({ ranks: [...e.querySelectorAll('.rk')].map(x => x.getAttribute('data-rank')).join(''), text: e.textContent.replace(/\s+/g, ' ').slice(0, 90) }));
  });
  await p3.screenshot({ path: path.join(SHOTS, '04_records_ob.png') });
  await p3.close();

  /* 05: 初回ヒント（新規開始→目標→月頭指示） */
  const p4 = await newPage(browser, null);
  await clickText(p4, '監督に就任する（ふつう）');
  await clickText(p4, '目標を決めて');
  report.m4 = await metrics(p4);
  report.hint = await p4.evaluate(() => {
    const hEl = document.querySelector('.hintcard');
    return hEl ? hEl.textContent.replace(/\s+/g, ' ') : null;
  });
  await p4.screenshot({ path: path.join(SHOTS, '05_first_hint.png') });
  await p4.close();

  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error('SHOOT ERROR', e); process.exit(1); });
