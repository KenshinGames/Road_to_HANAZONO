/* v0.11 実ブラウザレビュー撮影: シーンイラスト4枚の組み込み＋調子の色分け
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
  /* 再開時あらすじが出ていたら閉じる */
  await clickText(page, 'グラウンドへ戻る');
  return page;
}
const metrics = (page) => page.evaluate(() => ({
  docSW: document.documentElement.scrollWidth, docSH: document.documentElement.scrollHeight,
  bodyText: document.getElementById('app').textContent.replace(/\s+/g, ' ').slice(0, 300)
}));
const clickText = async (page, sub) => {
  const ok = await page.evaluate((s) => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(s));
    if (b) { b.click(); return true; } return false;
  }, sub);
  await sleep(450);
  return ok;
};
const has = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox'] });

  /* 1) 優勝エンディング（全面写真） */
  const sChamp = seed(st => {
    st.summary = {
      result: '🏆 花園優勝！', wins: 12, losses: 0,
      goalEval: { ok: true, delta: 12, text: '🎯 シーズン目標「花園優勝」達成！ 評判+12' },
      grade: '強豪', firstHana: false,
      grads: [{ name: '佐藤 蓮', pos: 'PR', avg: 84 }, { name: '鈴木 翼', pos: 'FB', avg: 81 }, { name: '高橋 蒼', pos: 'SO', avg: 79 }],
      stars: [{ name: '山本 陸', pos: 'WTB', tries: 8, plays: 4 }, { name: '中村 圭', pos: 'No8', tries: 5, plays: 6 }]
    };
    st.board = null; st.recruit = null; st.qualified = true;
    st.career.hana = 3; st.career.hanaTitles = 1;
  });
  const p1 = await newPage(browser, sChamp);
  report.champion = await metrics(p1);
  report.championFull = await has(p1, '.photofull.photo-champion');
  report.championBgLoaded = await p1.evaluate(() => {
    const el = document.querySelector('.photofull');
    return el ? getComputedStyle(el).backgroundImage.slice(0, 40) : 'none';
  });
  await p1.screenshot({ path: path.join(SHOTS, '01_champion.png') });
  await p1.close();

  /* 2) 通常のシーズンサマリー（卒業ヒーロー） */
  const sGrad = seed(st => {
    st.summary = {
      result: '予選決勝敗退', wins: 3, losses: 1,
      goalEval: { ok: false, delta: -3, text: '🎯 シーズン目標「花園出場」には届かなかった（評判-3）' },
      grade: 'そこそこ', firstHana: false,
      grads: [{ name: '佐藤 蓮', pos: 'PR', avg: 78 }, { name: '鈴木 翼', pos: 'FB', avg: 74 }],
      stars: [{ name: '山本 陸', pos: 'WTB', tries: 4, plays: 2 }]
    };
    st.board = null; st.recruit = null; st.qualified = false;
  });
  const p2 = await newPage(browser, sGrad);
  report.graduation = await metrics(p2);
  report.graduationHero = await has(p2, '.photobanner.photo-graduation');
  await p2.screenshot({ path: path.join(SHOTS, '02_graduation.png') });
  await p2.close();

  /* 3) 8月：月頭指示（合宿写真バナー）→ 盤面 */
  const sAug = seed(st => { st.monthIdx = 4; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null; });
  const p3 = await newPage(browser, sAug);
  report.august = await metrics(p3);
  report.augustCamp = await has(p3, '.photobanner.photo-camp');
  await p3.screenshot({ path: path.join(SHOTS, '03_august_inst.png') });
  await clickText(p3, '指示を確定');
  report.augustBoard = await metrics(p3);
  await p3.screenshot({ path: path.join(SHOTS, '04_august_board.png') });
  await p3.close();

  /* 4) 花園の試合：preMatch（雨バナー）→ 試合画面 */
  const sHana = seed(st => {
    st.monthIdx = 9; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null; st.qualified = true;
    st.players.forEach(p => { Object.keys(p.stats).forEach(k => { p.stats[k] = 75; }); p.fatigue = 10; });
  });
  const p4 = await newPage(browser, sHana);
  await clickText(p4, '指示を確定');
  let reached = false;
  for (let i = 0; i < 80 && !reached; i++) {
    reached = await p4.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('キックオフ')));
    if (reached) break;
    const clicked = await p4.evaluate(() => {
      const c = document.querySelector('.pcard');
      if (c) { c.click(); return true; } return false;
    });
    if (!clicked) break;
    await sleep(260);
  }
  report.hanaPreMatchReached = reached;
  report.hanaRain = await has(p4, '.photobanner.photo-rain');
  report.hana = await metrics(p4);
  await p4.screenshot({ path: path.join(SHOTS, '05_hanazono_prematch.png') });
  await clickText(p4, 'キックオフ');
  report.match = await metrics(p4);
  await p4.screenshot({ path: path.join(SHOTS, '06_hanazono_match.png') });
  await p4.close();

  /* 5) 選手一覧：調子がばらけた状態でチップの色を確認 */
  const sForm = seed(st => {
    const vs = [-2, -1, 0, 1, 2];
    st.players.forEach((p, i) => { p.form = vs[i % 5]; });
    st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
  });
  const p5 = await newPage(browser, sForm);
  await clickText(p5, '選手一覧');
  report.squad = await metrics(p5);
  report.squadChips = await p5.evaluate(() => [...document.querySelectorAll('.formchip')].map(c => c.textContent + '|' + c.getAttribute('style')));
  await p5.screenshot({ path: path.join(SHOTS, '07_squad_forms.png') });
  await p5.close();

  await browser.close();
  console.log(JSON.stringify(report, null, 1));
})().catch(e => { console.error('ERROR', e); process.exit(1); });
