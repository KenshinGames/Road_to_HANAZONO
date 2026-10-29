/* v0.16 実ブラウザレビュー撮影: 試合の采配（後半の戦術変更／PGキッカー指名／エースのマーク指示／交代警告）
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
function flat(st, v) {
  st.players.forEach(p => {
    Object.keys(p.stats).forEach(k => { p.stats[k] = v; });
    p.fatigue = 0; p.form = 0; p.trust = 50; p.injured = 0; p.injSev = null; p.injPart = null; p.justBack = false;
  });
}
/* 対戦確認（予選決勝・帝都戦）：キッカー候補の段階表示が見えるように PR のキックを高くする */
function preMatchSave() {
  const st = baseSave();
  st.monthIdx = 8; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
  flat(st, 62);
  const pr = st.players.find(p => p.posIdx === 0);
  pr.stats.kik = 85; pr.skills = ['kick'];
  return JSON.stringify(st);
}
/* 警告表示用：スタメン先頭にケガ明け、2人目に疲労＋不調、控えに疲労／不調を持たせる */
function warnSave() {
  const st = baseSave();
  st.monthIdx = 8; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
  flat(st, 62);
  const S = st.players.slice(0, 15), B = st.players.slice(15, 18);
  st.lineup = S.map(p => p.id);
  S[0].justBack = true;
  S[1].fatigue = 85; S[1].form = -2;
  B[0].fatigue = 90;
  B[1].form = -1;
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
  await sleep(350);
  return ok;
};
/* 対戦確認画面まで進める（月頭指示→すごろく→試合日） */
async function toPreMatch(page) {
  for (let i = 0; i < 120; i++) {
    const st = await page.evaluate(() => {
      const t = document.getElementById('app').textContent;
      if (t.includes('キックオフ') && [...document.querySelectorAll('button')].some(b => b.textContent.includes('キックオフ'))) return 'pre';
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
/* 試合中：述語が真になるまで「試合を進める／先頭の選択肢」を押し続ける */
async function driveMatch(page, predFn, arg) {
  for (let i = 0; i < 200; i++) {
    const done = await page.evaluate(predFn, arg);
    if (done) return true;
    const acted = await page.evaluate(() => {
      const t = document.getElementById('app').textContent;
      const cs = [...document.querySelectorAll('.choices .btn.choice')];
      if (cs.length && t.includes('成功率の目安')) { cs[0].click(); return 'choice'; }
      const adv = [...document.querySelectorAll('button')].find(b => b.textContent.includes('試合を進める'));
      if (adv) { adv.click(); return 'adv'; }
      return 'wait';
    });
    if (acted === 'wait') await sleep(250);
    else await sleep(160);
  }
  return false;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox'] });

  /* 01: 対戦確認：キッカー＆マーク指名カード（キッカーとマークマンを選択した状態） */
  const p1 = await newPage(browser, preMatchSave());
  report.preReached = await toPreMatch(p1);
  report.prep = await p1.evaluate(() => {
    const sels = document.querySelectorAll('select');
    if (sels.length < 2) return { selects: sels.length };
    const kopts = [...sels[0].querySelectorAll('option')].map(o => o.textContent);
    /* キッカーはキック値の高い PR（◎のはず）を、マークは先頭のスタメンを選ぶ */
    const prOpt = [...sels[0].querySelectorAll('option')].find(o => o.textContent.startsWith('◎'));
    if (prOpt) { sels[0].value = prOpt.value; sels[0].onchange(); }
    const first = sels[1].querySelectorAll('option')[1];
    if (first) { sels[1].value = first.value; sels[1].onchange(); }
    return {
      selects: sels.length,
      kickerOptions: kopts.length,
      marks: [...new Set(kopts.map(t => t[0]))].join(''),
      anyPct: kopts.some(t => t.includes('%')),
      kickerVal: sels[0].value, markVal: sels[1].value
    };
  });
  await sleep(300);
  report.m1 = await metrics(p1);
  await p1.screenshot({ path: path.join(SHOTS, '01_prematch_prep.png') });

  /* 02: ハーフタイム後の戦術変更プロンプト（同じ試合をそのまま進める） */
  await clickText(p1, 'キックオフ');
  report.httacReached = await driveMatch(p1, () => {
    return [...document.querySelectorAll('button')].some(b => b.textContent.includes('変更しない'));
  });
  report.httac = await p1.evaluate(() => {
    const cs = [...document.querySelectorAll('.choices .btn.choice')].map(b => b.textContent.replace(/\s+/g, ' ').slice(0, 60));
    const log = [...document.querySelectorAll('.log > div')].map(d => d.textContent);
    return { choices: cs, markLog: log.filter(l => l.includes('マーク指示') || l.includes('PGキッカーは')) };
  });
  report.m2 = await metrics(p1);
  await p1.screenshot({ path: path.join(SHOTS, '02_halftime_tactics.png') });
  await clickText(p1, 'BKで展開する');
  report.planLog = await p1.evaluate(() => [...document.querySelectorAll('.log > div')].map(d => d.textContent).filter(l => l.includes('切り替えた')));
  await p1.close();

  /* 03: 交代パネルの警告（OUT一覧） */
  const p2 = await newPage(browser, warnSave());
  await toPreMatch(p2);
  await clickText(p2, 'キックオフ');
  report.sceneReached = await driveMatch(p2, () => {
    return document.querySelectorAll('.subbtn').length > 0;
  });
  report.warnOut = await p2.evaluate(() => [...document.querySelectorAll('.subbtn')].slice(0, 4).map(b => b.textContent.replace(/\s+/g, ' ')));
  report.m3 = await metrics(p2);
  await p2.screenshot({ path: path.join(SHOTS, '03_subpanel_out_warn.png') });

  /* 04: 交代パネル（IN一覧：控えの警告） */
  await p2.evaluate(() => {
    const tagged = [...document.querySelectorAll('.subbtn')].find(b => b.textContent.includes('ケガ明け'));
    if (tagged) tagged.click();
  });
  await sleep(400);
  report.warnIn = await p2.evaluate(() => [...document.querySelectorAll('.subbtn')].slice(0, 4).map(b => b.textContent.replace(/\s+/g, ' ')));
  await p2.screenshot({ path: path.join(SHOTS, '04_subpanel_in_warn.png') });
  await p2.close();

  /* 05: 編成画面の控え一覧の警告 */
  const p3 = await newPage(browser, warnSave());
  await toPreMatch(p3);
  await clickText(p3, 'メンバー編成');
  await p3.evaluate(() => {
    const row = document.querySelectorAll('table.squad tr')[1];
    if (row) row.click();
  });
  await sleep(400);
  report.warnLineup = await p3.evaluate(() => [...document.querySelectorAll('.subbtn')].slice(0, 3).map(b => b.textContent.replace(/\s+/g, ' ')));
  report.m5 = await metrics(p3);
  await p3.screenshot({ path: path.join(SHOTS, '05_lineup_warn.png') });
  await p3.close();

  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error('SHOOT ERROR', e); process.exit(1); });
