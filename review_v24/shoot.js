/* v0.24 実ブラウザ監査: レビュー主基準は iPhone 15 Pro 横画面 932×430（v0.20 で変更済み）。
 * v0.24 の追加: 新規画面（タイトルのスロット選択／設定画面／チュートリアルバー表示中の各画面）を
 * 両寸法の監査対象に加える。チュートリアルバーは通常フローに置くため、表示中の週次（.hastut で
 * 最小高さを緩和）・対戦確認・試合も撮る。目標設定は説明段落を削ったビフォーアフター対象。
 * v0.23 の追加: 実機の再生環境では有効高さが 430 より小さいため、監査寸法に 932×380 を追加し、
 * 全主要画面を 932×430 と 932×380 の両方で撮影・監査する（合格条件は両方で3点ゼロ）。
 * 1060×600 は補助として週次（会話）・勧誘比較・新入生紹介のみ撮る（430 の時だけ）。
 * 監査は可視矩形ベース＋ボタン/カード等の可視要素同士の重なり検出（祖先子孫は除外、モーダルとトーストは対象外）。
 * v0.21 の追加: 演出（FX）の途中・直後の姿も撮る。監査つき撮影（snap）は演出が落ち着いてから行い、
 * 演出の最中を狙う撮影（fx*）は監査なしの参考画像として別に撮る（transform の途中経過は矩形監査の対象外）。
 * 得点バナー（.fxbanner）は #app 外の固定レイヤーで監査対象セレクタには含まれない。
 * v0.22 の追加: 「枠内コンテンツの見切れ検出」を新設（audit 内の clip 検査）。
 *   - スクロール前提でない要素で scrollHeight/Width が client 寸法を超えたら clip-y / clip-x。
 *   - レポート類（.grboard）はスクロール可能でも「黙って見切れ」禁止：内容が枠を超えたら report-clip。
 *   - スクロール領域でも表示高さ 44px 未満まで潰れて内容が溢れていたら crushed-scroll
 *     （v0.21 までの「最近の出来事」が約28pxに潰れていた実例への対策）。
 *   - select は選択中テキストの実測幅（canvas）が表示可能幅を超えたら select-truncate。
 *   装飾レイヤー（場面背景・メーター内部・SVG）は対象外。 */
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '..', 'review-tools', 'node_modules', 'puppeteer-core'));
const { JSDOM } = require(path.join(__dirname, '..', 'test', 'node_modules', 'jsdom'));

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const report = { errors: [], screens: {}, facts: {} };
const HTML = fs.readFileSync(path.join(ROOT, 'v02', 'play.html'), 'utf8');

/* ---------- jsdom でセーブを作る ---------- */
function jsdomLoad(saveJson, seed) {
  const dom = new JSDOM(HTML, {
    url: 'http://localhost/v02/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window) {
      if (seed != null) {
        let a = seed >>> 0;
        window.Math.random = function () {
          a |= 0; a = (a + 0x6D2B79F5) | 0;
          let t = Math.imul(a ^ (a >>> 15), 1 | a);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }
      if (saveJson) window.localStorage.setItem('hanazono.v02', saveJson);
    }
  });
  const { window } = dom;
  window.confirm = () => true;
  return {
    window, document: window.document,
    text: () => window.document.getElementById('app').textContent.replace(/\s+/g, ' '),
    btn: (s) => [...window.document.querySelectorAll('button')].find(b => b.textContent.includes(s)),
    click: function (s) { const b = this.btn(s); if (!b) throw new Error('button not found: ' + s + ' || ' + this.text().slice(0, 120)); b.click(); },
    state: () => JSON.parse(window.localStorage.getItem('hanazono.v02')),
    save: () => window.localStorage.getItem('hanazono.v02')
  };
}
async function playToSummary(H) {
  if (H.btn('監督に就任する')) { H.click('監督に就任する'); await sleep(20); }
  let guard = 0;
  while (guard++ < 20000) {
    const t = H.text();
    if (H.btn('新年度へ')) return true;
    if (H.btn('新年度を始める')) { H.click('新年度を始める'); await sleep(10); continue; }
    if (H.btn('次へ')) { H.click('次へ'); await sleep(8); continue; } /* v0.20 紹介画面の通過 */
    if (H.btn('目標を決めて')) { H.click('目標を決めて'); await sleep(100); continue; }
    if (H.btn('確認した')) { H.click('確認した'); await sleep(8); continue; } /* v0.22: 成長レポートは専用レイアウト表示。確認すると指示フォームが出る */
    if (H.btn('指示を確定')) { H.click('指示を確定'); await sleep(8); continue; }
    const pc = H.document.querySelector('.pcard');
    if (pc) { pc.click(); await sleep(3); continue; }
    if (H.btn('キックオフ')) { H.click('キックオフ'); await sleep(8); continue; }
    const opts = [...H.document.querySelectorAll('.choices .btn.choice')];
    if (opts.length && t.includes('成功率の目安')) {
      let best = opts[0], bp = -1;
      opts.forEach(o => { const m = o.textContent.match(/(\d+)%/); const p = m ? +m[1] : 0; if (p > bp) { bp = p; best = o; } });
      best.click(); await sleep(3); continue;
    }
    if (H.btn('試合を進める')) { H.click('試合を進める'); await sleep(3); continue; }
    if (H.btn('やった！次へ')) { H.click('やった！次へ'); await sleep(8); continue; }
    throw new Error('stuck: ' + t.slice(0, 160));
  }
  throw new Error('guard exhausted');
}
function baseState() {
  const H = jsdomLoad(null, 101);
  H.click('監督に就任する（ふつう）');
  const st = H.state();
  H.window.close();
  return st;
}
function weeklySave(mut) {
  const st = baseState();
  st.monthIdx = 0; st.goalSet = true; st.summary = null; st.recruit = null;
  st.board = { weekly: true, week: 0, log: [], dlg: null, picks: [] };
  if (mut) mut(st);
  return JSON.stringify(st);
}
/* 2か月目（5月）の月頭指示：成長レポートが出ている状態 */
async function mayInstSave() {
  const H = jsdomLoad(null, 202);
  H.click('監督に就任する（ふつう）'); await sleep(20);
  if (H.btn('目標を決めて')) { H.click('目標を決めて'); await sleep(60); }
  H.click('指示を確定'); await sleep(15);
  for (let i = 0; i < 4; i++) { const c = H.document.querySelector('.wcard'); if (c) c.click(); await sleep(10); }
  const sv = H.save();
  H.window.close();
  return sv;
}

/* v0.23: 成長レポートの最悪条件セーブ（10行×複数能力＋信頼度）。実機で最終行が
 * アクションバーに隠れた不具合の再現・検証用。行データは実在の選手名で作る */
function grow10Save() {
  const st = baseState();
  st.monthIdx = 1; st.goalSet = true; st.summary = null; st.recruit = null; st.board = null;
  const rows = st.players.slice(0, 10).map((p, i) => ({
    name: p.name, focus: i === 0,
    stats: { pow: 3 + (i % 3), spd: 2, pas: 1 + (i % 2), kik: 2, tak: 1, sta: 2 },
    trust: i % 3 === 0 ? 5 : 0
  }));
  st.growReport = { label: '4月', rows };
  return JSON.stringify(st);
}

/* ---------- ブラウザ ---------- */
async function newPage(browser, seedJson, W, H, extraPreset) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  page.on('console', m => { if (m.type() === 'error') report.errors.push('console: ' + m.text()); });
  page.on('pageerror', e => report.errors.push('pageerror: ' + e.message));
  await page.evaluateOnNewDocument((sj, xp) => {
    try {
      localStorage.removeItem('hanazono.v02');
      localStorage.removeItem('hanazono.sound');
      localStorage.removeItem('hanazono.bgm');
      localStorage.removeItem('hanazono.slots');
      localStorage.removeItem('hanazono.slot.1');
      localStorage.removeItem('hanazono.slot.2');
      localStorage.removeItem('hanazono.slot.3');
      localStorage.removeItem('hanazono.tut');
      localStorage.removeItem('hanazono.pref');
      if (sj) localStorage.setItem('hanazono.v02', sj);
      if (xp) for (const k of Object.keys(xp)) localStorage.setItem(k, xp[k]);
    } catch (e) {}
  }, seedJson || null, extraPreset || null);
  await page.goto('file://' + path.join(ROOT, 'v02', 'play.html'), { waitUntil: 'load' });
  await sleep(650);
  /* あらすじモーダルが出ていたら閉じる（監査は背後の画面を対象にする） */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('グラウンドへ戻る'));
    if (b) b.click();
  });
  await sleep(250);
  return page;
}
const audit = (page, W, H) => page.evaluate((dims) => {
  const out = { docSW: document.documentElement.scrollWidth, docSH: document.documentElement.scrollHeight, issues: [], rects: {} };
  /* ページ全体がビューポートを超えたら「固定レイアウト崩れ」として記録する（v0.20 で追加した検出） */
  if (out.docSW > dims.W + 1 || out.docSH > dims.H + 1) out.issues.push('doc-overflow: doc is ' + out.docSW + 'x' + out.docSH + ' vs viewport ' + dims.W + 'x' + dims.H);
  const hud = document.querySelector('.hud');
  if (hud) out.hudH = Math.round(hud.getBoundingClientRect().height);
  function visibleRect(el) {
    let r = el.getBoundingClientRect();
    let v = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    let n = el.parentElement;
    while (n && n !== document.body) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll|hidden)/.test(cs.overflowY) || /(auto|scroll|hidden)/.test(cs.overflowX)) {
        const b = n.getBoundingClientRect();
        v.left = Math.max(v.left, b.left); v.top = Math.max(v.top, b.top);
        v.right = Math.min(v.right, b.right); v.bottom = Math.min(v.bottom, b.bottom);
      }
      n = n.parentElement;
    }
    v.width = v.right - v.left; v.height = v.bottom - v.top;
    return v;
  }
  const SEL = '#app button, #app select, #app .card, #app .hud, #app .actionbar, #app .wcard, #app .wstatus, #app .wscene, #app .log, #app .strip, #app .cmpcard, #app .banner, #app .photobanner, #app table.cmp, #app .grrow, #app .grlist, #app .winfo, #app .hero, #app h1, #app .slotcol, #app .tutbar, #app .slots'; /* v0.23: .hero/h1 も対象に加え、タイトル見出しが上方向へ押し出される見切れ（scrollHeight では検出できない）を拾う */
  /* v0.22: 場面背景レイヤー（.herobg / .wscenebg）は「背景＋半透明カード」の設計上、
   * パネル全面を覆うのが前提のため、重なり判定の対象から外す（中身同士の衝突を見るのが監査の目的） */
  const els = [...document.querySelectorAll(SEL)].filter(e => !e.closest('.digest') && !e.closest('.toast') && !e.classList.contains('herobg') && !e.classList.contains('wscenebg'));
  const rs = els.map(e => ({ el: e, v: visibleRect(e) })).filter(x => x.v.width > 0 && x.v.height > 0);
  rs.forEach(x => {
    if (x.v.right > dims.W + 1 || x.v.bottom > dims.H + 1 || x.v.left < -1 || x.v.top < -1) {
      out.issues.push('overflow(visible): ' + (x.el.className || x.el.tagName) + ' [' + [x.v.left, x.v.top, x.v.right, x.v.bottom].map(Math.round).join(',') + ']');
    }
  });
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i], b = rs[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ix = Math.min(a.v.right, b.v.right) - Math.max(a.v.left, b.v.left);
    const iy = Math.min(a.v.bottom, b.v.bottom) - Math.max(a.v.top, b.v.top);
    if (ix > 2 && iy > 2) out.issues.push('overlap(visible): ' + (a.el.className || a.el.tagName) + '「' + a.el.textContent.replace(/\s+/g, ' ').slice(0, 18) + '」 <> ' + (b.el.className || b.el.tagName) + '「' + b.el.textContent.replace(/\s+/g, ' ').slice(0, 18) + '」');
  }
  ['.wscene', '.wcards', '.wstatus', '.lay2', '.log', '.dlg', '.actionbar', '.cmpcard'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) { const r = el.getBoundingClientRect(); out.rects[sel] = [r.left, r.top, r.right, r.bottom].map(Math.round); }
  });
  /* v0.23: 見切れ修正の検証用メトリクス（成長レポートのリスト／週次ログの表示高と内容高） */
  out.metrics = {};
  const grl = document.querySelector('.grlist');
  if (grl) out.metrics.grlist = { clientH: grl.clientHeight, scrollH: grl.scrollHeight, rows: grl.querySelectorAll('.grrow').length };
  const wlg = document.querySelector('.wtop .log');
  if (wlg) out.metrics.wlog = { clientH: wlg.clientHeight, scrollH: wlg.scrollHeight };
  const growBtn = [...document.querySelectorAll('.actionbar .btn')].map(b => b.textContent.trim())[0];
  if (growBtn) out.metrics.actionBtn = growBtn;
  /* ===== v0.22: 枠内コンテンツの見切れ検出 ===== */
  out.clip = [];
  const clipPush = (s) => { out.clip.push(s); out.issues.push(s); };
  const isScrollBox = (el) => { const cs = getComputedStyle(el); return /(auto|scroll)/.test(cs.overflowY) || /(auto|scroll)/.test(cs.overflowX); };
  const coveredByScroll = (el) => { let n = el.parentElement; while (n && n !== document.body) { if (isScrollBox(n)) return true; n = n.parentElement; } return false; };
  const ctx2d = document.createElement('canvas').getContext('2d');
  const label = (el) => (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ').join('.') : el.tagName);
  const walk = [...document.querySelectorAll('#app, #app *')].filter(e => !e.closest('.digest') && !e.closest('.toasts'));
  walk.forEach(el => {
    if (el instanceof SVGElement) return;
    if (el.closest('.banner, .photobanner, .herobg, .wscenebg, .meter')) return; /* 装飾・場面背景・メーター内部は対象外 */
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    /* select: 選択中テキストが表示幅に収まるか（ネイティブ select は内部で切り捨てるため実測する） */
    if (el.tagName === 'SELECT') {
      const opt = el.options[el.selectedIndex];
      if (opt && opt.text) {
        try { ctx2d.font = cs.font; } catch (e) {}
        const tw = ctx2d.measureText(opt.text).width;
        const avail = el.clientWidth - 32; /* 右端のシェブロン＋内側余白ぶん */
        if (tw > avail) clipPush('select-truncate: 「' + opt.text + '」 text ' + Math.round(tw) + 'px > avail ' + avail + 'px');
      }
      return;
    }
    const clipY = el.scrollHeight > el.clientHeight + 1;
    const clipX = el.scrollWidth > el.clientWidth + 1;
    if (!clipY && !clipX) return;
    /* アイコン絵文字だけの要素は、グリフが line box を僅かにはみ出すのが通常で、overflow:visible のため見切れではない */
    const txt = el.textContent.replace(/\s+/g, '');
    if (!el.children.length && txt.length <= 4 && !/[\p{L}\p{N}]/u.test(txt)) return;
    /* レポート類はスクロール可能でも見切れ禁止（設計ルール） */
    if (el.matches('.grboard')) { clipPush('report-clip: ' + label(el) + ' scroll ' + el.scrollWidth + 'x' + el.scrollHeight + ' vs client ' + el.clientWidth + 'x' + el.clientHeight); return; }
    if (isScrollBox(el)) {
      if (clipY && el.clientHeight < 44) clipPush('crushed-scroll: ' + label(el) + ' clientH ' + el.clientHeight + ' scrollH ' + el.scrollHeight);
      return; /* スクロール領域そのものの見切れは仕様どおり（リスト類） */
    }
    if (coveredByScroll(el)) return; /* スクロール領域の中身はスクロールで届く */
    if (clipY) clipPush('clip-y: ' + label(el) + '「' + el.textContent.replace(/\s+/g, ' ').slice(0, 22) + '」 scrollH ' + el.scrollHeight + ' > clientH ' + el.clientHeight);
    if (clipX) clipPush('clip-x: ' + label(el) + '「' + el.textContent.replace(/\s+/g, ' ').slice(0, 22) + '」 scrollW ' + el.scrollWidth + ' > clientW ' + el.clientWidth);
  });
  return out;
}, { W, H });
let CURW = 932, CURH = 430, CURTAG = '';
async function snap(page, name, W, H) {
  if (W == null) { W = CURW; H = CURH; } /* v0.23: 呼び出し側が寸法を省略したら現在の監査寸法で監査する（v0.22 では未指定で doc はみ出し検査が無効化されていた） */
  /* v0.22: 監査の前に演出アニメーションを終了状態へ凍結する。transform の途中経過は
   * scroll 寸法を膨らませて見切れ検出のノイズになるため（v0.21 で分離した考え方の拡張） */
  await page.evaluate(() => {
    if (!document.getElementById('fxfreeze')) {
      const st = document.createElement('style');
      st.id = 'fxfreeze';
      st.textContent = '*,*::before,*::after{animation-duration:.01s!important;animation-delay:0s!important;transition:none!important}';
      document.head.appendChild(st);
    }
  });
  await sleep(90);
  const a = await audit(page, W, H);
  report.screens[name + CURTAG] = a;
  await page.screenshot({ path: path.join(SHOTS, name + CURTAG + '.png') });
}
const clickText = async (page, sub) => {
  const ok = await page.evaluate((s) => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(s));
    if (b) { b.click(); return true; } return false;
  }, sub);
  await sleep(350);
  return ok;
};
const clickCard = async (page, sub) => {
  const ok = await page.evaluate((s) => {
    const c = [...document.querySelectorAll('.wcard')].find(x => x.textContent.includes(s));
    if (c) { c.click(); return true; } return false;
  }, sub);
  await sleep(350);
  return ok;
};

(async () => {
  const crypto = require('crypto');
  const PF = '/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt';
  const pfSha = crypto.createHash('sha256').update(fs.readFileSync(PF)).digest('hex');
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox', '--hatch-webgl-allowed-domains-file=' + PF, '--hatch-webgl-allowed-domains-sha256=' + pfSha] });
  let MW = 932, MH = 430;

  /* 駆動セーブ群（summary / recruit / intro） */
  const HJ = jsdomLoad(null, 20200);
  await sleep(50);
  await playToSummary(HJ);
  const saveSummary = HJ.save();
  HJ.click('新年度へ'); await sleep(25);
  const saveRecruit = HJ.save();
  const tog = HJ.btn('獲得リストに入れる'); if (tog) { tog.click(); await sleep(12); }
  HJ.click('新年度を始める'); await sleep(25);
  const saveIntro = HJ.save();
  report.facts.drive = await Promise.resolve({
    recruitCands: JSON.parse(saveRecruit).recruit.cands.length,
    introList: (JSON.parse(saveIntro).intro || { list: [] }).list.length
  });
  HJ.window.close();

  async function runSet(W, H, tag, withFx) {
    MW = W; MH = H; CURW = W; CURH = H; CURTAG = tag;
  /* 01 title / 02 goal / 03 inst / 20 guide */
  const p0 = await newPage(browser, null, MW, MH);
  await snap(p0, '01_title');
  /* v0.23: タイトル見出しの上方向のはみ出しは visibleRect（祖先クリップ後の矩形）では検出できないため、実矩形で直接判定する */
  const heroTop = await p0.evaluate(() => { const e = document.querySelector('.titlephoto .hero'); return e ? Math.round(e.getBoundingClientRect().top) : null; });
  report.facts['titleHeroTop' + tag] = heroTop;
  if (heroTop != null && heroTop < 8) report.screens['01_title' + tag].issues.push('title-hero-clipped: hero top ' + heroTop + 'px');
  /* v0.24: タイトル起点の設定画面（ゲーム未開始・HUDなし） */
  await clickText(p0, '⚙ 設定');
  await snap(p0, '21_settings_title');
  await clickText(p0, '戻る');
  await clickText(p0, '遊び方');
  await snap(p0, '20_guide');
  await clickText(p0, '戻る');
  await clickText(p0, '監督に就任する');
  /* v0.24: 新規端末ではチュートリアルバーが出た状態で目標設定を撮る（バー込みで監査） */
  report.facts['tutGoal' + tag] = await p0.evaluate(() => !!document.querySelector('.tutbar'));
  await snap(p0, '02_goal');
  await clickText(p0, 'わかった');
  await clickText(p0, '目標を決めて');
  report.facts['tutInst' + tag] = await p0.evaluate(() => !!document.querySelector('.tutbar'));
  await snap(p0, '03_inst');
  await clickText(p0, 'わかった');
  await p0.close();

  /* 04 inst（成長レポートつき・2か月目） */
  const p1 = await newPage(browser, await mayInstSave(), MW, MH);
  report.facts.mayGrow = await p1.evaluate(() => document.getElementById('app').textContent.includes('成長レポート') || document.querySelector('.grboard') != null);
  await snap(p1, '04_inst_grow');
  /* fx: 成長レポートのライズ途中を狙う。同じセーブを素早く開き直し、行の出現直後に撮る（監査なしの参考画像） */
  {
    const pf = await browser.newPage();
    await pf.setViewport({ width: MW, height: MH, deviceScaleFactor: 2 });
    const sv = await mayInstSave();
    await pf.evaluateOnNewDocument((sj) => { try { if (sj) localStorage.setItem('hanazono.v02', sj); } catch (e) {} }, sv);
    await pf.goto('file://' + path.join(ROOT, 'v02', 'play.html'), { waitUntil: 'load' });
    await pf.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('グラウンドへ戻る')); if (b) b.click(); });
    await sleep(180);
    report.facts.fxGrowMid = await pf.evaluate(() => document.querySelectorAll('.grrow.fx-grow').length);
    await pf.screenshot({ path: path.join(SHOTS, 'fx5_grow_mid' + CURTAG + '.png') });
    await pf.close();
  }
  /* v0.23: 10行レポート（最悪条件）を両寸法で撮る */
  const p1b = await newPage(browser, grow10Save(), MW, MH);
  await snap(p1b, '04c_inst_grow10');
  await p1b.close();
  /* v0.22: レポートを確認すると通常の指示フォームが出る。統合ガラス（要約＋最近の出来事）の状態も撮る */
  await clickText(p1, '確認した');
  report.facts.herologMay = await p1.evaluate(() => { const e = document.querySelector('.herolog'); return e ? { clientH: e.clientHeight, scrollH: e.scrollHeight } : null; });
  await snap(p1, '04b_inst_may');
  /* 09/10 squad（同じページから遷移） */
  await clickText(p1, '選手一覧');
  await snap(p1, '09_squad_stat');
  await clickText(p1, 'プロフィール');
  await snap(p1, '10_squad_prof');
  /* 18 records */
  await clickText(p1, '記録・OB');
  await snap(p1, '18_records');
  /* v0.24: ゲーム中の設定画面（HUDあり・スロット概要つき） */
  await clickText(p1, '⚙');
  await snap(p1, '22_settings_game');
  await clickText(p1, '戻る');
  await p1.close();

  /* 05/06/07/08 weekly */
  const p2 = await newPage(browser, weeklySave(null), MW, MH);
  await snap(p2, '05_weekly_w1');
  await p2.close();
  /* v0.24: チュートリアルバー表示中の週次（.hastut の最小高さ緩和を両寸法で監査する） */
  const p2t = await newPage(browser, weeklySave(null), MW, MH, { 'hanazono.tut': '{"step":2,"done":0}' });
  report.facts['tutWeekly' + tag] = await p2t.evaluate(() => !!document.querySelector('.tutbar'));
  await snap(p2t, '05t_weekly_tut');
  await p2t.close();
  const p3 = await newPage(browser, weeklySave(st => {
    st.board.week = 1; st.board.picks = ['scrum'];
    st.board.log = ['月が始まった。今週の活動を選ぼう', '🏉 スクラム強化。セットプレーが安定してきた', '🎲 選手同士で自主練が始まった'];
    st.board.dlg = { pid: st.players[0].id, text: '監督、今日のスクラムは手応えがありました。この調子でいきましょう' };
  }), MW, MH);
  await snap(p3, '06_weekly_dlg');
  await p3.close();
  const p4 = await newPage(browser, weeklySave(st => { st.monthIdx = 2; st.board.week = 2; }), MW, MH, { 'hanazono.tut': '{"step":3,"done":0}' });
  await snap(p4, '07_weekly_june');
  /* 11 prematch / 12 lineup / 13 match: 週を進め切って到達 */
  for (let i = 0; i < 2; i++) await clickCard(p4, '休養・ケア');
  /* fx: 最後の週を選んだ直後、キーマン対比のスライドイン最中を狙って撮る（監査なしの参考画像） */
  await p4.evaluate(() => { const c = [...document.querySelectorAll('.wcard')].find(x => x.textContent.includes('休養・ケア')); if (c) c.click(); });
  for (let i = 0; i < 20; i++) { if (await p4.evaluate(() => !!document.querySelector('.keyman'))) break; await sleep(25); }
  report.facts.fxKmMid = await p4.evaluate(() => { const e = document.querySelector('.kmcol'); return e ? e.className : null; });
  await p4.screenshot({ path: path.join(SHOTS, 'fx1_prematch_keyman_mid' + CURTAG + '.png') });
  await sleep(600);
  report.facts.reachedPreMatch = await p4.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('キックオフ')));
  report.facts['tutPreMatch' + tag] = await p4.evaluate(() => !!document.querySelector('.tutbar'));
  await snap(p4, '11_prematch');
  await clickText(p4, 'わかった'); /* バーを進めて、試合画面でもバーが出る状態にする */
  /* fx: キーマン対比（VS バッジと両カラム）の見た目確認用に、vs カード内を対比までスクロールして撮る（参考画像） */
  await p4.evaluate(() => { const k = document.querySelector('.keyman'); if (k) k.scrollIntoView({ block: 'start' }); });
  await sleep(250);
  await p4.screenshot({ path: path.join(SHOTS, 'fx1b_keyman' + CURTAG + '.png') });
  await p4.evaluate(() => { const c = document.querySelector('.card.center'); if (c) c.scrollTop = 0; });
  await sleep(150);
  await clickText(p4, 'メンバー編成');
  await snap(p4, '12_lineup');
  await clickText(p4, '試合前に戻る');
  report.facts.backToPreMatch = await p4.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('キックオフ')));
  await clickText(p4, 'キックオフ');
  for (let i = 0; i < 2; i++) await clickText(p4, '試合を進める');
  report.facts['tutMatch' + tag] = await p4.evaluate(() => !!document.querySelector('.tutbar'));
  await snap(p4, '13_match');
  /* fx: 試合を最後まで進め、得点バナーとカットインの最中、勝利時の結果画面を撮る */
  {
    let shotBanner = false, shotCutin = false, guard = 0;
    while (guard++ < 300) {
      const st = await p4.evaluate(() => {
        let t = document.getElementById('app').textContent.replace(/\s+/g, ' ');
        if (!(t.includes('勝因の内訳') || t.includes('敗因の内訳'))) {
          const opts = [...document.querySelectorAll('.choices .btn.choice')];
          if (opts.length && t.includes('成功率の目安')) {
            let best = opts[0], bp = -1;
            opts.forEach(o => { const m = o.textContent.match(/(\d+)%/); const p = m ? +m[1] : 0; if (p > bp) { bp = p; best = o; } });
            best.click();
          } else {
            const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('試合を進める'));
            if (b) b.click();
          }
        }
        t = document.getElementById('app').textContent.replace(/\s+/g, ' ');
        return { done: t.includes('勝因の内訳') || t.includes('敗因の内訳'), win: t.includes('勝利！ 勝因の内訳'), banner: !!document.querySelector('.fxbanner'), cutin: !!document.querySelector('.cutin') };
      });
      if (!shotBanner && st.banner) { await p4.screenshot({ path: path.join(SHOTS, 'fx2_match_banner' + CURTAG + '.png') }); shotBanner = true; }
      if (!shotCutin && st.cutin) { await p4.screenshot({ path: path.join(SHOTS, 'fx3_match_cutin' + CURTAG + '.png') }); shotCutin = true; }
      if (st.done) {
        report.facts.fxMatch = { banner: shotBanner, cutin: shotCutin, win: st.win };
        if (st.win) await p4.screenshot({ path: path.join(SHOTS, 'fx4_match_win' + CURTAG + '.png') });
        break;
      }
      if (!shotBanner || !shotCutin) await sleep(60); else await sleep(160);
    }
    report.facts.matchStarted = true;
    await snap(p4, '19_match_done');
  }
  await p4.close();
  const p5 = await newPage(browser, weeklySave(st => { st.monthIdx = 4; }), MW, MH);
  await snap(p5, '08_weekly_august');
  await p5.close();

  /* 14 summary / 15 recruit cards / 16 recruit cmp / 17 intro */
  const p6 = await newPage(browser, saveSummary, MW, MH);
  await snap(p6, '14_summary');
  await clickText(p6, '新年度へ');
  await snap(p6, '15_recruit_cards');
  await clickText(p6, '比較で見る');
  await snap(p6, '16_recruit_cmp');
  await p6.close();
  const p7 = await newPage(browser, saveIntro, MW, MH);
  await snap(p7, '17_intro');
  await p7.close();

  /* v0.24: セーブありでタイトルへ戻った状態（スロット概要＋つづき）と、空き枠の選択状態 */
  const p8 = await newPage(browser, saveSummary, MW, MH);
  await clickText(p8, '⚙');
  await clickText(p8, 'タイトル画面へ');
  await snap(p8, '23_title_slots');
  await p8.evaluate(() => { const c = document.querySelectorAll('.slotcol')[1]; if (c) c.click(); });
  await sleep(350);
  await snap(p8, '24_title_slot2');
  await p8.close();

  if (withFx) {
  /* 補助（1060×600）: 週次（会話）・勧誘比較・紹介 */
  const q1 = await newPage(browser, weeklySave(st => {
    st.board.week = 1;
    st.board.log = ['月が始まった。今週の活動を選ぼう', '🏉 スクラム強化。セットプレーが安定してきた'];
    st.board.dlg = { pid: st.players[0].id, text: '監督、今日のスクラムは手応えがありました' };
  }), 1060, 600);
  await snap(q1, 's_weekly_dlg_1060', 1060, 600);
  await q1.close();
  const q2 = await newPage(browser, saveRecruit, 1060, 600);
  await clickText(q2, '比較で見る');
  await snap(q2, 's_recruit_cmp_1060', 1060, 600);
  await q2.close();
  const q3 = await newPage(browser, saveIntro, 1060, 600);
  await snap(q3, 's_intro_1060', 1060, 600);
  await q3.close();
  }
  }
  await runSet(932, 430, '_h430', true);
  await runSet(932, 380, '_h380', false);

  await browser.close();
  /* v0.22: 見切れ検出の集計（種別ごとの件数）を facts に残す */
  const clipKinds = {};
  Object.values(report.screens).forEach(s => (s.clip || []).forEach(c => { const k = c.split(':')[0]; clipKinds[k] = (clipKinds[k] || 0) + 1; }));
  report.facts.clipKinds = clipKinds;
  fs.writeFileSync(path.join(__dirname, 'report.json'), JSON.stringify(report, null, 2));
  const bad = Object.entries(report.screens).filter(([, s]) => s.issues.length);
  console.log('errors:', report.errors.length, '| screens:', Object.keys(report.screens).length, '| clip kinds:', JSON.stringify(clipKinds), '| screens with issues:', bad.map(([n]) => n).join(', ') || 'none');
  bad.forEach(([n, s]) => { console.log('=== ' + n); s.issues.forEach(i => console.log('  ' + i)); });
})().catch(e => { console.error('ERROR', e); process.exit(2); });
