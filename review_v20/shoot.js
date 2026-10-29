/* v0.20 実ブラウザ監査: レビュー主基準を iPhone 15 Pro 横画面 932×430 に変更し（ユーザー実機指摘を受けて）、
 * 全主要画面を 932×430 で撮影・監査する。1060×600 は補助として週次（会話）・勧誘比較・新入生紹介のみ撮る。
 * 監査は可視矩形ベース＋ボタン/カード等の可視要素同士の重なり検出（祖先子孫は除外、モーダルとトーストは対象外）。
 * v0.19 監査が週次画面の重なりを検出できなかった反省から、.wscene や .card も重なり判定の対象に含める。 */
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '..', 'review-tools', 'node_modules', 'puppeteer-core'));
const { JSDOM } = require(path.join(__dirname, '..', 'test', 'node_modules', 'jsdom'));

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const report = { errors: [], screens: {}, facts: {} };
const HTML = fs.readFileSync(path.join(ROOT, 'v02', 'play.html'), 'utf8');

/* ---------- jsdom でセーブを作る ---------- */
function jsdomLoad(saveJson, seed) {
  const dom = new JSDOM(HTML, {
    url: 'http://localhost/v02/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window) {
      if (seed != null) {
        let a = seed >>> 0;
        window.Math.random = function () {
          a |= 0; a = (a + 0x6D2B79F5) | 0;
          let t = Math.imul(a ^ (a >>> 15), 1 | a);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }
      if (saveJson) window.localStorage.setItem('hanazono.v02', saveJson);
    }
  });
  const { window } = dom;
  window.confirm = () => true;
  return {
    window, document: window.document,
    text: () => window.document.getElementById('app').textContent.replace(/\s+/g, ' '),
    btn: (s) => [...window.document.querySelectorAll('button')].find(b => b.textContent.includes(s)),
    click: function (s) { const b = this.btn(s); if (!b) throw new Error('button not found: ' + s + ' || ' + this.text().slice(0, 120)); b.click(); },
    state: () => JSON.parse(window.localStorage.getItem('hanazono.v02')),
    save: () => window.localStorage.getItem('hanazono.v02')
  };
}
async function playToSummary(H) {
  if (H.btn('監督に就任する')) { H.click('監督に就任する'); await sleep(20); }
  let guard = 0;
  while (guard++ < 20000) {
    const t = H.text();
    if (H.btn('新年度へ')) return true;
    if (H.btn('新年度を始める')) { H.click('新年度を始める'); await sleep(10); continue; }
    if (H.btn('次へ')) { H.click('次へ'); await sleep(8); continue; } /* v0.20 紹介画面の通過 */
    if (H.btn('目標を決めて')) { H.click('目標を決めて'); await sleep(100); continue; }
    if (H.btn('指示を確定')) { H.click('指示を確定'); await sleep(8); continue; }
    const pc = H.document.querySelector('.pcard');
    if (pc) { pc.click(); await sleep(3); continue; }
    if (H.btn('キックオフ')) { H.click('キックオフ'); await sleep(8); continue; }
    const opts = [...H.document.querySelectorAll('.choices .btn.choice')];
    if (opts.length && t.includes('成功率の目安')) {
      let best = opts[0], bp = -1;
      opts.forEach(o => { const m = o.textContent.match(/(\d+)%/); const p = m ? +m[1] : 0; if (p > bp) { bp = p; best = o; } });
      best.click(); await sleep(3); continue;
    }
    if (H.btn('試合を進める')) { H.click('試合を進める'); await sleep(3); continue; }
    if (H.btn('やった！次へ')) { H.click('やった！次へ'); await sleep(8); continue; }
    throw new Error('stuck: ' + t.slice(0, 160));
  }
  throw new Error('guard exhausted');
}
function baseState() {
  const H = jsdomLoad(null, 101);
  H.click('監督に就任する（ふつう）');
  const st = H.state();
  H.window.close();
  return st;
}
function weeklySave(mut) {
  const st = baseState();
  st.monthIdx = 0; st.goalSet = true; st.summary = null; st.recruit = null;
  st.board = { weekly: true, week: 0, log: [], dlg: null, picks: [] };
  if (mut) mut(st);
  return JSON.stringify(st);
}
/* 2か月目（5月）の月頭指示：成長レポートが出ている状態 */
async function mayInstSave() {
  const H = jsdomLoad(null, 202);
  H.click('監督に就任する（ふつう）'); await sleep(20);
  if (H.btn('目標を決めて')) { H.click('目標を決めて'); await sleep(60); }
  H.click('指示を確定'); await sleep(15);
  for (let i = 0; i < 4; i++) { const c = H.document.querySelector('.wcard'); if (c) c.click(); await sleep(10); }
  const sv = H.save();
  H.window.close();
  return sv;
}

/* ---------- ブラウザ ---------- */
async function newPage(browser, seedJson, W, H) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
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
  await sleep(650);
  /* あらすじモーダルが出ていたら閉じる（監査は背後の画面を対象にする） */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('グラウンドへ戻る'));
    if (b) b.click();
  });
  await sleep(250);
  return page;
}
const audit = (page, W, H) => page.evaluate((dims) => {
  const out = { docSW: document.documentElement.scrollWidth, docSH: document.documentElement.scrollHeight, issues: [], rects: {} };
  /* ページ全体がビューポートを超えたら「固定レイアウト崩れ」として記録する（v0.20 で追加した検出） */
  if (out.docSW > dims.W + 1 || out.docSH > dims.H + 1) out.issues.push('doc-overflow: doc is ' + out.docSW + 'x' + out.docSH + ' vs viewport ' + dims.W + 'x' + dims.H);
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
  const SEL = '#app button, #app select, #app .card, #app .hud, #app .actionbar, #app .wcard, #app .wstatus, #app .wscene, #app .log, #app .strip, #app .cmpcard, #app .banner, #app .photobanner, #app table.cmp';
  const els = [...document.querySelectorAll(SEL)].filter(e => !e.closest('.digest') && !e.closest('.toast'));
  const rs = els.map(e => ({ el: e, v: visibleRect(e) })).filter(x => x.v.width > 0 && x.v.height > 0);
  rs.forEach(x => {
    if (x.v.right > dims.W + 1 || x.v.bottom > dims.H + 1 || x.v.left < -1 || x.v.top < -1) {
      out.issues.push('overflow(visible): ' + (x.el.className || x.el.tagName) + ' [' + [x.v.left, x.v.top, x.v.right, x.v.bottom].map(Math.round).join(',') + ']');
    }
  });
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i], b = rs[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ix = Math.min(a.v.right, b.v.right) - Math.max(a.v.left, b.v.left);
    const iy = Math.min(a.v.bottom, b.v.bottom) - Math.max(a.v.top, b.v.top);
    if (ix > 2 && iy > 2) out.issues.push('overlap(visible): ' + (a.el.className || a.el.tagName) + '「' + a.el.textContent.replace(/\s+/g, ' ').slice(0, 18) + '」 <> ' + (b.el.className || b.el.tagName) + '「' + b.el.textContent.replace(/\s+/g, ' ').slice(0, 18) + '」');
  }
  ['.wscene', '.wcards', '.wstatus', '.lay2', '.log', '.dlg', '.actionbar', '.cmpcard'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) { const r = el.getBoundingClientRect(); out.rects[sel] = [r.left, r.top, r.right, r.bottom].map(Math.round); }
  });
  return out;
}, { W, H });
async function snap(page, name, W, H) {
  const a = await audit(page, W, H);
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
  const MW = 932, MH = 430;

  /* 駆動セーブ群（summary / recruit / intro） */
  const HJ = jsdomLoad(null, 20200);
  await sleep(50);
  await playToSummary(HJ);
  const saveSummary = HJ.save();
  HJ.click('新年度へ'); await sleep(25);
  const saveRecruit = HJ.save();
  const tog = HJ.btn('獲得リストに入れる'); if (tog) { tog.click(); await sleep(12); }
  HJ.click('新年度を始める'); await sleep(25);
  const saveIntro = HJ.save();
  report.facts.drive = await Promise.resolve({
    recruitCands: JSON.parse(saveRecruit).recruit.cands.length,
    introList: (JSON.parse(saveIntro).intro || { list: [] }).list.length
  });
  HJ.window.close();

  /* 01 title / 02 goal / 03 inst / 20 guide */
  const p0 = await newPage(browser, null, MW, MH);
  await snap(p0, '01_title');
  await clickText(p0, '遊び方');
  await snap(p0, '20_guide');
  await clickText(p0, '戻る');
  await clickText(p0, '監督に就任する');
  await snap(p0, '02_goal');
  await clickText(p0, '目標を決めて');
  await snap(p0, '03_inst');
  await p0.close();

  /* 04 inst（成長レポートつき・2か月目） */
  const p1 = await newPage(browser, await mayInstSave(), MW, MH);
  report.facts.mayGrow = await p1.evaluate(() => document.getElementById('app').textContent.includes('成長レポート') || document.querySelector('.grboard') != null);
  await snap(p1, '04_inst_grow');
  /* 09/10 squad（同じページから遷移） */
  await clickText(p1, '選手一覧');
  await snap(p1, '09_squad_stat');
  await clickText(p1, 'プロフィール');
  await snap(p1, '10_squad_prof');
  /* 18 records */
  await clickText(p1, '記録・OB');
  await snap(p1, '18_records');
  await p1.close();

  /* 05/06/07/08 weekly */
  const p2 = await newPage(browser, weeklySave(null), MW, MH);
  await snap(p2, '05_weekly_w1');
  await p2.close();
  const p3 = await newPage(browser, weeklySave(st => {
    st.board.week = 1; st.board.picks = ['scrum'];
    st.board.log = ['月が始まった。今週の活動を選ぼう', '🏉 スクラム強化。セットプレーが安定してきた', '🎲 選手同士で自主練が始まった'];
    st.board.dlg = { pid: st.players[0].id, text: '監督、今日のスクラムは手応えがありました。この調子でいきましょう' };
  }), MW, MH);
  await snap(p3, '06_weekly_dlg');
  await p3.close();
  const p4 = await newPage(browser, weeklySave(st => { st.monthIdx = 2; st.board.week = 2; }), MW, MH);
  await snap(p4, '07_weekly_june');
  /* 11 prematch / 12 lineup / 13 match: 週を進め切って到達 */
  for (let i = 0; i < 3; i++) await clickCard(p4, '休養・ケア');
  report.facts.reachedPreMatch = await p4.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('キックオフ')));
  await snap(p4, '11_prematch');
  await clickText(p4, 'メンバー編成');
  await snap(p4, '12_lineup');
  await clickText(p4, '試合前に戻る');
  report.facts.backToPreMatch = await p4.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('キックオフ')));
  await clickText(p4, 'キックオフ');
  for (let i = 0; i < 3; i++) await clickText(p4, '試合を進める');
  report.facts.matchStarted = await p4.evaluate(() => document.getElementById('app').textContent.includes('試合を進める') || document.getElementById('app').textContent.includes('成功率の目安'));
  await snap(p4, '13_match');
  await p4.close();
  const p5 = await newPage(browser, weeklySave(st => { st.monthIdx = 4; }), MW, MH);
  await snap(p5, '08_weekly_august');
  await p5.close();

  /* 14 summary / 15 recruit cards / 16 recruit cmp / 17 intro */
  const p6 = await newPage(browser, saveSummary, MW, MH);
  await snap(p6, '14_summary');
  await clickText(p6, '新年度へ');
  await snap(p6, '15_recruit_cards');
  await clickText(p6, '比較で見る');
  await snap(p6, '16_recruit_cmp');
  await p6.close();
  const p7 = await newPage(browser, saveIntro, MW, MH);
  await snap(p7, '17_intro');
  await p7.close();

  /* 補助（1060×600）: 週次（会話）・勧誘比較・紹介 */
  const q1 = await newPage(browser, weeklySave(st => {
    st.board.week = 1;
    st.board.log = ['月が始まった。今週の活動を選ぼう', '🏉 スクラム強化。セットプレーが安定してきた'];
    st.board.dlg = { pid: st.players[0].id, text: '監督、今日のスクラムは手応えがありました' };
  }), 1060, 600);
  await snap(q1, 's_weekly_dlg_1060', 1060, 600);
  await q1.close();
  const q2 = await newPage(browser, saveRecruit, 1060, 600);
  await clickText(q2, '比較で見る');
  await snap(q2, 's_recruit_cmp_1060', 1060, 600);
  await q2.close();
  const q3 = await newPage(browser, saveIntro, 1060, 600);
  await snap(q3, 's_intro_1060', 1060, 600);
  await q3.close();

  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'report.json'), JSON.stringify(report, null, 2));
  const bad = Object.entries(report.screens).filter(([, s]) => s.issues.length);
  console.log('errors:', report.errors.length, '| screens:', Object.keys(report.screens).length, '| screens with issues:', bad.map(([n]) => n).join(', ') || 'none');
  bad.forEach(([n, s]) => { console.log('=== ' + n); s.issues.forEach(i => console.log('  ' + i)); });
})().catch(e => { console.error('ERROR', e); process.exit(2); });
