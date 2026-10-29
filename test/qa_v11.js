/* QA for v0.11: シーンイラスト4枚の組み込み（表示条件）／調子の色分け／調子ロジックの不変。対象は play.html（jsdom）。
 * ※ 調子の表示仕様は v0.12 でユーザー決定により変更（色＋表情＋ラベルのチップ → 固定サイズの顔アイコンのみ・
 *   配色も参照画像準拠に差し替え）。このファイルの調子チェックは v0.12 の新仕様に追随させてある（経緯は DESIGN.md の v0.12 行）。 */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(__dirname + '/../v02/play.html', 'utf8');
let failures = 0;
function check(name, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + (extra ? ' | ' + extra : '')); if (!cond) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

function lcg(seed) {
  let s = seed >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

async function makeDom(seedObj, rngSeed) {
  const dom = new JSDOM(html, {
    url: 'http://localhost/v02/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window) {
      if (seedObj) Object.keys(seedObj).forEach(k => window.localStorage.setItem(k, seedObj[k]));
    }
  });
  const { window } = dom, { document } = window;
  if (rngSeed) {
    const s = document.createElement('script');
    s.textContent = 'Math.random = (' + lcg.toString() + ')(' + rngSeed + ');';
    document.body.appendChild(s);
  }
  await sleep(60);
  const H = {
    window, document,
    text: () => document.getElementById('app').textContent.replace(/\s+/g, ' '),
    btn: (sub) => [...document.querySelectorAll('button')].find(b => b.textContent.includes(sub)),
    click: (sub) => { const b = H.btn(sub); if (!b) throw new Error('button not found: ' + sub + ' || ' + H.text().slice(0, 160)); b.click(); },
    state: () => JSON.parse(window.localStorage.getItem('hanazono.v02'))
  };
  return H;
}

/* 新規ゲームの実セーブを作る */
async function freshSave(rngSeed) {
  const H = await makeDom(null, rngSeed || 777);
  H.click('監督に就任する（ふつう）'); await sleep(20);
  const js = H.window.localStorage.getItem('hanazono.v02');
  H.window.close();
  return js;
}

/* inst 画面から盤面を進めて preMatch（キックオフ表示）に到達する */
async function driveToPreMatch(H) {
  let guard = 0;
  while (guard++ < 300) {
    if (H.btn('キックオフ')) return true;
    if (H.btn('確認した')) { H.click('確認した'); await sleep(5); continue; } /* v0.22 追随: 成長レポートが専用レイアウト表示になり、確認後に指示フォームが出るため、駆動に確認ステップを追加（検証内容は不変） */
    if (H.btn('指示を確定')) { H.click('指示を確定'); await sleep(3); continue; }
    const pc = H.document.querySelector('.pcard');
    if (pc) { pc.click(); await sleep(2); continue; }
    await sleep(5);
  }
  return false;
}

/* v0.12 の新仕様：絶不調=紫 / 不調=水色 / 普通=黄 / 好調=赤 / 絶好調=ピンク。ラベル文字は出さない */
const FORM_COLORS = { '-2': '#9d5bd6', '-1': '#56b4e7', '0': '#f2c531', '1': '#ef4b3f', '2': '#e843c8' };
const FORM_NAMES = { '-2': '絶不調', '-1': '不調', '0': '普通', '1': '好調', '2': '絶好調' };

(async () => {
  /* ---- 0. 静的チェック：CSS に4枚分の写真クラスと data URI が入っている ---- */
  ['photo-champion', 'photo-graduation', 'photo-camp', 'photo-rain', 'formface', 'photofull'].forEach(cls => {
    check('static: play.html contains .' + cls, html.includes('.' + cls));
  });
  const uriCount = (html.match(/data:image\/jpeg;base64,\/9j\//g) || []).length;
  check('static: jpeg data URIs >= 5 (title + 4 scenes)', uriCount >= 5, 'count=' + uriCount);
  check('static: play.html size <= 2.5MB', Buffer.byteLength(html, 'utf8') <= 2500000, 'bytes=' + Buffer.byteLength(html, 'utf8')); /* v0.15: デザイン統一の CSS/JS 追加に伴い、最終チェック基準の 2.5MB に上限を見直し */

  /* ---- 1. タイトル：バージョン ---- */
  {
    const H = await makeDom(null, 111);
    check('title: shows v1.0 (v0.25 でバージョン表記を追随)', H.text().includes('v1.0'));
    check('title: title photo still applied', !!H.document.querySelector('.titlephoto'));
    H.window.close();
  }

  const base = await freshSave(777);

  /* ---- 2. 優勝サマリー：全面写真（champion）が出て、卒業ヒーローは出ない ---- */
  {
    const st = JSON.parse(base);
    st.summary = {
      result: '🏆 花園優勝！', wins: 12, losses: 0,
      goalEval: { ok: true, delta: 12, text: '🎯 シーズン目標「花園優勝」達成！' },
      grade: '強豪', firstHana: false,
      grads: [{ name: '卒業生A', pos: 'PR', avg: 80 }, { name: '卒業生B', pos: 'FB', avg: 77 }],
      stars: [{ name: '星野', pos: 'SO', tries: 5, plays: 3 }]
    };
    st.board = null; st.recruit = null; st.qualified = true;
    st.career.hana = 3; st.career.hanaTitles = 1;
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 211);
    check('champion: summary screen reached', H.text().includes('シーズン終了'));
    const full = H.document.querySelector('.photofull.photo-champion');
    check('champion: full-bleed champion photo shown', !!full);
    check('champion: hero headline present', !!full && full.textContent.includes('花園優勝'));
    check('champion: cards are translucent (title-card)', !!full && !!full.querySelector('.title-card'));
    check('champion: graduation hero NOT used', !H.document.querySelector('.photobanner.photo-graduation'));
    check('champion: next-year button present', !!H.btn('新年度へ'));
    H.window.close();
  }

  /* ---- 3. 通常サマリー：卒業ヒーロー（graduation）が出て、優勝全面写真は出ない ---- */
  {
    const st = JSON.parse(base);
    st.summary = {
      result: '予選決勝敗退', wins: 3, losses: 1,
      goalEval: { ok: false, delta: -3, text: '🎯 シーズン目標には届かなかった' },
      grade: 'そこそこ', firstHana: false,
      grads: [{ name: '卒業生C', pos: 'LO', avg: 66 }],
      stars: []
    };
    st.board = null; st.recruit = null; st.qualified = false;
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 212);
    check('graduation: summary screen reached', H.text().includes('シーズン終了'));
    check('graduation: graduation photo hero shown', !!H.document.querySelector('.photobanner.photo-graduation'));
    check('graduation: graduates listed', H.text().includes('卒業する3年生'));
    check('graduation: champion full-photo NOT used', !H.document.querySelector('.photofull'));
    H.window.close();
  }

  /* ---- 4. 月次バナー：8月だけ camp 写真、他の月は SVG バナー ---- */
  {
    const st = JSON.parse(base);
    st.monthIdx = 4; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 213);
    check('camp: august inst screen', H.text().includes('8月') && !!H.btn('指示を確定'));
    check('camp: camp photo banner in august', !!H.document.querySelector('.photobanner.photo-camp'));
    check('camp: no svg banner in august', !H.document.querySelector('.banner svg'));
    H.window.close();
  }
  {
    const st = JSON.parse(base);
    st.monthIdx = 3; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 214);
    check('camp: july keeps svg banner', !!H.document.querySelector('.banner svg'));
    check('camp: no camp photo in july', !H.document.querySelector('.photo-camp'));
    H.window.close();
  }
  {
    const st = JSON.parse(base);
    st.monthIdx = 9; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 215);
    check('camp: january keeps svg banner (winter slot reserved, not yet filled)', !!H.document.querySelector('.banner svg') && !H.document.querySelector('.photo-camp'));
    H.window.close();
  }

  /* ---- 5. 雨バナー：花園（match 4）でのみ出て、練習試合（match 0）では出ない ---- */
  {
    const st = JSON.parse(base);
    st.monthIdx = 9; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null; st.qualified = true;
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 216);
    const ok = await driveToPreMatch(H);
    check('rain: reached preMatch for hanazono first match', ok, H.text().slice(0, 120));
    check('rain: rain photo banner at hanazono', !!H.document.querySelector('.photobanner.photo-rain'));
    check('rain: no svg match banner at hanazono', !H.document.querySelector('.banner svg'));
    H.window.close();
  }
  {
    const st = JSON.parse(base);
    st.monthIdx = 2; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 217);
    const ok = await driveToPreMatch(H);
    check('rain: reached preMatch for practice match', ok, H.text().slice(0, 120));
    check('rain: NO rain photo at practice match', !H.document.querySelector('.photo-rain'));
    check('rain: svg match banner at practice match', !!H.document.querySelector('.banner svg'));
    H.window.close();
  }

  /* ---- 6. 調子の色分け：一覧で5段階すべてに割り当て色のチップが描画される ---- */
  let formSave;
  {
    const st = JSON.parse(base);
    [-2, -1, 0, 1, 2].forEach((v, i) => { st.players[i].form = v; });
    st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
    formSave = JSON.stringify(st);
    const H = await makeDom({ 'hanazono.v02': formSave }, 218);
    H.click('選手一覧'); await sleep(15);
    const rows = [...H.document.querySelectorAll('tr.prow')];
    check('form: squad rows rendered', rows.length >= 5, 'rows=' + rows.length);
    [-2, -1, 0, 1, 2].forEach((v, i) => {
      const chip = rows[i] ? rows[i].querySelector('.formface') : null;
      const circ = chip ? chip.querySelector('circle') : null;
      const svg = chip ? chip.querySelector('svg') : null;
      check('form: list face for ' + FORM_NAMES[String(v)] + ' (new color, fixed size, no label)',
        !!chip && !!circ && circ.getAttribute('fill') === FORM_COLORS[String(v)] &&
        chip.textContent === '' && !!svg && svg.getAttribute('width') === '20' && svg.getAttribute('height') === '20',
        chip ? 'fill=' + (circ && circ.getAttribute('fill')) + ' text=' + JSON.stringify(chip.textContent) : 'no face');
    });
    /* 詳細：絶好調（5人目）の行を開く */
    rows[4].click(); await sleep(15);
    const drow = [...H.document.querySelectorAll('.rowline')].find(r => r.querySelector('.formface') && r.textContent.includes('成功率と練習効率に影響'));
    const dcirc = drow ? drow.querySelector('.formface circle') : null;
    check('form: detail face for 絶好調 is pink', !!dcirc && dcirc.getAttribute('fill') === FORM_COLORS['2'],
      dcirc ? 'fill=' + dcirc.getAttribute('fill') : 'none');
    check('form: detail keeps note text next to face', H.text().includes('成功率と練習効率に影響'));
    /* 調子ロジックの不変：セーブ内の form は全員 -2..2 の範囲 */
    const stNow = H.state();
    check('form: all saved forms within -2..2', stNow.players.every(p => typeof p.form === 'number' && p.form >= -2 && p.form <= 2));
    H.window.close();
  }

  /* ---- 7. 調子チップ：編成画面（表＋控えボタン）と試合の交代パネルにも出る ---- */
  {
    const st = JSON.parse(formSave);
    st.monthIdx = 2; st.qualified = false;
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 219);
    const ok = await driveToPreMatch(H);
    check('form-lineup: reached preMatch', ok);
    H.click('メンバー編成'); await sleep(15);
    const cellChips = H.document.querySelectorAll('table.squad .formface');
    check('form-lineup: faces in lineup table cells', cellChips.length >= 15, 'faces=' + cellChips.length);
    const btnChip = [...H.document.querySelectorAll('button')].find(b => b.querySelector('.formface'));
    check('form-lineup: face inside a bench IN button', !!btnChip, btnChip ? btnChip.textContent.slice(0, 60) : 'none');
    H.click('試合前に戻る'); await sleep(10);
    H.click('キックオフ'); await sleep(15);
    /* 勝負どころ（交代パネル表示）まで進める */
    let sub = null, guard = 0;
    while (guard++ < 250 && !sub) {
      sub = H.document.querySelector('.subbox .formface');
      if (sub) break;
      if (H.btn('結果のみ表示')) break;
      const choices = [...H.document.querySelectorAll('.choices .btn.choice')];
      if (choices.length && H.text().includes('成功率の目安')) { choices[0].click(); await sleep(3); continue; }
      if (H.btn('試合を進める')) { H.click('試合を進める'); await sleep(3); continue; }
      break;
    }
    check('form-sub: face inside substitution panel buttons', !!sub, H.text().slice(0, 120));
    H.window.close();
  }

  console.log(failures ? '\n*** ' + failures + ' FAILURES ***' : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
