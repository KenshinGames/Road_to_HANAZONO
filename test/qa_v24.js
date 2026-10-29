/* QA v0.24: はじめての人への仕上げ＋表示テキスト最小化
 * - バージョン表記 v1.0（v0.25 で追随。結果アサーションは不変）
 * - セーブスロット移行: 実際の v0.23 ビルドで作ったセーブが、v0.24 でスロット1として
 *   そのまま自動継続されること（移行は冪等、セーブ内容は不変）
 * - スロット操作: 空き枠での新規開始／切替（退避と復元）／概要表示／削除（2段階確認）
 * - 全データ削除（2段階確認、設定キーは残る）
 * - チュートリアル: 新規端末でだけ出る／ステップ遷移／スキップ／セーブ・乱数に触れない／
 *   既存セーブ端末では出ない／ガイドから再表示できる
 * - 設定の集約: 効果音・BGM・音量・時短が1画面にあり、既存キーの意味が不変
 * - 時短の自動スキップ: 設定 ON のキックオフが手動スキップと同一結果（同一シードでセーブ一致）
 * - 表示テキスト最小化: 目標設定の説明段落が消え、ガイド側に移っていること
 * - 場面イラスト: PHOTO_SCENES の登録キーは実在ファイルと一致（存在しない参照を作らない）
 * 実行: node test/qa_v24.js （jsdom は test/node_modules にある前提） */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HTML = fs.readFileSync(__dirname + '/../v02/play.html', 'utf8');
const HTML_V23 = fs.readFileSync(__dirname + '/../review_v24/play_v23_baseline.html', 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  NG  ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function makeDom(html, preset, seed) {
  /* プリセットと決定的乱数はスクリプト実行前（beforeParse）に仕込む（qa_v23 と同じ作法） */
  let s = (seed || 4242) >>> 0;
  const dom = new JSDOM(html, {
    url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      try { w.localStorage.clear(); } catch (e) {}
      if (preset) for (const k of Object.keys(preset)) w.localStorage.setItem(k, preset[k]);
      w.Math.random = function () {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
  });
  const w = dom.window;
  return new Promise(res => {
    const iv = setInterval(() => {
      if (w.document && w.document.querySelector('#app') && w.document.querySelector('#app').children.length) { clearInterval(iv); res(dom); }
    }, 10);
    setTimeout(() => { clearInterval(iv); res(dom); }, 3000);
  });
}
function H(dom) {
  const w = dom.window, d = w.document;
  return {
    window: w, document: d,
    /* #app の表示テキストだけを見る（body だと script 本体の文字列まで拾ってしまう） */
    text: () => d.querySelector('#app').textContent.replace(/\s+/g, ' '),
    btn: (label) => Array.from(d.querySelectorAll('button')).find(b => b.textContent.includes(label)),
    click: (label) => { const b = Array.from(d.querySelectorAll('button')).find(x => x.textContent.includes(label)); if (!b) throw new Error('button not found: ' + label); b.click(); },
    ls: (k) => w.localStorage.getItem(k),
    state: () => JSON.parse(w.localStorage.getItem('hanazono.v02') || 'null'),
    slotCol: (i) => d.querySelectorAll('.slotcol')[i - 1]
  };
}

(async () => {
  /* ---- 1. バージョン表記 ---- */
  {
    check('version: document title is v1.0', HTML.includes('<title>Road to HANAZONO v1.0</title>'));
    const h = await makeDom(HTML, null, 1);
    check('version: hero shows v1.0', H(h).text().includes('v1.0'));
    h.window.close();
  }

  /* ---- 2. v0.23 の実セーブでの移行（最重要） ---- */
  let v23save = null;
  {
    const h = await makeDom(HTML_V23, null, 777);
    const x = H(h);
    x.click('監督に就任する（ふつう）'); await sleep(20);
    if (x.btn('目標を決めて')) { x.click('目標を決めて'); await sleep(20); }
    x.click('指示を確定'); await sleep(20);
    const pc = x.document.querySelector('.pcard'); if (pc) { pc.click(); await sleep(20); }
    v23save = x.ls('hanazono.v02');
    check('migration: v0.23 save produced by the real v0.23 build', !!v23save && JSON.parse(v23save).players.length > 0);
    h.window.close();
  }
  {
    const before = JSON.parse(v23save);
    const h = await makeDom(HTML, { 'hanazono.v02': v23save }, 777);
    const x = H(h);
    const meta = JSON.parse(x.ls('hanazono.slots') || 'null');
    check('migration: slot meta created with active=1', !!meta && meta.active === 1, JSON.stringify(meta));
    check('migration: no archive keys created (save stays in place as slot 1)', x.ls('hanazono.slot.1') === null && x.ls('hanazono.slot.2') === null && x.ls('hanazono.slot.3') === null);
    check('migration: game auto-continues (HUD visible, not title)', !!x.document.querySelector('.hud') && !x.slotCol(1), x.text().slice(0, 60));
    const after = x.state();
    check('migration: save content preserved (year/month/players/rep)',
      after.year === before.year && after.monthIdx === before.monthIdx && after.players.length === before.players.length && after.rep === before.rep,
      'y' + after.year + '/' + before.year + ' mi' + after.monthIdx + '/' + before.monthIdx);
    check('migration: tutorial auto-completed for existing-save device', JSON.parse(x.ls('hanazono.tut') || '{}').done === 1);
    check('migration: no tutorial bar for existing player', !x.document.querySelector('.tutbar'));
    const saveAfterFirst = x.ls('hanazono.v02');
    h.window.close();
    /* 冪等性: もう一度読み直しても同じ */
    const h2 = await makeDom(HTML, { 'hanazono.v02': saveAfterFirst, 'hanazono.slots': x.ls('hanazono.slots') || '{"v":1,"active":1}', 'hanazono.tut': '{"step":5,"done":1}' }, 777);
    const x2 = H(h2);
    check('migration: second boot is idempotent (state unchanged)', JSON.stringify(x2.state()) === JSON.stringify(JSON.parse(saveAfterFirst)));
    check('migration: second boot still auto-continues', !!x2.document.querySelector('.hud'));
    h2.window.close();
  }

  /* ---- 3. 新規タイトルのスロット表示と開始 ---- */
  {
    const h = await makeDom(HTML, null, 5);
    const x = H(h);
    check('slots: title shows 3 slot columns', x.document.querySelectorAll('.slotcol').length === 3);
    check('slots: all empty on fresh device', x.text().includes('あき') && !x.btn('つづきから始める'));
    check('slots: new-game buttons present for empty slot', !!x.btn('監督に就任する（ふつう）'));
    x.click('監督に就任する（ふつう）'); await sleep(20);
    check('slots: starting writes meta active=1', JSON.parse(x.ls('hanazono.slots')).active === 1);
    check('slots: game started (goal screen)', x.text().includes('年目の目標を決めよう'));
    h.window.close();
  }

  /* ---- 4. スロット切替（退避と復元）と概要表示 ---- */
  {
    const h = await makeDom(HTML, null, 9);
    const x = H(h);
    x.click('監督に就任する（ふつう）'); await sleep(20);
    if (x.btn('目標を決めて')) { x.click('目標を決めて'); await sleep(20); }
    const slot1Rep = x.state().rep;
    /* 設定 → タイトルへ */
    x.click('⚙'); await sleep(20);
    check('nav: settings opens from HUD', x.text().includes('⚙ 設定') || x.text().includes('セーブデータ'));
    x.click('タイトル画面へ'); await sleep(20);
    check('slots: occupied slot shows summary (year/grade)', (x.slotCol(1) || { textContent: '' }).textContent.includes('1年目') && x.slotCol(1).textContent.includes('部の格'), x.slotCol(1) && x.slotCol(1).textContent);
    check('slots: active slot marked as playing', x.slotCol(1).textContent.includes('プレイ中'));
    /* スロット2で新規開始 → スロット1は退避される */
    x.slotCol(2).click(); await sleep(20);
    check('slots: selecting empty slot 2 shows new-game buttons', !!x.btn('監督に就任する（ふつう）'));
    x.click('監督に就任する（ふつう）'); await sleep(20);
    check('slots: meta active switched to 2', JSON.parse(x.ls('hanazono.slots')).active === 2);
    const arc1 = JSON.parse(x.ls('hanazono.slot.1') || 'null');
    check('slots: slot 1 archived intact', !!arc1 && arc1.rep === slot1Rep && arc1.players.length > 0);
    check('slots: slot 2 is the fresh game', x.state() && x.state().goalSet === false);
    /* タイトルに戻り、スロット1へ切り替え */
    x.click('⚙'); await sleep(20);
    x.click('タイトル画面へ'); await sleep(20);
    check('slots: slot 2 now shows as playing', x.slotCol(2).textContent.includes('プレイ中'));
    x.slotCol(1).click(); await sleep(20);
    check('slots: continue button appears for occupied slot 1', !!x.btn('つづきから始める'));
    x.click('つづきから始める'); await sleep(20);
    check('slots: slot 1 restored (goalSet kept)', x.state() && x.state().goalSet === true);
    check('slots: slot 2 archived in turn', !!JSON.parse(x.ls('hanazono.slot.2') || 'null'));
    h.window.close();
  }

  /* ---- 5. スロット削除（タイトル・2段階確認） ---- */
  {
    const h = await makeDom(HTML, null, 11);
    const x = H(h);
    x.click('監督に就任する（ふつう）'); await sleep(20);
    x.click('⚙'); await sleep(20);
    x.click('タイトル画面へ'); await sleep(20);
    x.click('🗑 削除'); await sleep(20);
    check('delete: first tap only arms the confirmation (save still there)', !!x.ls('hanazono.v02') && !!x.btn('スロット1を削除する'));
    x.click('やめる'); await sleep(20);
    check('delete: cancel disarms', !x.btn('スロット1を削除する') && !!x.ls('hanazono.v02'));
    x.click('🗑 削除'); await sleep(20);
    x.click('スロット1を削除する'); await sleep(20);
    check('delete: confirmed delete removes the save', x.ls('hanazono.v02') === null);
    check('delete: slot shows empty and new-game is offered', (x.slotCol(1) || { textContent: '' }).textContent.includes('あき') && !!x.btn('監督に就任する（ふつう）'));
    h.window.close();
  }

  /* ---- 6. 設定画面からの削除と全データ削除 ---- */
  {
    const h = await makeDom(HTML, null, 13);
    const x = H(h);
    x.click('監督に就任する（ふつう）'); await sleep(20);
    x.click('⚙'); await sleep(20);
    check('settings: shows sound/BGM/fast/slots sections', ['効果音', 'BGM', '格下戦は自動で結果のみ表示', 'セーブデータ'].every(t => x.text().includes(t)));
    /* 効果音トグル: 既存キーの意味は不変 */
    const sndBefore = x.ls('hanazono.sound');
    x.click(sndBefore === '0' ? '🔇 OFF' : '🔊 ON'); await sleep(20);
    check('settings: sound toggle flips hanazono.sound only', x.ls('hanazono.sound') === (sndBefore === '0' ? '1' : '0'), sndBefore + '->' + x.ls('hanazono.sound'));
    /* BGM トグル: hanazono.bgm の on だけが変わり、sound は不変 */
    const bgmBefore = JSON.parse(x.ls('hanazono.bgm') || '{"on":true}');
    if (x.btn('🎵 ON')) x.click('🎵 ON'); else x.click('🎵 OFF');
    await sleep(20);
    const bgmAfter = JSON.parse(x.ls('hanazono.bgm') || 'null');
    /* on は 0/1 の数値で保存されるため、真偽として比較する */
    check('settings: BGM toggle flips hanazono.bgm.on, sound untouched', !!bgmAfter && !!bgmAfter.on === !bgmBefore.on && x.ls('hanazono.sound') === (sndBefore === '0' ? '1' : '0'));
    /* 音量 */
    x.click('音量大'); await sleep(20);
    check('settings: volume writes hanazono.bgm.v=1', JSON.parse(x.ls('hanazono.bgm')).v === 1);
    /* 時短トグル: 新キー hanazono.pref に入り、既存キーは不変 */
    x.click('⏩ OFF'); await sleep(20);
    check('settings: fast toggle writes hanazono.pref {fast:1}', JSON.parse(x.ls('hanazono.pref') || '{}').fast === 1);
    check('settings: pref toggle leaves sound/bgm keys intact', x.ls('hanazono.sound') !== null && !!JSON.parse(x.ls('hanazono.bgm') || 'null'));
    /* 全データ削除（2段階） */
    x.click('すべて削除'); await sleep(20);
    check('delete-all: first tap only arms (save still there)', !!x.ls('hanazono.v02') && !!x.btn('本当にすべて削除'));
    x.click('本当にすべて削除'); await sleep(20);
    check('delete-all: save and archives removed', x.ls('hanazono.v02') === null && x.ls('hanazono.slot.1') === null);
    check('delete-all: meta reset to active=1', JSON.parse(x.ls('hanazono.slots')).active === 1);
    check('delete-all: settings keys survive', x.ls('hanazono.sound') !== null && x.ls('hanazono.bgm') !== null && x.ls('hanazono.pref') !== null);
    check('delete-all: tutorial key reset (fresh start gets the guide again)', x.ls('hanazono.tut') === null);
    check('delete-all: back on title with empty slots', !x.document.querySelector('.hud') && x.document.querySelectorAll('.slotcol').length === 3);
    h.window.close();
  }

  /* ---- 7. チュートリアル（新規端末） ---- */
  {
    const h = await makeDom(HTML, null, 17);
    const x = H(h);
    check('tut: fresh device gets tutorial state (not done)', JSON.parse(x.ls('hanazono.tut') || '{}').done === 0);
    x.click('監督に就任する（ふつう）'); await sleep(20);
    const bar = x.document.querySelector('.tutbar');
    check('tut: bar shows on goal screen (step 1/5)', !!bar && bar.textContent.includes('1／5'), bar && bar.textContent.slice(0, 40));
    const saveBefore = x.ls('hanazono.v02');
    x.click('わかった ▶'); await sleep(20);
    check('tut: advancing hides the bar on goal (next step is inst)', !x.document.querySelector('.tutbar'));
    check('tut: advancing does not touch the save', x.ls('hanazono.v02') === saveBefore);
    x.click('目標を決めて'); await sleep(20);
    const bar2 = x.document.querySelector('.tutbar');
    check('tut: bar shows on inst screen (step 2/5)', !!bar2 && bar2.textContent.includes('2／5'));
    x.click('終了する'); await sleep(20);
    check('tut: skip marks done and hides the bar', JSON.parse(x.ls('hanazono.tut')).done === 1 && !x.document.querySelector('.tutbar'));
    h.window.close();
    /* 次回起動ではもう出ない */
    const h2 = await makeDom(HTML, { 'hanazono.tut': '{"step":2,"done":1}' }, 17);
    check('tut: done state persists across boots', !H(h2).document.querySelector('.tutbar'));
    h2.window.close();
  }

  /* ---- 8. チュートリアルの再表示（ガイドから） ---- */
  {
    const h = await makeDom(HTML, { 'hanazono.v02': v23save, 'hanazono.tut': '{"step":5,"done":1}' }, 19);
    const x = H(h);
    check('tut-replay: no bar before replay', !x.document.querySelector('.tutbar'));
    x.click('📖'); await sleep(20);
    check('tut-replay: guide has the replay button', !!x.btn('チュートリアルをもう一度見る'));
    x.click('チュートリアルをもう一度見る'); await sleep(20);
    check('tut-replay: tutorial reactivated', JSON.parse(x.ls('hanazono.tut')).done === 0);
    h.window.close();
  }

  /* ---- 9. 時短の自動スキップ（手動スキップと同一結果） ---- */
  function juneSave() {
    const st = JSON.parse(v23save);
    st.monthIdx = 2; st.board = null; st.summary = null; st.recruit = null; st.intro = null; st.growReport = null;
    st.players.forEach(p => { p.stats = { pac: 82, pow: 82, tec: 82, sta: 82, kik: 82, def: 82 }; p.fatigue = 5; p.injured = 0; });
    return JSON.stringify(st);
  }
  async function driveToPreMatch(preset, seed) {
    const h = await makeDom(HTML, preset, seed);
    const x = H(h);
    x.click('指示を確定'); await sleep(25);
    for (let i = 0; i < 4; i++) { const pc = x.document.querySelector('.pcard'); if (!pc) break; pc.click(); await sleep(25); }
    return { h, x };
  }
  {
    const save = juneSave();
    const a = await driveToPreMatch({ 'hanazono.v02': save, 'hanazono.pref': '{"fast":1}' }, 31);
    check('fast: reached pre-match with skip available', !!a.x.btn('結果のみ表示') && a.x.text().includes('時短設定 ON'), a.x.text().slice(0, 50));
    a.x.click('キックオフ'); await sleep(25);
    check('fast: kickoff auto-skips to the result', a.x.text().includes('時短：') && !!a.x.btn('次へ'), a.x.text().slice(0, 80));
    const saveA = a.x.ls('hanazono.v02');
    a.h.window.close();
    const b = await driveToPreMatch({ 'hanazono.v02': save }, 31);
    b.x.click('結果のみ表示'); await sleep(25);
    const saveB = b.x.ls('hanazono.v02');
    check('fast: auto-skip result identical to manual skip (same seed)', saveA === saveB);
    b.h.window.close();
    const c = await driveToPreMatch({ 'hanazono.v02': save }, 31);
    c.x.click('キックオフ'); await sleep(25);
    check('fast: without the setting, kickoff starts a normal match (not skipped)', !c.x.text().includes('時短：') && !c.x.text().includes('内訳'));
    c.h.window.close();
    /* 既定（キー無し）は OFF: 対戦確認に時短 ON の注記が出ない */
    const d = await driveToPreMatch({ 'hanazono.v02': save }, 31);
    check('fast: default is OFF (no pref key needed)', !d.x.text().includes('時短設定 ON') && !!d.x.btn('キックオフ'));
    d.h.window.close();
  }

  /* ---- 10. 表示テキスト最小化 ---- */
  {
    const h = await makeDom(HTML, null, 23);
    const x = H(h);
    x.click('監督に就任する（ふつう）'); await sleep(20);
    check('text: goal screen no longer carries the explanatory paragraph', !x.text().includes('シーズンの物差しになる目標を1つ選ぶ'));
    check('text: goal screen keeps decision data (grade/rec)', x.text().includes('現在の部の格') && x.text().includes('おすすめの目標'));
    /* 削った説明はガイド側にある */
    x.click('📖'); await sleep(20);
    check('text: moved goal explanation lives in the guide', x.text().includes('思い切って高い目標を掲げるのも監督の腕の見せどころ'));
    check('text: glossary present in the guide', ['用語集', '能力ランク', '部の格', '特能', '信頼度', '調子', 'OBネットワーク'].every(t => x.text().includes(t)));
    check('text: moved scout/lineup notes live in the guide', x.text().includes('失敗しても空いた枠は一般入部で埋まる') && x.text().includes('メンバー編成'));
    h.window.close();
    check('text: title no longer carries the intro paragraph', !HTML.includes('弱小・桜丘高校ラグビー部の監督に就任した'));
    check('text: pre-match skip paragraph removed from source', !HTML.includes('戦力差の大きい格下戦は、経過を省略して結果と勝因・敗因だけを確認できる'));
  }

  /* ---- 11. セーブ形式の不変（G に新フィールドを持ち込まない） ---- */
  {
    const h = await makeDom(HTML, null, 29);
    const x = H(h);
    x.click('監督に就任する（ふつう）'); await sleep(20);
    const st = x.state();
    check('format: game save has no slot/tutorial fields inside', !('slots' in st) && !('tut' in st) && !('pref' in st));
    h.window.close();
  }

  /* ---- 12. 場面イラストの整合（存在しないファイルへの参照を作らない） ---- */
  {
    const m = HTML.match(/var PHOTO_SCENES = \{([^}]*)\}/);
    const keys = m ? Array.from(m[1].matchAll(/(\w+):/g)).map(mm => mm[1]) : [];
    const imgDir = path.join(__dirname, '..', 'v02', 'img');
    const allExist = keys.every(k => fs.existsSync(path.join(imgDir, 'scene-' + k + '.jpg')));
    check('photos: every PHOTO_SCENES key has a real image file', allExist, keys.join(','));
    const winterExists = fs.existsSync(path.join(imgDir, 'scene-winter.jpg'));
    if (!winterExists) check('photos: no winter reference while the art does not exist', !HTML.includes('photo-winter') && !/MONTH_PHOTOS = \{[^}]*winter/.test(HTML));
    else check('photos: winter art exists (integration checked by review)', true);
  }

  console.log('\nqa_v24: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
