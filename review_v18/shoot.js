/* v0.18 実ブラウザレビュー撮影: ライバル（他校エースの実在化／キーマン対比／因縁の深化）。
 * 横向き 1060×600、play.html を対象にする。対戦確認（帝都・青葉の2種）、
 * 試合キックオフ実況（代替わり＋連勝の言及）、記録室（対戦校別成績）を撮影し、
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
    btn: (sub) => [...document.querySelectorAll('button')].find(b => b.textContent.includes(sub)),
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
function flat(st, v) {
  st.players.forEach(p => {
    Object.keys(p.stats).forEach(k => { p.stats[k] = v; });
    p.fatigue = 0; p.form = 0; p.trust = 50; p.injured = 0; p.injSev = null; p.injPart = null; p.justBack = false;
  });
}
/* 対戦確認（予選決勝・帝都）：キーマン対比の本命（帝都エースは G.rival） */
function preMatchTeitoSave() {
  const st = baseSave();
  st.monthIdx = 8; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
  flat(st, 62);
  return JSON.stringify(st);
}
/* 対戦確認（6月・青葉）：2連勝中の因縁＋通算対戦つき */
function preMatchAobaStreakSave() {
  const st = baseSave();
  st.monthIdx = 2; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
  flat(st, 70);
  st.career.oppRec = { '青葉高校': { p: 2, w: 2, l: 0 } };
  st.career.streaks = { '青葉高校': 2 };
  return JSON.stringify(st);
}
/* 試合キックオフ（3年目の青葉戦）：エース代替わりの報せ＋連勝の言及が出る構成 */
function kickoffY3Save() {
  const st = baseSave();
  st.monthIdx = 2; st.year = 3; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
  flat(st, 70);
  st.career.oppRec = { '青葉高校': { p: 2, w: 2, l: 0 } };
  st.career.streaks = { '青葉高校': 2 };
  return JSON.stringify(st);
}
/* 記録室：複数校と対戦済みで、因縁（連勝・連敗）が育っている状態 */
function recordsSave() {
  const st = baseSave();
  st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
  st.career.oppRec = {
    '青葉高校': { p: 5, w: 3, l: 2 },
    '県立西高校': { p: 3, w: 0, l: 3 },
    '帝都学園': { p: 4, w: 2, l: 2 }
  };
  st.career.streaks = { '青葉高校': 2, '県立西高校': -3, '帝都学園': -1 };
  st.rivalW = 2; st.rivalL = 2;
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
/* はみ出し＋衝突の監査（review_v17 と同方式。可視矩形同士で判定） */
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
  const els = [...document.querySelectorAll('#app button, #app select, #app .card, #app .hud, #app .actionbar, #app .keyman, #app .kmcol')];
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
async function toPreMatch(page) {
  for (let i = 0; i < 120; i++) {
    const st = await page.evaluate(() => {
      if ([...document.querySelectorAll('button')].some(b => b.textContent.includes('キックオフ'))) return 'pre';
      const inst = [...document.querySelectorAll('button')].find(b => b.textContent.includes('指示を確定'));
      if (inst) { inst.click(); return 'inst'; }
      const pc = document.querySelector('.pcard');
      if (pc) { pc.click(); return 'card'; }
      return 'wait';
    });
    if (st === 'pre') return true;
    await sleep(220);
  }
  return false;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox'] });

  /* 01: 対戦確認（帝都）＝キーマン対比（上部） */
  const p1 = await newPage(browser, preMatchTeitoSave());
  report.facts.teitoPreReached = await toPreMatch(p1);
  await snap(p1, '01_prematch_teito_top');
  /* 02: 同画面をキーマン対比まで内部スクロール */
  await p1.evaluate(() => { const k = document.querySelector('.keyman'); if (k) k.scrollIntoView({ block: 'start' }); });
  await sleep(300);
  await snap(p1, '02_prematch_teito_keyman');
  report.facts.teitoKeyman = await p1.evaluate(() => {
    const k = document.querySelector('.keyman');
    return k ? k.textContent.replace(/\s+/g, ' ').slice(0, 300) : null;
  });
  await p1.close();

  /* 03: 対戦確認（青葉・2連勝中）：通算対戦＋ストリーク＋緑ジャージのエース */
  const p2 = await newPage(browser, preMatchAobaStreakSave());
  report.facts.aobaPreReached = await toPreMatch(p2);
  await p2.evaluate(() => { const k = document.querySelector('.keyman'); if (k) k.scrollIntoView({ block: 'end' }); });
  await sleep(300);
  await snap(p2, '03_prematch_aoba_streak_keyman');
  report.facts.aobaScout = await p2.evaluate(() => {
    const t = document.getElementById('app').textContent.replace(/\s+/g, ' ');
    const i = t.indexOf('通算対戦');
    return i >= 0 ? t.slice(Math.max(0, i - 40), i + 120) : null;
  });
  await p2.close();

  /* 04: 試合キックオフ（3年目・青葉）：代替わりの報せ＋連勝の言及 */
  const p3 = await newPage(browser, kickoffY3Save());
  report.facts.y3PreReached = await toPreMatch(p3);
  await clickText(p3, 'キックオフ');
  await sleep(400);
  await snap(p3, '04_match_kickoff_y3');
  report.facts.y3KickoffLog = await p3.evaluate(() =>
    [...document.querySelectorAll('.log > div')].map(d => d.textContent).slice(0, 8));
  await p3.close();

  /* 05: 記録室（対戦校別成績：ストリーク＋現エース） */
  const p4 = await newPage(browser, recordsSave());
  await clickText(p4, '記録・OB');
  await p4.evaluate(() => {
    const secs = [...document.querySelectorAll('.sec')];
    const s = secs.find(x => x.textContent.includes('対戦校別成績'));
    if (s) s.scrollIntoView({ block: 'start' });
  });
  await sleep(300);
  await snap(p4, '05_records_opprec');
  report.facts.recordsOpp = await p4.evaluate(() => {
    const t = document.getElementById('app').textContent.replace(/\s+/g, ' ');
    const i = t.indexOf('対戦校別成績');
    return i >= 0 ? t.slice(i, i + 420) : null;
  });
  await p4.close();

  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error('ERROR', e); process.exit(2); });
