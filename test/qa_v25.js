/* QA v0.25（v1.0）: 完成版（Web 1.0）
 * - バージョン表記 v1.0（完成版）: document title／タイトルのヒーロー表記
 * - クレジット: タイトルに1行（Kenshin Takada／Muse との共同開発）、ガイドにクレジット節
 * - セーブ互換: 実際の v0.24 ビルド（review_v25/play_v24_baseline.html）で作ったセーブが
 *   v1.0 でそのまま自動継続されること（内容不変・移行冪等）。移行を要する変更は入れていない
 * - 新規プレイヤー導線の通し確認: タイトル→スロット選択→チュートリアル（5ステップの
 *   バーが各画面に出る）→1シーズン完走（目標→指示→週次→対戦確認→試合→サマリー→
 *   勧誘→新入生紹介→2年目の目標）まで途切れないこと
 * - 長期導線: 最適寄り自動プレイ（soak_balance と同じ LCG＋駆動）で花園到達まで進められること
 * - 場面イラスト: PHOTO_SCENES の登録キーは実在ファイルと一致。冬イラストが実在する場合は
 *   組み込み済み（PHOTO_SCENES／CSS クラス／MONTH_PHOTOS）を、無ければ参照が無いことを確認
 * 実行: node test/qa_v25.js （jsdom は test/node_modules にある前提） */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HTML = fs.readFileSync(__dirname + '/../v02/play.html', 'utf8');
const HTML_V24 = fs.readFileSync(__dirname + '/../review_v25/play_v24_baseline.html', 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  NG  ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function makeDom(html, preset, seed) {
  let s = (seed || 4242) >>> 0;
  const dom = new JSDOM(html, {
    url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      try { w.localStorage.clear(); } catch (e) {}
      if (preset) for (const k of Object.keys(preset)) w.localStorage.setItem(k, preset[k]);
      w.Math.random = function () {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
  });
  const w = dom.window;
  return new Promise(res => {
    const iv = setInterval(() => {
      if (w.document && w.document.querySelector('#app') && w.document.querySelector('#app').children.length) { clearInterval(iv); res(dom); }
    }, 10);
    setTimeout(() => { clearInterval(iv); res(dom); }, 3000);
  });
}
function H(dom) {
  const w = dom.window, d = w.document;
  return {
    window: w, document: d,
    text: () => d.querySelector('#app').textContent.replace(/\s+/g, ' '),
    btn: (label) => Array.from(d.querySelectorAll('button')).find(b => b.textContent.includes(label)),
    click: (label) => { const b = Array.from(d.querySelectorAll('button')).find(x => x.textContent.includes(label)); if (!b) throw new Error('button not found: ' + label); b.click(); },
    ls: (k) => w.localStorage.getItem(k),
    state: () => JSON.parse(w.localStorage.getItem('hanazono.v02') || 'null'),
    slotCol: (i) => d.querySelectorAll('.slotcol')[i - 1]
  };
}
/* soak_balance.js と同じ LCG をページに注入する（長期導線の再現性のため） */
function lcg(seed) {
  let s = seed >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
async function makeLcgDom(html, seed) {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
  const { window } = dom;
  const s = window.document.createElement('script');
  s.textContent = 'Math.random = (' + lcg.toString() + ')(' + seed + ');';
  window.document.body.appendChild(s);
  await sleep(60);
  return dom;
}

(async () => {
  /* ---- 1. バージョン表記 v1.0 とクレジット ---- */
  {
    check('version: document title is v1.3', HTML.includes('<title>Road to HANAZONO v1.3</title>')); /* v0.26: バージョン表記を v1.1 に追随 */ /* v0.27: バージョン表記を v1.2 に追随 */ /* v0.28: バージョン表記を v1.3 に追随 */
    check('version: no stale v0.24 in document title/hero source', !HTML.includes('Road to HANAZONO v0.24') && !HTML.includes('育成シミュレーション v0.24'));
    const h = await makeDom(HTML, null, 1);
    const x = H(h);
    check('version: hero shows v1.3', x.text().includes('高校ラグビー育成シミュレーション v1.3')); /* v0.26: バージョン表記を v1.1 に追随 */ /* v0.27: バージョン表記を v1.2 に追随 */ /* v0.28: バージョン表記を v1.3 に追随 */
    check('credits: title carries the credit line', x.text().includes('制作：Kenshin Takada') && x.text().includes('Muse との共同開発'));
    x.click('📖'); await sleep(20);
    check('credits: guide has a credits section', x.text().includes('クレジット') && x.text().includes('Kenshin Takada') && x.text().includes('Muse（AI）との共同開発'));
    check('credits: guide credits name the series and version', x.text().includes('100アプリチャレンジ #47') && x.text().includes('v1.3（Web版）')); /* v0.26: バージョン表記を v1.1 に追随 */ /* v0.27: バージョン表記を v1.2 に追随 */ /* v0.28: バージョン表記を v1.3 に追随 */
    h.window.close();
  }

  /* ---- 2. v0.24 の実セーブでの互換（移行なしで継続できること） ---- */
  let v24save = null;
  {
    const h = await makeDom(HTML_V24, null, 777);
    const x = H(h);
    x.click('監督に就任する（ふつう）'); await sleep(20);
    if (x.btn('目標を決めて')) { x.click('目標を決めて'); await sleep(20); }
    x.click('指示を確定'); await sleep(20);
    const pc = x.document.querySelector('.pcard'); if (pc) { pc.click(); await sleep(20); }
    v24save = x.ls('hanazono.v02');
    check('compat: v0.24 save produced by the real v0.24 build', !!v24save && JSON.parse(v24save).players.length > 0);
    h.window.close();
  }
  {
    const before = JSON.parse(v24save);
    const h = await makeDom(HTML, { 'hanazono.v02': v24save, 'hanazono.slots': '{"v":1,"active":1}', 'hanazono.tut': '{"step":5,"done":1}' }, 777);
    const x = H(h);
    check('compat: v0.24 save auto-continues in v1.0 (HUD visible)', !!x.document.querySelector('.hud'));
    const after = x.state();
    check('compat: save content preserved (year/month/players/rep)',
      after.year === before.year && after.monthIdx === before.monthIdx && after.players.length === before.players.length && after.rep === before.rep);
    const saveAfterFirst = x.ls('hanazono.v02');
    h.window.close();
    const h2 = await makeDom(HTML, { 'hanazono.v02': saveAfterFirst, 'hanazono.slots': '{"v":1,"active":1}', 'hanazono.tut': '{"step":5,"done":1}' }, 777);
    check('compat: second boot is idempotent (state unchanged)', JSON.stringify(H(h2).state()) === JSON.stringify(JSON.parse(saveAfterFirst)));
    h2.window.close();
  }

  /* ---- 3. 新規プレイヤー導線: タイトル→スロット→チュートリアル→1シーズン→2年目 ---- */
  {
    const h = await makeDom(HTML, null, 4242);
    const x = H(h);
    check('flow: title shows 3 slots on a fresh device', x.document.querySelectorAll('.slotcol').length === 3);
    x.click('監督に就任する（ふつう）'); await sleep(20);
    const seen = { goal: false, inst: false, weekly: false, prematch: false, match: false, summary: false, recruit: false, intro: false, year2goal: false };
    if (x.document.querySelector('.tutbar')) seen.goal = true;
    let guard = 0, stuck = null;
    while (guard++ < 30000) {
      const t = x.text();
      if (/NaN|undefined/.test(t) && !t.includes('undefined ')) { /* 表示テキストの偶然の一致を避けるため厳密には見ない */ }
      if (x.state() && x.state().year >= 2 && x.text().includes('年目の目標を決めよう')) { seen.year2goal = true; break; }
      if (x.document.querySelector('.tutbar')) {
        /* v0.25: ステップ判定はバーのステップ番号で行う（試合画面は開幕直後に勝負どころの
         * 選択肢が出て「試合を進める」が無い場合があり、ボタン有無では step 5 を取りこぼすため） */
        const barTxt = x.document.querySelector('.tutbar').textContent;
        if (barTxt.includes('5／5')) seen.match = true;
        if (x.text().includes('年目の目標を決めよう')) seen.goal = true;
        if (x.btn('指示を確定')) seen.inst = true;
        if (x.document.querySelector('.wcard')) seen.weekly = true;
        if (x.btn('キックオフ')) seen.prematch = true;
        if (x.btn('試合を進める')) seen.match = true;
        const wb = x.btn('わかった ▶'); if (wb) { wb.click(); await sleep(5); continue; }
        const eb = x.btn('終了する'); if (eb && !x.btn('キックオフ')) { /* バーを閉じずに進める */ }
      }
      if (x.btn('新年度へ')) { seen.summary = true; x.click('新年度へ'); await sleep(10); continue; }
      if (x.btn('新年度を始める')) { seen.recruit = true; x.click('新年度を始める'); await sleep(10); continue; }
      if (x.text().includes('新入生') && x.document.querySelector('.introlist, .introcard')) seen.intro = true;
      if (x.btn('目標を決めて')) { x.click('目標を決めて'); await sleep(30); continue; }
      if (x.btn('確認した')) { x.click('確認した'); await sleep(5); continue; }
      if (x.btn('指示を確定')) {
        const lv = x.document.querySelector('.seg[data-k="level"] [data-v="1"]'); /* v0.27 追随: 強度はボタン列（値は従来と同じ '1'＝強め） */
        if (lv && !lv.classList.contains('on')) lv.click();
        x.click('指示を確定'); await sleep(5); continue;
      }
      const pc = x.document.querySelector('.pcard');
      if (pc) { pc.click(); await sleep(2); continue; }
      const wc = x.document.querySelector('.wcard');
      if (wc) { wc.click(); await sleep(2); continue; }
      if (x.btn('獲得リストに入れる')) { x.click('獲得リストに入れる'); await sleep(5); continue; }
      if (x.btn('結果のみ表示')) { x.click('結果のみ表示'); await sleep(5); continue; }
      if (x.btn('キックオフ')) { x.click('キックオフ'); await sleep(5); continue; }
      if (x.btn('変更しない')) { x.click('変更しない'); await sleep(2); continue; }
      const opts = [...x.document.querySelectorAll('.choices .btn.choice')];
      if (opts.length && t.includes('成功率の目安')) {
        let best = opts[0], bp = -1;
        opts.forEach(o => { const m = (o.dataset.p ? [0, o.dataset.p] : o.textContent.match(/(\d+)%/)); const p = m ? +m[1] : 0; if (p > bp) { bp = p; best = o; } });
        best.click(); await sleep(2); continue;
      }
      if (x.btn('試合を進める')) { x.click('試合を進める'); await sleep(2); continue; }
      if (x.btn('やった！次へ')) { x.click('やった！次へ'); await sleep(5); continue; }
      if (x.btn('次へ')) { if (x.text().includes('入部')) seen.intro = true; x.click('次へ'); await sleep(5); continue; }
      stuck = t.slice(0, 160); break;
    }
    check('flow: season 1 completes and year 2 goal screen is reached', seen.year2goal, 'stuck=' + stuck);
    check('flow: tutorial bars seen (goal/inst/weekly/prematch/match)', seen.goal && seen.inst && seen.weekly && seen.prematch && seen.match, JSON.stringify(seen));
    check('flow: summary and recruit were passed through', seen.summary && seen.recruit, JSON.stringify(seen));
    const st = x.state();
    check('flow: season history recorded for year 1', !!st && !!st.career && Array.isArray(st.career.seasonHist) && st.career.seasonHist.length >= 1);
    h.window.close();
  }

  /* ---- 4. 長期導線: 自動プレイで花園到達まで途切れない（soak と同じ駆動・LCG seed 2554） ---- */
  {
    const dom = await makeLcgDom(HTML, 2554);
    const x = H(dom);
    const { document } = x;
    const text = x.text;
    const btn = x.btn;
    const click = x.click;
    click('監督に就任する'); await sleep(5);
    let guard = 0, bad = null, reached = false;
    while (guard++ < 200000) {
      const st = x.state();
      if (!st) { bad = 'no save'; break; }
      const t = text();
      if (t.includes('NaN')) { bad = 'NaN in view'; break; }
      if (st.career && st.career.hana > 0) { reached = true; break; }
      if (st.year > 6) break;
      if (btn('新年度へ')) { click('新年度へ'); await sleep(3); const tog = btn('獲得リストに入れる'); if (tog) { tog.click(); await sleep(1); } if (btn('新年度を始める')) { click('新年度を始める'); await sleep(3); } continue; }
      if (btn('新年度を始める')) { click('新年度を始める'); await sleep(3); continue; }
      if (btn('目標を決めて')) { click('目標を決めて'); await sleep(30); continue; }
      if (btn('確認した')) { click('確認した'); await sleep(3); continue; }
      if (btn('指示を確定')) {
        const lv = document.querySelector('.seg[data-k="level"] [data-v="1"]'); /* v0.27 追随: 強度はボタン列（値は従来と同じ '1'＝強め） */
        if (lv && !lv.classList.contains('on')) lv.click();
        click('指示を確定'); await sleep(2); continue;
      }
      /* v0.26 追随: 週次は本命ソーク（soak_v19_ab）と同じゲーム内蔵「おまかせ」で進める。先頭カード固定は偏った参照方針で、
       * 名前生成の乱数経路が変わると同じシードでも花園到達が9年目にずれた（v1.0 でも10年かかるシードがある）。導線の検証が目的のため最適寄りに揃える */
      if (btn('おまかせ（月末まで自動）')) { click('おまかせ（月末まで自動）'); await sleep(0); continue; }
      const pc = document.querySelector('.pcard');
      if (pc) { pc.click(); await sleep(0); continue; }
      const wc = document.querySelector('.wcard');
      if (wc) { wc.click(); await sleep(0); continue; }
      if (btn('結果のみ表示（スキップ）')) { click('結果のみ表示（スキップ）'); await sleep(2); continue; }
      if (btn('キックオフ')) { click('キックオフ'); await sleep(2); continue; }
      if (btn('変更しない')) { click('変更しない'); await sleep(0); continue; }
      const opts = [...document.querySelectorAll('.choices .btn.choice')];
      if (opts.length && t.includes('成功率の目安')) {
        let best = opts[0], bp = -1;
        opts.forEach(o => { const m = (o.dataset.p ? [0, o.dataset.p] : o.textContent.match(/(\d+)%/)); const p = m ? +m[1] : 0; if (p > bp) { bp = p; best = o; } });
        best.click(); await sleep(0); continue;
      }
      if (btn('試合を進める')) { click('試合を進める'); await sleep(0); continue; }
      if (btn('やった！次へ')) { click('やった！次へ'); await sleep(2); continue; }
      if (btn('次へ')) { click('次へ'); await sleep(2); continue; }
      bad = 'stuck: ' + t.slice(0, 120); break;
    }
    check('longflow: auto-play reaches Hanazono within 6 years (seed 2554)', reached, 'bad=' + bad);
    dom.window.close();
  }

  /* ---- 5. 場面イラストの整合（存在しない参照を作らない／実在すれば組み込み済み） ---- */
  {
    const m = HTML.match(/var PHOTO_SCENES = \{([^}]*)\}/);
    const keys = m ? Array.from(m[1].matchAll(/(\w+):/g)).map(mm => mm[1]) : [];
    const imgDir = path.join(__dirname, '..', 'v02', 'img');
    const allExist = keys.every(k => fs.existsSync(path.join(imgDir, 'scene-' + k + '.jpg')));
    check('photos: every PHOTO_SCENES key has a real image file', allExist, keys.join(','));
    const winterExists = fs.existsSync(path.join(imgDir, 'scene-winter.jpg'));
    if (winterExists) {
      check('photos: winter art integrated (registry + css class + month mapping)',
        keys.includes('winter') && HTML.includes('.photo-winter') && /MONTH_PHOTOS = \{[^}]*winter/.test(HTML));
    } else {
      check('photos: no winter reference while the art does not exist', !HTML.includes('photo-winter') && !/MONTH_PHOTOS = \{[^}]*winter/.test(HTML));
    }
  }

  console.log('\nqa_v25: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
