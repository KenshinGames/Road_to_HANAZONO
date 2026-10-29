/* v0.8 review: lineup formation screen, injured bench, substitution panel in a match, form display. */
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
const appText = (page) => page.evaluate(() => document.getElementById('app').textContent.replace(/\s+/g, ' '));
const metrics = (page) => page.evaluate(() => ({ docSW: document.documentElement.scrollWidth, docSH: document.documentElement.scrollHeight }));
const getSave = (page) => page.evaluate(() => localStorage.getItem('hanazono.v02'));
const clickRow = (page, i) => page.evaluate((ix) => { const r = document.querySelectorAll('tr.prow')[ix]; if (r) { r.click(); return true; } return false; }, i);
const clickBtnIdx = (page, sub, i) => page.evaluate((s, ix) => {
  const bs = [...document.querySelectorAll('button')].filter(b => b.textContent.includes(s));
  if (bs[ix]) { bs[ix].click(); return true; } return false;
}, sub, i);

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox'] });
  const report = { errors };

  /* base save */
  const p0 = await newPage(browser, 777);
  await clickText(p0, '監督に就任する'); await sleep(120);
  const baseSave = await getSave(p0);
  await p0.close();

  /* December save -> preMatch -> lineup */
  const st = JSON.parse(baseSave);
  st.monthIdx = 8; st.summary = null; st.recruit = null;
  st.board = { cells: [{ t: 'end', done: false }], pos: -1, hand: [1], log: [] };
  /* 控えの1人を重症にして「選べない」表示も撮る（自動選出の再現で控えを特定） */
  const ov = p => Object.values(p.stats).reduce((a, b) => a + b, 0) / 6;
  const used = new Set();
  for (let n = 0; n < 15; n++) {
    const cands = st.players.filter(p => p.posIdx === n && !used.has(p.id)).sort((a, b) => ov(b) - ov(a));
    const chosen = cands.find(p => !p.injured) || cands[0];
    if (chosen) used.add(chosen.id);
  }
  const benchP = st.players.filter(p => !used.has(p.id))[0];
  if (benchP) { benchP.injured = 2; benchP.injSev = 'heavy'; benchP.injPart = '右肩'; }
  const p1 = await newPage(browser, 4242, JSON.stringify(st));
  const pc = await p1.evaluate(() => { const c = document.querySelector('.pcard'); if (c) { c.click(); return true; } return false; });
  await sleep(150);
  report.preMatchLineupStatus = (await appText(p1)).includes('スタメン編成');
  await clickText(p1, 'メンバー編成'); await sleep(150);
  report.lineupScreen = (await appText(p1)).includes('控えメンバー');
  await p1.screenshot({ path: OUT + '/01_lineup.png' });
  report.metricsLineup = await metrics(p1);
  /* スタメン1行を選んで控えリストを開いた状態 */
  await clickRow(p1, 0); await sleep(120);
  await p1.screenshot({ path: OUT + '/02_lineup_selected.png' });
  /* 実際に入れ替えてカスタム編成にする */
  await clickBtnIdx(p1, 'IN ', 0); await sleep(120);
  const stAfter = JSON.parse(await getSave(p1));
  report.lineupSaved = Array.isArray(stAfter.lineup) && stAfter.lineup.length === 15;
  await clickText(p1, '試合前に戻る'); await sleep(120);
  report.customLabel = (await appText(p1)).includes('カスタム編成');

  /* キックオフして最初の停止点で交代パネルを撮る */
  await clickText(p1, 'キックオフ'); await sleep(150);
  let guard = 0, atScene = false;
  while (guard++ < 60) {
    const t = await appText(p1);
    if (t.includes('成功率の目安') && t.includes('選手交代（残り5回）')) { atScene = true; break; }
    if (!(await clickText(p1, '試合を進める'))) break;
    await sleep(60);
  }
  report.atSceneWithSubs = atScene;
  await p1.screenshot({ path: OUT + '/03_match_subpanel.png' });
  report.metricsMatch = await metrics(p1);
  /* OUTを選んでIN候補を出した状態 */
  await clickBtnIdx(p1, 'OUT ', 0); await sleep(120);
  await p1.screenshot({ path: OUT + '/04_match_sub_in.png' });
  /* 交代実行 */
  await clickBtnIdx(p1, 'IN ', 0); await sleep(120);
  report.subLogged = (await appText(p1)).includes('🔁 交代');
  report.subCount4 = (await appText(p1)).includes('選手交代（残り4回）');
  await p1.close();

  /* 選手一覧の調子アイコンと詳細の調子行 */
  const p2 = await newPage(browser, null, baseSave);
  await clickText(p2, '選手一覧'); await sleep(150);
  const tSquad = await appText(p2);
  report.squadFormIcon = ['💀', '😞', '😐', '😊', '🔥'].some(ic => tSquad.includes(ic));
  await p2.screenshot({ path: OUT + '/05_squad_form.png' });
  await clickRow(p2, 0); await sleep(120);
  report.detailForm = (await appText(p2)).includes('調子');
  await p2.screenshot({ path: OUT + '/06_detail_form.png' });
  report.metricsSquad = await metrics(p2);
  await p2.close();

  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (errors.length) { console.log('ERRORS:', errors); process.exit(1); }
})().catch(e => { console.error('FATAL', e.message); process.exit(2); });
