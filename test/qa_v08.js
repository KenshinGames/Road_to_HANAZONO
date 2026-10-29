/* QA for v0.8: lineup formation (reflected in team power, injured not selectable, season reset),
 * substitutions at stop points (remaining scenes use the new field, 5-sub limit, free injury sub),
 * condition/form (fields, drift/recovery, display in squad list + detail), 2-season soak. */
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
  const btnAll = (sub) => [...document.querySelectorAll('button')].filter(b => b.textContent.includes(sub));
  const state = () => JSON.parse(window.localStorage.getItem('hanazono.v02'));
  const click = (sub) => { const b = btn(sub); if (!b) throw new Error('button not found: ' + sub + ' || ' + text().slice(0, 160)); b.click(); };
  return { text, btn, btnAll, state, click };
}
function overallOf(p) { return Object.values(p.stats).reduce((a, b) => a + b, 0) / 6; }
const FORM_ICONS = ['💀', '😞', '😐', '😊', '🔥'];

/* goto preMatch: craft a board with a single end cell in a match month and play it */
async function gotoPreMatch(h, d, monthIdx, seed) {
  const st = h.state();
  st.monthIdx = monthIdx; st.board = { cells: [{ t: 'end', done: false }], pos: -1, hand: [1], log: [] };
  st.summary = null; st.recruit = null;
  const nd = await makeDom(JSON.stringify(st), seed || 4242);
  const nh = helpers(nd.window, nd.document);
  /* v0.19 追随: 注入した旧盤面は週次方式へ移行されるため、対戦確認（キックオフ）が出るまで
   * 週カードをクリックして月を進める（従来は月末マスへの1クリック）。到達先の検証は変えていない */
  for (let g = 0; g < 6 && !nh.text().includes('キックオフ'); g++) {
    const pc = nd.document.querySelector('.pcard');
    if (!pc) break;
    pc.click(); await sleep(12);
  }
  return nd;
}

(async () => {
  let baseSave;
  {
    const d = await makeDom(null, 777);
    const h = helpers(d.window, d.document);
    h.click('監督に就任する'); await sleep(15);
    if (h.btn('目標を決めて')) { h.click('目標を決めて'); await sleep(10); }
    baseSave = d.window.localStorage.getItem('hanazono.v02');
    const st = h.state();
    check('form: all players have form in -2..2', st.players.every(p => Number.isInteger(p.form) && p.form >= -2 && p.form <= 2));
    check('lineup: new game starts with lineup=null (auto)', st.lineup === null);
    d.window.close();
  }

  /* ---- 1. マイグレーション: form/lineup のない旧セーブ ---- */
  {
    const st = JSON.parse(baseSave);
    st.players.forEach(p => { delete p.form; });
    st.lineup = [1, 2, 3]; /* 壊れた編成 */
    const d = await makeDom(JSON.stringify(st), 5);
    const h = helpers(d.window, d.document);
    const after = h.state();
    check('migration: form backfilled in range', after.players.every(p => Number.isInteger(p.form) && p.form >= -2 && p.form <= 2));
    check('migration: broken lineup reset to null', after.lineup === null);
    d.window.close();
  }

  /* ---- 2. 編成画面: 入れ替えが保存され、総合力に反映される ---- */
  {
    const d0 = await makeDom(baseSave, 31);
    const h0 = helpers(d0.window, d0.document);
    const d = await gotoPreMatch(h0, d0, 2);
    const h = helpers(d.window, d.document);
    check('prematch: shows スタメン編成 status', h.text().includes('スタメン編成') && h.text().includes('自動選出'));
    h.click('メンバー編成'); await sleep(15);
    const lt = h.text();
    check('lineup: screen shows starters and bench', lt.includes('スタメン（背番号順）') && lt.includes('控えメンバー'));
    const st = h.state();
    /* 控えの最弱選手を控えの最強選手と入れ替えるのではなく、控え最強をスタメン最弱の枠へ */
    const stIds = new Set(st.players.map(p => p.id));
    /* 実効スタメンは state からは直接分からないので、画面の表から先頭行を選ぶ */
    const rows = d.document.querySelectorAll('tr.prow');
    check('lineup: 15 starter rows', rows.length === 15, 'rows=' + rows.length);
    /* 控えボタンのうち総合が最大のものを選ぶ */
    const inBtns = h.btnAll('IN ');
    check('lineup: bench IN buttons exist', inBtns.length >= 1, 'n=' + inBtns.length);
    let bestBtn = null, bestOv = -1, bestName = '';
    inBtns.forEach(b => {
      const mm = b.textContent.match(/総合\s*[SABCDEFG]?\s*(\d+)/); /* v0.15: 総合のランク併記（「総合 D 51」形式）に追随 */
      const nm = b.textContent.match(/IN \S+ (.+?)（/);
      if (mm && +mm[1] > bestOv) { bestOv = +mm[1]; bestBtn = b; bestName = nm ? nm[1] : ''; }
    });
    rows[0].click(); await sleep(10);
    bestBtn.click(); await sleep(10);
    const after = h.state();
    check('lineup: swap saved as custom lineup (15 ids)', Array.isArray(after.lineup) && after.lineup.length === 15);
    const inPlayer = after.players.find(p => p.name === bestName);
    check('lineup: chosen bench player is in the lineup', !!inPlayer && after.lineup.includes(inPlayer.id), bestName);
    /* 総合力 = 編成15人の総合平均（全員健康前提） */
    const exp = Math.round(after.lineup.map(id => overallOf(after.players.find(p => p.id === id))).reduce((a, b) => a + b, 0) / 15 * 10) / 10;
    h.click('試合前に戻る'); await sleep(10);
    check('lineup: team power on preMatch reflects the custom lineup', h.text().includes(String(exp)), 'expected ' + exp);
    check('prematch: status now shows カスタム編成', h.text().includes('カスタム編成'));
    d.window.close(); d0.window.close();
  }

  /* ---- 3. 編成: ケガ人は選べない ---- */
  {
    const st = JSON.parse(baseSave);
    const victim = st.players[st.players.length - 1];
    victim.injured = 2; victim.injSev = 'heavy'; victim.injPart = '右肩';
    const d0 = await makeDom(JSON.stringify(st), 41);
    const h0 = helpers(d0.window, d0.document);
    const dd = await gotoPreMatch(h0, d0, 2);
    const h = helpers(dd.window, dd.document);
    h.click('メンバー編成'); await sleep(15);
    const t = h.text();
    const hasInBtn = h.btnAll('IN ').some(b => b.textContent.includes(victim.name));
    check('lineup: injured bench player has no IN button', !hasInBtn);
    check('lineup: injured player shown with return info', t.includes(victim.name) && t.includes('復帰まであと2か月'));
    dd.window.close(); d0.window.close();
  }

  /* ---- 4. 交代: 場面で交代でき、残り場面の顔ぶれと確率が変わり、上限がある ---- */
  {
    const st = JSON.parse(baseSave);
    /* 強豪チームにして決勝（5停止点）まで進める体裁にする（確率はクランプされない程度に） */
    st.players.forEach(p => { Object.keys(p.stats).forEach(k => { p.stats[k] = 72; }); p.fatigue = 0; });
    const d0 = await makeDom(JSON.stringify(st), 97);
    const h0 = helpers(d0.window, d0.document);
    const dd = await gotoPreMatch(h0, d0, 8); /* 12月 = 予選決勝 */
    const h = helpers(dd.window, dd.document);
    h.click('キックオフ'); await sleep(10);
    /* 最初の停止点まで進める */
    let guard = 0, sceneSeen = false;
    while (guard++ < 60) {
      const t = h.text();
      if (t.includes('成功率の目安') && h.btnAll('OUT ').length) { sceneSeen = true; break; }
      if (h.btn('試合を進める')) { h.click('試合を進める'); await sleep(3); continue; }
      break;
    }
    check('subs: reached a stop point with sub panel', sceneSeen);
    check('subs: panel shows remaining count 5', h.text().includes('選手交代（残り5回）'));
    const cutinB = dd.document.querySelector('.cutin b');
    const keyName = cutinB ? cutinB.textContent.trim() : null;
    const firstPct = (h.text().match(/成功率の目安 (\d+)%/) || [])[1];
    /* キーマンを最弱の控えと交代させる */
    const outBtn = h.btnAll('OUT ').find(b => keyName && b.textContent.includes(keyName));
    check('subs: key player has an OUT button', !!outBtn, 'key=' + keyName);
    outBtn.click(); await sleep(8);
    const inBtns = h.btnAll('IN ');
    let weakBtn = null, weakOv = 1e9, weakName = '';
    inBtns.forEach(b => {
      const mm = b.textContent.match(/総合\s*[SABCDEFG]?\s*(\d+)/); /* v0.15: 総合のランク併記（「総合 D 51」形式）に追随 */
      const nm = b.textContent.match(/IN \S+ (.+?)（/);
      if (mm && +mm[1] < weakOv) { weakOv = +mm[1]; weakBtn = b; weakName = nm ? nm[1] : ''; }
    });
    weakBtn.click(); await sleep(8);
    const tAfter = h.text();
    check('subs: substitution logged', tAfter.includes('🔁 交代') && tAfter.includes(weakName), weakName);
    check('subs: remaining count now 4', tAfter.includes('選手交代（残り4回）'));
    const cutinB2 = dd.document.querySelector('.cutin b');
    const keyAfter = cutinB2 ? cutinB2.textContent.trim() : null;
    const pctAfter = (tAfter.match(/成功率の目安 (\d+)%/) || [])[1];
    check('subs: scene recalculated with new field (key or probability changed)',
      (keyName && keyAfter && keyAfter !== keyName) || (firstPct && pctAfter && pctAfter !== firstPct),
      'key ' + keyName + '->' + keyAfter + ' / pct ' + firstPct + '->' + pctAfter);
    /* 残り4回を使い切る（控えと往復させる） */
    for (let i = 0; i < 4; i++) {
      const ob = h.btnAll('OUT ')[0]; if (!ob) break;
      ob.click(); await sleep(5);
      const ib = h.btnAll('IN ')[0]; if (!ib) break;
      ib.click(); await sleep(5);
    }
    check('subs: limit reached shows 残り0回', h.text().includes('選手交代（残り0回）'));
    const ob2 = h.btnAll('OUT ')[0]; if (ob2) { ob2.click(); await sleep(5); }
    check('subs: no more subs allowed after limit', h.text().includes('交代回数を使い切った') || !h.btnAll('IN ').length);
    /* 試合を最後まで進める */
    guard = 0;
    let done = false;
    while (guard++ < 300) {
      const t = h.text();
      if (t.includes('NaN') || t.includes('undefined')) break;
      const opts = [...dd.document.querySelectorAll('.choices .btn.choice')];
      if (opts.length && t.includes('成功率の目安')) { opts[0].click(); await sleep(2); continue; }
      if (h.btn('試合を進める')) { h.click('試合を進める'); await sleep(2); continue; }
      if (h.btn('やった！次へ') || h.btn('次へ')) { done = true; break; }
      break;
    }
    check('subs: match completes after substitutions', done);
    dd.window.close(); d0.window.close();
  }

  /* ---- 5. 試合中の負傷と負傷交代 ----
   * v0.12 で実況バリエーション（commPick）の乱数消費が増えて乱数系列が v0.11 からずれたため、
   * 特定シードでの再現に依存せず、複数シードを試して発生を確認する形に変更した。
   * 負傷の発生率（playBlock ごとに 1.2%）と仕組み自体は無変更 */
  {
    const d = await makeDom(null, 50);
    const h = helpers(d.window, d.document);
    h.click('監督に就任する'); await sleep(15);
    if (h.btn('目標を決めて')) { h.click('目標を決めて'); await sleep(10); }
    let dd = null, hh = null, knockSeen = false, knockSeed = null;
    for (const seed of [39, 8, 21, 41, 27, 37, 46, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59]) {
      const cand = await gotoPreMatch(h, d, 2, seed); /* 6月 練習試合 */
      const ch = helpers(cand.window, cand.document);
      ch.click('キックオフ'); await sleep(10);
      let guard = 0, seen = false;
      while (guard++ < 200) {
        const t = ch.text();
        if (t.includes('🚑') && t.includes('負傷')) { seen = true; break; }
        const opts = [...cand.document.querySelectorAll('.choices .btn.choice')];
        if (opts.length && t.includes('成功率の目安')) { opts[0].click(); await sleep(2); continue; }
        if (ch.btn('試合を進める')) { ch.click('試合を進める'); await sleep(2); continue; }
        break;
      }
      if (seen) {
        /* 停止点（練習試合は 24分/56分）がまだ残る試合だけを採用する。終盤の負傷では「次の停止点」が存在しないため */
        const vsTxt = (cand.document.querySelector('.score .vs') || {}).textContent || '';
        const mins = parseInt(vsTxt, 10);
        if (!isNaN(mins) && mins <= 56) { dd = cand; hh = ch; knockSeen = true; knockSeed = seed; break; }
      }
      cand.window.close();
    }
    check('knock: in-match injury occurs (tuned seeds + fallback range)', knockSeen, 'seed=' + knockSeed);
    if (knockSeen) {
      /* 次の停止点まで進み、負傷交代が回数に数えないことを確認 */
      guard = 0;
      let atScene = false;
      while (guard++ < 200) {
        const t = hh.text();
        if (t.includes('成功率の目安') && hh.btnAll('OUT ').length) { atScene = true; break; }
        if (hh.btn('試合を進める')) { hh.click('試合を進める'); await sleep(2); continue; }
        break;
      }
      check('knock: reached next stop point', atScene);
      if (atScene) {
        check('knock: panel warns about the injured player', hh.text().includes('負傷中。この選手の交代は回数に数えられない'));
        const remBefore = (hh.text().match(/選手交代（残り(\d+)回/) || [])[1];
        const outBtn = hh.btnAll('OUT ').find(b => b.textContent.includes('🚑負傷'));
        check('knock: injured player marked in OUT list', !!outBtn);
        outBtn.click(); await sleep(6);
        const ib = hh.btnAll('IN ')[0]; ib.click(); await sleep(6);
        const t2 = hh.text();
        check('knock: free substitution logged', t2.includes('負傷交代のため回数に数えない'));
        const remAfter = (t2.match(/選手交代（残り(\d+)回/) || [])[1];
        check('knock: free sub does not consume the count', remBefore === remAfter, remBefore + '->' + remAfter);
      }
    }
    if (dd) dd.window.close(); d.window.close();
  }

  /* ---- 6. 調子: 表示と回復（ケアの日） ---- */
  {
    const st = JSON.parse(baseSave);
    st.players.forEach(p => { p.form = -2; });
    st.board = null; st.summary = null; st.recruit = null;
    const d = await makeDom(JSON.stringify(st), 61);
    const h = helpers(d.window, d.document);
    h.click('選手一覧'); await sleep(12);
    const t = h.text();
    /* v0.12: 調子は絵文字＋名前のチップではなく、固定サイズの顔アイコン（SVG・ラベルなし）で表示する仕様に変更 */
    check('form: face icon shown in squad list', !!d.document.querySelector('tr.prow .formface svg'));
    const row = d.document.querySelector('tr.prow'); row.click(); await sleep(12);
    check('form: detail shows 調子 face without label',
      h.text().includes('調子') && !!d.document.querySelector('.formface[data-form="-2"]') && !h.text().includes('絶不調'));
    d.window.close();

    const st2 = JSON.parse(baseSave);
    st2.players.forEach(p => { p.form = -2; });
    /* v0.19 追随: 「ケアのマスに止まる」旧方式の代わりに、週次方式の「休養・ケア」カードを選ぶ。
     * 解決処理（resolveCell('rec')）は同一で、調子が上向く選手がいることの検証は変えていない */
    st2.board = { weekly: true, week: 0, log: [], dlg: null, picks: [] };
    st2.monthIdx = 0;
    st2.summary = null; st2.recruit = null;
    const d2 = await makeDom(JSON.stringify(st2), 67);
    const h2 = helpers(d2.window, d2.document);
    const pc = [...d2.document.querySelectorAll('.wcard')].find(c => c.textContent.includes('休養・ケア'));
    pc.click(); await sleep(10);
    const after = h2.state();
    check('form: care day lifts some players form', after.players.some(p => p.form > -2),
      'lifted=' + after.players.filter(p => p.form > -2).length);
    d2.window.close();
  }

  /* ---- 7. ソーク: 2シーズン（編成画面訪問と交代を混ぜる） ---- */
  {
    const { window, document } = await makeDom(null, 202608);
    const { text, btn, state, click } = helpers(window, document);
    click('監督に就任する'); await sleep(15);
    let guard = 0, seasons = 0, badText = '', subsDone = 0, lineupVisited = false;
    while (guard++ < 40000 && seasons < 2) {
      const t = text();
      if (t.includes('NaN') || t.includes('undefined')) { badText = t.slice(0, 160); break; }
      if (btn('新年度へ')) { click('新年度へ'); await sleep(8); continue; }
      if (btn('新年度を始める')) {
        const tog = btn('獲得リストに入れる'); if (tog) { tog.click(); await sleep(4); }
        click('新年度を始める'); seasons++; await sleep(8); continue;
      }
      if (btn('目標を決めて')) { click('目標を決めて'); await sleep(6); continue; }
      if (btn('目標を決めて')) { click('目標を決めて'); await sleep(120); continue; }
      if (btn('確認した')) { click('確認した'); await sleep(5); continue; } /* v0.22 追随: 成長レポートが専用レイアウト表示になり、確認後に指示フォームが出るため、駆動に確認ステップを追加（検証内容は不変） */
      if (btn('指示を確定')) { click('指示を確定'); await sleep(4); continue; }
      const pc = document.querySelector('.pcard');
      if (pc) { pc.click(); await sleep(2); continue; }
      if (btn('メンバー編成') && !lineupVisited) { click('メンバー編成'); lineupVisited = true; await sleep(6); continue; }
      if (btn('試合前に戻る')) { click('試合前に戻る'); await sleep(4); continue; }
      if (btn('結果のみ表示（スキップ）')) { click('結果のみ表示（スキップ）'); await sleep(4); continue; }
      if (btn('キックオフ')) { click('キックオフ'); await sleep(4); continue; }
      const opts = [...document.querySelectorAll('.choices .btn.choice')];
      if (opts.length && t.includes('成功率の目安')) {
        /* たまに交代を試す */
        const outs = [...document.querySelectorAll('button')].filter(b => b.textContent.includes('OUT '));
        if (subsDone < 3 && outs.length) {
          outs[0].click(); await sleep(2);
          const ins = [...document.querySelectorAll('button')].filter(b => b.textContent.includes('IN '));
          if (ins.length) { ins[0].click(); subsDone++; await sleep(2); }
        }
        const opts2 = [...document.querySelectorAll('.choices .btn.choice')];
        let best = opts2[0], bp = -1;
        opts2.forEach(o => { const m = o.textContent.match(/(\d+)%/); const p = m ? +m[1] : 0; if (p > bp) { bp = p; best = o; } });
        if (best) { best.click(); await sleep(2); }
        continue;
      }
      if (btn('試合を進める')) { click('試合を進める'); await sleep(2); continue; }
      if (btn('やった！次へ')) { click('やった！次へ'); await sleep(4); continue; }
      if (btn('次へ')) { click('次へ'); await sleep(4); continue; }
      throw new Error('stuck: ' + t.slice(0, 200));
    }
    check('soak: no NaN/undefined over 2 seasons', badText === '', badText);
    check('soak: 2 seasons completed', seasons >= 2, 'seasons=' + seasons);
    check('soak: lineup screen visited', lineupVisited);
    check('soak: substitutions performed', subsDone > 0, 'subs=' + subsDone);
    const fin = state();
    check('soak: forms stay in range and lineup is valid or null',
      fin.players.every(p => p.form >= -2 && p.form <= 2) &&
      (fin.lineup === null || (Array.isArray(fin.lineup) && fin.lineup.length === 15)));
    check('soak: lineup resets to null in a new season', fin.lineup === null);
    window.close();
  }

  console.log(failures ? '\n*** ' + failures + ' FAILURES ***' : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
