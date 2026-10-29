/* QA for v0.2: play two full seasons (career loop) in jsdom. */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(__dirname + '/../v02/play.html', 'utf8');
let failures = 0;
function check(name, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + (extra ? ' | ' + extra : '')); if (!cond) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dom = new JSDOM(html, { url: 'http://localhost/v02/', runScripts: 'dangerously', pretendToBeVisual: true });
  const { window } = dom, { document } = window;
  const s = document.createElement('script');
  s.textContent = 'Math.random = (function(){ let i = 0; const seq = [0.1,0.2,0.15,0.3,0.05,0.25,0.12,0.28,0.4,0.08]; return function(){ return seq[(i++) % seq.length]; }; })();';
  document.body.appendChild(s);
  await sleep(60);
  const text = () => document.getElementById('app').textContent.replace(/\s+/g, ' ');
  const btn = (substr) => [...document.querySelectorAll('button')].find(b => b.textContent.includes(substr));
  const state = () => JSON.parse(window.localStorage.getItem('hanazono.v02'));
  const click = (substr) => { const b = btn(substr); if (!b) throw new Error('button not found: ' + substr + ' || ' + text().slice(0, 140)); b.click(); };

  check('title screen', text().includes('監督に就任'));
  click('監督に就任する'); await sleep(20);
  if (btn('目標を決めて')) { click('目標を決めて'); await sleep(20); }
  check('instruction screen (全体方針)', text().includes('全体方針'));
  check('HUD shows 部格', text().includes('部の格'));

  let transitions = 0, guard = 0, sawBoard = false, sawMatch = false, sawSummary = false;
  while (guard++ < 6000) {
    const t = text();
    if (t.includes('NaN')) { check('no NaN anywhere', false, t.slice(0, 160)); break; }
    if (btn('新年度へ')) {
      const before = state();
      click('新年度へ'); transitions++; await sleep(20);
      /* v0.4: 勧誘画面が出たら、候補を1人リストに入れて新年度を開始してから検証する */
      if (btn('新年度を始める')) {
        const tog = btn('獲得リストに入れる'); if (tog) { tog.click(); await sleep(10); }
        click('新年度を始める'); await sleep(20);
      }
      const after = state();
      check('year advanced to ' + (before.year + 1), after.year === before.year + 1, 'obs=' + after.obs.length + ' players=' + after.players.length);
      check('graduates became OB (>=4)', after.obs.length >= 4);
      check('freshmen joined (players >= 15)', after.players.length >= 15, 'players=' + after.players.length);
      if (transitions >= 2) break;
      continue;
    }
    if (btn('新年度を始める')) { click('新年度を始める'); await sleep(10); continue; }
    if (btn('目標を決めて')) { click('目標を決めて'); await sleep(120); continue; }
    if (btn('確認した')) { click('確認した'); await sleep(5); continue; } /* v0.22 追随: 成長レポートが専用レイアウト表示になり、確認後に指示フォームが出るため、駆動に確認ステップを追加（検証内容は不変） */
    if (btn('指示を確定')) { click('指示を確定'); await sleep(10); continue; }
    const pc = document.querySelector('.pcard');
    if (pc) { sawBoard = true; pc.click(); await sleep(5); continue; }
    if (btn('キックオフ')) { sawMatch = true; click('キックオフ'); await sleep(10); continue; }
    if (document.querySelector('.choices .btn.choice') && t.includes('成功率の目安')) {
      const opts = [...document.querySelectorAll('.choices .btn.choice')];
      let best = opts[0], bp = -1;
      opts.forEach(o => { const m = o.textContent.match(/(\d+)%/); const p = m ? +m[1] : 0; if (p > bp) { bp = p; best = o; } });
      best.click(); await sleep(5); continue;
    }
    if (btn('試合を進める')) { click('試合を進める'); await sleep(5); continue; }
    if (btn('やった！次へ')) { click('やった！次へ'); await sleep(10); continue; }
    if (btn('次へ')) { click('次へ'); await sleep(10); continue; }
    if (t.includes('シーズン終了')) { sawSummary = true; }
    throw new Error('stuck at: ' + t.slice(0, 200));
  }
  check('sugoroku board was played', sawBoard);
  check('match was played', sawMatch);
  check('two season transitions completed', transitions >= 2, 'transitions=' + transitions);
  const fin = state();
  check('career advanced to year 3', fin && fin.year === 3, 'year=' + (fin && fin.year));
  console.log(failures ? '\n*** ' + failures + ' FAILURES ***' : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
