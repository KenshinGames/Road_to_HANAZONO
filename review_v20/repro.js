/* v0.20 再現確認: 実機寸法 932×430（iPhone 15 Pro 横画面）で週次画面の崩れを計測する。
 * 対象は現行 play.html（v0.19 相当）。監査は可視矩形ベース（review_v19 と同方式、閾値だけ 932×430 用）。 */
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '..', 'review-tools', 'node_modules', 'puppeteer-core'));
const { JSDOM } = require(path.join(__dirname, '..', 'test', 'node_modules', 'jsdom'));

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots');
const W = 932, H = 430;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const report = { errors: [], screens: {}, facts: {} };
const HTML = fs.readFileSync(path.join(ROOT, 'v02', 'play.html'), 'utf8');

function jsdomWith(saveJson) {
  return new JSDOM(HTML, {
    url: 'http://localhost/v02/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window) { if (saveJson) window.localStorage.setItem('hanazono.v02', saveJson); }
  });
}
function baseState() {
  const dom = jsdomWith(null);
  const b = [...dom.window.document.querySelectorAll('button')].find(x => x.textContent.includes('監督に就任する（ふつう）'));
  b.click();
  const st = JSON.parse(dom.window.localStorage.getItem('hanazono.v02'));
  dom.window.close();
  return st;
}
function weeklySave(mut) {
  const st = baseState();
  st.monthIdx = 0; st.goalSet = true; st.summary = null; st.recruit = null;
  st.board = { weekly: true, week: 0, log: [], dlg: null, picks: [] };
  if (mut) mut(st);
  return JSON.stringify(st);
}

async function newPage(browser, seedJson) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  page.on('console', m => { if (m.type() === 'error') report.errors.push('console: ' + m.text()); });
  page.on('pageerror', e => report.errors.push('pageerror: ' + e.message));
  await page.evaluateOnNewDocument((sj) => {
    try {
      localStorage.removeItem('hanazono.v02');
      localStorage.removeItem('hanazono.sound');
      if (sj) localStorage.setItem('hanazono.v02', sj);
    } catch (e) {}
  }, seedJson || null);
  await page.goto('file://' + path.join(ROOT, 'v02', 'play.html'), { waitUntil: 'load' });
  await sleep(700);
  return page;
}
const audit = (page) => page.evaluate((dims) => {
  const out = { docSW: document.documentElement.scrollWidth, docSH: document.documentElement.scrollHeight, issues: [], rects: {} };
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
  const els = [...document.querySelectorAll('#app button, #app select, #app .card, #app .hud, #app .actionbar, #app .wcard, #app .wstatus, #app .wscene, #app .log, #app .dlg')];
  const rs = els.map(e => ({ el: e, v: visibleRect(e) })).filter(x => x.v.width > 0 && x.v.height > 0);
  rs.forEach(x => {
    if (x.v.right > dims.W + 1 || x.v.bottom > dims.H + 1 || x.v.left < -1 || x.v.top < -1) {
      out.issues.push('overflow(visible): ' + (x.el.className || x.el.tagName) + ' [' + [x.v.left, x.v.top, x.v.right, x.v.bottom].map(Math.round).join(',') + ']');
    }
  });
  const inter = rs.filter(x => x.el.tagName === 'BUTTON' || x.el.tagName === 'SELECT' || x.el.classList.contains('wcard'));
  for (let i = 0; i < inter.length; i++) for (let j = i + 1; j < inter.length; j++) {
    const a = inter[i], b = inter[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ix = Math.min(a.v.right, b.v.right) - Math.max(a.v.left, b.v.left);
    const iy = Math.min(a.v.bottom, b.v.bottom) - Math.max(a.v.top, b.v.top);
    if (ix > 2 && iy > 2) out.issues.push('overlap(visible): ' + a.el.textContent.replace(/\s+/g, ' ').slice(0, 24) + ' <> ' + b.el.textContent.replace(/\s+/g, ' ').slice(0, 24));
  }
  /* 主要部品の実矩形（重なりの切り分け用） */
  ['.wscene', '.wcards', '.wstatus', '.lay2', '.log', '.dlg'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) { const r = el.getBoundingClientRect(); out.rects[sel] = [r.left, r.top, r.right, r.bottom].map(Math.round); }
  });
  const wc = [...document.querySelectorAll('.wcard')].map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; });
  out.rects.wcardTops = wc;
  return out;
}, { W, H });
async function snap(page, name) {
  const a = await audit(page);
  report.screens[name] = a;
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
}

(async () => {
  const crypto = require('crypto');
  const PF = '/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt';
  const pfSha = crypto.createHash('sha256').update(fs.readFileSync(PF)).digest('hex');
  const browser = await puppeteer.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox', '--hatch-webgl-allowed-domains-file=' + PF, '--hatch-webgl-allowed-domains-sha256=' + pfSha] });

  /* R1: 週次画面（4月・第1週、ログ初期文のみ） */
  const p1 = await newPage(browser, weeklySave(null));
  await snap(p1, 'repro_weekly_plain');
  await p1.close();

  /* R2: 週次画面（会話つき・ログ複数行）— ユーザーの実機スクショに近い状態 */
  const p2 = await newPage(browser, weeklySave(st => {
    const pid = st.players[0].id;
    st.board.week = 1;
    st.board.picks = ['scrum'];
    st.board.log = ['月が始まった。今週の活動を選ぼう', '🏉 スクラム強化。セットプレーが安定してきた', '🎲 選手同士で自主練が始まった'];
    st.board.dlg = { pid, text: '監督、今日のスクラムは手応えがありました。この調子でいきましょう' };
  }));
  await snap(p2, 'repro_weekly_dlg');
  await p2.close();

  /* R3: 週次画面（6月・試合月） */
  const p3 = await newPage(browser, weeklySave(st => { st.monthIdx = 2; st.board.week = 2; }));
  await snap(p3, 'repro_weekly_june');
  await p3.close();

  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'repro_report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error('ERROR', e); process.exit(2); });
