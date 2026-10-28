/* Road to HANAZONO v0.2 — 横画面 / 月＋すごろく進行 / 世代交代キャリアループ
 * 範囲: 基盤(横画面) + 時間(進行カード+マス) + 世代交代(卒業・新入生・部の格)
 * 試合は v0.1 の3回停止・戦術を踏襲(場面連動化は次フェーズ) */
(function () {
  'use strict';
  var STORE_KEY = 'hanazono.v02';

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
  var SP_POS = { PR: 1, HO: 1, LO: 1, SH: 1 };   // セットピースユニットに含むポジション
  var SURNAMES = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '斎藤', '清水'];
  var GIVEN = ['蓮', '颯太', '大和', '陽翔', '陸', '翼', '健太', '翔', '悠真', '蒼', '龍之介', '圭', '一真', '海斗', '拓海', '慎', '亮太', '豪', '誠', '仁'];
  var TRAITS = [
    { n: '練習の虫', growth: 1.35, inj: 1 }, { n: '努力型', growth: 1.2, inj: 1 },
    { n: '天才肌', growth: 1.1, inj: 1 }, { n: '大舞台に強い', growth: 1, inj: 1, clutch: 6 },
    { n: '負けず嫌い', growth: 1.1, inj: 1, clutch: 3 }, { n: '冷静沈着', growth: 1, inj: 0.8, clutch: 3 },
    { n: 'ムードメーカー', growth: 1, inj: 1 }, { n: '怪我がち', growth: 1.15, inj: 2.2 }
  ];
  var LEVELS = [
    { n: '通常', mul: 1.0, fat: 5, inj: 1.0 },
    { n: '強め', mul: 1.4, fat: 9, inj: 1.6 },
    { n: '猛特訓', mul: 1.9, fat: 14, inj: 2.4 }
  ];
  var UNIT_STAT = { FW: 'pow', BK: 'pas', SP: 'kik' };
  var UNIT_NAME = { FW: 'FW（フィジカル）', BK: 'BK（スキル）', SP: 'セットピース' };
  var OPPONENTS = [
    { name: '青葉高校', power: 38, note: '練習試合。力試し' },
    { name: '県立西高校', power: 44, note: '花園予選 1回戦' },
    { name: '県立工業高校', power: 50, note: '花園予選 準決勝。FWの圧力が強い' },
    { name: '帝都学園', power: 56, note: '花園予選 決勝。県内王者の強豪校' },
    { name: '東都第一高校', power: 62, note: '花園 1回戦。全国レベルの強豪' }
  ];
  var GRADES = [
    { n: '弱小', min: 0, fresh: 34, count: 6 }, { n: 'そこそこ', min: 40, fresh: 37, count: 7 },
    { n: '中堅', min: 70, fresh: 40, count: 8 }, { n: '強豪', min: 110, fresh: 43, count: 9 },
    { n: '名門', min: 160, fresh: 46, count: 10 }
  ];
  var MONTHS = [
    { m: '4月', cells: 12 }, { m: '5月', cells: 12 }, { m: '6月', cells: 12, match: 0 },
    { m: '7月', cells: 12 }, { m: '8月', cells: 12, camp: true }, { m: '9月', cells: 12 },
    { m: '10月', cells: 12, match: 1 }, { m: '11月', cells: 12, match: 2 }, { m: '12月', cells: 12, match: 3 },
    { m: '1月', cells: 8, match: 4, needWin: true }
  ];
  var CELL_META = {
    pS: { n: '練習', ic: '💪', cls: 'c-prac' }, pB: { n: '特訓', ic: '🔥', cls: 'c-big' },
    ev: { n: 'イベント', ic: '🎲', cls: 'c-ev' }, rec: { n: '回復', ic: '💊', cls: 'c-rec' },
    free: { n: '休み', ic: '😴', cls: 'c-free' }, meet: { n: '作戦会議', ic: '📋', cls: 'c-meet' },
    end: { n: '月末', ic: '🏁', cls: 'c-end' }
  };

  /* ---------------- 状態 ---------------- */
  var G = null, M = null;
  var screen = 'title';
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function ri(a, b) { return Math.floor(rnd(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function shuffle(arr) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

  var namePool = {};
  function uniqName() {
    var n, tries = 0;
    do { n = pick(SURNAMES) + ' ' + pick(GIVEN); tries++; } while (namePool[n] && tries < 60);
    namePool[n] = 1; return n;
  }
  function makePlayer(posIdx, year, base) {
    var pos = POSITIONS[posIdx];
    var pl = { id: G ? G.nextId++ : posIdx, name: uniqName(), year: year, posIdx: posIdx, stats: {}, trait: pick(TRAITS), injured: 0, fatigue: ri(5, 20) };
    STATS.forEach(function (s) {
      var v = base + ri(-6, 6) + (s.k === pos.main ? 8 : 0) + (s.k === 'sta' ? 3 : 0);
      pl.stats[s.k] = clamp(Math.round(v), 20, 95);
    });
    return pl;
  }
  function overall(p) { return STATS.reduce(function (a, s) { return a + p.stats[s.k]; }, 0) / 6; }
  function newGame() {
    namePool = {};
    G = {
      year: 1, monthIdx: 0, players: [], obs: [], rep: 30, nextId: 1,
      career: { hana: 0, hanaWins: 0, titles: 0 },
      season: { wins: 0, losses: 0, result: '予選敗退' },
      inst: { team: 'sta', unit: 'FW', focus: 1, level: 0 },
      board: null, qualified: false, tactic: 'fw', nextBonus: 0,
      monthLog: [], summary: null
    };
    for (var i = 0; i < 15; i++) {
      var yr = i < 5 ? 3 : (i < 10 ? 2 : 1);
      G.players.push(makePlayer(i, yr, yr === 3 ? 50 : yr === 2 ? 44 : 38));
    }
    for (var j = 0; j < 3; j++) G.players.push(makePlayer(ri(0, 14), ri(1, 2), 40));
    sortRoster();
    M = null;
    save();
  }
  function sortRoster() {
    G.players.sort(function (a, b) { return (a.posIdx - b.posIdx) || (overall(b) - overall(a)); });
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(G)); } catch (e) {} }
  function loadSaved() {
    try { var s = localStorage.getItem(STORE_KEY); if (s) { G = JSON.parse(s); return !!G; } } catch (e) {}
    return false;
  }
  function sanitize() {
    if (!G || !G.players) return;
    G.players.forEach(function (p) {
      STATS.forEach(function (s) { if (typeof p.stats[s.k] !== 'number' || !isFinite(p.stats[s.k])) p.stats[s.k] = 45; });
      if (typeof p.fatigue !== 'number' || !isFinite(p.fatigue)) p.fatigue = 20;
    });
  }
  function gradeOf() {
    var g = GRADES[0];
    GRADES.forEach(function (x) { if (G.rep >= x.min) g = x; });
    return g;
  }
  function statAvg(players, key, group) {
    var xs = players.filter(function (p) { return !group || POSITIONS[p.posIdx].g === group; });
    if (!xs.length) return 0;
    return xs.reduce(function (a, p) { return a + p.stats[key]; }, 0) / xs.length;
  }
  function starters() {
    var used = {}, out = [];
    for (var n = 0; n < 15; n++) {
      var cands = G.players.filter(function (p) { return p.posIdx === n && !used[p.id]; })
        .sort(function (a, b) { return overall(b) - overall(a); });
      var chosen = cands.filter(function (p) { return !p.injured; })[0] || cands[0] || null;
      if (!chosen) {
        var rest = G.players.filter(function (p) { return !used[p.id]; }).sort(function (a, b) { return overall(b) - overall(a); });
        chosen = rest.filter(function (p) { return !p.injured; })[0] || rest[0] || null;
      }
      if (chosen) { used[chosen.id] = 1; out.push(chosen); }
    }
    return out;
  }
  function teamPower() {
    var st = starters(); if (!st.length) return 0;
    return Math.round(st.reduce(function (a, p) { return a + overall(p); }, 0) / st.length * 10) / 10;
  }
  function clutchBonus() { return starters().reduce(function (a, p) { return a + (p.trait.clutch || 0); }, 0) / 4; }
  function effOf(p) { return p.fatigue >= 70 ? 0.55 : (p.fatigue >= 40 ? 0.85 : 1); }
  function avgFatigue() { return Math.round(G.players.reduce(function (a, p) { return a + p.fatigue; }, 0) / Math.max(1, G.players.length)); }

  /* ---------------- 月頭指示と盤面 ---------------- */
  function unitOf(p) {
    var pos = POSITIONS[p.posIdx];
    if (SP_POS[pos.p]) return 'SP';
    return pos.g;
  }
  function startMonth() {
    var mo = MONTHS[G.monthIdx];
    var tpl = mo.cells >= 12 ? ['pS', 'pS', 'pS', 'pS', 'pB', 'pB', 'ev', 'ev', 'rec', 'free', 'meet'] : ['pS', 'pS', 'pB', 'ev', 'rec', 'free'];
    var cells = shuffle(tpl.slice()).map(function (t) { return { t: t, done: false }; });
    cells.push({ t: 'end', done: false });
    G.board = { cells: cells, pos: -1, hand: drawCards(3), log: [] };
    if (mo.camp) G.board.log.push('夏合宿の月。練習の実りが1.5倍になる');
    screen = 'board';
    save(); render();
  }
  function drawCards(n) {
    var pool = shuffle([1, 1, 2, 2, 3, 3]);
    return pool.slice(0, n);
  }
  function useCard(i) {
    var b = G.board; if (!b) return;
    var v = b.hand[i];
    b.pos = Math.min(b.pos + v, b.cells.length - 1);
    b.hand[i] = pick([1, 1, 2, 2, 3]);
    var cell = b.cells[b.pos];
    cell.done = true;
    resolveCell(cell.t);
    save(); render();
  }
  function resolveCell(t) {
    var b = G.board;
    if (t === 'pS' || t === 'pB') return applyPractice(t === 'pB');
    if (t === 'ev') { var e = rollEvent(); b.log.push('🎲 ' + (e ? e.t : '穏やかな日々。特に何もなかった')); return; }
    if (t === 'rec') {
      G.players.forEach(function (p) { p.fatigue = Math.max(0, p.fatigue - 25); });
      var inj = G.players.filter(function (p) { return p.injured; })[0];
      if (inj) { inj.injured = 0; b.log.push('💊 ケアの日。疲労が抜け、' + inj.name + ' が復帰した'); }
      else b.log.push('💊 ケアの日。全員の疲労が回復した');
      return;
    }
    if (t === 'free') { G.players.forEach(function (p) { p.fatigue = Math.max(0, p.fatigue - 12); }); b.log.push('😴 完全休養。リフレッシュした'); return; }
    if (t === 'meet') { G.nextBonus = Math.min(8, G.nextBonus + 3); G.players.forEach(function (p) { p.fatigue = Math.max(0, p.fatigue - 4); }); b.log.push('📋 作戦会議。次の試合の準備が整った（次の試合 +' + G.nextBonus + '）'); return; }
    if (t === 'end') return monthEnd();
  }
  function applyPractice(big) {
    var inst = G.inst, lvl = LEVELS[inst.level];
    var campMul = MONTHS[G.monthIdx].camp ? 1.5 : 1;
    var gains = [];
    G.players.forEach(function (p) {
      var eff = effOf(p);
      function gain(stat, base) {
        var g = Math.round(base * lvl.mul * p.trait.growth * campMul * eff * rnd(0.7, 1.3));
        if (g > 0 && p.stats[stat] < 99) {
          p.stats[stat] = Math.min(99, p.stats[stat] + g);
          gains.push({ name: p.name, stat: stat, g: g, focus: p.id === inst.focus });
        }
      }
      gain(inst.team, big ? ri(1, 3) : ri(0, 2));
      if (unitOf(p) === inst.unit) gain(UNIT_STAT[inst.unit], big ? ri(1, 2) : ri(0, 1));
      if (p.id === inst.focus) gain(inst.team, ri(2, 4));
      p.fatigue = Math.min(100, p.fatigue + Math.round(lvl.fat * (big ? 1.3 : 1)));
      if (!p.injured && Math.random() < 0.010 * lvl.inj * p.trait.inj * (p.fatigue >= 70 ? 2 : 1)) {
        p.injured = 1;
        G.board.log.push('🚑 ' + p.name + ' が練習で負傷。次の試合は欠場');
      }
    });
    gains.sort(function (a, b) { return b.g - a.g; });
    var top = gains.slice(0, 3).map(function (g) {
      return (g.focus ? '⭐' : '') + g.name + '（' + STATS.filter(function (s) { return s.k === g.stat; })[0].n + '+' + g.g + '）';
    });
    G.board.log.push((big ? '🔥 特訓！ ' : '💪 練習。') + (top.length ? top.join('、') : '大きな伸びはなし'));
  }
  function rollEvent() {
    var r = Math.random();
    if (r < 0.28) return null;
    var healthy = G.players.filter(function (p) { return !p.injured; });
    if (r < 0.40) { G.nextBonus = Math.min(8, G.nextBonus + 3); return { t: 'OBの先輩が練習に顔を出し、差し入れと熱いアドバイス。士気が上がった（次の試合 +3）' }; }
    if (r < 0.52) { G.rep += 5; return { t: '地域の小学生向けラグビー体験会を開催。部の評判が上がった（評判 +5）' }; }
    if (r < 0.64) { G.players.forEach(function (p) { p.injured = 0; }); return { t: 'マネージャーが入部！ ケアが行き届き、怪我人が全員復帰した' }; }
    if (r < 0.76) { G.nextBonus = Math.min(8, G.nextBonus + 4); return { t: 'ライバル校の試合映像を入手。弱点が見えた（次の試合 +4）' }; }
    if (r < 0.88 && healthy.length) { var v = pick(healthy); v.injured = 1; return { t: v.name + ' が体調を崩した。次の試合は欠場する', bad: true }; }
    var s = pick(G.players);
    s.stats.sta = Math.max(20, s.stats.sta - 2);
    return { t: 'テスト期間。' + s.name + ' は勉強との両立に苦戦（スタミナ -2）', bad: true };
  }
  function monthEnd() {
    var mo = MONTHS[G.monthIdx];
    G.monthLog = G.board ? G.board.log.slice(-6) : [];
    G.board = null;
    if (mo.match != null) {
      if (mo.needWin && !G.qualified) { seasonEnd(); return; }
      screen = 'preMatch'; save(); render(); return;
    }
    G.monthIdx++;
    screen = 'inst'; save(); render();
  }

/* ---------------- 試合(v0.1踏襲) ---------------- */
var TACTICS = [
{ k: 'fw', n: 'FW重視', d: 'モールの成功率アップ', key: 'maul'},
{ k: 'bk', n: '展開重視', d: 'バックス展開の成功率アップ', key: 'wide'},
{ k: 'kick', n: 'キック重視', d: 'キック系の成功率アップ', key: 'kick'},
{ k: 'def', n: '守備固め', d: '守備の勝負どころの成功率アップ', key: 'def'}
];
function oppPower(idx) { return OPPONENTS[idx].power + (idx >= 1? Math.min(8, (G.year - 1)): 0);}
function startMatch(oppIdx) {
var opp = OPPONENTS[oppIdx];
M = {
opp: opp, oppIdx: oppIdx, power: oppPower(oppIdx), block: 0, my: 0, op: 0,
log: [], phase: 'play', pending: null, done: false, result: null,
bonus: G.nextBonus + clutchBonus()
};
G.nextBonus = 0;
M.log.push('キックオフ。相手は ' + opp.name + '（総合力 ' + M.power + '）。' + opp.note);
screen = 'match'; render();
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
function scoreRoll(diff) { return Math.random() < clamp(0.32 + diff * 0.012, 0.05, 0.75);}
function playBlock() {
var diff = teamPower() - M.power + M.bonus;
var minute = (M.block + 1) * 8;
if (scoreRoll(diff)) M.log.push('桜丘、攻め込む。' + tryScore(true));
else if (scoreRoll(-diff + 6)) M.log.push('相手の攻撃を止めきれない。' + tryScore(false));
else if (Math.random() < 0.3) M.log.push('桜丘のPG。' + pgScore(true));
else if (Math.random() < 0.22) M.log.push('相手のPG。' + pgScore(false));
else M.log.push('中盤での攻防。スコアは動かない');
M.block++;
maybeHighlightOrEnd();
render();
}
function maybeHighlightOrEnd() {
if (M.block >= 10) return finishMatch();
if (M.block === 2 || M.block === 5 || M.block === 8) { M.phase = 'highlight'; M.pending = makeHighlight();}
}
function hlProb(statVal) { return clamp(0.45 + (statVal - M.power) * 0.02 + M.bonus * 0.006, 0.1, 0.92);}
function makeHighlight() {
var st = starters();
var fwPow = statAvg(st, 'pow', 'FW'), bkGo = (statAvg(st, 'spd', 'BK') + statAvg(st, 'pas', 'BK')) / 2;
var kick = statAvg(st, 'kik'), tak = statAvg(st, 'tak'), sta = statAvg(st, 'sta');
var tac = TACTICS.filter(function (t) { return t.k === G.tactic;})[0];
function P(key, v) { return clamp(hlProb(v) + (tac && tac.key === key? 0.10: 0), 0.05, 0.95);}
if (M.block === 2) return { kind: 'attack', title: '勝負どころ：敵陣深くでボールを持った！', choices: [
{ n: 'モールで押し込む', d: 'FWのパワーが勝負', p: P('maul', fwPow), lose: 'モールが崩れた…ターンオーバー'},
{ n: 'バックスに展開', d: 'パスとスピードが勝負', p: P('wide', bkGo), lose: 'パスが乱れてノックオン'},
{ n: 'キックで裏を狙う', d: 'キック精度が勝負', p: P('kick', kick), lose: 'キックが深すぎてタッチへ'}
]};
if (M.block === 5) return { kind: 'defense', title: '勝負どころ：自陣ゴール前、相手の猛攻！', choices: [
{ n: '前に出てプレッシャー', d: 'タックルが勝負', p: P('def', tak), win: '強烈なタックルでボールを奪った！', lose: 'タックルがずれて突破された…'},
{ n: '受けて立って粘る', d: 'スタミナが勝負', p: P('def', sta) - 0.05, win: '何度も止めて、最後は相手の反則を誘った！', lose: '粘りきれず押し込まれた…'},
{ n: '勝負タックル', d: 'ハイリスク・ハイリターン', p: P('def', tak) - 0.15, win: '起死回生のタックル！ ボールがこぼれた', lose: 'かわされて一気に持っていかれた…'}
]};
var behind = M.my <= M.op;
return { kind: behind? 'attack': 'defense', title: behind? '勝負どころ：終盤、敵陣でのチャンス！': '勝負どころ：終盤、リードを守れるか！', choices: behind? [
{ n: 'PGで確実に3点', d: 'キック精度が勝負', p: P('kick', kick) + 0.08, lose: 'PGがわずかに外れた…'},
{ n: 'トライを取りにいく', d: 'スピードとパスが勝負', p: P('wide', bkGo) - 0.05, lose: 'あと一歩で止められた…'},
{ n: 'モールでじわじわ', d: 'FWのパワーが勝負', p: P('maul', fwPow), lose: 'モールが止められ、時間だけが過ぎる'}
]: [
{ n: 'キックで敵陣へ押し返す', d: 'キック精度が勝負', p: P('kick', kick), win: '大きく蹴り出して敵陣で試合を進める', lose: 'キックが甘く、カウンターを浴びた…'},
{ n: 'ボールキープで時間を使う', d: 'スタミナが勝負', p: P('def', sta), win: 'ボールを保持し続けて時間を消化した', lose: 'プレッシャーでボールを失った…'},
{ n: 'タックルで止め続ける', d: 'タックルが勝負', p: P('def', tak), win: 'タックルの雨で相手を前進させない', lose: 'タックルがずれて突破された…'}
]};
}
function chooseHighlight(idx) {
var hl = M.pending, c = hl.choices[idx];
var ok = Math.random() < c.p;
if (hl.kind === 'attack') {
if (ok) M.log.push('' + c.n + ' → 成功！ ' + tryScore(true));
else M.log.push('' + c.n + ' → ' + c.lose);
} else {
if (ok) M.log.push('' + c.n + ' → 成功！ ' + (c.win || ''));
else M.log.push('' + c.n + ' → ' + c.lose + ' 相手の' + tryScore(false));
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
else res = Math.random() < 0.5? 'win': 'lose';
M.result = res;
M.log.push(res === 'win'? 'ノーサイド！ 桜丘高校の勝利！': 'ノーサイド。桜丘高校、敗れる…');
if (M.my === M.op) M.log.push('（同点のため抽選で勝敗を決定）');
if (res === 'win') {
G.season.wins++;
G.rep += M.oppIdx === 0? 2: (M.oppIdx === 3? 20: 6);
growFromMatch();
if (M.oppIdx === 3) { G.qualified = true; G.career.hana++;}
if (M.oppIdx === 4) { G.career.hanaWins++; G.career.titles++; G.rep += 20;}
} else G.season.losses++;
G.players.forEach(function (p) { if (p.injured) p.injured = Math.max(0, p.injured - 1);});
starters().forEach(function (p) { p.fatigue = Math.min(100, p.fatigue + 8);});
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
var idx = M.oppIdx;
M = null;
if (idx === 0) { advanceMonth(); return;}
if (idx === 4) { G.season.result = won? '花園で勝利！': '花園出場（1回戦敗退）'; seasonEnd(); return;}
if (!won) {
G.season.result = idx === 1? '予選1回戦敗退': (idx === 2? '予選準決勝敗退': '予選決勝敗退');
seasonEnd(); return;
}
if (idx === 3) { G.season.result = '花園出場決定'; advanceMonth(); return;}
advanceMonth();
}
function advanceMonth() {
G.monthIdx++;
screen = 'inst'; save(); render();
}

/* ---------------- 年度末と世代交代 ---------------- */
function seasonEnd() {
var grads = G.players.filter(function (p) { return p.year === 3;});
G.summary = {
result: G.season.result, wins: G.season.wins, losses: G.season.losses,
grade: gradeOf().n, grads: grads.map(function (p) { return { name: p.name, pos: POSITIONS[p.posIdx].p, avg: Math.round(overall(p))};}),
firstHana: G.qualified && G.career.hana === 1
};
screen = 'summary'; save(); render();
}
function nextYear() {
var grads = G.players.filter(function (p) { return p.year === 3;});
grads.forEach(function (p) {
G.obs.push({ name: p.name, pos: POSITIONS[p.posIdx].p, avg: Math.round(overall(p)), year: G.year});
});
if (G.obs.length > 40) G.obs = G.obs.slice(-40);
G.players = G.players.filter(function (p) { return p.year!== 3;});
G.players.forEach(function (p) { p.year++; p.injured = 0; p.fatigue = ri(5, 15);});
var gr = gradeOf();
for (var i = 0; i < gr.count; i++) {
var counts = [];
for (var n = 0; n < 15; n++) counts.push(G.players.filter(function (p) { return p.posIdx === n;}).length + rnd(0, 1.2));
var minIdx = 0;
counts.forEach(function (c, ix) { if (c < counts[minIdx]) minIdx = ix;});
G.players.push(makePlayer(minIdx, 1, gr.fresh));
}
sortRoster();
G.year++; G.monthIdx = 0; G.qualified = false; G.nextBonus = 0;
G.season = { wins: 0, losses: 0, result: '予選敗退'};
G.inst.focus = G.players[0]? G.players[0].id: 1;
G.summary = null;
screen = 'inst'; save(); render();
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
  function banner(kind, cls) {
    var d = h('div', { class: 'banner' + (cls ? ' ' + cls : '') });
    d.innerHTML = sceneSVG(kind).replace('<svg ', '<svg preserveAspectRatio="xMidYMid slice" ');
    return d;
  }

  /* ---------------- 画面（固定レイアウト） ---------------- */
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
  function render() {
    sanitize();
    if (!G) return titleScreen();
    if (screen === 'inst') return instScreen();
    if (screen === 'board') return boardScreen();
    if (screen === 'squad') return squadScreen();
    if (screen === 'preMatch') return preMatchScreen();
    if (screen === 'match') return matchScreen();
    if (screen === 'summary') return summaryScreen();
    if (screen === 'records') return recordsScreen();
    return boardScreen();
  }
  function hudBtn(label, target) {
    return h('button', { class: 'btn small', style: 'width:auto;padding:5px 12px', onclick: function () { screen = target; render(); } }, [label]);
  }
  function hud() {
    var mo = MONTHS[G.monthIdx] || { m: '—' };
    return h('div', { class: 'hud' }, [
      h('span', { class: 'ttl' }, ['🏉 桜丘高校']),
      h('span', { class: 'item' }, [G.year + '年目 ・ ' + mo.m]),
      h('span', { class: 'item' }, ['部の格 ', h('b', null, [gradeOf().n])]),
      h('span', { class: 'item' }, ['総合力 ', h('b', null, [String(teamPower())])]),
      h('span', { class: 'item' }, ['評判 ', h('b', null, [String(G.rep)])]),
      h('span', { class: 'sp' }, []),
      hudBtn('選手一覧', 'squad'),
      hudBtn('記録・OB', 'records')
    ]);
  }
  function wrap(children) {
    var w = h('div', { class: 'stack shell' });
    w.appendChild(h('div', { class: 'portrait-note' }, ['📱 横画面にすると1画面に収まるよ']));
    children.forEach(function (c) { w.appendChild(c); });
    mount(w);
  }
  function col(children) { return h('div', { class: 'col' }, children); }
  function titleScreen() {
    var inner = h('div', { class: 'titlewrap' }, [
      h('div', { class: 'hero' }, [h('h1', null, ['🏉 Road to HANAZONO']), h('p', null, ['高校ラグビー育成シミュレーション v0.2.3'])]),
      banner('home'),
      h('div', { class: 'card center' }, [
        h('p', null, ['弱小・桜丘高校ラグビー部の監督に就任した。月頭に練習指示を出し、進行カードで日々を進め、選手を育てよう。世代を超えて、花園の常連校を目指す。']),
        h('button', { class: 'btn primary', onclick: function () { newGame(); screen = 'inst'; render(); } }, ['監督に就任する'])
      ])
    ]);
    mount(h('div', { class: 'stack shell' }, [inner]));
  }
  function instScreen() {
    var mo = MONTHS[G.monthIdx];
    var left = [banner('train', 'grow')];
    if (G.monthLog && G.monthLog.length) {
      left.push(h('div', { class: 'card grow scroll' }, [h('div', { class: 'sub' }, ['先月の出来事'])].concat(G.monthLog.map(function (l) { return h('div', null, [l]); }))));
    }
    var card = h('div', { class: 'card grow' });
    card.appendChild(h('div', { class: 'sec' }, [mo.m + 'の練習指示' + (mo.camp ? '（合宿月：実り1.5倍）' : '') + (mo.match != null ? ' ／ 月末に試合あり' : '')]));
    var form = h('div', { class: 'form2' });
    function field(label, sel) { var d = h('div', null, [h('label', { class: 'lab' }, [label]), sel]); return d; }
    var s1 = h('select', null, STATS.map(function (s) { return h('option', { value: s.k }, [s.n]); }));
    s1.value = G.inst.team; s1.onchange = function () { G.inst.team = s1.value; save(); };
    var s2 = h('select', null, Object.keys(UNIT_STAT).map(function (u) {
      return h('option', { value: u }, [UNIT_NAME[u] + ' → ' + STATS.filter(function (s) { return s.k === UNIT_STAT[u]; })[0].n + 'アップ']);
    }));
    s2.value = G.inst.unit; s2.onchange = function () { G.inst.unit = s2.value; save(); };
    var s3 = h('select', null, G.players.map(function (p) {
      return h('option', { value: String(p.id) }, [POSITIONS[p.posIdx].no + ' ' + p.name + '（' + p.year + '年・' + POSITIONS[p.posIdx].p + '・' + p.trait.n + '）']);
    }));
    if (!G.players.some(function (p) { return p.id === G.inst.focus; })) G.inst.focus = G.players[0].id;
    s3.value = String(G.inst.focus); s3.onchange = function () { G.inst.focus = +s3.value; save(); };
    var s4 = h('select', null, LEVELS.map(function (lv, i) { return h('option', { value: String(i) }, [lv.n + '（成長×' + lv.mul + '）']); }));
    s4.value = String(G.inst.level); s4.onchange = function () { G.inst.level = +s4.value; save(); };
    form.appendChild(field('全体方針（チーム全員の底上げ）', s1));
    form.appendChild(field('ユニット練習', s2));
    form.appendChild(field('重点育成する選手', s3));
    form.appendChild(field('練習強度（成長と疲労・ケガのバランス）', s4));
    card.appendChild(form);
    var right = [card, h('button', { class: 'btn primary', onclick: function () { startMonth(); } }, ['指示を確定して月を始める'])];
    wrap([hud(), h('div', { class: 'lay2' }, [col(left), col(right)])]);
  }
  function boardScreen() {
    var b = G.board;
    if (!b) { wrap([hud(), h('div', { class: 'card' }, ['盤面がありません'])]); return; }
    var boardEl = h('div', { class: 'board' });
    b.cells.forEach(function (c, i) {
      var meta = CELL_META[c.t];
      boardEl.appendChild(h('div', { class: 'cell ' + meta.cls + (c.done ? ' done' : '') + (i === b.pos ? ' now' : '') }, [
        h('span', { class: 'ic' }, [meta.ic]), h('span', null, [meta.n])
      ]));
    });
    var boardCard = h('div', { class: 'card grow', style: 'display:flex;flex-direction:column' }, [
      h('div', { class: 'sec' }, [MONTHS[G.monthIdx].m + 'の盤面（止まったマスで日々が決まる）']), boardEl
    ]);
    var handCard = h('div', { class: 'card' });
    handCard.appendChild(h('div', { class: 'sec' }, ['進行カード（進むマス数）']));
    var hand = h('div', { class: 'hand' });
    b.hand.forEach(function (v, i) {
      hand.appendChild(h('button', { class: 'pcard', onclick: function () { useCard(i); } }, [
        h('span', { class: 'num' }, [String(v)]), h('span', { class: 'cap' }, [v + 'マス進む'])
      ]));
    });
    handCard.appendChild(hand);
    var info = h('div', { class: 'card' });
    info.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['チーム平均疲労']), h('span', null, [String(avgFatigue())])]));
    info.appendChild(h('div', { class: 'meter' }, [h('div', { style: 'width:' + avgFatigue() + '%' }, [])]));
    info.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['怪我人']), h('span', null, [String(G.players.filter(function (p) { return p.injured; }).length) + '人'])]));
    var log = h('div', { class: 'log grow' });
    (b.log.length ? b.log : ['月が始まった。進行カードを選ぼう']).forEach(function (ln) { log.appendChild(h('div', null, [ln])); });
    wrap([hud(), h('div', { class: 'lay2' }, [col([boardCard]), col([handCard, info, log])])]);
    var lg = document.querySelector('.log'); if (lg) lg.scrollTop = lg.scrollHeight;
  }
  function squadScreen() {
    var table = h('table', { class: 'squad' });
    table.appendChild(h('tr', null, ['No', '名前', '年', 'Pos'].concat(STATS.map(function (s) { return s.n.slice(0, 2); })).concat(['疲労']).map(function (x) { return h('th', null, [x]); })));
    G.players.forEach(function (p) {
      var cells = [String(POSITIONS[p.posIdx].no), p.name + (p.injured ? ' 🚑' : ''), String(p.year), POSITIONS[p.posIdx].p].map(function (x, i) {
        return h('td', i === 1 ? { class: 'name' } : null, [x]);
      });
      STATS.forEach(function (s) { cells.push(h('td', null, [String(p.stats[s.k])])); });
      cells.push(h('td', null, [String(p.fatigue)]));
      table.appendChild(h('tr', null, cells));
    });
    wrap([hud(),
      h('div', { class: 'card grow scroll' }, [table]),
      h('button', { class: 'btn', onclick: function () { screen = G.board ? 'board' : 'inst'; render(); } }, ['戻る'])
    ]);
  }
  function preMatchScreen() {
    var mo = MONTHS[G.monthIdx], opp = OPPONENTS[mo.match];
    var vs = h('div', { class: 'card center' }, [
      h('div', { class: 'big' }, ['vs ' + opp.name]),
      h('div', { class: 'sub' }, [opp.note]),
      h('div', { class: 'rowline' }, [h('span', null, ['桜丘の総合力']), h('span', { class: 'big' }, [String(teamPower())])]),
      h('div', { class: 'rowline' }, [h('span', null, ['相手の総合力']), h('span', { class: 'big' }, [String(oppPower(mo.match))])])
    ]);
    var box = h('div', { class: 'card choices grow scroll' });
    box.appendChild(h('div', { class: 'sec' }, ['今日の戦術']));
    TACTICS.forEach(function (tc) {
      box.appendChild(h('button', { class: 'btn choice' + (G.tactic === tc.k ? ' primary' : ''), onclick: function () { G.tactic = tc.k; save(); render(); } }, [
        h('span', { class: 't' }, [tc.n]), h('span', { class: 'd' }, [' — ' + tc.d])
      ]));
    });
    wrap([hud(), h('div', { class: 'lay2' }, [
      col([banner('match', 'grow'), vs]),
      col([box, h('button', { class: 'btn primary', onclick: function () { startMatch(mo.match); } }, ['キックオフ'])])
    ])]);
  }
  function matchScreen() {
    var sb = h('div', { class: 'card score' }, [
      h('div', { class: 'team' }, [h('div', null, ['桜丘高校']), h('div', { class: 'pts' }, [String(M.my)])]),
      h('div', { class: 'vs' }, [M.done ? '試合終了' : Math.min(80, M.block * 8) + '分']),
      h('div', { class: 'team' }, [h('div', null, [M.opp.name]), h('div', { class: 'pts' }, [String(M.op)])])
    ]);
    var ctrl = h('div', { class: 'card grow scroll' });
    if (M.phase === 'highlight' && M.pending) {
      ctrl.appendChild(h('div', { class: 'sec' }, [M.pending.title]));
      var box = h('div', { class: 'choices' });
      M.pending.choices.forEach(function (c, i) {
        box.appendChild(h('button', { class: 'btn choice', onclick: function () { chooseHighlight(i); } }, [
          h('span', { class: 't' }, [c.n]), h('span', { class: 'd' }, [' — ' + c.d + '（成功率の目安 ' + Math.round(c.p * 100) + '%）'])
        ]));
      });
      ctrl.appendChild(box);
    } else if (!M.done) {
      ctrl.appendChild(h('div', { class: 'sec' }, ['実況']));
      ctrl.appendChild(h('p', { class: 'sub' }, ['左の実況を見ながら、試合を進めよう。勝負どころでは采配が求められる']));
      ctrl.appendChild(h('button', { class: 'btn primary', onclick: function () { playBlock(); } }, ['試合を進める']));
    } else {
      ctrl.appendChild(h('div', { class: 'sec' }, [M.result === 'win' ? '勝利！' : '試合終了']));
      ctrl.appendChild(h('button', { class: 'btn primary', onclick: function () { afterMatchNext(); } }, [M.result === 'win' ? 'やった！次へ' : '次へ']));
    }
    var log = h('div', { class: 'log grow' });
    M.log.forEach(function (ln) {
      log.appendChild(h('div', ln.indexOf('勝負どころ') >= 0 ? { class: 'hl' } : (ln.indexOf('トライ') >= 0 || ln.indexOf('勝利') >= 0 ? { class: 'score-line' } : null), [ln]));
    });
    wrap([sb, h('div', { class: 'lay2' }, [log, col([ctrl])])]);
    var lg = document.querySelector('.log'); if (lg) lg.scrollTop = lg.scrollHeight;
  }
  function summaryScreen() {
    var s = G.summary;
    var result = h('div', { class: 'card center' }, [
      h('div', { class: 'big' }, [G.year + '年目のシーズン終了']),
      h('p', null, [s.result + '（' + s.wins + '勝 ' + s.losses + '敗）']),
      s.firstHana ? h('p', null, ['🎉 創部以来、初の花園出場！']) : h('span', null, []),
      h('div', { class: 'rowline' }, [h('span', null, ['部の格']), h('span', { class: 'big' }, [s.grade])]),
      h('div', { class: 'rowline' }, [h('span', null, ['通算 花園出場']), h('span', null, [G.career.hana + '回'])])
    ]);
    var g = h('div', { class: 'card grow scroll' });
    g.appendChild(h('div', { class: 'sec' }, ['卒業する3年生（' + s.grads.length + '人）']));
    s.grads.forEach(function (x) { g.appendChild(h('div', { class: 'rowline' }, [h('span', null, [x.name]), h('span', { class: 'sub' }, [x.pos + '・総合 ' + x.avg])])); });
    g.appendChild(h('div', { class: 'sub' }, ['彼らはOBとして記録に残る。お疲れさま']));
    wrap([hud(), h('div', { class: 'lay2' }, [
      col([banner(G.qualified ? 'hanazono' : 'sunset', 'grow'), result]),
      col([g, h('button', { class: 'btn primary', onclick: function () { nextYear(); } }, ['新年度へ（新入生が入部する）'])])
    ])]);
  }
  function recordsScreen() {
    var c = h('div', { class: 'card' });
    c.appendChild(h('div', { class: 'sec' }, ['監督の記録']));
    c.appendChild(h('div', { class: 'rowline' }, [h('span', null, ['在任']), h('span', null, [G.year + '年目'])]));
    c.appendChild(h('div', { class: 'rowline' }, [h('span', null, ['花園出場']), h('span', null, [G.career.hana + '回'])]));
    c.appendChild(h('div', { class: 'rowline' }, [h('span', null, ['花園での勝利']), h('span', null, [G.career.hanaWins + '勝'])]));
    var o = h('div', { class: 'card scroll', style: 'height:100%' });
    o.appendChild(h('div', { class: 'sec' }, ['OB名鑑（' + G.obs.length + '人）']));
    if (!G.obs.length) o.appendChild(h('div', { class: 'sub' }, ['まだ卒業生がいない']));
    G.obs.slice().reverse().forEach(function (x) {
      o.appendChild(h('div', { class: 'rowline' }, [h('span', null, [x.name]), h('span', { class: 'sub' }, [x.pos + '・' + x.year + '年卒・総合 ' + x.avg])]));
    });
    wrap([hud(), h('div', { class: 'lay2' }, [col([c]), o]),
      h('button', { class: 'btn', onclick: function () { screen = G.board ? 'board' : 'inst'; render(); } }, ['戻る'])
    ]);
  }

  /* ---------------- 起動 ---------------- */
  if (!loadSaved()) G = null;
  if (G && G.board) screen = 'board';
  else if (G && G.summary) screen = 'summary';
  else if (G) screen = 'inst';
  render();
})();
