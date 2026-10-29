/* QA v0.19: 週次プランニング（1か月＝4週・活動カード選択／月頭指示との噛み合い／おまかせ／
 * 旧盤面セーブの移行／WEEKLY_MODE=false の旧方式フォールバック／バランス健全性）
 * 実行: node test/qa_v19.js （jsdom で v02/play.html を読み込む） */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

let failures = 0;
function check(name, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + (extra ? ' | ' + extra : ''));
  if (!cond) failures++;
}
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
function load(html, seed, presetSave) {
  const dom = new JSDOM(html, {
    url: 'https://localhost/', runScripts: 'dangerously', pretendToBeVisual: true,
    /* jsdom の location.reload() は no-op なので、セーブ投入は beforeParse（スクリプト実行前）で行う */
    beforeParse(window) {
      if (seed != null) window.Math.random = mulberry32(seed);
      if (presetSave) window.localStorage.setItem('hanazono.v02', JSON.stringify(presetSave));
    }
  });
  const { window } = dom;
  window.confirm = () => true;
  return {
    window, document: window.document,
    text: () => window.document.body.textContent.replace(/\s+/g, ' '),
    btn: (s) => [...window.document.querySelectorAll('button')].find(b => b.textContent.includes(s)),
    clickText: function (s) { const b = this.btn(s); if (!b) return false; b.click(); return true; },
    state: () => { const v = window.localStorage.getItem('hanazono.v02'); return v ? JSON.parse(v) : null; }
  };
}

(async () => {
  const rawHtml = fs.readFileSync(path.join(__dirname, '..', 'v02', 'play.html'), 'utf8');
  const statSum = ps => ps.reduce((s, p) => s + Object.values(p.stats).reduce((a, b) => a + b, 0), 0);
  /* 新規開始：タイトル→（目標画面）→月頭指示まで進める */
  async function startGame(H) {
    const b = [...H.document.querySelectorAll('button')].find(x => x.textContent.includes('監督に就任する'));
    if (b) b.click();
    await sleep(30);
    if (H.btn('目標を決めて')) { H.clickText('目標を決めて'); await sleep(80); }
  }

  /* ===== 1. 週次進行：4週で月が終わり、試合月は試合へ接続する ===== */
  {
    const H = load(rawHtml, 777);
    await sleep(60);
    await startGame(H);
    check('instruction screen shows', H.text().includes('指示を確定'));
    H.clickText('指示を確定'); await sleep(20);
    const st0 = H.state();
    check('weekly board created', !!(st0 && st0.board && st0.board.weekly === true && st0.board.week === 0),
      st0 && st0.board ? JSON.stringify(Object.keys(st0.board)) : 'no board');
    check('9 activity cards render', H.document.querySelectorAll('.wcard').length === 9,
      'cards=' + H.document.querySelectorAll('.wcard').length);
    check('week indicator shows week 1', H.text().includes('第1週'));
    check('weekly screen keeps pcard hook for drivers', !!H.document.querySelector('.pcard'));
    const scrum = [...H.document.querySelectorAll('.wcard')].find(c => c.textContent.includes('スクラム強化'));
    scrum.click(); await sleep(20);
    const st1 = H.state();
    check('one tap advances to week 2', st1.board && st1.board.week === 1 && H.text().includes('第2週'));
    check('pick recorded', Array.isArray(st1.board.picks) && st1.board.picks[0] === 'scrum');
    check('week log written', st1.board.log.length >= 1 && st1.board.log.some(l => l.includes('スクラム強化')),
      st1.board.log.join(' / ').slice(0, 80));
    /* 残り3週を消化すると月が終わる（4月は試合なし→5月の指示画面） */
    for (let i = 0; i < 3; i++) { H.document.querySelector('.wcard').click(); await sleep(15); }
    const st2 = H.state();
    check('month ends after 4 weeks', !st2.board && st2.monthIdx === 1 && H.text().includes('指示を確定'),
      'monthIdx=' + (st2 && st2.monthIdx));
  }

  /* ===== 2. 試合月（6月）の月末は対戦確認へ接続する ===== */
  {
    const H = load(rawHtml, 778);
    await sleep(60);
    await startGame(H);
    let guard = 0, sawPre = false;
    while (guard++ < 60) {
      if (H.text().includes('キックオフ')) { sawPre = true; break; }
      if (H.clickText('確認した')) { await sleep(8); continue; } /* v0.22 追随: 成長レポート専用レイアウトの確認ステップ（検証内容は不変） */
      if (H.clickText('指示を確定')) { await sleep(10); continue; }
      const c = H.document.querySelector('.wcard');
      if (c) { c.click(); await sleep(8); continue; }
      break;
    }
    check('weekly months connect to prematch', sawPre, 'guard=' + guard);
  }

  /* ===== 3. 活動の効果：ビデオ分析／休養・ケア／練習の伸び ===== */
  {
    const H = load(rawHtml, 779);
    await sleep(60);
    await startGame(H);
    H.clickText('指示を確定'); await sleep(15);
    const video = [...H.document.querySelectorAll('.wcard')].find(c => c.textContent.includes('ビデオ分析'));
    video.click(); await sleep(15);
    check('video week grants next-match bonus +3', H.state().nextBonus === 3, 'bonus=' + H.state().nextBonus);
    /* セーブを書き換えて全員の疲労を60にし、新規ロード（beforeParse で投入）してから休養・ケアを選ぶ */
    const sv = H.state();
    sv.players.forEach(p => { p.fatigue = 60; });
    const HR = load(rawHtml, 779, sv);
    await sleep(80);
    const rest = [...HR.document.querySelectorAll('.wcard')].find(c => c.textContent.includes('休養・ケア'));
    check('weekly screen restores mid-month from save', !!rest);
    rest.click(); await sleep(15);
    const avg = Math.round(HR.state().players.reduce((s, p) => s + p.fatigue, 0) / HR.state().players.length);
    check('rest week cuts fatigue (60 -> <=45)', avg <= 45, 'avg=' + avg);
    /* 練習の週でチーム合計が伸びる（4週ぶん） */
    const before = statSum(H.state().players);
    const H2 = load(rawHtml, 780);
    await sleep(60);
    await startGame(H2);
    H2.clickText('指示を確定'); await sleep(15);
    const b0 = statSum(H2.state().players);
    for (let i = 0; i < 4; i++) {
      const c = [...H2.document.querySelectorAll('.wcard')].find(x => x.textContent.includes('スクラム強化'));
      c.click(); await sleep(12);
    }
    const b1 = statSum(H2.state().players);
    check('a month of practice weeks grows the team', b1 > b0, 'sum ' + b0 + ' -> ' + b1);
    void before;
  }

  /* ===== 4. おまかせ：月末まで自動で進む ===== */
  {
    const H = load(rawHtml, 781);
    await sleep(60);
    await startGame(H);
    H.clickText('指示を確定'); await sleep(15);
    check('auto button exists', H.clickText('おまかせ'));
    await sleep(30);
    const st = H.state();
    check('auto completes the month', !st.board && st.monthIdx === 1, 'monthIdx=' + (st && st.monthIdx));
  }

  /* ===== 5. 旧盤面セーブの移行（盤面途中→週次） ===== */
  {
    const H = load(rawHtml, 782);
    await sleep(60);
    await startGame(H);
    H.clickText('指示を確定'); await sleep(15);
    const sv = H.state();
    const playersBefore = sv.players.length, instTeam = sv.inst.team;
    const cells = [];
    for (let i = 0; i < 11; i++) cells.push({ t: 'pS', done: i < 5 });
    cells.push({ t: 'end', done: false });
    sv.board = { cells, pos: 5, hand: [{ n: 1 }, { n: 2 }, { n: 3 }], log: ['移行テストの記録'], dlg: null };
    const HM = load(rawHtml, 782, sv);
    await sleep(80);
    const st = HM.state();
    check('legacy board migrated to weekly', !!(st.board && st.board.weekly === true), JSON.stringify(st.board).slice(0, 90));
    check('progress ratio maps to week 3 (pos5/12)', st.board.week === 2, 'week=' + st.board.week);
    check('board log carried over', st.board.log.includes('移行テストの記録'));
    check('players and instruction preserved', st.players.length === playersBefore && st.inst.team === instTeam);
    check('migrated month renders weekly screen', HM.text().includes('第3週') && !!HM.document.querySelector('.wcard'));
    /* 移行した月を最後まで進められる＝データが壊れていない */
    let guard = 0;
    while (guard++ < 6 && HM.state().board) { const c = HM.document.querySelector('.wcard'); if (!c) break; c.click(); await sleep(10); }
    check('migrated month completes', !HM.state().board, 'guard=' + guard);
    /* pos=-1（盤面未開始）の移行は第1週から */
    const sv3 = JSON.parse(JSON.stringify(sv));
    sv3.board = { cells: [{ t: 'pS', done: false }, { t: 'end', done: false }], pos: -1, hand: [], log: [], dlg: null };
    const H3 = load(rawHtml, 783, sv3);
    await sleep(80);
    check('unstarted board migrates to week 1', H3.state().board.week === 0 && H3.text().includes('第1週'));
  }

  /* ===== 6. WEEKLY_MODE=false で旧すごろく方式に戻る ===== */
  {
    const legacyHtml = rawHtml.replace('var WEEKLY_MODE = true;', 'var WEEKLY_MODE = false;');
    check('flag declaration replaceable', legacyHtml !== rawHtml);
    const H = load(legacyHtml, 784);
    await sleep(60);
    await startGame(H);
    H.clickText('指示を確定'); await sleep(15);
    const st = H.state();
    check('legacy mode builds a sugoroku board', !!(st.board && Array.isArray(st.board.cells) && !st.board.weekly));
    check('legacy board renders (no weekly cards)', !!H.document.querySelector('.board') && !H.document.querySelector('.wcard'));
    const hand = H.document.querySelector('.pcard');
    hand.click(); await sleep(15);
    check('legacy hand card advances the piece', H.state().board.pos >= 0, 'pos=' + H.state().board.pos);
  }

  /* ===== 7. バランス健全性：週次方式で1シーズンが完走し、総成長と疲労が健全な範囲に収まる =====
   * （方式間の厳密な A/B は test/soak_balance.js の多キャリア比較で行う。単一シード同士の比較は
   *   乱数消費の違いによるイベント抽選の偏りで大きくぶれるため、ここでは絶対レンジだけを見る） */
  async function seasonGrowth(html, seed) {
    const H = load(html, seed);
    await sleep(60);
    await startGame(H);
    const sum0 = statSum(H.state().players);
    let guard = 0;
    while (guard++ < 500) {
      const t = H.text();
      if (H.btn('新年度へ') || H.btn('次のシーズンへ')) break;
      if (H.clickText('確認した')) { await sleep(6); continue; } /* v0.22 追随: 成長レポート専用レイアウトの確認ステップ（検証内容は不変） */
      if (H.clickText('指示を確定')) { await sleep(6); continue; }
      const pc = H.document.querySelector('.pcard');
      if (pc) { pc.click(); await sleep(3); continue; }
      if (H.clickText('キックオフ')) { await sleep(6); continue; }
      const opts = [...H.document.querySelectorAll('.choices .btn.choice')];
      if (opts.length && t.includes('成功率の目安')) {
        let best = opts[0], bp = -1;
        opts.forEach(o => { const m = (o.dataset.p ? [0, o.dataset.p] : o.textContent.match(/(\d+)%/)); const p = m ? +m[1] : 0; if (p > bp) { bp = p; best = o; } });
        best.click(); await sleep(3); continue;
      }
      if (H.clickText('試合を進める') || H.clickText('やった！次へ') || H.clickText('次へ')) { await sleep(6); continue; }
      throw new Error('driver stuck: ' + t.slice(0, 120));
    }
    const st = H.state();
    return statSum(st.players) - sum0;
  }
  {
    const gW = await seasonGrowth(rawHtml, 202619);
    check('weekly season growth is substantial', gW > 350, 'weekly=' + gW);
    const gW2 = await seasonGrowth(rawHtml, 555);
    check('weekly season growth stable across seeds', gW2 > 350, 'seed555=' + gW2);
  }

  console.log(failures ? '\n*** ' + failures + ' FAILURES ***' : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
