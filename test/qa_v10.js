/* QA for v0.10: 効果音（設定の保存・Fake AudioContext・無音環境の安全性）／
 * 実績（判定・保存・バックフィル・トースト）／遊び方ガイド／再開時あらすじ／
 * ジャージ紺色の検証／複数シーズンソーク。 */
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
function scanBadNumbers(obj, path, bad) {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'number') { if (!isFinite(obj)) bad.push(path); return; }
  if (Array.isArray(obj)) { obj.forEach((v, i) => scanBadNumbers(v, path + '[' + i + ']', bad)); return; }
  if (typeof obj === 'object') Object.keys(obj).forEach(k => scanBadNumbers(obj[k], path + '.' + k, bad));
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

/* ドライバの1アクションだけ実行する（トースト等の即時検出用）。何かしたら true */
async function stepOnce(H) {
  const t = H.text();
  if (H.btn('キックオフ')) { H.click('キックオフ'); await sleep(3); return true; }
  if (H.btn('目標を決めて')) { H.click('目標を決めて'); await sleep(30); return true; }
  if (H.btn('確認した')) { H.click('確認した'); await sleep(5); return true; } /* v0.22 追随: 成長レポートが専用レイアウト表示になり、確認後に指示フォームが出るため、駆動に確認ステップを追加（検証内容は不変） */
  if (H.btn('指示を確定')) { H.click('指示を確定'); await sleep(3); return true; }
  const pc = H.document.querySelector('.pcard');
  if (pc) { pc.click(); await sleep(2); return true; }
  if (H.btn('結果のみ表示')) { H.click('結果のみ表示'); await sleep(3); return true; }
  const opts = [...H.document.querySelectorAll('.choices .btn.choice')];
  if (opts.length && t.includes('成功率の目安')) {
    let best = opts[0], bp = -1;
    opts.forEach(o => { const mm = (o.dataset.p ? [0, o.dataset.p] : o.textContent.match(/(\d+)%/)); const p = mm ? +mm[1] : 0; if (p > bp) { bp = p; best = o; } });
    best.click(); await sleep(2); return true;
  }
  if (H.btn('試合を進める')) { H.click('試合を進める'); await sleep(2); return true; }
  if (H.btn('次へ')) { H.click('次へ'); await sleep(3); return true; }
  return false;
}

/* 1シーズン分を汎用ドライバで進める（goal→inst→盤面→試合→summary まで）。到達したら true */
async function driveToSummary(H, maxSteps) {
  let guard = 0;
  while (guard++ < (maxSteps || 8000)) {
    const t = H.text();
    if (t.includes('シーズン終了') || H.btn('新年度へ')) return true;
    if (H.btn('キックオフ')) { H.click('キックオフ'); await sleep(3); continue; }
    if (H.btn('目標を決めて')) { H.click('目標を決めて'); await sleep(60); continue; }
    if (H.btn('確認した')) { H.click('確認した'); await sleep(5); continue; } /* v0.22 追随: 成長レポートが専用レイアウト表示になり、確認後に指示フォームが出るため、駆動に確認ステップを追加（検証内容は不変） */
    if (H.btn('指示を確定')) { H.click('指示を確定'); await sleep(3); continue; }
    const pc = H.document.querySelector('.pcard');
    if (pc) { pc.click(); await sleep(2); continue; }
    if (H.btn('結果のみ表示')) { H.click('結果のみ表示'); await sleep(3); continue; }
    const opts = [...H.document.querySelectorAll('.choices .btn.choice')];
    if (opts.length && t.includes('成功率の目安')) {
      let best = opts[0], bp = -1;
      opts.forEach(o => { const mm = (o.dataset.p ? [0, o.dataset.p] : o.textContent.match(/(\d+)%/)); const p = mm ? +mm[1] : 0; if (p > bp) { bp = p; best = o; } });
      best.click(); await sleep(2); continue;
    }
    if (H.btn('試合を進める')) { H.click('試合を進める'); await sleep(2); continue; }
    if (H.btn('次へ')) { H.click('次へ'); await sleep(3); continue; }
    throw new Error('driver stuck: ' + t.slice(0, 200));
  }
  return false;
}

(async () => {
  /* ---- 1. タイトル：バージョン／ガイド／サウンドトグルと保存 ---- */
  {
    const H = await makeDom(null, 111);
    check('env: jsdom has no AudioContext (no-sound safety env)', typeof H.window.AudioContext === 'undefined');
    check('title: shows current version (v1.3; v0.25 でバージョン表記を追随)', H.text().includes('v1.3')); /* v0.26: バージョン表記を v1.1 に追随 */ /* v0.27: バージョン表記を v1.2 に追随 */ /* v0.28: バージョン表記を v1.3 に追随 */
    check('title: no digest without a save', H.document.getElementById('digest') === null);
    check('title: guide button exists', !!H.btn('遊び方'));
    H.click('遊び方'); await sleep(15);
    const gt = H.text();
    check('guide: shows 目的/1年の流れ/画面の見方/コツ',
      gt.includes('目的') && gt.includes('1年の流れ') && gt.includes('画面の見方') && gt.includes('監督のコツ'));
    /* v0.19 追随: ガイドの手順③は「すごろく進行」から「週次プランニング」に差し替わった（文言の検証先を追随） */
    check('guide: shows flow steps and tips', gt.includes('週次プランニング') && gt.includes('疲労管理') && gt.includes('スカウト'));
    /* v0.19 追随: 週次画面では操作が下段にもあるため、ガイド文言が「右と下段＝操作」に変わった */
    check('guide: explains left=info right=controls', gt.includes('左＝情報') && gt.includes('＝操作'));
    H.click('タイトルへ戻る'); await sleep(15);
    check('guide: back returns to title', H.text().includes('監督に就任'));
    /* サウンドトグル：初期ON → OFF で別キーに保存される */
    check('sound: default ON label', !!H.btn('サウンド ON'));
    H.click('サウンド ON'); await sleep(15);
    check('sound: OFF persisted to separate key', H.window.localStorage.getItem('hanazono.sound') === '0',
      'val=' + H.window.localStorage.getItem('hanazono.sound'));
    check('sound: game save untouched by toggle', H.window.localStorage.getItem('hanazono.v02') === null);
    check('sound: label flips to OFF', !!H.btn('サウンド OFF'));
    H.window.close();
  }
  {
    /* 保存済み OFF 設定で起動すると OFF 表示になる */
    const H = await makeDom({ 'hanazono.sound': '0' }, 112);
    check('sound: persisted OFF restored at boot', !!H.btn('サウンド OFF'));
    H.click('サウンド OFF'); await sleep(15);
    check('sound: toggling back ON persists 1', H.window.localStorage.getItem('hanazono.sound') === '1');
    H.window.close();
  }

  /* ---- 2. Fake AudioContext：音が実際に生成され、OFF では止まる ---- */
  {
    const H = await makeDom(null, 222);
    const stats = { instances: 0, oscStarts: 0, noiseStarts: 0, resumes: 0 };
    function FakeAC() {
      stats.instances++;
      this.currentTime = 0; this.state = 'suspended'; this.sampleRate = 44100; this.destination = {};
    }
    FakeAC.prototype.resume = function () { stats.resumes++; this.state = 'running'; return Promise.resolve(); };
    FakeAC.prototype.createOscillator = function () {
      return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {}, start() { stats.oscStarts++; }, stop() {} };
    };
    FakeAC.prototype.createGain = function () {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
    };
    FakeAC.prototype.createBuffer = function (ch, len) { return { getChannelData: () => new Float32Array(len) }; };
    FakeAC.prototype.createBufferSource = function () {
      return { buffer: null, connect() {}, start() { stats.noiseStarts++; }, stop() {} };
    };
    FakeAC.prototype.createBiquadFilter = function () { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }; };
    H.window.AudioContext = FakeAC;
    H.click('監督に就任する（ふつう）'); await sleep(20);
    check('audio: context created lazily on first gesture', stats.instances >= 1, 'instances=' + stats.instances);
    check('audio: tap produced oscillator(s)', stats.oscStarts >= 1, 'osc=' + stats.oscStarts);
    check('audio: suspended context resumed inside gesture', stats.resumes >= 1, 'resumes=' + stats.resumes);
    /* HUD のトグルで OFF → 以後のタップは無音 */
    H.click('音ON'); await sleep(15);
    check('audio: HUD toggle persisted OFF', H.window.localStorage.getItem('hanazono.sound') === '0');
    const before = stats.oscStarts;
    H.click('選手一覧'); await sleep(15);
    check('audio: no new oscillators while OFF', stats.oscStarts === before, 'osc=' + stats.oscStarts + ' before=' + before);
    H.click('音OFF'); await sleep(15);
    check('audio: sound resumes after toggling back ON', stats.oscStarts > before, 'osc=' + stats.oscStarts);
    H.window.close();
  }

  /* ---- 3. 既存セーブ：実績バックフィル＋あらすじ＋記録室の実績一覧＋紺ジャージ ---- */
  let baseSave;
  {
    const H = await makeDom(null, 333);
    H.click('監督に就任する（ふつう）'); await sleep(20);
    baseSave = H.window.localStorage.getItem('hanazono.v02');
    H.window.close();
  }
  {
    const st = JSON.parse(baseSave);
    st.career.hana = 2; st.career.hanaWins = 1; st.career.hanaTitles = 0;
    delete st.career.achv; delete st.career.wins; delete st.career.maxBest; /* v0.9以前のセーブを再現 */
    st.rep = 170; /* 名門 */
    st.obs = []; for (let i = 0; i < 12; i++) st.obs.push({ name: 'OB' + i, pos: 'PR', avg: 70, year: 1, tries: 0, plays: 0 });
    st.history = [{ year: 1, power: 50, result: '予選決勝敗退' }, { year: 2, power: 61, result: '花園出場（初戦敗退）' }];
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 444);
    /* あらすじ：再開時のみ表示され、閉じられる */
    const dg = H.document.getElementById('digest');
    check('digest: shown on resume', !!dg);
    check('digest: mentions year/grade/month plan', !!dg && dg.textContent.includes('あらすじ') && dg.textContent.includes('名門') && dg.textContent.includes('今月の予定'),
      dg ? dg.textContent.replace(/\s+/g, ' ').slice(0, 120) : 'none');
    check('digest: no achievement toast at boot (silent backfill)', H.document.querySelectorAll('.toast').length === 0);
    const after = H.state();
    check('backfill: maxBest restored from history (=3)', after.career.maxBest === 3, 'maxBest=' + after.career.maxBest);
    check('backfill: hana1/hanawin/ob10/grade5/qual achieved',
      !!(after.career.achv.hana1 && after.career.achv.hanawin && after.career.achv.ob10 && after.career.achv.grade5 && after.career.achv.qual),
      JSON.stringify(after.career.achv));
    check('backfill: hanatitle/wins10/firstwin NOT achieved',
      !after.career.achv.hanatitle && !after.career.achv.wins10 && !after.career.achv.firstwin);
    H.click('グラウンドへ戻る'); await sleep(10);
    check('digest: closes and stays closed', H.document.getElementById('digest') === null);
    /* 記録室の実績一覧 */
    H.click('記録・OB'); await sleep(15);
    check('records: achievements section present', H.text().includes('実績（トロフィー）'));
    const rows = [...H.document.querySelectorAll('.achv')];
    check('records: 13 achievement rows', rows.length === 13, 'rows=' + rows.length);
    const rowOf = (name) => rows.find(r => r.textContent.includes(name));
    check('records: achieved row is colored (got class)', !!rowOf('花園初出場') && rowOf('花園初出場').classList.contains('got'));
    check('records: locked row shows condition only', !!rowOf('花園優勝') && !rowOf('花園優勝').classList.contains('got') && rowOf('花園優勝').textContent.includes('花園で優勝する'));
    check('records: achieved count text', H.text().includes('達成 5 / 13'), H.text().match(/達成 \d+ \/ 13/)?.[0] || 'not found');
    /* 紺ジャージ：選手詳細の立ち絵 */
    H.click('選手一覧'); await sleep(15);
    const prow = H.document.querySelector('tr.prow');
    if (prow) { prow.click(); await sleep(15); }
    const svg = H.document.querySelector('.portrait svg');
    check('jersey: portrait rendered', !!svg);
    check('jersey: Sakuragaoka jersey body is navy (#1b2a52)', !!svg && svg.innerHTML.includes('#1b2a52'));
    check('jersey: old green (#166534) not used in portrait', !!svg && !svg.innerHTML.includes('#166534'));
    H.window.close();
  }

  /* ---- 4. プレイ中の実績解除：通算10勝でトーストが出て保存される ---- */
  {
    const st = JSON.parse(baseSave);
    st.career.wins = 9; /* あと1勝で通算10勝 */
    Object.keys(st.career.achv || {}).forEach(k => delete st.career.achv[k]);
    st.players.forEach(p => { Object.keys(p.stats).forEach(k => { p.stats[k] = 78; }); }); /* 練習試合を確実に勝てる強さに */
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 4242);
    const boot = H.state();
    check('unlock: firstwin backfilled silently (wins=9)', boot.career.achv.firstwin === 1 && !boot.career.achv.wins10);
    check('unlock: no toast at boot', H.document.querySelectorAll('.toast').length === 0);
    if (H.document.getElementById('digest')) { H.click('グラウンドへ戻る'); await sleep(10); }
    /* 最初の試合（6月・練習試合）まで1アクションずつ進め、勝った瞬間を捉える */
    let won = false, guard = 0;
    while (guard++ < 3000 && !won) {
      const before = H.state().career.wins;
      const moved = await stepOnce(H);
      if (!moved) break;
      if (H.state().career.wins > before) won = true;
      if (H.text().includes('シーズン終了')) break;
    }
    check('unlock: a match was won in play', won);
    const stNow = H.state();
    check('unlock: career.wins incremented to 10', stNow.career.wins === 10, 'wins=' + stNow.career.wins);
    check('unlock: wins10 achievement recorded with year', stNow.career.achv.wins10 === stNow.year, 'achv=' + JSON.stringify(stNow.career.achv));
    const toast = [...H.document.querySelectorAll('.toast')].find(t => t.textContent.includes('通算10勝'));
    check('unlock: toast shown for 通算10勝', !!toast, [...H.document.querySelectorAll('.toast')].map(t => t.textContent).join(' / '));
    H.window.close();
  }

  /* ---- 5. 複数シーズンソーク（AudioContext 無し環境で例外なく回る） ---- */
  {
    const H = await makeDom(null, 20261029);
    check('soak: no digest on new game', H.document.getElementById('digest') === null);
    H.click('監督に就任する（ふつう）'); await sleep(20);
    check('soak: still no digest after starting new game', H.document.getElementById('digest') === null);
    let seasons = 0, totalWins = 0, guard = 0;
    while (guard++ < 40000 && seasons < 2) {
      const t = H.text();
      if (t.includes('NaN') || t.includes('undefined')) { check('soak: no NaN/undefined text', false, t.slice(0, 160)); break; }
      if (H.btn('新年度へ')) {
        totalWins += H.state().season.wins;
        const bad = []; scanBadNumbers(H.state(), 'G', bad);
        check('soak: season ' + (seasons + 1) + ' state has no non-finite numbers', bad.length === 0, bad.slice(0, 3).join(','));
        H.click('新年度へ'); seasons++; await sleep(10); continue;
      }
      if (H.btn('新年度を始める')) {
        const tog = H.btn('獲得リストに入れる'); if (tog) { tog.click(); await sleep(4); }
        H.click('新年度を始める'); await sleep(10); continue;
      }
      const progressed = await driveToSummary(H, 1500).then(() => true).catch(() => false);
      if (!progressed) { check('soak: driver progressed', false, H.text().slice(0, 160)); break; }
    }
    check('soak: two seasons completed without exception', seasons >= 2, 'seasons=' + seasons);
    const fin = H.state();
    check('soak: career.wins matches summed season wins', fin.career.wins === totalWins, 'career=' + fin.career.wins + ' summed=' + totalWins);
    if (totalWins > 0) check('soak: firstwin achievement unlocked during play', !!fin.career.achv.firstwin);
    check('soak: career.achv is an object in save', !!fin.career.achv && typeof fin.career.achv === 'object');
    check('soak: sound key kept separate from game save', H.window.localStorage.getItem('hanazono.sound') === null || ['0', '1'].includes(H.window.localStorage.getItem('hanazono.sound')));
    H.window.close();
  }

  console.log(failures ? '\n*** ' + failures + ' FAILURES ***' : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
