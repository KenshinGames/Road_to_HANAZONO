/* QA v0.20: 新入生と締め
 * - スカウト成功率の内訳（parts）: 判定式の実在要素のみで構成され、合計が表示成功率と一致する（判定は不変）
 * - 勧誘の比較表示: 候補全員を表で見比べられ、その場で獲得リストを切り替えられる
 * - 新入生紹介: 入部確定後に紹介画面が挟まり、入部者全員が寸評・特能つきで表示され、目標設定へ進める
 * - 旧セーブ補完: parts を持たない勧誘中セーブでも内訳が復元され、壊れた intro は破棄される
 * - 実機レイアウト修正の DOM 側確認: 週次画面の会話が場面内バー（.wdlgbar.dlg）になり、情報カードが圧縮形（.winfo）になる
 *   （重なりゼロの数値確認は review_v20/shoot.js が 932×430 で行う。jsdom はレイアウトを計算しない）
 * 実行: node test/qa_v20.js （jsdom で v02/play.html を読み込む） */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const html = fs.readFileSync(path.join(__dirname, '..', 'v02', 'play.html'), 'utf8');
let failures = 0;
function check(name, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + (extra ? ' | ' + extra : '')); if (!cond) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function load(presetSave, seed) {
  const dom = new JSDOM(html, {
    url: 'https://localhost/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window) {
      if (seed != null) window.Math.random = mulberry32(seed);
      if (presetSave) window.localStorage.setItem('hanazono.v02', typeof presetSave === 'string' ? presetSave : JSON.stringify(presetSave));
    }
  });
  const { window } = dom;
  window.confirm = () => true;
  return {
    window, document: window.document,
    text: () => window.document.getElementById('app').textContent.replace(/\s+/g, ' '),
    btn: (s) => [...window.document.querySelectorAll('button')].find(b => b.textContent.includes(s)),
    click: function (s) { const b = this.btn(s); if (!b) throw new Error('button not found: ' + s); b.click(); },
    state: () => JSON.parse(window.localStorage.getItem('hanazono.v02'))
  };
}
/* タイトル→1シーズン自動プレイし、サマリー画面で止める（qa_v04 の駆動を流用。
   v0.20 の紹介画面は「次へ」含むボタンで通過できるため、この駆動はそのまま使える） */
async function playToSummary(H) {
  if (H.btn('監督に就任する')) { H.click('監督に就任する'); await sleep(20); }
  let guard = 0;
  while (guard++ < 20000) {
    const t = H.text();
    if (t.includes('NaN')) throw new Error('NaN text: ' + t.slice(0, 160));
    if (H.btn('新年度へ')) return true;
    if (H.btn('新年度を始める')) { H.click('新年度を始める'); await sleep(10); continue; }
    if (H.btn('目標を決めて')) { H.click('目標を決めて'); await sleep(120); continue; }
    if (H.btn('確認した')) { H.click('確認した'); await sleep(5); continue; } /* v0.22 追随: 成長レポートが専用レイアウト表示になり、確認後に指示フォームが出るため、駆動に確認ステップを追加（検証内容は不変） */
    if (H.btn('指示を確定')) { H.click('指示を確定'); await sleep(8); continue; }
    const pc = H.document.querySelector('.pcard');
    if (pc) { pc.click(); await sleep(3); continue; }
    if (H.btn('キックオフ')) { H.click('キックオフ'); await sleep(8); continue; }
    const opts = [...H.document.querySelectorAll('.choices .btn.choice')];
    if (opts.length && t.includes('成功率の目安')) {
      let best = opts[0], bp = -1;
      opts.forEach(o => { const m = o.textContent.match(/(\d+)%/); const p = m ? +m[1] : 0; if (p > bp) { bp = p; best = o; } });
      best.click(); await sleep(3); continue;
    }
    if (H.btn('試合を進める')) { H.click('試合を進める'); await sleep(3); continue; }
    if (H.btn('やった！次へ')) { H.click('やった！次へ'); await sleep(8); continue; }
    if (H.btn('次へ')) { H.click('次へ'); await sleep(8); continue; }
    throw new Error('stuck: ' + t.slice(0, 200));
  }
  throw new Error('guard exhausted before summary');
}
function partsSumOk(c) {
  const p = c.parts;
  if (!p) return false;
  const sum = p.base + p.grade + p.rep + p.talent + p.ob + p.adj;
  return Math.abs(Math.round(sum * 10) / 10 - Math.round(c.sp * 100)) < 0.06;
}

(async () => {
  /* ===== A. 勧誘：内訳データとカード表示 ===== */
  const H = load(null, 20200);
  await sleep(60);
  await playToSummary(H);
  const summarySave = H.window.localStorage.getItem('hanazono.v02');
  H.click('新年度へ'); await sleep(25);
  check('A: recruit screen appears', H.text().includes('新入生を迎える'));
  const st = H.state();
  check('A: every candidate has breakdown parts', st.recruit.cands.every(c => !!c.parts));
  check('A: parts are only real factors (base 52, ob is 10 or 0)', st.recruit.cands.every(c =>
    c.parts.base === 52 && c.parts.ob === (c.viaOb ? 10 : 0) && typeof c.parts.grade === 'number' &&
    typeof c.parts.rep === 'number' && typeof c.parts.talent === 'number' && typeof c.parts.adj === 'number'));
  check('A: parts sum to the displayed success rate', st.recruit.cands.every(partsSumOk),
    st.recruit.cands.map(c => Math.round(c.sp * 100) + '%').join(','));
  const t = H.text();
  check('A: breakdown rows render on cards', t.includes('部の格（') && t.includes('学校の評判（') && t.includes('候補の実力（高いほど届きにくい）'));
  const obCand = st.recruit.cands.find(c => c.viaOb);
  if (obCand) check('A: OB row renders for OB-introduced candidate', t.includes('OB紹介（' + obCand.viaOb + 'さん）'));
  else console.log('SKIP | A: OB row render (no OB candidate in this seed)');
  check('A: candidate cards show ability mini row', H.document.querySelectorAll('.statmini').length >= st.recruit.cands.length,
    'rows=' + H.document.querySelectorAll('.statmini').length);
  check('A: success rate judgement unchanged (sp still stored, 0.15..0.97)', st.recruit.cands.every(c => c.sp >= 0.15 && c.sp <= 0.97));

  /* ===== B. 比較表示 ===== */
  H.click('比較で見る'); await sleep(15);
  const cmp = H.document.querySelector('table.cmp');
  check('B: comparison table renders', !!cmp);
  check('B: all candidates are columns', cmp && H.document.querySelectorAll('table.cmp td.cmphead').length === st.recruit.cands.length,
    'heads=' + H.document.querySelectorAll('table.cmp td.cmphead').length);
  check('B: table has stats, success rate and blurb rows', ['総合', '成功率', '寸評', '特能', 'ポジション'].every(x => H.text().includes(x)));
  const cmpBtns = [...H.document.querySelectorAll('table.cmp button')].filter(b => b.textContent.includes('獲得リストに入れる'));
  check('B: toggle buttons inside table', cmpBtns.length === st.recruit.cands.length, 'btns=' + cmpBtns.length);
  if (cmpBtns.length) {
    cmpBtns[0].click(); await sleep(12);
    check('B: picking works from comparison view', H.state().recruit.cands.filter(c => c.picked).length === 1);
  }
  H.click('カードで見る'); await sleep(15);
  check('B: back to cards view', !!H.document.querySelector('.cand') && !H.document.querySelector('table.cmp'));
  check('B: pick survives view switch', H.state().recruit.cands.filter(c => c.picked).length === 1);

  /* ===== C. 新入生紹介 ===== */
  const before = H.state().players.length;
  H.click('新年度を始める'); await sleep(25);
  const stC = H.state();
  check('C: intro state recorded', !!stC.intro && Array.isArray(stC.intro.list) && stC.intro.list.length >= 1,
    'list=' + (stC.intro ? stC.intro.list.length : 'null'));
  check('C: intro screen appears', H.text().includes('新入生紹介'));
  check('C: every newcomer is on a card', stC.intro.list.every(x => {
    const p = stC.players.find(pp => pp.id === x.pid);
    return p && H.text().includes(p.name) && H.text().includes(x.note.slice(0, 12));
  }));
  check('C: intro kinds are valid', stC.intro.list.every(x => ['scout', 'special', 'general'].includes(x.kind)));
  check('C: roster grew or refilled', stC.players.length >= Math.min(before, 15), 'players=' + stC.players.length);
  check('C: month log still has the join lines', (stC.monthLog || []).some(l => l.includes('一般入部')));
  H.click('次へ進む'); await sleep(20);
  check('C: proceeds to goal screen', H.text().includes('目標を決めよう'));
  check('C: intro cleared after proceeding', H.state().intro === null);
  H.window.close();

  /* ===== D. 旧セーブ補完（parts なし・壊れた intro） ===== */
  {
    const stD = JSON.parse(summarySave);
    /* summarySave はサマリー時点。勧誘状態は持たないので、A の recruit を再現するために作り直す代わりに、
       recruit 中セーブを A の状態から作る： summary → 新年度へ の遷移後の保存値を模す */
    const H2 = load(null, 20200);
    await sleep(60);
    await playToSummary(H2);
    H2.click('新年度へ'); await sleep(25);
    const midRecruit = JSON.parse(H2.window.localStorage.getItem('hanazono.v02'));
    H2.window.close();
    midRecruit.recruit.cands.forEach(c => { delete c.parts; });
    midRecruit.intro = { list: [{ pid: 999999, kind: 'scout', note: '存在しない選手' }, { pid: 'x', kind: 'bad', note: 1 }] };
    const H3 = load(JSON.stringify(midRecruit), 777);
    await sleep(60);
    const st3 = H3.state();
    check('D: parts backfilled for legacy candidates', st3.recruit.cands.every(c => !!c.parts && partsSumOk(c)));
    check('D: breakdown still renders from backfill', H3.text().includes('部の格（'));
    check('D: broken intro discarded', st3.intro === null);
    check('D: legacy mid-recruit save still opens recruit screen', H3.text().includes('新入生を迎える'));
    H3.window.close();
  }

  /* ===== E. 週次画面の新構造（実機修正の DOM 側） ===== */
  {
    const H4 = load(null, 5151);
    await sleep(60);
    if (H4.btn('監督に就任する')) { H4.click('監督に就任する'); await sleep(20); }
    if (H4.btn('目標を決めて')) { H4.click('目標を決めて'); await sleep(60); }
    H4.click('指示を確定'); await sleep(20);
    check('E: weekly info card is the compact form', !!H4.document.querySelector('.winfo'));
    /* 会話つきの盤面を直接投入：会話バーが場面の中に出ること */
    const stE = H4.state();
    stE.board.dlg = { pid: stE.players[0].id, text: 'テストのセリフです' };
    const H5 = load(JSON.stringify(stE), 5151);
    await sleep(60);
    const bar = H5.document.querySelector('.wscene .wdlgbar.dlg');
    check('E: dialogue renders as a bar inside the scene', !!bar);
    check('E: dialogue line and portrait inside the bar', !!bar && bar.textContent.includes('テストのセリフです') && !!bar.querySelector('.portrait svg'));
    check('E: no dialogue card in the right column anymore', !H5.document.querySelector('.lay2 .col .card.dlg'));
    H4.window.close(); H5.window.close();
  }

  console.log(failures ? '\n*** ' + failures + ' FAILURES ***' : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
