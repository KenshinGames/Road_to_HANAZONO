/* v0.13 実ブラウザレビュー撮影: 育成の手触り（月次成長レポート／選手詳細の調子推移／追加イベントの会話カード）
 * 横向き 1060×600、play.html を対象にする。成長レポートは jsdom で実プレイして作った本物のセーブを注入する。 */
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
  const dom = new JSDOM(HTML, {
    url: 'http://localhost/v02/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window) { if (saveJson) window.localStorage.setItem('hanazono.v02', saveJson); }
  });
  return dom;
}
function baseSave() {
  const dom = jsdomWith(null);
  const { window } = dom;
  const btn = (sub) => [...window.document.querySelectorAll('button')].find(b => b.textContent.includes(sub));
  btn('監督に就任する（ふつう）').click();
  const st = JSON.parse(window.localStorage.getItem('hanazono.v02'));
  window.close();
  return st;
}
/* 練習マスの盤面を実際に進めて「本物の成長レポート」が付いたセーブを作る */
async function growthSave() {
  const st = baseSave();
  st.monthIdx = 0; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
  st.board = {
    cells: [{ t: 'pB', done: false }, { t: 'pS', done: false }, { t: 'pB', done: false }, { t: 'end', done: false }],
    pos: -1, hand: [1, 1, 1], log: []
  };
  const dom = jsdomWith(JSON.stringify(st));
  const { window } = dom;
  await sleep(80);
  let guard = 0;
  while (guard++ < 30) {
    const pc = window.document.querySelector('.pcard');
    if (!pc) break;
    pc.click(); await sleep(5);
  }
  const out = window.localStorage.getItem('hanazono.v02');
  const parsed = JSON.parse(out);
  window.close();
  return { json: out, hasReport: !!parsed.growReport, rows: parsed.growReport ? parsed.growReport.rows.length : 0 };
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
  await clickText(page, 'グラウンドへ戻る');
  return page;
}
const metrics = (page) => page.evaluate(() => ({
  docSW: document.documentElement.scrollWidth, docSH: document.documentElement.scrollHeight,
  bodyText: document.getElementById('app').textContent.replace(/\s+/g, ' ').slice(0, 200)
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

  /* 01: 月次成長レポート（月頭指示画面の左カラム） */
  const gs = await growthSave();
  report.growthSave = { hasReport: gs.hasReport, rows: gs.rows };
  const p1 = await newPage(browser, gs.json);
  report.inst = await metrics(p1);
  report.reportCard = await p1.evaluate(() => {
    const el = document.querySelector('.growreport');
    return el ? el.textContent.replace(/\s+/g, ' ').slice(0, 400) : null;
  });
  await p1.screenshot({ path: path.join(SHOTS, '01_growth_report.png') });
  await p1.close();

  /* 02: 選手詳細の調子推移（顔アイコンの列） */
  const st2 = baseSave();
  st2.goalSet = true; st2.board = null; st2.summary = null; st2.recruit = null;
  const patterns = [[-1, 0, 1, 2, 1, 2], [2, 1, 0, -1, -2, -2], [0, 0, 1, 1], [-2, -1, 0], [1, 2]];
  st2.players.forEach((pl, i) => {
    const pat = patterns[i % patterns.length];
    pl.formHist = pat.slice();
    pl.form = pat[pat.length - 1]; /* 読み込み時の sync で末尾がずれないよう現在の調子を末尾に合わせる */
  });
  const p2 = await newPage(browser, JSON.stringify(st2));
  await clickText(p2, '選手一覧');
  await p2.evaluate(() => { const r = document.querySelector('tr.prow'); if (r) r.click(); });
  await sleep(420);
  report.squad = await metrics(p2);
  report.formhist = await p2.evaluate(() => {
    const el = document.querySelector('.formhist');
    if (!el) return null;
    return [...el.querySelectorAll('.formface')].map(f => ({
      form: f.getAttribute('data-form'),
      fill: f.querySelector('circle').getAttribute('fill'),
      w: f.querySelector('svg').getAttribute('width'),
      text: f.textContent
    }));
  });
  await p2.screenshot({ path: path.join(SHOTS, '02_detail_formhist.png') });
  await p2.close();

  /* 03: 追加イベント（復帰の一言）の会話カード。backMark を立てたセーブ＋イベントマスだけの盤面で拾う */
  const st3 = baseSave();
  st3.monthIdx = 1; st3.goalSet = true; st3.summary = null; st3.recruit = null;
  st3.players[0].backMark = true; st3.players[0].trust = 40;
  const heroName = st3.players[0].name;
  const evCells = []; for (let i = 0; i < 16; i++) evCells.push({ t: 'ev', done: false });
  evCells.push({ t: 'end', done: false });
  st3.board = { cells: evCells, pos: -1, hand: [1, 1, 1], log: [] };
  let found = false, attempts = 0;
  while (!found && attempts++ < 4) {
    const p3 = await newPage(browser, JSON.stringify(st3));
    for (let i = 0; i < 24 && !found; i++) {
      const clicked = await p3.evaluate(() => {
        const c = document.querySelector('.pcard');
        if (c) { c.click(); return true; } return false;
      });
      if (!clicked) break;
      await sleep(300);
      found = await p3.evaluate((nm) => {
        const lines = [...document.querySelectorAll('.log > div')].map(d => d.textContent);
        return lines.some(l => l.includes('ケガから復帰した') && l.includes(nm)) && !!document.querySelector('.dlg');
      }, heroName);
      if (found) {
        report.event = await metrics(p3);
        report.eventDlg = await p3.evaluate(() => {
          const d = document.querySelector('.dlg');
          return d ? d.textContent.replace(/\s+/g, ' ') : null;
        });
        await p3.screenshot({ path: path.join(SHOTS, '03_event_comeback.png') });
      }
    }
    await p3.close();
  }
  report.eventFound = found;
  report.eventAttempts = attempts;

  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'report.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
})().catch(e => { console.error('ERROR', e); process.exit(1); });
