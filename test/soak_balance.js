/* Balance soak (not a QA gate): auto-play multiple careers with near-best choices
 * and measure the 弱小→花園 curve: years to first Hanazono, first title, power growth. */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(__dirname + '/../v02/play.html', 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* v0.16: 後半の戦術変更への対応。既定は「変更しない」＝v0.15 までの条件と揃える。
 * argv[4]='plan' の時は常に「FWで押し込む」を選び、采配を使った場合のバランスも測れるようにする */
const USE_PLAN = process.argv[4] === 'plan';
function lcg(seed) {
  let s = seed >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
async function runCareer(seed, maxYears) {
  const dom = new JSDOM(html, { url: 'http://localhost/v02/', runScripts: 'dangerously', pretendToBeVisual: true });
  const { window } = dom, { document } = window;
  const s = document.createElement('script');
  s.textContent = 'Math.random = (' + lcg.toString() + ')(' + seed + ');';
  document.body.appendChild(s);
  await sleep(40);
  const text = () => document.getElementById('app').textContent.replace(/\s+/g, ' ');
  const btn = (sub) => [...document.querySelectorAll('button')].find(b => b.textContent.includes(sub));
  const state = () => JSON.parse(window.localStorage.getItem('hanazono.v02'));
  const click = (sub) => { const b = btn(sub); if (!b) throw new Error('no button: ' + sub); b.click(); };
  click('監督に就任する'); await sleep(5);
  const rec = { seed, years: [], firstHana: null, firstTitle: null, wins: 0, losses: 0, bad: null };
  let guard = 0, lastYear = 1;
  while (guard++ < 200000) {
    const st = state();
    const t = text();
    if (t.includes('NaN') || t.includes('undefined')) { rec.bad = t.slice(0, 120); break; }
    if (st.year > maxYears) break;
    if (btn('新年度へ')) {
      const top15 = st.players.map(p => Object.values(p.stats).reduce((a, b) => a + b, 0) / 6).sort((a, b) => b - a).slice(0, 15);
      const pw = Math.round(top15.reduce((a, b) => a + b, 0) / Math.max(1, top15.length) * 10) / 10;
      rec.years.push({ year: st.year, result: st.season.result, power: pw, rep: st.rep, grade: null });
      if (st.career.hana > 0 && rec.firstHana === null) rec.firstHana = st.year;
      if (st.career.hanaTitles > 0 && rec.firstTitle === null) rec.firstTitle = st.year;
      rec.wins += st.season.wins; rec.losses += st.season.losses;
      if (st.year >= maxYears) break;
      click('新年度へ'); await sleep(2);
      const tog = btn('獲得リストに入れる'); if (tog) { tog.click(); await sleep(1); }
      if (btn('新年度を始める')) { click('新年度を始める'); await sleep(2); }
      continue;
    }
    if (btn('新年度を始める')) { click('新年度を始める'); await sleep(2); continue; }
    if (btn('目標を決めて')) { click('目標を決めて'); await sleep(120); continue; }
    if (btn('確認した')) { click('確認した'); await sleep(5); continue; } /* v0.22 追随: 成長レポートが専用レイアウト表示になり、確認後に指示フォームが出るため、駆動に確認ステップを追加（検証内容は不変） */
    if (btn('指示を確定')) {
      /* 練習強度は「強め」に寄せる（v0.27 追随: 強度はセレクトからボタン列 .seg[data-k="level"] になった。選ぶ値は従来と同じ '1'） */
      const lv = document.querySelector('.seg[data-k="level"] [data-v="1"]');
      if (lv && !lv.classList.contains('on')) lv.click();
      click('指示を確定'); await sleep(1); continue;
    }
    const pc = document.querySelector('.pcard');
    if (pc) { pc.click(); await sleep(0); continue; }
    if (btn('結果のみ表示（スキップ）')) { click('結果のみ表示（スキップ）'); await sleep(2); continue; }
    if (btn('キックオフ')) { click('キックオフ'); await sleep(1); continue; }
    if (btn('変更しない')) { click(USE_PLAN ? 'FWで押し込む' : '変更しない'); await sleep(0); continue; }
    const opts = [...document.querySelectorAll('.choices .btn.choice')];
    if (opts.length && t.includes('成功率の目安')) {
      let best = opts[0], bp = -1;
      opts.forEach(o => { const m = (o.dataset.p ? [0, o.dataset.p] : o.textContent.match(/(\d+)%/)); const p = m ? +m[1] : 0; if (p > bp) { bp = p; best = o; } });
      best.click(); await sleep(0); continue;
    }
    if (btn('試合を進める')) { click('試合を進める'); await sleep(0); continue; }
    if (btn('やった！次へ')) { click('やった！次へ'); await sleep(1); continue; }
    if (btn('次へ')) { click('次へ'); await sleep(1); continue; }
    rec.bad = 'stuck: ' + t.slice(0, 160); break;
  }
  const fin = state();
  rec.finalYear = fin.year; rec.finalRep = fin.rep; rec.career = fin.career;
  /* チーム総合力の推移は最終年の選手から近似できないため、年次結果のみ記録 */
  window.close();
  return rec;
}
(async () => {
  const N = parseInt(process.argv[2] || '6', 10);
  const MAXY = parseInt(process.argv[3] || '10', 10);
  const out = [];
  for (let i = 0; i < N; i++) {
    const r = await runCareer(1000 + i * 777, MAXY);
    out.push(r);
    console.log('career seed=' + r.seed + ' firstHana=' + r.firstHana + ' firstTitle=' + r.firstTitle +
      ' career=' + JSON.stringify(r.career) + ' W/L=' + r.wins + '/' + r.losses + (r.bad ? ' BAD: ' + r.bad : ''));
    console.log('  results: ' + r.years.map(y => y.year + '年:' + y.result + '(力' + y.power + '/評判' + y.rep + ')').join(' | '));
  }
  const hanas = out.map(r => r.firstHana).filter(x => x !== null).sort((a, b) => a - b);
  const titles = out.map(r => r.firstTitle).filter(x => x !== null);
  console.log('\n=== summary (' + N + ' careers, max ' + MAXY + ' years) ===');
  console.log('reached Hanazono: ' + hanas.length + '/' + N + (hanas.length ? ' median year ' + hanas[Math.floor(hanas.length / 2)] : ''));
  console.log('won Hanazono title: ' + titles.length + '/' + N + (titles.length ? ' years: ' + titles.join(',') : ''));
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
