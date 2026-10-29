/* v0.5 review: portraits (list/detail/gallery), match cut-in, dialogue, recruit portraits, seasonal banners. */
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
  sw: document.documentElement.scrollWidth, appSw: document.getElementById('app').scrollWidth,
  squadScrollW: (document.querySelector('table.squad') || {}).scrollWidth || null
}));
async function autoStep(page) {
  const t = await appText(page);
  if (await clickText(page, '新年度を始める')) { await sleep(50); return 'recruit-done'; }
  if (await clickText(page, '指示を確定')) { await sleep(50); return 'inst'; }
  const pc = await page.evaluate(() => { const e = document.querySelector('.pcard'); if (e) { e.click(); return true; } return false; });
  if (pc) { await sleep(25); return 'card'; }
  if (await clickText(page, 'キックオフ')) { await sleep(60); return 'kickoff'; }
  const scene = await page.evaluate(() => {
    const opts = [...document.querySelectorAll('.choices .btn.choice')];
    if (!opts.length) return null;
    const cut = document.querySelector('.cutin');
    return { n: opts.length, cutin: !!cut };
  });
  if (scene) return 'scene';
  if (await clickText(page, '試合を進める')) { await sleep(25); return 'block'; }
  if (await clickText(page, 'やった！次へ')) { await sleep(50); return 'next'; }
  if (await clickText(page, '次へ')) { await sleep(50); return 'next'; }
  return 'stuck:' + t.slice(0, 120);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox'] });
  const report = { errors };

  /* --- 立ち絵ギャラリー: 新規ゲーム→選手一覧→詳細を拡大撮影 --- */
  const page = await newPage(browser, 20261029);
  await clickText(page, '監督に就任する'); await sleep(150);
  const baseSave = await page.evaluate(() => localStorage.getItem('hanazono.v02'));
  await clickText(page, '選手一覧'); await sleep(200);
  report.squadMetrics = await metrics(page);
  await page.screenshot({ path: OUT + '/01_squad_list.png' });
  const nRows = await page.evaluate(() => document.querySelectorAll('tr.prow').length);
  const galleryIdx = [0, 1, 3, 5, 8, 10, 13, 16];
  for (const i of galleryIdx) {
    if (i >= nRows) break;
    await page.evaluate((ix) => { document.querySelectorAll('tr.prow')[ix].click(); }, i);
    await sleep(120);
    await page.evaluate(() => {
      const d = document.querySelector('.detail-p');
      if (d) { d.style.width = '240px'; d.style.height = '288px'; }
    });
    const el = await page.$('.detail-p');
    if (el) await el.screenshot({ path: OUT + '/gallery_' + String(i).padStart(2, '0') + '.png' });
    if (i === galleryIdx[0]) await page.screenshot({ path: OUT + '/02_squad_detail.png' });
  }
  report.playersSample = (await getState(page)).players.slice(0, 18).map(p => ({ name: p.name, pos: p.posIdx, person: p.person, w: p.w }));

  /* --- 試合カットインまで自動プレイ --- */
  await clickText(page, '戻る'); await sleep(120);
  let guard = 0, cutinShot = false;
  while (guard++ < 3000 && !cutinShot) {
    const r = await autoStep(page);
    if (r === 'scene') {
      const hasCut = await page.evaluate(() => !!document.querySelector('.cutin'));
      if (hasCut) { await page.screenshot({ path: OUT + '/03_match_cutin.png' }); cutinShot = true; }
      else {
        await page.evaluate(() => { const o = document.querySelector('.choices .btn.choice'); if (o) o.click(); });
        await sleep(40);
      }
    }
    if (r.startsWith('stuck')) { report.stuck = r; break; }
  }
  report.cutinShot = cutinShot;
  await page.close();

  /* --- 会話劇: dlg 入り盤面セーブ --- */
  {
    const st = JSON.parse(baseSave);
    const talker = st.players.find(p => p.person === '熱血') || st.players[3];
    st.board = {
      cells: [{ t: 'pS', done: false }, { t: 'ev', done: true }, { t: 'end', done: false }], pos: 1, hand: [1, 2, 3],
      log: ['🎲 ' + talker.name + 'が自主練に皆を誘い、チームの士気が上がった（次の試合 +3）'],
      dlg: { pid: talker.id, text: 'みんな、もう1セットいこう！ 声出していけ！' }
    };
    st.summary = null; st.recruit = null;
    const p2 = await newPage(browser, null, JSON.stringify(st));
    await p2.screenshot({ path: OUT + '/04_board_dialogue.png' });
    await p2.close();
  }

  /* --- 季節バナー: 8月・12月の指示画面 --- */
  for (const [mi, label] of [[4, 'aug'], [8, 'dec']]) {
    const st = JSON.parse(baseSave);
    st.monthIdx = mi; st.board = null; st.summary = null; st.recruit = null;
    const p3 = await newPage(browser, null, JSON.stringify(st));
    await p3.screenshot({ path: OUT + '/05_inst_' + label + '.png' });
    await p3.close();
  }

  /* --- 勧誘画面の立ち絵: 1シーズン回して到達 --- */
  {
    const p4 = await newPage(browser, 555444);
    await clickText(p4, '監督に就任する'); await sleep(120);
    let g2 = 0, reached = false;
    while (g2++ < 4000) {
      const t = await appText(p4);
      if (t.includes('新入生を迎える')) { reached = true; break; }
      if (t.includes('新年度へ')) { await clickText(p4, '新年度へ'); await sleep(150); reached = true; break; }
      const r = await autoStep(p4);
      if (r === 'scene') {
        await p4.evaluate(() => {
          const opts = [...document.querySelectorAll('.choices .btn.choice')];
          let best = opts[0], bp = -1;
          opts.forEach(o => { const m = o.textContent.match(/(\d+)%/); const p = m ? +m[1] : 0; if (p > bp) { bp = p; best = o; } });
          if (best) best.click();
        });
        await sleep(40);
      }
      if (r.startsWith('stuck')) break;
    }
    report.recruitReached = reached;
    if (reached) await p4.screenshot({ path: OUT + '/06_recruit_portraits.png' });
    await p4.close();
  }

  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch(e => { console.error('ERROR', e.message, '| errors:', JSON.stringify(errors)); process.exit(2); });
