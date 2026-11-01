/* QA v0.22: デザイン・スリム化＋場面イラスト拡充
 * - バージョン表記 v0.22
 * - 成長レポート: 月頭指示では専用レイアウト（.grboard.grfull）で全行表示され、フォームは出ない。
 *   「ほか n 名」は見出し行に併記。「確認した」で消えて通常の指示フォーム（セレクト6つ）が出る
 * - 最近の出来事: ヒーローのガラスカードは1枚に統合され、出来事ログ（.herolog）はその中にある
 * - セレクト短縮: 選択肢文言が 932×430 のフォーム幅に収まる文字数予算内（実測の切り捨て検出は review_v22 の監査が担当）
 * - 入れ子解消: 対戦確認に .card の中の .card がない／週次情報欄（.winfo）はカードでない／
 *   目標の選択肢コンテナと記録室は .flatbox（枠なし）
 * - 場面背景の拡大: 目標設定の左カラムがヒーローパネル（場面背景＋ガラス）になっている
 * - FX 連携: レポート専用レイアウトでも初出時だけ .fx-grow が付き、再描画では繰り返さない
 * - セーブ形式不変: レポート確認の前後で保存キーの集合が変わらない（STORE_KEY 据え置き）
 * - 写真の受け口: PHOTO_SCENES 未登録キーは SVG バナーへフォールバックする実装が入っている（静的確認）
 * 実行: node test/qa_v22.js （jsdom で v02/play.html を読み込む） */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const html = fs.readFileSync(path.join(__dirname, '..', 'v02', 'play.html'), 'utf8');
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
function load(presetSave, seed) {
  const dom = new JSDOM(html, {
    url: 'https://localhost/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window) {
      if (seed != null) window.Math.random = mulberry32(seed);
      if (presetSave) window.localStorage.setItem('hanazono.v02', typeof presetSave === 'string' ? presetSave : JSON.stringify(presetSave));
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
    save: () => window.localStorage.getItem('hanazono.v02')
  };
}
async function baseSave(seed) {
  const H = load(null, seed);
  await sleep(15);
  H.click('監督に就任する（ふつう）');
  await sleep(10);
  const st = H.state();
  H.window.close();
  return st;
}

(async () => {
  /* ===== 1. バージョン ===== */
  check('version: <title> is v1.3', html.includes('<title>Road to HANAZONO v1.3</title>')); /* v0.26: バージョン表記を v1.1 に追随 */ /* v0.27: バージョン表記を v1.2 に追随 */ /* v0.28: バージョン表記を v1.3 に追随 */
  {
    const H = load(null, 1);
    await sleep(15);
    check('version: title screen shows v1.3', H.text().includes('v1.3')); /* v0.26: バージョン表記を v1.1 に追随 */ /* v0.27: バージョン表記を v1.2 に追随 */ /* v0.28: バージョン表記を v1.3 に追随 */
    H.window.close();
  }

  /* ===== 2. 成長レポート専用レイアウト ===== */
  {
    const st = await baseSave(777);
    st.monthIdx = 1; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null; st.intro = null;
    const rows = [];
    for (let i = 0; i < 12; i++) {
      const p = st.players[i % st.players.length];
      rows.push({ name: p.name, stats: { pow: 3 }, trust: i % 3, total: 3, focus: i === 0 });
    }
    st.growReport = { label: '4月', rows };
    st.growAcc = null;
    const H = load(JSON.stringify(st), 5);
    await sleep(15);
    /* 比較の基準は「読み込み＋sanitize 後の保存キー集合」。読み込み時の移行補完
     * （hintSeen 等、従来からのマイグレーション）は v0.22 の変更ではないため基準に含める */
    const keysBefore = Object.keys(H.state()).sort().join(',');
    const board = H.document.querySelector('.grboard.grfull');
    check('report: dedicated full layout board (.grboard.grfull) is shown', !!board);
    check('report: instruction form is not shown yet (no selects)', H.document.querySelectorAll('select').length === 0);
    if (board) {
      check('report: 10 rows rendered', board.querySelectorAll('.grrow').length === 10, 'rows=' + board.querySelectorAll('.grrow').length);
      const head = board.querySelector('.grhead');
      check('report: overflow count noted in header', !!head && head.textContent.includes('ほか 2 名も成長した'));
      check('report: fx-grow applied on first view', board.querySelectorAll('.grrow.fx-grow').length >= 1);
      const snd = [...H.document.querySelectorAll('.hudbtn')].find(b => b.textContent.includes('音'));
      if (snd) { snd.click(); await sleep(10); }
      check('report: re-render does not replay fx-grow (board remains)', !!H.document.querySelector('.grboard.grfull') && H.document.querySelectorAll('.grrow.fx-grow').length === 0);
    }
    H.click('確認した'); await sleep(10);
    const after = H.state();
    check('report: dismiss clears growReport', after.growReport === null);
    /* v0.27 追随: 指示フォームは ボタン列4（方針・ユニット・強度・校風）＋セレクト2（重点・キャプテン） */
    check('report: instruction form appears after dismiss (4 button rows + 2 selects)', H.document.querySelectorAll('.seg[data-k]').length === 4 && H.document.querySelectorAll('select').length === 2,
      'segs=' + H.document.querySelectorAll('.seg[data-k]').length + ' selects=' + H.document.querySelectorAll('select').length);
    check('report: save keys unchanged by the whole flow', Object.keys(after).sort().join(',') === keysBefore);
    H.window.close();
  }

  /* ===== 3. ヒーロー統合（最近の出来事）＋セレクト短縮 ===== */
  {
    const st = await baseSave(778);
    st.monthIdx = 1; st.goalSet = true; st.board = null; st.summary = null; st.recruit = null; st.intro = null;
    st.growReport = null; st.growAcc = null;
    st.monthLog = ['🏉 スクラム強化。手応えがあった', '🚑 選手が負傷した'];
    const H = load(JSON.stringify(st), 6);
    await sleep(15);
    const hero = H.document.querySelector('.heropanel');
    check('hero: panel exists on instruction screen', !!hero);
    if (hero) {
      check('hero: glass cards merged into one', hero.querySelectorAll('.glasscard').length === 1, 'n=' + hero.querySelectorAll('.glasscard').length);
      check('hero: recent events log lives inside the single glass', !!hero.querySelector('.glasscard .herolog'));
      check('hero: recent events heading present', hero.textContent.includes('最近の出来事'));
    }
    /* v0.27 追随: ユニット・強度・校風はセレクトからボタン列になった。文言の長さの予算は、ボタン内の表記と
     * 校風の効果欄（短縮表記 s）に置き換えて同じ趣旨（切れない短さ）で検証する。重点・キャプテンはセレクトのまま */
    const sels = [...H.document.querySelectorAll('select')];
    const segTexts = k => [...H.document.querySelectorAll('.seg[data-k="' + k + '"] .segbtn')].map(b => b.textContent);
    check('form: 2 selects present (focus/captain)', sels.length === 2, 'n=' + sels.length);
    check('buttons: unit labels within budget (<=10 chars)', segTexts('unit').length === 3 && segTexts('unit').every(t => t.length <= 10), segTexts('unit').join(' / '));
    check('buttons: level labels within budget (<=8 chars)', segTexts('level').length === 3 && segTexts('level').every(t => t.length <= 8), segTexts('level').join(' / '));
    const note = H.document.querySelector('.seg[data-k="ethos"] .segnote');
    check('buttons: ethos note uses the short label', !!note && note.textContent.length <= 13 && !note.textContent.includes(' ― '), note ? note.textContent : 'none');
    if (sels.length === 2) {
      const texts = sels.map(s => [...s.options].map(o => o.text));
      check('select: focus options carry no personality/trait suffix', texts[0].every(t => (t.match(/・/g) || []).length === 1 && t.length <= 20), texts[0][0]);
      check('select: captain options within budget (<=14 chars)', texts[1].every(t => t.length <= 14), texts[1][0]);
    }
    H.window.close();
  }

  /* ===== 4. 目標画面：ヒーロー化＋選択肢の枠なし ===== */
  {
    const H = load(null, 9);
    await sleep(15);
    H.click('監督に就任する（ふつう）'); await sleep(10);
    check('goal: left column is a hero panel (scene bg + glass)', !!H.document.querySelector('.heropanel .glasscard'));
    const box = H.document.querySelector('.choices');
    check('goal: choices container is frameless (.flatbox, not .card)', !!box && box.classList.contains('flatbox') && !box.classList.contains('card'));
    H.window.close();
  }

  /* ===== 5. 駆動: 週次（.winfo は枠なし）→ 対戦確認（入れ子カードなし） ===== */
  {
    const H = load(null, 202);
    await sleep(15);
    H.click('監督に就任する（ふつう）'); await sleep(10);
    let winfoChecked = false, reached = false;
    for (let step = 0; step < 120 && !reached; step++) {
      if (H.btn('キックオフ')) { reached = true; break; }
      const wi = H.document.querySelector('.winfo');
      if (wi && !winfoChecked) {
        winfoChecked = true;
        check('weekly: info block is frameless (.winfo without .card)', !wi.classList.contains('card'));
      }
      if (H.btn('確認した')) { H.click('確認した'); await sleep(6); continue; }
      if (H.btn('目標を決めて')) { H.click('目標を決めて'); await sleep(10); continue; }
      if (H.btn('指示を確定')) { H.click('指示を確定'); await sleep(6); continue; }
      const c = H.document.querySelector('.wcard');
      if (c) { c.click(); await sleep(4); continue; }
      await sleep(10);
    }
    check('drive: reached pre-match screen', reached);
    if (reached) {
      check('prematch: no nested .card inside .card', H.document.querySelectorAll('.card .card').length === 0,
        'nested=' + H.document.querySelectorAll('.card .card').length);
      check('prematch: scouting is a hairline section (not a card)', !!H.document.querySelector('.scout') && !H.document.querySelector('.scout.card'));
    }
    H.window.close();
  }

  /* ===== 6. 記録室：枠なし ===== */
  {
    const st = await baseSave(779);
    st.goalSet = true; st.board = null;
    const H = load(JSON.stringify(st), 7);
    await sleep(15);
    const rb = [...H.document.querySelectorAll('.hudbtn')].find(b => b.textContent.includes('記録'));
    if (rb) { rb.click(); await sleep(10); }
    check('records: both columns are frameless (.flatbox x2)', H.document.querySelectorAll('.flatbox').length >= 2, 'n=' + H.document.querySelectorAll('.flatbox').length);
    H.window.close();
  }

  /* ===== 7. 写真の受け口（静的確認） ===== */
  check('photo hook: PHOTO_SCENES registry exists in source', html.includes('PHOTO_SCENES'));
  check('photo hook: unregistered key falls back to SVG banner', html.includes('if (!PHOTO_SCENES[key]) return banner('));

  console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
