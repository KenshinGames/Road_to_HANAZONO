/* QA v0.28（v1.3）: セーブの引き継ぎコード＋iOS 版（native/）の殻
 * - バージョン表記 v1.3
 * - 設定 → 引き継ぎ：書き出しコードの形式（HANAZONO1: ＋ base64 ＋ 検査値）、別の端末（別の DOM）での読み込みで
 *   3スロット分のセーブが一致すること、端末ごとの設定（音・BGM・時短）は運ばないこと、読み込み後はチュートリアルを出さないこと
 * - 読み込みの検査：空欄／別の文字列／途中で切れた／書き換わった／セーブの無いコードは読み込めない。2段階の確認と「やめる」
 * - 乱数：引き継ぎ画面を開く・書き出す・検査するだけでは Math.random を呼ばない
 * - iOS の殻：native/www の組み立て結果と Xcode プロジェクト内の public が v02 と一致（同期漏れの検出）、
 *   Info.plist は横画面のみ、Swift のプラグインと画面がプロジェクトに登録済み
 * - native-boot.js（偽のネイティブ橋で検証）：localStorage が空ならファイル側の控えから書き戻してから起動する／
 *   書き込みが控えに写る／localStorage にデータがある時は控えで上書きしない／ネイティブが無い Web では素通り／
 *   ネイティブが応答しない時も起動し、その起動中は控えを書かない
 * 実行: node test/qa_v28.js （jsdom は test/node_modules にある前提） */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(ROOT + '/v02/play.html', 'utf8');
const CSS = fs.readFileSync(ROOT + '/v02/style.css', 'utf8');
const JS = fs.readFileSync(ROOT + '/v02/game.js', 'utf8');
const FIX = JSON.parse(fs.readFileSync(__dirname + '/fixtures/save_2slots.json', 'utf8'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  NG  ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function makeDom(preset, seed) {
  let s = (seed || 2828) >>> 0;
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
    }
  });
  return waitApp(dom);
}
function waitApp(dom, ms) {
  const w = dom.window;
  return new Promise(res => {
    const iv = setInterval(() => {
      const a = w.document && w.document.querySelector('#app');
      if (a && a.children.length) { clearInterval(iv); res(dom); }
    }, 10);
    setTimeout(() => { clearInterval(iv); res(dom); }, ms || 3000);
  });
}
function H(dom) {
  const w = dom.window, d = w.document;
  return {
    window: w, document: d,
    text: () => d.querySelector('#app').textContent.replace(/\s+/g, ' '),
    btn: (label) => Array.from(d.querySelectorAll('button')).find(b => b.textContent.includes(label)),
    click: (label) => { const b = Array.from(d.querySelectorAll('button')).find(x => x.textContent.includes(label)); if (!b) throw new Error('button not found: ' + label); b.click(); },
    ls: (k) => w.localStorage.getItem(k)
  };
}
function openTransfer(x) {
  x.click('⚙'); /* タイトルでは「⚙ 設定」、プレイ中は HUD の「⚙」 */
  x.click('📦 引き継ぎ');
}
function typeCode(x, code) {
  const ta = x.document.querySelectorAll('textarea.xfercode')[1];
  ta.value = code;
  ta.dispatchEvent(new x.window.Event('input'));
}
function loadBtn(x) { return x.btn('読み込む') || x.btn('本当に置き換える'); }
function infoText(x) { const el = x.document.querySelector('.xferinfo'); return el ? el.textContent : ''; }
const SAVE_KEYS = ['hanazono.v02', 'hanazono.slot.1', 'hanazono.slot.2', 'hanazono.slot.3', 'hanazono.slots'];

(async () => {
  console.log('[1] バージョン表記・CSS');
  check('title v1.3', /<title>Road to HANAZONO v1\.3<\/title>/.test(HTML));
  check('hero v1.3', JS.includes("高校ラグビー育成シミュレーション v1.3'"));
  check('guide v1.3', JS.includes("['バージョン', 'v1.3（Web版）']"));
  check('コード欄は 16px（iOS の入力欄の自動拡大を起こさない）', /\.xfercode\s*\{[^}]*font:\s*16px/.test(CSS));
  check('play.html は 3.5MB 以下', HTML.length <= 3.5 * 1024 * 1024, HTML.length);

  console.log('[2] 書き出し（2スロット入りの端末 A）');
  const A = H(await makeDom(Object.assign({ 'hanazono.sound': '0' }, FIX)));
  const r0 = A.window.__rnd;
  openTransfer(A);
  check('引き継ぎ画面が開く', A.text().includes('📦 引き継ぎ') && A.document.querySelectorAll('textarea.xfercode').length === 2);
  const code = A.document.querySelectorAll('textarea.xfercode')[0].value;
  check('書き出しコードの形式', /^HANAZONO1:[A-Za-z0-9+/=]+\.[0-9a-f]{8}$/.test(code), code.slice(0, 40));
  check('書き出し側の一覧に2スロット（3年目・10年目）', A.text().includes('スロット13年目') && A.text().includes('スロット210年目') && A.text().includes('スロット3あき'));
  check('文字数の表示', A.text().includes('（' + code.length + '文字）'));
  typeCode(A, code);
  check('自分のコードも検査を通る', infoText(A).includes('読み込めるコード'));
  check('引き継ぎ画面・書き出し・検査で乱数を使わない', A.window.__rnd === r0, (A.window.__rnd - r0));
  check('枠の入れ子なし', A.document.querySelectorAll('.card .card').length === 0);
  const aKeys = {}; SAVE_KEYS.forEach(k => { aKeys[k] = A.ls(k); });

  console.log('[2b] セーブの無い端末');
  const E = H(await makeDom(null));
  openTransfer(E);
  check('セーブが無ければ書き出さない（コード空・コピー不可）', E.document.querySelectorAll('textarea.xfercode')[0].value === '' && E.btn('コードをコピー').disabled && !E.text().includes('文字）'));
  E.window.close();

  console.log('[3] 読み込みの検査（別の端末 B：1年目のセーブ1つ）');
  const B = H(await makeDom({ 'hanazono.bgm': '{"on":0,"v":0.35}', 'hanazono.pref': '{"fast":1}', 'hanazono.tut': '{"step":2,"done":0}' }));
  B.click('監督に就任する（ふつう）');
  await sleep(5);
  const bOld = B.ls('hanazono.v02');
  check('B に1年目のセーブがある', !!bOld && JSON.parse(bOld).year === 1);
  openTransfer(B);
  check('空欄では読み込めない・メッセージなし', loadBtn(B).disabled && infoText(B) === '');
  typeCode(B, 'こんにちは');
  check('別の文字列', loadBtn(B).disabled && infoText(B).includes('引き継ぎコードではない'));
  const body = code.slice('HANAZONO1:'.length), dot = body.lastIndexOf('.');
  typeCode(B, 'HANAZONO1:' + body.slice(0, Math.floor(dot / 2)));
  check('途中で切れたコード（検査値なし）', loadBtn(B).disabled && infoText(B).includes('途中で切れている'));
  typeCode(B, 'HANAZONO1:' + body.slice(0, dot - 8) + body.slice(dot));
  check('途中が欠けたコード（検査値不一致）', loadBtn(B).disabled && infoText(B).includes('途中で切れている'));
  const mid = Math.floor(dot / 2), alt = body[mid] === 'A' ? 'B' : 'A';
  typeCode(B, 'HANAZONO1:' + body.slice(0, mid) + alt + body.slice(mid + 1));
  check('1文字書き換わったコード', loadBtn(B).disabled && infoText(B).includes('書き換わっている'));
  /* セーブの無いコード（同じ形式で作る） */
  const emptyJson = JSON.stringify({ v: 1, at: '2026-10-30T00:00:00.000Z', k: { 'hanazono.slots': '{"v":1,"active":1}' } });
  const emptyCode = 'HANAZONO1:' + B.window.btoa(unescape(encodeURIComponent(emptyJson))) + '.' + B.window.eval('(' + fnvSrc() + ')')(emptyJson);
  typeCode(B, emptyCode);
  check('セーブの入っていないコード', loadBtn(B).disabled && infoText(B).includes('セーブが入っていない'));
  typeCode(B, '  ' + code.slice(0, 500) + '\n' + code.slice(500) + '\n');
  check('改行・空白が混ざっても読める', !loadBtn(B).disabled && infoText(B).includes('読み込めるコード'));
  check('読み込み前の確認表示（中身の2スロット）', infoText(B).includes('スロット13年目') && infoText(B).includes('スロット210年目'));

  console.log('[4] 2段階の確認');
  loadBtn(B).click();
  check('1回目は確認だけ（保存は不変）', B.ls('hanazono.v02') === bOld && B.btn('本当に置き換える') && infoText(B).includes('置き換わる'));
  B.click('やめる');
  check('やめるで確認が解ける', B.btn('📥 読み込む') && !B.btn('本当に置き換える') && B.ls('hanazono.v02') === bOld);
  check('やめた後もコードは残る', B.document.querySelectorAll('textarea.xfercode')[1].value.replace(/\s+/g, '') === code);
  const rB = B.window.__rnd;
  B.click('📥 読み込む');
  B.click('本当に置き換える');
  await sleep(5);
  check('読み込み後はタイトル画面', B.text().includes('スロット1') && B.text().includes('つづきから'));
  check('3スロット分が A と一致', SAVE_KEYS.every(k => B.ls(k) === aKeys[k]), SAVE_KEYS.filter(k => B.ls(k) !== aKeys[k]).join(','));
  check('端末ごとの設定は運ばない（BGM・時短はそのまま）', B.ls('hanazono.bgm') === '{"on":0,"v":0.35}' && B.ls('hanazono.pref') === '{"fast":1}' && B.ls('hanazono.sound') === null);
  check('チュートリアルは完了扱い', JSON.parse(B.ls('hanazono.tut')).done === 1);
  check('読み込みで乱数を使わない', B.window.__rnd === rB, B.window.__rnd - rB);
  B.click('▶ つづきから始める');
  await sleep(5);
  const st = JSON.parse(B.ls('hanazono.v02'));
  check('続きから遊べる（3年目）', st.year === 3 && B.text().includes('3年目'));

  console.log('[5] iOS の殻（native/）');
  execFileSync('node', [ROOT + '/native/scripts/build-www.mjs'], { stdio: 'pipe' });
  const www = ROOT + '/native/www', pub = ROOT + '/native/ios/App/App/public';
  const files = ['index.html', 'style.css', 'game.js', 'native-boot.js', 'native.css'];
  check('Xcode の public が v02 と同期', files.every(f => fs.existsSync(pub + '/' + f) && fs.readFileSync(www + '/' + f).equals(fs.readFileSync(pub + '/' + f))),
    files.filter(f => !fs.existsSync(pub + '/' + f) || !fs.readFileSync(www + '/' + f).equals(fs.readFileSync(pub + '/' + f))).join(','));
  check('game.js・style.css は v02 そのまま', fs.readFileSync(www + '/game.js', 'utf8') === JS && fs.readFileSync(www + '/style.css', 'utf8') === CSS);
  const idx = fs.readFileSync(www + '/index.html', 'utf8');
  check('iOS の index は native-boot.js から起動', idx.includes('<script src="native-boot.js"></script>') && !idx.includes('game.js') && idx.includes('native.css'));
  check('Web 専用の head 要素を外す', !/apple-touch-icon|apple-mobile-web-app|rel="icon"/.test(idx));
  const plist = fs.readFileSync(ROOT + '/native/ios/App/App/Info.plist', 'utf8');
  const ori = (plist.match(/<key>UISupportedInterfaceOrientations<\/key>\s*<array>([\s\S]*?)<\/array>/) || [])[1] || '';
  check('Info.plist：横画面のみ', ori.includes('LandscapeLeft') && ori.includes('LandscapeRight') && !ori.includes('Portrait'));
  check('Info.plist：全画面・ステータスバー非表示・暗号化なし申告・日本語', /UIRequiresFullScreen<\/key>\s*<true\/>/.test(plist) && /UIStatusBarHidden<\/key>\s*<true\/>/.test(plist) &&
    /ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/.test(plist) && /CFBundleDevelopmentRegion<\/key>\s*<string>ja/.test(plist));
  const pbx = fs.readFileSync(ROOT + '/native/ios/App/App.xcodeproj/project.pbxproj', 'utf8');
  check('Swift 2本がビルド対象', /MainViewController\.swift in Sources/.test(pbx) && /HanazonoStorePlugin\.swift in Sources/.test(pbx));
  check('iPhone 専用（TARGETED_DEVICE_FAMILY = 1）', (pbx.match(/TARGETED_DEVICE_FAMILY = 1;/g) || []).length === 2);
  const swift = fs.readFileSync(ROOT + '/native/ios/App/App/HanazonoStorePlugin.swift', 'utf8');
  check('プラグイン名が native-boot.js と一致', swift.includes('jsName = "HanazonoStore"') && fs.readFileSync(www + '/native-boot.js', 'utf8').includes("'HanazonoStore'"));
  const cfg = JSON.parse(fs.readFileSync(ROOT + '/native/capacitor.config.json', 'utf8'));
  check('capacitor.config：appId・webDir', cfg.appId === 'com.kenshingames.hanazono' && cfg.webDir === 'www');
  check('AppDelegate：音は消音スイッチに従う（.ambient）', fs.readFileSync(ROOT + '/native/ios/App/App/AppDelegate.swift', 'utf8').includes('setCategory(.ambient'));

  console.log('[6] native-boot.js（偽のネイティブ橋）');
  const NB = fs.readFileSync(www + '/native-boot.js', 'utf8');
  /* native-boot.js と、それが後から読み込む game.js を jsdom に渡す（ネットワークには出ない） */
  const resources = { interceptors: [jsdom.requestInterceptor((request) => {
    const f = new URL(request.url).pathname.split('/').pop();
    const body = f === 'native-boot.js' ? NB : (f === 'game.js' ? JS : '');
    return new Response(body, { headers: { 'content-type': 'text/javascript; charset=utf-8' } });
  })] };
  /* store: ネイティブ側の控え（null=ネイティブなし）。hang=true なら load に応答しない */
  async function boot(local, store, opt) {
    opt = opt || {};
    const log = { saves: 0, last: null };
    const dom = new JSDOM('<!doctype html><html><body><div id="app"></div><script src="native-boot.js"></script></body></html>', {
      url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true, resources,
      beforeParse(w) {
        if (local) for (const k of Object.keys(local)) w.localStorage.setItem(k, local[k]);
        let s = 77; w.Math.random = function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
        if (store) {
          w.Capacitor = {
            isNativePlatform: () => true,
            nativePromise: (plugin, method, o) => {
              if (plugin !== 'HanazonoStore') return Promise.reject(new Error('no plugin'));
              if (method === 'load') return opt.hang ? new Promise(() => {}) : Promise.resolve({ data: Object.assign({}, store.data) });
              if (method === 'save') { log.saves++; log.last = JSON.parse(JSON.stringify(o.data)); store.data = log.last; return Promise.resolve(); }
              return Promise.reject(new Error('no method'));
            }
          };
        }
      }
    });
    await waitApp(dom, opt.hang ? 4000 : 3000);
    return { x: H(dom), log };
  }
  const snap = (x) => { const o = {}; const ls = x.window.localStorage; for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k.indexOf('hanazono.') === 0) o[k] = ls.getItem(k); } return o; };

  const s1 = { data: Object.assign({}, FIX) };
  const b1 = await boot(null, s1);
  check('空の localStorage に控えから書き戻して起動', b1.x.ls('hanazono.v02') === FIX['hanazono.v02'] && b1.x.ls('hanazono.slot.2') === FIX['hanazono.slot.2']);
  check('書き戻したセーブで再開（3年目）', b1.x.text().includes('3年目'));
  await sleep(600);
  check('起動時点の内容が控えに写る', b1.log.saves >= 1 && JSON.stringify(b1.log.last) === JSON.stringify(snap(b1.x)));
  const n1 = b1.log.saves;
  b1.x.click('⚙');
  b1.x.click('🔊 ON');
  await sleep(600);
  check('設定の変更も控えに写る（0.4 秒でまとめて1回）', b1.log.saves === n1 + 1 && b1.log.last['hanazono.sound'] === '0');
  b1.x.window.document.dispatchEvent(new b1.x.window.Event('visibilitychange'));
  check('内容が同じなら送らない', b1.log.saves === n1 + 1);

  const s2 = { data: { 'hanazono.v02': FIX['hanazono.slot.2'], 'hanazono.slots': '{"v":1,"active":1}' } };
  const b2 = await boot(FIX, s2);
  check('localStorage にデータがある時は控えで上書きしない', b2.x.ls('hanazono.v02') === FIX['hanazono.v02'] && b2.x.text().includes('3年目'));
  await sleep(600);
  check('控えは localStorage の内容に揃う', b2.log.last && b2.log.last['hanazono.v02'] === FIX['hanazono.v02'] && b2.log.last['hanazono.slot.2'] === FIX['hanazono.slot.2']);

  const b3 = await boot(FIX, null);
  check('ネイティブなし（Web）でも素通りで起動', b3.x.text().includes('3年目'));

  const s4 = { data: Object.assign({}, FIX) };
  const t0 = Date.now();
  const b4 = await boot(null, s4, { hang: true });
  check('ネイティブが応答しなくても約2秒で起動', b4.x.document.querySelector('#app').children.length > 0 && Date.now() - t0 < 3900, Date.now() - t0);
  b4.x.click('監督に就任する（ふつう）');
  await sleep(600);
  check('その起動中は控えを書かない（古い状態で上書きしない）', b4.log.saves === 0 && s4.data['hanazono.v02'] === FIX['hanazono.v02']);

  console.log('\n' + (fail ? 'FAIL' : 'ALL PASS') + ' (' + pass + ' ok, ' + fail + ' NG)');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e && e.stack || e); process.exit(2); });

/* テスト側で同じ検査値を作る（game.js の fnv1a と同じ式） */
function fnvSrc() {
  return 'function (str) { var x = 0x811c9dc5; for (var i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return ("0000000" + x.toString(16)).slice(-8); }';
}
