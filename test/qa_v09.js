/* Road to HANAZONO v0.9 QA — シーズン目標 / ライバルエース / 通算スタッツ・歴代 / 難易度 / 設備解放
 * 実行: node test/qa_v09.js */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'v02', 'play.html'), 'utf8');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let failures = 0, count = 0;
function check(name, cond, extra) {
  count++;
  if (cond) console.log('PASS | ' + name);
  else { failures++; console.log('FAIL | ' + name + (extra ? ' :: ' + extra : '')); }
}
function lcg(seed) {
  let s = seed >>> 0 || 1;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const ov = p => Object.values(p.stats).reduce((a, b) => a + b, 0) / 6;

async function makeDom(saveJson, seed) {
  const dom = new JSDOM(html, {
    url: 'https://example.com/play.html', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window) {
      if (saveJson) window.localStorage.setItem('hanazono.v02', saveJson);
      if (seed) window.Math.random = lcg(seed);
    }
  });
  await new Promise(res => { if (dom.window.document.readyState === 'complete') res(); else dom.window.addEventListener('load', res); });
  await sleep(60);
  return { window: dom.window, document: dom.window.document };
}
function helpers(w, document) {
  const text = () => document.getElementById('app').textContent.replace(/\s+/g, ' ');
  const btn = (sub) => [...document.querySelectorAll('button')].find(b => b.textContent.includes(sub));
  const state = () => JSON.parse(w.localStorage.getItem('hanazono.v02'));
  const click = (sub) => { const b = btn(sub); if (!b) throw new Error('button not found: ' + sub + ' || ' + text().slice(0, 160)); b.click(); };
  return { text, btn, state, click };
}
/* 現在の画面から試合前画面（キックオフボタンが見える状態）まで進めるヘルパー */
async function gotoPreMatch(h, document) {
  let guard = 0;
  while (guard++ < 400) {
    if (h.btn('キックオフ')) return true;
    if (h.btn('目標を決めて')) { h.click('目標を決めて'); await sleep(4); continue; }
    if (h.btn('確認した')) { h.click('確認した'); await sleep(5); continue; } /* v0.22 追随: 成長レポートが専用レイアウト表示になり、確認後に指示フォームが出るため、駆動に確認ステップを追加（検証内容は不変） */
    if (h.btn('指示を確定')) { h.click('指示を確定'); await sleep(4); continue; }
    const pc = document.querySelector('.pcard');
    if (pc) { pc.click(); await sleep(2); continue; }
    if (h.btn('次へ')) { h.click('次へ'); await sleep(2); continue; }
    return false;
  }
  return false;
}

(async function main() {
  /* 新規ゲーム（ふつう）→ 目標画面 → 指示画面。baseSave を確保する */
  let baseSave;
  {
    const d = await makeDom(null, 4242);
    const h = helpers(d.window, d.document);
    check('title: two difficulty buttons', h.text().includes('ふつう') && h.text().includes('チャレンジ'));
    h.click('監督に就任する（ふつう）'); await sleep(20);
    check('goal: screen appears right after join', h.text().includes('目標を決めよう') && h.btn('目標を決めてシーズンを始める'));
    check('goal: recommended is 予選でまず1勝 for 弱小', h.text().includes('予選でまず1勝') && h.text().includes('おすすめ'));
    const st0 = h.state();
    check('goal: default goal assigned (recommended)', st0.goal === 'win1' && st0.goalSet === false, 'goal=' + st0.goal);
    check('difficulty: normal stored', st0.difficulty === 'normal');
    check('rival: initial ace is 白鳥 圭 (2年)', st0.rival && st0.rival.name === '白鳥 圭' && st0.rival.grade === 2);
    check('history/facSeen initial', Array.isArray(st0.history) && st0.history.length === 0 && Array.isArray(st0.facSeen));
    /* 格上目標を選んでから確定 */
    h.click('花園優勝'); await sleep(10);
    check('goal: can pick a higher goal', h.state().goal === 'title');
    h.click('予選でまず1勝'); await sleep(10);
    h.click('目標を決めてシーズンを始める'); await sleep(15);
    check('goal: confirm goes to instruction screen', h.text().includes('全体方針'));
    check('goal: goalSet true after confirm', h.state().goalSet === true);
    check('inst: goal card visible in left column', h.text().includes('今年の目標'));
    baseSave = d.window.localStorage.getItem('hanazono.v02');
    d.window.close();
  }

  /* ---- 1. 難易度チャレンジ: 相手が強く、state に残る ---- */
  {
    const d = await makeDom(null, 777);
    const h = helpers(d.window, d.document);
    h.click('監督に就任する（チャレンジ）'); await sleep(20);
    check('difficulty: challenge stored', h.state().difficulty === 'challenge');
    h.click('目標を決めて'); await sleep(10);
    /* 6月の練習試合（青葉 38）: チャレンジは +3 で 41 と表示される */
    const st = h.state(); st.monthIdx = 2; st.board = null;
    d.window.localStorage.setItem('hanazono.v02', JSON.stringify(st));
    const d2 = await makeDom(JSON.stringify(st), 777);
    const h2 = helpers(d2.window, d2.document);
    await gotoPreMatch(h2, d2.document);
    check('difficulty: challenge opp power +3 in preMatch', h2.text().includes('総合力41'), h2.text().slice(0, 200));
    d.window.close(); d2.window.close();
  }

  /* ---- 2. ライバル: 12月の帝都スカウティングに学年・因縁が出る／学年で強くなる ---- */
  {
    const st = JSON.parse(baseSave);
    st.monthIdx = 8; st.board = null; st.summary = null; st.recruit = null;
    st.players.forEach(p => { for (const k in p.stats) p.stats[k] = 75; p.fatigue = 0; p.injured = 0; });
    const d = await makeDom(JSON.stringify(st), 99);
    const h = helpers(d.window, d.document);
    await gotoPreMatch(h, d.document);
    const t = h.text();
    check('rival: scouting shows ace with grade', t.includes('白鳥 圭') && t.includes('2年'), t.slice(0, 260));
    check('rival: scouting shows 通算 row', t.includes('帝都との通算'));
    /* 基準: 69 + 年次0 + エース2年ボーナス2 = 71 */
    check('rival: opp power includes grade bonus (71)', t.includes('総合力71'), t.slice(0, 260));
    d.window.close();

    const st3 = JSON.parse(baseSave);
    st3.monthIdx = 8; st3.board = null; st3.summary = null; st3.recruit = null;
    st3.rival.grade = 3;
    const d3 = await makeDom(JSON.stringify(st3), 99);
    const h3 = helpers(d3.window, d3.document);
    await gotoPreMatch(h3, d3.document);
    check('rival: grade 3 ace makes opp stronger (73)', h3.text().includes('総合力73'), h3.text().slice(0, 200));
    d3.window.close();
  }

  /* ---- 3. 目標の達成判定（強いチームでシーズンを通し、サマリーに評価が出る） ＋ 通算・歴代 ---- */
  {
    const st = JSON.parse(baseSave);
    st.players.forEach(p => { for (const k in p.stats) p.stats[k] = 92; p.fatigue = 0; p.injured = 0; });
    st.goal = 'win1'; /* おすすめ相当の易しい目標で達成を確実に観測する */
    const d = await makeDom(JSON.stringify(st), 31337);
    const h = helpers(d.window, d.document);
    let guard = 0, summarySeen = false, goalText = '';
    while (guard++ < 6000) {
      const t = h.text();
      if (t.includes('シーズン終了')) { summarySeen = true; goalText = t; break; }
      if (h.btn('目標を決めて')) { h.click('目標を決めて'); await sleep(4); continue; }
      if (h.btn('確認した')) { h.click('確認した'); await sleep(5); continue; } /* v0.22 追随: 成長レポートが専用レイアウト表示になり、確認後に指示フォームが出るため、駆動に確認ステップを追加（検証内容は不変） */
      if (h.btn('指示を確定')) { h.click('指示を確定'); await sleep(4); continue; }
      const pc = d.document.querySelector('.pcard');
      if (pc) { pc.click(); await sleep(2); continue; }
      if (h.btn('メンバー編成')) { /* 試合前はそのまま */ }
      if (h.btn('結果のみ表示（スキップ）')) { h.click('結果のみ表示（スキップ）'); await sleep(4); continue; }
      if (h.btn('キックオフ')) { h.click('キックオフ'); await sleep(4); continue; }
      const opts = [...d.document.querySelectorAll('.choices .btn.choice')];
      if (opts.length && t.includes('成功率の目安')) {
        let best = opts[0], bp = -1;
        opts.forEach(o => { const m = o.textContent.match(/(\d+)%/); const p2 = m ? +m[1] : 0; if (p2 > bp) { bp = p2; best = o; } });
        best.click(); await sleep(2); continue;
      }
      if (h.btn('試合を進める')) { h.click('試合を進める'); await sleep(2); continue; }
      if (h.btn('次へ')) { h.click('次へ'); await sleep(2); continue; }
      break;
    }
    check('goal: season summary reached', summarySeen);
    check('goal: summary shows 目標達成', goalText.includes('シーズン目標') && goalText.includes('達成'), goalText.slice(0, 300));
    const stEnd = h.state();
    check('goal: rep gained from goal bonus', stEnd.rep > 30, 'rep=' + stEnd.rep);
    check('history: one season recorded', stEnd.history.length === 1 && stEnd.history[0].year === 1 && typeof stEnd.history[0].power === 'number');
    check('crec: career stats accumulated', stEnd.players.some(p => p.crec && (p.crec.tries > 0 || p.crec.plays > 0)),
      'maxCrec=' + Math.max.apply(null, stEnd.players.map(p => (p.crec ? p.crec.tries + p.crec.plays : 0))));
    check('crec: crec >= srec for every player', stEnd.players.every(p => p.crec && p.srec && p.crec.tries >= p.srec.tries && p.crec.plays >= p.srec.plays));

    /* 記録室に歴代・通算・設備が出る */
    h.click('記録・OB'); await sleep(15);
    const rt = h.text();
    check('records: 歴代チーム shown', rt.includes('歴代チーム') && rt.includes('歴代最強'), rt.slice(0, 300));
    check('records: 設備 section shown', rt.includes('設備') && rt.includes('ウェイト場'));
    check('records: 帝都との通算 shown', rt.includes('帝都学園との通算'));
    check('records: 通算スタッツ shown', rt.includes('通算スタッツ'));
    d.window.close();

    /* ---- 4. ライバルの進級と代替わり（新年度） ---- */
    const d4 = await makeDom(JSON.stringify(stEnd), 777);
    const h4 = helpers(d4.window, d4.document);
    check('rival: summary screen restored', h4.text().includes('シーズン終了'));
    h4.click('新年度へ'); await sleep(15);
    const tog = h4.btn('獲得リストに入れる'); if (tog) { tog.click(); await sleep(5); }
    h4.click('新年度を始める'); await sleep(15);
    /* v0.20 追随: 新入生紹介画面が挟まるため、紹介を通過してから目標画面を確認する（検証内容は不変） */
    if (h4.btn('次へ進む')) { h4.click('次へ進む'); await sleep(12); }
    const stY2 = h4.state();
    check('rival: ace promoted to grade 3 in year 2', stY2.rival.grade === 3 && stY2.rival.name === '白鳥 圭', JSON.stringify(stY2.rival));
    check('goal: year 2 asks goal again', h4.text().includes('目標を決めよう'));
    h4.click('目標を決めて'); await sleep(10);

    /* 3年目: エースが卒業して代替わり（名前が変わり1年になる）＋ OB名鑑に通算が残る */
    const stY3 = h4.state();
    stY3.monthIdx = 10; /* 最終月（1月・花園決勝の月）。MONTHS は 0..10 の11か月 */
    stY3.board = { cells: [{ t: 'end', done: false }], pos: -1, hand: [1], log: [] };
    const d5 = await makeDom(JSON.stringify(stY3), 888);
    const h5 = helpers(d5.window, d5.document);
    /* v0.19 追随: 注入した旧盤面は週次方式へ移行されるため、シーズン終了が出るまで週カードを
     * クリックして最終月を進める（従来は月末マスへの1クリック）。到達先の検証は変えていない */
    for (let g5 = 0; g5 < 6 && !h5.text().includes('シーズン終了'); g5++) {
      const pc5 = d5.document.querySelector('.pcard'); if (!pc5) break;
      pc5.click(); await sleep(12);
    }
    check('flow: year 3 summary reached', h5.text().includes('シーズン終了'), h5.text().slice(0, 160));
    h5.click('新年度へ'); await sleep(15);
    const tog5 = h5.btn('獲得リストに入れる'); if (tog5) { tog5.click(); await sleep(5); }
    h5.click('新年度を始める'); await sleep(15);
    /* v0.20 追随: 新入生紹介画面が挟まるため、紹介を通過してから状態を確認する（検証内容は不変） */
    if (h5.btn('次へ進む')) { h5.click('次へ進む'); await sleep(12); }
    const stY4 = h5.state();
    check('rival: ace replaced after graduation (grade 1, new name)', stY4.rival.grade === 1 && stY4.rival.name !== '白鳥 圭', JSON.stringify(stY4.rival));
    check('rival: recruit log carries 代替わり news', h5.state().monthLog.join(' ').includes('帝都学園のエース') || h5.text().includes('帝都学園のエース'), h5.state().monthLog.join(' ').slice(0, 200));
    check('records: OB entries exist after graduations', stY4.obs.length > 0);
    d.window.close(); d4.window.close(); d5.window.close();
  }

  /* ---- 5. 目標未達: ペナルティは評判-3のみ ---- */
  {
    const st = JSON.parse(baseSave);
    st.goal = 'title'; /* 弱小のまま花園優勝は届かない */
    st.players.forEach(p => { for (const k in p.stats) p.stats[k] = 35; p.fatigue = 0; p.injured = 0; });
    const d = await makeDom(JSON.stringify(st), 24680);
    const h = helpers(d.window, d.document);
    let guard = 0, summarySeen = false, goalText = '';
    while (guard++ < 6000) {
      const t = h.text();
      if (t.includes('シーズン終了')) { summarySeen = true; goalText = t; break; }
      if (h.btn('目標を決めて')) { h.click('目標を決めて'); await sleep(4); continue; }
      if (h.btn('確認した')) { h.click('確認した'); await sleep(5); continue; } /* v0.22 追随: 成長レポートが専用レイアウト表示になり、確認後に指示フォームが出るため、駆動に確認ステップを追加（検証内容は不変） */
      if (h.btn('指示を確定')) { h.click('指示を確定'); await sleep(4); continue; }
      const pc = d.document.querySelector('.pcard');
      if (pc) { pc.click(); await sleep(2); continue; }
      if (h.btn('結果のみ表示（スキップ）')) { h.click('結果のみ表示（スキップ）'); await sleep(4); continue; }
      if (h.btn('キックオフ')) { h.click('キックオフ'); await sleep(4); continue; }
      const opts = [...d.document.querySelectorAll('.choices .btn.choice')];
      if (opts.length && t.includes('成功率の目安')) { opts[0].click(); await sleep(2); continue; }
      if (h.btn('試合を進める')) { h.click('試合を進める'); await sleep(2); continue; }
      if (h.btn('次へ')) { h.click('次へ'); await sleep(2); continue; }
      break;
    }
    check('goal miss: summary reached', summarySeen);
    check('goal miss: summary shows 届かなかった and -3', goalText.includes('届かなかった') && goalText.includes('評判-3'), goalText.slice(0, 300));
    d.window.close();
  }

  /* ---- 6. 設備: 解放条件と効果 ---- */
  {
    /* 中堅（rep 70）でウェイト場が解放済みと表示される */
    const st = JSON.parse(baseSave);
    st.rep = 70; st.facSeen = [];
    const d = await makeDom(JSON.stringify(st), 5);
    const h = helpers(d.window, d.document);
    h.click('記録・OB'); await sleep(15);
    const rt = h.text();
    check('facility: weights unlocked at 中堅', rt.includes('ウェイト場') && rt.includes('解放済み'), rt.slice(0, 400));
    check('facility: video still locked at 中堅', rt.includes('ビデオ分析室') && rt.includes('強豪') , rt.slice(0, 500));
    d.window.close();

    /* 弱小（rep 30）では未解放 */
    const stW = JSON.parse(baseSave);
    const dW = await makeDom(JSON.stringify(stW), 5);
    const hW = helpers(dW.window, dW.document);
    hW.click('記録・OB'); await sleep(15);
    check('facility: weights locked at 弱小', !/ウェイト場[\s\S]{0,40}解放済み/.test(hW.text().replace(/<[^>]+>/g, '')) && hW.text().includes('ウェイト場'));
    dW.window.close();

    /* ビデオ分析室（rep 110）: 作戦会議で nextBonus が +4 になる
     * v0.19 追随: 「作戦会議マスに止まる」代わりに週次の「ビデオ分析」カードを選ぶ（解決処理は同一） */
    const stV = JSON.parse(baseSave);
    stV.rep = 110; stV.facSeen = ['weights', 'video'];
    stV.monthIdx = 0; stV.board = { weekly: true, week: 0, log: [], dlg: null, picks: [] };
    const dV = await makeDom(JSON.stringify(stV), 6); /* v0.19: 週次イベント抽選で別途ボーナスが付くシードを避けた */
    const hV = helpers(dV.window, dV.document);
    const pcV = [...dV.document.querySelectorAll('.wcard')].find(c => c.textContent.includes('ビデオ分析'));
    if (pcV) { pcV.click(); await sleep(15); }
    check('facility: video makes meet give +4 bonus', hV.state().nextBonus === 4, 'nextBonus=' + hV.state().nextBonus);
    dV.window.close();

    /* 寮（rep 160）: ケアで疲労が 32 減る
     * v0.19 追随: 「ケアマスに止まる」代わりに週次の「休養・ケア」カードを選ぶ（解決処理は同一） */
    const stD = JSON.parse(baseSave);
    stD.rep = 160; stD.facSeen = ['weights', 'video', 'dorm'];
    stD.monthIdx = 0; stD.board = { weekly: true, week: 0, log: [], dlg: null, picks: [] };
    stD.players.forEach(p => { p.fatigue = 60; });
    const dD = await makeDom(JSON.stringify(stD), 5);
    const hD = helpers(dD.window, dD.document);
    const pcD = [...dD.document.querySelectorAll('.wcard')].find(c => c.textContent.includes('休養・ケア'));
    if (pcD) { pcD.click(); await sleep(15); }
    const fatAfter = hD.state().players[0].fatigue;
    check('facility: dorm makes care recover 32', fatAfter === 60 - 32, 'fatigue=' + fatAfter);
    dD.window.close();
  }

  /* ---- 7. マイグレーション: v0.8形式（v0.9フィールドなし）セーブが補完される ---- */
  {
    const st = JSON.parse(baseSave);
    delete st.goal; delete st.goalSet; delete st.rival; delete st.rivalW; delete st.rivalL; delete st.rivalLast;
    delete st.history; delete st.facSeen; delete st.difficulty;
    st.players.forEach(p => { delete p.crec; });
    st.board = null; st.summary = null; st.monthIdx = 2;
    const d = await makeDom(JSON.stringify(st), 5);
    const h = helpers(d.window, d.document);
    const after = h.state();
    check('migration: rival defaulted (白鳥 圭 2年)', after.rival && after.rival.name === '白鳥 圭' && after.rival.grade === 2);
    check('migration: goal auto-assigned and goalSet true (no goal screen for old saves)', after.goalSet === true && typeof after.goal === 'string');
    check('migration: boots to instruction screen mid-season', h.text().includes('全体方針'));
    check('migration: crec backfilled', after.players.every(p => p.crec && typeof p.crec.tries === 'number'));
    check('migration: difficulty defaults to normal', after.difficulty === 'normal');
    check('migration: facSeen initialized to unlocked set', Array.isArray(after.facSeen) && after.facSeen.length === 0);
    d.window.close();
  }

  /* ---- 8. 3シーズンソーク（チャレンジ難易度・目標画面を通過）で例外・NaN・undefined なし ---- */
  {
    const d = await makeDom(null, 13579);
    const h = helpers(d.window, d.document);
    h.click('監督に就任する（チャレンジ）'); await sleep(15);
    let guard = 0, seasons = 0, bad = '';
    while (guard++ < 30000 && seasons < 3) {
      const t = h.text();
      if (t.includes('NaN') || t.includes('undefined')) { bad = t.slice(0, 160); break; }
      const stN = h.state();
      if (stN.players.some(p => !p.crec || typeof p.crec.tries !== 'number' || !isFinite(p.crec.tries))) { bad = 'crec broken'; break; }
      if (stN.rival && (stN.rival.grade < 1 || stN.rival.grade > 3)) { bad = 'rival grade out of range'; break; }
      if (h.btn('新年度へ')) { h.click('新年度へ'); await sleep(4); continue; }
      if (h.btn('新年度を始める')) {
        const tog = h.btn('獲得リストに入れる'); if (tog) { tog.click(); await sleep(3); }
        h.click('新年度を始める'); seasons++; await sleep(4); continue;
      }
      if (h.btn('目標を決めて')) { h.click('目標を決めて'); await sleep(4); continue; }
      if (h.btn('確認した')) { h.click('確認した'); await sleep(5); continue; } /* v0.22 追随: 成長レポートが専用レイアウト表示になり、確認後に指示フォームが出るため、駆動に確認ステップを追加（検証内容は不変） */
      if (h.btn('指示を確定')) { h.click('指示を確定'); await sleep(3); continue; }
      const pc = d.document.querySelector('.pcard');
      if (pc) { pc.click(); await sleep(1); continue; }
      if (h.btn('結果のみ表示（スキップ）')) { h.click('結果のみ表示（スキップ）'); await sleep(3); continue; }
      if (h.btn('キックオフ')) { h.click('キックオフ'); await sleep(3); continue; }
      const opts = [...d.document.querySelectorAll('.choices .btn.choice')];
      if (opts.length && t.includes('成功率の目安')) {
        let best = opts[0], bp = -1;
        opts.forEach(o => { const m = o.textContent.match(/(\d+)%/); const p2 = m ? +m[1] : 0; if (p2 > bp) { bp = p2; best = o; } });
        best.click(); await sleep(1); continue;
      }
      if (h.btn('試合を進める')) { h.click('試合を進める'); await sleep(1); continue; }
      if (h.btn('次へ')) { h.click('次へ'); await sleep(1); continue; }
      if (h.btn('メンバー編成')) { h.click('試合前に戻る'); await sleep(2); continue; }
      bad = 'stuck: ' + t.slice(0, 120); break;
    }
    check('soak: 3 seasons completed on challenge', seasons >= 3, 'seasons=' + seasons);
    const stF = h.state();
    check('soak: no NaN/undefined', !bad, bad);
    check('soak: history has 3 seasons', stF.history.length === 3, 'n=' + stF.history.length);
    check('soak: difficulty stayed challenge', stF.difficulty === 'challenge');
    d.window.close();
  }

  console.log('\n' + (failures ? '*** ' + failures + ' FAILURES ***' : 'ALL PASS') + ' (' + count + ' checks)');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
