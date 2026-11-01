/* QA for v0.17: 横画面レイアウト再整理（HUD 1行化／固定アクションバー／月頭指示のヒーローパネル／
 * 選手データの master-detail＋タブ／対戦確認のはみ出し解消）。対象は play.html（jsdom）。
 * レイアウトの実寸計測（はみ出し・衝突）は jsdom では測れないため review_v17/shoot.js（Chromium 1060×600）が担い、
 * ここでは DOM 構造と「内容が欠けていないこと」「セーブ互換」を検証する。
 * ゲームロジック・数値には一切触れていないことの回帰は qa_v02〜v16 の全パスで担保する。 */
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

(async () => {
  /* ---- 0. 静的チェック ---- */
  check('static: title is v1.3', html.includes('<title>Road to HANAZONO v1.3</title>')) /* v0.25: バージョン表記を追随 */; /* v0.26: バージョン表記を v1.1 に追随 */ /* v0.27: バージョン表記を v1.2 に追随 */ /* v0.28: バージョン表記を v1.3 に追随 */
  check('static: STORE_KEY unchanged', html.includes("STORE_KEY = 'hanazono.v02'"));
  check('static: play.html size <= 3.5MB', Buffer.byteLength(html, 'utf8') <= 3500000, /* v0.26: 場面イラスト3枚（data URI 約1MB）の追加に伴い上限を 3.5MB に見直し */ 'bytes=' + Buffer.byteLength(html, 'utf8'));
  ['.actionbar', '.heropanel', '.herobg', '.glasscard', '.hudbtn', '.hud .chip', '.tabbtn', '.tabhide', '.laysquad', '.pmb'].forEach(s => {
    check('static: play.html contains ' + s, html.includes(s));
  });
  const uriCount = (html.match(/data:image\/jpeg;base64,\/9j\//g) || []).length;
  check('static: photo data URIs = 5 originals + 3 added in v0.26', uriCount === 8, 'count=' + uriCount); /* v0.26 追随: 冬・練習場・部室の3枚を追加（既存5枚の不変は qa_v26 と review_v26 で確認） */

  const base = await freshSave(777);

  /* ---- 1. HUD：チップ＋右端ピル＋アイコンボタン ---- */
  {
    const H = await makeDom({ 'hanazono.v02': base }, 11);
    const hud = H.document.querySelector('.hud');
    check('hud: rendered once', !!hud && H.document.querySelectorAll('.hud').length === 1);
    if (hud) {
      const chips = hud.querySelectorAll('.chip');
      check('hud: 4 chips (年月・部の格・総合力・評判)', chips.length === 4, 'chips=' + chips.length);
      const chipText = [...chips].map(c => c.textContent).join(' ');
      check('hud: chips carry grade/power/rep values', chipText.includes('部の格') && chipText.includes('総合力') && chipText.includes('評判'));
      const squadBtn = [...hud.querySelectorAll('button')].find(b => b.textContent.includes('選手一覧'));
      const recBtn = [...hud.querySelectorAll('button')].find(b => b.textContent.includes('記録・OB'));
      check('hud: squad/records are pill buttons', !!squadBtn && squadBtn.classList.contains('hudbtn') && !!recBtn && recBtn.classList.contains('hudbtn'));
      const guideBtn = [...hud.querySelectorAll('button')].find(b => b.getAttribute('title') === '遊び方');
      check('hud: guide is an icon button', !!guideBtn && guideBtn.textContent.trim() === '📖', guideBtn ? JSON.stringify(guideBtn.textContent) : 'none');
      const sndBtn = [...hud.querySelectorAll('button')].find(b => b.textContent.includes('音ON') || b.textContent.includes('音OFF'));
      check('hud: sound toggle keeps short label', !!sndBtn && sndBtn.classList.contains('hudbtn'));
      /* アイコンの遊び方ボタンからガイドへ遷移できる */
      guideBtn.click(); await sleep(15);
      check('hud: guide button opens guide', H.text().includes('遊び方 ― Road to HANAZONO'));
    }
    H.window.close();
  }

  /* ---- 2. 月頭指示：ヒーローパネル＋アクションバー ---- */
  {
    const st = JSON.parse(base);
    st.goalSet = true; st.monthLog = ['🌸 スカウト成功！ テスト 太郎（SO）が入部を決めた'];
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 12);
    const hero = H.document.querySelector('.heropanel');
    check('inst: hero panel rendered', !!hero);
    if (hero) {
      check('inst: banner is the panel background layer', !!hero.querySelector('.herobg'));
      const glass = hero.querySelectorAll('.glasscard');
      /* v0.22 追随: スリム化で要約と最近の出来事を1枚のグラスに統合した（ユーザーの「枠だらけで面積が減る」指摘）。
       * 2枚→1枚は意図した構造変更であり、両コンテンツが保持されていることは直後のチェックで検証する */
      check('inst: glass cards overlay the banner (info + log)', glass.length === 1, 'n=' + glass.length);
      const t = hero.textContent.replace(/\s+/g, ' ');
      check('inst: goal/facilities/log content retained', t.includes('今年の目標') && t.includes('設備') && t.includes('最近の出来事') && t.includes('スカウト成功'));
      const glab = hero.querySelector('.glab');
      check('inst: labels use non-wrapping glab spans', !!glab);
    }
    const bar = H.document.querySelector('.actionbar');
    const confirmBtn = bar ? [...bar.querySelectorAll('button')].find(b => b.textContent.includes('指示を確定して月を始める')) : null;
    check('inst: confirm button lives in the bottom action bar', !!confirmBtn && confirmBtn.classList.contains('primary'));
    const formCard = [...H.document.querySelectorAll('.card')].find(c => c.textContent.includes('の練習指示'));
    check('inst: form card no longer contains the confirm button', !!formCard && ![...formCard.querySelectorAll('button')].some(b => b.textContent.includes('指示を確定')));
    /* v0.27 追随: 6項目は「ボタン列4（方針・ユニット・強度・校風）＋セレクト2（重点・キャプテン）」になった */
    const selects = formCard ? formCard.querySelectorAll('select') : [];
    const segs = formCard ? formCard.querySelectorAll('.seg[data-k]') : [];
    check('inst: all 6 instruction fields retained (4 button rows + 2 selects)', segs.length === 4 && selects.length === 2, 'segs=' + segs.length + ' selects=' + selects.length);
    H.window.close();
  }

  /* ---- 3. 目標画面：決定ボタンはアクションバー ---- */
  {
    const H = await makeDom({ 'hanazono.v02': base }, 13);
    const bar = H.document.querySelector('.actionbar');
    check('goal: decide button in action bar', !!bar && [...bar.querySelectorAll('button')].some(b => b.textContent.includes('目標を決めてシーズンを始める')));
    H.window.close();
  }

  /* ---- 4. 選手データ：master-detail＋タブ、全項目が欠けていない ---- */
  {
    const H = await makeDom({ 'hanazono.v02': base }, 14);
    H.click('選手一覧'); await sleep(15);
    const lay = H.document.querySelector('.laysquad');
    check('squad: master-detail grid (laysquad)', !!lay);
    const list = H.document.querySelector('.squadlist');
    check('squad: list panel keeps the full table', !!list && !!list.querySelector('table.squad') && list.querySelectorAll('tr.prow').length >= 15);
    const det = H.document.querySelector('.pdetail');
    check('squad: detail panel exists', !!det);
    if (det) {
      const tabs = det.querySelectorAll('.tabbtn');
      check('squad: two tabs (能力/プロフィール)', tabs.length === 2 && tabs[0].textContent === '能力' && tabs[1].textContent === 'プロフィール');
      check('squad: 能力 tab is active by default', tabs[0].classList.contains('on') && !tabs[1].classList.contains('on'));
      const panes = det.querySelectorAll('.tabpane');
      check('squad: ability pane visible, profile pane hidden by class', panes.length === 2 && !panes[0].classList.contains('tabhide') && panes[1].classList.contains('tabhide'));
      /* v0.15 の詳細全項目が DOM に残っている（タブの裏でも欠落しない） */
      const t = det.textContent.replace(/\s+/g, ' ');
      const items = ['体格', '性格', '特能・個性', '今季の記録', 'キャリア通算', '調子', '調子の推移', '信頼度', '疲労', '総合', 'スピード', 'パワー', 'パス', 'キック', 'タックル', 'スタミナ'];
      const missing = items.filter(x => !t.includes(x));
      check('squad: all v0.15 detail items retained across tabs', missing.length === 0, missing.join(','));
      check('squad: large rank+value entries retained', det.querySelectorAll('.rkval.lg').length >= 7, 'n=' + det.querySelectorAll('.rkval.lg').length);
      /* タブ切替で表示が入れ替わる */
      tabs[1].click(); await sleep(15);
      const det2 = H.document.querySelector('.pdetail');
      const tabs2 = det2.querySelectorAll('.tabbtn');
      const panes2 = det2.querySelectorAll('.tabpane');
      check('squad: switching to プロフィール flips panes', tabs2[1].classList.contains('on') && panes2[0].classList.contains('tabhide') && !panes2[1].classList.contains('tabhide'));
      /* 行タップで別選手の詳細に替わる（選択はタブを跨いで保持される） */
      const rows = H.document.querySelectorAll('.squadlist tr.prow');
      const name2 = H.state().players[1].name;
      rows[1].click(); await sleep(15);
      const det3 = H.document.querySelector('.pdetail');
      check('squad: row tap switches detail player', det3.querySelector('.pname-t').textContent === name2 && det3.querySelectorAll('.tabbtn')[1].classList.contains('on'));
    }
    H.window.close();
  }

  /* ---- 5. 対戦確認：vs カードの内部スクロール化＋キックオフはアクションバー ---- */
  {
    const st = JSON.parse(base);
    st.monthIdx = 8; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null;
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 15);
    const ok = await driveToPreMatch(H);
    check('prematch: reached', ok);
    /* v0.27 追随: 「vs 相手校」は見出し帯（.pmhero のガラス）へ移り、スカウティング等はその下のスクロール枠（.pmcard）に入る */
    const hero = H.document.querySelector('.pmhero');
    check('prematch: header band shows the opponent', !!hero && hero.textContent.includes('vs 帝都学園'));
    const vsCard = H.document.querySelector('.card.pmcard');
    check('prematch: vs card scrolls internally (grow+scroll)', !!vsCard && vsCard.classList.contains('grow') && vsCard.classList.contains('scroll'));
    check('prematch: scouting content retained', H.text().includes('スカウティング') && H.text().includes('弱点ヒント'));
    const bar = H.document.querySelector('.actionbar');
    check('prematch: kickoff button in action bar', !!bar && [...bar.querySelectorAll('button')].some(b => b.textContent.includes('キックオフ')));
    const banner = H.document.querySelector('.banner.pmb');
    check('prematch: banner uses fixed-ratio class', !!banner && !!banner.closest('.pmhero')); /* v0.27 追随: バナーは見出し帯の背景 */
    H.window.close();
  }

  /* ---- 6. シーズン締めと勧誘：決定ボタンはアクションバー ---- */
  {
    const st = JSON.parse(base);
    st.summary = {
      result: '予選決勝敗退', wins: 3, losses: 2, goalEval: null, grade: 'そこそこ', firstHana: false,
      grads: [{ name: '卒業生A', pos: 'PR', avg: 60 }], stars: [{ name: '星野', pos: 'SO', tries: 2, plays: 1 }]
    };
    st.board = null; st.recruit = null;
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 16);
    const bar = H.document.querySelector('.actionbar');
    check('summary: next-season button in action bar', !!bar && [...bar.querySelectorAll('button')].some(b => b.textContent.includes('新年度へ')));
    H.click('新年度へ'); await sleep(20);
    const bar2 = H.document.querySelector('.actionbar');
    check('recruit: start-year button in action bar', !!bar2 && [...bar2.querySelectorAll('button')].some(b => b.textContent.includes('新年度を始める')));
    check('recruit: candidate cards retained', H.document.querySelectorAll('.cand').length >= 1, 'n=' + H.document.querySelectorAll('.cand').length);
    H.window.close();
  }

  /* ---- 7. 優勝サマリー：全面写真の中でもボタンはアクションバー ---- */
  {
    const st = JSON.parse(base);
    st.summary = {
      result: '🏆 花園優勝！', wins: 12, losses: 0, goalEval: null, grade: '強豪', firstHana: false,
      grads: [{ name: '卒業生A', pos: 'PR', avg: 80 }], stars: []
    };
    st.board = null; st.recruit = null; st.qualified = true;
    const H = await makeDom({ 'hanazono.v02': JSON.stringify(st) }, 17);
    const full = H.document.querySelector('.photofull');
    check('champion: full-photo ending retained', !!full);
    check('champion: next button in action bar inside the photo panel', !!full && !!full.querySelector('.actionbar button'));
    H.window.close();
  }

  /* ---- 8. セーブ互換：v0.16 形式のまま（新フィールドなし）で全画面が描ける ---- */
  {
    const H = await makeDom({ 'hanazono.v02': base }, 18);
    H.click('選手一覧'); await sleep(10);
    check('compat: squad renders from an unmodified save', !!H.document.querySelector('.laysquad'));
    const st2 = H.state();
    check('compat: save gains no new fields (layout-only change)', !('squadTab' in st2) && st2.players.every(p => !('tab' in p)));
    H.window.close();
  }

  console.log(failures ? '\n*** ' + failures + ' FAILURES ***' : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
