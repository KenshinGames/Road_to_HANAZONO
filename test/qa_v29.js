/* QA v0.29（v1.4）: 見た目の作り直し（表示のみ）
 * - バージョン表記 v1.4
 * - 和文フォントの埋め込み：3書体（HZ Rounded 500/800・HZ Display）が data URI の woff2 で入っている／
 *   game.js（コメントを除く）と index.html に出てくる文字がすべて subset に含まれる（tools/embed_fonts.py の流し忘れ検出）／
 *   OFL のライセンス文が同梱され、遊び方のクレジットにフォントの表記がある
 * - デザインの決まり：ライト（デーゲーム）とダーク（ナイター）のトークン、能力ランクの札の色が game.js の RANKS と一致
 *   （HANDOVER §4-7 の色）、ポジションの組の色札 pg1〜pg4、練習カードの系統色が9種すべてに当たる、ボタンの行の高さ
 * - 表示の目印：HUD の日付の札（年目＋月。textContent は従来どおり「1年目 ・ 4月」）、選手一覧とメンバー編成の名前の色札
 *   （ポジションの組と一致）、練習カードの data-k、成長レポートの役割チップ（重点・スタメン・控え）と能力名の札
 * - 乱数：画面を描くだけでは Math.random を呼ばない／枠の入れ子（.card .card）なし
 * 実行: node test/qa_v29.js （jsdom は test/node_modules にある前提） */
const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(ROOT + '/v02/play.html', 'utf8');
const CSS = fs.readFileSync(ROOT + '/v02/style.css', 'utf8');
const JS = fs.readFileSync(ROOT + '/v02/game.js', 'utf8');
const INDEX = fs.readFileSync(ROOT + '/v02/index.html', 'utf8');
const FIX = JSON.parse(fs.readFileSync(__dirname + '/fixtures/save_2slots.json', 'utf8'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  NG  ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function makeDom(preset, seed) {
  let s = (seed || 2929) >>> 0;
  const dom = new JSDOM(HTML, {
    url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      try { w.localStorage.clear(); } catch (e) {}
      if (preset) for (const k of Object.keys(preset)) w.localStorage.setItem(k, preset[k]);
      w.__rnd = 0;
      w.Math.random = function () {
        w.__rnd++;
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
    const iv = setInterval(() => { const a = w.document && w.document.querySelector('#app'); if (a && a.children.length) { clearInterval(iv); res(dom); } }, 10);
    setTimeout(() => { clearInterval(iv); res(dom); }, 3000);
  });
}
function H(dom) {
  const w = dom.window, d = w.document;
  return {
    window: w, document: d,
    text: () => d.querySelector('#app').textContent.replace(/\s+/g, ' '),
    btn: (label) => Array.from(d.querySelectorAll('button')).find(b => b.textContent.includes(label)),
    click: (label) => { const b = Array.from(d.querySelectorAll('button')).find(x => x.textContent.includes(label)); if (!b) throw new Error('button not found: ' + label); b.click(); }
  };
}
/* game.js の定数を文字列から取り出す（ゲームを動かさずに静的に照合する） */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');
}
function groupOfNo(no) { return no <= 3 ? 1 : (no <= 8 ? 2 : (no <= 10 ? 3 : 4)); }

(async () => {
  console.log('[1] バージョン表記');
  check('<title> v1.4', INDEX.includes('<title>Road to HANAZONO v1.4</title>'));
  check('タイトルの見出し v1.4', JS.includes("'高校ラグビー育成シミュレーション v1.4'"));
  check('遊び方のバージョン v1.4（Web版）', JS.includes("['バージョン', 'v1.4（Web版）']"));
  check('play.html は 4.5MB 以下', HTML.length <= 4.5 * 1024 * 1024, HTML.length);

  console.log('[2] 和文フォントの埋め込み');
  const fontBlock = (CSS.match(/\/\* @fonts:begin[\s\S]*?\/\* @fonts:end \*\//) || [''])[0];
  check('フォントの節（tools/embed_fonts.py の生成物）がある', fontBlock.length > 100000, fontBlock.length);
  const faces = fontBlock.match(/@font-face \{[^}]*\}/g) || [];
  check('@font-face が3つ（woff2 の data URI）', faces.length === 3 && faces.every(f => f.includes('url(data:font/woff2;base64,')), faces.length);
  check('HZ Rounded の本文（400〜600）と太字（700〜900）', faces.some(f => f.includes("'HZ Rounded'") && f.includes('font-weight: 400 600')) && faces.some(f => f.includes("'HZ Rounded'") && f.includes('font-weight: 700 900')));
  check('HZ Display（看板の数字と題字）', faces.some(f => f.includes("'HZ Display'")));
  const cs = (fontBlock.match(/\/\* @fonts:charset ([\s\S]*?) \*\//) || ['', ''])[1];
  const used = new Set([...stripComments(JS) + INDEX].filter(c => c.codePointAt(0) > 0x7E && c.codePointAt(0) <= 0xFFFF && !(c.codePointAt(0) >= 0xFE00 && c.codePointAt(0) <= 0xFE0F) && !(c.codePointAt(0) >= 0xD800 && c.codePointAt(0) <= 0xDFFF)));
  const missing = [...used].filter(c => !cs.includes(c));
  check('ゲームで使う文字がすべて subset に入っている（足りなければ tools/embed_fonts.py を流す）', cs.length > 1000 && missing.length === 0, missing.slice(0, 20).join(''));
  check('本文の書体の指定（HZ Rounded を先頭に、端末の書体を後ろに）', /--font-ui: 'HZ Rounded', -apple-system/.test(CSS) && /body \{\s*font-family: var\(--font-ui\)/.test(CSS));
  check('ボタンも同じ書体（UA の既定を継がない）', CSS.includes('button, select, input, textarea { font-family: inherit; }'));
  check('OFL のライセンス文を同梱', fs.existsSync(ROOT + '/v02/fonts/OFL-MPLUSRounded1c.txt') && fs.existsSync(ROOT + '/v02/fonts/OFL-DelaGothicOne.txt') &&
    fs.readFileSync(ROOT + '/v02/fonts/OFL-MPLUSRounded1c.txt', 'utf8').includes('SIL Open Font License'));
  check('遊び方のクレジットにフォントの表記', JS.includes("['フォント', 'M PLUS Rounded 1c ／ Dela Gothic One（SIL Open Font License 1.1）']"));

  console.log('[3] デザインの決まり（CSS）');
  const skin = (CSS.match(/\/\* @skin:begin \*\/[\s\S]*?\/\* @skin:end \*\//) || [''])[0];
  check('見た目の層（@skin）がある', skin.length > 10000, skin.length);
  check('ライトのトークン（空・紺・芝・金）', /--sky-a: #45b3ec;/.test(skin) && /--edge: #1a3474;/.test(skin) && /--brand: #20a346;/.test(skin) && /--gold: #ffc72c;/.test(skin));
  check('ダーク＝ナイターのトークン（夜空と照明）', /@media \(prefers-color-scheme: dark\) \{\s*:root \{\s*--sky-a: #091330;[^}]*--glow: rgba\(255, 246, 214, \.16\)/.test(skin));
  const ranks = [...JS.matchAll(/\{ r: '([SABCDEFG])', min: -?\d+, c: '(#[0-9a-f]{6})'/g)].map(m => [m[1], m[2]]);
  check('RANKS は8段階', ranks.length === 8, ranks.length);
  const rankCssOk = ranks.every(([r, c]) => skin.includes('.rk[data-rank="' + r + '"] { background: ' + c + '; }'));
  check('能力ランクの札の色が RANKS の色と一致（HANDOVER §4-7）', rankCssOk);
  check('ランクの文字は札の上の白（インラインの色指定は残したまま）', /\.rk \{[^}]*-webkit-text-fill-color: #fff;/.test(skin));
  check('ポジションの組の色札 pg1〜pg4', [1, 2, 3, 4].every(i => skin.includes('.pg' + i + ' { --pg: #')));
  const actsSrc = (JS.match(/var WEEK_ACTS = \[([\s\S]*?)\];/) || ['', ''])[1];
  const acts = [...actsSrc.matchAll(/\{ k: '([a-z]+)', n: '/g)].map(m => m[1]);
  check('練習カードは9種', acts.length === 9, acts.join(','));
  check('練習カードの系統色が9種すべてに当たる', acts.every(k => skin.includes('.wcard[data-k="' + k + '"]')), acts.filter(k => !skin.includes('.wcard[data-k="' + k + '"]')).join(','));
  check('ボタンの行の高さを 1.2 に固定（和文フォントの normal で高くならない）', skin.includes('button { line-height: 1.2; }'));
  check('選んでいるもの（選択肢・タブ・ボタン列）は金', /\.btn\.choice\.primary \{\s*background: linear-gradient\(180deg, #ffe789, #ffc52f\)/.test(skin) && /\.tabbtn\.on \{\s*background: linear-gradient\(180deg, #ffe789, #ffc52f\)/.test(skin) && /\.segbtn\.on \{\s*background: linear-gradient\(180deg, #ffe789, #ffc52f\)/.test(skin));
  check('決定ボタンは芝の緑', /\.btn\.primary \{\s*background: linear-gradient\(180deg, #46d06f, #1d9a42\)/.test(skin));
  check('キーボード操作の輪', skin.includes('button:focus-visible'));
  check('動きを減らす設定の扱いは従来どおり', CSS.includes('@media (prefers-reduced-motion: reduce)'));

  console.log('[4] 表示の目印（HUD・一覧・編成）');
  const A = H(await makeDom(FIX));
  await sleep(20);
  const r0 = A.window.__rnd;
  const hud = A.document.querySelector('.hud');
  check('HUD が出ている（3年目のセーブ）', !!hud);
  if (hud) {
    const chips = hud.querySelectorAll('.chip');
    check('チップは従来どおり4つ', chips.length === 4, chips.length);
    const date = hud.querySelector('.chip.date');
    const g = JSON.parse(FIX['hanazono.v02']);
    check('日付の札：年目（.yr）と月（b）', !!date && date.querySelector('.yr').textContent === g.year + '年目' && /月$/.test(date.querySelector('b').textContent));
    check('日付の札の textContent は従来どおり「n年目 ・ m月」', !!date && /^\d+年目 ・ \d+月$/.test(date.textContent), date && date.textContent);
  }
  A.click('選手一覧');
  await sleep(10);
  const rows = [...A.document.querySelectorAll('table.squad tr.prow')];
  const st = JSON.parse(FIX['hanazono.v02']);
  check('選手一覧の行数＝部員数', rows.length === st.players.length, rows.length + '/' + st.players.length);
  let plateOk = true, plateTextOk = true;
  rows.forEach((tr, i) => {
    const p = st.players[i];
    const np = tr.querySelector('td.name .nplate');
    if (!np) { plateOk = false; return; }
    const no = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15][p.posIdx];
    if (!np.classList.contains('pg' + groupOfNo(no))) plateOk = false;
    if (np.textContent !== p.name) plateTextOk = false;
  });
  check('名前の色札がポジションの組と一致', plateOk);
  check('名前の色札の文字は選手名そのもの', plateTextOk);
  check('ランクの札に data-rank がある', A.document.querySelectorAll('table.squad .rk[data-rank]').length === st.players.length * 6);
  check('枠の入れ子なし（選手一覧）', A.document.querySelectorAll('.card .card').length === 0);
  check('HUD・選手一覧を描くだけでは乱数を使わない', A.window.__rnd === r0, A.window.__rnd - r0);
  A.click('プロフィール');
  await sleep(5);
  check('プロフィールのタブでも乱数を使わない', A.window.__rnd === r0, A.window.__rnd - r0);
  A.document.querySelector('button[title="遊び方"]').click(); /* HUD の遊び方はアイコン（📖）のボタン */
  await sleep(5);
  check('遊び方のクレジットにフォント', A.text().includes('フォント') && A.text().includes('M PLUS Rounded 1c'));
  A.window.close();

  console.log('[5] 練習カードと成長レポート');
  const B = H(await makeDom(null));
  B.click('監督に就任する（ふつう）');
  await sleep(5);
  if (B.btn('終了する')) { B.click('終了する'); await sleep(5); }
  B.click('目標を決めて');
  await sleep(5);
  const instSave = B.window.localStorage.getItem('hanazono.v02'); /* 月頭指示（1年目・4月）の状態 */
  B.click('指示を確定');
  await sleep(10);
  const cards = [...B.document.querySelectorAll('.wcard')];
  check('練習カード9枚', cards.length === 9, cards.length);
  check('練習カードの data-k は WEEK_ACTS の順', cards.map(c => c.getAttribute('data-k')).join(',') === acts.join(','), cards.map(c => c.getAttribute('data-k')).join(','));
  check('枠の入れ子なし（週次）', B.document.querySelectorAll('.card .card').length === 0);
  B.window.close();

  const gs = JSON.parse(instSave);
  const p0 = gs.players[0], p1 = gs.players[1];
  gs.growReport = { label: '4月', rows: [
    { name: p0.name, stats: { spd: 3, tak: 2 }, trust: 5, total: 5, focus: true },
    { name: p1.name, stats: { sta: 1 }, trust: 0, total: 1, focus: false },
    { name: '卒業 済男', stats: { pow: 2 }, trust: 0, total: 2, focus: false }
  ] };
  gs.growAcc = null;
  gs.board = null;
  const C = H(await makeDom({ 'hanazono.v02': JSON.stringify(gs), 'hanazono.tut': '{"step":9,"done":1}' }));
  await sleep(20);
  const board = C.document.querySelector('.grboard');
  check('成長レポートが出る', !!board);
  if (board) {
    const roles = [...board.querySelectorAll('.grrole')];
    check('役割チップ：重点は r-focus', roles[0] && roles[0].classList.contains('r-focus') && roles[0].textContent === '重点');
    check('役割チップ：その他は r-start か r-bench（文字と一致）', roles.slice(1).every(r => (r.classList.contains('r-start') && r.textContent === 'スタメン') || (r.classList.contains('r-bench') && r.textContent === '控え')));
    const plates = [...board.querySelectorAll('.grplate')];
    check('名前札：部員はポジションの組の色', plates[0] && plates[0].classList.contains('pg' + groupOfNo(p0.posIdx + 1)) && !plates[0].getAttribute('style'));
    check('名前札：見つからない名前（卒業など）は従来の色', plates[2] && /background:/.test(plates[2].getAttribute('style') || ''));
    const items = [...board.querySelectorAll('.gritem')];
    check('能力名は白い札（.grlab。信頼度の矢印の行は除く）', items.length >= 3 && items.filter(it => !it.classList.contains('grtrust')).every(it => it.querySelector('.grlab')));
    check('能力の行の textContent は従来どおり「能力名 ランク 数値➡…」', items.some(it => /^スピード [SABCDEFG] \d+➡[SABCDEFG] \d+$/.test(it.textContent)), items.map(i => i.textContent).join(' | '));
  }
  C.window.close();

  console.log('[6] メンバー編成の名前札（対戦確認 → メンバー編成）');
  const E = H(await makeDom(null));
  E.click('監督に就任する（ふつう）'); await sleep(5);
  if (E.btn('終了する')) { E.click('終了する'); await sleep(5); }
  E.click('目標を決めて'); await sleep(5);
  /* 6月の練習試合まで「おまかせ」で進める（4月・5月の2か月） */
  for (let guard = 0; guard < 12 && !E.btn('メンバー編成'); guard++) {
    if (E.btn('指示を確定')) E.click('指示を確定');
    else if (E.btn('確認した')) E.click('確認した');
    else if (E.btn('おまかせ')) E.click('おまかせ');
    else if (E.btn('グラウンドへ戻る')) E.click('グラウンドへ戻る');
    else break;
    await sleep(10);
  }
  check('対戦確認に着いた', !!E.btn('メンバー編成'));
  if (E.btn('メンバー編成')) {
    const r1 = E.window.__rnd;
    E.click('メンバー編成'); await sleep(5);
    const lrows = [...E.document.querySelectorAll('table.squad tr.prow')];
    check('編成の15行', lrows.length === 15, lrows.length);
    check('編成の名前も色札（列の文字は名前＋補完の ※ のみ）', lrows.length === 15 && lrows.every(tr => { const np = tr.querySelector('.nplate'); return np && [...np.classList].some(c => /^pg[1-4]$/.test(c)) && tr.children[2].textContent.replace(' ※', '') === np.textContent; }));
    check('編成の色札は背番号の組と一致', lrows.every((tr, n) => tr.querySelector('.nplate').classList.contains('pg' + groupOfNo(n + 1))) || lrows.some(tr => tr.children[2].textContent.includes('※')));
    check('編成画面を描くだけでは乱数を使わない', E.window.__rnd === r1, E.window.__rnd - r1);
    check('枠の入れ子なし（編成）', E.document.querySelectorAll('.card .card').length === 0);
  }
  E.window.close();

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + ' (' + pass + ' ok, ' + fail + ' NG)');
  process.exit(fail ? 1 : 0);
})();
