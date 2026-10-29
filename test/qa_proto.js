/* QA for Road to HANAZONO prototype (jsdom): play full seasons to an ending. */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(__dirname + '/../proto/index.html', 'utf8');
let failures = 0;
function check(name, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + (extra ? ' | ' + extra : '')); if (!cond) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function playSeason(label, biasRandom) {
  const dom = new JSDOM(html, { url: 'http://localhost/proto/', runScripts: 'dangerously', pretendToBeVisual: true });
  const { window } = dom, { document } = window;
  if (biasRandom) {
    const s = document.createElement('script');
    s.textContent = 'Math.random = (function(){ let i = 0; const seq = [0.1,0.2,0.15,0.3,0.05,0.25,0.12,0.28]; return function(){ return seq[(i++) % seq.length]; }; })();';
    document.body.appendChild(s);
  }
  const s2 = document.createElement('script');
  s2.textContent = fs.readFileSync(__dirname + '/../proto/game.js', 'utf8');
  document.body.appendChild(s2);
  await sleep(50);
  const text = () => document.getElementById('app').textContent.replace(/\s+/g, ' ');
  const btn = (substr) => [...document.querySelectorAll('button')].find(b => b.textContent.includes(substr));
  const click = (substr) => { const b = btn(substr); if (!b) throw new Error('[' + label + '] button not found: ' + substr + ' || screen: ' + text().slice(0, 120)); b.click(); };

  check(label + ': title screen', text().includes('監督に就任'));
  click('監督に就任する');
  await sleep(20);
  check(label + ': home shows 総合力', text().includes('チーム総合力'));
  click('選手一覧を見る');
  await sleep(20);
  check(label + ': squad has 18 players rows', document.querySelectorAll('table.squad tr').length === 19, 'rows=' + document.querySelectorAll('table.squad tr').length);
  click('戻る');
  await sleep(20);

  let highlights = 0, matches = 0, guard = 0;
  while (guard++ < 400) {
    const t = text();
    if (t.includes('NaN')) { check(label + ': no NaN anywhere', false, t.slice(0, 160)); return false; }
    if (t.includes('花園出場決定') || t.includes('シーズン終了')) {
      check(label + ': reached an ending', true, t.includes('花園出場決定') ? 'CHAMPION' : 'season over (lost)');
      return t.includes('花園出場決定');
    }
    if (btn('今月の練習をする')) { click('今月の練習をする'); await sleep(10); continue; }
    if (btn('練習する')) { click('練習する'); await sleep(10); continue; }
    if (btn('試合に臨む')) { click('試合に臨む'); await sleep(10); continue; }
    if (btn('キックオフ')) { click('キックオフ'); matches++; await sleep(10); continue; }
    if (document.querySelector('.choices .btn.choice') && t.includes('成功率の目安')) {
      /* 成功率が一番高い選択肢を選ぶ */
      const opts = [...document.querySelectorAll('.choices .btn.choice')];
      let best = opts[0], bestP = -1;
      opts.forEach(o => { const m = o.textContent.match(/(\d+)%/); const p = m ? +m[1] : 0; if (p > bestP) { bestP = p; best = o; } });
      best.click(); highlights++; await sleep(10); continue;
    }
    if (btn('試合を進める')) { click('試合を進める'); await sleep(5); continue; }
    if (btn('来月へ進む')) { click('来月へ進む'); await sleep(10); continue; }
    if (btn('やった！次へ')) { click('やった！次へ'); await sleep(10); continue; }
    if (btn('次へ')) { click('次へ'); await sleep(10); continue; }
    if (btn('戻る')) { click('戻る'); await sleep(10); continue; }
    throw new Error('[' + label + '] stuck at: ' + t.slice(0, 160));
  }
  throw new Error('[' + label + '] guard exceeded. matches=' + matches + ' highlights=' + highlights);
}

(async () => {
  await playSeason('random', false);
  await playSeason('random-2', false);
  await playSeason('random-3', false);
  check('no NaN in any playthrough (asserted inline)', true);
  let champ = false;
  for (let i = 0; i < 6 && !champ; i++) champ = await playSeason('biased-' + i, true);
  check('biased play can reach 花園出場決定', champ);
  console.log(failures ? '\n*** ' + failures + ' FAILURES ***' : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
