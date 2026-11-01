/* QA for v0.12: 試合の読み応え（実況バリエーション拡充＋試合内の重複回避／スカウティング弱点ヒント／
 * ハーフタイム形勢サマリー／敗因・勝因の相対バー表示）＋調子表示の見直し（固定サイズの顔アイコンのみ・新配色・ラベル廃止）。
 * 対象は play.html（jsdom）。 */
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
    state: () => JSON.parse(window.localStorage.getItem('hanazono.v02')),
    logLines: () => [...document.querySelectorAll('.log > div')].map(d => d.textContent)
  };
  return H;
}

async function freshSave(rngSeed) {
  const H = await makeDom(null, rngSeed || 777);
  H.click('監督に就任する（ふつう）'); await sleep(20);
  const js = H.window.localStorage.getItem('hanazono.v02');
  H.window.close();
  return js;
}

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

/* 試合を最後まで進める（選択肢は常に先頭を選ぶ） */
async function driveMatchToEnd(H) {
  let guard = 0;
  while (guard++ < 300) {
    if (H.btn('次へ')) return true;
    const t = H.text();
    const choices = [...H.document.querySelectorAll('.choices .btn.choice')];
    if (choices.length && t.includes('成功率の目安')) { choices[0].click(); await sleep(2); continue; }
    if (H.btn('試合を進める')) { H.click('試合を進める'); await sleep(2); continue; }
    await sleep(5);
  }
  return false;
}

const FORM_COLORS = { '-2': '#9d5bd6', '-1': '#56b4e7', '0': '#f2c531', '1': '#ef4b3f', '2': '#e843c8' };

(async () => {
  /* ---- 0. 静的チェック：実況パターン数・新要素の存在 ---- */
  const commBlock = html.split('/* COMM-BEGIN */')[1].split('/* COMM-END */')[0];
  const patCount = (commBlock.match(/function \(c\)/g) || []).length;
  check('static: commentary patterns >= 36 (was ~10 fixed lines)', patCount >= 36, 'count=' + patCount);
  ['弱点ヒント', '前半の得点内訳', 'showHtSummary', 'scoutHints', '.formface', '.htbox', 'data-form'].forEach(s => {
    check('static: play.html contains ' + s, html.includes(s));
  });
  check('static: old form chip is gone', !html.includes('formchip'));

  /* ---- 1. タイトル：バージョン ---- */
  {
    const H = await makeDom(null, 111);
    check('title: shows v1.3 (v0.25 でバージョン表記を追随)', H.text().includes('v1.3')); /* v0.26: バージョン表記を v1.1 に追随 */ /* v0.27: バージョン表記を v1.2 に追随 */ /* v0.28: バージョン表記を v1.3 に追随 */
    H.window.close();
  }

  const base = await freshSave(777);

  /* ---- 2. 実況：同一試合内で実況文が重複しない／試合をまたいでバリエーションがある ---- */
  const allTryLines = new Set();
  for (const [mi, seed] of [[2, 301], [2, 302], [6, 303]]) {
    const st = JSON.parse(base);
    st.monthIdx = mi; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, seed);
    const okPre = await driveToPreMatch(H);
    check('comm: reached preMatch (monthIdx ' + mi + ', seed ' + seed + ')', okPre);
    H.click('キックオフ'); await sleep(15);
    const done = await driveMatchToEnd(H);
    check('comm: match completed (seed ' + seed + ')', done);
    const lines = H.logLines();
    const dup = lines.filter((l, i) => lines.indexOf(l) !== i);
    check('comm: no duplicated log line within one match (seed ' + seed + ')', dup.length === 0, dup.join(' /// ').slice(0, 120));
    lines.filter(l => l.includes('トライ！')).forEach(l => allTryLines.add(l));
    H.window.close();
  }
  check('comm: try commentary varies across matches (>= 6 distinct)', allTryLines.size >= 6, 'distinct=' + allTryLines.size);

  /* ---- 3. スカウティング弱点ヒント：実データ（style/ace/skill）と整合する ---- */
  const scoutCases = [
    { mi: 2, idx: 0, first: 'FW正面の圧力にはやや弱い', second: '風間 駿' },
    { mi: 7, idx: 2, first: 'BKの展開力は相対的に控えめ', second: '大熊 鉄平' },
    { mi: 8, idx: 3, first: 'キックで陣地を取る分', second: 'キックの精度が高い' },
    { mi: 10, idx: 5, first: 'BKの展開力は相対的に控えめ', second: '北原 蒼汰' }
  ];
  for (const cs of scoutCases) {
    const st = JSON.parse(base);
    st.monthIdx = cs.mi; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
    if (cs.mi >= 9) st.qualified = true;
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 400 + cs.idx);
    const okPre = await driveToPreMatch(H);
    check('scout: reached preMatch for opp ' + cs.idx, okPre, H.text().slice(0, 80));
    const hints = [...H.document.querySelectorAll('.hint')].map(d => d.textContent);
    check('scout: opp ' + cs.idx + ' shows 1-2 weakness hints', hints.length >= 1 && hints.length <= 2, 'n=' + hints.length);
    check('scout: opp ' + cs.idx + ' hint[0] matches its style', hints.length > 0 && hints[0].includes(cs.first), (hints[0] || '').slice(0, 50));
    check('scout: opp ' + cs.idx + ' hint[1] matches ace/kick data', hints.length > 1 && hints[1].includes(cs.second), (hints[1] || '').slice(0, 50));
    H.window.close();
  }

  /* ---- 4. ハーフタイム形勢サマリー(a)：停止点のない練習試合でも前半終了時に1回だけ出る ---- */
  {
    const st = JSON.parse(base);
    st.monthIdx = 2; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 501);
    await driveToPreMatch(H);
    H.click('キックオフ'); await sleep(15);
    const done = await driveMatchToEnd(H);
    check('ht-a: practice match completed', done);
    const t = H.text();
    check('ht-a: halftime summary appears exactly once', (t.split('前半の得点内訳').length - 1) === 1, 'count=' + (t.split('前半の得点内訳').length - 1));
    check('ht-a: halftime score line present', t.includes('⏸ ハーフタイム：桜丘'));
    H.window.close();
  }

  /* ---- 5. ハーフタイム形勢サマリー(b)：帝都戦では采配パネルにも出て、後半への一言がスコアで出し分けられる ---- */
  {
    const st = JSON.parse(base);
    st.monthIdx = 8; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
    st.players.forEach(p => { Object.keys(p.stats).forEach(k => { p.stats[k] = 78; }); p.fatigue = 5; });
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 502);
    await driveToPreMatch(H);
    H.click('キックオフ'); await sleep(15);
    let ht = null, guard = 0;
    while (guard++ < 250) {
      ht = H.document.querySelector('.htbox');
      if (ht) break;
      const t = H.text();
      const choices = [...H.document.querySelectorAll('.choices .btn.choice')];
      if (choices.length && t.includes('成功率の目安')) { choices[0].click(); await sleep(2); continue; }
      if (H.btn('試合を進める')) { H.click('試合を進める'); await sleep(2); continue; }
      break;
    }
    check('ht-b: halftime panel summary shown at the halftime scene', !!ht);
    if (ht) {
      check('ht-b: panel summary has 3 lines', ht.children.length === 3, 'lines=' + ht.children.length);
      const pts = [...H.document.querySelectorAll('.score .pts')].map(e => parseInt(e.textContent, 10));
      const d = pts[0] - pts[1];
      const expect = d >= 15 ? '大きなリードで折り返す' : d > 0 ? 'リードして折り返す' : d === 0 ? '互角のまま後半へ' : d > -15 ? 'ビハインドだが射程圏内' : '苦しい前半だった';
      check('ht-b: message variant matches the score (d=' + d + ')', ht.textContent.includes(expect), ht.textContent.slice(0, 80));
    }
    const done = await driveMatchToEnd(H);
    check('ht-b: match completed', done);
    const t2 = H.text();
    check('ht-b: summary stays exactly once in the log after the match', (t2.split('前半の得点内訳').length - 1) === 1);
    /* ---- 6. 敗因・勝因の相対バー（同じ試合の終了画面で検証） ---- */
    const rows = [...H.document.querySelectorAll('.frow')];
    check('factors: 4 factor rows', rows.length === 4, 'rows=' + rows.length);
    if (rows.length === 4) {
      const vals = rows.map(r => parseInt(r.querySelector('.fval').textContent, 10));
      check('factors: percentages sum to 100', vals.reduce((a, b) => a + b, 0) === 100, vals.join('+'));
      const widths = rows.map(r => parseInt((r.querySelector('.meter > div').getAttribute('style').match(/width:(\d+)%/) || [])[1], 10));
      check('factors: bars sorted descending (relative widths)', widths.every((w, i) => i === 0 || widths[i - 1] >= w), widths.join(','));
      check('factors: top bar is full width (relative scale)', widths[0] === 100, 'top=' + widths[0]);
      check('factors: top row flagged as 最大', rows[0].classList.contains('ftop') && rows[0].querySelector('.flab').textContent.includes('（最大）'));
      const colors = rows.map(r => (r.querySelector('.meter > div').getAttribute('style').match(/background:(#[0-9a-f]+)/) || [])[1]);
      check('factors: bars are color-coded (4 distinct colors)', new Set(colors).size === 4, colors.join(','));
    }
    H.window.close();
  }

  /* ---- 7. 調子の顔アイコン：ラベルなし・新配色・寸法固定 ---- */
  {
    const st = JSON.parse(base);
    [-2, -1, 0, 1, 2].forEach((v, i) => { st.players[i].form = v; });
    st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 601);
    H.click('選手一覧'); await sleep(15);
    const rows = [...H.document.querySelectorAll('tr.prow')];
    check('face: squad rows rendered', rows.length >= 5, 'rows=' + rows.length);
    [-2, -1, 0, 1, 2].forEach((v, i) => {
      const face = rows[i] ? rows[i].querySelector('.formface') : null;
      const circ = face ? face.querySelector('circle') : null;
      const svg = face ? face.querySelector('svg') : null;
      check('face: stage ' + v + ' uses the new color, fixed 20px, no label text',
        !!face && !!circ && circ.getAttribute('fill') === FORM_COLORS[String(v)] &&
        face.textContent === '' && !!svg && svg.getAttribute('width') === '20' && svg.getAttribute('height') === '20',
        face ? 'fill=' + (circ && circ.getAttribute('fill')) : 'no face');
    });
    const widths = new Set([...H.document.querySelectorAll('.formface svg')].map(s => s.getAttribute('width')));
    check('face: icon width identical for every player', widths.size === 1 && widths.has('20'), [...widths].join(','));
    check('face: no form label text anywhere on the squad screen', !H.text().includes('絶好調') && !H.text().includes('絶不調'));
    /* 詳細でも同じ（ラベルなし・該当段階の色） */
    rows[4].click(); await sleep(15);
    const drow = [...H.document.querySelectorAll('.rowline')].find(r => r.querySelector('.formface') && r.textContent.includes('成功率と練習効率に影響'));
    const dcirc = drow ? drow.querySelector('.formface circle') : null;
    check('face: detail face for 絶好調 is pink and label-free', !!dcirc && dcirc.getAttribute('fill') === FORM_COLORS['2'] && drow.querySelector('.formface').textContent === '');
    H.window.close();
  }

  console.log(failures ? '\n*** ' + failures + ' FAILURES ***' : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
