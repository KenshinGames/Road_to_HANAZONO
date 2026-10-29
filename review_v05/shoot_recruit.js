/* v0.5 review (retry): recruit screen with portraits. Detection uses スカウト獲得枠 (recruit-only text). */
const puppeteer = require('/home/hatch/workspace/road-to-hanazono/review-tools/node_modules/puppeteer-core');
const OUT = __dirname + '/screenshots';
const URL = 'file:///home/hatch/workspace/road-to-hanazono/v02/play.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
function lcgSrc(seed) {
  return '(function(){ let s = ' + seed + ' >>> 0; return function(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })()';
}
const clickText = (page, sub) => page.evaluate((s) => {
  const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes(s));
  if (b) { b.click(); return true; } return false;
}, sub);
const appText = (page) => page.evaluate(() => document.getElementById('app').textContent.replace(/\s+/g, ' '));

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1060, height: 600 });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.evaluateOnNewDocument((src) => { Math.random = eval(src); }, lcgSrc(555444));
  await page.goto(URL);
  await sleep(150);
  await clickText(page, '監督に就任する'); await sleep(120);
  let guard = 0, reached = false;
  while (guard++ < 6000) {
    const t = await appText(page);
    if (t.includes('スカウト獲得枠')) { reached = true; break; }
    if (await clickText(page, '新年度へ')) { await sleep(120); continue; }
    if (await clickText(page, '新年度を始める')) { await sleep(60); continue; }
    if (await clickText(page, '指示を確定')) { await sleep(60); continue; }
    const pc = await page.evaluate(() => { const e = document.querySelector('.pcard'); if (e) { e.click(); return true; } return false; });
    if (pc) { await sleep(25); continue; }
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
    throw new Error('stuck: ' + t.slice(0, 160));
  }
  console.log('recruit reached:', reached, '| errors:', JSON.stringify(errors));
  if (reached) await page.screenshot({ path: OUT + '/06_recruit_portraits.png' });
  await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
