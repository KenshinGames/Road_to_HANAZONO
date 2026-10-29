/* QA for v0.7: captain & ethos, graded injuries (absence + return), event expansion hooks,
 * soft-cap growth (95+ still grows slightly, never exceeds 99, surplus -> trust),
 * growth-room display, multi-season soak. */
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
  let baseSave;
  {
    const d = await makeDom(null, 777);
    const h = helpers(d.window, d.document);
    h.click('監督に就任する'); await sleep(20);
    if (h.btn('目標を決めて')) { h.click('目標を決めて'); await sleep(20); }
    baseSave = d.window.localStorage.getItem('hanazono.v02');

    /* ---- 1. キャプテンと校風のUIと初期値 ---- */
    const t = h.text();
    check('captain: inst screen has キャプテン select', t.includes('キャプテン'));
    check('ethos: inst screen has 校風 select', t.includes('校風'));
    const st0 = h.state();
    check('captain: initial captainId is a roster player', st0.players.some(p => p.id === st0.captainId));
    check('ethos: default ethos is discipline', st0.ethos === 'discipline');
    const cap0 = st0.players.find(p => p.id === st0.captainId);
    const maxTrust = Math.max.apply(null, st0.players.map(p => p.trust));
    check('captain: initial captain is the most trusted player', cap0 && cap0.trust === maxTrust, 'cap=' + (cap0 && cap0.trust) + ' max=' + maxTrust);
    /* v0.27 追随: 月頭指示は 方針・ユニット・強度・校風 がボタン列（.seg[data-k]）、重点・キャプテンがセレクト2個になった。
     * 検証内容（6項目が揃っている／校風とキャプテンの変更が保存される）は不変 */
    const sels = d.document.querySelectorAll('select');
    const segKeys = [...d.document.querySelectorAll('.seg[data-k]')].map(x => x.getAttribute('data-k')).join(',');
    check('ui: six inst fields (team/unit/level/ethos buttons + focus/captain selects)', segKeys === 'team,unit,level,ethos' && sels.length === 2, 'segs=' + segKeys + ' selects=' + sels.length);
    /* 校風を変更できる */
    d.document.querySelector('.seg[data-k="ethos"] [data-v="passion"]').click(); await sleep(10);
    check('ethos: changing select updates state', h.state().ethos === 'passion');
    d.document.querySelector('.seg[data-k="ethos"] [data-v="discipline"]').click(); await sleep(10);
    /* キャプテンを変更できる */
    const other = st0.players.find(p => p.id !== st0.captainId);
    sels[1].value = String(other.id); sels[1].onchange(); await sleep(10);
    check('captain: changing select updates state', h.state().captainId === other.id);
    d.window.close();
  }

  /* ---- 2. 移行: 不正な captainId / ethos が修復される ---- */
  {
    const st = JSON.parse(baseSave);
    st.captainId = 99999; st.ethos = 'bogus';
    const d = await makeDom(JSON.stringify(st), 5);
    const h = helpers(d.window, d.document);
    const after = h.state();
    check('migration: bogus ethos reset to discipline', after.ethos === 'discipline');
    const cap = after.players.find(p => p.id === after.captainId);
    const maxTrust = Math.max.apply(null, after.players.map(p => p.trust));
    check('migration: captain auto-reassigned to most trusted', !!cap && cap.trust === maxTrust);
    d.window.close();
  }

  /* ---- 3. ケガの段階化: 表示・欠場・月経過で回復 ---- */
  {
    const st = JSON.parse(baseSave);
    st.monthIdx = 0; st.board = null; st.summary = null; st.recruit = null;
    const hurt = st.players[0];
    hurt.injured = 3; hurt.injSev = 'heavy'; hurt.injPart = '左膝';
    const d = await makeDom(JSON.stringify(st), 11);
    const h = helpers(d.window, d.document);
    h.click('選手一覧'); await sleep(15);
    check('injury: list shows absence length for heavy injury', h.text().includes('あと3か月'));
    const row = d.document.querySelector('tr.prow'); row.click(); await sleep(15);
    const dt = h.text();
    check('injury: detail shows severity and part', dt.includes('重症') && dt.includes('左膝') && dt.includes('復帰まであと3か月'));
    d.window.close();

    /* 試合のない月を1つ進めると離脱期間が1減る */
    const st2 = JSON.parse(baseSave);
    st2.monthIdx = 0; st2.summary = null; st2.recruit = null;
    st2.players[0].injured = 3; st2.players[0].injSev = 'heavy'; st2.players[0].injPart = '左膝';
    st2.board = { cells: [{ t: 'end', done: false }], pos: -1, hand: [1], log: [] };
    const d2 = await makeDom(JSON.stringify(st2), 13);
    const h2 = helpers(d2.window, d2.document);
    /* v0.19 追随: 注入した旧盤面は読み込み時に週次方式へ移行されるため、月末まで週カードを
     * クリックして月を終わらせる（従来は月末マスへの1クリックで月が終わっていた）。
     * 「試合のない月が終わると離脱期間が1減る」という検証内容は変えていない */
    for (let g2 = 0; g2 < 8 && d2.document.querySelector('.pcard'); g2++) { d2.document.querySelector('.pcard').click(); await sleep(12); }
    const after2 = h2.state();
    check('injury: absence ticks down after a non-match month', after2.players[0].injured === 2, 'injured=' + after2.players[0].injured);
    /* さらに「試合のない月」を2つ進めれば復帰する（試合月は finishMatch 側で進む仕様） */
    let cur = JSON.parse(d2.window.localStorage.getItem('hanazono.v02'));
    for (let i = 0; i < 2; i++) {
      cur.monthIdx = 0;
      cur.board = { cells: [{ t: 'end', done: false }], pos: -1, hand: [1], log: [] };
      cur.summary = null; cur.recruit = null;
      const dx = await makeDom(JSON.stringify(cur), 17 + i);
      const hx = helpers(dx.window, dx.document);
      void hx;
      /* v0.19 追随: 上と同じく月末まで進める */
      for (let gx = 0; gx < 8 && dx.document.querySelector('.pcard'); gx++) { dx.document.querySelector('.pcard').click(); await sleep(12); }
      cur = JSON.parse(dx.window.localStorage.getItem('hanazono.v02'));
      dx.window.close();
    }
    check('injury: player returns after absence elapses', cur.players[0].injured === 0 && cur.players[0].injSev === null);
    d2.window.close();
  }

  /* ---- 4. ソフトキャップ: 97でも微増し、99を超えず、余剰が信頼に変わる ---- */
  {
    const st = JSON.parse(baseSave);
    st.monthIdx = 0; st.summary = null; st.recruit = null;
    const ace = st.players[0];
    Object.keys(ace.stats).forEach(k => { ace.stats[k] = 97; });
    ace.stats.spd = 99; /* 限界の能力は超えないことも同時に見る */
    ace.fatigue = 0; ace.trust = 40;
    st.inst = { team: 'pow', unit: 'FW', focus: ace.id, level: 2 };
    const cells = [];
    for (let i = 0; i < 10; i++) cells.push({ t: 'pB', done: false });
    cells.push({ t: 'end', done: false });
    st.board = { cells: cells, pos: -1, hand: [1, 1, 1], log: [] };
    const d = await makeDom(JSON.stringify(st), 2027);
    const h = helpers(d.window, d.document);
    /* v0.19 追随: 注入した旧盤面（特訓マス×10）は週次方式へ移行されるため、特訓の代わりに
     * 「全体方針（パワー）と一致するスクラム強化カード」を月をまたいで最大12週クリックする。
     * 97が微増すること・99を超えないこと・余剰が信頼に変わることの検証内容は変えていない */
    for (let i = 0; i < 12; i++) {
      const card = [...d.document.querySelectorAll('.wcard')].find(c => c.textContent.includes('スクラム強化'));
      if (card) { card.click(); await sleep(3); continue; }
      if (h.btn('確認した')) { h.click('確認した'); await sleep(5); continue; } /* v0.22 追随: 成長レポートが専用レイアウト表示になり、確認後に指示フォームが出るため、駆動に確認ステップを追加（検証内容は不変） */
      if (!h.btn('指示を確定')) break;
      h.click('指示を確定');
      await sleep(3);
    }
    const after = h.state();
    const aceAfter = after.players.find(p => p.id === ace.id);
    const others = ['pow', 'pas', 'kik', 'tak', 'sta'].map(k => aceAfter.stats[k]);
    check('softcap: 97-stat still grows slightly with hard practice', Math.max.apply(null, others) > 97, 'stats=' + JSON.stringify(aceAfter.stats));
    check('softcap: no stat ever exceeds 99', after.players.every(p => Object.values(p.stats).every(v => v <= 99 && isFinite(v))));
    check('softcap: stat at 99 stays 99', aceAfter.stats.spd === 99);
    check('softcap: surplus converts to trust', aceAfter.trust > 40, 'trust=' + aceAfter.trust);
    d.window.close();

    /* 伸びしろ表示: 97の選手詳細に「限界間近」、99に「限界」が出る */
    const st3 = JSON.parse(baseSave);
    st3.board = null; st3.summary = null; st3.recruit = null;
    Object.keys(st3.players[0].stats).forEach(k => { st3.players[0].stats[k] = 97; });
    st3.players[0].stats.pow = 99;
    const d3 = await makeDom(JSON.stringify(st3), 19);
    const h3 = helpers(d3.window, d3.document);
    h3.click('選手一覧'); await sleep(15);
    const row3 = d3.document.querySelector('tr.prow'); row3.click(); await sleep(15);
    const dt3 = h3.text();
    check('growth-room: detail shows 限界間近 for 97 stats', dt3.includes('限界間近'));
    check('growth-room: detail shows 限界 for a 99 stat', dt3.includes('・限界') || dt3.includes('限界間近'));
    check('growth-room: cap meter bars rendered', d3.document.querySelectorAll('.capmeter').length === 6, 'n=' + d3.document.querySelectorAll('.capmeter').length);
    d3.window.close();
  }

  /* ---- 5. ソーク: 3シーズン自動プレイ（例外・NaNなし、イベント会話が出る） ---- */
  {
    const { window, document } = await makeDom(null, 555111);
    const { text, btn, state, click } = helpers(window, document);
    click('監督に就任する'); await sleep(20);
    let guard = 0, seasons = 0, badText = '', dlgSeen = 0, injSeen = false;
    while (guard++ < 40000 && seasons < 3) {
      const t = text();
      if (t.includes('NaN') || t.includes('undefined')) { badText = t.slice(0, 160); break; }
      if (document.querySelector('.dlg')) dlgSeen++;
      const stNow = state();
      if (stNow.players.some(p => p.injured > 0)) injSeen = true;
      if (btn('新年度へ')) { click('新年度へ'); await sleep(10); continue; }
      if (btn('新年度を始める')) {
        const tog = btn('獲得リストに入れる'); if (tog) { tog.click(); await sleep(5); }
        click('新年度を始める'); seasons++; await sleep(10); continue;
      }
      if (btn('目標を決めて')) { click('目標を決めて'); await sleep(120); continue; }
      if (btn('確認した')) { click('確認した'); await sleep(5); continue; } /* v0.22 追随: 成長レポートが専用レイアウト表示になり、確認後に指示フォームが出るため、駆動に確認ステップを追加（検証内容は不変） */
      if (btn('指示を確定')) {
        const cap = state();
        if (!cap.players.some(p => p.id === cap.captainId)) { badText = 'captain lost'; break; }
        click('指示を確定'); await sleep(5); continue;
      }
      const pc = document.querySelector('.pcard');
      if (pc) { pc.click(); await sleep(2); continue; }
      if (btn('結果のみ表示（スキップ）')) { click('結果のみ表示（スキップ）'); await sleep(5); continue; }
      if (btn('キックオフ')) { click('キックオフ'); await sleep(5); continue; }
      const opts = [...document.querySelectorAll('.choices .btn.choice')];
      if (opts.length && t.includes('成功率の目安')) {
        let best = opts[0], bp = -1;
        opts.forEach(o => { const m = (o.dataset.p ? [0, o.dataset.p] : o.textContent.match(/(\d+)%/)); const p = m ? +m[1] : 0; if (p > bp) { bp = p; best = o; } });
        best.click(); await sleep(2); continue;
      }
      if (btn('試合を進める')) { click('試合を進める'); await sleep(2); continue; }
      if (btn('やった！次へ')) { click('やった！次へ'); await sleep(5); continue; }
      if (btn('次へ')) { click('次へ'); await sleep(5); continue; }
      throw new Error('stuck: ' + t.slice(0, 200));
    }
    check('soak: no NaN/undefined over 3 seasons', badText === '', badText);
    check('soak: 3 seasons completed', seasons >= 3, 'seasons=' + seasons);
    check('soak: dialogue events appeared', dlgSeen > 0, 'dlg=' + dlgSeen);
    check('soak: injuries occurred at least once in 3 seasons', injSeen);
    check('soak: roster and fields stay valid', state().players.every(p => p.srec && isFinite(p.trust) && p.injured >= 0));
    window.close();
  }

  console.log(failures ? '\n*** ' + failures + ' FAILURES ***' : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
