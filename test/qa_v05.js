/* QA for v0.5: portrait determinism/uniqueness, match cut-in, dialogue box, seasonal scenes, full soak. */
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
async function makeDom(seedValue, seed) {
  const dom = new JSDOM(html, {
    url: 'http://localhost/v02/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window) { if (seedValue) window.localStorage.setItem('hanazono.v02', seedValue); }
  });
  const { window } = dom, { document } = window;
  if (seed) {
    const s = document.createElement('script');
    s.textContent = 'Math.random = (' + lcg.toString() + ')(' + seed + ');';
    document.body.appendChild(s);
  }
  await sleep(60);
  return { window, document };
}
function helpers(window, document) {
  const text = () => document.getElementById('app').textContent.replace(/\s+/g, ' ');
  const btn = (sub) => [...document.querySelectorAll('button')].find(b => b.textContent.includes(sub));
  const state = () => JSON.parse(window.localStorage.getItem('hanazono.v02'));
  const click = (sub) => { const b = btn(sub); if (!b) throw new Error('button not found: ' + sub + ' || ' + text().slice(0, 160)); b.click(); };
  return { text, btn, state, click };
}

(async () => {
  /* ---- 1. 立ち絵の決定性と一意性 ---- */
  let baseSave;
  {
    const d1 = await makeDom(null, 777);
    const h1 = helpers(d1.window, d1.document);
    h1.click('監督に就任する'); await sleep(20);
    baseSave = d1.window.localStorage.getItem('hanazono.v02');
    const nPlayers = h1.state().players.length;
    h1.click('選手一覧'); await sleep(20);
    const minis1 = [...d1.document.querySelectorAll('.pmini')].map(e => e.innerHTML);
    check('list: every player row has a mini portrait', minis1.length === nPlayers, minis1.length + '/' + nPlayers);
    const distinct = new Set(minis1).size;
    check('list: portraits are (mostly) unique per player', distinct / minis1.length >= 0.75, 'distinct=' + distinct + '/' + minis1.length);
    check('list: portrait is an SVG with layers', minis1[0].includes('<svg') && minis1[0].includes('viewBox="0 0 100 120"'));
    const row = d1.document.querySelector('tr.prow');
    row.click(); await sleep(20);
    const detail1 = d1.document.querySelector('.detail-p');
    check('detail: big portrait shown', !!detail1 && detail1.innerHTML.includes('<svg'));
    const detailSvg1 = detail1 ? detail1.innerHTML : '';
    d1.window.close();

    const d2 = await makeDom(baseSave, 3131);
    const h2 = helpers(d2.window, d2.document);
    h2.click('選手一覧'); await sleep(20);
    const minis2 = [...d2.document.querySelectorAll('.pmini')].map(e => e.innerHTML);
    check('determinism: same save -> identical mini portraits', JSON.stringify(minis1) === JSON.stringify(minis2));
    const row2 = d2.document.querySelector('tr.prow');
    row2.click(); await sleep(20);
    const detail2 = d2.document.querySelector('.detail-p');
    check('determinism: same save -> identical detail portrait', !!detail2 && detail2.innerHTML === detailSvg1);
    d2.window.close();
  }

  /* ---- 2. 会話劇：盤面セーブに dlg を入れて再読込すると会話ボックスが出る ---- */
  {
    const st = JSON.parse(baseSave);
    st.board = {
      cells: [{ t: 'pS', done: false }, { t: 'end', done: false }], pos: -1, hand: [1, 2, 3],
      log: ['テストの月'], dlg: { pid: st.players[0].id, text: 'テストのセリフです' }
    };
    st.summary = null; st.recruit = null;
    const d = await makeDom(JSON.stringify(st), 42);
    const hh = helpers(d.window, d.document);
    check('dialogue: box renders on board screen', !!d.document.querySelector('.dlg'));
    check('dialogue: line and speaker portrait shown', hh.text().includes('テストのセリフです') && !!d.document.querySelector('.dlg .portrait svg'));
    d.window.close();
  }

  /* ---- 3. 季節感：4月=桜がバナーSVGに反映される（8月は v0.11 で合宿写真バナーに差し替え済み） ---- */
  {
    const mk = (mi) => { const s = JSON.parse(baseSave); s.monthIdx = mi; s.board = null; s.summary = null; s.recruit = null; return JSON.stringify(s); };
    const dA = await makeDom(mk(0), 1);
    const svgA = dA.document.querySelector('.banner').innerHTML;
    check('season: April banner has cherry petals', svgA.includes('#ffb7cd'));
    dA.window.close();
    const dB = await makeDom(mk(4), 1);
    /* v0.11: 8月の月次バナーは SVG（夏の太陽/雲）から合宿イラスト写真に差し替わったため、新仕様を検証する */
    check('season: August banner is the camp photo (v0.11)', dB.document.querySelector('.banner').classList.contains('photo-camp'));
    dB.window.close();
    const dC = await makeDom(mk(8), 1);
    const svgC = dC.document.querySelector('.banner').innerHTML;
    check('season: December banner has winter tint', svgC.includes('#dfe9f2'));
    dC.window.close();
  }

  /* ---- 4. ソーク：2シーズン自動プレイ（カットイン・勧誘立ち絵・例外なし） ---- */
  {
    const { window, document } = await makeDom(null, 20261029);
    const { text, btn, state, click } = helpers(window, document);
    click('監督に就任する'); await sleep(20);
    let guard = 0, seasons = 0, cutinSeen = 0, sceneSeen = 0, recruitPortraits = 0, badText = '';
    while (guard++ < 30000 && seasons < 2) {
      const t = text();
      if (t.includes('NaN') || t.includes('undefined')) { badText = t.slice(0, 160); break; }
      if (btn('新年度へ')) { click('新年度へ'); await sleep(15); continue; }
      if (btn('新年度を始める')) {
        recruitPortraits = document.querySelectorAll('.cand .portrait').length;
        const tog = btn('獲得リストに入れる'); if (tog) { tog.click(); await sleep(8); }
        click('新年度を始める'); seasons++; await sleep(15); continue;
      }
      if (btn('目標を決めて')) { click('目標を決めて'); await sleep(120); continue; }
      if (btn('確認した')) { click('確認した'); await sleep(5); continue; } /* v0.22 追随: 成長レポートが専用レイアウト表示になり、確認後に指示フォームが出るため、駆動に確認ステップを追加（検証内容は不変） */
      if (btn('指示を確定')) { click('指示を確定'); await sleep(8); continue; }
      const pc = document.querySelector('.pcard');
      if (pc) { pc.click(); await sleep(3); continue; }
      if (btn('キックオフ')) { click('キックオフ'); await sleep(8); continue; }
      const opts = [...document.querySelectorAll('.choices .btn.choice')];
      if (opts.length && t.includes('成功率の目安')) {
        sceneSeen++;
        if (document.querySelector('.cutin')) cutinSeen++;
        let best = opts[0], bp = -1;
        opts.forEach(o => { const m = o.textContent.match(/(\d+)%/); const p = m ? +m[1] : 0; if (p > bp) { bp = p; best = o; } });
        best.click(); await sleep(3); continue;
      }
      if (btn('試合を進める')) { click('試合を進める'); await sleep(3); continue; }
      if (btn('やった！次へ')) { click('やった！次へ'); await sleep(8); continue; }
      if (btn('次へ')) { click('次へ'); await sleep(8); continue; }
      throw new Error('stuck: ' + t.slice(0, 200));
    }
    check('soak: no NaN/undefined text', badText === '', badText);
    check('soak: 2 seasons completed', seasons >= 2, 'seasons=' + seasons);
    check('soak: match cut-in appears at key scenes', cutinSeen >= 3, 'cutin=' + cutinSeen + '/scenes=' + sceneSeen);
    check('soak: recruit cards show portraits', recruitPortraits >= 3, 'portraits=' + recruitPortraits);
    check('soak: final roster all valid', state().players.length >= 15);
    window.close();
  }

  console.log(failures ? '\n*** ' + failures + ' FAILURES ***' : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
