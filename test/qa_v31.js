/* QA v0.31（v1.6）: 場面の背景を描き込んだ絵に（表示のみ）
 * 作者「背景画像をもっとちゃんと作りこんで！」
 * - バージョン表記 v1.6・play.html は 6MB 以下
 * - 新しい絵 5 枚（spring＝4月の桜の校庭／tsuyu＝6月の梅雨の校庭／autumn＝10・11月の秋の夕方／stadium＝県予選のナイター／
 *   hanazono＝1月の花園）：v02/img に実在・1600×800・300KB 以下、style.css の data URI がファイルと同じ中身、PHOTO_SCENES に登録
 * - 割り当て：MONTH_PHOTOS（月頭・週の画面・新入生）、MATCH_PHOTOS（試合月の週の画面・対戦確認）。既存の割り当て
 *   （5・7・9月＝練習場、8月＝合宿、12・1月＝冬、花園の対戦確認＝雨の熱戦）は変えない
 * - 画面：月頭（4・6・10・11月）、週（4・5・6・10・11・12・1月・1月決勝）、対戦確認（練習試合・県予選・花園）、新入生（4月）で
 *   正しい絵が出て、SVG の場面はどの月の月頭・週にも出ない
 * - SVG の場面（sceneSVG）は絵が無いときの代わりとして残る（photoBanner の代替の経路）
 * - 乱数：背景を選ぶだけでは Math.random を呼ばない（描き直しで乱数の回数が変わらない）
 * - 描いた道具：tools/paint_scenes.py に 5 場面と固定のシード
 * 実行: node test/qa_v31.js （jsdom は test/node_modules にある前提） */
const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(ROOT + '/v02/play.html', 'utf8');
const CSS = fs.readFileSync(ROOT + '/v02/style.css', 'utf8');
const JS = fs.readFileSync(ROOT + '/v02/game.js', 'utf8');
const INDEX = fs.readFileSync(ROOT + '/v02/index.html', 'utf8');
const TOOL = fs.readFileSync(ROOT + '/tools/paint_scenes.py', 'utf8');
const NEW = ['spring', 'tsuyu', 'autumn', 'stadium', 'hanazono'];

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  NG  ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function makeDom(preset, seed) {
  let s = (seed || 3131) >>> 0;
  const dom = new JSDOM(HTML, {
    url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      try { w.localStorage.clear(); } catch (e) {}
      if (preset) for (const k of Object.keys(preset)) w.localStorage.setItem(k, preset[k]);
      w.__rnd = 0;
      w.Math.random = function () {
        w.__rnd++;
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      w.confirm = () => true;
    }
  });
  const w = dom.window;
  return new Promise(res => {
    const iv = setInterval(() => { const a = w.document && w.document.querySelector('#app'); if (a && a.children.length) { clearInterval(iv); res(dom); } }, 10);
    setTimeout(() => { clearInterval(iv); res(dom); }, 3000);
  });
}
function H(dom) {
  const w = dom.window, d = w.document;
  return {
    window: w, document: d,
    text: () => d.querySelector('#app').textContent.replace(/\s+/g, ' '),
    btn: (label) => Array.from(d.querySelectorAll('button')).find(b => b.textContent.includes(label)),
    click: (label) => { const b = Array.from(d.querySelectorAll('button')).find(x => x.textContent.includes(label)); if (!b) throw new Error('button not found: ' + label); b.click(); }
  };
}
/* JPEG の大きさ（SOF の幅・高さ）を読む */
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const m = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if ((m >= 0xC0 && m <= 0xC3) || (m >= 0xC5 && m <= 0xC7) || (m >= 0xC9 && m <= 0xCB) || (m >= 0xCD && m <= 0xCF)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}
const NO_TUT = { 'hanazono.tut': '{"step":9,"done":1}' };
function preset(base, mut) {
  const gs = JSON.parse(base);
  gs.goalSet = true; gs.summary = null; gs.recruit = null; gs.board = null; gs.growReport = null; gs.growAcc = null;
  if (mut) mut(gs);
  return Object.assign({ 'hanazono.v02': JSON.stringify(gs) }, NO_TUT);
}
const wk = (mi, extra) => gs => { gs.monthIdx = mi; gs.board = { weekly: true, week: 0, log: [], dlg: null, picks: [] }; if (extra) extra(gs); };
async function driveToPreMatch(X) {
  for (let g = 0; g < 300; g++) {
    if (X.btn('キックオフ')) return true;
    if (X.btn('確認した')) { X.click('確認した'); await sleep(5); continue; }
    if (X.btn('指示を確定')) { X.click('指示を確定'); await sleep(3); continue; }
    const c = X.document.querySelector('.wcard');
    if (c) { c.click(); await sleep(2); continue; }
    await sleep(5);
  }
  return false;
}
async function playToSummary(X) {
  if (X.btn('監督に就任する')) { X.click('監督に就任する'); await sleep(20); }
  for (let g = 0; g < 20000; g++) {
    const t = X.text();
    if (X.btn('新年度へ')) return true;
    if (X.btn('新年度を始める')) { X.click('新年度を始める'); await sleep(10); continue; }
    if (X.btn('目標を決めて')) { X.click('目標を決めて'); await sleep(60); continue; }
    if (X.btn('確認した')) { X.click('確認した'); await sleep(5); continue; }
    if (X.btn('指示を確定')) { X.click('指示を確定'); await sleep(8); continue; }
    const c = X.document.querySelector('.wcard');
    if (c) { c.click(); await sleep(3); continue; }
    if (X.btn('キックオフ')) { X.click('キックオフ'); await sleep(8); continue; }
    const opts = [...X.document.querySelectorAll('.choices .btn.choice')];
    if (opts.length) {
      let best = opts[0], bp = -1;
      opts.forEach(o => { const p = +(o.dataset.p || 0); if (p > bp) { bp = p; best = o; } });
      best.click(); await sleep(3); continue;
    }
    if (X.btn('試合を進める')) { X.click('試合を進める'); await sleep(3); continue; }
    if (X.btn('やった！次へ')) { X.click('やった！次へ'); await sleep(8); continue; }
    if (X.btn('次へ')) { X.click('次へ'); await sleep(8); continue; }
    if (X.btn('わかった')) { X.click('わかった'); await sleep(5); continue; }
    throw new Error('stuck: ' + t.slice(0, 200));
  }
  throw new Error('guard exhausted before summary');
}

(async () => {
  console.log('[1] バージョン表記');
  check('<title> v1.6', INDEX.includes('<title>Road to HANAZONO v1.6</title>'));
  check('タイトルの見出し v1.6', JS.includes("'高校ラグビー育成シミュレーション v1.6'"));
  check('遊び方のバージョン v1.6（Web版）', JS.includes("['バージョン', 'v1.6（Web版）']"));
  check('play.html は 6MB 以下', HTML.length <= 6 * 1024 * 1024, HTML.length);

  console.log('[2] 新しい絵 5 枚（ファイル・CSS・登録）');
  const reg = (JS.match(/var PHOTO_SCENES = \{([^}]*)\}/) || ['', ''])[1];
  NEW.forEach(k => {
    const f = path.join(ROOT, 'v02', 'img', 'scene-' + k + '.jpg');
    const ok = fs.existsSync(f);
    const buf = ok ? fs.readFileSync(f) : Buffer.alloc(0);
    const sz = ok ? jpegSize(buf) : null;
    check(k + '：v02/img に実在・1600×800', ok && sz && sz.w === 1600 && sz.h === 800, sz && sz.w + 'x' + sz.h);
    check(k + '：300KB 以下', ok && buf.length <= 300 * 1024, buf.length);
    const m = CSS.match(new RegExp('^\\.photo-' + k + ' \\{ background-image: url\\("data:image/jpeg;base64,([^"]+)"\\); \\}$', 'm'));
    check(k + '：style.css の data URI がファイルと同じ中身', !!m && ok && m[1] === buf.toString('base64'));
    check(k + '：play.html に入っている', HTML.includes('.photo-' + k + ' { background-image: url("data:image/jpeg;base64,'));
    check(k + '：PHOTO_SCENES に登録', new RegExp('\\b' + k + ': 1').test(reg), reg);
  });
  check('CSS の写真クラスはすべて登録済み（登録の無い絵を置かない）', [...CSS.matchAll(/^\.photo-(\w+) \{ background-image/gm)].every(m => new RegExp('\\b' + m[1] + ': 1').test(reg)));

  console.log('[3] 割り当て（MONTH_PHOTOS・MATCH_PHOTOS）');
  const mp = (JS.match(/var MONTH_PHOTOS = \{([^}]*)\}/) || ['', ''])[1];
  const MP = {}; [...mp.matchAll(/(\d+): '(\w+)'/g)].forEach(m => { MP[m[1]] = m[2]; });
  check('4月＝spring・6月＝tsuyu・10/11月＝autumn', MP[0] === 'spring' && MP[2] === 'tsuyu' && MP[6] === 'autumn' && MP[7] === 'autumn', mp);
  check('既存の割り当ては不変（5/7/9月＝practice・8月＝camp・12/1月＝winter）', MP[1] === 'practice' && MP[3] === 'practice' && MP[5] === 'practice' && MP[4] === 'camp' && MP[8] === 'winter' && MP[9] === 'winter' && MP[10] === 'winter');
  check('全11か月に絵がある', Object.keys(MP).length === 11);
  const xp = (JS.match(/var MATCH_PHOTOS = \{([^}]*)\}/) || ['', ''])[1];
  const XP = {}; [...xp.matchAll(/(\d+): '(\w+)'/g)].forEach(m => { XP[m[1]] = m[2]; });
  check('練習試合＝tsuyu・県予選3試合＝stadium・花園2試合＝hanazono', XP[0] === 'tsuyu' && XP[1] === 'stadium' && XP[2] === 'stadium' && XP[3] === 'stadium' && XP[4] === 'hanazono' && XP[5] === 'hanazono', xp);
  check('SVG の場面は絵が無いときの代わりとして残る', JS.includes('if (!PHOTO_SCENES[key]) return banner(') && JS.includes('function sceneSVG(kind, mi)'));

  console.log('[4] 画面ごとの絵');
  const A = H(await makeDom(null));
  A.click('監督に就任する（ふつう）');
  await sleep(5);
  if (A.btn('終了する')) { A.click('終了する'); await sleep(5); }
  A.click('目標を決めて');
  await sleep(5);
  const base = A.window.localStorage.getItem('hanazono.v02');
  check('4月の月頭：桜の校庭', !!A.document.querySelector('.heropanel .photobanner.photo-spring') && !A.document.querySelector('.banner svg'));
  A.click('指示を確定');
  await sleep(10);
  check('4月の週：桜の校庭', !!A.document.querySelector('.wscene .photo-spring') && !A.document.querySelector('.banner svg'));
  const r0 = A.window.__rnd, s0 = A.window.localStorage.getItem('hanazono.v02');
  A.click('選手一覧'); await sleep(5);
  A.click('戻る'); await sleep(5);
  check('背景を選んで描き直しても乱数を使わない・セーブも変わらない', A.window.__rnd === r0 && A.window.localStorage.getItem('hanazono.v02') === s0, (A.window.__rnd - r0));
  A.window.close();

  const instExpect = { 0: 'spring', 1: 'practice', 2: 'tsuyu', 3: 'practice', 4: 'camp', 5: 'practice', 6: 'autumn', 7: 'autumn', 8: 'winter', 9: 'winter', 10: 'winter' };
  const instBad = [];
  for (const mi of Object.keys(instExpect)) {
    const X = H(await makeDom(preset(base, gs => { gs.monthIdx = +mi; if (+mi >= 9) gs.qualified = true; })));
    await sleep(10);
    const ok = !!X.document.querySelector('.heropanel .photobanner.photo-' + instExpect[mi]) && !X.document.querySelector('.banner svg');
    if (!ok) instBad.push(mi + ':' + [...X.document.querySelectorAll('.banner')].map(b => b.className).join('|'));
    X.window.close();
  }
  check('月頭の絵は全11か月とも割り当てどおり（SVG なし）', instBad.length === 0, instBad.join(' '));

  const wkExpect = { 0: 'spring', 1: 'practice', 2: 'tsuyu', 3: 'practice', 4: 'camp', 5: 'practice', 6: 'stadium', 7: 'stadium', 8: 'stadium', 9: 'hanazono', 10: 'hanazono' };
  const wkBad = [];
  for (const mi of Object.keys(wkExpect)) {
    const X = H(await makeDom(preset(base, wk(+mi, gs => { if (+mi >= 9) gs.qualified = true; }))));
    await sleep(10);
    const ok = !!X.document.querySelector('.wscene .photobanner.photo-' + wkExpect[mi]) && !X.document.querySelector('.banner svg');
    if (!ok) wkBad.push(mi + ':' + [...X.document.querySelectorAll('.banner')].map(b => b.className).join('|'));
    X.window.close();
  }
  check('週の画面の絵は全11か月とも割り当てどおり（試合月は会場の絵・SVG なし）', wkBad.length === 0, wkBad.join(' '));

  const pre = async (mi, cls) => {
    const X = H(await makeDom(preset(base, wk(mi, gs => { gs.board.week = 3; gs.board.picks = ['scrum', 'kick', 'rest']; if (mi >= 9) gs.qualified = true; }))));
    await sleep(10);
    const ok = await driveToPreMatch(X);
    const r = ok && !!X.document.querySelector('.photobanner.pmb.photo-' + cls) && !X.document.querySelector('.banner svg');
    const info = [...X.document.querySelectorAll('.banner')].map(b => b.className).join('|');
    X.window.close();
    return [r, info];
  };
  let r = await pre(2, 'tsuyu');
  check('対戦確認・練習試合（6月）：梅雨の校庭', r[0], r[1]);
  r = await pre(6, 'stadium');
  check('対戦確認・県予選（10月）：ナイターの競技場', r[0], r[1]);
  r = await pre(8, 'stadium');
  check('対戦確認・県予選決勝（12月）：ナイターの競技場', r[0], r[1]);
  r = await pre(9, 'rain');
  check('対戦確認・花園（1月）：雨の熱戦のまま', r[0], r[1]);

  console.log('[5] 新入生の画面（4月）');
  const R = H(await makeDom(null, 3132));
  await playToSummary(R);
  R.click('新年度へ'); await sleep(25);
  check('新入生を迎える画面：桜の校庭', R.text().includes('新入生を迎える') && !!R.document.querySelector('.heropanel .photobanner.photo-spring') && !R.document.querySelector('.banner svg'),
    [...R.document.querySelectorAll('.banner')].map(b => b.className).join('|'));
  R.window.close();

  console.log('[6] 描いた道具（tools/paint_scenes.py）');
  const scenes = (TOOL.match(/SCENES = \{([\s\S]*?)\n\}/) || ['', ''])[1];
  check('5 場面とも固定のシードで登録', NEW.every(k => new RegExp("'" + k + "': \\(scene_" + k + ', \\d+\\)').test(scenes)), scenes.replace(/\s+/g, ' '));
  check('style.css へ埋め込む手順（--embed）がある', TOOL.includes("'--embed'") && TOOL.includes('def embed('));
  check('生成 AI を使わない（numpy と Pillow だけ）', /^import argparse, math, os, sys$/m.test(TOOL) && /^import numpy as np$/m.test(TOOL) && /^from PIL import Image, ImageDraw, ImageFont$/m.test(TOOL) && !/requests|urllib|http/.test(TOOL));

  console.log('\n' + (fail ? '*** ' + fail + ' FAILURES ***' : 'ALL PASS (' + pass + ' ok, 0 NG)'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
