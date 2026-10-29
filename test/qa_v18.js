/* QA for v0.18: ライバル（他校エースの実在化／対戦確認のキーマン対比／因縁の深化）。
 * 対象は play.html（jsdom）。ハーネスは qa_v16 と同型。
 * エース生成は (学校, 年度) からの決定的生成なので、セーブの year を差し替えて各年度の対戦確認を観測し、
 * 「同一人物の学年は+1ずつ進む／代替わりは卒業（3年）の直後だけ／4年目には初代が必ず去っている」を検証する。
 * ストリークは career.streaks（oppRec とは別管理。v0.14 の oppRec 移行の厳密さを壊さないため）。 */
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
async function driveToPreMatch(H) {
  let guard = 0;
  while (guard++ < 300) {
    if (H.btn('キックオフ')) return true;
    if (H.btn('確認した')) { H.click('確認した'); await sleep(5); continue; } /* v0.22 追随: 成長レポートが専用レイアウト表示になり、確認後に指示フォームが出るため、駆動に確認ステップを追加（検証内容は不変） */
    if (H.btn('指示を確定')) { H.click('指示を確定'); await sleep(3); continue; }
    const pc = H.document.querySelector('.pcard');
    if (pc) { pc.click(); await sleep(2); continue; }
    await sleep(5);
  }
  return false;
}
function sceneChoices(H) { return [...H.document.querySelectorAll('.choices .btn.choice')]; }
async function driveMatchToEnd(H) {
  let guard = 0;
  while (guard++ < 400) {
    if (H.btn('次へ')) return true;
    if (H.btn('変更しない')) { H.click('変更しない'); await sleep(1); continue; }
    const cs = sceneChoices(H);
    if (cs.length && H.text().includes('成功率の目安')) {
      let best = cs[0], bp = -1;
      cs.forEach(o => { const m = (o.dataset.p ? [0, o.dataset.p] : o.textContent.match(/(\d+)%/)); const p = m ? +m[1] : 0; if (p > bp) { bp = p; best = o; } });
      best.click(); await sleep(1); continue;
    }
    if (H.btn('試合を進める')) { H.click('試合を進める'); await sleep(1); continue; }
    await sleep(3);
  }
  return false;
}
function toMatchSave(base, mi) {
  const st = JSON.parse(base);
  st.monthIdx = mi; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
  return st;
}
function flat(st, base) {
  st.players.forEach(p => {
    Object.keys(p.stats).forEach(k => { p.stats[k] = base; });
    p.fatigue = 0; p.form = 0; p.trust = 50;
    p.injured = 0; p.injSev = null; p.injPart = null; p.justBack = false;
  });
}
/* スカウティングの「エース名前（G年・POS）」を抜く（textContent は要素間に空白を挟まない） */
function scoutAce(H) {
  const m = H.text().match(/エース ?(\S+ \S+)（(\d)年・([A-Za-z0-9]+)）/);
  return m ? { name: m[1], grade: +m[2], pos: m[3] } : null;
}
/* キーマン対比カードの相手側「総合 ランク 数値」を抜く（同上：総合E 40 のような連結になる） */
function keymanOppOverall(H) {
  const km = H.document.querySelector('.keyman');
  if (!km) return null;
  const cols = km.querySelectorAll('.kmcol');
  if (cols.length < 2) return null;
  const m = cols[1].textContent.replace(/\s+/g, ' ').match(/総合([SABCDEFG]) (\d+)/);
  return m ? +m[2] : null;
}

(async () => {
  /* ---- 0. 静的チェック ---- */
  check('static: title is v1.2', html.includes('<title>Road to HANAZONO v1.2</title>')) /* v0.25: バージョン表記を追随 */; /* v0.26: バージョン表記を v1.1 に追随 */ /* v0.27: バージョン表記を v1.2 に追随 */
  check('static: STORE_KEY unchanged', html.includes("STORE_KEY = 'hanazono.v02'"));
  ['oppAceAt', 'genOppAce', 'aceTenure', 'aceStatsOf', 'aceOverallOf', 'acePortraitEl',
   'キーマン対比', 'rivalEvent', 'STREAK_COMM', 'streakOf', 'streakText', 'career.streaks'].forEach(s => {
    check('static: play.html contains ' + s, html.includes(s));
  });
  check('static: play.html under 3.5MB', Buffer.byteLength(html, 'utf8') < 3500000, Buffer.byteLength(html, 'utf8') + ' bytes'); /* v0.26: 場面イラスト3枚の追加に伴い上限を 3.5MB に見直し */

  const base = await freshSave(777);
  check('save: fresh save has career.streaks = {}', JSON.stringify(JSON.parse(base).career.streaks) === '{}');

  /* ---- 1. 初代エース（世代0）は v0.6 からの固定エースのまま ---- */
  {
    const st = toMatchSave(base, 2); /* 6月・練習試合（青葉） */
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 31);
    check('aoba: reached prematch', await driveToPreMatch(H));
    const a = scoutAce(H);
    check('ace: year1 Aoba ace is the original 風間 駿 (WTB)', !!a && a.name === '風間 駿' && a.pos === 'WTB', a ? JSON.stringify(a) : 'none');
    check('ace: year1 Aoba ace has a grade 1..3', !!a && a.grade >= 1 && a.grade <= 3);
    const t = H.text();
    check('prematch: scouting shows エースの特能', t.includes('エースの特能') && t.includes('ステップ職人'));
    /* キーマン対比カード */
    const km = H.document.querySelector('.keyman');
    check('keyman: card exists on prematch', !!km);
    if (km) {
      const cols = km.querySelectorAll('.kmcol');
      check('keyman: two columns (mine / opponent)', cols.length === 2);
      check('keyman: opponent column shows ace name + skill', cols[1].textContent.includes('風間 駿') && cols[1].textContent.includes('ステップ職人'));
      check('keyman: opponent portrait uses Aoba jersey color (#2e7d4f)', cols[1].innerHTML.includes('#2e7d4f'));
      check('keyman: both columns render portraits (svg)', km.querySelectorAll('.portrait svg').length >= 2);
      check('keyman: both columns show rank letters', cols[0].querySelectorAll('.rk').length >= 2 && cols[1].querySelectorAll('.rk').length >= 2);
      const roster = JSON.parse(base).players.map(p => p.name);
      check('keyman: my keyman is a roster player', roster.some(n => cols[0].textContent.includes(n)));
    }
    const ov = keymanOppOverall(H);
    check('keyman: Aoba ace overall derived near school power 38 (30..50)', ov !== null && ov >= 30 && ov <= 50, 'overall=' + ov);
    /* キックオフ実況：エース行に学年が付く（qa_v16 の aceRef 形式＝名前（POS・…）は維持） */
    H.click('キックオフ'); await sleep(10);
    const ko = H.logLines().find(l => l.includes('相手のエース：')) || '';
    check('kickoff: ace line carries grade', /^相手のエース：風間 駿（WTB・ステップ職人・\d年）。要注意だ$/.test(ko), ko);
    H.window.close();
  }

  /* ---- 2. 決定的生成：同じ年度は同じ人物。学年進行と代替わりの規則 ---- */
  {
    const seen = [];
    for (let y = 1; y <= 6; y++) {
      const st = toMatchSave(base, 2); st.year = y;
      const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 40 + y);
      await driveToPreMatch(H);
      seen.push({ year: y, ace: scoutAce(H) });
      H.window.close();
    }
    check('ace: every year 1..6 has an ace with grade', seen.every(s => s.ace && s.ace.grade >= 1 && s.ace.grade <= 3), JSON.stringify(seen.map(s => s.ace)));
    let rulesOk = true, det = [];
    for (let i = 1; i < seen.length; i++) {
      const p = seen[i - 1].ace, c = seen[i].ace;
      if (!p || !c) { rulesOk = false; break; }
      if (c.name === p.name) { if (c.grade !== p.grade + 1) { rulesOk = false; det.push('grade jump at y' + seen[i].year); } }
      else { if (!(p.grade === 3 && (c.grade === 1 || c.grade === 2))) { rulesOk = false; det.push('bad succession at y' + seen[i].year + ': ' + p.name + '(' + p.grade + ') -> ' + c.name + '(' + c.grade + ')'); } }
    }
    check('ace: grade +1 while same person; succession only after grade 3, entry grade 1..2', rulesOk, det.join(' '));
    check('ace: first-generation ace is gone by year 4 (tenure <= 3)', seen[3].ace && seen[0].ace && seen[3].ace.name !== seen[0].ace.name,
      'y1=' + (seen[0].ace || {}).name + ' y4=' + (seen[3].ace || {}).name);
    /* 決定性：同じ year のセーブを読み直しても同じ人物・学年 */
    const st3 = toMatchSave(base, 2); st3.year = 3;
    const H3a = await makeDom({ 'hanazono.v02': JSON.stringify(st3) }, 51);
    await driveToPreMatch(H3a);
    const a3a = scoutAce(H3a); H3a.window.close();
    const H3b = await makeDom({ 'hanazono.v02': JSON.stringify(st3) }, 52);
    await driveToPreMatch(H3b);
    const a3b = scoutAce(H3b); H3b.window.close();
    check('ace: deterministic across reloads (same year -> same ace)', !!a3a && !!a3b && a3a.name === a3b.name && a3a.grade === a3b.grade && a3a.pos === a3b.pos,
      JSON.stringify(a3a) + ' vs ' + JSON.stringify(a3b));
    check('ace: matches prematch observation of year 3', !!a3a && seen[2].ace && a3a.name === seen[2].ace.name && a3a.grade === seen[2].ace.grade);
  }

  /* ---- 3. エース能力は学校の強さから導出（格上校ほど高い） ---- */
  {
    const st = toMatchSave(base, 10); st.qualified = true; /* 1月・花園決勝（北辰） */
    flat(st, 90);
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 61);
    check('hokushin: reached prematch', await driveToPreMatch(H));
    const a = scoutAce(H);
    check('ace: year1 Hokushin ace is the original 北原 蒼汰 (LO)', !!a && a.name === '北原 蒼汰' && a.pos === 'LO', a ? JSON.stringify(a) : 'none');
    const ov = keymanOppOverall(H);
    check('keyman: Hokushin ace overall derived near school power 85 (75..99)', ov !== null && ov >= 75 && ov <= 99, 'overall=' + ov);
    H.window.close();
  }

  /* ---- 4. ストリークの記録と表示 ---- */
  {
    /* 圧勝できるチームで青葉に勝ち続ける */
    let st = toMatchSave(base, 2); flat(st, 90);
    let H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 71);
    await driveToPreMatch(H);
    H.click('キックオフ'); await sleep(10);
    check('streak: match 1 completes', await driveMatchToEnd(H));
    let sv = H.state();
    check('streak: after 1 win vs Aoba, streak = 1', sv.career.streaks && sv.career.streaks['青葉高校'] === 1, JSON.stringify(sv.career.streaks));
    check('streak: oppRec still counted (p1 w1)', sv.career.oppRec['青葉高校'] && sv.career.oppRec['青葉高校'].p === 1 && sv.career.oppRec['青葉高校'].w === 1);
    H.window.close();
    /* 2年目の6月：対戦確認に通算と「前回対戦は勝利」 */
    st = JSON.parse(JSON.stringify(sv)); st.monthIdx = 2; st.year = 2; st.board = null; st.summary = null; st.recruit = null;
    H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 72);
    await driveToPreMatch(H);
    const t2 = H.text();
    check('prematch: 通算対戦 shown for non-Teito school', t2.includes('通算対戦') && t2.includes('1勝 0敗'));
    check('prematch: streak text 前回対戦は勝利 shown', t2.includes('前回対戦は勝利'));
    H.click('キックオフ'); await sleep(10);
    check('streak: match 2 completes', await driveMatchToEnd(H));
    sv = H.state();
    check('streak: after 2 wins, streak = 2', sv.career.streaks['青葉高校'] === 2, JSON.stringify(sv.career.streaks));
    H.window.close();
    /* 3年目の6月：対戦確認に「目下 2連勝中」、キックオフ実況にも連勝が出る */
    st = JSON.parse(JSON.stringify(sv)); st.monthIdx = 2; st.year = 3; st.board = null; st.summary = null; st.recruit = null;
    H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 73);
    await driveToPreMatch(H);
    check('prematch: streak text 目下 2連勝中 shown', H.text().includes('目下 2連勝中'));
    H.click('キックオフ'); await sleep(10);
    check('kickoff: win-streak line announced', H.logLines().some(l => l.includes('この相手には2連勝中')), H.logLines().slice(0, 8).join(' / '));
    H.window.close();
    /* 記録室：対戦校別成績にストリークと現エースが出る */
    H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 74);
    H.click('記録・OB'); await sleep(10);
    const rt = H.text();
    check('records: oppRec row shows streak + current ace', rt.includes('対戦校別成績') && rt.includes('目下 2連勝中') && rt.includes('現エース：'), rt.slice(rt.indexOf('対戦校別成績'), rt.indexOf('対戦校別成績') + 400));
    H.window.close();
  }
  {
    /* 連敗側：弱いチームで敗れ、既存 -2 から -3 の節目実況が出る。
     * ストリークは試合を経て育つものなので、通算（oppRec）も実在する形で用意する */
    const st = toMatchSave(base, 2); flat(st, 15);
    st.career.streaks = { '青葉高校': -2 };
    st.career.oppRec = { '青葉高校': { p: 2, w: 0, l: 2 } };
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 75);
    await driveToPreMatch(H);
    check('prematch: losing streak text 目下 2連敗中 shown', H.text().includes('目下 2連敗中'));
    H.click('キックオフ'); await sleep(10);
    check('kickoff: losing-streak line announced', H.logLines().some(l => l.includes('この相手には2連敗中')));
    check('streak: losing match completes', await driveMatchToEnd(H));
    const sv = H.state();
    check('streak: loss extends streak to -3', sv.career.streaks['青葉高校'] === -3, JSON.stringify(sv.career.streaks));
    check('matchlog: -3 milestone line shown', H.logLines().some(l => l.includes('青葉高校 に3連敗')));
    H.window.close();
  }

  /* ---- 5. ライバル専用イベント：因縁がある時だけ盤面イベントに割り込む ---- */
  {
    let found = null;
    for (const seed of [11, 22, 33]) {
      const st = JSON.parse(base);
      st.goalSet = true; st.summary = null; st.recruit = null; st.monthIdx = 0;
      st.career.streaks = { '青葉高校': -3 };
      st.board = { cells: Array.from({ length: 12 }, () => ({ t: 'ev', done: false })), pos: -1, hand: [1, 1, 1], log: [] };
      const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, seed);
      for (let i = 0; i < 40 && !found; i++) {
        const pc = H.document.querySelector('.pcard');
        if (!pc) break;
        pc.click(); await sleep(1);
        const logs = (H.state().board && H.state().board.log) || [];
        const hit = logs.find(l => l.includes('地元紙') && l.includes('3連敗'));
        if (hit) found = hit;
      }
      H.window.close();
      if (found) break;
    }
    check('rival event: losing-streak newspaper event fires on board events', !!found, found || 'not fired in 120 ev rolls');
    /* 因縁が無い（ストリークなし・1年目）場合はライバルイベントは出ない */
    let leaked = null;
    {
      const st = JSON.parse(base);
      st.goalSet = true; st.summary = null; st.recruit = null; st.monthIdx = 0;
      st.board = { cells: Array.from({ length: 12 }, () => ({ t: 'ev', done: false })), pos: -1, hand: [1, 1, 1], log: [] };
      const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 44);
      for (let i = 0; i < 40; i++) {
        const pc = H.document.querySelector('.pcard');
        if (!pc) break;
        pc.click(); await sleep(1);
      }
      const logs = (H.state().board && H.state().board.log) || [];
      leaked = logs.find(l => l.includes('地元紙') || l.includes('ライバル校の話題'));
      H.window.close();
    }
    check('rival event: never fires without a rivalry (year1, no streaks)', !leaked, leaked || '');
  }

  /* ---- 6. セーブ移行：streaks の無い旧セーブ／壊れた streaks ---- */
  {
    const st = JSON.parse(base);
    delete st.career.streaks;
    st.career.oppRec = { '帝都学園': { p: 3, w: 1, l: 2 } };
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 81);
    await sleep(10);
    /* 何か1つ操作して保存を走らせる */
    if (H.btn('選手一覧')) { H.click('選手一覧'); await sleep(10); }
    const sv = H.state();
    check('migration: streaks added as {} for old saves', !!sv.career && typeof sv.career.streaks === 'object' && Object.keys(sv.career.streaks).length === 0, JSON.stringify(sv.career.streaks));
    check('migration: oppRec entry shape untouched (v0.14 exact form)',
      JSON.stringify(sv.career.oppRec['帝都学園']) === JSON.stringify({ p: 3, w: 1, l: 2 }), JSON.stringify(sv.career.oppRec['帝都学園']));
    H.window.close();
  }
  {
    const st = JSON.parse(base);
    st.career.streaks = { '青葉高校': 'x', '県立西高校': 500, '帝都学園': -2 };
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 82);
    await sleep(10);
    if (H.btn('選手一覧')) { H.click('選手一覧'); await sleep(10); }
    const sv = H.state();
    check('migration: corrupt streak values dropped / clamped',
      sv.career.streaks['青葉高校'] === undefined && sv.career.streaks['県立西高校'] === 99 && sv.career.streaks['帝都学園'] === -2,
      JSON.stringify(sv.career.streaks));
    H.window.close();
  }

  console.log(failures ? ('\nNG: ' + failures + ' failures') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
