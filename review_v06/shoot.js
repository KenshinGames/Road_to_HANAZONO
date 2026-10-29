/* v0.6 review: scouting panel, Hanazono final, title summary, skip result. */
const puppeteer = require('/home/hatch/workspace/road-to-hanazono/review-tools/node_modules/puppeteer-core');
const fs = require('fs');
const OUT = __dirname + '/screenshots';
const URL = 'file:///home/hatch/workspace/road-to-hanazono/v02/play.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
function lcgSrc(seed) {
  return '(function(){ let s = ' + seed + ' >>> 0; return function(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })()';
}
async function newPage(browser, seed, saveJson) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1060, height: 600 });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  if (seed) await page.evaluateOnNewDocument((src) => { Math.random = eval(src); }, lcgSrc(seed));
  if (saveJson) await page.evaluateOnNewDocument((s) => { try { localStorage.setItem('hanazono.v02', s); } catch (e) {} }, saveJson);
  await page.goto(URL);
  await sleep(150);
  return page;
}
const clickText = (page, sub) => page.evaluate((s) => {
  const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes(s));
  if (b) { b.click(); return true; } return false;
}, sub);
const hasBtn = (page, sub) => page.evaluate((s) => [...document.querySelectorAll('button')].some(b => b.textContent.includes(s)), sub);
const appText = (page) => page.evaluate(() => document.getElementById('app').textContent.replace(/\s+/g, ' '));
const metrics = (page) => page.evaluate(() => ({
  docSW: document.documentElement.scrollWidth, docSH: document.documentElement.scrollHeight,
  bodyOverflow: getComputedStyle(document.body).overflow
}));
async function stepToPreMatch(page) {
  let g = 0;
  while (g++ < 600) {
    if (await hasBtn(page, 'キックオフ')) return true;
    if (await clickText(page, '指示を確定')) { await sleep(40); continue; }
    const pc = await page.evaluate(() => { const e = document.querySelector('.pcard'); if (e) { e.click(); return true; } return false; });
    if (pc) { await sleep(20); continue; }
    return false;
  }
  return false;
}
async function playMatchBest(page) {
  let g = 0;
  while (g++ < 600) {
    const t = await appText(page);
    if (t.includes('内訳')) return true;
    const scene = await page.evaluate(() => {
      const opts = [...document.querySelectorAll('.choices .btn.choice')];
      if (!opts.length) return false;
      let best = opts[0], bp = -1;
      opts.forEach(o => { const m = o.textContent.match(/(\d+)%/); const p = m ? +m[1] : 0; if (p > bp) { bp = p; best = o; } });
      best.click(); return true;
    });
    if (scene) { await sleep(25); continue; }
    if (await clickText(page, '試合を進める')) { await sleep(20); continue; }
    return false;
  }
  return false;
}
function strongSave(base, monthIdx, stat) {
  const st = JSON.parse(base);
  st.monthIdx = monthIdx; st.board = null; st.summary = null; st.recruit = null;
  st.players.forEach(p => { Object.keys(p.stats).forEach(k => { p.stats[k] = stat; }); p.fatigue = 0; p.injured = 0; p.trust = 80; });
  return JSON.stringify(st);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox'] });
  const report = { errors };
  const p0 = await newPage(browser, 4242);
  await clickText(p0, '監督に就任する'); await sleep(120);
  const baseSave = await p0.evaluate(() => localStorage.getItem('hanazono.v02'));
  await p0.close();

  /* --- 決勝→花園初戦→花園決勝→優勝サマリー --- */
  const page = await newPage(browser, 987654, strongSave(baseSave, 8, 94));
  report.toPre1 = await stepToPreMatch(page);
  report.scoutText = (await appText(page)).includes('スカウティング');
  await page.screenshot({ path: OUT + '/01_prematch_scout_final.png' });
  report.metrics1 = await metrics(page);
  await clickText(page, 'キックオフ'); await sleep(80);
  report.match1 = await playMatchBest(page);
  await clickText(page, 'やった！次へ'); await sleep(80);
  report.toPre2 = await stepToPreMatch(page);
  await page.screenshot({ path: OUT + '/02_prematch_hana1.png' });
  await clickText(page, 'キックオフ'); await sleep(80);
  report.match2 = await playMatchBest(page);
  await page.screenshot({ path: OUT + '/03_hana1_result.png' });
  await clickText(page, 'やった！次へ'); await sleep(80);
  report.toPre3 = await stepToPreMatch(page);
  const t3 = await appText(page);
  report.hanaFinalText = t3.includes('北辰学園') && t3.includes('花園 決勝');
  await page.screenshot({ path: OUT + '/04_prematch_hana_final.png' });
  await clickText(page, 'キックオフ'); await sleep(80);
  report.match3 = await playMatchBest(page);
  await clickText(page, 'やった！次へ'); await sleep(120);
  const tSum = await appText(page);
  report.summaryTitle = tSum.includes('花園優勝');
  report.summaryStars = tSum.includes('今季の活躍');
  report.metricsSum = await metrics(page);
  await page.screenshot({ path: OUT + '/05_summary_title.png' });
  await page.close();

  /* --- スキップ結果 --- */
  const p2 = await newPage(browser, 13579, strongSave(baseSave, 2, 75));
  report.toPreSkip = await stepToPreMatch(p2);
  report.skipOffered = await hasBtn(p2, '結果のみ表示（スキップ）');
  await clickText(p2, '結果のみ表示（スキップ）'); await sleep(150);
  const tSkip = await appText(p2);
  report.skipLog = tSkip.includes('時短') && tSkip.includes('最終スコア');
  report.skipFactors = tSkip.includes('内訳');
  report.metricsSkip = await metrics(p2);
  await p2.screenshot({ path: OUT + '/06_skip_result.png' });
  await p2.close();

  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch(e => { console.error('ERROR', e.message, '| errors:', JSON.stringify(errors)); process.exit(2); });
