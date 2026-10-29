/* QA for v0.3: player data extension, save migration, scene-linked match stops, factor breakdown. */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(__dirname + '/../v02/play.html', 'utf8');
let failures = 0;
function check(name, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + (extra ? ' | ' + extra : '')); if (!cond) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PERSONS = ['熱血', 'クール', '真面目', '自由人', '頑張り屋', 'マイペース', 'リーダー気質'];
const SKILLKEYS = ['lineout', 'maul', 'tackle', 'kick', 'step', 'big', 'tough'];
/* v0.16 で期待値を +1 ずつ追随：このカウンタは「成功率の目安つき選択肢の提示回数」を数えるため、
 * 後半の戦術変更プロンプト（勝負どころではない采配選択・成功判定なし）が1試合に1回加わる。
 * 勝負どころそのものの数（STOP_PLANS: 練習2/1回戦3/準決勝4/決勝・花園5）は不変で、
 * ゲーム側の scenes.att にも戦術変更は数えられない（qa_v16 で別途検証） */
const EXPECT_SCENES = { '青葉高校': 3, '県立西高校': 4, '県立工業高校': 5, '帝都学園': 6, '東都第一高校': 6 };

function scanBadNumbers(obj, path, bad) {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'number') { if (!isFinite(obj)) bad.push(path); return; }
  if (Array.isArray(obj)) { obj.forEach((v, i) => scanBadNumbers(v, path + '[' + i + ']', bad)); return; }
  if (typeof obj === 'object') Object.keys(obj).forEach(k => scanBadNumbers(obj[k], path + '.' + k, bad));
}
function playerFieldsOk(p) {
  return typeof p.h === 'number' && p.h >= 140 && p.h <= 210 &&
    typeof p.w === 'number' && p.w >= 45 && p.w <= 140 &&
    PERSONS.includes(p.person) && Array.isArray(p.skills) && p.skills.length <= 2 &&
    p.skills.every(k => SKILLKEYS.includes(k)) &&
    typeof p.trust === 'number' && p.trust >= 0 && p.trust <= 99;
}
function lcg(seed) {
  let s = seed >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

async function makeDom(seedValue, seed) {
  const dom = new JSDOM(html, {
    url: 'http://localhost/v02/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window) { if (seedValue) window.localStorage.setItem('hanazono.v02', seedValue); }
  });
  const { window } = dom, { document } = window;
  if (seed) {
    const s = document.createElement('script');
    s.textContent = 'Math.random = (' + lcg.toString() + ')(' + seed + ');';
    document.body.appendChild(s);
  }
  await sleep(60);
  return { window, document };
}

(async () => {
  /* ---- 1. 新規ゲーム：選手の新フィールド ---- */
  {
    const { window, document } = await makeDom(null, 12345);
    const text = () => document.getElementById('app').textContent.replace(/\s+/g, ' ');
    const btn = (sub) => [...document.querySelectorAll('button')].find(b => b.textContent.includes(sub));
    btn('監督に就任する').click(); await sleep(20);
    const st = JSON.parse(window.localStorage.getItem('hanazono.v02'));
    check('new game: players exist', st.players.length >= 15, 'n=' + st.players.length);
    check('new game: all players have body/person/skills/trust', st.players.every(playerFieldsOk));
    const withSkill = st.players.filter(p => p.skills.length > 0).length;
    check('new game: some players have skills', withSkill >= 3, 'withSkill=' + withSkill);
    /* 選手一覧→詳細の表示 */
    btn('選手一覧').click(); await sleep(20);
    check('squad table shows 身長/体重/信頼', text().includes('身長') && text().includes('体重') && text().includes('信頼'));
    const row = document.querySelector('tr.prow');
    row.click(); await sleep(20);
    check('player detail shows 性格/特能/信頼度', text().includes('性格') && text().includes('特能') && text().includes('信頼度'));
    window.close();
  }

  /* ---- 2. マイグレーション：旧セーブ（新フィールドなし）を読み込める ---- */
  let oldSave;
  {
    const { window, document } = await makeDom(null, 777);
    const btn = (sub) => [...document.querySelectorAll('button')].find(b => b.textContent.includes(sub));
    btn('監督に就任する').click(); await sleep(20);
    const st = JSON.parse(window.localStorage.getItem('hanazono.v02'));
    st.players.forEach(p => { delete p.h; delete p.w; delete p.person; delete p.skills; delete p.trust; delete p.form; delete p.crec; });
    /* v0.9以前のセーブを忠実に再現する（目標・ライバル・難易度などの新フィールドを持たない） */
    delete st.goal; delete st.goalSet; delete st.rival; delete st.rivalW; delete st.rivalL; delete st.rivalLast;
    delete st.history; delete st.facSeen; delete st.difficulty; delete st.lineup;
    st.board = null; st.summary = null;
    oldSave = JSON.stringify(st);
    window.close();
  }
  {
    const { window, document } = await makeDom(oldSave, 999);
    const text = () => document.getElementById('app').textContent.replace(/\s+/g, ' ');
    check('migration: game boots to instruction screen', text().includes('全体方針'));
    const st = JSON.parse(window.localStorage.getItem('hanazono.v02'));
    check('migration: fields backfilled on load', st.players.every(playerFieldsOk), 'n=' + st.players.length);
    check('migration: progress preserved (year/rep)', st.year === 1 && typeof st.rep === 'number');
    window.close();
  }

  /* ---- 3. 試合ソーク：自動プレイで複数試合、停止回数・要因表示・整合性 ---- */
  {
    const { window, document } = await makeDom(null, 20261028);
    const text = () => document.getElementById('app').textContent.replace(/\s+/g, ' ');
    const btn = (sub) => [...document.querySelectorAll('button')].find(b => b.textContent.includes(sub));
    const state = () => JSON.parse(window.localStorage.getItem('hanazono.v02'));
    const click = (sub) => { const b = btn(sub); if (!b) throw new Error('button not found: ' + sub + ' || ' + text().slice(0, 160)); b.click(); };
    click('監督に就任する'); await sleep(20);

    const SCENE_TITLES = ['敵陣でのスクラム', '敵陣でのラインアウト', 'ゴール前、あと少しでトライ', '自陣ゴール前、相手の猛攻', 'ペナルティの選択', 'ハーフタイム', '終盤、逆転を狙う', '終盤、リードを守れるか'];
    const seenScenes = new Set();
    let inMatch = false, curOpp = null, scenesThisMatch = 0, matchClicks = 0;
    let matches = 0, sceneTotal = 0, sawFactors = 0, seasonsDone = 0, guard = 0;
    const sceneCountByOpp = {};
    while (guard++ < 30000 && seasonsDone < 3) {
      const t = text();
      if (t.includes('NaN')) { check('soak: no NaN text', false, t.slice(0, 160)); break; }
      if (btn('新年度へ')) {
        const bad = []; scanBadNumbers(state(), 'G', bad);
        check('soak: season ' + (seasonsDone + 1) + ' end state has no non-finite numbers', bad.length === 0, bad.slice(0, 3).join(','));
        click('新年度へ'); seasonsDone++; await sleep(15); continue;
      }
      /* v0.4: 勧誘画面の処理（候補を1人リストに入れてから開始） */
      if (btn('新年度を始める')) {
        const tog = btn('獲得リストに入れる'); if (tog) { tog.click(); await sleep(8); }
        click('新年度を始める'); await sleep(15); continue;
      }
      /* v0.20 追随: 新年度開始の直後に新入生紹介画面が挟まるため、紹介を通過してから目標を決める（検証内容は不変） */
      if (btn('次へ進む')) { click('次へ進む'); await sleep(15); continue; }
      if (btn('目標を決めて')) { click('目標を決めて'); await sleep(120); continue; }
      if (btn('確認した')) { click('確認した'); await sleep(5); continue; } /* v0.22 追随: 成長レポートが専用レイアウト表示になり、確認後に指示フォームが出るため、駆動に確認ステップを追加（検証内容は不変） */
      if (btn('指示を確定')) { click('指示を確定'); await sleep(8); continue; }
      const pc = document.querySelector('.pcard');
      if (pc) { pc.click(); await sleep(4); continue; }
      if (btn('キックオフ')) {
        curOpp = Object.keys(EXPECT_SCENES).find(k => t.includes('vs ' + k)) || '?';
        click('キックオフ'); inMatch = true; scenesThisMatch = 0; matchClicks = 0; matches++;
        await sleep(8); continue;
      }
      if (inMatch) {
        matchClicks++;
        if (matchClicks > 400) { check('soak: match vs ' + curOpp + ' terminates', false, 'clicks>400'); break; }
        const opts = [...document.querySelectorAll('.choices .btn.choice')];
        if (opts.length && t.includes('成功率の目安')) {
          scenesThisMatch++; sceneTotal++;
          SCENE_TITLES.forEach(x => { if (t.includes(x)) seenScenes.add(x); });
          let best = opts[0], bp = -1;
          opts.forEach(o => { const mm = o.textContent.match(/(\d+)%/); const p = mm ? +mm[1] : 0; if (p > bp) { bp = p; best = o; } });
          best.click(); await sleep(4); continue;
        }
        if (btn('やった！次へ') || btn('次へ')) {
          if (t.includes('内訳') && t.includes('能力差') && (t.includes('相手の特能') || t.includes('試合の流れ'))) sawFactors++;
          (sceneCountByOpp[curOpp] = sceneCountByOpp[curOpp] || []).push(scenesThisMatch);
          inMatch = false;
          click(btn('やった！次へ') ? 'やった！次へ' : '次へ'); await sleep(8); continue;
        }
        if (btn('試合を進める')) { click('試合を進める'); await sleep(4); continue; }
      }
      throw new Error('stuck: inMatch=' + inMatch + ' | ' + t.slice(0, 200));
    }
    check('soak: played multiple matches', matches >= 4, 'matches=' + matches);
    check('soak: scenes happened', sceneTotal >= matches * 2, 'scenes=' + sceneTotal);
    check('soak: factor breakdown shown after matches', sawFactors >= 1, 'sawFactors=' + sawFactors + '/' + matches);
    let planOk = true, detail = [];
    Object.keys(sceneCountByOpp).forEach(k => {
      detail.push(k + '=[' + sceneCountByOpp[k].join(',') + ']');
      if (EXPECT_SCENES[k] !== undefined && !sceneCountByOpp[k].every(v => v === EXPECT_SCENES[k])) planOk = false;
    });
    check('soak: stop counts match match grade (勝負どころ 練習2/1回戦3/準決勝4/決勝・花園5 ＋ v0.16 戦術変更1)', planOk, detail.join(' '));
    check('soak: both goal scenes appear (attack & defense)', seenScenes.has('ゴール前、あと少しでトライ') && seenScenes.has('自陣ゴール前、相手の猛攻'), [...seenScenes].join(' / '));
    check('soak: at least 5 scene kinds seen', seenScenes.size >= 5, 'kinds=' + seenScenes.size);
    check('soak: seasons completed without exception', seasonsDone >= 1, 'seasons=' + seasonsDone);
    const fin = state();
    check('soak: all current players keep v0.3 fields', fin.players.every(playerFieldsOk));
    window.close();
  }

  console.log(failures ? '\n*** ' + failures + ' FAILURES ***' : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
