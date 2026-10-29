/* QA for v0.4: scout candidates, quota, special frame, OB links, mid-recruit save/restore. */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(__dirname + '/../v02/play.html', 'utf8');
let failures = 0;
function check(name, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + (extra ? ' | ' + extra : '')); if (!cond) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PERSONS = ['熱血', 'クール', '真面目', '自由人', '頑張り屋', 'マイペース', 'リーダー気質'];
const SKILLKEYS = ['lineout', 'maul', 'tackle', 'kick', 'step', 'big', 'tough'];
function playerFieldsOk(p) {
  return p && typeof p.h === 'number' && p.h >= 140 && p.h <= 210 &&
    typeof p.w === 'number' && p.w >= 45 && p.w <= 140 &&
    PERSONS.includes(p.person) && Array.isArray(p.skills) && p.skills.length <= 2 &&
    p.skills.every(k => SKILLKEYS.includes(k)) &&
    typeof p.trust === 'number' && p.trust >= 0 && p.trust <= 99 &&
    p.stats && Object.values(p.stats).every(v => typeof v === 'number' && isFinite(v));
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
function helpers(window, document) {
  const text = () => document.getElementById('app').textContent.replace(/\s+/g, ' ');
  const btn = (sub) => [...document.querySelectorAll('button')].find(b => b.textContent.includes(sub));
  const state = () => JSON.parse(window.localStorage.getItem('hanazono.v02'));
  const click = (sub) => { const b = btn(sub); if (!b) throw new Error('button not found: ' + sub + ' || ' + text().slice(0, 160)); b.click(); };
  return { text, btn, state, click };
}
/* タイトル→シーズンを自動プレイし、サマリー画面（新年度へボタン）で止める */
async function playToSummary(window, document) {
  const { text, btn, click } = helpers(window, document);
  if (btn('監督に就任する')) { click('監督に就任する'); await sleep(20); }
  let guard = 0;
  while (guard++ < 20000) {
    const t = text();
    if (t.includes('NaN')) throw new Error('NaN text: ' + t.slice(0, 160));
    if (btn('新年度へ')) return true;
    if (btn('新年度を始める')) { click('新年度を始める'); await sleep(10); continue; }
    if (btn('目標を決めて')) { click('目標を決めて'); await sleep(120); continue; }
    if (btn('確認した')) { click('確認した'); await sleep(5); continue; } /* v0.22 追随: 成長レポートが専用レイアウト表示になり、確認後に指示フォームが出るため、駆動に確認ステップを追加（検証内容は不変） */
    if (btn('指示を確定')) { click('指示を確定'); await sleep(8); continue; }
    const pc = document.querySelector('.pcard');
    if (pc) { pc.click(); await sleep(3); continue; }
    if (btn('キックオフ')) { click('キックオフ'); await sleep(8); continue; }
    const opts = [...document.querySelectorAll('.choices .btn.choice')];
    if (opts.length && t.includes('成功率の目安')) {
      let best = opts[0], bp = -1;
      opts.forEach(o => { const m = o.textContent.match(/(\d+)%/); const p = m ? +m[1] : 0; if (p > bp) { bp = p; best = o; } });
      best.click(); await sleep(3); continue;
    }
    if (btn('試合を進める')) { click('試合を進める'); await sleep(3); continue; }
    if (btn('やった！次へ')) { click('やった！次へ'); await sleep(8); continue; }
    if (btn('次へ')) { click('次へ'); await sleep(8); continue; }
    throw new Error('stuck: ' + t.slice(0, 200));
  }
  throw new Error('guard exhausted before summary');
}

(async () => {
  /* ---- A. スカウトフロー：候補提示・枠の強制・確定で新年度へ ---- */
  let summarySave = null;
  {
    const { window, document } = await makeDom(null, 4242);
    const { text, btn, state, click } = helpers(window, document);
    await playToSummary(window, document);
    summarySave = window.localStorage.getItem('hanazono.v02');
    click('新年度へ'); await sleep(20);
    check('A: recruit screen appears', text().includes('新入生を迎える'));
    const st = state();
    check('A: recruit state exists', !!st.recruit);
    const cands = st.recruit.cands;
    check('A: 3-5 scout candidates', cands.length >= 3 && cands.length <= 5, 'n=' + cands.length);
    check('A: candidate players have valid fields', cands.every(c => playerFieldsOk(c.p)));
    check('A: candidates have blurb and success rate', cands.every(c => typeof c.blurb === 'string' && c.blurb.length >= 15 && c.sp >= 0.15 && c.sp <= 0.97),
      cands.map(c => Math.round(c.sp * 100) + '%').join(','));
    check('A: candidates are freshmen (year 1)', cands.every(c => c.p.year === 1));
    check('A: screen shows 寸評 and 成功率', text().includes('獲得成功率の目安') && cands.some(c => text().includes(c.p.name)));
    /* 枠（部の格で決まる）を超えて選べないこと。全候補を選ぼうとしても枠で止まるはず */
    const repNow = state().rep;
    const quotaFor = (rep) => { const mins = [0, 40, 70, 110, 160], qs = [1, 1, 2, 2, 3]; let q = 1; mins.forEach((m, i) => { if (rep >= m) q = qs[i]; }); return q; };
    let guard = 0;
    while (btn('獲得リストに入れる') && guard++ < 8) { btn('獲得リストに入れる').click(); await sleep(8); }
    const picked = state().recruit.cands.filter(c => c.picked).length;
    check('A: quota enforced by grade', picked === quotaFor(repNow), 'picked=' + picked + ' quota=' + quotaFor(repNow) + ' rep=' + repNow);
    /* 特別枠があれば迎え入れてみる */
    if (state().recruit.special) { click('迎え入れる'); await sleep(10); check('A: special can be accepted', state().recruit.special.accepted === true); }
    const before = state().players.length;
    click('新年度を始める'); await sleep(20);
    /* v0.20 追随: 新年度開始の直後に新入生紹介画面が挟まるため、紹介を通過してから目標を決める（検証内容は不変） */
    if (btn('次へ進む')) { click('次へ進む'); await sleep(15); }
    if (btn('目標を決めて')) { click('目標を決めて'); await sleep(15); }
    const after = state();
    check('A: back to instruction screen', text().includes('全体方針'));
    check('A: recruit consumed', after.recruit === null);
    check('A: roster refilled (>=15)', after.players.length >= 15, 'players=' + after.players.length + ' (was ' + before + ' returning)');
    check('A: freshmen joined', after.players.filter(p => p.year === 1).length >= 3, 'y1=' + after.players.filter(p => p.year === 1).length);
    check('A: join results logged', (after.monthLog || []).some(l => l.includes('一般入部')));
    check('A: all players keep valid fields', after.players.every(playerFieldsOk));
    window.close();
  }

  /* ---- B. 特別枠ハント＋OB連動（セーブにOBを植えて勧誘だけを繰り返す） ---- */
  {
    const base = JSON.parse(summarySave);
    base.obs = [
      { name: '伝説 太郎', pos: 'LO', avg: 82, year: 1 },
      { name: '山田 一郎', pos: 'SH', avg: 70, year: 1 }
    ];
    base.rep = 120; /* 強豪: 候補4名・枠2名 */
    const saveStr = JSON.stringify(base);
    const seenTypes = {};
    let sawViaOb = false, obsonChecked = false, attempts = 0;
    for (let seed = 11; seed <= 16 * 11 && attempts < 16 && !(seenTypes.transfer && seenTypes.convert && obsonChecked && sawViaOb); seed += 11) {
      attempts++;
      const { window, document } = await makeDom(saveStr, seed * 7919);
      const { text, state, click } = helpers(window, document);
      if (!text().includes('新年度へ')) { window.close(); continue; }
      click('新年度へ'); await sleep(15);
      const st = state();
      if (!st.recruit) { window.close(); continue; }
      check('B: candidates valid with planted OBs (try ' + attempts + ')', st.recruit.cands.every(c => playerFieldsOk(c.p) && c.blurb.length >= 15));
      st.recruit.cands.forEach(c => {
        if (c.viaOb) {
          sawViaOb = true;
          check('B: OB-introduced candidate mentions 紹介 in blurb', c.blurb.includes('紹介'), c.blurb.slice(0, 40));
        }
      });
      const sp = st.recruit.special;
      if (sp) {
        seenTypes[sp.type] = (seenTypes[sp.type] || 0) + 1;
        check('B: special player fields valid (' + sp.type + ')', playerFieldsOk(sp.p));
        if (sp.type === 'transfer') check('B: transfer student is year 2', sp.p.year === 2);
        if (sp.type === 'convert') check('B: convert has a sport', ['サッカー', '柔道', '陸上', '野球'].includes(sp.sport), sp.sport);
        if (sp.type === 'obson' && !obsonChecked) {
          obsonChecked = true;
          const surname = sp.p.name.split(' ')[0];
          const father = st.obs.find(o => o.name === sp.obName);
          check('B: OB son inherits an OB surname', !!father && father.name.split(' ')[0] === surname, sp.p.name + ' / father=' + sp.obName);
          check('B: OB son starts with high trust (>=60)', sp.p.trust >= 60, 'trust=' + sp.p.trust);
          if (father) {
            const sonPos = ['PR','HO','PR','LO','LO','FL','FL','No8','SH','SO','WTB','CTB','CTB','WTB','FB'][sp.p.posIdx];
            check('B: OB son plays father position', sonPos === father.pos, 'son=' + sonPos + ' father=' + father.pos);
          }
        }
      }
      window.close();
    }
    check('B: special frame appeared at least once in ' + attempts + ' tries', Object.keys(seenTypes).length >= 1, JSON.stringify(seenTypes));
    check('B: OB introduction appeared', sawViaOb);
    check('B: OB son verified', obsonChecked);
  }

  /* ---- C. 勧誘途中のセーブ→再読込で勧誘画面に復帰 ---- */
  {
    const { window, document } = await makeDom(null, 31337);
    const { text, btn, state, click } = helpers(window, document);
    await playToSummary(window, document);
    click('新年度へ'); await sleep(15);
    const tog = btn('獲得リストに入れる'); if (tog) { tog.click(); await sleep(10); }
    const midSave = window.localStorage.getItem('hanazono.v02');
    const pickedBefore = JSON.parse(midSave).recruit.cands.filter(c => c.picked).length;
    window.close();
    const d2 = await makeDom(midSave, 555);
    const h2 = helpers(d2.window, d2.document);
    check('C: reload mid-recruit restores recruit screen', h2.text().includes('新入生を迎える'));
    check('C: picks preserved across reload', h2.state().recruit.cands.filter(c => c.picked).length === pickedBefore, 'picked=' + pickedBefore);
    h2.click('新年度を始める'); await sleep(15);
    /* v0.20 追随: 新入生紹介画面が挟まるため、紹介を通過してから目標を決める（検証内容は不変） */
    if (h2.btn('次へ進む')) { h2.click('次へ進む'); await sleep(15); }
    if (h2.btn('目標を決めて')) { h2.click('目標を決めて'); await sleep(15); }
    check('C: recruit can finish after reload', h2.text().includes('全体方針'));
    d2.window.close();
  }

  console.log(failures ? '\n*** ' + failures + ' FAILURES ***' : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
