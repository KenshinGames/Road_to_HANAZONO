/* Road to HANAZONO — iOS 版の起動処理（Web 版の index.html・play.html には入らない）
 * scripts/build-www.mjs が www/index.html で game.js の代わりにこれを読み込み、下の準備のあとで game.js を読む。
 *  ① 消音スイッチに従う：Audio Session API で 'ambient' を指定する（マナーモードでは鳴らない・他アプリの音楽と混ざる）。
 *     ネイティブ側の AVAudioSession も AppDelegate で .ambient にしてある（二重の指定で確実にする）。
 *  ② セーブの二重化：localStorage の hanazono.* を丸ごと、ネイティブ側（HanazonoStore プラグイン＝Application Support の
 *     JSON ファイル。端末バックアップの対象）にも写す。WebKit がストレージ逼迫などで localStorage を消した場合に備え、
 *     起動時に localStorage に hanazono.* が1つも無く、ファイル側にあれば書き戻してから game.js を読む。
 *     正は localStorage（ゲームは従来どおり localStorage だけを読み書きする）。キー名・値は一切変えない。乱数にも触れない。
 */
(function () {
  'use strict';
  var PREFIX = 'hanazono.';
  try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) {}

  var cap = window.Capacitor;
  var isNative = false;
  try { isNative = !!(cap && typeof cap.nativePromise === 'function' && cap.isNativePlatform && cap.isNativePlatform()); } catch (e) {}

  function startGame() {
    var s = document.createElement('script');
    s.src = 'game.js';
    document.body.appendChild(s);
  }
  if (!isNative) { startGame(); return; }

  function call(method, opts) { return cap.nativePromise('HanazonoStore', method, opts || {}); }
  function snapshot() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) out[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    return out;
  }

  /* 書き込みはまとめて 0.4 秒後に1回。背面に回る時はすぐ書く。内容が前回と同じなら送らない */
  var timer = null, dirty = false, lastSent = null;
  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!dirty) return;
    dirty = false;
    var data = snapshot(), s = JSON.stringify(data);
    if (s === lastSent) return;
    lastSent = s;
    call('save', { data: data }).catch(function () { lastSent = null; dirty = true; });
  }
  function markDirty() { dirty = true; if (!timer) timer = setTimeout(flush, 400); }
  function mirror() {
    var P = Storage.prototype;
    ['setItem', 'removeItem', 'clear'].forEach(function (name) {
      var orig = P[name];
      P[name] = function (k) {
        var r = orig.apply(this, arguments);
        if (this === window.localStorage && (name === 'clear' || (typeof k === 'string' && k.indexOf(PREFIX) === 0))) markDirty();
        return r;
      };
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });
    window.addEventListener('pagehide', flush);
    markDirty(); /* 起動時点の内容を一度写す（書き戻した直後も含む） */
  }

  /* ネイティブ側が応答しない時もゲームは起動する。その場合は控えを古い状態で上書きしないよう、この起動中は写さない */
  var started = false;
  var guard = setTimeout(function () { if (!started) { started = true; startGame(); } }, 2000);
  call('load').then(function (res) {
    if (started) return;
    var saved = res && res.data;
    if (Object.keys(snapshot()).length === 0 && saved && typeof saved === 'object') {
      Object.keys(saved).forEach(function (k) {
        if (k.indexOf(PREFIX) === 0 && typeof saved[k] === 'string') { try { localStorage.setItem(k, saved[k]); } catch (e) {} }
      });
    }
    started = true; clearTimeout(guard);
    mirror();
    startGame();
  }).catch(function () {
    if (started) return;
    started = true; clearTimeout(guard);
    startGame();
  });
})();
