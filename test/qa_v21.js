/* QA v0.21: 演出と動き
 * - 画面遷移: 実効画面が変わった時だけ入場フェード（.fx-in）が付き、同一画面の再描画では付かない
 * - キーマン対比: 初出時だけ両カラムにスライドイン（.fx-kml/.fx-kmr）と VS バッジ（.kmvs）が付き、再描画で繰り返さない
 * - 試合: 得点で変わった側のスコアがポップ（.fx-pop）し、得点バナーが1件だけ出る。カットインは勝負どころの初出時だけ（.fx-cutin）
 * - 勝利: 確定した最初の描画でスコアボードに .fx-wingo が付く
 * - 成長レポート: 初出時だけ行に .fx-grow が付き、再描画で繰り返さない
 * - 時短スキップ: バナーは1件も作られない
 * - FX は乱数を消費しない: 同一シード・同一操作で FX オン/オフの試合経過（スコアと実況）が完全一致する
 * - FX オフ（window.__hzFxOff）: 演出クラスもバナーも一切出ない
 * - セーブ形式は不変（STORE_KEY 据え置き、FX 状態は保存されない）
 * 実行: node test/qa_v21.js （jsdom で v02/play.html を読み込む） */
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
function load(presetSave, seed, fxOff) {
  const dom = new JSDOM(html, {
    url: 'https://localhost/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window) {
      if (seed != null) window.Math.random = mulberry32(seed);
      if (fxOff) window.__hzFxOff = true;
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
    state: () => JSON.parse(window.localStorage.getItem('hanazono.v02'))
  };
}
/* タイトル→目標→月頭指示→週次を進め、対戦確認（.keyman / キックオフ）に着いたら true。
 * 途中で成長レポートに初めて出会ったら onGrow(H) を1回呼ぶ */
async function driveToPrematch(H, onGrow) {
  if (H.btn('監督に就任する')) { H.click('監督に就任する（ふつう）'); await sleep(15); }
  if (H.btn('グラウンドへ戻る')) { H.click('グラウンドへ戻る'); await sleep(10); }
  let growSeen = false;
  for (let step = 0; step < 300; step++) {
    if (H.document.querySelector('.keyman') || H.btn('キックオフ')) return true;
    if (onGrow && !growSeen && H.document.querySelector('.growreport')) { growSeen = true; await onGrow(H); continue; }
    if (H.btn('目標を決めて')) { H.click('目標を決めて'); await sleep(12); continue; }
    /* v0.22 追随: 成長レポートが専用レイアウト表示になり、確認後に指示フォームが出るため、駆動に確認ステップを追加（検証内容は不変） */
    if (H.btn('確認した')) { H.click('確認した'); await sleep(8); continue; }
    if (H.btn('指示を確定')) { H.click('指示を確定'); await sleep(8); continue; }
    const c = H.document.querySelector('.wcard');
    if (c) { c.click(); await sleep(5); continue; }
    await sleep(10);
  }
  return !!(H.document.querySelector('.keyman') || H.btn('キックオフ'));
}
function scoreOf(H) {
  const pts = [...H.document.querySelectorAll('.score .pts')];
  return pts.length === 2 ? { my: +pts[0].textContent, op: +pts[1].textContent, els: pts } : null;
}
/* 試合を最後まで進める。常時「最初の選択肢」を選ぶ決定的な駆動（FX オン/オフ比較用にも使う）。
 * fxWatch があれば得点・カットインのたびにコールバックする */
async function playMatch(H, fxWatch) {
  let guard = 0, cutinTested = false, prev = scoreOf(H);
  while (guard++ < 400) {
    const t = H.text();
    if (t.includes('勝因の内訳') || t.includes('敗因の内訳')) return { done: true, score: scoreOf(H), log: [...H.document.querySelectorAll('.log > div')].map(d => d.textContent).join('\n') };
    const choices = [...H.document.querySelectorAll('.choices .btn.choice')];
    if (choices.length && t.includes('成功率の目安')) {
      const cut = H.document.querySelector('.cutin');
      if (fxWatch && cut && !cutinTested) { cutinTested = true; await fxWatch.onCutin(H, cut); }
      choices[0].click(); await sleep(4);
    } else if (H.btn('試合を進める')) {
      H.click('試合を進める'); await sleep(4);
    } else { await sleep(10); continue; }
    const now = scoreOf(H);
    if (fxWatch && prev && now && (prev.my !== now.my || prev.op !== now.op)) await fxWatch.onScore(H, prev, now);
    if (now) prev = now;
  }
  return { done: false };
}

(async () => {
  /* ===== 1. 画面遷移フェードと FX オフ ===== */
  {
    const H = load(null, 42);
    await sleep(20);
    check('enter: title has .fx-in on first render', !!H.document.querySelector('#app > .fx-in'));
    H.click('監督に就任する（ふつう）'); await sleep(15);
    check('enter: screen change to goal re-applies .fx-in', !!H.document.querySelector('#app > .fx-in'));
    const snd = [...H.document.querySelectorAll('.hudbtn')].find(b => b.textContent.includes('音'));
    check('enter: hud sound button exists on goal screen', !!snd);
    if (snd) { snd.click(); await sleep(10); }
    check('enter: same-screen re-render does not re-apply .fx-in', !H.document.querySelector('#app > .fx-in'));
    H.window.close();
  }
  {
    const H = load(null, 42, true);
    await sleep(20);
    check('fxoff: no .fx-in when FX is off', !H.document.querySelector('.fx-in'));
    H.window.close();
  }

  /* ===== 2. 成長レポート＋キーマン対比（FX オン） ===== */
  let growFx = { rows: -1, rerender: null };
  {
    const H = load(null, 202);
    const ok = await driveToPrematch(H, async (HH) => {
      const rows = [...HH.document.querySelectorAll('.grrow.fx-grow')];
      growFx.rows = rows.length;
      const snd = [...HH.document.querySelectorAll('.hudbtn')].find(b => b.textContent.includes('音'));
      if (snd) { snd.click(); await sleep(10); }
      growFx.rerender = HH.document.querySelector('.growreport') ? HH.document.querySelectorAll('.grrow.fx-grow').length : -99;
    });
    check('grow: growth report appeared during drive', growFx.rows >= 0);
    check('grow: rows have .fx-grow on first view', growFx.rows >= 1, 'rows=' + growFx.rows);
    check('grow: re-render does not replay .fx-grow (report itself remains)', growFx.rerender === 0, 'after=' + growFx.rerender);
    check('prematch: reached', ok);
    const kmc = [...H.document.querySelectorAll('.kmcol')];
    check('keyman: two columns exist', kmc.length === 2);
    check('keyman: VS badge exists', !!H.document.querySelector('.kmvs') && H.document.querySelector('.kmvs').textContent === 'VS');
    check('keyman: first view slides in (fx-kml/fx-kmr)', kmc.length === 2 && kmc[0].classList.contains('fx-kml') && kmc[1].classList.contains('fx-kmr'));
    /* 戦術ボタンのクリック＝再描画ではスライドインを繰り返さない */
    const tac = [...H.document.querySelectorAll('.choices .btn.choice')][1];
    if (tac) { tac.click(); await sleep(10); }
    const kmc2 = [...H.document.querySelectorAll('.kmcol')];
    check('keyman: re-render does not replay slide-in', kmc2.length === 2 && !kmc2[0].classList.contains('fx-kml') && !kmc2[1].classList.contains('fx-kmr'));
    H.window.close();
  }

  /* ===== 3. 試合の演出（FX オン）と、同一シードでの FX オフ同等性 ===== */
  async function matchRun(seed, fxOff, watch) {
    const H = load(null, seed, fxOff);
    const ok = await driveToPrematch(H, null);
    if (!ok) { H.window.close(); return null; }
    H.click('キックオフ'); await sleep(10);
    const r = await playMatch(H, watch);
    const st = H.state();
    H.window.close();
    return { r, st };
  }
  let watchStats = { scores: 0, pops: 0, banners: 0, cutinFx: null, cutinReplay: null, win: null, wingo: null };
  const watch = {
    onScore: async (H, prev, now) => {
      watchStats.scores++;
      const side = prev.my !== now.my ? 0 : 1;
      if (now.els[side].classList.contains('fx-pop')) watchStats.pops++;
      const b = H.document.querySelector('.fxbanner');
      /* バナーは常にちょうど1枚だけ（立て続けの得点でも重ならない） */
      if (b && b.textContent.includes('点') && H.document.querySelectorAll('.fxbanner').length === 1) watchStats.banners++;
    },
    onCutin: async (H, cut) => {
      watchStats.cutinFx = cut.classList.contains('fx-cutin');
      const keyName = (cut.querySelector('b') || {}).textContent || '';
      const outs = [...H.document.querySelectorAll('.sublist .subbtn')];
      const other = outs.find(b => !b.textContent.includes(keyName));
      if (other) {
        other.click(); await sleep(6);
        const cancel = H.btn('交代をやめる');
        if (cancel) { cancel.click(); await sleep(6); }
        const cut2 = H.document.querySelector('.cutin');
        watchStats.cutinReplay = cut2 ? cut2.classList.contains('fx-cutin') : null;
      }
    }
  };
  const on = await matchRun(202, false, watch);
  check('match: fx-on run finished', !!on && on.r.done);
  if (on) {
    watchStats.win = on.r.score ? null : null;
    check('match: at least one score happened', watchStats.scores >= 1, 'scores=' + watchStats.scores);
    check('match: every score popped the changed side', watchStats.pops === watchStats.scores, watchStats.pops + '/' + watchStats.scores);
    check('match: every score showed a banner', watchStats.banners === watchStats.scores, watchStats.banners + '/' + watchStats.scores);
    check('match: cutin slides in on first scene', watchStats.cutinFx === true);
    check('match: cutin does not replay on sub-panel re-render', watchStats.cutinReplay === false);
    check('save: no fx state in save data', !('fx' in on.st) && !JSON.stringify(on.st).includes('fxbanner'));
  }
  const off = await matchRun(202, true, null);
  check('match: fx-off run finished', !!off && off.r.done);
  if (on && off) {
    check('fx: identical final score with FX on/off (no RNG consumed)',
      on.r.score.my === off.r.score.my && on.r.score.op === off.r.score.op,
      on.r.score.my + '-' + on.r.score.op + ' vs ' + off.r.score.my + '-' + off.r.score.op);
    check('fx: identical match log with FX on/off', on.r.log === off.r.log);
  }

  /* ===== 4. 勝利時のグロー（勝てるまでシードを変えて試す） ===== */
  {
    let wingoSeen = null;
    for (const seed of [202, 7, 99, 1234, 5150]) {
      const H = load(null, seed);
      const ok = await driveToPrematch(H, null);
      if (!ok) { H.window.close(); continue; }
      H.click('キックオフ'); await sleep(10);
      const r = await playMatch(H, null);
      if (r.done && H.text().includes('勝利！ 勝因の内訳')) {
        wingoSeen = !!H.document.querySelector('.score.fx-wingo');
        H.window.close();
        break;
      }
      H.window.close();
    }
    check('win: scoreboard glows (.fx-wingo) on the winning render', wingoSeen === true);
  }

  /* ===== 5. 時短スキップではバナーを作らない ===== */
  {
    const H = load(null, 777);
    const ok = await driveToPrematch(H, null);
    check('skip: reached prematch', ok);
    const st = H.state();
    st.players.forEach(p => { Object.keys(p.stats).forEach(k => { p.stats[k] = 85; }); });
    const H2 = load(JSON.stringify(st), 777);
    await sleep(15);
    if (H2.btn('グラウンドへ戻る')) { H2.click('グラウンドへ戻る'); await sleep(10); }
    const ok2 = await driveToPrematch(H2, null);
    check('skip: reached prematch with boosted save', ok2);
    const skipBtn = H2.btn('結果のみ表示');
    check('skip: skip button offered for a lopsided match', !!skipBtn);
    if (skipBtn) {
      skipBtn.click(); await sleep(40);
      check('skip: result is shown after skip', H2.text().includes('勝因の内訳') || H2.text().includes('敗因の内訳'));
      check('skip: no fx banners were created', H2.document.querySelectorAll('.fxbanner').length === 0);
    }
    H.window.close(); H2.window.close();
  }

  console.log(failures ? ('\nqa_v21: ' + failures + ' FAILURES') : '\nqa_v21: ALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('qa_v21 crashed:', e); process.exit(2); });
