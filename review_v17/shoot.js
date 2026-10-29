/* v0.17 実ブラウザレビュー撮影: 横画面レイアウト再整理（HUD 1行化／固定アクションバー／
 * 月頭指示ヒーローパネル／選手データ master-detail＋タブ／対戦確認のはみ出し解消）。
 * 横向き 1060×600、play.html を対象にする。全主要画面を撮影し、各画面で
 * ドキュメントはみ出し（docSW/docSH）と、ボタン・セレクト同士の重なり（衝突）を計測する。
 * 本番コードにデバッグ導線は入れていない（localStorage へのセーブ投入のみ）。 */
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '..', 'review-tools', 'node_modules', 'puppeteer-core'));
const { JSDOM } = require(path.join(__dirname, '..', 'test', 'node_modules', 'jsdom'));

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const report = { errors: [], screens: {} };
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
function flat(st, v) {
  st.players.forEach(p => {
    Object.keys(p.stats).forEach(k => { p.stats[k] = v; });
    p.fatigue = 0; p.form = 0; p.trust = 50; p.injured = 0; p.injSev = null; p.injPart = null; p.justBack = false;
  });
}
/* 月頭指示（4月・通常月）：目標は確定済み、最近の出来事あり */
function instSave() {
  const st = baseSave();
  st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
  st.monthLog = ['🌸 スカウト成功！ 高橋 颯太（SO）が入部を決めた', '🏃 朝練に1年生全員が揃った'];
  st.rep = 170; /* 名門：設備3つ解放で一番長い設備表記にする */
  return JSON.stringify(st);
}
/* 月頭指示（8月・合宿月）：写真バナー（夏合宿）が背景になる */
function campSave() {
  const st = JSON.parse(instSave());
  st.monthIdx = 4;
  return JSON.stringify(st);
}
/* 対戦確認（予選決勝・帝都）：v0.16 で 12px はみ出した構成をそのまま再現 */
function preMatchSave() {
  const st = baseSave();
  st.monthIdx = 8; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
  flat(st, 62);
  return JSON.stringify(st);
}
/* 対戦確認（花園初戦）：雨のナイター写真バナー */
function hanaSave() {
  const st = baseSave();
  st.monthIdx = 9; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null; st.qualified = true;
  flat(st, 74);
  return JSON.stringify(st);
}
function summarySave(champion) {
  const st = baseSave();
  st.goalSet = true; st.board = null; st.recruit = null;
  st.summary = {
    result: champion ? '🏆 花園優勝！' : '予選決勝敗退', wins: champion ? 12 : 3, losses: champion ? 0 : 2,
    goalEval: { ok: !champion, delta: 8, text: '🎯 シーズン目標「県決勝に進出」達成！' },
    grade: '強豪', firstHana: !!champion,
    grads: [{ name: '卒業生A', pos: 'PR', avg: 80 }, { name: '卒業生B', pos: 'FB', avg: 77 }],
    stars: [{ name: '星野', pos: 'SO', tries: 5, plays: 3 }]
  };
  st.qualified = !!champion;
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
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('グラウンドへ戻る'));
    if (b) b.click();
  });
  await sleep(300);
  return page;
}
/* はみ出し＋衝突の監査：ドキュメント寸法／HUD 高さ／ボタン・セレクト同士の重なり／要素の画面外はみ出し。
 * スクロールパネル（overflow auto/scroll/hidden の祖先）の中でクリップされる要素は「見えていない」ので対象外にし、
 * 実際に画面へ描画される範囲（可視矩形）同士で判定する */
const audit = (page) => page.evaluate(() => {
  const out = { docSW: document.documentElement.scrollWidth, docSH: document.documentElement.scrollHeight, issues: [] };
  const hud = document.querySelector('.hud');
  if (hud) out.hudH = Math.round(hud.getBoundingClientRect().height);
  function visibleRect(el) {
    let r = el.getBoundingClientRect();
    let v = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    let n = el.parentElement;
    while (n && n !== document.body) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll|hidden)/.test(cs.overflowY) || /(auto|scroll|hidden)/.test(cs.overflowX)) {
        const b = n.getBoundingClientRect();
        v.left = Math.max(v.left, b.left); v.top = Math.max(v.top, b.top);
        v.right = Math.min(v.right, b.right); v.bottom = Math.min(v.bottom, b.bottom);
      }
      n = n.parentElement;
    }
    v.width = v.right - v.left; v.height = v.bottom - v.top;
    return v;
  }
  const els = [...document.querySelectorAll('#app button, #app select, #app .card, #app .hud, #app .actionbar, #app .heropanel, #app .glasscard, #app .tabbtn')];
  const rs = els.map(e => ({ el: e, v: visibleRect(e) })).filter(x => x.v.width > 0 && x.v.height > 0);
  rs.forEach(x => {
    if (x.v.right > 1061 || x.v.bottom > 601 || x.v.left < -1 || x.v.top < -1) {
      out.issues.push('overflow(visible): ' + (x.el.className || x.el.tagName) + ' [' + [x.v.left, x.v.top, x.v.right, x.v.bottom].map(Math.round).join(',') + ']');
    }
  });
  const inter = rs.filter(x => x.el.tagName === 'BUTTON' || x.el.tagName === 'SELECT');
  for (let i = 0; i < inter.length; i++) for (let j = i + 1; j < inter.length; j++) {
    const a = inter[i], b = inter[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ix = Math.min(a.v.right, b.v.right) - Math.max(a.v.left, b.v.left);
    const iy = Math.min(a.v.bottom, b.v.bottom) - Math.max(a.v.top, b.v.top);
    if (ix > 2 && iy > 2) out.issues.push('overlap(visible): ' + a.el.textContent.replace(/\s+/g, ' ').slice(0, 24) + ' <> ' + b.el.textContent.replace(/\s+/g, ' ').slice(0, 24));
  }
  return out;
});
async function snap(page, name) {
  const a = await audit(page);
  report.screens[name] = a;
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
}
const clickText = async (page, sub) => {
  const ok = await page.evaluate((s) => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(s));
    if (b) { b.click(); return true; } return false;
  }, sub);
  await sleep(350);
  return ok;
};
async function toPreMatch(page) {
  for (let i = 0; i < 120; i++) {
    const st = await page.evaluate(() => {
      if ([...document.querySelectorAll('button')].some(b => b.textContent.includes('キックオフ'))) return 'pre';
      const inst = [...document.querySelectorAll('button')].find(b => b.textContent.includes('指示を確定'));
      if (inst) { inst.click(); return 'inst'; }
      const pc = document.querySelector('.pcard');
      if (pc) { pc.click(); return 'card'; }
      return 'wait';
    });
    if (st === 'pre') return true;
    await sleep(220);
  }
  return false;
}
async function driveMatch(page, predFn) {
  for (let i = 0; i < 200; i++) {
    const done = await page.evaluate(predFn);
    if (done) return true;
    const acted = await page.evaluate(() => {
      const t = document.getElementById('app').textContent;
      const cs = [...document.querySelectorAll('.choices .btn.choice')];
      if (cs.length && t.includes('成功率の目安')) { cs[0].click(); return 'choice'; }
      const adv = [...document.querySelectorAll('button')].find(b => b.textContent.includes('試合を進める'));
      if (adv) { adv.click(); return 'adv'; }
      return 'wait';
    });
    if (acted === 'wait') await sleep(250);
    else await sleep(160);
  }
  return false;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox'] });

  /* 01: タイトル */
  const p0 = await newPage(browser, null);
  await snap(p0, '01_title');
  await p0.close();

  /* 02: 目標設定（決定ボタンはアクションバー） */
  const p1 = await newPage(browser, JSON.stringify(baseSave()));
  await snap(p1, '02_goal');
  await p1.close();

  /* 03: 月頭指示（ヒーローパネル：SVG バナー＋半透明カード／設備は最長表記） */
  const p2 = await newPage(browser, instSave());
  await snap(p2, '03_inst');
  /* 04: 盤面（指示を確定して進む） */
  await clickText(p2, '指示を確定');
  await snap(p2, '04_board');
  /* 05: 選手データ（能力タブ） */
  await clickText(p2, '選手一覧');
  await snap(p2, '05_squad_stat');
  /* 06: 選手データ（プロフィールタブ） */
  await clickText(p2, 'プロフィール');
  await snap(p2, '06_squad_prof');
  /* 07: 記録室 */
  await clickText(p2, '記録・OB');
  await snap(p2, '07_records');
  /* 08: 遊び方ガイド（HUD のアイコンボタンから） */
  await p2.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('title') === '遊び方'); if (b) b.click(); });
  await sleep(400);
  await snap(p2, '08_guide');
  await p2.close();

  /* 09: 月頭指示（8月・合宿写真が背景） */
  const p3 = await newPage(browser, campSave());
  await snap(p3, '09_inst_camp');
  await p3.close();

  /* 10: 対戦確認（予選決勝・帝都）＝はみ出し解消の本丸 */
  const p4 = await newPage(browser, preMatchSave());
  report.preReached = await toPreMatch(p4);
  await snap(p4, '10_prematch');
  /* 11: 編成 */
  await clickText(p4, 'メンバー編成');
  await snap(p4, '11_lineup');
  await clickText(p4, '試合前に戻る');
  /* 12: 試合画面（実況左・采配右） */
  await clickText(p4, 'キックオフ');
  await snap(p4, '12_match');
  /* 13: 交代パネル（勝負どころまで進める） */
  report.sceneReached = await driveMatch(p4, () => document.querySelectorAll('.subbtn').length > 0);
  await snap(p4, '13_subpanel');
  await p4.close();

  /* 14: 対戦確認（花園・雨のナイター写真） */
  const p5 = await newPage(browser, hanaSave());
  report.hanaReached = await toPreMatch(p5);
  await snap(p5, '14_prematch_hana');
  await p5.close();

  /* 15: シーズン締め（通常） */
  const p6 = await newPage(browser, summarySave(false));
  await snap(p6, '15_summary');
  /* 16: 勧誘（新年度へ進む） */
  await clickText(p6, '新年度へ');
  await snap(p6, '16_recruit');
  await p6.close();

  /* 17: シーズン締め（優勝・全面写真） */
  const p7 = await newPage(browser, summarySave(true));
  await snap(p7, '17_summary_champion');
  await p7.close();

  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error('SHOOT ERROR', e); process.exit(1); });
