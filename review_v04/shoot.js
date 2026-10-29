/* v0.4 review: real Chromium screenshots of the recruit flow (natural + planted-OB specials). */
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
const appText = (page) => page.evaluate(() => document.getElementById('app').textContent.replace(/\s+/g, ' '));
const getState = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('hanazono.v02')));
const metrics = (page) => page.evaluate(() => ({
  sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
  appSw: document.getElementById('app').scrollWidth
}));
async function playToSummary(page) {
  if (await clickText(page, '監督に就任する')) await sleep(120);
  let guard = 0;
  while (guard++ < 4000) {
    const t = await appText(page);
    if (t.includes('新年度へ')) return true;
    if (await clickText(page, '新年度を始める')) { await sleep(60); continue; }
    if (await clickText(page, '指示を確定')) { await sleep(60); continue; }
    const pc = await page.evaluate(() => { const e = document.querySelector('.pcard'); if (e) { e.click(); return true; } return false; });
    if (pc) { await sleep(30); continue; }
    if (await clickText(page, 'キックオフ')) { await sleep(60); continue; }
    const chose = await page.evaluate(() => {
      const opts = [...document.querySelectorAll('.choices .btn.choice')];
      if (!opts.length) return false;
      let best = opts[0], bp = -1;
      opts.forEach(o => { const m = o.textContent.match(/(\d+)%/); const p = m ? +m[1] : 0; if (p > bp) { bp = p; best = o; } });
      best.click(); return true;
    });
    if (chose) { await sleep(30); continue; }
    if (await clickText(page, '試合を進める')) { await sleep(30); continue; }
    if (await clickText(page, 'やった！次へ')) { await sleep(60); continue; }
    if (await clickText(page, '次へ')) { await sleep(60); continue; }
    throw new Error('stuck: ' + t.slice(0, 200));
  }
  throw new Error('guard exhausted');
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox'] });
  const report = { shots: [], specials: [] };

  /* --- 自然プレイで勧誘画面まで --- */
  const page = await newPage(browser, 20261029);
  await page.screenshot({ path: OUT + '/01_title.png' });
  await clickText(page, '監督に就任する'); await sleep(150);
  await page.screenshot({ path: OUT + '/02_inst.png' });
  await playToSummary(page);
  await page.screenshot({ path: OUT + '/03_summary.png' });
  const summarySave = await page.evaluate(() => localStorage.getItem('hanazono.v02'));
  await clickText(page, '新年度へ'); await sleep(200);
  report.recruitMetrics = await metrics(page);
  report.recruitText = (await appText(page)).slice(0, 400);
  await page.screenshot({ path: OUT + '/04_recruit.png' });
  /* 候補を選んでみる */
  let guard = 0;
  while (guard++ < 6) { if (!(await clickText(page, '獲得リストに入れる'))) break; await sleep(80); }
  await page.screenshot({ path: OUT + '/05_recruit_picked.png' });
  report.pickedState = (await getState(page)).recruit.cands.map(c => ({ name: c.p.name, picked: c.picked, sp: c.sp }));
  await clickText(page, '新年度を始める'); await sleep(200);
  await page.screenshot({ path: OUT + '/08_newyear_inst.png' });
  report.newYearText = (await appText(page)).slice(0, 300);
  await page.close();

  /* --- 特別枠ハント（OBを植えたサマリーセーブから勧誘だけ繰り返す） --- */
  const base = JSON.parse(summarySave);
  base.obs = [
    { name: '伝説 太郎', pos: 'LO', avg: 82, year: 1 },
    { name: '山田 一郎', pos: 'SH', avg: 70, year: 1 }
  ];
  base.rep = 120;
  const planted = JSON.stringify(base);
  const wanted = { obson: 0, transfer: 0, convert: 0, returnee: 0 };
  for (let i = 0; i < 12; i++) {
    const p2 = await newPage(browser, 5000 + i * 131, planted);
    const t = await appText(p2);
    if (!t.includes('新年度へ')) { await p2.close(); continue; }
    await clickText(p2, '新年度へ'); await sleep(180);
    const st = await getState(p2);
    if (st.recruit && st.recruit.special && !wanted[st.recruit.special.type]) {
      wanted[st.recruit.special.type] = 1;
      report.specials.push({ type: st.recruit.special.type, title: st.recruit.special.title, name: st.recruit.special.p.name });
      await p2.screenshot({ path: OUT + '/06_special_' + st.recruit.special.type + '.png' });
      await clickText(p2, '迎え入れる'); await sleep(150);
      await p2.screenshot({ path: OUT + '/07_special_' + st.recruit.special.type + '_accepted.png' });
    }
    await p2.close();
    if (Object.values(wanted).every(v => v)) break;
  }
  report.specialsFound = wanted;
  report.errors = errors;
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch(e => { console.error('ERROR', e.message, '| pageerrors:', JSON.stringify(errors)); process.exit(2); });
