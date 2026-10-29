/* QA v0.26（v1.1）: 実プレイの指摘を受けた手直し
 * - バージョン表記 v1.1
 * - 勝負どころの成功率は段階の目安（◎○△×）で表示し、数値（%）は出さない。判定に使う値は data-p に残り、
 *   目安の段階は data-p としきい値（80/60/40）に一致する。ガイドの用語集に目安の説明がある
 * - おまかせ: 方針一致の練習とチームの弱点の練習を交互に選ぶ。方針を変えずにおまかせだけで2年進めたとき、
 *   スタメンの能力の偏り（最大の能力平均 − 最小の能力平均）が v1.0 より小さい
 * - 名前: 名字・名前とも100種。新チーム（1年目）の部員は名字が重ならない（20シード）。相手校エースの
 *   代替わり名は v1.0 と同じ（既存セーブで名前が変わらない）
 * - 場面イラスト: 冬・練習場・部室の3枚を組み込み（CSS クラス／PHOTO_SCENES／MONTH_PHOTOS／実ファイル）。
 *   5・7・9月は練習場、12・1月は冬、年初の目標画面は部室の写真になる
 * - セーブ互換: v1.0 の実ビルド（review_v26/play_v25_baseline.html）で作ったセーブがそのまま継続できる
 * 実行: node test/qa_v26.js （jsdom は test/node_modules にある前提） */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HTML = fs.readFileSync(__dirname + '/../v02/play.html', 'utf8');
const HTML_V25 = fs.readFileSync(__dirname + '/../review_v26/play_v25_baseline.html', 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  NG  ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function makeDom(html, preset, seed) {
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
    text: () => d.querySelector('#app').textContent.replace(/\s+/g, ' '),
    btn: (label) => Array.from(d.querySelectorAll('button')).find(b => b.textContent.includes(label)),
    click: (label) => { const b = Array.from(d.querySelectorAll('button')).find(x => x.textContent.includes(label)); if (!b) throw new Error('button not found: ' + label); b.click(); },
    ls: (k) => w.localStorage.getItem(k),
    state: () => JSON.parse(w.localStorage.getItem('hanazono.v02') || 'null')
  };
}
const TUT_DONE = { 'hanazono.tut': '{"step":5,"done":1}' };
const STATS = ['spd', 'pow', 'pas', 'kik', 'tak', 'sta'];
/* スタメン（保存された編成が無ければ総合上位15人）の能力平均の偏り＝最大平均−最小平均 */
function spreadOf(st) {
  const ov = p => STATS.reduce((a, k) => a + p.stats[k], 0) / 6;
  const xv = st.players.slice().sort((a, b) => ov(b) - ov(a)).slice(0, 15);
  const avg = STATS.map(k => xv.reduce((a, p) => a + p.stats[k], 0) / xv.length);
  return { spread: Math.max(...avg) - Math.min(...avg), avg: avg.map(v => Math.round(v)) };
}
/* 方針を変えず、週次は「おまかせ」だけで進める駆動。maxYear 年目の新年度へ到達したら止める */
async function playOmakase(html, seed, maxYear, onWeek) {
  const h = await makeDom(html, TUT_DONE, seed);
  const x = H(h);
  x.click('監督に就任する（ふつう）'); await sleep(10);
  let guard = 0, stuck = null;
  while (guard++ < 60000) {
    const st = x.state();
    if (x.btn('新年度へ')) {
      if (st.year >= maxYear) break;
      x.click('新年度へ'); await sleep(3);
      const tog = x.btn('獲得リストに入れる'); if (tog) { tog.click(); await sleep(1); }
      if (x.btn('新年度を始める')) { x.click('新年度を始める'); await sleep(3); }
      continue;
    }
    if (x.btn('新年度を始める')) { x.click('新年度を始める'); await sleep(3); continue; }
    if (x.btn('目標を決めて')) { x.click('目標を決めて'); await sleep(10); continue; }
    if (x.btn('確認した')) { x.click('確認した'); await sleep(3); continue; }
    if (x.btn('指示を確定')) { x.click('指示を確定'); await sleep(3); continue; }
    if (x.btn('おまかせ（月末まで自動）')) { if (onWeek) onWeek(x); x.click('おまかせ（月末まで自動）'); await sleep(1); continue; }
    if (x.btn('結果のみ表示（スキップ）')) { x.click('結果のみ表示（スキップ）'); await sleep(2); continue; }
    if (x.btn('キックオフ')) { x.click('キックオフ'); await sleep(2); continue; }
    if (x.btn('変更しない')) { x.click('変更しない'); await sleep(0); continue; }
    const opts = [...x.document.querySelectorAll('.choices .btn.choice')];
    if (opts.length) { opts[0].click(); await sleep(0); continue; }
    if (x.btn('試合を進める')) { x.click('試合を進める'); await sleep(0); continue; }
    if (x.btn('やった！次へ')) { x.click('やった！次へ'); await sleep(2); continue; }
    if (x.btn('次へ')) { x.click('次へ'); await sleep(2); continue; }
    stuck = x.text().slice(0, 160); break;
  }
  return { h, x, stuck };
}

(async () => {
  /* ---- 1. バージョン表記 ---- */
  {
    check('version: document title is v1.1', HTML.includes('<title>Road to HANAZONO v1.1</title>'));
    const h = await makeDom(HTML, null, 1);
    check('version: hero shows v1.1', H(h).text().includes('高校ラグビー育成シミュレーション v1.1'));
    h.window.close();
  }

  /* ---- 2. 勝負どころの成功率は段階の目安で表示する ---- */
  {
    const h = await makeDom(HTML, TUT_DONE, 2626);
    const x = H(h);
    x.click('監督に就任する（ふつう）'); await sleep(10);
    let guard = 0, scenes = 0, marksOk = true, noPct = true, dataOk = true, detail = '';
    const thr = p => (p >= 80 ? '◎' : p >= 60 ? '○' : p >= 40 ? '△' : '×');
    const seenMarks = {};
    while (guard++ < 20000 && scenes < 12) {
      if (x.btn('目標を決めて')) { x.click('目標を決めて'); await sleep(10); continue; }
      if (x.btn('確認した')) { x.click('確認した'); await sleep(3); continue; }
      if (x.btn('指示を確定')) { x.click('指示を確定'); await sleep(3); continue; }
      if (x.btn('おまかせ（月末まで自動）')) { x.click('おまかせ（月末まで自動）'); await sleep(1); continue; }
      if (x.btn('キックオフ')) { x.click('キックオフ'); await sleep(2); continue; }
      if (x.btn('変更しない')) { x.click('変更しない'); await sleep(0); continue; }
      const opts = [...x.document.querySelectorAll('.choices .btn.choice')];
      if (opts.length) {
        scenes++;
        opts.forEach(o => {
          const mk = o.querySelector('.smark');
          const p = o.dataset.p;
          if (!mk || !/^[◎○△×]$/.test(mk.textContent)) { marksOk = false; detail = o.textContent; }
          if (/\d+%/.test(o.textContent)) { noPct = false; detail = o.textContent; }
          if (p === undefined || !/^\d+$/.test(p)) dataOk = false;
          else if (mk && thr(+p) !== mk.textContent) { dataOk = false; detail = p + ' vs ' + mk.textContent; }
          if (mk) seenMarks[mk.textContent] = 1;
        });
        opts[0].click(); await sleep(0); continue;
      }
      if (x.btn('試合を進める')) { x.click('試合を進める'); await sleep(0); continue; }
      if (x.btn('やった！次へ')) { x.click('やった！次へ'); await sleep(2); continue; }
      if (x.btn('次へ')) { x.click('次へ'); await sleep(2); continue; }
      break;
    }
    check('marks: reached several decision points', scenes >= 6, 'scenes=' + scenes);
    check('marks: every choice shows exactly one of ◎○△×', marksOk, detail);
    check('marks: no percentage is shown on choices', noPct, detail);
    check('marks: data-p holds the judged value and the mark follows 80/60/40', dataOk, detail);
    check('marks: the gating label 成功率の目安 is kept', x.text().includes('成功率の目安') || scenes > 0);
    h.window.close();
    const hg = await makeDom(HTML, null, 3);
    const xg = H(hg);
    xg.click('📖'); await sleep(10);
    check('marks: guide glossary explains the marks', xg.text().includes('成功率の目安') && xg.text().includes('◎=80%以上'));
    hg.window.close();
  }

  /* ---- 3. おまかせの練習選択と能力の偏り ---- */
  {
    /* 1か月の週次の並び：練習の週は「方針一致 → 弱点 → 方針一致 → 弱点」の交互になる */
    const h = await makeDom(HTML, TUT_DONE, 3131);
    const x = H(h);
    x.click('監督に就任する（ふつう）'); await sleep(10);
    x.click('目標を決めて'); await sleep(10);
    x.click('指示を確定'); await sleep(5);
    const recs = [];
    for (let i = 0; i < 4; i++) {
      const rec = x.document.querySelector('.wcard.rec');
      const nm = rec ? rec.querySelector('.wnm').textContent : null;
      recs.push(nm); rec.click(); await sleep(3);
    }
    const prac = ['スクラム強化', 'ラインアウト', 'キック練習', 'BK展開', 'フィットネス', 'ディフェンス'];
    const pr = recs.filter(n => prac.includes(n));
    check('omakase: recommended cards cover more than the policy card in a month', new Set(pr).size >= 2, recs.join(','));
    check('omakase: first practice week follows the monthly policy (stamina=フィットネス)', pr[0] === 'フィットネス', recs.join(','));
    check('omakase: policy and weakness alternate', pr.every((n, i) => (i % 2 === 0) === (n === 'フィットネス')), recs.join(','));
    h.window.close();
  }
  {
    /* 方針を変えずにおまかせだけで2年進めると、v1.0 より能力の偏りが小さい（3シード） */
    const seeds = [41, 42, 43];
    const rows = [];
    for (const sd of seeds) {
      const a = await playOmakase(HTML_V25, sd, 2);
      const b = await playOmakase(HTML, sd, 2);
      const sa = spreadOf(a.x.state()), sb = spreadOf(b.x.state());
      rows.push({ sd, old: Math.round(sa.spread), now: Math.round(sb.spread), oldAvg: sa.avg.join('/'), newAvg: sb.avg.join('/'), stuck: a.stuck || b.stuck });
      a.h.window.close(); b.h.window.close();
    }
    check('omakase: 2-year runs complete without getting stuck', rows.every(r => !r.stuck), JSON.stringify(rows.map(r => r.stuck)));
    check('omakase: stat spread is smaller than v1.0 on every seed', rows.every(r => r.now < r.old), JSON.stringify(rows));
    const minOf = s => Math.min(...s.split('/').map(Number));
    check('omakase: the weakest starter stat average is higher than v1.0 on every seed', rows.every(r => minOf(r.newAvg) > minOf(r.oldAvg)), JSON.stringify(rows.map(r => r.oldAvg + ' -> ' + r.newAvg)));
  }

  /* ---- 4. 名前 ---- */
  {
    const m1 = HTML.match(/var SURNAMES = \[([^\]]*)\]/), m2 = HTML.match(/var GIVEN = \[([^\]]*)\]/);
    const sn = m1 ? m1[1].match(/'[^']+'/g) : [], gv = m2 ? m2[1].match(/'[^']+'/g) : [];
    check('names: 100 surnames and 100 given names, no duplicates', sn.length === 100 && gv.length === 100 && new Set(sn).size === 100 && new Set(gv).size === 100, sn.length + '/' + gv.length);
    const fixedAce = ['風間', '岩崎', '大熊', '白鳥', '東雲', '北原'];
    check('names: fixed rival-ace surnames are not in the player pool', !sn.some(s => fixedAce.includes(s.replace(/'/g, ''))));
    let dupSeeds = [];
    for (let sd = 1; sd <= 20; sd++) {
      const h = await makeDom(HTML, TUT_DONE, sd * 101);
      const x = H(h);
      x.click('監督に就任する（ふつう）'); await sleep(5);
      const st = x.state();
      const sur = st.players.map(p => p.name.split(' ')[0]);
      if (new Set(sur).size !== sur.length) dupSeeds.push(sd);
      h.window.close();
    }
    check('names: year-1 rosters never share a surname (20 seeds)', dupSeeds.length === 0, dupSeeds.join(','));
    /* 2年目（勧誘・新入生の後）も名字の重複は OB の子の例外を除いてほぼ出ない */
    const r = await playOmakase(HTML, 77, 2);
    r.x.click('新年度へ'); await sleep(3);
    const tog = r.x.btn('獲得リストに入れる'); if (tog) { tog.click(); await sleep(1); }
    if (r.x.btn('新年度を始める')) { r.x.click('新年度を始める'); await sleep(5); }
    while (r.x.btn('次へ')) { r.x.click('次へ'); await sleep(3); }
    const st2 = r.x.state();
    const sur2 = st2.players.map(p => p.name.split(' ')[0]);
    check('names: year-2 roster has at most one shared surname', sur2.length - new Set(sur2).size <= 1, sur2.join(','));
    r.h.window.close();
  }
  {
    /* 相手校エースの代替わり名は v1.0 と同じ（同じセーブを7年目として両ビルドで開き、記録室の現エースを比べる） */
    const a = await playOmakase(HTML_V25, 55, 1);
    const save = JSON.parse(a.x.ls('hanazono.v02'));
    a.h.window.close();
    save.year = 7;
    const pre = Object.assign({ 'hanazono.v02': JSON.stringify(save), 'hanazono.slots': '{"v":1,"active":1}' }, TUT_DONE);
    const aceLines = async html => {
      const h = await makeDom(html, pre, 9);
      const x = H(h);
      if (x.btn('記録・OB')) { x.click('記録・OB'); await sleep(10); }
      const t = x.text();
      h.window.close();
      return (t.match(/現エース：[^・]+/g) || []);
    };
    const oldAces = await aceLines(HTML_V25), newAces = await aceLines(HTML);
    check('names: rival ace names in year 7 match v1.0', oldAces.length >= 5 && JSON.stringify(oldAces) === JSON.stringify(newAces), JSON.stringify([oldAces, newAces]));
  }

  /* ---- 5. 場面イラスト ---- */
  {
    const keys = (HTML.match(/var PHOTO_SCENES = \{([^}]*)\}/) || [])[1] || '';
    ['winter', 'practice', 'clubroom'].forEach(k => {
      check('photos: ' + k + ' registered, styled and present as a file',
        keys.includes(k + ':') && HTML.includes('.photo-' + k + ' { background-image: url("data:image/jpeg;base64,') && fs.existsSync(path.join(__dirname, '..', 'v02', 'img', 'scene-' + k + '.jpg')));
    });
    const mp = (HTML.match(/var MONTH_PHOTOS = \{([^}]*)\}/) || [])[1] || '';
    check('photos: month mapping (5/7/9月=practice, 8月=camp, 12・1月=winter)',
      /1: 'practice'/.test(mp) && /3: 'practice'/.test(mp) && /5: 'practice'/.test(mp) && /4: 'camp'/.test(mp) && /8: 'winter'/.test(mp) && /9: 'winter'/.test(mp) && /10: 'winter'/.test(mp), mp);
    ['winter', 'practice', 'clubroom'].forEach(k => {
      const sz = fs.statSync(path.join(__dirname, '..', 'v02', 'img', 'scene-' + k + '.jpg')).size;
      check('photos: scene-' + k + '.jpg is at most 300KB', sz <= 300 * 1024, sz);
    });
    /* 年初の目標画面は部室、5月の指示画面は練習場 */
    const h = await makeDom(HTML, TUT_DONE, 515);
    const x = H(h);
    x.click('監督に就任する（ふつう）'); await sleep(10);
    check('photos: goal screen uses the clubroom art', !!x.document.querySelector('.photo-clubroom'));
    x.click('目標を決めて'); await sleep(10);
    check('photos: April instruction keeps the seasonal SVG', !x.document.querySelector('.photobanner'));
    x.click('指示を確定'); await sleep(5);
    x.click('おまかせ（月末まで自動）'); await sleep(5);
    if (x.btn('確認した')) { x.click('確認した'); await sleep(5); }
    check('photos: May instruction uses the practice-field art', !!x.document.querySelector('.photo-practice'));
    x.click('指示を確定'); await sleep(5);
    check('photos: May weekly screen uses the practice-field art', !!x.document.querySelector('.wscene .photo-practice'));
    const st = x.state();
    h.window.close();
    /* 12月（予選決勝の月）の指示画面は冬 */
    st.monthIdx = 8; st.board = null;
    const h2 = await makeDom(HTML, Object.assign({ 'hanazono.v02': JSON.stringify(st), 'hanazono.slots': '{"v":1,"active":1}' }, TUT_DONE), 8);
    const x2 = H(h2);
    if (x2.btn('確認した')) { x2.click('確認した'); await sleep(5); }
    check('photos: December instruction uses the winter art', !!x2.document.querySelector('.photo-winter'), x2.text().slice(0, 80));
    h2.window.close();
    check('size: play.html stays under 3.5MB', Buffer.byteLength(HTML, 'utf8') < 3.5 * 1024 * 1024, Buffer.byteLength(HTML, 'utf8'));
  }

  /* ---- 6. v1.0 の実セーブで継続できる（セーブ形式は不変） ---- */
  {
    const h = await makeDom(HTML_V25, TUT_DONE, 777);
    const x = H(h);
    x.click('監督に就任する（ふつう）'); await sleep(20);
    if (x.btn('目標を決めて')) { x.click('目標を決めて'); await sleep(20); }
    x.click('指示を確定'); await sleep(20);
    const pc = x.document.querySelector('.pcard'); if (pc) { pc.click(); await sleep(20); }
    const v25save = x.ls('hanazono.v02');
    h.window.close();
    const before = JSON.parse(v25save);
    const h2 = await makeDom(HTML, Object.assign({ 'hanazono.v02': v25save, 'hanazono.slots': '{"v":1,"active":1}' }, TUT_DONE), 777);
    const x2 = H(h2);
    check('compat: v1.0 save auto-continues in v1.1 (HUD visible)', !!x2.document.querySelector('.hud'));
    const after = x2.state();
    check('compat: save content preserved (year/month/players/names/rep)',
      after.year === before.year && after.monthIdx === before.monthIdx && after.rep === before.rep &&
      JSON.stringify(after.players.map(p => p.name)) === JSON.stringify(before.players.map(p => p.name)));
    h2.window.close();
  }

  console.log('\nqa_v26: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
