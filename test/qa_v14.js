/* QA for v0.14: 記録の深化（シーズン別成績 career.seasonHist／対戦校別成績 career.oppRec／
 * 歴代キャプテン career.captains／OB名鑑に最終能力6種と進路を保存・表示）。
 * 対象は play.html（jsdom）。シーズン駆動は qa_v09 の実績あるループと monthEnd 注入（qa_v09 §4）を流用。 */
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
    state: () => JSON.parse(window.localStorage.getItem('hanazono.v02'))
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

/* qa_v09 §3 と同じ実績あるシーズン駆動ループ（強いチーム前提） */
async function driveSeason(H, d) {
  let guard = 0, summarySeen = false;
  while (guard++ < 6000) {
    const t = H.text();
    if (t.includes('シーズン終了')) { summarySeen = true; break; }
    if (H.btn('目標を決めて')) { H.click('目標を決めて'); await sleep(3); continue; }
    if (H.btn('確認した')) { H.click('確認した'); await sleep(5); continue; } /* v0.22 追随: 成長レポートが専用レイアウト表示になり、確認後に指示フォームが出るため、駆動に確認ステップを追加（検証内容は不変） */
    if (H.btn('指示を確定')) { H.click('指示を確定'); await sleep(3); continue; }
    const pc = d.document.querySelector('.pcard');
    if (pc) { pc.click(); await sleep(2); continue; }
    if (H.btn('結果のみ表示（スキップ）')) { H.click('結果のみ表示（スキップ）'); await sleep(3); continue; }
    if (H.btn('キックオフ')) { H.click('キックオフ'); await sleep(3); continue; }
    const opts = [...d.document.querySelectorAll('.choices .btn.choice')];
    if (opts.length && t.includes('成功率の目安')) {
      let best = opts[0], bp = -1;
      opts.forEach(o => { const m = (o.dataset.p ? [0, o.dataset.p] : o.textContent.match(/(\d+)%/)); const p2 = m ? +m[1] : 0; if (p2 > bp) { bp = p2; best = o; } });
      best.click(); await sleep(2); continue;
    }
    if (H.btn('試合を進める')) { H.click('試合を進める'); await sleep(2); continue; }
    if (H.btn('次へ')) { H.click('次へ'); await sleep(2); continue; }
    break;
  }
  return summarySeen;
}

const PATH_LABELS = ['大学でラグビー継続', '実業団へ就職', '大学進学（受験）'];
const STAT_KEYS = ['spd', 'pow', 'pas', 'kik', 'tak', 'sta'];

(async () => {
  /* ---- 0. 静的チェック ---- */
  ['シーズン別成績', '対戦校別成績', '歴代キャプテン', 'seasonHist', 'oppRec', 'recordCaptain',
   'OB_PATHS', 'futurePath', 's.futurePath = path.label', '🔥因縁', '最終能力'].forEach(s => {
    check('static: play.html contains ' + s, html.includes(s));
  });
  {
    const H = await makeDom(null, 111);
    check('title: shows v1.1 (v0.25 でバージョン表記を追随)', H.text().includes('v1.1')); /* v0.26: バージョン表記を v1.1 に追随 */
    H.window.close();
  }

  const base = await freshSave(777);
  const baseSt = JSON.parse(base);

  /* ---- 1. 歴代キャプテン：就任の記録・重複なし・交代の追加・年の併記 ---- */
  {
    const cap0 = baseSt.players.find(p => p.id === baseSt.captainId);
    check('captain: recorded at career start', Array.isArray(baseSt.career.captains) && baseSt.career.captains.length === 1,
      JSON.stringify(baseSt.career.captains));
    const e0 = baseSt.career.captains[0];
    check('captain: entry matches current captain', e0.id === cap0.id && e0.name === cap0.name && e0.grade === cap0.year);
    check('captain: years = [1]', JSON.stringify(e0.years) === '[1]', JSON.stringify(e0.years));

    /* 再読み込みしても増えない */
    const H1 = await makeDom({ 'hanazono.v02': base }, 222);
    check('captain: no duplicate on reload', H1.state().career.captains.length === 1);
    H1.window.close();

    /* 別の選手をキャプテンにすると1行増える */
    const other = baseSt.players.find(p => p.id !== baseSt.captainId);
    const st2 = JSON.parse(base); st2.captainId = other.id;
    const H2 = await makeDom({ 'hanazono.v02': JSON.stringify(st2) }, 333);
    const caps2 = H2.state().career.captains;
    check('captain: appointment of another player adds an entry', caps2.length === 2 && caps2.some(c => c.id === other.id && c.name === other.name),
      JSON.stringify(caps2.map(c => c.name)));
    const st3 = H2.state(); /* v0.26 追随: 新しい jsdom は close 後の localStorage 参照で例外になるため、close 前に読む（検証内容は不変） */
    H2.window.close();

    /* 同じキャプテンが翌年も務めると years に年が併記される（行は増えない） */
    st3.year = 2; /* H2 で保存された台帳（2名とも years=[1]）を翌年として読み直す */
    const H3 = await makeDom({ 'hanazono.v02': JSON.stringify(st3) }, 444);
    const caps3 = H3.state().career.captains;
    const eOther = caps3.find(c => c.id === other.id);
    check('captain: same captain next year merges years', caps3.length === 2 && JSON.stringify(eOther.years) === '[1,2]',
      JSON.stringify(eOther && eOther.years));
    H3.window.close();
  }

  /* ---- 2. マイグレーション：旧セーブ（新フィールドなし）からの復元と「—」表示 ---- */
  {
    const old = JSON.parse(base);
    delete old.career.seasonHist; delete old.career.oppRec; delete old.career.captains;
    old.history = [
      { year: 1, power: 55, result: '予選決勝敗退' },
      { year: 2, power: 61, result: '花園出場（初戦敗退）' }
    ];
    old.rivalW = 1; old.rivalL = 2;
    old.obs = [{ name: '旧 太郎', pos: 'FB', avg: 70, year: 1, tries: 3, plays: 2 }];
    old.players[0].futurePath = 123; /* 壊れた進路ラベルは落とされる */
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(old) }, 555);
    const st = H.state();
    check('migration: seasonHist seeded from real history only', Array.isArray(st.career.seasonHist) && st.career.seasonHist.length === 2,
      JSON.stringify(st.career.seasonHist));
    check('migration: seeded rows keep year/result, unknowns are null',
      st.career.seasonHist[0].y === 1 && st.career.seasonHist[0].result === '予選決勝敗退' &&
      st.career.seasonHist[0].w === null && st.career.seasonHist[0].grade === null && st.career.seasonHist[0].goalOk === null);
    check('migration: oppRec seeded for Teito from rival W/L',
      JSON.stringify(st.career.oppRec['帝都学園']) === JSON.stringify({ p: 3, w: 1, l: 2 }), JSON.stringify(st.career.oppRec));
    check('migration: captains starts from current captain', st.career.captains.length === 1);
    check('migration: broken futurePath dropped to null', st.players[0].futurePath === null);
    H.click('記録・OB'); await sleep(15);
    const rt = H.text();
    check('records(old): season section with seeded rows and — for unknowns',
      rt.includes('シーズン別成績') && rt.includes('予選決勝敗退') && rt.includes('勝敗 —') && rt.includes('目標 —'), rt.slice(0, 400));
    check('records(old): opp section shows Teito 3戦 1勝 2敗 and 因縁 mark',
      rt.includes('対戦校別成績') && rt.includes('3戦 1勝 2敗') && rt.includes('🔥因縁'));
    check('records(old): unplayed school shows 対戦なし', rt.includes('対戦なし'));
    check('records(old): captains section shown', rt.includes('歴代キャプテン') && rt.includes('就任：'));
    check('records(old): legacy OB shows 進路 — and 最終能力 —', rt.includes('進路 —') && rt.includes('最終能力 —'), rt.slice(-400));
    H.window.close();
  }

  /* ---- 3. 実シーズン駆動：シーズン別成績・対戦成績・OB の最終能力と進路 ---- */
  {
    const st = JSON.parse(base);
    st.players.forEach(p => { for (const k in p.stats) p.stats[k] = 92; p.fatigue = 0; p.injured = 0; });
    st.goal = 'win1';
    const senior = st.players.find(p => p.year === 3);
    senior.futurePath = '実業団へ就職'; /* 進路イベントで決まった想定：卒業時にそのまま引き継がれること */
    const seniorName = senior.name;
    const d = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 31337);
    const H = d;
    const seen = await driveSeason(H, d);
    check('season: summary reached', seen);
    const stEnd = H.state();
    check('seasonHist: exactly one row added', stEnd.career.seasonHist.length === 1, JSON.stringify(stEnd.career.seasonHist));
    const e = stEnd.career.seasonHist[0];
    check('seasonHist: row matches finished season',
      e.y === 1 && e.result === stEnd.season.result && e.w === stEnd.season.wins && e.l === stEnd.season.losses,
      JSON.stringify(e) + ' vs season ' + JSON.stringify(stEnd.season));
    check('seasonHist: grade and goal recorded', typeof e.grade === 'string' && e.grade.length > 0 && e.goal === '予選でまず1勝' && e.goalOk === true,
      JSON.stringify(e));
    const tot = Object.values(stEnd.career.oppRec).reduce((a, r) => ({ p: a.p + r.p, w: a.w + r.w, l: a.l + r.l }), { p: 0, w: 0, l: 0 });
    check('oppRec: every match counted once', tot.p === e.w + e.l && tot.w === e.w && tot.l === e.l,
      'tot=' + JSON.stringify(tot) + ' season=' + e.w + 'W' + e.l + 'L');
    check('oppRec: Teito played once and beaten by the strong team',
      stEnd.career.oppRec['帝都学園'] && stEnd.career.oppRec['帝都学園'].p === 1 && stEnd.career.oppRec['帝都学園'].w === 1,
      JSON.stringify(stEnd.career.oppRec['帝都学園']));
    check('oppRec: practice opponent counted', (stEnd.career.oppRec['青葉高校'] || {}).p >= 1);

    /* 記録室の表示（サマリー経由） */
    H.click('記録・OB'); await sleep(15);
    const rt = H.text();
    check('records: season row rendered with goal outcome', rt.includes('シーズン別成績') && rt.includes('目標「予選でまず1勝」達成'), rt.slice(0, 300));
    check('records: opp rows rendered', rt.includes('対戦校別成績') && rt.includes('帝都学園') && rt.includes('1戦 1勝 0敗'));

    /* 卒業 → OB レコードに最終能力と進路が入る */
    const d2 = await makeDom({ 'hanazono.v02': JSON.stringify(stEnd) }, 777);
    const H2 = d2;
    check('flow: back on summary after reload', H2.text().includes('シーズン終了'));
    H2.click('新年度へ'); await sleep(15);
    const stY2 = H2.state();
    const newObs = stY2.obs.filter(o => o.year === 1);
    check('ob: graduates recorded', newObs.length >= 3, 'obs=' + stY2.obs.length);
    check('ob: every new OB has 6-stat snapshot and a path label',
      newObs.every(o => o.st && STAT_KEYS.every(k => typeof o.st[k] === 'number') && PATH_LABELS.includes(o.path)),
      JSON.stringify(newObs[0]));
    check('ob: snapshot avg consistent with stats (rounding tolerance)',
      newObs.every(o => Math.abs(o.avg - Math.round(STAT_KEYS.reduce((a, k) => a + o.st[k], 0) / 6)) <= 1));
    const obSenior = newObs.find(o => o.name === seniorName);
    check('ob: decided futurePath is inherited verbatim', !!obSenior && obSenior.path === '実業団へ就職',
      obSenior ? obSenior.path : 'not found');
    check('captain: current captain of year 2 is in the ledger',
      stY2.career.captains.some(c => c.id === stY2.captainId && c.years.includes(2)),
      JSON.stringify(stY2.career.captains));
    d.window.close(); d2.window.close();
  }

  /* ---- 4. 複数シーズンソーク：履歴が正しく積み上がる（試合なしの早回し） ---- */
  {
    let cur = JSON.parse(base);
    for (let s = 1; s <= 3; s++) {
      cur.monthIdx = 10; /* 最終月（needWin）。未勝利のまま月末を迎えると seasonEnd する */
      cur.board = { cells: [{ t: 'end', done: false }], pos: -1, hand: [1], log: [] };
      cur.summary = null; cur.recruit = null; cur.goalSet = true; cur.qualified = false;
      const H = await makeDom({ 'hanazono.v02': JSON.stringify(cur) }, 1000 + s);
      let guard = 0;
      while (guard++ < 12 && !H.text().includes('シーズン終了')) {
        const pc = H.document.querySelector('.pcard');
        if (!pc) break;
        pc.click(); await sleep(5);
      }
      check('soak: season ' + s + ' ended', H.text().includes('シーズン終了'), H.text().slice(0, 120));
      const stS = H.state();
      check('soak: seasonHist has ' + s + ' row(s), latest year = ' + s,
        stS.career.seasonHist.length === s && stS.career.seasonHist[s - 1].y === s &&
        typeof stS.career.seasonHist[s - 1].w === 'number',
        JSON.stringify(stS.career.seasonHist.map(x => x.y)));
      H.click('新年度へ'); await sleep(12);
      if (H.btn('新年度を始める')) { H.click('新年度を始める'); await sleep(12); }
      /* v0.20 追随: 新入生紹介画面が挟まるため、紹介を通過してから目標を決める（検証内容は不変） */
      if (H.btn('次へ進む')) { H.click('次へ進む'); await sleep(10); }
      if (H.btn('目標を決めて')) { H.click('目標を決めて'); await sleep(8); }
      cur = H.state();
      H.window.close();
    }
    check('soak: no phantom match records without matches',
      Object.values(cur.career.oppRec).reduce((a, r) => a + r.p, 0) === 0, JSON.stringify(cur.career.oppRec));
    check('soak: OB accumulated with stats+path across seasons',
      cur.obs.length >= 9 && cur.obs.every(o => o.st && PATH_LABELS.includes(o.path)), 'obs=' + cur.obs.length);
    check('soak: captains ledger stayed compact (<=30, years merged)',
      cur.career.captains.length >= 1 && cur.career.captains.length <= 30);
  }

  /* ---- 5. 空データの記録室 ---- */
  {
    const H = await makeDom({ 'hanazono.v02': base }, 999);
    H.click('記録・OB'); await sleep(15);
    const rt = H.text();
    check('records(empty): season section placeholder', rt.includes('シーズン別成績') && rt.includes('まだシーズンを終えていない'));
    check('records(empty): opp section lists schools as 対戦なし', rt.includes('対戦校別成績') && rt.includes('対戦なし'));
    check('records(empty): captains section lists the first captain', rt.includes('歴代キャプテン') && rt.includes('就任：1年目'));
    H.window.close();
  }

  console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
