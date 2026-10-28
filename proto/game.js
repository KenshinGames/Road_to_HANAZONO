/* Road to HANAZONO 試作 v0 — 監督モード育成シミュレーション
 * 1シーズン(4月〜11月)。練習で育て、ハイライト選択式の試合で花園予選を勝ち抜く。 */
(function () {
  'use strict';
  var STORE_KEY = 'hanazono.v0';

  /* ---------------- データ ---------------- */
  var STATS = [
    { k: 'spd', n: 'スピード' }, { k: 'pow', n: 'パワー' }, { k: 'pas', n: 'パス' },
    { k: 'kik', n: 'キック' }, { k: 'tak', n: 'タックル' }, { k: 'sta', n: 'スタミナ' }
  ];
  var POSITIONS = [
    { no: 1, p: 'PR', g: 'FW', main: 'pow' }, { no: 2, p: 'HO', g: 'FW', main: 'pow' },
    { no: 3, p: 'PR', g: 'FW', main: 'pow' }, { no: 4, p: 'LO', g: 'FW', main: 'pow' },
    { no: 5, p: 'LO', g: 'FW', main: 'pow' }, { no: 6, p: 'FL', g: 'FW', main: 'tak' },
    { no: 7, p: 'FL', g: 'FW', main: 'tak' }, { no: 8, p: 'No8', g: 'FW', main: 'pow' },
    { no: 9, p: 'SH', g: 'BK', main: 'pas' }, { no: 10, p: 'SO', g: 'BK', main: 'kik' },
    { no: 11, p: 'WTB', g: 'BK', main: 'spd' }, { no: 12, p: 'CTB', g: 'BK', main: 'tak' },
    { no: 13, p: 'CTB', g: 'BK', main: 'spd' }, { no: 14, p: 'WTB', g: 'BK', main: 'spd' },
    { no: 15, p: 'FB', g: 'BK', main: 'kik' }
  ];
  var SURNAMES = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '斎藤', '清水'];
  var GIVEN = ['蓮', '颯太', '大和', '陽翔', '陸', '翼', '健太', '翔', '悠真', '蒼', '龍之介', '圭', '一真', '海斗', '拓海', '慎', '亮太', '豪', '誠', '仁'];
  var TRAITS = [
    { n: '練習の虫', growth: 1.35, inj: 1 },
    { n: '努力型', growth: 1.2, inj: 1 },
    { n: '天才肌', growth: 1.1, inj: 1 },
    { n: '大舞台に強い', growth: 1, inj: 1, clutch: 6 },
    { n: '負けず嫌い', growth: 1.1, inj: 1, clutch: 3 },
    { n: '冷静沈着', growth: 1, inj: 0.8, clutch: 3 },
    { n: 'ムードメーカー', growth: 1, inj: 1 },
    { n: '怪我がち', growth: 1.15, inj: 2.2 }
  ];
  var TRAININGS = [
    { k: 'sta', n: 'フィットネス', d: '走り込みでスタミナを底上げ' },
    { k: 'pow', n: 'ウェイト', d: '体の強さ、コンタクトの強さ' },
    { k: 'spd', n: 'スピード走', d: 'トップスピードと加速' },
    { k: 'pas', n: 'スキル練習', d: 'パスとハンドリング' },
    { k: 'kik', n: 'キック練習', d: 'キックの精度と飛距離' },
    { k: 'tak', n: 'ディフェンス', d: 'タックルと防御組織' }
  ];
  var OPPONENTS = [
    { name: '青葉高校', power: 38, note: '練習試合。まずは力試し' },
    { name: '県立工業高校', power: 45, note: '花園予選 準々決勝。FWの圧力が強い' },
    { name: '港商業高校', power: 50, note: '花園予選 準決勝。バックスの展開が速い' },
    { name: '帝都学園', power: 56, note: '花園予選 決勝。県内王者の強豪校' }
  ];
  /* ターン表。match は練習後に行う試合(OPPの番号)。camp は成長1.5倍 */
  var TURNS = [
    { m: '4月', label: '入学式。新チーム始動' },
    { m: '5月', label: '基礎を固める時期' },
    { m: '6月', label: '練習試合の月', match: 0 },
    { m: '7月', label: '夏休み直前' },
    { m: '8月', label: '夏合宿', camp: true },
    { m: '9月', label: '予選に向けた仕上げ' },
    { m: '10月', label: '花園予選 準々決勝', match: 1 },
    { m: '11月', label: '花園予選 準決勝', match: 2 },
    { m: '11月', label: '花園予選 決勝', match: 3, final: true }
  ];

  /* ---------------- 状態 ---------------- */
  var G = null;      // ゲーム全体
  var M = null;      // 試合中の一時状態
  var screen = 'home';
  var lastGains = null, lastEvent = null;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function ri(a, b) { return Math.floor(rnd(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function genPlayers() {
    var used = {};
    function uniqName() {
      var n, tries = 0;
      do { n = pick(SURNAMES) + ' ' + pick(GIVEN); tries++; } while (used[n] && tries < 50);
      used[n] = 1; return n;
    }
    var players = [];
    POSITIONS.forEach(function (pos, i) {
      var year = i < 6 ? 3 : (i < 11 ? 2 : 1);   // 上級生を多めに配置
      if (i >= 13) year = ri(1, 2);
      var base = year === 3 ? 50 : year === 2 ? 44 : 38;
      var pl = { id: i, name: uniqName(), year: year, pos: pos, stats: {}, trait: pick(TRAITS), injured: 0 };
      STATS.forEach(function (s) {
        var v = base + ri(-7, 7) + (s.k === pos.main ? 9 : 0) + (s.k === 'sta' ? 3 : 0);
        pl.stats[s.k] = clamp(Math.round(v), 20, 95);
      });
      players.push(pl);
    });
    /* 控え3名(ユーティリティ) */
    for (var j = 0; j < 3; j++) {
      var yr = ri(1, 2), b2 = yr === 2 ? 42 : 37;
      var sub = { id: 15 + j, name: uniqName(), year: yr, pos: { no: 16 + j, p: '控え', g: 'SUB', main: 'sta' }, stats: {}, trait: pick(TRAITS), injured: 0 };
      STATS.forEach(function (s) { sub.stats[s.k] = clamp(Math.round(b2 + ri(-6, 6)), 20, 95); });
      players.push(sub);
    }
    return players;
  }

  function newGame() {
    G = {
      turn: 0, players: genPlayers(), rep: 30,
      tactic: 'fw', nextBonus: 0, wins: 0, losses: 0,
      trainedThisTurn: false, over: false, champion: false
    };
    M = null; lastGains = null; lastEvent = null;
    save();
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(G)); } catch (e) {} }
  function loadSaved() {
    try { var s = localStorage.getItem(STORE_KEY); if (s) { G = JSON.parse(s); return !!G; } } catch (e) {}
    return false;
  }

  function statAvg(players, key, group) {
    var xs = players.filter(function (p) { return !group || p.pos.g === group; });
    if (!xs.length) return 0;
    return xs.reduce(function (a, p) { return a + p.stats[key]; }, 0) / xs.length;
  }
  function starters() {
    /* 背番号順に、怪我人は控えと入れ替え(控えの重複起用はしない) */
    var mains = G.players.slice(0, 15), subs = G.players.slice(15);
    var usedSub = {};
    return mains.map(function (p) {
      if (!p.injured) return p;
      var s = subs.find(function (x) { return !x.injured && !usedSub[x.id]; }) || p;
      usedSub[s.id] = 1;
      return s;
    });
  }
  function teamPower() {
    var st = starters();
    var tot = st.reduce(function (a, p) {
      return a + STATS.reduce(function (x, s) { return x + p.stats[s.k]; }, 0) / 6;
    }, 0);
    return Math.round(tot / st.length * 10) / 10;
  }
  function clutchBonus() {
    return starters().reduce(function (a, p) { return a + (p.trait.clutch || 0); }, 0) / 4;
  }

  /* ---------------- 育成 ---------------- */
  function doTraining(statKey, focusId) {
    var campMul = TURNS[G.turn].camp ? 1.5 : 1;
    var gains = [];
    G.players.forEach(function (p) {
      var g = Math.round(ri(2, 4) * p.trait.growth * campMul);
      if (p.id === focusId) g += Math.round(ri(3, 5) * p.trait.growth);
      if (g > 0 && p.stats[statKey] < 99) {
        p.stats[statKey] = Math.min(99, p.stats[statKey] + g);
        gains.push({ name: p.name, stat: statKey, g: g, focus: p.id === focusId });
      }
      /* 副次成長: 別の能力も少し伸びる */
      if (Math.random() < 0.7) {
        var others = STATS.filter(function (s) { return s.k !== statKey; });
        var s2 = pick(others).k;
        if (p.stats[s2] < 99) p.stats[s2] = Math.min(99, p.stats[s2] + 1);
      }
      /* 怪我: 確率は低め。怪我がちは高め */
      if (!p.injured && Math.random() < 0.025 * p.trait.inj) p.injured = 1;
    });
    G.players.forEach(function (p) { if (p.injured) p.injured = Math.max(0, p.injured - 0); });
    gains.sort(function (a, b) { return b.g - a.g; });
    lastGains = gains.slice(0, 6);
    lastEvent = rollEvent();
    G.trainedThisTurn = true;
    save();
  }
  function rollEvent() {
    var r = Math.random();
    if (r < 0.30) return null;
    var healthy = G.players.filter(function (p) { return !p.injured; });
    if (r < 0.42) { G.nextBonus += 3; return { t: 'OBの先輩が練習に顔を出し、差し入れと熱いアドバイス。チームの士気が上がった（次の試合 +3）' }; }
    if (r < 0.54) { G.rep += 5; return { t: '地域の小学生向けラグビー体験会を開催。部の評判が上がった（評判 +5）' }; }
    if (r < 0.66) {
      G.players.forEach(function (p) { if (p.injured) p.injured = 0; });
      return { t: 'マネージャーが入部！ 選手のケアが行き届き、怪我人が全員復帰した' };
    }
    if (r < 0.78) { G.nextBonus += 4; return { t: 'ライバル校の試合映像を入手。弱点が見えた（次の試合 +4）' }; }
    if (r < 0.90 && healthy.length) {
      var v = pick(healthy); v.injured = 1;
      return { t: v.name + ' が練習で足を痛めた。次の試合は欠場する', bad: true };
    }
    var s = pick(G.players);
    s.stats.sta = Math.max(20, s.stats.sta - 2);
    return { t: 'テスト期間。' + s.name + ' は勉強との両立に苦戦（スタミナ -2）', bad: true };
  }

/* ---------------- 試合 ---------------- */
var TACTICS = [
{ k: 'fw', n: 'FW重視', d: 'モールの成功率アップ', key: 'maul'},
{ k: 'bk', n: '展開重視', d: 'バックス展開の成功率アップ', key: 'wide'},
{ k: 'kick', n: 'キック重視', d: 'キック系の成功率アップ', key: 'kick'},
{ k: 'def', n: '守備固め', d: '守備の勝負どころの成功率アップ', key: 'def'}
];
function startMatch(oppIdx) {
var opp = OPPONENTS[oppIdx];
M = {
opp: opp, oppIdx: oppIdx, block: 0, my: 0, op: 0,
log: [], phase: 'play', pending: null, done: false, result: null,
bonus: G.nextBonus + clutchBonus(), final:!!TURNS[G.turn].final
};
G.nextBonus = 0;
M.log.push('キックオフ。相手は ' + opp.name + '（総合力 ' + opp.power + '）。' + (opp.note || ''));
screen = 'match';
render();
}
function convProb() { return clamp(0.45 + (statAvg(starters(), 'kik') - 50) * 0.008, 0.2, 0.9);}
function tryScore(mine) {
var pts = 5, txt = 'トライ！';
if (Math.random() < convProb()) { pts += 2; txt += ' コンバージョンも成功（+7点）';}
else txt += ' コンバージョンは外れた（+5点）';
if (mine) M.my += pts; else M.op += pts;
return txt;
}
function pgScore(mine) { if (mine) M.my += 3; else M.op += 3; return 'ペナルティゴール成功（+3点）';}
function scoreRoll(diff) { /* diff>0 で自チーム有利 */
var p = clamp(0.32 + diff * 0.012, 0.05, 0.75);
return Math.random() < p;
}
function playBlock() {
var diff = teamPower() - M.opp.power + M.bonus;
var minute = (M.block + 1) * 8;
var lines = [];
if (scoreRoll(diff)) lines.push('桜丘、攻め込む。' + tryScore(true) + (Math.random() < 0.4? '': ''));
else if (scoreRoll(-diff + 6)) lines.push('相手の攻撃を止めきれない。' + tryScore(false));
else if (Math.random() < 0.3) lines.push('桜丘のPG。' + pgScore(true));
else if (Math.random() < 0.22) lines.push('相手のPG。' + pgScore(false));
else lines.push('中盤での攻防。スコアは動かない');
M.log = M.log.concat(lines);
M.block++;
maybeHighlightOrEnd();
render();
}
function isHighlightBlock() { return M.block === 2 || M.block === 5 || M.block === 8;}
function maybeHighlightOrEnd() {
if (M.block >= 10) return finishMatch();
if (isHighlightBlock()) { M.phase = 'highlight'; M.pending = makeHighlight();}
}
function hlProb(statVal) {
return clamp(0.45 + (statVal - M.opp.power) * 0.02 + M.bonus * 0.006, 0.1, 0.92);
}
function makeHighlight() {
var st = starters();
var fwPow = statAvg(st, 'pow', 'FW'), bkGo = (statAvg(st, 'spd', 'BK') + statAvg(st, 'pas', 'BK')) / 2;
var kick = statAvg(st, 'kik'), tak = statAvg(st, 'tak'), sta = statAvg(st, 'sta');
var tac = TACTICS.find(function (t) { return t.k === G.tactic;});
function P(key, v) { return clamp(hlProb(v) + (tac && tac.key === key? 0.10: 0), 0.05, 0.95);}
if (M.block === 2) return {
kind: 'attack', title: '勝負どころ：敵陣深くでボールを持った！',
choices: [
{ n: 'モールで押し込む', key: 'maul', d: 'FWのパワーが勝負', stat: fwPow, p: P('maul', fwPow), win: 'モールが押し切った！ ' + '', lose: 'モールが崩れた…ターンオーバー'},
{ n: 'バックスに展開', key: 'wide', d: 'パスとスピードが勝負', stat: bkGo, p: P('wide', bkGo), win: '大きく展開、ウイングが走り切った！ ', lose: 'パスが乱れてノックオン'},
{ n: 'キックで裏を狙う', key: 'kick', d: 'キック精度が勝負', stat: kick, p: P('kick', kick), win: '絶妙のキックが転がり、最後は押し込んだ！ ', lose: 'キックが深すぎてタッチへ'}
]};
if (M.block === 5) return {
kind: 'defense', title: '勝負どころ：自陣ゴール前、相手の猛攻！',
choices: [
{ n: '前に出てプレッシャー', key: 'def', d: 'タックルが勝負', stat: tak, p: P('def', tak), win: '強烈なタックルでボールを奪った！', lose: 'タックルがずれて突破された…'},
{ n: '受けて立って粘る', key: 'def', d: 'スタミナが勝負', stat: sta, p: P('def', sta) - 0.05, win: '何度も止めて、最後は相手の反則を誘った！', lose: '粘りきれず押し込まれた…'},
{ n: '勝負タックル', key: 'def', d: 'ハイリスク・ハイリターン', stat: tak, p: P('def', tak) - 0.15, win: '起死回生のタックル！ ボールがこぼれた', lose: 'かわされて一気に持っていかれた…'}
]};
var behind = M.my <= M.op;
return {
kind: behind? 'attack': 'defense', title: behind? '勝負どころ：終盤、敵陣でのチャンス！': '勝負どころ：終盤、リードを守れるか！',
choices: behind? [
{ n: 'PGで確実に3点', key: 'kick', d: 'キック精度が勝負', stat: kick, p: P('kick', kick) + 0.08, win: '', lose: 'PGがわずかに外れた…'},
{ n: 'トライを取りにいく', key: 'wide', d: 'スピードとパスが勝負', stat: bkGo, p: P('wide', bkGo) - 0.05, win: '大外まで回して逆転トライ！ ', lose: 'あと一歩で止められた…'},
{ n: 'モールでじわじわ', key: 'maul', d: 'FWのパワーが勝負', stat: fwPow, p: P('maul', fwPow), win: 'モールがゴールラインを割った！ ', lose: 'モールが止められ、時間だけが過ぎる'}
]: [
{ n: 'キックで敵陣へ押し返す', key: 'kick', d: 'キック精度が勝負', stat: kick, p: P('kick', kick), win: '大きく蹴り出して敵陣で試合を進める', lose: 'キックが甘く、カウンターを浴びた…'},
{ n: 'ボールキープで時間を使う', key: 'def', d: 'スタミナが勝負', stat: sta, p: P('def', sta), win: 'ボールを保持し続けて時間を消化した', lose: 'プレッシャーでボールを失った…'},
{ n: 'タックルで止め続ける', key: 'def', d: 'タックルが勝負', stat: tak, p: P('def', tak), win: 'タックルの雨で相手を前進させない', lose: 'タックルがずれて突破された…'}
]};
}
function chooseHighlight(idx) {
var hl = M.pending, c = hl.choices[idx];
var ok = Math.random() < c.p;
var txt;
if (hl.kind === 'attack') {
if (ok) { txt = tryScore(true); M.log.push('' + c.n + ' → 成功！ ' + txt);}
else M.log.push('' + c.n + ' → ' + c.lose);
} else {
if (ok) M.log.push('' + c.n + ' → 成功！ ' + c.win);
else { txt = tryScore(false); M.log.push('' + c.n + ' → ' + c.lose + ' 相手の' + txt);}
}
M.pending = null; M.phase = 'play'; M.block++;
if (M.block >= 10) finishMatch();
render();
}
function finishMatch() {
M.done = true; M.phase = 'done';
var res;
if (M.my > M.op) res = 'win';
else if (M.my < M.op) res = 'lose';
else res = Math.random() < 0.5? 'win': 'lose'; // 同点は抽選(実際の花園予選の方式)
M.result = res;
M.log.push(res === 'win'? 'ノーサイド！ 桜丘高校の勝利！': 'ノーサイド。桜丘高校、敗れる…');
if (M.my === M.op) M.log.push('（同点のため抽選で勝敗を決定）');
if (res === 'win') { G.wins++; G.rep += M.final? 20: 6; growFromMatch();}
else G.losses++;
/* 怪我の回復は月単位: 試合後に1回復 */
G.players.forEach(function (p) { if (p.injured) p.injured = Math.max(0, p.injured - 1);});
save();
}
function growFromMatch() {
starters().forEach(function (p) {
if (Math.random() < 0.6) {
var s = pick(STATS).k;
p.stats[s] = Math.min(99, p.stats[s] + 1);
}
});
}
function afterMatchNext() {
var won = M.result === 'win';
var turn = TURNS[G.turn];
M = null;
if (turn.match === 0) { advanceTurn(); return;} // 練習試合は勝敗不問で続行
if (!won) { G.over = true; screen = 'ending'; save(); render(); return;}
if (turn.final) { G.over = true; G.champion = true; screen = 'ending'; save(); render(); return;}
advanceTurn();
}
function advanceTurn() {
G.turn++; G.trainedThisTurn = false;
screen = 'home'; save(); render();
}

  /* ---------------- シーン背景(SVG) ---------------- */
  function postsSVG(x, y, s, color) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')" stroke="' + color + '" stroke-width="5" fill="none" stroke-linecap="round">'
      + '<path d="M-16 0 V-64 M16 0 V-64 M-16 -38 H16"/></g>';
  }
  function ballSVG(x, y, s) {
    return '<g transform="translate(' + x + ',' + y + ') rotate(-24) scale(' + s + ')">'
      + '<ellipse rx="17" ry="11" fill="#8a4b2a"/>'
      + '<path d="M-17 0 H17" stroke="#f5e9dc" stroke-width="2.5"/>'
      + '<path d="M-4 -3 V3 M0 -3.5 V3.5 M4 -3 V3" stroke="#f5e9dc" stroke-width="1.6"/></g>';
  }
  function cloudsSVG(color) {
    return '<g fill="' + color + '" opacity="0.9"><ellipse cx="90" cy="30" rx="34" ry="11"/><ellipse cx="118" cy="24" rx="24" ry="9"/>'
      + '<ellipse cx="430" cy="22" rx="30" ry="10"/><ellipse cx="456" cy="17" rx="20" ry="8"/></g>';
  }
  function sceneSVG(kind) {
    var open = '<svg viewBox="0 0 560 150" width="100%" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid slice">';
    if (kind === 'home') return open
      + '<defs><linearGradient id="sk1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd0ff"/><stop offset="1" stop-color="#e8f8ff"/></linearGradient>'
      + '<linearGradient id="gr1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#57b26a"/><stop offset="1" stop-color="#2e7d46"/></linearGradient></defs>'
      + '<rect width="560" height="150" fill="url(#sk1)"/><circle cx="500" cy="28" r="17" fill="#ffd94d"/>'
      + cloudsSVG('#ffffff')
      + '<rect x="36" y="58" width="190" height="58" rx="3" fill="#f7f1e1"/><polygon points="28,60 131,30 234,60" fill="#b0593f"/>'
      + '<g fill="#7fb2d9"><rect x="56" y="74" width="22" height="16"/><rect x="92" y="74" width="22" height="16"/><rect x="128" y="74" width="22" height="16"/><rect x="164" y="74" width="22" height="16"/><rect x="56" y="96" width="22" height="14"/><rect x="164" y="96" width="22" height="14"/></g>'
      + '<rect x="112" y="94" width="18" height="22" fill="#8a5a3b"/>'
      + '<rect y="116" width="560" height="34" fill="url(#gr1)"/><rect y="130" width="560" height="3" fill="#ffffff" opacity="0.75"/>'
      + postsSVG(452, 128, 0.9, '#ffffff') + ballSVG(320, 132, 0.9) + '</svg>';
    if (kind === 'train') return open
      + '<defs><linearGradient id="sk2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a5dcff"/><stop offset="1" stop-color="#eafaff"/></linearGradient>'
      + '<linearGradient id="gr2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#63bd74"/><stop offset="1" stop-color="#2f8550"/></linearGradient></defs>'
      + '<rect width="560" height="46" fill="url(#sk2)"/>' + cloudsSVG('#ffffff')
      + '<rect y="46" width="560" height="104" fill="url(#gr2)"/>'
      + '<g stroke="#ffffff" opacity="0.8"><path d="M0 84 H560" stroke-width="3"/><path d="M0 122 H560" stroke-width="4"/><path d="M120 46 L70 150 M440 46 L490 150" stroke-width="2.5"/></g>'
      + postsSVG(90, 108, 1.05, '#ffffff')
      + '<g fill="#f2762e"><polygon points="300,138 312,118 324,138"/><polygon points="356,142 366,126 376,142"/><polygon points="410,138 420,122 430,138"/></g>'
      + ballSVG(255, 128, 1.15) + '</svg>';
    if (kind === 'match') return open
      + '<defs><linearGradient id="sk3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#131f3a"/><stop offset="1" stop-color="#2a4470"/></linearGradient>'
      + '<linearGradient id="gr3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4da562"/><stop offset="1" stop-color="#256b3d"/></linearGradient></defs>'
      + '<rect width="560" height="150" fill="url(#sk3)"/>'
      + '<g fill="#ffffff"><circle cx="70" cy="18" r="1.6"/><circle cx="150" cy="30" r="1.2"/><circle cx="250" cy="14" r="1.5"/><circle cx="360" cy="26" r="1.2"/><circle cx="470" cy="12" r="1.6"/><circle cx="520" cy="34" r="1.2"/></g>'
      + '<rect y="52" width="560" height="42" fill="#31456e"/>'
      + '<g><circle cx="30" cy="64" r="3" fill="#ffd166"/><circle cx="58" cy="72" r="3" fill="#f4f1de"/><circle cx="86" cy="62" r="3" fill="#e07a5f"/><circle cx="114" cy="74" r="3" fill="#ffd166"/><circle cx="142" cy="64" r="3" fill="#f4f1de"/><circle cx="170" cy="72" r="3" fill="#81b29a"/><circle cx="198" cy="62" r="3" fill="#ffd166"/><circle cx="226" cy="74" r="3" fill="#f4f1de"/><circle cx="254" cy="64" r="3" fill="#e07a5f"/><circle cx="282" cy="72" r="3" fill="#ffd166"/><circle cx="310" cy="62" r="3" fill="#f4f1de"/><circle cx="338" cy="74" r="3" fill="#81b29a"/><circle cx="366" cy="64" r="3" fill="#ffd166"/><circle cx="394" cy="72" r="3" fill="#f4f1de"/><circle cx="422" cy="62" r="3" fill="#e07a5f"/><circle cx="450" cy="74" r="3" fill="#ffd166"/><circle cx="478" cy="64" r="3" fill="#f4f1de"/><circle cx="506" cy="72" r="3" fill="#81b29a"/><circle cx="534" cy="64" r="3" fill="#ffd166"/></g>'
      + '<g stroke="#9fb6d9" stroke-width="4"><path d="M36 52 V16 M524 52 V16"/></g><g fill="#fff6bf"><rect x="14" y="8" width="44" height="12" rx="3"/><rect x="502" y="8" width="44" height="12" rx="3"/></g>'
      + '<rect y="94" width="560" height="56" fill="url(#gr3)"/><rect y="118" width="560" height="3.5" fill="#ffffff" opacity="0.8"/>'
      + postsSVG(280, 128, 1.0, '#ffffff') + '</svg>';
    if (kind === 'room') return open
      + '<rect width="560" height="112" fill="#f1e6cf"/><rect y="112" width="560" height="38" fill="#bd9260"/>'
      + '<rect y="108" width="560" height="5" fill="#a67c4e"/>'
      + '<rect x="30" y="22" width="215" height="76" rx="4" fill="#ffffff" stroke="#9aa5a1" stroke-width="3"/>'
      + '<g stroke-width="2.5" fill="none"><circle cx="80" cy="52" r="13" stroke="#c62f3b"/><circle cx="130" cy="66" r="13" stroke="#166534"/><circle cx="185" cy="48" r="13" stroke="#c62f3b"/>'
      + '<path d="M93 56 C 110 70, 105 78, 117 68" stroke="#166534"/><path d="M143 62 C 160 52, 165 58, 172 50" stroke="#c62f3b"/><path d="M60 86 H215" stroke="#9aa5a1" stroke-width="1.5"/></g>'
      + '<g fill="#74889e"><rect x="300" y="18" width="52" height="94" rx="3"/><rect x="360" y="18" width="52" height="94" rx="3"/><rect x="420" y="18" width="52" height="94" rx="3"/><rect x="480" y="18" width="52" height="94" rx="3"/></g>'
      + '<g stroke="#5b7186" stroke-width="2"><path d="M312 34 h28 M312 44 h28 M372 34 h28 M372 44 h28 M432 34 h28 M432 44 h28 M492 34 h28 M492 44 h28"/></g>'
      + '<g fill="#43586c"><circle cx="346" cy="70" r="3"/><circle cx="406" cy="70" r="3"/><circle cx="466" cy="70" r="3"/><circle cx="526" cy="70" r="3"/></g>'
      + '<rect x="286" y="120" width="262" height="9" rx="3" fill="#8a5a3b"/>' + ballSVG(120, 128, 1.0) + '</svg>';
    if (kind === 'hanazono') return open
      + '<defs><linearGradient id="sk4" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd0ff"/><stop offset="1" stop-color="#eafaff"/></linearGradient>'
      + '<linearGradient id="gr4" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#57b26a"/><stop offset="1" stop-color="#2e7d46"/></linearGradient></defs>'
      + '<rect width="560" height="150" fill="url(#sk4)"/><circle cx="496" cy="26" r="16" fill="#ffd94d"/>'
      + '<rect y="48" width="560" height="40" fill="#5b7ba6"/>'
      + '<g><circle cx="40" cy="60" r="3" fill="#ffd166"/><circle cx="80" cy="70" r="3" fill="#f4f1de"/><circle cx="120" cy="60" r="3" fill="#ffd166"/><circle cx="160" cy="70" r="3" fill="#f4f1de"/><circle cx="200" cy="60" r="3" fill="#e07a5f"/><circle cx="240" cy="70" r="3" fill="#ffd166"/><circle cx="280" cy="60" r="3" fill="#f4f1de"/><circle cx="320" cy="70" r="3" fill="#ffd166"/><circle cx="360" cy="60" r="3" fill="#f4f1de"/><circle cx="400" cy="70" r="3" fill="#e07a5f"/><circle cx="440" cy="60" r="3" fill="#ffd166"/><circle cx="480" cy="70" r="3" fill="#f4f1de"/><circle cx="520" cy="60" r="3" fill="#ffd166"/></g>'
      + '<rect y="88" width="560" height="62" fill="url(#gr4)"/><rect y="116" width="560" height="3.5" fill="#ffffff" opacity="0.8"/>'
      + postsSVG(280, 132, 1.15, '#ffffff')
      + '<g fill="#ffb7cd"><circle cx="52" cy="26" r="6"/><circle cx="72" cy="18" r="5"/><circle cx="36" cy="14" r="5"/><circle cx="90" cy="30" r="4"/><circle cx="150" cy="40" r="3.4"/><circle cx="330" cy="30" r="3.2"/><circle cx="430" cy="44" r="3.6"/><circle cx="500" cy="66" r="3.2"/><circle cx="210" cy="22" r="3"/></g>'
      + ballSVG(180, 134, 1.0) + '</svg>';
    return open
      + '<defs><linearGradient id="sk5" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8f5c"/><stop offset="1" stop-color="#ffe0ae"/></linearGradient></defs>'
      + '<rect width="560" height="150" fill="url(#sk5)"/><circle cx="280" cy="104" r="30" fill="#ffdf8e"/>'
      + '<g fill="#7a4a56" opacity="0.55"><ellipse cx="110" cy="34" rx="42" ry="9"/><ellipse cx="440" cy="26" rx="48" ry="10"/></g>'
      + '<rect y="112" width="560" height="38" fill="#5f4048"/>'
      + postsSVG(280, 140, 1.25, '#402b33') + ballSVG(150, 138, 0.9) + '</svg>';
  }
  function banner(kind) {
    var d = h('div', { class: 'banner' });
    d.innerHTML = sceneSVG(kind);
    return d;
  }

  /* ---------------- 画面 ---------------- */
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'onclick') el.onclick = attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function mount(node) { var a = document.getElementById('app'); a.innerHTML = ''; a.appendChild(node); }
  function sanitizeStats() {
    /* 壊れたセーブ(NaNやnullの能力値)を読み込み時に修復する */
    G.players.forEach(function (p) {
      STATS.forEach(function (s) {
        if (typeof p.stats[s.k] !== 'number' || !isFinite(p.stats[s.k])) p.stats[s.k] = 45;
      });
    });
  }
  function render() {
    if (G && G.players) sanitizeStats();
    if (!G) return newGameScreen();
    if (screen === 'match') return matchScreen();
    if (screen === 'squad') return squadScreen();
    if (screen === 'train') return trainScreen();
    if (screen === 'trainResult') return trainResultScreen();
    if (screen === 'preMatch') return preMatchScreen();
    if (screen === 'ending') return endingScreen();
    return homeScreen();
  }
  function header() {
    var t = (G && TURNS[G.turn]) || { m: '—', label: G ? 'シーズン終了' : '弱小校の挑戦が始まる' };
    return h('div', { class: 'hero' }, [
      h('h1', null, ['🏉 Road to HANAZONO']),
      h('p', null, ['桜丘高校ラグビー部 ・ ' + t.m + '（' + t.label + '）'])
    ]);
  }
  function teamCard() {
    return h('div', { class: 'card' }, [
      h('div', { class: 'rowline' }, [h('span', null, ['チーム総合力']), h('span', { class: 'big' }, [String(teamPower())])]),
      h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['部の評判']), h('span', null, [String(G.rep)])]),
      h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['今季の戦績']), h('span', null, [G.wins + '勝 ' + G.losses + '敗'])])
    ]);
  }
  function newGameScreen() {
    var w = h('div', { class: 'stack' });
    w.appendChild(header());
    w.appendChild(h('div', { class: 'card center' }, [
      h('p', null, ['弱小・桜丘高校ラグビー部の監督に就任した。練習で選手を育て、花園予選を勝ち抜いて、年末の花園へ。']),
      h('button', { class: 'btn primary', onclick: function () { newGame(); screen = 'home'; render(); } }, ['監督に就任する'])
    ]));
    mount(w);
  }
  function homeScreen() {
    var t = TURNS[G.turn];
    var w = h('div', { class: 'stack' });
    w.appendChild(header());
    w.appendChild(banner('home'));
    w.appendChild(teamCard());
    if (!G.trainedThisTurn) {
      w.appendChild(h('button', { class: 'btn primary', onclick: function () { screen = 'train'; render(); } }, ['今月の練習をする']));
    } else if (t.match != null) {
      var opp = OPPONENTS[t.match];
      w.appendChild(h('div', { class: 'card' }, [
        h('div', { class: 'big' }, ['次の試合：' + opp.name]),
        h('div', { class: 'sub' }, [opp.note + '（相手の総合力 ' + opp.power + '）'])
      ]));
      w.appendChild(h('button', { class: 'btn primary', onclick: function () { screen = 'preMatch'; render(); } }, ['試合に臨む']));
    } else {
      w.appendChild(h('button', { class: 'btn primary', onclick: function () { advanceTurn(); } }, ['来月へ進む']));
    }
    w.appendChild(h('button', { class: 'btn', onclick: function () { screen = 'squad'; render(); } }, ['選手一覧を見る']));
    w.appendChild(h('button', { class: 'btn small', onclick: function () { if (confirm('最初からやり直しますか？')) { localStorage.removeItem(STORE_KEY); location.reload(); } } }, ['最初からやり直す']));
    mount(w);
  }
  var selTraining = 'sta', selFocus = 0;
  function trainScreen() {
    var t = TURNS[G.turn];
    var w = h('div', { class: 'stack' });
    w.appendChild(header());
    w.appendChild(banner('train'));
    w.appendChild(h('div', { class: 'sec' }, [t.m + 'の練習' + (t.camp ? '（合宿：成長アップ！）' : '')]));
    var lab1 = h('label', { class: 'lab' }, ['練習方針']);
    var sel1 = h('select', { id: 'tr-sel' }, TRAININGS.map(function (tr) {
      return h('option', { value: tr.k }, [tr.n + ' — ' + tr.d]);
    }));
    sel1.value = selTraining;
    sel1.onchange = function () { selTraining = sel1.value; };
    var lab2 = h('label', { class: 'lab' }, ['重点育成する選手（大きく伸びる）']);
    var sel2 = h('select', { id: 'fc-sel' }, G.players.map(function (p) {
      return h('option', { value: String(p.id) }, [p.pos.no + ' ' + p.name + '（' + p.year + '年・' + p.pos.p + '・' + p.trait.n + '）']);
    }));
    sel2.value = String(selFocus);
    sel2.onchange = function () { selFocus = +sel2.value; };
    w.appendChild(h('div', { class: 'card' }, [lab1, sel1, lab2, sel2]));
    w.appendChild(h('button', { class: 'btn primary', onclick: function () { doTraining(selTraining, selFocus); screen = 'trainResult'; render(); } }, ['練習する']));
    w.appendChild(h('button', { class: 'btn', onclick: function () { screen = 'home'; render(); } }, ['戻る']));
    mount(w);
  }
  function trainResultScreen() {
    var w = h('div', { class: 'stack' });
    w.appendChild(header());
    w.appendChild(banner('train'));
    w.appendChild(h('div', { class: 'sec' }, ['練習の成果']));
    var card = h('div', { class: 'card' });
    if (lastGains && lastGains.length) {
      lastGains.forEach(function (g) {
        var sn = STATS.find(function (s) { return s.k === g.stat; }).n;
        card.appendChild(h('div', { class: 'rowline' }, [
          h('span', null, [(g.focus ? '⭐ ' : '') + g.name]),
          h('span', { class: 'gain' }, [sn + ' +' + g.g])
        ]));
      });
    } else card.appendChild(h('div', null, ['大きな伸びはなかった。地道にいこう']));
    w.appendChild(card);
    if (lastEvent) w.appendChild(h('div', { class: 'event' }, ['📣 ' + lastEvent.t]));
    w.appendChild(h('button', { class: 'btn primary', onclick: function () { screen = 'home'; render(); } }, ['戻る']));
    mount(w);
  }
  function squadScreen() {
    var w = h('div', { class: 'stack' });
    w.appendChild(header());
    w.appendChild(banner('room'));
    w.appendChild(h('div', { class: 'sec' }, ['選手一覧']));
    var table = h('table', { class: 'squad' });
    var head = h('tr', null, ['No', '名前', '年', 'Pos'].concat(STATS.map(function (s) { return s.n.slice(0, 2); })).map(function (x) { return h('th', null, [x]); }));
    table.appendChild(head);
    G.players.forEach(function (p) {
      var cells = [String(p.pos.no), p.name + (p.injured ? ' 🚑' : ''), String(p.year), p.pos.p].map(function (x, i) {
        return h('td', i === 1 ? { class: 'name' } : null, [x]);
      });
      STATS.forEach(function (s) { cells.push(h('td', null, [String(p.stats[s.k])])); });
      table.appendChild(h('tr', null, cells));
    });
    w.appendChild(h('div', { class: 'card' }, [table]));
    w.appendChild(h('div', { class: 'sub' }, ['特性は選手ごとに1つ。🚑は怪我で次の試合を欠場']));
    w.appendChild(h('button', { class: 'btn', onclick: function () { screen = 'home'; render(); } }, ['戻る']));
    mount(w);
  }
  function preMatchScreen() {
    var t = TURNS[G.turn], opp = OPPONENTS[t.match];
    var w = h('div', { class: 'stack' });
    w.appendChild(header());
    w.appendChild(banner('match'));
    w.appendChild(h('div', { class: 'card center' }, [
      h('div', { class: 'big' }, ['vs ' + opp.name]),
      h('div', { class: 'sub' }, [opp.note]),
      h('div', { class: 'rowline' }, [h('span', null, ['桜丘の総合力']), h('span', { class: 'big' }, [String(teamPower())])]),
      h('div', { class: 'rowline' }, [h('span', null, ['相手の総合力']), h('span', { class: 'big' }, [String(opp.power)])])
    ]));
    w.appendChild(h('div', { class: 'sec' }, ['今日の戦術']));
    var box = h('div', { class: 'card choices' });
    TACTICS.forEach(function (tc) {
      box.appendChild(h('button', { class: 'btn choice' + (G.tactic === tc.k ? ' primary' : ''), onclick: function () { G.tactic = tc.k; save(); render(); } }, [
        h('span', { class: 't' }, [tc.n]), h('span', { class: 'd' }, [' — ' + tc.d])
      ]));
    });
    w.appendChild(box);
    w.appendChild(h('button', { class: 'btn primary', onclick: function () { startMatch(t.match); } }, ['キックオフ']));
    w.appendChild(h('button', { class: 'btn', onclick: function () { screen = 'home'; render(); } }, ['戻る']));
    mount(w);
  }
  function matchScreen() {
    var w = h('div', { class: 'stack' });
    w.appendChild(banner('match'));
    var sb = h('div', { class: 'card score' }, [
      h('div', { class: 'team' }, [h('div', null, ['桜丘高校']), h('div', { class: 'pts' }, [String(M.my)])]),
      h('div', { class: 'vs' }, [M.done ? '試合終了' : Math.min(80, M.block * 8) + '分']),
      h('div', { class: 'team' }, [h('div', null, [M.opp.name]), h('div', { class: 'pts' }, [String(M.op)])])
    ]);
    w.appendChild(sb);
    var log = h('div', { class: 'log' });
    M.log.forEach(function (ln) {
      log.appendChild(h('div', ln.indexOf('勝負どころ') >= 0 ? { class: 'hl' } : (ln.indexOf('トライ') >= 0 || ln.indexOf('勝利') >= 0 ? { class: 'score-line' } : null), [ln]));
    });
    w.appendChild(log);
    if (M.phase === 'highlight' && M.pending) {
      w.appendChild(h('div', { class: 'sec' }, [M.pending.title]));
      var box = h('div', { class: 'choices' });
      M.pending.choices.forEach(function (c, i) {
        box.appendChild(h('button', { class: 'btn choice', onclick: function () { chooseHighlight(i); } }, [
          h('span', { class: 't' }, [c.n]), h('span', { class: 'd' }, [' — ' + c.d + '（成功率の目安 ' + Math.round(c.p * 100) + '%）'])
        ]));
      });
      w.appendChild(box);
    } else if (!M.done) {
      w.appendChild(h('button', { class: 'btn primary', onclick: function () { playBlock(); } }, ['試合を進める']));
    } else {
      w.appendChild(h('button', { class: 'btn primary', onclick: function () { afterMatchNext(); } }, [M.result === 'win' ? 'やった！次へ' : '次へ']));
    }
    mount(w);
    var lg = document.querySelector('.log'); if (lg) lg.scrollTop = lg.scrollHeight;
  }
  function endingScreen() {
    var w = h('div', { class: 'stack' });
    w.appendChild(h('div', { class: 'hero' }, [h('h1', null, [G.champion ? '🌸 花園出場決定！' : 'シーズン終了'])]));
    w.appendChild(banner(G.champion ? 'hanazono' : 'sunset'));
    w.appendChild(h('div', { class: 'card center' }, [
      h('p', null, [G.champion
        ? '決勝を制し、桜丘高校は初の花園出場を決めた。年末、花園ラグビー場のピッチに立つ。ここからが本当の物語だ。'
        : '今年の挑戦はここで終わった。でも、育てた選手と積み上げた部の力は来年につながる。']),
      h('div', { class: 'rowline' }, [h('span', null, ['最終チーム総合力']), h('span', { class: 'big' }, [String(teamPower())])]),
      h('div', { class: 'rowline' }, [h('span', null, ['部の評判']), h('span', null, [String(G.rep)])]),
      h('div', { class: 'rowline' }, [h('span', null, ['戦績']), h('span', null, [G.wins + '勝 ' + G.losses + '敗'])])
    ]));
    w.appendChild(h('button', { class: 'btn', onclick: function () { screen = 'squad'; render(); } }, ['最終メンバーを見る']));
    w.appendChild(h('button', { class: 'btn primary', onclick: function () { localStorage.removeItem(STORE_KEY); G = null; screen = 'home'; render(); } }, ['新しいシーズンを始める']));
    mount(w);
  }

  /* ---------------- 起動 ---------------- */
  if (!loadSaved()) G = null;
  if (G && G.over) screen = 'ending';
  render();
})();
