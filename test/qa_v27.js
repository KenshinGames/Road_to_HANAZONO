/* QA v0.27（v1.2）: 操作画面の手直し（すべて表示のみ）
 * - バージョン表記 v1.2
 * - 月頭指示: 方針・ユニット・強度・校風はボタン列（.seg[data-k]）、重点・キャプテンはセレクト。押すと保存値が変わり、
 *   画面は再描画しない（押した列のボタンだけ付け替える）。方針のボタンにはスタメン平均のランクが出る。校風の効果欄は選択に追随
 * - 対戦確認: 見出し帯（.pmhero）に vs 相手校と総合力の比較。スクロール枠は キーマン対比 → スカウティング → スタメン編成 の順。
 *   スカウティング内の「相手の総合力」の重複行は無い。枠の入れ子なし
 * - 練習ログ: 同じ選手・同じ能力の伸びは1件に合算される（v1.1 の同シードでは重複が出ていたことも確認）
 * - 選択中の目標・戦術の補足文の色／OB の「n年目卒」表記／icon-180.png
 * - 同値性: v1.1 の実ビルド（review_v27/play_v26_baseline.html）と同じシード・同じ指示で2年進め、
 *   選手・評判・戦績・OB が完全に一致する（表示のみの変更で乱数消費が変わっていない）
 * 実行: node test/qa_v27.js （jsdom は test/node_modules にある前提） */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HTML = fs.readFileSync(__dirname + '/../v02/play.html', 'utf8');
const HTML_V26 = fs.readFileSync(__dirname + '/../review_v27/play_v26_baseline.html', 'utf8');
const CSS = fs.readFileSync(__dirname + '/../v02/style.css', 'utf8');
const JS = fs.readFileSync(__dirname + '/../v02/game.js', 'utf8');

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
    state: () => JSON.parse(w.localStorage.getItem('hanazono.v02') || 'null')
  };
}
const TUT_DONE = { 'hanazono.tut': '{"step":5,"done":1}' };
const STAT_N = ['スピード', 'パワー', 'パス', 'キック', 'タックル', 'スタミナ'];

/* 練習ログ1行の中で「同じ選手・同じ能力」が2回以上出ている組の数 */
const ENTRY = new RegExp('⭐?([^、。（）]+?)（(' + STAT_N.join('|') + ')\\+\\d+）', 'g');
function dupPairs(line) {
  const seen = {}; let d = 0, m;
  ENTRY.lastIndex = 0;
  while ((m = ENTRY.exec(line))) { const k = m[1].trim() + '|' + m[2]; if (seen[k]) d++; seen[k] = 1; }
  return d;
}
/* 月頭指示の入力：v1.2 はボタン列、v1.1 はセレクト（team/unit/focus/level/captain/ethos の順）で同じ値を選ぶ */
function setInst(x, isNew, v) {
  const d = x.document;
  if (isNew) {
    d.querySelector('.seg[data-k="team"] [data-v="' + v.team + '"]').click();
    d.querySelector('.seg[data-k="unit"] [data-v="' + v.unit + '"]').click();
    d.querySelector('.seg[data-k="level"] [data-v="' + v.level + '"]').click();
    d.querySelector('.seg[data-k="ethos"] [data-v="' + v.ethos + '"]').click();
  } else {
    const s = d.querySelectorAll('select');
    [[0, v.team], [1, v.unit], [3, v.level], [5, v.ethos]].forEach(([i, val]) => { s[i].value = val; s[i].onchange(); });
  }
}
/* おまかせで進める駆動。月頭指示では setInst を通し、週ごとに盤面ログを集める */
async function play(html, isNew, seed, maxYear, inst) {
  const dom = await makeDom(html, TUT_DONE, seed);
  const x = H(dom);
  x.click('監督に就任する（ふつう）'); await sleep(10);
  const lines = new Set();
  let guard = 0, stuck = null;
  while (guard++ < 60000) {
    const st = x.state();
    if (st && st.board && st.board.log) st.board.log.forEach(l => lines.add(l));
    if (st && st.monthLog) st.monthLog.forEach(l => lines.add(l)); /* 月末に盤面ログは「最近の出来事」へ移る */
    if (x.btn('新年度へ')) {
      if (st.year >= maxYear) break;
      x.click('新年度へ'); await sleep(3);
      const tog = x.btn('獲得リストに入れる'); if (tog) { tog.click(); await sleep(1); }
      if (x.btn('新年度を始める')) { x.click('新年度を始める'); await sleep(3); }
      continue;
    }
    if (x.btn('新年度を始める')) { x.click('新年度を始める'); await sleep(3); continue; }
    if (x.btn('目標を決めて')) { x.click('目標を決めて'); await sleep(10); continue; }
    if (x.btn('確認した')) { x.click('確認した'); await sleep(3); continue; }
    if (x.btn('指示を確定')) { if (inst) setInst(x, isNew, inst); x.click('指示を確定'); await sleep(3); continue; }
    if (x.btn('おまかせ（月末まで自動）')) { x.click('おまかせ（月末まで自動）'); await sleep(1); continue; }
    if (x.btn('結果のみ表示（スキップ）')) { x.click('結果のみ表示（スキップ）'); await sleep(2); continue; }
    if (x.btn('キックオフ')) { x.click('キックオフ'); await sleep(2); continue; }
    if (x.btn('変更しない')) { x.click('変更しない'); await sleep(0); continue; }
    const opts = [...x.document.querySelectorAll('.choices .btn.choice')];
    if (opts.length) { opts[0].click(); await sleep(0); continue; }
    if (x.btn('試合を進める')) { x.click('試合を進める'); await sleep(0); continue; }
    if (x.btn('やった！次へ')) { x.click('やった！次へ'); await sleep(2); continue; }
    if (x.btn('次へ')) { x.click('次へ'); await sleep(2); continue; }
    stuck = x.text().slice(0, 160); break;
  }
  return { dom, x, stuck, lines: [...lines] };
}
/* 表示に依らない状態の指紋（文言を含むログ類は除く） */
function fingerprint(st) {
  return JSON.stringify({
    year: st.year, monthIdx: st.monthIdx, rep: st.rep, inst: st.inst, ethos: st.ethos, captainId: st.captainId,
    players: st.players.map(p => [p.id, p.name, p.year, p.posIdx, p.stats, p.trust, p.fatigue, p.form, p.injured, p.skills]),
    history: st.history, obs: (st.obs || []).map(o => [o.name, o.year, o.pos, o.avg, o.path])
  });
}

(async () => {
  /* ---- 1. 静的：バージョン・CSS・文言・アイコン ---- */
  check('version: <title> is v1.2', HTML.includes('<title>Road to HANAZONO v1.2</title>'));
  check('version: hero text is v1.2', JS.includes("'高校ラグビー育成シミュレーション v1.2'"));
  check('css: selected choice subtext uses the brand ink (not --sub)', /\.btn\.primary\.choice \.d \{ color: var\(--brand-ink\)/.test(CSS));
  check('wording: OB year reads "n年目卒" everywhere (9 strings, no bare n年卒)', !/'年卒/.test(JS) && (JS.match(/'年目卒/g) || []).length === 9);
  const icon = fs.readFileSync(__dirname + '/../v02/icons/icon-180.png');
  check('icon: icon-180.png exists and is 180x180 PNG', icon.slice(1, 4).toString() === 'PNG' && icon.readUInt32BE(16) === 180 && icon.readUInt32BE(20) === 180);
  check('static: play.html size <= 3.5MB', Buffer.byteLength(HTML, 'utf8') <= 3500000, Buffer.byteLength(HTML, 'utf8'));

  /* ---- 2. 月頭指示：ボタン列 ---- */
  {
    const dom = await makeDom(HTML, TUT_DONE, 2701);
    const x = H(dom);
    x.click('監督に就任する（ふつう）'); await sleep(10);
    x.click('目標を決めて'); await sleep(10);
    const d = x.document;
    const keys = [...d.querySelectorAll('.seg[data-k]')].map(e => e.getAttribute('data-k')).join(',');
    check('inst: four button rows in order (team/unit/level/ethos)', keys === 'team,unit,level,ethos', keys);
    check('inst: two selects remain (focus/captain)', d.querySelectorAll('select').length === 2);
    check('inst: team row has 6 buttons, others 3', d.querySelectorAll('.seg[data-k="team"] .segbtn').length === 6 &&
      ['unit', 'level', 'ethos'].every(k => d.querySelectorAll('.seg[data-k="' + k + '"] .segbtn').length === 3));
    const st0 = x.state();
    const onV = k => { const b = d.querySelector('.seg[data-k="' + k + '"] .segbtn.on'); return b ? b.getAttribute('data-v') : null; };
    check('inst: current values are marked (one .on per row)', onV('team') === st0.inst.team && onV('unit') === st0.inst.unit &&
      onV('level') === String(st0.inst.level) && onV('ethos') === st0.ethos &&
      ['team', 'unit', 'level', 'ethos'].every(k => d.querySelectorAll('.seg[data-k="' + k + '"] .segbtn.on').length === 1));
    /* 方針ボタンのランクは、スタメン（保存編成なし＝ポジション別の総合上位）の能力平均と一致する */
    const teamBtns = [...d.querySelectorAll('.seg[data-k="team"] .segbtn')];
    check('inst: team buttons show a rank letter + value', teamBtns.every(b => b.querySelector('.rk') && /\d+$/.test(b.textContent.trim())));
    const shown = teamBtns.map(b => +b.textContent.trim().match(/(\d+)$/)[1]);
    const ov = p => ['spd', 'pow', 'pas', 'kik', 'tak', 'sta'].reduce((a, k) => a + p.stats[k], 0) / 6;
    const used = {}, xi = [];
    for (let n = 0; n < 15; n++) {
      const c = st0.players.filter(p => p.posIdx === n && !used[p.id]).sort((a, b) => ov(b) - ov(a));
      const ch = c.filter(p => !p.injured)[0] || c[0];
      if (ch) { used[ch.id] = 1; xi.push(ch); }
    }
    const exp = ['spd', 'pow', 'pas', 'kik', 'tak', 'sta'].map(k => Math.round(xi.reduce((a, p) => a + p.stats[k], 0) / xi.length));
    check('inst: team button values equal the starters average per stat', JSON.stringify(shown) === JSON.stringify(exp), shown.join(',') + ' vs ' + exp.join(','));
    /* 押すと保存値が変わり、画面は再描画しない（同じノードのまま .on だけ動く） */
    const card = d.querySelector('.seg[data-k="team"]').closest('.card');
    const pasBtn = d.querySelector('.seg[data-k="team"] [data-v="pas"]');
    pasBtn.click(); await sleep(5);
    d.querySelector('.seg[data-k="unit"] [data-v="BK"]').click(); await sleep(5);
    d.querySelector('.seg[data-k="level"] [data-v="2"]').click(); await sleep(5);
    d.querySelector('.seg[data-k="ethos"] [data-v="free"]').click(); await sleep(5);
    const st1 = x.state();
    check('inst: clicks save team/unit/level/ethos', st1.inst.team === 'pas' && st1.inst.unit === 'BK' && st1.inst.level === 2 && st1.ethos === 'free',
      JSON.stringify([st1.inst.team, st1.inst.unit, st1.inst.level, st1.ethos]));
    check('inst: no re-render on click (same nodes, .on moved)', d.contains(card) && d.contains(pasBtn) && pasBtn.classList.contains('on') &&
      d.querySelectorAll('.seg[data-k="team"] .segbtn.on').length === 1);
    check('inst: aria-pressed mirrors the selection', [...d.querySelectorAll('.seg[data-k="team"] .segbtn')].every(b => b.getAttribute('aria-pressed') === String(b === pasBtn)));
    check('inst: ethos note follows the selection', d.querySelector('.seg[data-k="ethos"] .segnote').textContent === '疲労が抜けやすい');
    check('inst: level is a number in the save (same type as v1.1)', typeof st1.inst.level === 'number');
    /* 確定後の月でも選択が保たれる */
    x.click('指示を確定'); await sleep(5);
    check('inst: instruction survives confirm', x.state().inst.team === 'pas' && x.state().inst.level === 2);
    dom.window.close();
  }

  /* ---- 3. 対戦確認：見出し帯＋キーマン先頭 ---- */
  {
    /* 6月の練習試合（青葉・エースあり）の対戦確認まで進める */
    const dom = await makeDom(HTML, TUT_DONE, 2702);
    const x = H(dom);
    x.click('監督に就任する（ふつう）'); await sleep(10);
    let guard = 0;
    while (guard++ < 3000 && !x.btn('キックオフ')) {
      if (x.btn('目標を決めて')) { x.click('目標を決めて'); await sleep(10); continue; }
      if (x.btn('確認した')) { x.click('確認した'); await sleep(3); continue; }
      if (x.btn('指示を確定')) { x.click('指示を確定'); await sleep(3); continue; }
      if (x.btn('おまかせ（月末まで自動）')) { x.click('おまかせ（月末まで自動）'); await sleep(1); continue; }
      if (x.btn('次へ')) { x.click('次へ'); await sleep(2); continue; }
      break;
    }
    const d = x.document;
    check('prematch: reached', !!x.btn('キックオフ'));
    const hero = d.querySelector('.heropanel.pmhero');
    check('prematch: header band (hero + glass) exists with the match banner as its background', !!hero && !!hero.querySelector('.banner.pmb.herobg') && !!hero.querySelector('.glasscard.pmglass'));
    const st = x.state();
    const nums = hero ? [...hero.querySelectorAll('.pmnum')].map(e => e.textContent) : [];
    check('prematch: band shows vs + both team powers', !!hero && hero.textContent.includes('vs 青葉高校') && nums.length === 2 && nums[0] === String(x.text().match(/総合力 ([\d.]+)/)[1]),
      nums.join(' / '));
    const card = d.querySelector('.card.pmcard');
    check('prematch: scroll card holds keyman → scouting → lineup in that order', !!card && (() => {
      const km = card.querySelector('.keyman'), sc = card.querySelector('.scout'), lu = card.querySelector('.pmlineup');
      return km && sc && lu && (km.compareDocumentPosition(sc) & 4) && (sc.compareDocumentPosition(lu) & 4);
    })());
    check('prematch: scouting no longer repeats 相手の総合力', !!card && !card.querySelector('.scout').textContent.includes('相手の総合力'));
    check('prematch: keyman columns keep portrait + name + rank (compact body)', d.querySelectorAll('.kmcol .kmbody .portrait').length === 2 && d.querySelectorAll('.kmcol .kminfo .rk').length >= 4);
    check('prematch: no nested .card inside .card', d.querySelectorAll('.card .card').length === 0);
    check('prematch: lineup status row retained', x.text().includes('スタメン編成') && x.text().includes('自動選出'));
    dom.window.close();
  }

  /* ---- 4. 練習ログの合算と、v1.1 との同値性（同シード・同指示で2年） ---- */
  {
    const inst = { team: 'pas', unit: 'FW', level: '1', ethos: 'passion' };
    const a = await play(HTML_V26, false, 2703, 2, inst);
    const b = await play(HTML, true, 2703, 2, inst);
    check('drive: both builds reached year 2 without getting stuck', !a.stuck && !b.stuck, (a.stuck || '') + ' | ' + (b.stuck || ''));
    const sa = a.x.state(), sb = b.x.state();
    check('equivalence: players/rep/history/OB identical to v1.1 after 2 years', fingerprint(sa) === fingerprint(sb));
    check('equivalence: instruction values identical (buttons ↔ selects)', JSON.stringify(sa.inst) === JSON.stringify(sb.inst) && sa.ethos === sb.ethos && sb.inst.level === 1);
    const isPractice = l => { ENTRY.lastIndex = 0; return ENTRY.test(l); };
    const prA = a.lines.filter(isPractice), prB = b.lines.filter(isPractice);
    const dA = prA.reduce((n, l) => n + dupPairs(l), 0), dB = prB.reduce((n, l) => n + dupPairs(l), 0);
    check('log: v1.1 showed duplicate name+stat entries in practice lines (scenario exercised)', dA > 0, 'dups=' + dA + ' lines=' + prA.length);
    check('log: v1.2 practice lines have no duplicate name+stat entries', prB.length > 0 && dB === 0, 'dups=' + dB + ' lines=' + prB.length);
    a.dom.window.close(); b.dom.window.close();
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  console.log(fail ? 'SOME FAILED' : 'ALL PASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
