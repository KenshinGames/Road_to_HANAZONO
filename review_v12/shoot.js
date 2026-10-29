/* v0.12 実ブラウザレビュー撮影: 試合の読み応え（弱点ヒント／実況／ハーフタイム／相対バー）＋調子の顔アイコン
 * 横向き 1060×600、play.html を対象にする。シードセーブは jsdom で実物を作って改変して注入する。 */
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '..', 'review-tools', 'node_modules', 'puppeteer-core'));
const { JSDOM } = require(path.join(__dirname, '..', 'test', 'node_modules', 'jsdom'));

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const report = { errors: [] };

function baseSave() {
  const html = fs.readFileSync(path.join(ROOT, 'v02', 'play.html'), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/v02/', runScripts: 'dangerously', pretendToBeVisual: true });
  const { window } = dom;
  const btn = (sub) => [...window.document.querySelectorAll('button')].find(b => b.textContent.includes(sub));
  btn('監督に就任する（ふつう）').click();
  const st = JSON.parse(window.localStorage.getItem('hanazono.v02'));
  window.close();
  return st;
}
function seed(mut) {
  const st = baseSave();
  mut(st);
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
const has = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);

/* 盤面→preMatch→キックオフまで進める */
async function toKickoff(page) {
  await clickText(page, '指示を確定');
  for (let i = 0; i < 90; i++) {
    const reached = await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('キックオフ')));
    if (reached) break;
    const clicked = await page.evaluate(() => {
      const c = document.querySelector('.pcard');
      if (c) { c.click(); return true; } return false;
    });
    if (!clicked) break;
    await sleep(240);
  }
}
/* 試合を1手進める（場面なら先頭の選択肢、そうでなければ「試合を進める」）。終了したら false */
async function stepMatch(page) {
  return page.evaluate(() => {
    const t = document.getElementById('app').textContent;
    const choices = [...document.querySelectorAll('.choices .btn.choice')];
    if (choices.length && t.includes('成功率の目安')) { choices[0].click(); return true; }
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('試合を進める'));
    if (b) { b.click(); return true; }
    return false;
  });
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox'] });

  /* 帝都戦（12月・予選決勝）：スカウティング→実況→ハーフタイム→要因バー */
  const sTeito = seed(st => {
    st.monthIdx = 8; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
    st.players.forEach(p => { Object.keys(p.stats).forEach(k => { p.stats[k] = 78; }); p.fatigue = 5; });
  });
  const p = await newPage(browser, sTeito);
  await toKickoff(p);
  report.prematch = await metrics(p);
  report.hints = await p.evaluate(() => [...document.querySelectorAll('.hint')].map(d => d.textContent));
  await p.screenshot({ path: path.join(SHOTS, '01_prematch_scout.png') });

  await clickText(p, 'キックオフ');
  /* 実況が数行たまるまで進める */
  for (let i = 0; i < 5; i++) { if (!(await stepMatch(p))) break; await sleep(320); }
  report.match = await metrics(p);
  report.logSample = await p.evaluate(() => [...document.querySelectorAll('.log > div')].map(d => d.textContent));
  await p.screenshot({ path: path.join(SHOTS, '02_match_commentary.png') });

  /* ハーフタイム（.htbox）まで進める */
  let htFound = false;
  for (let i = 0; i < 120 && !htFound; i++) {
    htFound = await has(p, '.htbox');
    if (htFound) break;
    if (!(await stepMatch(p))) break;
    await sleep(300);
  }
  report.htFound = htFound;
  report.htbox = await p.evaluate(() => {
    const el = document.querySelector('.htbox');
    return el ? el.textContent.replace(/\s+/g, ' ') : null;
  });
  report.halftime = await metrics(p);
  await p.screenshot({ path: path.join(SHOTS, '03_halftime.png') });

  /* 試合終了まで進めて要因バー */
  let doneFound = false;
  for (let i = 0; i < 160 && !doneFound; i++) {
    doneFound = await p.evaluate(() => !!document.querySelector('.frow'));
    if (doneFound) break;
    if (!(await stepMatch(p))) break;
    await sleep(300);
  }
  report.doneFound = doneFound;
  report.factors = await p.evaluate(() => [...document.querySelectorAll('.frow')].map(r => ({
    lab: r.querySelector('.flab').textContent,
    val: r.querySelector('.fval').textContent,
    style: r.querySelector('.meter > div').getAttribute('style'),
    top: r.classList.contains('ftop')
  })));
  report.factorsMetrics = await metrics(p);
  await p.screenshot({ path: path.join(SHOTS, '04_factors.png') });
  await p.close();

  /* 選手一覧：調子の顔アイコン5段階 */
  const sForm = seed(st => {
    const vs = [-2, -1, 0, 1, 2];
    st.players.forEach((pl, i) => { pl.form = vs[i % 5]; });
    st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
  });
  const p2 = await newPage(browser, sForm);
  await clickText(p2, '選手一覧');
  report.squad = await metrics(p2);
  report.faces = await p2.evaluate(() => [...document.querySelectorAll('tr.prow .formface')].slice(0, 10).map(f => ({
    form: f.getAttribute('data-form'),
    fill: f.querySelector('circle').getAttribute('fill'),
    w: f.querySelector('svg').getAttribute('width'),
    text: f.textContent
  })));
  await p2.screenshot({ path: path.join(SHOTS, '05_squad_forms.png') });
  await p2.close();

  await browser.close();
  console.log(JSON.stringify(report, null, 1));
})().catch(e => { console.error('ERROR', e); process.exit(1); });
