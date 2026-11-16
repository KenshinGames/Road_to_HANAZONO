/* QA v0.32（v1.7）: 操作しやすさの見直し（表示と操作の配置だけ。数値・判定・乱数消費・セーブ形式は不変）
 * 作者「ゲームを全体的に見直して、直すべきところを指摘して。より操作しやすいゲームにして」
 * 決まり：①判断に使う操作はスクロールの先に置かない ②進む・決定は下のバー ③押せる範囲は 44px 級 ④通知は決定ボタンに重ねない
 *   （配置と押せる範囲の実測は review_v32/shoot.js の tap 検査。ここは DOM の構造と動き）
 * - バージョン表記 v1.7・play.html は 6MB 以下
 * - 試合：進める／次へ は下のバー（.matchbar）。勝負どころの選択肢は .scchoices に 名前（.t）・決め手（.d）・成功率の印（.smark）。
 *   文字列は従来と同じ並び（「（成功率の目安 ◎）」）。場面の間は決定ボタンが「采配を選ぼう」（押せない）。
 *   選手交代は下のバーのボタンで右の欄を切り替え（.subopen）、交代が済んだら采配に戻る。後半の戦術変更は印を出さない（.plain）。
 *   ハーフタイムの形勢（.htbox）は右の欄に重ねず、実況に3行で残る
 * - 対戦確認：戦術は .tacgrid に4つ、指名は .pmprep に2つ、下のバーに メンバー編成／結果のみ表示／キックオフ
 * - 目標：5つを .goalrow で1画面に。説明は選んだ目標の分を左（.goalnow）に
 * - 月頭指示：初回ヒントは左の列。案内のバーが出ている間は重ねない
 * - 案内（チュートリアル）：「わかった」を押さずに進んでも追いつき、操作を一度やったら次の番へ進む
 * - 遊び方：戻る・チュートリアルの再表示は下のバー（スクロールの外）
 * - スカウト：獲得ボタンは能力のすぐ下。枠がいっぱいなら残りは押せない。決定ボタンに「あと n 名」。比較表は獲得の行が下端に貼り付く
 * - 連打よけ：実際のタップ（isTrusted）だけを短い間受けない。プログラムからの click() は対象外
 * - 通知は一度に2件まで・画面の上
 * - 乱数：欄の切り替え・描き直しでは Math.random を呼ばない
 * 実行: node test/qa_v32.js （jsdom は test/node_modules にある前提） */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(ROOT + '/v02/play.html', 'utf8');
const CSS = fs.readFileSync(ROOT + '/v02/style.css', 'utf8');
const JS = fs.readFileSync(ROOT + '/v02/game.js', 'utf8');
const INDEX = fs.readFileSync(ROOT + '/v02/index.html', 'utf8');
const SHOOT = fs.readFileSync(ROOT + '/review_v32/shoot.js', 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  NG  ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function makeDom(preset, seed) {
  let s = (seed || 3232) >>> 0;
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
      w.confirm = () => true;
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
  const q = (s) => d.querySelector(s), qa = (s) => Array.from(d.querySelectorAll(s));
  return {
    window: w, document: d, q, qa,
    text: () => q('#app').textContent.replace(/\s+/g, ' '),
    btn: (label) => qa('button').find(b => b.textContent.includes(label)),
    click: (label) => { const b = qa('button').find(x => x.textContent.includes(label)); if (!b) throw new Error('button not found: ' + label + ' || ' + q('#app').textContent.replace(/\s+/g, ' ').slice(0, 120)); b.click(); },
    state: () => JSON.parse(w.localStorage.getItem('hanazono.v02')),
    save: () => w.localStorage.getItem('hanazono.v02'),
    tut: () => JSON.parse(w.localStorage.getItem('hanazono.tut') || 'null'),
    rnd: () => w.__rnd
  };
}
const TUT_DONE = { 'hanazono.tut': '{"step":9,"done":1}' };
/* 新しいゲームを始めて（案内なし）、月頭指示まで進めたセーブ */
async function baseSave(seed) {
  const x = H(await makeDom(TUT_DONE, seed));
  x.click('監督に就任する（ふつう）'); await sleep(15);
  x.click('目標を決めて'); await sleep(60);
  const sv = x.save(); x.window.close();
  return sv;
}
/* 6月の最後の週（次のタップで対戦確認）にしたセーブ */
function juneLastWeek(base, mut) {
  const st = JSON.parse(base);
  st.monthIdx = 2; st.goalSet = true; st.summary = null; st.recruit = null;
  st.board = { weekly: true, week: 3, log: [], dlg: null, picks: ['scrum', 'kick', 'rest'] };
  if (mut) mut(st);
  return JSON.stringify(st);
}
async function toPreMatch(x) { x.q('.wcard').click(); await sleep(30); }
const sceneBtns = (x) => x.qa('.scchoices .btn.choice');
/* 試合を、条件を満たす場面が出るまで進める（先頭の選択肢を選んで通過） */
async function driveMatch(x, until, max) {
  for (let i = 0; i < (max || 200); i++) {
    if (until()) return true;
    if (x.btn('次へ') && x.text().includes('の内訳')) return false;
    const ch = sceneBtns(x);
    if (ch.length) { ch[0].click(); await sleep(3); continue; }
    if (x.btn('試合を進める')) { x.click('試合を進める'); await sleep(3); continue; }
    return false;
  }
  return false;
}

(async () => {
  console.log('[1] バージョン・静的な決まり');
  check('タイトルが v1.7', INDEX.includes('<title>Road to HANAZONO v1.7</title>') && HTML.includes('<title>Road to HANAZONO v1.7</title>'));
  check('ゲーム内の表記が v1.7（タイトル・遊び方）', JS.includes("['バージョン', 'v1.7（Web版）']") && /シミュレーション v1\.7/.test(JS));
  check('play.html は 6MB 以下', HTML.length <= 6 * 1024 * 1024, HTML.length);
  check('STORE_KEY は不変', JS.includes("STORE_KEY = 'hanazono.v02'"));
  const ux = (CSS.match(/\/\* @ux32:begin[\s\S]*?\/\* @ux32:end \*\//) || [''])[0];
  check('操作しやすさの節（@ux32）がある', ux.length > 3000, ux.length);
  check('HUD のボタンの当たり判定を上下に広げる（::after）', /\.hudbtn::after \{[^}]*top: -10px; bottom: -10px;/.test(ux));
  check('当たり判定の ::after は --tapx で出し入れできる（監査が見た目と分けて測る）', ux.includes(":root { --tapx: ''; }") && (ux.match(/content: var\(--tapx\)/g) || []).length === 3 && !/::after \{ content: '';/.test(ux) && SHOOT.includes("setProperty('--tapx', 'none')") && SHOOT.includes("'tap-scroll: '"));
  check('HUD は横のはみ出しだけを切る（上下の当たり判定を切らない）', ux.includes('@supports (overflow: clip) { .hud { overflow-x: clip; overflow-y: visible; } }'));
  check('小さい機種の詰め：案内つきの対戦確認は高さ 440 まで・mini（380 以下）の段がある', ux.includes('(max-height: 440px)') && ux.includes('(max-height: 380px)') && ux.includes('.tutcol ~ .heropanel .grec { display: none; }') && ux.includes('.tutcol ~ .heropanel .ggrade { display: none; }'));
  check('列の縮みの許可は対戦確認と試合だけ（選手一覧の右の欄を細らせない）', ux.includes('.laypm > .col, .laymatch > .col { min-width: 0; }') && !ux.includes('.lay2 > .col { min-width: 0; }'));
  check('選手のプロフィール：見出しの札を縦に折らない', ux.includes('.pdetail .rowline > .sub:first-child { white-space: nowrap; flex: none; }'));
  check('下のバーの決定ボタンは 44px 以上', ux.includes('.actionbar .btn { min-height: 44px; }'));
  check('通知は画面の上（下の決定ボタンに重ねない）', /\.toasts \{ bottom: auto; top: calc\(54px/.test(ux));
  check('試合の欄の切り替え（表示だけ）', ux.includes('.matchctrl.subopen .scpane { display: none; }') && ux.includes('.matchctrl .subbox { display: none;'));
  check('連打よけは実際のタップだけ（isTrusted）', JS.includes('function tapTooSoon(ev, since, ms) { return !!(ev && ev.isTrusted && since && (Date.now() - since) < ms); }'));
  check('連打よけ：画面の切り替え直後・場面の直後・週の直後', JS.includes('tapTooSoon(ev, screenAt, 280)') && JS.includes('tapTooSoon(ev, scShown.at, 400)') && JS.includes('tapTooSoon(ev, weekAt, 250)'));
  check('通知は一度に2件まで', JS.includes('while (toastLive < 2 && toastQ.length)'));
  check('監査に操作の検査（tap-hidden・tap-small）がある', SHOOT.includes("'tap-hidden: '") && SHOOT.includes("'tap-small: '") && SHOOT.includes('elementFromPoint'));

  const base = await baseSave(4201);

  console.log('[2] 目標：5つを1画面に');
  {
    const x = H(await makeDom(TUT_DONE, 4202));
    x.click('監督に就任する（ふつう）'); await sleep(15);
    const rows = x.qa('.goalbox .btn.choice.goalrow');
    check('目標は5つの行', rows.length === 5, rows.length);
    check('行の文字列は従来と同じ並び（名前 ― 説明（達成ボーナス 評判+n〜））', /^予選でまず1勝 ⭐おすすめ ✔選択中 — 花園予選の初戦を突破する（達成ボーナス 評判\+\d+〜）$/.test(rows[0].textContent), rows[0].textContent);
    check('各行に達成ボーナスの札', rows.every(r => /評判\+\d+〜/.test((r.querySelector('.gbonus') || {}).textContent || '')));
    check('選んでいる目標の説明は左のガラスに', (x.q('.glasscard .goalnow') || {}).textContent === '予選でまず1勝花園予選の初戦を突破する', (x.q('.goalnow') || {}).textContent);
    const r0 = x.rnd();
    rows[2].click(); await sleep(10);
    check('左のガラスの行に、畳める目印（部の格・おすすめ）', !!x.q('.glasscard .rowline.ggrade') && !!x.q('.glasscard .rowline.grec') && x.q('.glasscard .rowline.grec').textContent.startsWith('おすすめの目標'));
    check('別の目標を選ぶと左の説明も変わる', x.q('.goalnow').textContent.includes('県予選を制して全国大会へ') && x.state().goal === 'hana');
    check('目標を選び直しても乱数を使わない', x.rnd() === r0, x.rnd() - r0);
    check('決定は下のバー', !!x.q('.actionbar .btn.primary') && x.q('.actionbar .btn.primary').textContent === '目標を決めてシーズンを始める');
    x.window.close();
  }

  console.log('[3] 月頭指示：初回ヒントは左の列、案内とは重ねない');
  {
    const x = H(await makeDom(Object.assign({ 'hanazono.v02': base }, TUT_DONE), 4203));
    const cols = x.qa('.lay2.layinst > .col');
    check('初回ヒントは左の列（情報の列）', cols.length === 2 && !!cols[0].querySelector('.hintcard') && !cols[1].querySelector('.hintcard'));
    check('右の列は指示の盤面だけ', cols[1].children.length === 1 && cols[1].children[0].classList.contains('instcard'));
    check('ボタン列4つとセレクト2つ', x.qa('.instcard .seg[data-k]').length === 4 && x.qa('.instcard select').length === 2);
    x.window.close();
    const y = H(await makeDom({ 'hanazono.v02': base, 'hanazono.tut': '{"step":1,"done":0}' }, 4203));
    const c2 = y.qa('.lay2.layinst > .col');
    check('案内のバーが出ている間はヒントを重ねない', !!c2[0].querySelector('.tutbar.tutcol') && !y.q('.hintcard'));
    check('案内のバーは左の列（右の操作の列を削らない）', !c2[1].querySelector('.tutbar') && c2[1].children.length === 1);
    y.window.close();
  }

  console.log('[4] 案内（チュートリアル）は進みに追いつき、操作を一度やったら次へ進む');
  {
    const x = H(await makeDom(null, 4204));
    x.click('監督に就任する（ふつう）'); await sleep(15);
    check('目標で 1／5', (x.q('.tutbar') || {}).textContent.includes('（1／5）') && !!x.q('.lay2 .col .tutbar.tutcol'));
    x.click('目標を決めて'); await sleep(60); /* 「わかった」を押さずに先へ */
    check('「わかった」を押さずに進んでも、月頭指示で 2／5 が出る', !!x.q('.tutbar') && x.q('.tutbar').textContent.includes('（2／5）'), x.tut() && x.tut().step);
    x.click('指示を確定'); await sleep(20);
    check('週の画面で 3／5', !!x.q('.tutbar') && x.q('.tutbar').textContent.includes('（3／5）'));
    x.q('.wcard').click(); await sleep(15);
    check('最初の1週を選んだら週の案内は終わり', !x.q('.tutbar') && x.tut().step === 3 && x.tut().done === 0, JSON.stringify(x.tut()));
    x.window.close();
    const y = H(await makeDom({ 'hanazono.v02': juneLastWeek(base), 'hanazono.tut': '{"step":3,"done":0}' }, 4205));
    await toPreMatch(y);
    check('対戦確認で 4／5（細いバー）', !!y.q('.tutbar.tutsm') && y.q('.tutbar').textContent.includes('（4／5）'));
    y.click('キックオフ'); await sleep(20);
    check('試合で 5／5（「わかった」なしで追いつく）', !!y.q('.tutbar.tutsm') && y.q('.tutbar').textContent.includes('（5／5）'));
    await driveMatch(y, () => sceneBtns(y).length > 0);
    check('最初の采配を選ぶまでは出ている', !!y.q('.tutbar'));
    sceneBtns(y)[0].click(); await sleep(10);
    check('最初の采配を選んだら案内は終わり（done）', !y.q('.tutbar') && y.tut().done === 1, JSON.stringify(y.tut()));
    y.window.close();
    /* 最初の試合を「結果のみ表示」で飛ばした場合：早送り中の描画は「見せた」に数えず、結果の画面で一度だけ出す */
    const z = H(await makeDom({ 'hanazono.v02': juneLastWeek(base), 'hanazono.tut': '{"step":3,"done":0}' }, 4206));
    await toPreMatch(z);
    check('（前提）この試合は結果のみ表示にできる', !!z.btn('結果のみ表示（スキップ）'));
    z.click('結果のみ表示（スキップ）'); await sleep(30);
    check('結果のみ表示で飛ばしても、試合の案内は結果の画面で一度出る', !!z.q('.tutbar.tutsm') && z.q('.tutbar').textContent.includes('（5／5）') && z.tut().done === 0, JSON.stringify(z.tut()));
    z.q('.actionbar.matchbar .btn').click(); await sleep(20);
    if (z.btn('確認した')) { z.click('確認した'); await sleep(20); }
    check('試合の外へ進んだら案内は終わり（次の試合でまた出ない）', !z.q('.tutbar') && z.tut().done === 1, JSON.stringify(z.tut()));
    z.window.close();
  }

  console.log('[5] 対戦確認：戦術4つ・指名2つ・下のバー');
  {
    const x = H(await makeDom(Object.assign({ 'hanazono.v02': juneLastWeek(base, st => { st.players.forEach(p => { Object.keys(p.stats).forEach(k => { p.stats[k] = 70; }); }); }) }, TUT_DONE), 4206));
    await toPreMatch(x);
    const tac = x.qa('.pmctrl .tacgrid .btn.choice');
    check('戦術は 2×2 のタイルに4つ', tac.length === 4, tac.length);
    check('タイルの文字列は従来と同じ並び', tac[0].textContent === 'FW重視 — モールの成功率アップ' && tac[3].textContent === '守備固め — 守備の勝負どころの成功率アップ', tac.map(t => t.textContent).join('|'));
    check('従来の選択肢のセレクタでも4つ拾える', x.qa('.choices .btn.choice').length === 4);
    const sels = x.qa('.pmctrl .pmprep select');
    check('PGキッカーとエースのマークの指名が並ぶ', sels.length === 2 && sels[0].options[0].textContent === 'おまかせ' && sels[1].options[0].textContent === 'マークしない');
    check('指名の見出し', x.text().includes('🦵 キッカー＆マーク（任意）') && x.qa('.pmfield .lab').length === 2);
    const bar = x.qa('.actionbar.pmbar .btn').map(b => b.textContent);
    check('対戦確認のレイアウトに目印（.laypm）', !!x.q('.lay2.laypm'));
    check('下のバー：メンバー編成／結果のみ表示／キックオフ（決定は右）', bar.join('|') === '👥 メンバー編成|⏩ 結果のみ表示（スキップ）|キックオフ', bar.join('|'));
    check('右の列は盤面1枚だけ（ボタンを積まない）', x.qa('.lay2 > .col')[1].children.length === 1);
    const r0 = x.rnd();
    tac[2].click(); await sleep(10);
    check('戦術を選ぶと保存され、金の選択が移る', x.state().tactic === 'kick' && x.qa('.tacgrid .btn.choice.primary').length === 1 && x.qa('.tacgrid .btn.choice')[2].classList.contains('primary'));
    check('戦術の切り替えで乱数を使わない', x.rnd() === r0);
    x.click('メンバー編成'); await sleep(10);
    check('メンバー編成へ行ける（行の表に lineup の目印）', !!x.q('table.squad.lineup') && !!x.btn('試合前に戻る'));
    x.click('試合前に戻る'); await sleep(10);
    x.click('結果のみ表示（スキップ）'); await sleep(30);
    check('結果のみ表示で試合の結果へ', x.text().includes('の内訳') && !!x.q('.actionbar.matchbar .btn.primary'));
    x.window.close();
  }

  console.log('[6] 試合：進める／次へ は下のバー、選択肢は1画面');
  {
    const x = H(await makeDom(Object.assign({ 'hanazono.v02': juneLastWeek(base) }, TUT_DONE), 4207));
    await toPreMatch(x);
    x.click('キックオフ'); await sleep(20);
    const bar0 = x.qa('.actionbar.matchbar .btn');
    check('進行中：下のバーに 選手交代（押せない）／試合を進める', bar0.length === 2 && bar0[0].textContent === '🔁 選手交代' && bar0[0].disabled && bar0[1].textContent === '試合を進める' && !bar0[1].disabled);
    check('進行中：右の欄は今日の采配の控え', x.q('.matchctrl .sec').textContent === '📋 今日の采配' && x.qa('.matchctrl .memorow').length >= 3 && x.text().includes('選手交代残り5回'));
    check('右の欄に進めるボタンを置かない', !x.q('.matchctrl button'));
    check('スコアボード（校名・得点・時間）', x.qa('.card.score .pts').length === 2 && x.q('.card.score .vs').textContent === '0分');
    const ok = await driveMatch(x, () => sceneBtns(x).length === 3);
    check('勝負どころに到達', ok);
    const ch = sceneBtns(x);
    check('選択肢は 名前・決め手・成功率の印', ch.every(b => b.querySelector('.cmain .t') && b.querySelector('.cmain .d') && b.querySelector('.smwrap .smark') && b.hasAttribute('data-p')));
    check('選択肢の文字列は従来と同じ並び（… — …（成功率の目安 ◎））', ch.every(b => /^.+ — .+ （成功率の目安 [◎○△×]）$/.test(b.textContent)), ch[0].textContent);
    check('見出しは「勝負どころ：」＋場面の名前', x.q('.sctitle .scpre').textContent === '勝負どころ：' && x.q('.sctitle').textContent.startsWith('勝負どころ：') && x.q('.sctitle .scname').textContent.length > 3);
    check('右の欄に形勢の箱・キーマンの行を重ねない（実況とカットインにある）', !x.q('.htbox') && !x.qa('.matchctrl .sub').some(e => e.textContent.startsWith('キーマン：')) && !!x.q('.cutin') && x.text().includes('（キーマン：'));
    const bar1 = x.qa('.actionbar.matchbar .btn');
    check('場面の間：決定は「采配を選ぼう」（押せない）、選手交代は押せる', bar1[1].textContent === '采配を選ぼう' && bar1[1].disabled && /^(🔁|🚑) 選手交代（残り5回）$/.test(bar1[0].textContent) /* 負傷者がいると 🚑 */ && !bar1[0].disabled, bar1.map(b => b.textContent + (b.disabled ? '[x]' : '')).join('|'));
    check('場面の間は「試合を進める」を出さない（駆動の取り違え防止）', !x.btn('試合を進める'));
    /* 選手交代の欄 */
    const r0 = x.rnd(), sv0 = x.save();
    check('交代の欄は DOM にあり、はじめは閉じている', !!x.q('.matchctrl .subbox') && !x.q('.matchctrl.subopen'));
    x.click('選手交代（残り'); await sleep(8);
    check('ボタンで右の欄が選手交代に切り替わる', !!x.q('.matchctrl.subopen') && !!x.btn('◀ 采配に戻る') && x.btn('◀ 采配に戻る').classList.contains('on'));
    x.click('采配に戻る'); await sleep(8);
    check('もう一度押すと采配に戻る', !x.q('.matchctrl.subopen') && !!x.btn('選手交代（残り5回）'));
    check('欄の切り替えでは乱数もセーブも変わらない', x.rnd() === r0 && x.save() === sv0, x.rnd() - r0);
    x.click('選手交代（残り'); await sleep(8);
    x.q('.sublist .subbtn').click(); await sleep(8);
    check('下げる選手を選ぶと、入れる選手の一覧', x.qa('.sublist .subbtn').length > 0 && x.qa('.sublist .subbtn')[0].textContent.startsWith('IN ') && !!x.q('.matchctrl.subopen'));
    check('「交代をやめる」は見出しの行（一覧の上。スクロールの先に置かない）', !!x.q('.subhead .subcancel') && x.q('.subhead .subcancel').textContent === '交代をやめる' && x.q('.subhead').nextElementSibling === x.q('.sublist') && x.q('.subhead .sub').textContent.endsWith('を下げる。入れる選手を選ぶ'));
    x.click('交代をやめる'); await sleep(8);
    check('交代をやめると、下げる選手の一覧に戻る（欄は開いたまま）', !!x.q('.matchctrl.subopen') && x.qa('.sublist .subbtn')[0].textContent.startsWith('OUT ') && !x.q('.subhead'));
    x.q('.sublist .subbtn').click(); await sleep(8);
    x.q('.sublist .subbtn').click(); await sleep(8);
    check('交代が済んだら采配の欄に戻る（残り4回）', !x.q('.matchctrl.subopen') && !!x.btn('選手交代（残り4回）') && x.text().includes('🔁 交代：'));
    check('交代のあとも選択肢は3つ', sceneBtns(x).length === 3);
    sceneBtns(x)[0].click(); await sleep(8);
    check('采配を選ぶと先へ進む', sceneBtns(x).length === 0 || x.q('.sctitle').textContent !== '');
    /* 後半の戦術変更 */
    const okHt = await driveMatch(x, () => !!x.btn('変更しない'));
    check('後半の戦術変更に到達', okHt);
    if (okHt) {
      const ht = sceneBtns(x);
      check('後半の戦術変更は4つ・成功率の印を出さない（plain）', ht.length === 4 && !!x.q('.scchoices.plain') && !!x.q('.sctitle.plain'));
      check('決め手の文は1行に収まる長さ', ht.every(b => b.querySelector('.cmain .d').textContent.length <= 26), ht.map(b => b.querySelector('.cmain .d').textContent.length).join(','));
      x.click('変更しない'); await sleep(8);
    }
    await driveMatch(x, () => false, 300);
    check('試合終了：内訳と、下のバーに「次へ」だけ', x.text().includes('の内訳') && x.qa('.actionbar.matchbar .btn').length === 1 && /次へ$/.test(x.q('.actionbar.matchbar .btn').textContent) && x.qa('.matchctrl .frow').length === 4);
    x.q('.actionbar.matchbar .btn').click(); await sleep(20);
    check('次へで月が進む', !!x.btn('確認した') || !!x.btn('指示を確定'));
    x.window.close();
  }

  console.log('[7] ハーフタイムの形勢は実況に3行（右の欄には重ねない）');
  {
    const st = JSON.parse(base);
    st.monthIdx = 8; st.goalSet = true; st.summary = null; st.recruit = null; st.qualified = true;
    st.board = { weekly: true, week: 3, log: [], dlg: null, picks: ['scrum', 'kick', 'rest'] };
    st.players.forEach(p => { Object.keys(p.stats).forEach(k => { p.stats[k] = 78; }); p.fatigue = 5; });
    const x = H(await makeDom(Object.assign({ 'hanazono.v02': JSON.stringify(st) }, TUT_DONE), 4208));
    await toPreMatch(x);
    x.click('キックオフ'); await sleep(20);
    const got = await driveMatch(x, () => x.q('.sctitle') && x.q('.sctitle').textContent.startsWith('ハーフタイム：'));
    check('ハーフタイムの場面に到達（県予選決勝）', got);
    if (got) {
      const lines = x.qa('.log > div').map(e => e.textContent);
      const i0 = lines.findIndex(l => l.startsWith('⏸ ハーフタイム：'));
      check('実況に形勢の3行（スコア・得点内訳・ひとこと）', i0 >= 0 && lines[i0 + 1].startsWith('前半の得点内訳') && lines[i0 + 2].length > 10, lines.slice(i0, i0 + 3).join(' / '));
      check('右の欄は選択肢3つだけ（箱を重ねない）', !x.q('.htbox') && sceneBtns(x).length === 3);
    }
    x.window.close();
  }

  console.log('[8] 遊び方：戻るは下のバー');
  {
    const x = H(await makeDom(Object.assign({ 'hanazono.v02': base }, TUT_DONE), 4209));
    x.q('.hudbtn.icon[title="遊び方"]').click(); await sleep(10);
    const bar = x.qa('.actionbar .btn').map(b => b.textContent);
    check('下のバーに チュートリアルの再表示／戻る', bar.join('|') === '🎓 チュートリアルをもう一度見る|◀ 戻る', bar.join('|'));
    check('本文のスクロールの中にボタンを置かない', x.qa('.flatbox button').length === 0);
    check('試合と采配の説明に、下のバーと選手交代・指名の説明', x.text().includes('下の「試合を進める」で実況が進み') && x.text().includes('下の「選手交代」から') && x.text().includes('マークはエースを抑える代わりに、ほかの選手への対応が薄くなる'));
    x.click('◀ 戻る'); await sleep(10);
    check('戻るで元の画面へ', !!x.btn('指示を確定'));
    x.window.close();
    const y = H(await makeDom(TUT_DONE, 4209));
    y.click('遊び方'); await sleep(10);
    check('タイトルからの遊び方も下のバーで戻れる', y.qa('.actionbar .btn').some(b => b.textContent === '◀ タイトルへ戻る'));
    y.window.close();
  }

  console.log('[9] スカウト：獲得の操作は上、枠の残りが分かる');
  {
    /* 1シーズンを流して勧誘の画面へ（駆動は従来のソークと同じ手順） */
    const x = H(await makeDom(TUT_DONE, 4210));
    x.click('監督に就任する（ふつう）'); await sleep(15);
    let g = 0;
    while (g++ < 4000 && !x.btn('新年度へ')) {
      if (x.btn('目標を決めて')) { x.click('目標を決めて'); await sleep(40); continue; }
      if (x.btn('確認した')) { x.click('確認した'); await sleep(3); continue; }
      if (x.btn('指示を確定')) { x.click('指示を確定'); await sleep(3); continue; }
      if (x.btn('おまかせ')) { x.click('おまかせ'); await sleep(2); continue; }
      if (x.btn('キックオフ')) { x.click('キックオフ'); await sleep(3); continue; }
      const ch = sceneBtns(x);
      if (ch.length) { ch[0].click(); await sleep(2); continue; }
      if (x.btn('試合を進める')) { x.click('試合を進める'); await sleep(2); continue; }
      if (x.btn('次へ')) { x.click('次へ'); await sleep(3); continue; }
      break;
    }
    check('シーズンの締めに到達（新しい配置のまま1シーズン流せる）', !!x.btn('新年度へ'), x.text().slice(0, 80));
    x.click('新年度へ'); await sleep(20);
    const R = x.state().recruit;
    const cards = x.qa('.card.cand').filter(c => c.querySelector('.candpick'));
    check('候補のカードに獲得の行（成功率＋ボタン）', cards.length === R.cands.length && cards.length > 0, cards.length + '/' + R.cands.length);
    check('獲得ボタンは能力のすぐ下（寸評より上）', cards.every(c => { const k = Array.from(c.children); const a = k.findIndex(e => e.classList.contains('candact')); return a > 0 && k[a - 1].classList.contains('statmini') && k.findIndex(e => e.tagName === 'P') > a; }));
    const quota = Math.min(parseInt((x.text().match(/スカウト獲得枠 ?(\d+)名/) || [])[1], 10), R.cands.length);
    check('決定ボタンに獲得枠の残り', x.q('.actionbar .btn.primary').textContent === '新年度を始める（獲得枠 あと' + quota + '名）', x.q('.actionbar .btn.primary').textContent);
    const r0 = x.rnd();
    for (let i = 0; i < quota; i++) { x.qa('.candpick').filter(b => !b.disabled && b.textContent === '獲得リストに入れる')[0].click(); await sleep(8); }
    check('枠を使い切ると決定ボタンは元の文言', x.q('.actionbar .btn.primary').textContent === '新年度を始める');
    const rest = x.qa('.candpick').filter(b => b.textContent === '獲得リストに入れる');
    check('枠がいっぱいなら残りの候補は押せない', rest.length === R.cands.length - quota && rest.every(b => b.disabled));
    check('選んだ候補は外せる', x.qa('.candpick').filter(b => b.textContent === '✔ 獲得リストから外す').length === quota && x.qa('.candpick').filter(b => b.textContent.startsWith('✔')).every(b => !b.disabled));
    check('候補を選ぶだけでは乱数を使わない', x.rnd() === r0);
    x.click('比較で見る'); await sleep(10);
    check('比較：帯の文字列は同じで、部の格の分は畳める目印つき', /^部の格 .+ ／ 獲得枠 \d+名（選択中 \d+名）$/.test(x.q('.cmpstrip .sub').textContent) && /^部の格 .+ ／ $/.test(x.q('.cmpstrip .sub .sgrade').textContent), x.q('.cmpstrip .sub').textContent);
    check('比較：帯は1段（説明文なし）', !!x.q('.strip.cmpstrip') && !x.text().includes('成功率の内訳は「カードで見る」で確認できる'));
    const last = x.q('table.cmp').lastChild;
    check('比較：獲得の行は表のいちばん下で、貼り付けの目印つき', last.classList.contains('cmppick') && last.querySelectorAll('button').length === R.cands.length);
    check('比較：枠がいっぱいなら残りは押せない', Array.from(last.querySelectorAll('button')).filter(b => b.disabled).length === R.cands.length - quota);
    check('貼り付けの CSS（sticky）', /table\.cmp tr\.cmppick > th, table\.cmp tr\.cmppick > td \{ position: sticky; bottom: -1px;/.test(CSS));
    x.click('新年度を始める'); await sleep(20);
    check('新年度へ進める', !!x.btn('次へ進む') || !!x.btn('目標を決めて'));
    x.window.close();
  }

  console.log('[10] 連打よけはプログラムからの click() に効かない（QA・ソークの駆動は変わらない）');
  {
    const x = H(await makeDom(Object.assign({ 'hanazono.v02': juneLastWeek(base, st => { st.board.week = 0; st.board.picks = []; }) }, TUT_DONE), 4211));
    const wk = () => x.q('.wtitle').textContent;
    const w0 = wk();
    x.q('.wcard').click(); x.q('.wcard').click(); /* 間を置かずに2回 */
    await sleep(10);
    check('続けて click() した2回とも受ける（第1週→第3週）', w0.includes('第1週') && wk().includes('第3週'), w0 + ' → ' + wk());
    x.window.close();
  }

  console.log('[11] おまかせは確認を1つ挟む（作者の決定）');
  {
    check('確認のボタンは出た直後 0.4 秒、実際のタップを受けない', JS.includes('tapTooSoon(ev, autoAsk && autoAsk.at, 400)'));
    check('画面を離れたら確認は取り消し', JS.includes('{ screenAt = Date.now(); autoAsk = null; }'));
    check('確認の行は1回目と同じ場所（右の列の下端）', CSS.includes('.wtop .wautoask { display: flex; gap: 8px; margin-top: auto !important; }'));
    const toWeek = async (x) => { x.click('監督に就任する（ふつう）'); await sleep(15); x.click('目標を決めて'); await sleep(40); x.click('指示を確定'); await sleep(20); };
    const x = H(await makeDom(TUT_DONE, 4211)); await toWeek(x);
    const w0 = x.state().board.week, r0 = x.rnd(), sv0 = x.save();
    x.click('おまかせ（月末まで自動）'); await sleep(8);
    const ask = x.qa('.wtop .wautoask .btn');
    check('1回目：同じ場所が「やめる／おまかせで月末まで進める」に変わる（決定は右）', ask.length === 2 && ask[0].textContent === 'やめる' && ask[1].textContent === '⏩ おまかせで月末まで進める' && ask[1].classList.contains('primary') && !x.btn('おまかせ（月末まで自動）'));
    check('1回目では進まない（週・乱数・セーブそのまま）', x.state().board.week === w0 && x.rnd() === r0 && x.save() === sv0);
    x.click('やめる'); await sleep(8);
    check('「やめる」で元のボタンに戻る', !x.q('.wautoask') && !!x.btn('おまかせ（月末まで自動）') && x.rnd() === r0);
    x.click('おまかせ（月末まで自動）'); await sleep(8);
    x.q('.wcard').click(); await sleep(10);
    check('確認中に週のカードを選ぶと、その週を進めて確認は取り消し', !x.q('.wautoask') && !!x.btn('おまかせ（月末まで自動）') && x.state().board.week === w0 + 1);
    x.click('おまかせ（月末まで自動）'); await sleep(8);
    x.click('選手一覧'); await sleep(8); x.click('戻る'); await sleep(8);
    check('確認中に画面を離れて戻ると、確認は取り消し', !x.q('.wautoask') && !!x.btn('おまかせ（月末まで自動）'));
    x.click('おまかせ（月末まで自動）'); await sleep(8);
    x.click('おまかせで月末まで進める'); await sleep(20);
    check('2回目で月末まで進む', !x.state().board || !x.state().board.weekly || x.state().monthIdx === 1, JSON.stringify(x.state().board));
    /* 確認を挟んでも結果は同じ：同じ種で、1週目を同じカードにして、確認なしの経路（2回すぐ押す）と比べる */
    const y = H(await makeDom(TUT_DONE, 4211)); await toWeek(y);
    y.q('.wcard').click(); await sleep(10);
    y.click('おまかせ（月末まで自動）'); await sleep(8); y.click('おまかせで月末まで進める'); await sleep(20);
    check('寄り道（やめる・画面の行き来）をしても、乱数の消費と結果は同じ', x.rnd() === y.rnd() && JSON.stringify(x.state().players) === JSON.stringify(y.state().players), x.rnd() + ' vs ' + y.rnd());
    x.window.close(); y.window.close();
  }

  console.log('[12] タイトル：制作表記は遊び方のクレジットに任せ、ボタンは 44px');
  {
    const x = H(await makeDom(null, 4212));
    check('タイトルに制作表記の行がない', !x.text().includes('制作：Kenshin Takada') && !x.text().includes('Muse との共同開発'));
    check('タイトルのボタンは 44px 以上（CSS）', CSS.includes('.titlewrap .title-card .btn { min-height: 44px; }'));
    x.click('遊び方'); await sleep(10);
    check('遊び方のクレジット節に制作・開発の表記がある', x.text().includes('クレジット') && x.text().includes('Kenshin Takada') && x.text().includes('Muse（AI）との共同開発'));
    x.window.close();
  }

  console.log('\n' + (fail ? '*** ' + fail + ' FAILURES ***' : 'ALL PASS') + ' (' + pass + ' ok, ' + fail + ' NG)');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
