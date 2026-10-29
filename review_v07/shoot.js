/* v0.7 review: captain/ethos settings, injury display, growth-room bars, halftime captain cut-in. */
const puppeteer = require('/home/hatch/workspace/road-to-hanazono/review-tools/node_modules/puppeteer-core');
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
const metrics = (page) => page.evaluate(() => ({ docSW: document.documentElement.scrollWidth, docSH: document.documentElement.scrollHeight }));

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox'] });
  const report = { errors };
  const p0 = await newPage(browser, 777);
  await clickText(p0, '監督に就任する'); await sleep(120);
  const baseSave = await p0.evaluate(() => localStorage.getItem('hanazono.v02'));
  /* 01: 月頭指示（キャプテン・校風） */
  report.instText = (await appText(p0)).includes('キャプテン') && (await appText(p0)).includes('校風');
  await p0.screenshot({ path: OUT + '/01_inst_captain_ethos.png' });
  report.metricsInst = await metrics(p0);
  await p0.close();

  /* 02/03: ケガ表示と伸びしろ（重症の選手＋97能力の選手を用意） */
  const st = JSON.parse(baseSave);
  st.board = null; st.summary = null; st.recruit = null;
  st.players[1].injured = 3; st.players[1].injSev = 'heavy'; st.players[1].injPart = '左膝';
  Object.keys(st.players[0].stats).forEach(k => { st.players[0].stats[k] = 97; });
  st.players[0].stats.pow = 99;
  const p2 = await newPage(browser, null, JSON.stringify(st));
  await clickText(p2, '選手一覧'); await sleep(150);
  report.listInjury = (await appText(p2)).includes('あと3か月');
  report.listCaptain = (await appText(p2)).includes('©主将');
  await p2.screenshot({ path: OUT + '/02_squad_injury_captain.png' });
  await p2.evaluate(() => { document.querySelectorAll('tr.prow')[0].click(); });
  await sleep(150);
  const dt = await appText(p2);
  report.detailCap = dt.includes('限界間近') && dt.includes('限界');
  await p2.screenshot({ path: OUT + '/03_detail_growthroom.png' });
  report.metricsSquad = await metrics(p2);
  await p2.close();

  /* 04: ハーフタイムのキャプテンカットイン（県決勝を自動プレイ） */
  const st2 = JSON.parse(baseSave);
  st2.monthIdx = 8; st2.board = null; st2.summary = null; st2.recruit = null;
  st2.players.forEach(p => { Object.keys(p.stats).forEach(k => { p.stats[k] = 80; }); p.fatigue = 0; p.injured = 0; p.trust = 85; });
  const p3 = await newPage(browser, 31415, JSON.stringify(st2));
  let g = 0, shot = false;
  while (g++ < 3000 && !shot) {
    const t = await appText(p3);
    if (t.includes('ロッカールーム')) {
      report.halftimeCutin = await p3.evaluate(() => !!document.querySelector('.cutin'));
      await p3.screenshot({ path: OUT + '/04_halftime_captain.png' });
      shot = true; break;
    }
    if (await hasBtn(p3, '指示を確定')) { await clickText(p3, '指示を確定'); await sleep(40); continue; }
    const pc = await p3.evaluate(() => { const e = document.querySelector('.pcard'); if (e) { e.click(); return true; } return false; });
    if (pc) { await sleep(20); continue; }
    if (await hasBtn(p3, 'キックオフ')) { await clickText(p3, 'キックオフ'); await sleep(60); continue; }
    const scene = await p3.evaluate(() => {
      const opts = [...document.querySelectorAll('.choices .btn.choice')];
      if (!opts.length) return false;
      let best = opts[0], bp = -1;
      opts.forEach(o => { const m = o.textContent.match(/(\d+)%/); const p = m ? +m[1] : 0; if (p > bp) { bp = p; best = o; } });
      best.click(); return true;
    });
    if (scene) { await sleep(30); continue; }
    if (await clickText(p3, '試合を進める')) { await sleep(25); continue; }
    break;
  }
  report.halftimeShot = shot;
  report.metricsMatch = await metrics(p3);
  await p3.close();

  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch(e => { console.error('ERROR', e.message, '| errors:', JSON.stringify(errors)); process.exit(2); });
