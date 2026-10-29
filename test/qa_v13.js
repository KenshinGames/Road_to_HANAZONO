/* QA for v0.13: 育成の手触り（月次成長レポート＝練習で実際に伸びた分の内訳を次の月頭指示画面に表示／
 * 選手詳細に調子の推移＝formHist を顔アイコンの列で表示／信頼度イベント追加4種＝復帰・キャプテン・
 * 上級生指導・進路の続き）。対象は play.html（jsdom）。盤面はセーブに直接注入して決定的に進める（qa_v07 の手法）。 */
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

/* 注入した盤面を最後まで進める（進行カードを押し続ける）
 * v0.19 追随: 週次方式では活動カードを押し続けて月を進める。cardText を渡すとその活動カードを
 * 選び続ける（成長レポートの検証では、全体方針と一致する活動で統一する必要があるため） */
async function driveBoard(H, maxClicks, cardText) {
  let n = 0;
  while (n++ < (maxClicks || 40)) {
    let pc = null;
    if (cardText) pc = [...H.document.querySelectorAll('.wcard')].find(c => c.textContent.includes(cardText));
    if (!pc) pc = H.document.querySelector('.pcard');
    if (!pc) break;
    pc.click(); await sleep(3);
  }
  return n;
}

const FORM_COLORS = { '-2': '#9d5bd6', '-1': '#56b4e7', '0': '#f2c531', '1': '#ef4b3f', '2': '#e843c8' };
const STAT_KEYS = ['spd', 'pow', 'pas', 'kik', 'tak', 'sta'];

(async () => {
  /* ---- 0. 静的チェック ---- */
  ['成長レポート', '調子の推移', 'growreport', 'formhist', 'formHist', 'backMark', 'futureSeen',
   'syncFormHist', 'snapshotGrowth', '全体練習に合流', '全員を集めて声をかけた', '基礎を指導', '進路のその後',
   'comeback', 'captain', 'senior', 'future2'].forEach(s => {
    check('static: play.html contains ' + s, html.includes(s));
  });
  {
    const H = await makeDom(null, 111);
    check('title: shows v1.0 (v0.25 でバージョン表記を追随)', H.text().includes('v1.0'));
    H.window.close();
  }

  const base = await freshSave(777);

  /* ---- 1. 成長レポート：実際の月次成長（練習マスの伸び）と一致する ---- */
  {
    const st = JSON.parse(base);
    st.monthIdx = 0; st.goalSet = true; st.summary = null; st.recruit = null;
    const before = {};
    st.players.forEach(p => { before[p.id] = Object.assign({}, p.stats); });
    const focusName = st.players.find(p => p.id === st.inst.focus).name;
    /* v0.19 追随: 練習マスの盤面の代わりに週次方式で1か月を進める。全体方針（sta）と一致する
     * 「フィットネス」の週を4回選ぶ。成長の記録（accGrow）経由の一致という検証内容は変えていない */
    st.board = { weekly: true, week: 0, log: [], dlg: null, picks: [] };
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 4242);
    await driveBoard(H, 40, 'フィットネス');
    const after = H.state();
    check('growth: reached next month instruction screen', after.monthIdx === 1 && !after.board, 'monthIdx=' + after.monthIdx);
    const rep = after.growReport;
    check('growth: report exists after a practice month', !!rep);
    if (rep) {
      check('growth: report label is the finished month', rep.label === '4月', 'label=' + rep.label);
      let allMatch = true, maxNet = 0, maxName = '';
      after.players.forEach(p => {
        let netTot = 0;
        const row = rep.rows.find(r => r.name === p.name);
        STAT_KEYS.forEach(k => {
          const net = p.stats[k] - before[p.id][k];
          netTot += net;
          const rec = row ? (row.stats[k] || 0) : 0;
          if (rec !== net) allMatch = false;
        });
        if (row && row.total !== netTot) allMatch = false;
        if (!row && netTot !== 0) allMatch = false;
        if (netTot > maxNet) { maxNet = netTot; maxName = p.name; }
      });
      check('growth: every row matches the actual stat growth of the month', allMatch);
      const sorted = rep.rows.every((r, i) => i === 0 || rep.rows[i - 1].total >= r.total);
      check('growth: rows sorted by total growth desc', sorted);
      check('growth: rows only include players who grew (or gained trust)', rep.rows.every(r => r.total > 0 || r.trust > 0));
      check('growth: trust column is non-negative integers', rep.rows.every(r => Number.isInteger(r.trust) && r.trust >= 0));
      const fRow = rep.rows.find(r => r.name === focusName);
      check('growth: focus flag only on the focus player', rep.rows.every(r => r.focus === (r.name === focusName)), fRow ? 'focus row present' : 'focus player did not grow');
      check('growth: report card shown on the instruction screen', H.text().includes('4月の成長レポート'));
      check('growth: top grower named on the card', maxNet === 0 || H.text().includes(maxName), 'top=' + maxName + ' +' + maxNet);
      H.click('確認した'); await sleep(10);
      check('growth: dismiss button clears the report', H.state().growReport === null && !H.text().includes('成長レポート'));
    }
    H.window.close();
  }

  /* ---- 2. 成長ゼロ月：レポートは出ない ---- */
  {
    const st = JSON.parse(base);
    st.monthIdx = 0; st.goalSet = true; st.summary = null; st.recruit = null;
    st.players.forEach(p => { STAT_KEYS.forEach(k => { p.stats[k] = 99; }); p.trust = 99; p.fatigue = 0; p.injured = 0; });
    /* v0.19 追随: 週次方式で1か月を進める（全能力99のため、どの活動でも成長は記録されない） */
    st.board = { weekly: true, week: 0, log: [], dlg: null, picks: [] };
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 5151);
    await driveBoard(H);
    const after = H.state();
    check('growth-zero: month advanced', after.monthIdx === 1, 'monthIdx=' + after.monthIdx);
    check('growth-zero: no report when nobody grew', after.growReport === null);
    check('growth-zero: accumulator cleared after month end', after.growAcc === null);
    check('growth-zero: no report card on screen', !H.text().includes('成長レポート'));
    H.window.close();
  }

  /* ---- 3. 調子履歴：記録と詳細表示（顔アイコンの列） ---- */
  {
    const st = JSON.parse(base);
    st.monthIdx = 0; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
    const vs = [-2, -1, 0, 1, 2];
    st.players.forEach((p, i) => { p.form = vs[i % 5]; p.formHist = [vs[i % 5], vs[(i + 2) % 5]]; });
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 6161);
    H.click('指示を確定'); await sleep(15); /* startMonth: driftForm → syncFormHist */
    let cur = H.state();
    check('formhist: recorded at month start; last entry equals current form',
      cur.players.every(p => Array.isArray(p.formHist) && p.formHist.length >= 1 && p.formHist.length <= 6 && p.formHist[p.formHist.length - 1] === p.form),
      'sample=' + JSON.stringify(cur.players[0].formHist) + ' form=' + cur.players[0].form);
    /* 盤面を1か月進めても不変条件が保たれる（v0.19 追随: 週次方式で1か月進める） */
    cur.monthIdx = 0; cur.summary = null; cur.recruit = null;
    cur.board = { weekly: true, week: 0, log: [], dlg: null, picks: [] };
    const H2 = await makeDom({ 'hanazono.v02': JSON.stringify(cur) }, 6262);
    await driveBoard(H2);
    const after2 = H2.state();
    check('formhist: invariant holds after a board month (array, <=6, last === form)',
      after2.players.every(p => Array.isArray(p.formHist) && p.formHist.length <= 6 && p.formHist[p.formHist.length - 1] === p.form));
    H2.window.close();
    /* 詳細表示：履歴が顔アイコンの列（色・data-form が履歴と一致、ラベルなし） */
    const H3 = await makeDom({ 'hanazono.v02': JSON.stringify(after2) }, 6363);
    H3.click('選手一覧'); await sleep(15);
    const row = H3.document.querySelector('tr.prow'); row.click(); await sleep(15);
    const sel = after2.players[0];
    const histEl = H3.document.querySelector('.formhist');
    check('formhist: detail shows the history row', !!histEl && H3.text().includes('調子の推移'));
    if (histEl) {
      const faces = [...histEl.querySelectorAll('.formface')];
      check('formhist: one fixed-size face per history entry', faces.length === sel.formHist.length, 'faces=' + faces.length + ' hist=' + sel.formHist.length);
      check('formhist: faces match history values and colors, no label text',
        faces.every((f, i) => f.getAttribute('data-form') === String(sel.formHist[i]) &&
          f.querySelector('circle').getAttribute('fill') === FORM_COLORS[String(sel.formHist[i])] &&
          f.textContent === '' && f.querySelector('svg').getAttribute('width') === '20'));
    }
    H3.window.close();
    H.window.close();
  }

  /* ---- 4. マイグレーション：新フィールドが補完され、壊れた記録は捨てられる ---- */
  {
    const st = JSON.parse(base);
    st.players.forEach(p => { delete p.formHist; delete p.backMark; delete p.futureSeen; });
    st.growAcc = { bogus: 1 };
    st.growReport = { label: 5, rows: 'x' };
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 7171);
    const after = H.state();
    check('migration: formHist initialized for all players (seeded with current form)',
      after.players.every(p => Array.isArray(p.formHist) && p.formHist.length >= 1 && p.formHist[p.formHist.length - 1] === p.form));
    check('migration: event flags default to false', after.players.every(p => p.backMark === false && p.futureSeen === false));
    check('migration: malformed growAcc/growReport discarded', after.growAcc === null && after.growReport === null);
    H.window.close();
  }

  /* ---- 5. 復帰イベント：ケガから復帰 → backMark → 次のイベントで最優先に消費される ---- */
  {
    const st = JSON.parse(base);
    st.monthIdx = 0; st.goalSet = true; st.summary = null; st.recruit = null;
    const hero = st.players[0];
    hero.injured = 1; hero.injSev = 'light'; hero.injPart = '右肩'; hero.trust = 40; hero.backMark = false;
    /* v0.19 追随: 月末マスの代わりに週次方式で1か月（4週）を進めて月末を迎える */
    st.board = { weekly: true, week: 0, log: [], dlg: null, picks: [] };
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 8181);
    await driveBoard(H);
    const mid = H.state();
    const heroMid = mid.players.find(p => p.id === hero.id);
    check('comeback: player recovered at month end', heroMid.injured === 0);
    check('comeback: recovery sets backMark', heroMid.backMark === true);
    H.window.close();

    /* v0.19 追随: イベントマスだけの盤面は作れないため、週次方式の月（イベント抽選は週あたり24%、
     * 月の期待回数は従来と等しい）を繰り返し進めて出現を探す汎用ドライバに置き換える。
     * 「backMark が立っている間、復帰イベントが rollEvent で最優先に消費され、信頼が既存の
     * 範囲（+8〜15）で上がる」という検証内容は変えていない。各試行の開始時に hero の信頼を
     * 40 に戻し、他のイベントの蓄積が測定に混ざらないようにする（従来も単月内の探索だった） */
    mid.summary = null; mid.recruit = null;
    let found = false, dlgAtEvent = false, trustAfter = null;
    for (let attempt = 0; attempt < 60 && !(found && dlgAtEvent); attempt++) {
      /* 従来のシード探索と同じく、各試行は復帰直後の同一セーブ（backMark あり）から始める */
      const curSave = JSON.parse(JSON.stringify(mid));
      curSave.monthIdx = 1; curSave.summary = null; curSave.recruit = null;
      curSave.board = { weekly: true, week: 0, log: [], dlg: null, picks: [] };
      const heroNow = curSave.players.find(p => p.id === hero.id);
      heroNow.trust = 40; heroNow.injured = 0;
      const Hx = await makeDom({ 'hanazono.v02': JSON.stringify(curSave) }, 1000 + attempt * 137);
      let guard = 0;
      while (guard++ < 6) {
        const hit = Hx.logLines().some(l => l.includes('ケガから復帰した') && l.includes(hero.name));
        if (hit) {
          if (!found) { found = true; trustAfter = Hx.state().players.find(p => p.id === hero.id).trust; }
          if (Hx.document.querySelector('.dlg')) dlgAtEvent = true;
          break;
        }
        const c = Hx.document.querySelector('.pcard');
        if (!c) break;
        c.click(); await sleep(2);
      }
      if (!found) {
        /* 第4週のイベントは月末処理で monthLog へ移るため、そちらも出現として数える。
         * 会話カードの表示確認は週内に出た試行で別途行う（dlgAtEvent が立つまで探索を続ける） */
        const ml = Hx.state().monthLog || [];
        if (ml.some(l => l.includes('ケガから復帰した') && l.includes(hero.name))) {
          found = true;
          trustAfter = Hx.state().players.find(p => p.id === hero.id).trust;
        }
      }
      Hx.window.close();
    }
    check('comeback: event fired in the following month (priority over other dramas)', found);
    check('comeback: shown as a dialogue card', dlgAtEvent);
    check('comeback: backMark consumed and trust rose within the existing range', found && trustAfter > 40 && trustAfter <= 40 + 15, 'trust=' + trustAfter);
  }

  /* ---- 6. 追加イベント3種：キャプテンの声かけ／上級生の指導／進路のその後 ---- */
  {
    const st = JSON.parse(base);
    st.monthIdx = 1; st.goalSet = true; st.summary = null; st.recruit = null;
    st.players.forEach(p => { p.trust = 75; p.fatigue = 0; p.injured = 0; if (p.year === 3) p.futureSeen = true; });
    const capP = st.players.find(p => p.year === 3) || st.players[0];
    capP.trust = 85; st.captainId = capP.id;
    /* v0.19 追随: イベントマスだけの盤面の代わりに、週次方式の月を繰り返し進めて出現を探す。
     * 各試行は従来どおり同一の初期セーブから始め、週のログと月末の monthLog の両方を見る。
     * 3種の出現条件（学年・信頼・futureSeen 等の前提）は従来のまま変えていない */
    st.board = { weekly: true, week: 0, log: [], dlg: null, picks: [] };
    const seen = { future2: false, captain: false, senior: false };
    let dlgSeen = 0;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (seen.future2 && seen.captain && seen.senior) break;
      const Hx = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 2000 + attempt * 149);
      let guard = 0;
      while (guard++ < 6) {
        if (Hx.document.querySelector('.dlg')) dlgSeen++;
        const lines = Hx.logLines().concat(Hx.state().monthLog || []);
        if (lines.some(l => l.includes('進路のその後'))) seen.future2 = true;
        if (lines.some(l => l.includes('全員を集めて声をかけた'))) seen.captain = true;
        if (lines.some(l => l.includes('基礎を指導'))) seen.senior = true;
        const c = Hx.document.querySelector('.pcard');
        if (!c) break;
        c.click(); await sleep(2);
      }
      Hx.window.close();
    }
    check('drama2: 進路のその後 (sequel for seniors who saw the future event)', seen.future2);
    check('drama2: キャプテンの声かけ fired', seen.captain);
    check('drama2: 上級生が下級生を指導 fired', seen.senior);
    check('drama2: events rendered as dialogue cards during the search', dlgSeen > 0, 'dlg=' + dlgSeen);
  }

  /* ---- 7. ソーク：2シーズン自動プレイ（例外・NaNなし／セーブの不変条件） ---- */
  {
    const H = await makeDom(null, 987654);
    H.click('監督に就任する（ふつう）'); await sleep(20);
    let guard = 0, seasons = 0, badText = '';
    while (guard++ < 40000 && seasons < 2) {
      const t = H.text();
      if (t.includes('NaN') || t.includes('undefined')) { badText = t.slice(0, 160); break; }
      if (H.btn('新年度へ')) { H.click('新年度へ'); await sleep(10); continue; }
      if (H.btn('新年度を始める')) {
        const tog = H.btn('獲得リストに入れる'); if (tog) { tog.click(); await sleep(5); }
        H.click('新年度を始める'); seasons++; await sleep(10); continue;
      }
      if (H.btn('目標を決めて')) { H.click('目標を決めて'); await sleep(60); continue; }
      if (H.btn('確認した')) { H.click('確認した'); await sleep(5); continue; } /* v0.22 追随: 成長レポートが専用レイアウト表示になり、確認後に指示フォームが出るため、駆動に確認ステップを追加（検証内容は不変） */
      if (H.btn('指示を確定')) { H.click('指示を確定'); await sleep(5); continue; }
      const pc = H.document.querySelector('.pcard');
      if (pc) { pc.click(); await sleep(2); continue; }
      if (H.btn('結果のみ表示（スキップ）')) { H.click('結果のみ表示（スキップ）'); await sleep(5); continue; }
      if (H.btn('キックオフ')) { H.click('キックオフ'); await sleep(5); continue; }
      const opts = [...H.document.querySelectorAll('.choices .btn.choice')];
      if (opts.length && t.includes('成功率の目安')) {
        let best = opts[0], bp = -1;
        opts.forEach(o => { const m = o.textContent.match(/(\d+)%/); const p = m ? +m[1] : 0; if (p > bp) { bp = p; best = o; } });
        best.click(); await sleep(2); continue;
      }
      if (H.btn('試合を進める')) { H.click('試合を進める'); await sleep(2); continue; }
      if (H.btn('やった！次へ')) { H.click('やった！次へ'); await sleep(5); continue; }
      if (H.btn('次へ')) { H.click('次へ'); await sleep(5); continue; }
      throw new Error('stuck: ' + t.slice(0, 200));
    }
    check('soak: no NaN/undefined over 2 seasons', badText === '', badText);
    check('soak: 2 seasons completed', seasons >= 2, 'seasons=' + seasons);
    const fin = H.state();
    check('soak: formHist invariant for every player', fin.players.every(p =>
      Array.isArray(p.formHist) && p.formHist.length <= 6 && (p.formHist.length === 0 || p.formHist[p.formHist.length - 1] === p.form)));
    check('soak: stats and trust stay in range', fin.players.every(p =>
      STAT_KEYS.every(k => p.stats[k] >= 20 && p.stats[k] <= 99 && isFinite(p.stats[k])) && isFinite(p.trust)));
    check('soak: growReport is null or well-formed', fin.growReport === null ||
      (typeof fin.growReport.label === 'string' && fin.growReport.rows.every(r =>
        r.total === STAT_KEYS.reduce((a, k) => a + (r.stats[k] || 0), 0) && (r.total > 0 || r.trust > 0))));
    H.window.close();
  }

  console.log(failures ? '\n*** ' + failures + ' FAILURES ***' : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
