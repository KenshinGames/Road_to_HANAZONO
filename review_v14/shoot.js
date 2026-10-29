/* v0.14 実ブラウザレビュー撮影: 記録の深化（シーズン別成績／対戦校別成績／歴代キャプテン／OB名鑑の拡充）
 * 横向き 1060×600、play.html を対象にする。表示に使うセーブは jsdom で実際にシーズンを回して作ったものと、
 * 旧セーブ形式（新フィールドなし）を模した移行確認用セーブ。本番コードにデバッグ導線は入れていない。 */
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
  const st = h.state();
  dom.window.close();
  return st;
}
/* 強いチームで1シーズンを実際に回し、新年度（卒業・引き継ぎ）まで進めたセーブを作る */
async function richSave() {
  const st = baseSave();
  st.players.forEach(p => { for (const k in p.stats) p.stats[k] = 92; p.fatigue = 0; p.injured = 0; });
  st.goal = 'win1';
  const senior = st.players.find(p => p.year === 3);
  senior.futurePath = '実業団へ就職';
  const dom = jsdomWith(JSON.stringify(st));
  const h = helpers(dom.window);
  await sleep(80);
  let guard = 0;
  while (guard++ < 6000) {
    const t = h.text();
    if (t.includes('シーズン終了')) break;
    if (h.btn('目標を決めて')) { h.click('目標を決めて'); await sleep(3); continue; }
    if (h.btn('指示を確定')) { h.click('指示を確定'); await sleep(3); continue; }
    const pc = dom.window.document.querySelector('.pcard');
    if (pc) { pc.click(); await sleep(2); continue; }
    if (h.btn('結果のみ表示（スキップ）')) { h.click('結果のみ表示（スキップ）'); await sleep(3); continue; }
    if (h.btn('キックオフ')) { h.click('キックオフ'); await sleep(3); continue; }
    const opts = [...dom.window.document.querySelectorAll('.choices .btn.choice')];
    if (opts.length && t.includes('成功率の目安')) {
      let best = opts[0], bp = -1;
      opts.forEach(o => { const m = o.textContent.match(/(\d+)%/); const p2 = m ? +m[1] : 0; if (p2 > bp) { bp = p2; best = o; } });
      best.click(); await sleep(2); continue;
    }
    if (h.btn('試合を進める')) { h.click('試合を進める'); await sleep(2); continue; }
    if (h.btn('次へ')) { h.click('次へ'); await sleep(2); continue; }
    break;
  }
  const atSummary = h.state();
  h.click('新年度へ'); await sleep(30);
  let cur = h.state();
  dom.window.close();
  /* 歴代キャプテンをもう1人分、実際の記録ロジック（読み込み時の sanitize）で増やす：別選手をキャプテンにして読み直す */
  const other = cur.players.find(p => p.id !== cur.captainId);
  if (other) {
    cur.captainId = other.id;
    const dom2 = jsdomWith(JSON.stringify(cur));
    await sleep(60);
    cur = helpers(dom2.window).state();
    dom2.window.close();
  }
  return { json: JSON.stringify(cur), summary: atSummary };
}
/* 旧セーブ（v0.14 の新フィールドを持たない）形式：履歴と帝都通算と旧式 OB だけがある状態 */
function oldSave() {
  const st = baseSave();
  delete st.career.seasonHist; delete st.career.oppRec; delete st.career.captains;
  st.history = [
    { year: 1, power: 55, result: '予選決勝敗退' },
    { year: 2, power: 61, result: '花園出場（初戦敗退）' }
  ];
  st.rivalW = 1; st.rivalL = 2;
  st.obs = [
    { name: '旧 太郎', pos: 'FB', avg: 70, year: 1, tries: 3, plays: 2 },
    { name: '昔 次郎', pos: 'PR', avg: 64, year: 2, tries: 0, plays: 5 }
  ];
  st.year = 3;
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
  /* 再開時あらすじカードが出ていれば閉じる */
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
  await sleep(420);
  return ok;
};
const scrollSecIntoView = async (page, secText) => {
  await page.evaluate((s) => {
    const el = [...document.querySelectorAll('.sec')].find(x => x.textContent.includes(s));
    if (el) el.scrollIntoView({ block: 'start' });
  }, secText);
  await sleep(350);
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox'] });

  const rich = await richSave();
  const rst = JSON.parse(rich.json);
  report.rich = {
    seasonHist: rst.career.seasonHist, oppRec: rst.career.oppRec,
    captains: rst.career.captains, obs: rst.obs.length
  };

  /* 01: 記録室（全体・初期表示） */
  const p1 = await newPage(browser, rich.json);
  await clickText(p1, '記録・OB');
  report.m1 = await metrics(p1);
  await p1.screenshot({ path: path.join(SHOTS, '01_records_top.png') });

  /* 02: シーズン別成績＋対戦校別成績（左カラムをスクロール） */
  await scrollSecIntoView(p1, 'シーズン別成績');
  report.seasonSec = await p1.evaluate(() => {
    const secs = [...document.querySelectorAll('.sec')].map(x => x.textContent);
    const body = document.getElementById('app').textContent.replace(/\s+/g, ' ');
    return { secs, hasSeasonRow: body.includes('目標「予選でまず1勝」'), hasOpp: body.includes('対戦校別成績'), hasTeito: body.includes('帝都学園 🔥因縁') };
  });
  await p1.screenshot({ path: path.join(SHOTS, '02_records_season_opp.png') });

  /* 03: 歴代キャプテン */
  await scrollSecIntoView(p1, '歴代キャプテン');
  report.captainSec = await p1.evaluate(() => {
    const body = document.getElementById('app').textContent.replace(/\s+/g, ' ');
    const i = body.indexOf('歴代キャプテン');
    return body.slice(i, i + 220);
  });
  await p1.screenshot({ path: path.join(SHOTS, '03_records_captains.png') });

  /* 04: OB名鑑（右カラム：進路と最終能力） */
  await p1.evaluate(() => {
    const cols = document.querySelectorAll('.card.scroll');
    if (cols.length) cols[cols.length - 1].scrollTop = 0;
  });
  await sleep(250);
  report.obSec = await p1.evaluate(() => {
    const body = document.getElementById('app').textContent.replace(/\s+/g, ' ');
    const i = body.indexOf('OB名鑑');
    return body.slice(i, i + 500);
  });
  await p1.screenshot({ path: path.join(SHOTS, '04_records_ob.png') });
  report.m1b = await metrics(p1);
  await p1.close();

  /* 05: 旧セーブ移行後の記録室（「—」表示の確認） */
  const p2 = await newPage(browser, oldSave());
  await clickText(p2, '記録・OB');
  await scrollSecIntoView(p2, 'シーズン別成績');
  report.m2 = await metrics(p2);
  report.oldSec = await p2.evaluate(() => {
    const body = document.getElementById('app').textContent.replace(/\s+/g, ' ');
    return {
      seasonDash: body.includes('勝敗 —') && body.includes('目標 —'),
      teito: body.includes('3戦 1勝 2敗'),
      obDash: body.includes('進路 —') && body.includes('最終能力 —')
    };
  });
  await p2.screenshot({ path: path.join(SHOTS, '05_records_old_save.png') });
  await p2.close();

  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error('ERROR', e); process.exit(2); });
