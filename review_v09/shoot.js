/* v0.9 実ブラウザレビュー撮影: タイトル（難易度） / 目標設定 / 記録室 / 帝都スカウティング / 指示画面の目標・設備カード */
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '..', 'review-tools', 'node_modules', 'puppeteer-core'));

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function lcg(seed) { let s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

async function newPage(browser, seed, saveJson) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1060, height: 600 });
  page.on('console', m => { if (m.type() === 'error') report.errors.push('console: ' + m.text()); });
  page.on('pageerror', e => report.errors.push('pageerror: ' + e.message));
  await page.evaluateOnNewDocument((s, sv) => {
    if (sv) { try { localStorage.setItem('hanazono.v02', sv); } catch (e) {} }
    Math.random = (function () { let x = s >>> 0 || 1; return function () { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; })();
  }, seed, saveJson || null);
  await page.goto('file://' + path.join(ROOT, 'v02', 'play.html'), { waitUntil: 'load' });
  await sleep(500);
  return page;
}
const appText = (page) => page.evaluate(() => document.getElementById('app').textContent.replace(/\s+/g, ' '));
const clickBtn = (page, sub) => page.evaluate((s) => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(s));
  if (b) { b.click(); return true; } return false;
}, sub);
const metrics = (page) => page.evaluate(() => ({ docSW: document.documentElement.scrollWidth, docSH: document.documentElement.scrollHeight }));
const getSave = (page) => page.evaluate(() => localStorage.getItem('hanazono.v02'));
const report = { errors: [] };

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox'] });

  /* 1) タイトル（難易度選択） */
  const p0 = await newPage(browser, 4242, null);
  report.titleDifficulties = (await appText(p0)).includes('ふつう') && (await appText(p0)).includes('チャレンジ');
  await p0.screenshot({ path: path.join(SHOTS, '01_title_difficulty.png') });
  report.metricsTitle = await metrics(p0);

  /* 2) 目標設定画面 */
  await clickBtn(p0, '監督に就任する（ふつう）'); await sleep(400);
  const gt = await appText(p0);
  report.goalScreen = gt.includes('目標を決めよう') && gt.includes('おすすめ');
  report.metricsGoal = await metrics(p0);
  await p0.screenshot({ path: path.join(SHOTS, '02_goal.png') });
  await clickBtn(p0, '花園優勝'); await sleep(300);
  report.goalPicked = (await appText(p0)).includes('選択中');
  await p0.screenshot({ path: path.join(SHOTS, '03_goal_picked.png') });
  const baseSave = await getSave(p0);
  await p0.close();

  /* 3) 記録室（設備・歴代・通算）と指示画面のカード: 実績のある2年目の状態を作る */
  const st = JSON.parse(baseSave);
  st.rep = 125; st.year = 2; st.monthIdx = 0; st.board = null; st.summary = null; st.recruit = null;
  st.goalSet = true; st.goal = 'hanawin';
  st.history = [{ year: 1, power: 80.6, result: '花園出場' }];
  st.facSeen = ['weights', 'video'];
  st.rivalW = 0; st.rivalL = 1; st.rivalLast = 'lose';
  st.players.forEach((p, i) => { p.crec = { tries: (i % 4), plays: (i % 3) + 1 }; p.srec = { tries: 0, plays: 0 }; });
  st.obs = [{ name: '山田 太郎', pos: 'SO', avg: 71, year: 1, tries: 5, plays: 9 }];
  const p1 = await newPage(browser, 777, JSON.stringify(st));
  report.instGoalCard = (await appText(p1)).includes('今年の目標') && (await appText(p1)).includes('花園で1勝');
  report.instFacCard = (await appText(p1)).includes('ウェイト場');
  await p1.screenshot({ path: path.join(SHOTS, '06_inst_cards.png') });
  await clickBtn(p1, '記録・OB'); await sleep(400);
  const rt = await appText(p1);
  report.recordsRich = rt.includes('設備') && rt.includes('歴代チーム') && rt.includes('歴代最強') && rt.includes('通算スタッツ') && rt.includes('帝都学園との通算');
  report.recordsObStats = rt.includes('トライ 5');
  report.metricsRecords = await metrics(p1);
  await p1.screenshot({ path: path.join(SHOTS, '04_records.png') });
  await p1.close();

  /* 4) 帝都スカウティング（エース3年・昨年敗北の因縁） */
  const st2 = JSON.parse(baseSave);
  st2.monthIdx = 8; st2.board = null; st2.summary = null; st2.recruit = null;
  st2.goalSet = true;
  st2.rival = { name: '白鳥 圭', pos: 'SO', skill: 'big', grade: 3 };
  st2.rivalW = 0; st2.rivalL = 1; st2.rivalLast = 'lose';
  st2.players.forEach(p => { for (const k in p.stats) p.stats[k] = 75; p.fatigue = 0; p.injured = 0; });
  const p2 = await newPage(browser, 99, JSON.stringify(st2));
  let guard = 0;
  while (guard++ < 60) {
    if (await p2.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('キックオフ')))) break;
    if (await clickBtn(p2, '指示を確定')) { await sleep(200); continue; }
    const pc = await p2.evaluate(() => { const c = document.querySelector('.pcard'); if (c) { c.click(); return true; } return false; });
    if (pc) { await sleep(120); continue; }
    break;
  }
  const pt = await appText(p2);
  report.rivalScout = pt.includes('白鳥 圭') && pt.includes('3年') && pt.includes('帝都との通算');
  report.rivalGrudge = pt.includes('雪辱');
  report.metricsPreMatch = await metrics(p2);
  await p2.screenshot({ path: path.join(SHOTS, '05_rival_scout.png') });
  await p2.close();

  await browser.close();
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error('SHOOT ERROR', e); process.exit(1); });
