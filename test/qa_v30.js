/* QA v0.30（v1.5）: 週次画面のシンプル化（表示のみ）
 * 作者「ここの画面、文字が多すぎる！ もっとゲームっぽく、不要な部分を削ってシンプルで分かりやすいデザインにしてみて！」
 * - バージョン表記 v1.5
 * - 文の案内をなくした：最下部のステータスバー（日付・あと◯週で月末・次の試合）、場面の一文
 *   （「月末に ◯◯ との試合がある。今週の活動を選ぼう」）、情報欄の「チーム平均疲労」「怪我人 ◯人」「今月末：◯◯戦」、
 *   週の記録の決まり文句「月が始まった。今週の活動を選ぼう」、活動カードの説明文
 * - 置き換え：場面の札（合宿＝金・次の試合＝時期＋VS＋相手。今月なら「月末」）／今月の予定表（済んだ週＝選んだ活動の
 *   アイコンと系統の data-k、今週＝now、移した月の記録のない週は「済」だけ）／疲労のゲージ（50未満・50〜69・70以上で色）と
 *   ケガ人の札／記録がない週は記録の箱を出さない／おまかせは右の列（文言は従来どおり）／活動カードの効果の札（WEEK_ACTS.fx）
 *   と title（名前：説明）／説明文は遊び方のガイド「週の活動」へ
 * - 乱数：週次画面を描くだけでは Math.random を呼ばない／枠の入れ子（.card .card）なし
 * 実行: node test/qa_v30.js （jsdom は test/node_modules にある前提） */
const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(ROOT + '/v02/play.html', 'utf8');
const CSS = fs.readFileSync(ROOT + '/v02/style.css', 'utf8');
const JS = fs.readFileSync(ROOT + '/v02/game.js', 'utf8');
const INDEX = fs.readFileSync(ROOT + '/v02/index.html', 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  NG  ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function makeDom(preset, seed) {
  let s = (seed || 3030) >>> 0;
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
/* WEEK_ACTS を game.js の文字列から取り出す（k・n・ic・d・fx） */
function weekActs() {
  const src = (JS.match(/var WEEK_ACTS = \[([\s\S]*?)\n  \];/) || ['', ''])[1];
  return src.split('\n').filter(l => /\{ k: '/.test(l)).map(l => {
    const g = (re) => (l.match(re) || [])[1];
    const fx = [...((l.match(/fx: \[(.*)\] \}/) || ['', ''])[1]).matchAll(/\['([^']+)', '(up|down|cost)'\]/g)].map(m => [m[1], m[2]]);
    return { k: g(/k: '([a-z]+)'/), n: g(/n: '([^']+)'/), ic: g(/ic: '([^']+)'/), d: g(/d: '([^']+)'/), fx };
  });
}
const NO_TUT = { 'hanazono.tut': '{"step":9,"done":1}' };
function weeklySave(base, mut) {
  const gs = JSON.parse(base);
  gs.board = { weekly: true, week: 0, log: [], dlg: null, picks: [] };
  gs.growReport = null; gs.growAcc = null;
  if (mut) mut(gs);
  return Object.assign({ 'hanazono.v02': JSON.stringify(gs) }, NO_TUT);
}

(async () => {
  console.log('[1] バージョン表記');
  check('<title> v1.6', INDEX.includes('<title>Road to HANAZONO v1.6</title>')); /* v0.31: バージョン表記を v1.6 に追随 */
  check('タイトルの見出し v1.6', JS.includes("'高校ラグビー育成シミュレーション v1.6'")); /* v0.31: バージョン表記を v1.6 に追随 */
  check('遊び方のバージョン v1.6（Web版）', JS.includes("['バージョン', 'v1.6（Web版）']")); /* v0.31: バージョン表記を v1.6 に追随 */
  check('play.html は 6MB 以下', HTML.length <= 6 * 1024 * 1024, HTML.length); /* v0.31: 場面の背景5枚（data URI 約1.2MB）の追加に伴い上限を 4.5→6MB に見直し */

  console.log('[2] 活動カードの効果の札（WEEK_ACTS.fx）');
  const ACTS = weekActs();
  check('活動は9種', ACTS.length === 9, ACTS.length);
  check('全活動に効果の札（1〜2個、up／down／cost）', ACTS.every(a => a.fx.length >= 1 && a.fx.length <= 2), ACTS.map(a => a.k + ':' + a.fx.length).join(','));
  check('効果の札は短い（6字以内）', ACTS.every(a => a.fx.every(f => f[0].length <= 6)));
  check('説明文 d は全活動に残っている（ガイドと title 用）', ACTS.every(a => a.d && a.d.length > 4));
  check('フィットネスは疲労の代償（cost）を札で示す', (ACTS.find(a => a.k === 'fitness') || { fx: [] }).fx.some(f => f[0] === '疲労' && f[1] === 'cost'));
  check('休養・ケアは疲労とケガが下がる（down）', (ACTS.find(a => a.k === 'rest') || { fx: [] }).fx.map(f => f.join(':')).join(',') === '疲労:down,ケガ:down');

  console.log('[3] 第1週（記録なし）');
  const A = H(await makeDom(null));
  A.click('監督に就任する（ふつう）');
  await sleep(5);
  if (A.btn('終了する')) { A.click('終了する'); await sleep(5); }
  A.click('目標を決めて');
  await sleep(5);
  const instSave = A.window.localStorage.getItem('hanazono.v02'); /* 月頭指示（1年目・4月）の状態 */
  A.click('指示を確定');
  await sleep(10);
  const t = A.text();
  check('週次画面に着いた（活動カード9枚）', A.document.querySelectorAll('.wcard').length === 9);
  check('最下部のステータスバーがない', !A.document.querySelector('.wstatus'));
  check('「あと◯週で月末」を出さない', !/あと\d週で月末/.test(t));
  check('「今週の活動を選ぼう」を出さない', !t.includes('今週の活動を選ぼう'));
  check('「月が始まった」を出さない', !t.includes('月が始まった'));
  check('「チーム平均疲労」「怪我人」の文言を出さない', !t.includes('チーム平均疲労') && !t.includes('怪我人'));
  check('「との試合がある」「今月末：」の文を出さない', !t.includes('との試合がある') && !t.includes('今月末：'));
  check('見出しは「4月 第1週」', (A.document.querySelector('.wtitle') || {}).textContent === '4月 第1週');
  const dots = [...A.document.querySelectorAll('.wdots .wdot')];
  check('今月の予定表は4枠、第1週が now・済みなし', dots.length === 4 && dots[0].classList.contains('now') && !dots.some(d => d.classList.contains('done')));
  const vs = A.document.querySelector('.wtvs');
  check('次の試合の札「6月 VS 相手」（4月は先の月）', !!vs && /^6月 VS \S+/.test(vs.textContent) && !vs.classList.contains('soon'), vs && vs.textContent);
  check('4月は合宿の札なし', !A.document.querySelector('.wtcamp'));
  const fat = A.document.querySelector('.wfat');
  const fv = fat ? Number(fat.querySelector('.wgval').textContent) : NaN;
  check('疲労のゲージ：数値と色の段（50未満＝f-lo）', !!fat && fv < 50 && fat.classList.contains('f-lo'), fv);
  const inj = A.document.querySelector('.winj');
  check('ケガ人の札「ケガ 0」（いなければ赤くしない）', !!inj && inj.textContent === 'ケガ 0' && !inj.classList.contains('on'), inj && inj.textContent);
  check('記録がない週は記録の箱を出さない（ゲージは独立の札）', !A.document.querySelector('.wtop .log') && !!A.document.querySelector('.winfo.wgauge.solo'));
  const auto = A.document.querySelector('.wtop .wauto');
  check('おまかせは右の列（文言は従来どおり）', !!auto && auto.textContent === '⏩ おまかせ（月末まで自動）' && auto.closest('.col') === A.document.querySelectorAll('.wtop > .col')[1]);
  const cards = [...A.document.querySelectorAll('.wcard')];
  check('カードに説明文（.wdsc）がない', !A.document.querySelector('.wcard .wdsc'));
  check('カードの効果の札が WEEK_ACTS.fx と一致', cards.every((c, i) => {
    const a = ACTS[i]; const fx = [...c.querySelectorAll('.wfx .fx')];
    return fx.length === a.fx.length && fx.every((e, j) => e.textContent === a.fx[j][0] + (a.fx[j][1] === 'down' ? '▼' : '▲') && e.classList.contains(a.fx[j][1] === 'cost' ? 'cost' : 'good'));
  }), cards.map(c => c.querySelector('.wfx').textContent).join('/'));
  check('カードの title は「名前：説明」', cards.every((c, i) => c.getAttribute('title') === ACTS[i].n + '：' + ACTS[i].d));
  check('カードの文字は名前・効果・札だけ（説明文が混ざらない）', cards.every((c, i) => !c.textContent.includes(ACTS[i].d)));
  check('おすすめの札は1枚', cards.filter(c => c.querySelector('.wbadge').textContent === '⭐おすすめ').length === 1);
  check('枠の入れ子なし（週次）', A.document.querySelectorAll('.card .card').length === 0);
  const r0 = A.window.__rnd;
  A.click('選手一覧'); await sleep(5);
  A.click('戻る'); await sleep(5);
  check('週次画面を描き直すだけでは乱数を使わない', A.window.__rnd === r0 && A.document.querySelectorAll('.wcard').length === 9, A.window.__rnd - r0);

  console.log('[4] 第2週（1枚選んだ後）');
  const k0 = cards[0].getAttribute('data-k');
  A.document.querySelector('.wcard').click();
  await sleep(10);
  const d2 = [...A.document.querySelectorAll('.wdots .wdot')];
  check('予定表：第1週＝選んだ活動（data-k とアイコン）、第2週＝now', d2[0].classList.contains('done') && d2[0].getAttribute('data-k') === k0 && d2[0].textContent === ACTS[0].ic && d2[1].classList.contains('now'));
  check('予定表の title「第1週：活動名」', d2[0].getAttribute('title') === '第1週：' + ACTS[0].n);
  check('記録の箱が出る（ゲージは記録と1枚の盤面）', !!A.document.querySelector('.wtop .log') && A.document.querySelector('.wtop .log').children.length >= 1 && !A.document.querySelector('.winfo.solo'));
  check('見出しは「4月 第2週」', (A.document.querySelector('.wtitle') || {}).textContent === '4月 第2週');
  A.window.close();

  console.log('[5] 月ごとの札・疲労の色・ケガ人・移した月');
  const B = H(await makeDom(weeklySave(instSave, gs => { gs.monthIdx = 2; gs.board.week = 1; gs.board.picks = ['rest']; gs.board.log = ['💊 ケアの日。全員の疲労が回復した']; gs.players.forEach(p => { p.fatigue = 55; }); })));
  await sleep(20);
  const vsB = B.document.querySelector('.wtvs');
  check('試合の月は「月末 VS 相手」（朱の soon）', !!vsB && /^月末 VS \S+/.test(vsB.textContent) && vsB.classList.contains('soon'), vsB && vsB.textContent);
  check('疲労 55 は黄（f-mid）', B.document.querySelector('.wfat').classList.contains('f-mid'), B.document.querySelector('.wgval').textContent);
  check('休養の週は予定表に休養（data-k=rest）', (B.document.querySelector('.wdot.done') || { getAttribute: () => null }).getAttribute('data-k') === 'rest');
  B.window.close();
  const C = H(await makeDom(weeklySave(instSave, gs => { gs.monthIdx = 4; gs.players.forEach(p => { p.fatigue = 75; }); gs.players[0].injured = 1; gs.players[0].injSev = '軽傷'; gs.players[0].injPart = '足首'; })));
  await sleep(20);
  const camp = C.document.querySelector('.wtcamp');
  check('8月は合宿の札「夏合宿 練習×1.5」', !!camp && camp.textContent === '夏合宿 練習×1.5', camp && camp.textContent);
  check('8月の次の試合は「10月 VS 相手」', !!C.document.querySelector('.wtvs') && /^10月 VS \S+/.test(C.document.querySelector('.wtvs').textContent));
  check('疲労 75 は赤（f-hi）', C.document.querySelector('.wfat').classList.contains('f-hi'));
  const injC = C.document.querySelector('.winj');
  check('ケガ人がいれば赤い札「ケガ 1」', !!injC && injC.classList.contains('on') && injC.textContent === 'ケガ 1', injC && injC.textContent);
  check('「夏合宿の月。練習の実りが1.5倍になる」の文は出さない', !C.text().includes('練習の実りが1.5倍になる'));
  C.window.close();
  const D = H(await makeDom(weeklySave(instSave, gs => { gs.monthIdx = 1; gs.board.week = 2; gs.board.picks = ['scrum']; })));
  await sleep(20);
  const dD = [...D.document.querySelectorAll('.wdots .wdot')];
  check('旧方式から移した月：記録のない第1週は「済」だけ（アイコンなし）', dD[0].classList.contains('done') && !dD[0].getAttribute('data-k') && dD[0].textContent === '');
  check('旧方式から移した月：記録は後ろの週に当てる（第2週＝scrum、第3週＝now）', dD[1].getAttribute('data-k') === 'scrum' && dD[2].classList.contains('now'));
  D.window.close();
  const E = H(await makeDom(weeklySave(instSave, gs => { gs.monthIdx = 10; })));
  await sleep(20);
  check('花園決勝の月も描ける（見出し「1月・花園決勝 第1週」・月末 VS）', (E.document.querySelector('.wtitle') || {}).textContent === '1月・花園決勝 第1週' && /^月末 VS /.test((E.document.querySelector('.wtvs') || {}).textContent || ''));
  E.window.close();

  console.log('[6] 遊び方のガイド「週の活動」');
  const G = H(await makeDom(weeklySave(instSave)));
  await sleep(20);
  G.document.querySelector('button[title="遊び方"]').click();
  await sleep(10);
  const gt = G.text();
  check('ガイドに「週の活動」の節', gt.includes('週の活動'));
  check('ガイドに全活動の説明文', ACTS.every(a => gt.includes(a.n) && gt.includes(a.d)), ACTS.filter(a => !gt.includes(a.d)).map(a => a.k).join(','));
  G.window.close();

  console.log('[7] CSS');
  const skin = (CSS.match(/\/\* @skin:begin \*\/[\s\S]*?\/\* @skin:end \*\//) || [''])[0];
  check('週次の節（@wk30）が見た目の層の中にある', /\/\* @wk30:begin \*\/[\s\S]*\/\* @wk30:end \*\//.test(skin));
  check('予定表の系統色が9種すべてに当たる', ACTS.every(a => skin.includes('.wdot[data-k="' + a.k + '"]')));
  check('疲労の色の段（f-mid・f-hi）', skin.includes('.wfat.f-mid .meter > div') && skin.includes('.wfat.f-hi .meter > div'));
  check('iPhone の帯（760〜960px）でカードを詰める', /@media \(min-width: 760px\) and \(max-width: 960px\) and \(orientation: landscape\) \{[^@]*\.wcard \.wnm \{ font-size: 11\.5px; \}/.test((CSS.match(/\/\* @wk30:begin \*\/[\s\S]*?\/\* @wk30:end \*\//) || [''])[0]));

  console.log('\n' + (fail ? '*** ' + fail + ' FAILURES ***' : 'ALL PASS (' + pass + ' ok, 0 NG)'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
