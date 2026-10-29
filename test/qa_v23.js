/* QA v0.23: 音楽＋キャリアの厚み＋実機見切れ修正（差し込み）
 * - バージョン表記 v1.0（v0.25 で追随。結果アサーションは不変）
 * - 実機見切れ修正の構造: 成長レポートは行が .grlist（flex:1 / 内部スクロール）の中にあり、
 *   アクションバーはボードの外（重ならない）。週次ログは最低高さ 46px を CSS で保証。
 *   ガラス（glassfill）は内部スクロールで受ける
 * - BGM: 設定は別キー hanazono.bgm（JSON）に保存し、hanazono.sound（'0'/'1'）は壊さない。
 *   タイトルに BGM ON/OFF と音量（小/中/大）。__hzBgm の want は画面で切り替わる。
 *   BGM の有無でゲームの乱数列（セーブ結果）は変わらない
 * - OBイベント: OB がいる時だけ名前＋進路つきのイベントが出る（材料なしでは出ない）
 * - 部の格の節目: gradeSeen で一度だけ祝福し、旧セーブは現在の格を到達済みとして移行する
 * - 連覇記録: career.titleStreak / bestTitleStreak を seasonHist から復元（移行）し、
 *   記録室の長期目標と OB ネットワーク、サマリーの連覇表示に使う
 * - 場面イラスト: winter 等の未生成ファイルへの参照を作らない（PHOTO_SCENES は実在分のみ）
 * - v0.22 セーブ（baseline の実物）で読み込み・移行できる
 * 実行: node test/qa_v23.js （jsdom で v02/play.html を読み込む） */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const html = fs.readFileSync(path.join(__dirname, '..', 'v02', 'play.html'), 'utf8');
const baselineHtml = fs.readFileSync(path.join(__dirname, '..', 'review_v23', 'play_v22_baseline.html'), 'utf8');
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
function loadHtml(htmlStr, presetSave, seed, extraKeys) {
  const dom = new JSDOM(htmlStr, {
    url: 'https://localhost/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window) {
      if (seed != null) window.Math.random = mulberry32(seed);
      if (presetSave) window.localStorage.setItem('hanazono.v02', typeof presetSave === 'string' ? presetSave : JSON.stringify(presetSave));
      if (extraKeys) Object.keys(extraKeys).forEach(k => {
        if (extraKeys[k] == null) window.localStorage.removeItem(k);
        else window.localStorage.setItem(k, extraKeys[k]);
      });
    }
  });
  const { window } = dom;
  window.confirm = () => true;
  return {
    window, document: window.document,
    text: () => window.document.getElementById('app').textContent.replace(/\s+/g, ' '),
    btn: (s) => [...window.document.querySelectorAll('button')].find(b => b.textContent.includes(s)),
    click: function (s) { const b = this.btn(s); if (!b) throw new Error('button not found: ' + s); b.click(); },
    state: () => JSON.parse(window.localStorage.getItem('hanazono.v02')),
    save: () => window.localStorage.getItem('hanazono.v02'),
    ls: (k) => window.localStorage.getItem(k)
  };
}
function load(presetSave, seed, extraKeys) { return loadHtml(html, presetSave, seed, extraKeys); }
async function baseSave(seed) {
  const H = load(null, seed);
  await sleep(15);
  H.click('監督に就任する（ふつう）');
  await sleep(10);
  const st = H.state();
  H.window.close();
  return st;
}
function weeklyState(st) {
  st.monthIdx = 0; st.goalSet = true; st.summary = null; st.recruit = null; st.intro = null; st.growReport = null;
  st.board = { weekly: true, week: 0, log: [], dlg: null, picks: [] };
  return st;
}

(async () => {
  /* ===== 1. バージョン ===== */
  check('version: <title> is v1.0', html.includes('<title>Road to HANAZONO v1.0</title>'));
  {
    const H = load(null, 1);
    await sleep(15);
    check('version: title screen shows v1.0', H.text().includes('v1.0'));
    H.window.close();
  }

  /* ===== 2. 実機見切れ修正の構造（成長レポート） ===== */
  {
    const st = await baseSave(777);
    st.monthIdx = 1; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null; st.intro = null;
    const rows = [];
    for (let i = 0; i < 12; i++) {
      const p = st.players[i % st.players.length];
      rows.push({ name: p.name, stats: { pow: 3, spd: 2, pas: 1, kik: 2, tak: 1, sta: 2 }, trust: i % 3, total: 13, focus: i === 0 });
    }
    st.growReport = { label: '4月', rows };
    const H = load(JSON.stringify(st), 5);
    await sleep(15);
    const board = H.document.querySelector('.grboard.grfull');
    check('layout: report board exists', !!board);
    const list = H.document.querySelector('.grboard.grfull .grlist');
    check('layout: rows live in .grlist (flex scroll container)', !!list);
    if (list) check('layout: all 10 rows are inside .grlist', list.querySelectorAll('.grrow').length === 10 && board.querySelectorAll('.grrow').length === 10);
    const ab = H.document.querySelector('.actionbar');
    check('layout: action bar is outside the board (cannot be overlapped by rows)', !!ab && !board.contains(ab));
    H.window.close();
    check('layout(css): .grlist is flex:1 with internal scroll', html.includes('.grfull .grlist { flex: 1; min-height: 0; overflow-y: auto; }'));
    check('layout(css): weekly log has guaranteed min-height 46px', html.includes('.wtop .log { min-height: 46px; }'));
    check('layout(css): glassfill scrolls internally', /\.glasscard\.glassfill \{[^}]*overflow-y: auto/.test(html));
    check('layout(css): title card uses flex gap (no margin pile-up)', html.includes('.titlewrap .title-card { display: flex; flex-direction: column; gap: 8px; }'));
  }

  /* ===== 3. BGM の設定と保存 ===== */
  check('bgm: separate settings key exists in source', html.includes("var BGM_KEY = 'hanazono.bgm';"));
  check('bgm: 4 tracks defined', html.includes('BGM_TRACKS') && html.includes("title: { bpm:") && html.includes("daily: { bpm:") && html.includes("match: { bpm:") && html.includes("big: { bpm:"));
  {
    const H = load(null, 11);
    await sleep(15);
    check('bgm: title shows BGM ON by default', !!H.btn('🎵 BGM ON'));
    check('bgm: volume buttons present (小/中/大)', !!H.btn('音量小') && !!H.btn('音量中') && !!H.btn('音量大'));
    check('bgm: default volume is 中 (primary)', H.btn('音量中').classList.contains('primary'));
    check('bgm: __hzBgm exposed, want=title on title screen', typeof H.window.__hzBgm === 'function' && H.window.__hzBgm().want === 'title');
    H.click('🎵 BGM ON'); await sleep(10);
    const saved = JSON.parse(H.ls('hanazono.bgm') || 'null');
    check('bgm: toggling OFF persists {on:0} to hanazono.bgm', !!saved && saved.on === 0, H.ls('hanazono.bgm'));
    check('bgm: hanazono.sound untouched by BGM toggle', H.ls('hanazono.sound') === null);
    check('bgm: label flips to OFF', !!H.btn('🎵 BGM OFF'));
    H.click('音量大'); await sleep(10);
    const saved2 = JSON.parse(H.ls('hanazono.bgm') || 'null');
    check('bgm: volume 大 persists v=1 and keeps on=0', !!saved2 && saved2.v === 1 && saved2.on === 0, H.ls('hanazono.bgm'));
    H.window.close();
  }
  {
    /* 既存設定の後方互換: hanazono.sound='0' と hanazono.bgm のプリセットが共存して読める */
    const H = load(null, 12, { 'hanazono.sound': '0', 'hanazono.bgm': '{"on":0,"v":0.35}' });
    await sleep(15);
    check('bgm: preset OFF is honored', !!H.btn('🎵 BGM OFF'));
    check('bgm: preset volume 小 is honored (primary)', H.btn('音量小').classList.contains('primary'));
    check('sfx: preset sound 0 still means OFF', !!H.btn('サウンド OFF'));
    H.click('サウンド OFF'); await sleep(10);
    check('sfx: toggling sound writes 1 to hanazono.sound (legacy format kept)', H.ls('hanazono.sound') === '1');
    check('bgm: sound toggle does not touch hanazono.bgm', H.ls('hanazono.bgm') === '{"on":0,"v":0.35}');
    H.window.close();
  }
  {
    /* BGM の有無で乱数列（＝セーブ結果）が変わらないこと */
    const drive = async (extraKeys) => {
      const st = weeklyState(await baseSave(4242));
      const H = load(JSON.stringify(st), 99, extraKeys);
      await sleep(15);
      for (let i = 0; i < 4; i++) { const c = H.document.querySelector('.wcard'); if (c) c.click(); await sleep(6); }
      const sv = H.save(); H.window.close();
      return sv;
    };
    const a = await drive(null);
    const b = await drive({ 'hanazono.bgm': '{"on":0,"v":0.35}' });
    check('bgm: identical save outcome with BGM on/off (no RNG consumption)', a === b);
  }
  {
    /* 画面ごとの系統解決（日常） */
    const st = weeklyState(await baseSave(3131));
    const H = load(JSON.stringify(st), 3);
    await sleep(15);
    check('bgm: want=daily on weekly screen', H.window.__hzBgm().want === 'daily', JSON.stringify(H.window.__hzBgm()));
    H.window.close();
  }

  /* ===== 4. OB イベント ===== */
  {
    const namedRe = /OBの .+さん|🤝 OB会/;
    let hitTrials = 0, badLine = 0, trials = 60;
    for (let t = 0; t < trials; t++) {
      const st = weeklyState(await baseSave(1000 + t));
      st.obs = [
        { name: '高橋 健', pos: 'PR', avg: 62, year: 1, tries: 2, plays: 5, path: '大学でラグビー継続' },
        { name: '伊藤 翔', pos: 'SO', avg: 66, year: 1, tries: 1, plays: 8, path: '実業団へ就職' },
        { name: '渡辺 蓮', pos: 'WTB', avg: 60, year: 2, tries: 4, plays: 3, path: '大学進学（受験）' }
      ];
      const H = load(JSON.stringify(st), 5000 + t);
      await sleep(8);
      let lines = [];
      for (let i = 0; i < 4; i++) {
        const c = H.document.querySelector('.wcard'); if (c) c.click(); await sleep(4);
        const s2 = H.state();
        if (s2.board && s2.board.log) lines = s2.board.log.slice();
        if (s2.monthLog) lines = lines.concat(s2.monthLog);
        if (s2.nextBonus > 6) badLine++; /* 準備ボーナスは上限（ビデオ室なし=6）を超えない */
      }
      if (lines.some(l => namedRe.test(l))) hitTrials++;
      if (lines.some(l => /NaN|undefined/.test(l))) badLine++;
      H.window.close();
    }
    check('ob-event: named OB events occur when OBs exist (' + hitTrials + '/' + trials + ' trials)', hitTrials >= 2);
    check('ob-event: effects stay within caps, no broken text', badLine === 0);
    /* 材料なし（OB 0人）では名前つき OB イベントは出ない */
    let hit0 = 0;
    for (let t = 0; t < 12; t++) {
      const st = weeklyState(await baseSave(2000 + t));
      st.obs = [];
      const H = load(JSON.stringify(st), 6000 + t);
      await sleep(8);
      let lines = [];
      for (let i = 0; i < 4; i++) {
        const c = H.document.querySelector('.wcard'); if (c) c.click(); await sleep(4);
        const s2 = H.state();
        if (s2.board && s2.board.log) lines = s2.board.log.slice();
        if (s2.monthLog) lines = lines.concat(s2.monthLog);
      }
      if (lines.some(l => namedRe.test(l))) hit0++;
      H.window.close();
    }
    check('ob-event: never fires without OBs (material gate, no RNG drawn)', hit0 === 0);
  }

  /* ===== 5. 部の格の節目 ===== */
  {
    const st = await baseSave(777);
    st.rep = 75; st.gradeSeen = 0; /* 中堅（70）に到達済みだが未祝福の状態を再現 */
    st.monthIdx = 0; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null; st.intro = null; st.growReport = null;
    const H = load(JSON.stringify(st), 21);
    await sleep(15);
    H.click('指示を確定'); await sleep(10);
    const s1 = H.state();
    check('grade: milestone logged once at month start', (s1.board.log || []).some(l => l.includes('部の格が「中堅」に上がった')), (s1.board.log || []).join(' / '));
    check('grade: gradeSeen advanced to 2', s1.gradeSeen === 2);
    check('grade: captain dialogue is set for the milestone', !!s1.board.dlg);
    const st2 = s1; st2.board = null; st2.monthIdx = 1;
    const H2 = load(JSON.stringify(st2), 22);
    await sleep(15);
    H2.click('指示を確定'); await sleep(10);
    const s2 = H2.state();
    check('grade: not celebrated twice', !(s2.board.log || []).some(l => l.includes('部の格が')));
    H.window.close(); H2.window.close();
  }
  {
    /* 移行: gradeSeen の無い旧セーブは現在の格を到達済みとして初期化され、遡って祝わない */
    const st = await baseSave(778);
    st.rep = 75; delete st.gradeSeen;
    st.monthIdx = 0; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null; st.intro = null; st.growReport = null;
    const H = load(JSON.stringify(st), 23);
    await sleep(15);
    check('grade: migration initializes gradeSeen to current grade', H.state().gradeSeen === 2, 'gradeSeen=' + H.state().gradeSeen);
    H.click('指示を確定'); await sleep(10);
    check('grade: no retroactive celebration after migration', !(H.state().board.log || []).some(l => l.includes('部の格が')));
    H.window.close();
  }

  /* ===== 6. 連覇記録の移行と表示 ===== */
  {
    const stA = await baseSave(779);
    stA.career.seasonHist = [
      { y: 1, result: '花園優勝', w: 5, l: 0, grade: '強豪', goal: '花園優勝', goalOk: true },
      { y: 2, result: '花園優勝', w: 5, l: 0, grade: '名門', goal: '花園優勝', goalOk: true },
      { y: 3, result: '花園決勝進出（準優勝）', w: 4, l: 1, grade: '名門', goal: '花園優勝', goalOk: false }
    ];
    delete stA.career.titleStreak; delete stA.career.bestTitleStreak;
    const HA = load(JSON.stringify(stA), 31);
    await sleep(15);
    check('streak: broken streak restores titleStreak=0 / best=2', HA.state().career.titleStreak === 0 && HA.state().career.bestTitleStreak === 2,
      JSON.stringify({ ts: HA.state().career.titleStreak, best: HA.state().career.bestTitleStreak }));
    HA.window.close();
    const stB = await baseSave(780);
    stB.career.seasonHist = [
      { y: 1, result: '予選敗退', w: 1, l: 2, grade: '弱小', goal: '予選でまず1勝', goalOk: false },
      { y: 2, result: '花園優勝', w: 5, l: 0, grade: '強豪', goal: '花園優勝', goalOk: true },
      { y: 3, result: '花園優勝', w: 5, l: 0, grade: '名門', goal: '花園優勝', goalOk: true }
    ];
    delete stB.career.titleStreak; delete stB.career.bestTitleStreak;
    const HB = load(JSON.stringify(stB), 32);
    await sleep(15);
    check('streak: active streak restores titleStreak=2 / best=2', HB.state().career.titleStreak === 2 && HB.state().career.bestTitleStreak === 2);
    HB.window.close();
  }
  {
    /* 記録室: 長期目標と OB ネットワーク */
    const st = await baseSave(781);
    st.goalSet = true; st.board = null; st.summary = null; st.recruit = null; st.intro = null; st.growReport = null;
    st.career.hanaTitles = 3; st.career.titleStreak = 2; st.career.bestTitleStreak = 2;
    st.obs = [
      { name: '高橋 健', pos: 'PR', avg: 62, year: 1, tries: 2, plays: 5, path: '大学でラグビー継続' },
      { name: '伊藤 翔', pos: 'SO', avg: 66, year: 1, tries: 1, plays: 8, path: '大学でラグビー継続' },
      { name: '渡辺 蓮', pos: 'WTB', avg: 60, year: 2, tries: 4, plays: 3, path: '実業団へ就職' }
    ];
    const H = load(JSON.stringify(st), 33);
    await sleep(15);
    const rb = [...H.document.querySelectorAll('.hudbtn')].find(b => b.textContent.includes('記録'));
    if (rb) { rb.click(); await sleep(10); }
    const t = H.text();
    check('records: long-term goals section present', t.includes('🎯 長期目標'));
    check('records: best streak shown', t.includes('歴代最長 2連覇') && t.includes('現在 2連覇中'));
    check('records: next milestone shown', t.includes('花園3連覇まで あと1回'));
    check('records: OB network section present', t.includes('🤝 OBネットワーク') && t.includes('OB総数'));
    check('records: OB path breakdown counted', t.includes('大学でラグビー継続') && t.includes('2人') && t.includes('実業団へ就職') && t.includes('1人'));
    H.window.close();
  }
  {
    /* サマリー: 連覇中は行が出る */
    const st = await baseSave(782);
    st.board = null; st.recruit = null; st.intro = null; st.growReport = null;
    st.career.hana = 3; st.career.hanaTitles = 2;
    st.summary = { result: '🏆 花園優勝！', wins: 5, losses: 0, goalEval: null, grade: '名門', grads: [], stars: [], firstHana: false, titleStreak: 2 };
    const H = load(JSON.stringify(st), 34);
    await sleep(15);
    check('summary: title streak row shown at 2+', H.text().includes('2連覇中'));
    H.window.close();
  }

  /* ===== 7. 場面イラストの受け口（未生成ファイルへの参照なし） ===== */
  check('photo: registry holds only existing scenes', html.includes('PHOTO_SCENES = { camp: 1, champion: 1, graduation: 1, rain: 1 }'));
  check('photo: no reference to ungenerated winter/practice/clubroom photos', !html.includes('photo-winter') && !html.includes('scene-winter') && !html.includes('scene-practice') && !html.includes('scene-clubroom'));

  /* ===== 8. v0.22 実セーブの移行 ===== */
  {
    const HB = loadHtml(baselineHtml, null, 777);
    await sleep(15);
    HB.click('監督に就任する（ふつう）'); await sleep(10);
    const v22save = HB.save();
    HB.window.close();
    const H = load(v22save, 41);
    await sleep(15);
    const st = H.state();
    check('migration: v0.22 save loads in v1.0', !!st && Array.isArray(st.players) && st.players.length > 0);
    check('migration: gradeSeen initialized', st.gradeSeen === 0, 'gradeSeen=' + st.gradeSeen);
    check('migration: titleStreak initialized', st.career.titleStreak === 0 && st.career.bestTitleStreak === 0);
    H.window.close();
  }

  console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
