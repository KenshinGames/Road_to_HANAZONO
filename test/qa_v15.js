/* QA for v0.15: デザイン統一（能力ランク S〜G 併記の導入／選手詳細の作り替え／
 * 成長レポートの濃緑ボード化＋「ランク 数値 → ランク 数値」形式／初回ヒント／冬写真の条件付き確認）。
 * 対象は play.html（jsdom）。ハーネスは qa_v14 と同型、編成画面への到達は qa_v08 の gotoPreMatch を流用。 */
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
    btnAll: (sub) => [...document.querySelectorAll('button')].filter(b => b.textContent.includes(sub)),
    click: (sub) => { const b = H.btn(sub); if (!b) throw new Error('button not found: ' + sub + ' || ' + H.text().slice(0, 160)); b.click(); },
    state: () => JSON.parse(window.localStorage.getItem('hanazono.v02'))
  };
  return H;
}

async function freshSave(rngSeed) {
  const H = await makeDom(null, rngSeed || 777);
  H.click('監督に就任する（ふつう）'); await sleep(20);
  if (H.btn('目標を決めて')) { H.click('目標を決めて'); await sleep(15); }
  const js = H.window.localStorage.getItem('hanazono.v02');
  H.window.close();
  return js;
}

/* テスト側のランク表（game.js の RANKS と一致すること） */
function rankOf(v) {
  v = Math.round(v);
  if (v >= 90) return 'S'; if (v >= 80) return 'A'; if (v >= 70) return 'B'; if (v >= 60) return 'C';
  if (v >= 50) return 'D'; if (v >= 40) return 'E'; if (v >= 30) return 'F'; return 'G';
}
const STATKEYS = ['spd', 'pow', 'pas', 'kik', 'tak', 'sta'];

(async () => {
  const baseSave = await freshSave(777);
  const base = JSON.parse(baseSave);
  check('version: title is v1.0 (v0.25 でバージョン表記を追随)', html.includes('<title>Road to HANAZONO v1.0</title>'));
  check('save: fresh roster has >= 3 players', base.players.length >= 3, 'n=' + base.players.length);

  /* ---- 1. ランク境界値（一覧テーブルの描画で検証） ---- */
  {
    const st = JSON.parse(baseSave);
    st.players[0].stats = { spd: 90, pow: 89, pas: 80, kik: 79, tak: 70, sta: 60 };
    st.players[1].stats = { spd: 59, pow: 50, pas: 49, kik: 40, tak: 39, sta: 30 };
    st.players[2].stats = { spd: 29, pow: 20, pas: 99, kik: 85, tak: 44, sta: 31 };
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 11);
    H.click('選手一覧'); await sleep(15);
    const rows = [...H.document.querySelectorAll('table.squad tr')].slice(1);
    let allOk = true, detail = [];
    [0, 1, 2].forEach(pi => {
      const p = st.players[pi];
      const row = rows.find(r => r.textContent.includes(p.name));
      if (!row) { allOk = false; detail.push(p.name + ': row missing'); return; }
      const tds = row.querySelectorAll('td');
      STATKEYS.forEach((k, si) => {
        const cell = tds[6 + si];
        const rk = cell ? cell.querySelector('.rk') : null;
        const want = rankOf(p.stats[k]);
        if (!rk || rk.getAttribute('data-rank') !== want || !cell.textContent.includes(String(p.stats[k]))) {
          allOk = false; detail.push(p.name + '/' + k + '=' + p.stats[k] + ' want ' + want + ' got ' + (rk ? rk.getAttribute('data-rank') : 'none'));
        }
      });
    });
    check('rank: boundaries S/A/B/C/D/E/F/G rendered correctly in squad table', allOk, detail.join('; '));
    H.window.close();
  }

  /* ---- 2. 選手詳細：現行の全項目が残り、ランク併記＋タググリッドになる ---- */
  {
    const st = JSON.parse(baseSave);
    st.players[0].stats = { spd: 90, pow: 89, pas: 80, kik: 79, tak: 70, sta: 60 };
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 12);
    H.click('選手一覧'); await sleep(15);
    const row = [...H.document.querySelectorAll('table.squad tr')].find(r => r.textContent.includes(st.players[0].name));
    row.click(); await sleep(15);
    const det = H.document.querySelector('.pdetail');
    check('detail: redesigned panel exists', !!det);
    if (det) {
      const t = det.textContent.replace(/\s+/g, ' ');
      const items = ['体格', '性格', '特能・個性', '今季の記録', 'キャリア通算', '調子', '調子の推移', '信頼度', '疲労', '総合', 'スピード', 'パワー', 'パス', 'キック', 'タックル', 'スタミナ'];
      const missing = items.filter(x => !t.includes(x));
      check('detail: all v0.14 items retained', missing.length === 0, missing.join(','));
      const banner = det.querySelector('.pname');
      check('detail: name banner with No/year/pos badges', !!banner && banner.textContent.includes(st.players[0].name) && banner.querySelector('.pno') && banner.querySelectorAll('.pbadge').length >= 2);
      check('detail: profile shows height/weight', /\d+cm ／ \d+kg/.test(t));
      const lg = det.querySelectorAll('.rkval.lg');
      check('detail: 6 stats + overall use large rank+value', lg.length >= 7, 'n=' + lg.length);
      const firstRk = det.querySelector('.rkval.lg .rk');
      check('detail: spd 90 renders rank S', !!firstRk && firstRk.getAttribute('data-rank') === 'S');
      const tags = det.querySelectorAll('.taggrid .tag');
      check('detail: skill/trait tags in colored grid', tags.length >= 1, 'n=' + tags.length);
      check('detail: form face + history retained', !!det.querySelector('.formface') && !!det.querySelector('.formhist'));
    }
    H.window.close();
  }

  /* ---- 3. 成長レポート：濃緑ボード＋名前プレート＋「ランク 数値 → ランク 数値」 ---- */
  {
    const st = JSON.parse(baseSave);
    const p0 = st.players[0], p1 = st.players[1];
    st.growReport = {
      label: '4月',
      rows: [
        { name: p0.name, stats: { spd: 3, tak: 2 }, trust: 5, total: 5, focus: true },
        { name: p1.name, stats: { sta: 1 }, trust: 0, total: 1, focus: false }
      ]
    };
    st.growAcc = null;
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 13);
    await sleep(10);
    const board = H.document.querySelector('.grboard');
    check('growth: dark board rendered on inst screen', !!board);
    if (board) {
      const t = board.textContent.replace(/\s+/g, ' ');
      check('growth: centered board title', t.includes('〜 4月の成長レポート 〜'));
      const plates = [...board.querySelectorAll('.grplate')].map(e => e.textContent);
      check('growth: name plates for both players', plates.includes(p0.name) && plates.includes(p1.name), plates.join('/'));
      check('growth: year badge', [...board.querySelectorAll('.gryear')].some(e => e.textContent === p0.year + '年'));
      check('growth: focus role chip', [...board.querySelectorAll('.grrole')].some(e => e.textContent === '重点'));
      const items = [...board.querySelectorAll('.gritem')];
      const spdItem = items.find(e => e.textContent.includes('スピード'));
      let spdOk = false;
      if (spdItem) {
        const rks = [...spdItem.querySelectorAll('.rk')];
        const nums = spdItem.textContent.replace(/\s+/g, ' ');
        spdOk = rks.length === 2
          && rks[0].getAttribute('data-rank') === rankOf(p0.stats.spd - 3)
          && rks[1].getAttribute('data-rank') === rankOf(p0.stats.spd)
          && nums.includes(String(p0.stats.spd - 3)) && nums.includes(String(p0.stats.spd))
          && spdItem.querySelector('.grarrow') && spdItem.querySelector('.grarrow').textContent.includes('➡');
      }
      check('growth: ability shown as rank+value -> rank+value', spdOk, spdItem ? spdItem.textContent.replace(/\s+/g, ' ') : 'no item');
      const trustItem = items.find(e => e.textContent.includes('信頼度'));
      check('growth: trust shown with gold up-arrows', !!trustItem && trustItem.textContent.includes('↑↑'), trustItem ? trustItem.textContent : 'none');
      check('growth: confirm button clears report', !!H.btn('確認した'));
    }
    H.window.close();
  }

  /* ---- 4. 編成画面：スタメン表と控えボタンにランク併記 ---- */
  {
    const st = JSON.parse(baseSave);
    st.monthIdx = 2;
    st.board = { cells: [{ t: 'end', done: false }], pos: -1, hand: [1], log: [] };
    st.summary = null; st.recruit = null;
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 4242);
    /* v0.19 追随: 注入した旧盤面は週次方式へ移行されるため、対戦確認が出るまで週カードを進める */
    for (let g4 = 0; g4 < 6 && !H.text().includes('メンバー編成'); g4++) {
      const pc = H.document.querySelector('.pcard');
      if (!pc) break;
      pc.click(); await sleep(12);
    }
    check('lineup: reached preMatch', H.text().includes('メンバー編成'), H.text().slice(0, 80));
    H.click('メンバー編成'); await sleep(15);
    const rows = [...H.document.querySelectorAll('table.squad tr')].slice(1);
    check('lineup: 15 starter rows all carry a rank for overall', rows.length === 15 && rows.every(r => r.querySelector('.rk')), 'rows=' + rows.length);
    const inBtns = H.btnAll('IN ');
    check('lineup: bench IN buttons carry rank+value', inBtns.length === 0 || inBtns.every(b => b.querySelector('.rkval')), 'n=' + inBtns.length);
    H.window.close();
  }

  /* ---- 5. 記録室：OB の総合・最終能力がランク併記、旧 OB は「—」 ---- */
  {
    const st = JSON.parse(baseSave);
    st.obs = [
      { name: '往年の主将', pos: 'FL', avg: 83, year: 1, tries: 4, plays: 9, st: { spd: 88, pow: 91, pas: 70, kik: 40, tak: 95, sta: 66 }, path: 'プロリーグ' },
      { name: '旧時代のOB', pos: 'SH', avg: 55, year: 1, tries: 0, plays: 0 }
    ];
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 14);
    H.click('記録・OB'); await sleep(15);
    const t = H.text();
    check('records: OB名鑑 present', t.includes('OB名鑑'));
    const obStats = [...H.document.querySelectorAll('.obstats')];
    check('records: two OB stat lines', obStats.length === 2, 'n=' + obStats.length);
    if (obStats.length === 2) {
      /* 名鑑は新しい順（reverse）なので、後から push した旧 OB が先に来る場合がある。内容で照合する */
      const rich = obStats.find(e => e.querySelectorAll('.rk').length === 6);
      const poor = obStats.find(e => e.textContent.includes('最終能力 —'));
      check('records: rich OB has 6 ranked final stats', !!rich);
      if (rich) {
        const got = [...rich.querySelectorAll('.rk')].map(e => e.getAttribute('data-rank')).join('');
        check('records: final stat ranks A/S/B/E/S/C', got === 'ASBESC', got);
      }
      check('records: legacy OB falls back to —', !!poor);
    }
    const rkInRecords = H.document.querySelectorAll('.rk').length;
    check('records: overall of OB also ranked', rkInRecords >= 7, 'rk=' + rkInRecords);
    H.window.close();
  }

  /* ---- 6. 初回ヒント：新規の初月だけ出て、月を始めると消え、2か月目・既存セーブでは出ない ---- */
  {
    const H = await makeDom(null, 21);
    H.click('監督に就任する（ふつう）'); await sleep(15);
    if (H.btn('目標を決めて')) { H.click('目標を決めて'); await sleep(15); }
    check('hint: shown on first month of a new game', !!H.document.querySelector('.hintcard'));
    check('hint: flag still false before starting month', H.state().hintSeen === false);
    H.click('指示を確定'); await sleep(15);
    check('hint: flag set once the month starts', H.state().hintSeen === true);
    let guard = 0;
    while (guard++ < 80) {
      const s = H.state();
      if (s.monthIdx === 1 && H.text().includes('練習指示')) break;
      const pc = H.document.querySelector('.pcard');
      if (pc) { pc.click(); await sleep(4); } else await sleep(10);
    }
    check('hint: reached month 2 instruction screen', H.state().monthIdx === 1, 'mi=' + H.state().monthIdx);
    check('hint: not shown in month 2', !H.document.querySelector('.hintcard'));
    H.window.close();
  }
  {
    const st = JSON.parse(baseSave);
    delete st.hintSeen; /* v0.14 以前のセーブを模す */
    st.year = 3; st.monthIdx = 4;
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 22);
    await sleep(10);
    check('hint: migrated old save (year 3) does not show hint', !H.document.querySelector('.hintcard'));
    check('hint: migration marks old save as seen', H.state().hintSeen === true);
    H.window.close();
  }
  {
    const st = JSON.parse(baseSave);
    delete st.hintSeen;
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 23);
    await sleep(10);
    check('hint: old save still in its first month does show hint', !!H.document.querySelector('.hintcard'));
    H.window.close();
  }

  /* ---- 7. 冬写真（条件付き）：素材が無い現状では写真バナーは出ず、SVG のまま ---- */
  {
    const hasWinter = fs.existsSync(__dirname + '/../v02/img/scene-winter.jpg');
    if (!hasWinter) {
      check('winter: no scene-winter.jpg in repo (SVG banner kept)', true);
      check('winter: play.html has no photo-winter wiring yet', !html.includes('photo-winter'));
      const st = JSON.parse(baseSave);
      st.monthIdx = 9; /* 1月 */
      const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 24);
      await sleep(10);
      check('winter: January banner is not a photo banner', !H.document.querySelector('.photobanner'));
      H.window.close();
    } else {
      const st = JSON.parse(baseSave);
      st.monthIdx = 9;
      const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 24);
      await sleep(10);
      check('winter: January banner uses winter photo', !!H.document.querySelector('.photo-winter'));
      H.window.close();
    }
  }

  console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
