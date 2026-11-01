/* QA for v0.16: 試合の采配（後半の戦術変更／PGキッカー指名／相手エースへのマーク指示／交代警告／ソーク健全性）。
 * 対象は play.html（jsdom）。ハーネスは qa_v12 と同型。
 * 決定性の工夫：比較テストは同一シード・同一セーブ（対象の差分のみ）で2つの DOM を走らせ、
 * 場面の表示成功率（sceneProb 由来で乱数を消費しない）を比べる。マークは確率事象のため複数試合の実況行数で統計検定する。 */
const fs = require('fs');
const { execFileSync } = require('child_process');
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
function pctOf(H, sub) {
  const b = sceneChoices(H).find(x => x.textContent.includes(sub));
  if (!b) return null;
  const m = (b.dataset.p ? [0, b.dataset.p] : b.textContent.match(/(\d+)%/));
  return m ? +m[1] : null;
}
/* 次の勝負どころ（選択肢表示）まで試合を進める。試合が終わっていたら false */
async function advanceToScene(H) {
  let guard = 0;
  while (guard++ < 300) {
    const cs = sceneChoices(H);
    if (cs.length && H.text().includes('成功率の目安')) return true;
    if (H.btn('次へ')) return false;
    if (H.btn('試合を進める')) { H.click('試合を進める'); await sleep(2); continue; }
    await sleep(3);
  }
  return false;
}
/* 試合終了まで（選択肢は最大%・戦術変更は「変更しない」） */
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
  st.monthIdx = mi; st.goalSet = true; st.summary = null; st.recruit = null;
  /* v0.19 追随: 旧方式では月末マス1枚の盤面で即座に試合へ入れたが、週次方式では月を
   * 進める間に練習のケガ・疲労で用意した選手状態が漂ってしまう。検証対象は試合内の仕様
   * なので、月は最終週（第4週）から始めて漂いを最小にする（残り1週で月末＝試合に接続） */
  st.board = { weekly: true, week: 3, log: [], dlg: null, picks: [] };
  return st;
}
function flat(st, base, fat) {
  st.players.forEach(p => {
    Object.keys(p.stats).forEach(k => { p.stats[k] = base; });
    p.fatigue = fat == null ? 0 : fat; p.form = 0; p.trust = 50;
    p.injured = 0; p.injSev = null; p.injPart = null; p.justBack = false;
  });
}

(async () => {
  /* ---- 0. 静的チェック ---- */
  check('static: title is v1.3 (v0.25 でバージョン表記を追随)', html.includes('<title>Road to HANAZONO v1.3</title>')); /* v0.26: バージョン表記を v1.1 に追随 */ /* v0.27: バージョン表記を v1.2 に追随 */ /* v0.28: バージョン表記を v1.3 に追随 */
  check('static: STORE_KEY unchanged', html.includes("STORE_KEY = 'hanazono.v02'"));
  ['HT_PLANS', 'htPlanScene', '後半の戦術変更', 'pgChance', 'kickerOf', 'markActive', 'warntag', 'warnReasons',
   'キッカー＆マーク', 'マーク指示', '今日のPGキッカーは', 'ケガ明け'].forEach(s => {
    check('static: play.html contains ' + s, html.includes(s));
  });

  const base = await freshSave(777);
  check('save: fresh roster size >= 18', JSON.parse(base).players.length >= 18, 'n=' + JSON.parse(base).players.length);

  /* ---- 0b. セーブ互換：justBack の無い旧セーブが読み込め、移行補完される ---- */
  {
    const st = JSON.parse(base);
    st.players.forEach(p => { delete p.justBack; });
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 21);
    /* 目標未設定のセーブはタイトルではなく目標設定画面から再開する（v0.9 以来の仕様）。HUD が描画されれば読み込み成功 */
    check('compat: old save loads (HUD rendered, no crash)', H.text().includes('桜丘高校'));
    H.click('選手一覧'); await sleep(10);
    const st2 = H.state();
    check('compat: justBack migrated to false for all players', st2.players.every(p => p.justBack === false));
    H.window.close();
  }

  /* ---- 1. 後半の戦術変更（ハーフタイムあり＝予選決勝）：提示は1回だけ・選択が実況に出る・
   *        対応する場面の成功率だけが +4pt 動く（同一シード比較） ---- */
  async function playToPenalty(planLabel, seed) {
    const st = toMatchSave(base, 8); flat(st, 62);
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, seed);
    await driveToPreMatch(H);
    H.click('キックオフ'); await sleep(10);
    await advanceToScene(H); sceneChoices(H)[0].click(); await sleep(2);   /* block2 setpiece */
    await advanceToScene(H); sceneChoices(H)[0].click(); await sleep(2);   /* block3 goal */
    await advanceToScene(H);                                              /* block5 halftime */
    const isHt = H.text().includes('ハーフタイム：ロッカールームでの指示');
    H.click('落ち着いて立て直す'); await sleep(2);
    const httacShown = !!H.btn('変更しない') && H.text().includes('後半の戦術変更：残りの攻め方を選ぶ');
    const httacPct = pctOf(H, 'FWで押し込む');
    const commBefore = H.logLines().join('\n');
    H.click(planLabel); await sleep(2);
    await advanceToScene(H);                                              /* block7 penalty */
    const pct = pctOf(H, 'ショット（PGを狙う）');
    const lines = H.logLines();
    H.window.close();
    return { isHt, httacShown, httacPct, pct, lines, commBefore };
  }
  {
    const kick = await playToPenalty('キックで陣地を取る', 1601);
    const none = await playToPenalty('変更しない', 1601);
    check('httac: halftime scene reached in final', kick.isHt && none.isHt);
    check('httac: offered right after halftime choices', kick.httacShown && none.httacShown);
    check('httac: choices are flat 100% (no roll)', kick.httacPct === 100, 'pct=' + kick.httacPct);
    check('httac: kick plan is announced in commentary', kick.lines.some(l => l.includes('キックで陣地を取る形に切り替えた')));
    check('httac: no-change is announced in commentary', none.lines.some(l => l.includes('後半も前半の形のまま戦う')));
    check('httac: kick plan adds exactly +4pt to the kick scene', kick.pct !== null && none.pct !== null && kick.pct - none.pct === 4,
      'kick=' + kick.pct + ' none=' + none.pct);
  }
  /* 提示は試合に1回だけ（フルに流してログの ⚑ 行を数える） */
  {
    const st = toMatchSave(base, 8); flat(st, 62);
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 1602);
    await driveToPreMatch(H);
    H.click('キックオフ'); await sleep(10);
    const done = await driveMatchToEnd(H);
    check('httac: final match completes', done);
    const offers = H.logLines().filter(l => l.includes('後半の戦術変更：残りの攻め方を選ぶ')).length;
    check('httac: offered exactly once per match', offers === 1, 'offers=' + offers);
    const saved = JSON.stringify(H.state());
    check('save: no match-temp tactics data in save', !saved.includes('htPlan') && !saved.includes('kickerId') && !saved.includes('markId'));
    H.window.close();
  }

  /* ---- 2. 後半の戦術変更（ハーフタイムなし＝練習試合）：前半の停止点では出ず、
   *        後半最初の停止点で先に提示され、本来の勝負どころが後に回る ---- */
  {
    const st = toMatchSave(base, 2); flat(st, 62);
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 1603);
    await driveToPreMatch(H);
    H.click('キックオフ'); await sleep(10);
    await advanceToScene(H);   /* block3 setpiece（前半） */
    check('httac-defer: first stop is a real scene, not the tactic prompt',
      H.text().includes('勝負どころ') && !H.btn('変更しない'));
    sceneChoices(H)[0].click(); await sleep(2);
    await advanceToScene(H);   /* block7: まず戦術変更が提示される */
    check('httac-defer: tactic prompt comes before the 2nd-half scene',
      !!H.btn('変更しない') && H.text().includes('後半の戦術変更：残りの攻め方を選ぶ'));
    H.click('変更しない'); await sleep(2);
    check('httac-defer: deferred scene follows after the choice',
      sceneChoices(H).length > 0 && H.text().includes('勝負どころ'));
    check('httac-defer: no-change announced', H.logLines().some(l => l.includes('後半も前半の形のまま戦う')));
    H.window.close();
  }

  /* ---- 3. PGキッカー指名 ----
   * 3a. 指名UIの目安（◎○△）が能力・特能・調子で変わり、数値（%）は出ない */
  {
    const cases = [
      { kik: 40, skills: [], form: 0, want: '△', label: 'weak kicker' },
      { kik: 60, skills: [], form: 0, want: '○', label: 'average kicker' },
      { kik: 85, skills: ['kick'], form: 0, want: '◎', label: 'strong kicker with skill' },
      { kik: 53, skills: [], form: 2, want: '○', label: 'form +2 lifts grade' },
      { kik: 53, skills: [], form: -2, want: '△', label: 'form -2 drops grade' },
      { kik: 66, skills: [], form: 2, want: '◎', label: 'form +2 reaches top grade' },
      { kik: 66, skills: [], form: -2, want: '○', label: 'form -2 falls from top grade' }
    ];
    for (const cs of cases) {
      const st = toMatchSave(base, 8); flat(st, 62);
      const pr = st.players.find(p => p.posIdx === 0);
      pr.stats.kik = cs.kik; pr.skills = cs.skills; pr.form = cs.form;
      const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 1610);
      await driveToPreMatch(H);
      const sels = H.document.querySelectorAll('select');
      check('kicker-ui: selects exist (' + cs.label + ')', sels.length >= 1);
      const opts = [...sels[0].querySelectorAll('option')];
      const opt = opts.find(o => o.value === String(pr.id));
      check('kicker-ui: grade ' + cs.want + ' for ' + cs.label, !!opt && opt.textContent.trim().startsWith(cs.want),
        opt ? opt.textContent.trim().slice(0, 24) : 'option missing');
      check('kicker-ui: no numeric percentage shown (' + cs.label + ')', !opts.some(o => o.textContent.includes('%')));
      H.window.close();
    }
  }
  /* 3b. 指名するとその選手が蹴る（キックオフ実況＋ペナルティ場面のキーマン）。
   *     成功率は本人のキック値で決まる（チーム平均ではない）／調子でも変わる */
  async function penaltyWithKicker(kik, skills, form, seed) {
    const st = toMatchSave(base, 8); flat(st, 58);
    const pr = st.players.find(p => p.posIdx === 0);
    ['spd', 'pow', 'pas', 'tak', 'sta'].forEach(k => { pr.stats[k] = 70; });
    pr.stats.kik = kik; pr.skills = skills; pr.form = form;
    st.lineup = [pr.id].concat(st.players.filter(p => p.id !== pr.id).slice(0, 14).map(p => p.id));
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, seed);
    await driveToPreMatch(H);
    const sel = H.document.querySelectorAll('select')[0];
    sel.value = String(pr.id); sel.onchange();
    H.click('キックオフ'); await sleep(10);
    const kickLog = H.logLines().some(l => l.includes('今日のPGキッカーは ' + pr.name + ' が務める'));
    await advanceToScene(H); sceneChoices(H)[0].click(); await sleep(2);
    await advanceToScene(H); sceneChoices(H)[0].click(); await sleep(2);
    await advanceToScene(H); H.click('落ち着いて立て直す'); await sleep(2);
    H.click('変更しない'); await sleep(2);
    await advanceToScene(H);
    const keyLine = H.text().includes('キーマン：' + pr.name);
    const pct = pctOf(H, 'ショット（PGを狙う）');
    H.window.close();
    return { kickLog, keyLine, pct };
  }
  {
    const strong = await penaltyWithKicker(88, ['kick'], 0, 1620);
    const weak = await penaltyWithKicker(40, [], 0, 1620);
    check('kicker: designation announced at kickoff', strong.kickLog && weak.kickLog);
    check('kicker: designated PR (not SO/FB) is the penalty-scene key man', strong.keyLine);
    check('kicker: scene % follows the designated kicker own kik', strong.pct !== null && weak.pct !== null && strong.pct - weak.pct >= 15,
      'strong=' + strong.pct + ' weak=' + weak.pct);
    const fp = await penaltyWithKicker(62, [], 2, 1621);
    const fm = await penaltyWithKicker(62, [], -2, 1621);
    check('kicker: scene % moves with the kicker form', fp.pct !== null && fm.pct !== null && fp.pct > fm.pct,
      'form+2=' + fp.pct + ' form-2=' + fm.pct);
  }

  /* ---- 4. マーク指示：キックオフ実況に出る／トレードオフが両方向に効く（統計） ----
   * 練習試合（相手エースあり）を複数回流し、実況の「エース絡みのトライ行」と「それ以外の相手トライ行」を数える */
  const NONACE = ['相手の攻撃を止めきれない', '相手BKの展開に振り切られた', 'ゴール前の粘りが届かない'];
  async function countOppTries(seed, marked) {
    const st = toMatchSave(base, 2); flat(st, 45);
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, seed);
    await driveToPreMatch(H);
    let markLogOk = null, markerName = null;
    if (marked) {
      /* マークマンは「実際に対戦確認の選択肢に並んだ先発」から選ぶ。
       * セーブ側で lineup を固定しても、盤面イベントの負傷で先発が入れ替わることがあるため */
      const msel = H.document.querySelectorAll('select')[1];
      const firstOpt = msel.querySelectorAll('option')[1];
      markerName = firstOpt.textContent.split('（')[0];
      msel.value = firstOpt.value; msel.onchange();
    }
    H.click('キックオフ'); await sleep(10);
    const ko = H.logLines().find(l => l.includes('相手のエース：')) || '';
    const aceRef = (ko.split('相手のエース：')[1] || '').split('・')[0] + '）';
    if (marked) markLogOk = H.logLines().some(l => l.includes('マーク指示：' + markerName) && l.includes('重点マーク'));
    const done = await driveMatchToEnd(H);
    const lines = H.logLines();
    const ace = lines.filter(l => l.includes(aceRef)).length;
    const nonAce = lines.filter(l => NONACE.some(s => l.includes(s))).length;
    H.window.close();
    return { ace, nonAce, done, markLogOk };
  }
  {
    const N = 20;
    let aU = 0, nU = 0, aM = 0, nM = 0, allDone = true, markOk = true;
    for (let i = 0; i < N; i++) {
      const r = await countOppTries(5000 + i * 131, false);
      aU += r.ace; nU += r.nonAce; allDone = allDone && r.done;
    }
    for (let i = 0; i < N; i++) {
      const r = await countOppTries(9000 + i * 131, true);
      aM += r.ace; nM += r.nonAce; allDone = allDone && r.done; markOk = markOk && r.markLogOk === true;
    }
    check('mark: all statistical matches completed', allDone);
    check('mark: instruction announced at kickoff', markOk);
    check('mark: ace tries go down when marked', aM < aU, 'marked=' + aM + ' unmarked=' + aU + ' (' + N + ' matches each)');
    check('mark: other players tries go up when marked (trade-off)', nM > nU, 'marked=' + nM + ' unmarked=' + nU);
  }

  /* ---- 5. 交代パネルの警告表示：疲労／不調／ケガ明け。編成の控え一覧にも付く。
   *        出場した選手のケガ明けフラグは試合後に落ちる ---- */
  {
    const st = toMatchSave(base, 8); flat(st, 62);
    const S = st.players.slice(0, 15), B = st.players.slice(15, 18);
    st.lineup = S.map(p => p.id);
    S[0].justBack = true;
    S[1].fatigue = 85; S[1].form = -2;
    B[0].fatigue = 90;
    B[1].form = -1;
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 1630);
    await driveToPreMatch(H);
    /* 編成画面の控えボタンにも警告が付く */
    H.click('メンバー編成'); await sleep(10);
    const rows = [...H.document.querySelectorAll('table.squad tr')];
    rows[1].click(); await sleep(5);
    const benchBtns = [...H.document.querySelectorAll('.subbtn')];
    const bb0 = benchBtns.find(b => b.textContent.includes(B[0].name));
    const bb1 = benchBtns.find(b => b.textContent.includes(B[1].name));
    const bb2 = benchBtns.find(b => b.textContent.includes(B[2].name));
    check('warn: lineup bench shows fatigue warning', !!bb0 && bb0.textContent.includes('⚠') && bb0.textContent.includes('疲労'), bb0 ? bb0.textContent.slice(0, 60) : 'missing');
    check('warn: lineup bench shows form warning', !!bb1 && bb1.textContent.includes('⚠') && bb1.textContent.includes('不調'));
    check('warn: clean bench player has no warning', !!bb2 && !bb2.textContent.includes('⚠'));
    H.click('試合前に戻る'); await sleep(10);
    H.click('キックオフ'); await sleep(10);
    await advanceToScene(H);
    const outBtns = [...H.document.querySelectorAll('.subbtn')];
    const ob0 = outBtns.find(b => b.textContent.includes(S[0].name));
    const ob1 = outBtns.find(b => b.textContent.includes(S[1].name));
    check('warn: sub panel OUT shows just-back warning', !!ob0 && ob0.textContent.includes('⚠') && ob0.textContent.includes('ケガ明け'), ob0 ? ob0.textContent.slice(0, 60) : 'missing');
    check('warn: sub panel OUT shows fatigue+form warnings', !!ob1 && ob1.textContent.includes('疲労') && ob1.textContent.includes('不調'));
    ob0.click(); await sleep(3);
    const inBtns = [...H.document.querySelectorAll('.subbtn')];
    const ib0 = inBtns.find(b => b.textContent.includes(B[0].name));
    const ib2 = inBtns.find(b => b.textContent.includes(B[2].name));
    check('warn: sub panel IN shows fatigue warning', !!ib0 && ib0.textContent.includes('⚠') && ib0.textContent.includes('疲労'));
    check('warn: sub panel IN clean player has no warning', !!ib2 && !ib2.textContent.includes('⚠'));
    const done = await driveMatchToEnd(H);
    check('warn: match completes', done);
    const after = H.state().players.find(p => p.id === S[0].id);
    check('warn: justBack cleared after playing a match', after.justBack === false);
    H.window.close();
  }

  /* ---- 6. ソーク健全性：soak_balance.js（戦術変更は「変更しない」）で複数キャリアを流し、
   *        勝率が許容帯域に収まり、花園到達ペースが大きく崩れていないことを確認する ---- */
  {
    let out = '';
    try {
      out = execFileSync('node', [__dirname + '/soak_balance.js', '3', '5'], { encoding: 'utf8', timeout: 600000 });
    } catch (e) { out = (e.stdout || '') + ''; check('soak: soak_balance.js runs', false, e.message); }
    const wl = [...out.matchAll(/W\/L=(\d+)\/(\d+)/g)].map(m => [+m[1], +m[2]]);
    const W = wl.reduce((a, x) => a + x[0], 0), L = wl.reduce((a, x) => a + x[1], 0);
    const rate = W + L ? W / (W + L) : 0;
    check('soak: no stuck/bad career', !out.includes('BAD') && wl.length === 3, out.split('\n').filter(l => l.includes('BAD')).join(' ').slice(0, 120));
    /* 帯域の校正：soak ドライバは最善手＋強め練習で回すため、クリーンな単独実行条件では v0.15/v0.16 とも
     * 勝率 ≈0.78〜0.81 が実測値（12キャリア×10年×2シード帯の A/B 測定）。3キャリア×5年の小標本の
     * ばらつきを見込んで [0.60, 0.92] とし、勝率の崩壊（極端な難化／自動勝利化）だけを検出する */
    check('soak: win rate within sane band (0.60-0.92)', rate >= 0.60 && rate <= 0.92, 'rate=' + rate.toFixed(3) + ' W/L=' + W + '/' + L);
    check('soak: at least one career reaches Hanazono within 5 years', out.includes('reached Hanazono: ') && !out.includes('reached Hanazono: 0/3'), out.split('\n').slice(-3).join(' | '));
  }

  console.log(failures === 0 ? 'ALL PASS' : 'FAILURES: ' + failures);
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('ERROR', e.stack || e.message); process.exit(2); });
