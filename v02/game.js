/* Road to HANAZONO v0.4 — 横画面 / 月＋すごろく進行 / 世代交代キャリアループ
 * v0.3: 選手データ拡張(身長・体重・性格・特能・信頼度) + 試合の場面連動型停止点 + 敗因の分解表示
 * v0.4: 新入生3層の完成(スカウト＋特別枠) + OB連携 */
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
  /* 性格: 成長・疲労・信頼度の伸びに薄く効く */
  var PERSONS = [
    { n: '熱血', d: '練習も試合も全力。信頼を集めやすいが疲れやすい', growth: 1.06, fat: 1.18, trust: 1.3 },
    { n: 'クール', d: '常に冷静。疲労が溜まりにくい', growth: 1.0, fat: 0.85, trust: 0.9 },
    { n: '真面目', d: 'コツコツ努力する。成長が安定して速い', growth: 1.1, fat: 1.0, trust: 1.1 },
    { n: '自由人', d: '気分屋だが疲れ知らず。伸びはゆっくり', growth: 0.95, fat: 0.8, trust: 1.0 },
    { n: '頑張り屋', d: '人一倍練習する。成長は速いが無理もする', growth: 1.13, fat: 1.22, trust: 1.05 },
    { n: 'マイペース', d: '自分のリズムを崩さない。疲労に強い', growth: 1.0, fat: 0.88, trust: 0.85 },
    { n: 'リーダー気質', d: '周囲を引っ張る。監督の信頼を集める', growth: 1.04, fat: 1.0, trust: 1.4 }
  ];
  /* ラグビー特能: 試合の場面で効く */
  var SKILLS = [
    { n: 'ラインアウトの要', key: 'lineout' }, { n: 'モールの核', key: 'maul' },
    { n: 'タックルマン', key: 'tackle' }, { n: 'ロングキッカー', key: 'kick' },
    { n: 'ステップ職人', key: 'step' }, { n: '大舞台○', key: 'big' },
    { n: 'ケガしにくさ', key: 'tough' }
  ];
  var SKILL_AFFINITY = { /* ポジション別の出やすい特能 */
    PR: ['maul', 'tough', 'tackle'], HO: ['maul', 'tough', 'lineout'], LO: ['lineout', 'maul', 'tough'],
    FL: ['tackle', 'maul', 'tough'], No8: ['maul', 'tackle', 'step'],
    SH: ['step', 'tackle', 'kick'], SO: ['kick', 'step', 'tackle'],
    CTB: ['tackle', 'step', 'maul'], WTB: ['step', 'kick', 'tackle'], FB: ['kick', 'step', 'tackle']
  };
  /* ポジション別の体格レンジ [身長min,max, 体重min,max] */
  var POS_SIZE = {
    PR: [168, 183, 88, 115], HO: [166, 179, 82, 103], LO: [178, 196, 88, 112],
    FL: [172, 188, 82, 105], No8: [174, 190, 88, 110], SH: [158, 175, 60, 79],
    SO: [165, 181, 68, 87], CTB: [168, 185, 76, 99], WTB: [165, 183, 68, 91], FB: [168, 185, 70, 91]
  };
  var LEVELS = [
    { n: '通常', mul: 1.0, fat: 5, inj: 1.0 },
    { n: '強め', mul: 1.4, fat: 9, inj: 1.6 },
    { n: '猛特訓', mul: 1.9, fat: 14, inj: 2.4 }
  ];
  var UNIT_STAT = { FW: 'pow', BK: 'pas', SP: 'kik' };
  var UNIT_NAME = { FW: 'FW（フィジカル）', BK: 'BK（スキル）', SP: 'セットピース' };
  var OPPONENTS = [
    { name: '青葉高校', power: 38, note: '練習試合。力試し', skill: null },
    { name: '県立西高校', power: 44, note: '花園予選 1回戦', skill: { n: '堅いディフェンス', key: 'def' } },
    { name: '県立工業高校', power: 50, note: '花園予選 準決勝。FWの圧力が強い', skill: { n: 'モールの核がいるFW陣', key: 'maul' } },
    { name: '帝都学園', power: 56, note: '花園予選 決勝。県内王者の強豪校', skill: { n: '大舞台に強いエース', key: 'big' } },
    { name: '東都第一高校', power: 62, note: '花園 1回戦。全国レベルの強豪', skill: { n: 'ロングキッカーの司令塔', key: 'kick' } }
  ];
  /* 試合の格ごとの停止点プラン（場面連動）。halftime は block5=40分 に来る並び */
  var STOP_PLANS = [
    ['setpiece', 'goal'],                                   // 練習試合: 2回
    ['setpiece', 'penalty', 'goal'],                        // 予選1回戦: 3回
    ['setpiece', 'goal', 'penalty', 'late'],                // 準決勝: 4回
    ['setpiece', 'goal', 'halftime', 'penalty', 'late'],    // 決勝: 5回
    ['setpiece', 'goal', 'halftime', 'penalty', 'late']     // 花園: 5回
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
  var selPlayerId = null;
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
  function personOf(p) { return PERSONS.filter(function (x) { return x.n === p.person; })[0] || PERSONS[2]; }
  function hasSkill(p, key) { return (p.skills || []).some(function (s) { return s === key; }); }
  function skillNames(p) { return (p.skills || []).map(function (k) { var s = SKILLS.filter(function (x) { return x.key === k; })[0]; return s ? s.n : k; }); }
  function rollSkills(pos) {
    var r = Math.random();
    var count = r < 0.38 ? 0 : (r < 0.85 ? 1 : 2);
    var pool = (SKILL_AFFINITY[pos.p] || []).concat(['big', 'tough']);
    var out = [];
    for (var i = 0; i < count; i++) {
      var k = pick(pool);
      if (out.indexOf(k) < 0) out.push(k);
    }
    return out;
  }
  function sizeFor(pos) {
    var rg = POS_SIZE[pos.p] || [168, 185, 70, 100];
    return { h: ri(rg[0], rg[1]), w: ri(rg[2], rg[3]) };
  }
  function makePlayer(posIdx, year, base, opts) {
    opts = opts || {};
    var pos = POSITIONS[posIdx];
    var sz = sizeFor(pos);
    var pl = {
      id: G ? G.nextId++ : posIdx,
      name: opts.surname ? opts.surname + ' ' + pick(GIVEN) : uniqName(),
      year: year, posIdx: posIdx, stats: {},
      trait: pick(TRAITS), injured: 0, fatigue: ri(5, 20),
      h: sz.h, w: sz.w, person: opts.person || pick(PERSONS).n,
      skills: opts.skills ? opts.skills.slice() : rollSkills(pos),
      trust: typeof opts.trust === 'number' ? opts.trust : (year >= 2 ? ri(35, 60) : ri(22, 45))
    };
    STATS.forEach(function (s) {
      var v = base + ri(-6, 6) + (s.k === pos.main ? 8 : 0) + (s.k === 'sta' ? 3 : 0)
        + (opts.bonus && opts.bonus[s.k] ? opts.bonus[s.k] : 0);
      pl.stats[s.k] = clamp(Math.round(v), 20, 95);
    });
    return pl;
  }
  /* 旧セーブ(v0.2.x)の選手に新フィールドを補完する */
  function migratePlayer(p) {
    var pos = POSITIONS[p.posIdx] || POSITIONS[0];
    if (typeof p.h !== 'number' || !isFinite(p.h) || typeof p.w !== 'number' || !isFinite(p.w)) {
      var sz = sizeFor(pos); if (typeof p.h !== 'number' || !isFinite(p.h)) p.h = sz.h;
      if (typeof p.w !== 'number' || !isFinite(p.w)) p.w = sz.w;
    }
    if (!p.person || !PERSONS.some(function (x) { return x.n === p.person; })) p.person = pick(PERSONS).n;
    if (!Array.isArray(p.skills)) p.skills = rollSkills(pos);
    if (typeof p.trust !== 'number' || !isFinite(p.trust)) p.trust = p.year >= 2 ? ri(35, 55) : ri(22, 40);
    p.trust = clamp(Math.round(p.trust), 0, 99);
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
  function fixPlayer(p) {
    if (!p || typeof p !== 'object') return;
    if (!p.stats) p.stats = {};
    STATS.forEach(function (s) { if (typeof p.stats[s.k] !== 'number' || !isFinite(p.stats[s.k])) p.stats[s.k] = 45; });
    if (typeof p.fatigue !== 'number' || !isFinite(p.fatigue)) p.fatigue = 20;
    migratePlayer(p);
  }
  function sanitize() {
    if (!G || !G.players) return;
    G.players.forEach(fixPlayer);
    /* v0.4: スカウト候補・特別枠の選手オブジェクトも検証（壊れていたら勧誘情報ごと破棄） */
    if (G.recruit) {
      var okR = Array.isArray(G.recruit.cands) && G.recruit.cands.every(function (c) { return c && c.p && c.p.stats; });
      if (!okR) G.recruit = null;
      else {
        G.recruit.cands.forEach(function (c) { fixPlayer(c.p); });
        if (G.recruit.special && G.recruit.special.p) fixPlayer(G.recruit.special.p);
        else if (G.recruit.special && !G.recruit.special.p) G.recruit.special = null;
      }
    }
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
  function avgTrust(players) { if (!players.length) return 50; return players.reduce(function (a, p) { return a + (p.trust || 50); }, 0) / players.length; }
  function skillCount(players, key) { return players.filter(function (p) { return hasSkill(p, key); }).length; }
  function avgAttr(players, key) { if (!players.length) return 0; return players.reduce(function (a, p) { return a + (p[key] || 0); }, 0) / players.length; }
  function gainTrust(p, amt) { p.trust = clamp(Math.round((p.trust || 50) + amt * (personOf(p).trust || 1)), 0, 99); }
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
      var per = personOf(p);
      function gain(stat, base) {
        var g = Math.round(base * lvl.mul * p.trait.growth * per.growth * campMul * eff * rnd(0.7, 1.3));
        if (g > 0 && p.stats[stat] < 99) {
          p.stats[stat] = Math.min(99, p.stats[stat] + g);
          gains.push({ name: p.name, stat: stat, g: g, focus: p.id === inst.focus });
        }
      }
      gain(inst.team, big ? ri(1, 3) : ri(0, 2));
      if (unitOf(p) === inst.unit) gain(UNIT_STAT[inst.unit], big ? ri(1, 2) : ri(0, 1));
      if (p.id === inst.focus) gain(inst.team, ri(2, 4));
      p.fatigue = Math.min(100, p.fatigue + Math.round(lvl.fat * (big ? 1.3 : 1) * per.fat));
      var injMul = hasSkill(p, 'tough') ? 0.35 : 1;
      if (!p.injured && Math.random() < 0.010 * lvl.inj * p.trait.inj * injMul * (p.fatigue >= 70 ? 2 : 1)) {
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
    if (r < 0.94 && G.players.length) {
      var q = pick(G.players);
      if (q.person === '自由人' || q.person === 'マイペース') { q.fatigue = Math.max(0, q.fatigue - 18); return { t: q.name + '（' + q.person + '）は休日にしっかり気分転換。本人の疲労が抜けた' }; }
      if (q.person === 'リーダー気質' || q.person === '熱血') { G.nextBonus = Math.min(8, G.nextBonus + 3); return { t: q.name + '（' + q.person + '）が自主練に皆を誘い、チームの士気が上がった（次の試合 +3）' }; }
      q.trust = clamp((q.trust || 50) + 4, 0, 99); return { t: q.name + '（' + q.person + '）とじっくり面談。監督への信頼が深まった' };
    }
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

/* ---------------- 試合(v0.3: 場面連動型の停止点) ---------------- */
var TACTICS = [
  { k: 'fw', n: 'FW重視', d: 'モールの成功率アップ', key: 'maul' },
  { k: 'bk', n: '展開重視', d: 'バックス展開の成功率アップ', key: 'wide' },
  { k: 'kick', n: 'キック重視', d: 'キック系の成功率アップ', key: 'kick' },
  { k: 'def', n: '守備固め', d: '守備の勝負どころの成功率アップ', key: 'def' }
];
function oppPower(idx) { return OPPONENTS[idx].power + (idx >= 1 ? Math.min(8, (G.year - 1)) : 0); }
function stopBlocks(n) {
  var out = [];
  for (var i = 1; i <= n; i++) {
    var b = Math.round(i * 10 / (n + 1));
    if (b >= 1 && b <= 9 && out.indexOf(b) < 0) out.push(b);
  }
  return out;
}
function startMatch(oppIdx) {
  var opp = OPPONENTS[oppIdx];
  var plan = (STOP_PLANS[oppIdx] || STOP_PLANS[0]).slice();
  var st = starters();
  M = {
    opp: opp, oppIdx: oppIdx, power: oppPower(oppIdx), block: 0, my: 0, op: 0,
    log: [], phase: 'play', pending: null, done: false, result: null,
    bonus: G.nextBonus + clutchBonus(),
    plan: plan, stopAt: stopBlocks(plan.length), goalFlip: Math.random() < 0.5,
    scenes: { att: 0, ok: 0 }, factors: null, gallant: false,
    tp0: teamPower(),
    fat0: st.length ? Math.round(st.reduce(function (a, p) { return a + p.fatigue; }, 0) / st.length) : 0,
    inj0: st.filter(function (p) { return p.injured; }).length
  };
  G.nextBonus = 0;
  M.log.push('キックオフ。相手は ' + opp.name + '（総合力 ' + M.power + '）。' + opp.note);
  if (opp.skill) M.log.push('相手の特能：' + opp.skill.n);
  screen = 'match'; render();
}
function convProb() { return clamp(0.45 + (statAvg(starters(), 'kik') - 50) * 0.008, 0.2, 0.9); }
function tryScore(mine) {
  var pts = 5, txt = 'トライ！';
  if (Math.random() < convProb()) { pts += 2; txt += ' コンバージョンも成功（+7点）'; }
  else txt += ' コンバージョンは外れた（+5点）';
  if (mine) M.my += pts; else M.op += pts;
  return txt;
}
function pgScore(mine) { if (mine) M.my += 3; else M.op += 3; return 'ペナルティゴール成功（+3点）'; }
function scoreRoll(diff) { return Math.random() < clamp(0.32 + diff * 0.012, 0.05, 0.75); }
function playBlock() {
  var diff = teamPower() - M.power + M.bonus;
  if (scoreRoll(diff)) M.log.push('桜丘、攻め込む。' + tryScore(true));
  else if (scoreRoll(-diff + 6)) M.log.push('相手の攻撃を止めきれない。' + tryScore(false));
  else if (Math.random() < 0.3) M.log.push('桜丘のPG。' + pgScore(true));
  else if (Math.random() < 0.22) M.log.push('相手のPG。' + pgScore(false));
  else M.log.push('中盤での攻防。スコアは動かない');
  M.block++;
  maybeSceneOrEnd();
  render();
}
function maybeSceneOrEnd() {
  if (M.block >= 10) return finishMatch();
  var idx = M.stopAt.indexOf(M.block);
  if (idx >= 0) {
    M.phase = 'scene';
    M.pending = makeScene(M.plan[idx]);
    M.log.push('⚑ ' + M.pending.title + (M.pending.key ? '（キーマン：' + M.pending.key.name + '）' : ''));
  }
}
/* 場面の成功率： 能力値に体格・特能・信頼度・疲労・戦術・大舞台補正を重ねる */
function sceneProb(statVal, tacKey, keyPlayer) {
  var st = starters();
  var adj = (avgTrust(st) - 50) * 0.0015 + M.bonus * 0.006 - Math.max(0, M.fat0 - 35) * 0.001;
  if (M.oppIdx >= 3) adj += skillCount(st, 'big') * 0.015 + (keyPlayer && hasSkill(keyPlayer, 'big') ? 0.03 : 0);
  if (M.opp.skill && M.oppIdx >= 2) adj -= 0.03;
  var tac = TACTICS.filter(function (t) { return t.k === G.tactic; })[0];
  if (tac && tac.key === tacKey) adj += 0.10;
  return clamp(0.45 + (statVal - M.power) * 0.02 + adj, 0.05, 0.95);
}
function keyPlayer(posNames, stat, skillKey) {
  var st = starters().filter(function (p) { return posNames.indexOf(POSITIONS[p.posIdx].p) >= 0; });
  if (!st.length) st = starters();
  st.sort(function (a, b) {
    var sa = (skillKey && hasSkill(a, skillKey) ? 30 : 0) + a.stats[stat] + (a.trust || 50) * 0.1;
    var sb = (skillKey && hasSkill(b, skillKey) ? 30 : 0) + b.stats[stat] + (b.trust || 50) * 0.1;
    return sb - sa;
  });
  return st[0];
}
function C(n, d, p, winTxt, loseTxt, winFx, loseFx) {
  return { n: n, d: d, p: p, winTxt: winTxt, loseTxt: loseTxt, winFx: winFx, loseFx: loseFx };
}
function makeScene(kind) {
  var st = starters();
  var fw = st.filter(function (p) { return POSITIONS[p.posIdx].g === 'FW'; });
  var fwPow = statAvg(st, 'pow', 'FW');
  var wAdj = (avgAttr(fw, 'w') - 92) * 0.35;
  var loH = avgAttr(st.filter(function (p) { return POSITIONS[p.posIdx].p === 'LO'; }), 'h');
  var bkGo = (statAvg(st, 'spd', 'BK') + statAvg(st, 'pas', 'BK')) / 2;
  var kick = statAvg(st, 'kik'), tak = statAvg(st, 'tak'), sta = statAvg(st, 'sta');
  if (kind === 'setpiece') {
    if (Math.random() < 0.5) {
      var k1 = keyPlayer(['PR', 'HO', 'LO', 'FL', 'No8'], 'pow', 'maul');
      var k2 = keyPlayer(['SH'], 'pas', null);
      return { kind: kind, key: k1, title: '勝負どころ：敵陣でのスクラム', choices: [
        C('真っ向勝負で押し込む', 'FWのパワーと総体重が勝負', sceneProb(fwPow + wAdj + skillCount(st, 'maul') * 2, 'maul', k1), 'スクラムで圧倒し、そのまま押し込んだ！', 'スクラムが拮抗し、押し切れなかった', 'try', 'none'),
        C('早めに出してBKへ展開', 'SHのパスが勝負', sceneProb((statAvg(st, 'pas') + fwPow) / 2, 'wide', k2), k2.name + ' が素早くさばき、BKが走り切った！', 'ボールが乱れてチャンスを逃した', 'try', 'none'),
        C('相手の反則を誘う', '安定志向。成功でPG', sceneProb(fwPow + wAdj + 6, 'maul', k1), '相手のコラプシングを誘った！', '反則は取れず、ボールは相手へ', 'pg', 'none')
      ] };
    }
    var k3 = keyPlayer(['LO', 'FL'], 'pow', 'lineout');
    var k4 = keyPlayer(['PR', 'HO', 'LO', 'FL', 'No8'], 'pow', 'maul');
    var loVal = fwPow + (loH - 180) * 0.7 + skillCount(st, 'lineout') * 2.5;
    return { kind: kind, key: k3, title: '勝負どころ：敵陣でのラインアウト', choices: [
      C('エースジャンパーへ投げる', 'LOの身長と「ラインアウトの要」が勝負', sceneProb(loVal, 'maul', k3), k3.name + ' が高い打点でキャッチし、そのままモールで押し込んだ！', '相手に競り負けてボールを奪われた', 'try', 'none'),
      C('モールで押し込む', 'FWの総体重と「モールの核」が勝負', sceneProb(fwPow + wAdj + skillCount(st, 'maul') * 2.5, 'maul', k4), 'モールが一気に進み、押し込んだ！', 'モールが止められ、崩れてしまった', 'try', 'none'),
      C('クイックスローで奇襲', 'ハイリスク・ハイリターン', sceneProb(loVal - 5, 'wide', k3), '意表を突いた！ 一気に抜け出した', '呼吸が合わずノックオン…', 'try', 'none')
    ] };
  }
  if (kind === 'goal') {
    M.goalFlip = !M.goalFlip;
    if (M.goalFlip) {
      var a1 = keyPlayer(['PR', 'HO', 'LO', 'FL', 'No8'], 'pow', 'maul');
      var a2 = keyPlayer(['WTB', 'CTB', 'FB'], 'spd', 'step');
      var a3 = keyPlayer(['SO', 'FB'], 'kik', 'kick');
      return { kind: kind, key: a2, title: '勝負どころ：ゴール前、あと少しでトライ！', choices: [
        C('モールで押し込む', 'FWのパワーと総体重が勝負', sceneProb(fwPow + wAdj + skillCount(st, 'maul') * 2, 'maul', a1), 'モールでじりじり進み、最後は押し込んだ！', 'モールが崩れた…ターンオーバー', 'try', 'none'),
        C('バックスに展開', 'パスとスピード、「ステップ職人」が勝負', sceneProb(bkGo + skillCount(st, 'step') * 2.5, 'wide', a2), a2.name + ' がステップで抜けた！', 'パスが乱れてノックオン', 'try', 'none'),
        C('キックパスで裏へ', 'キック精度が勝負', sceneProb(kick + (hasSkill(a3, 'kick') ? 4 : 0), 'kick', a3), 'キックパスが通り、WTBが抑えた！', 'キックが深すぎてタッチへ', 'try', 'none')
      ] };
    }
    var d1 = keyPlayer(['FL', 'CTB', 'No8'], 'tak', 'tackle');
    return { kind: kind, key: d1, title: '勝負どころ：自陣ゴール前、相手の猛攻！', choices: [
      C('前に出てプレッシャー', 'タックルと「タックルマン」が勝負', sceneProb(tak + skillCount(st, 'tackle') * 2, 'def', d1), d1.name + ' の強烈なタックルでボールを奪った！', 'タックルがずれて突破された…', 'none', 'oppTry'),
      C('受けて立って粘る', 'スタミナと体の重さが勝負', sceneProb(sta + wAdj * 0.5, 'def', d1), '何度も止めて、最後は相手の反則を誘った！', '粘りきれず押し込まれた…', 'none', 'oppTry'),
      C('勝負タックル', 'ハイリスク・ハイリターン', sceneProb(tak - 6, 'def', d1), '起死回生のタックル！ ボールがこぼれた', 'かわされて一気に持っていかれた…', 'none', 'oppTry')
    ] };
  }
  if (kind === 'penalty') {
    var p1 = keyPlayer(['SO', 'FB'], 'kik', 'kick');
    var p2 = keyPlayer(['PR', 'HO', 'LO', 'FL', 'No8'], 'pow', 'maul');
    return { kind: kind, key: p1, title: '勝負どころ：相手の反則！ ペナルティの選択', choices: [
      C('ショット（PGを狙う）', 'キッカーの精度と「ロングキッカー」が勝負', sceneProb(kick + 8 + (hasSkill(p1, 'kick') ? 4 : 0), 'kick', p1), p1.name + ' のキックが決まった！', 'PGがわずかに外れた…', 'pg', 'none'),
      C('タッチに蹴ってラインアウト', '成功すればトライチャンス', sceneProb(kick + skillCount(st, 'lineout') * 2, 'kick', p1), '大きくタッチを割り、ラインアウトから攻め切った！', 'タッチを割りきれず、チャンスが流れた', 'try', 'none'),
      C('スクラムを選択', 'FWの総体重が勝負', sceneProb(fwPow + wAdj, 'maul', p2), 'スクラムで圧力をかけ、そのまま押し込んだ！', 'スクラムで押し切れなかった', 'try', 'none')
    ] };
  }
  if (kind === 'halftime') {
    var tr = avgTrust(st);
    return { kind: kind, key: null, title: 'ハーフタイム：ロッカールームでの指示', choices: [
      C('檄を飛ばす', '信頼関係が深いほど火がつく', clamp(0.5 + (tr - 50) * 0.004, 0.2, 0.9), '選手の目に火がついた！ 後半の勢いが増す', '熱が入りすぎて少し硬くなった', 'fire', 'none'),
      C('落ち着いて立て直す', '疲労を抜き、形を確認する', 0.8, '呼吸を整えた。疲労が抜け、後半の形も確認できた', '時間切れで話しきれなかった', 'calm', 'none'),
      C('戦術を切り替える', '成功すれば流れが変わる', 0.55, '新しい形が噛み合い、流れを引き寄せた！', '連携が乱れてしまった…', 'switch', 'minus')
    ] };
  }
  /* late: 終盤 */
  var behind = M.my <= M.op;
  if (behind) {
    var l1 = keyPlayer(['SO', 'FB'], 'kik', 'kick');
    var l2 = keyPlayer(['WTB', 'CTB', 'FB'], 'spd', 'step');
    var l3 = keyPlayer(['PR', 'HO', 'LO', 'FL', 'No8'], 'pow', 'maul');
    return { kind: kind, key: l2, title: '勝負どころ：終盤、逆転を狙う！', choices: [
      C('PGで確実に3点', 'キック精度が勝負', sceneProb(kick + 8, 'kick', l1), 'PGで詰め寄った！', 'PGがわずかに外れた…', 'pg', 'none'),
      C('トライを取りにいく', 'スピードとパスが勝負', sceneProb(bkGo + skillCount(st, 'step') * 2 - 3, 'wide', l2), l2.name + ' が抜け出した！', 'あと一歩で止められた…', 'try', 'none'),
      C('モールでじわじわ', 'FWのパワーが勝負', sceneProb(fwPow + wAdj, 'maul', l3), 'モールが進み、押し込んだ！', 'モールが止められ、時間だけが過ぎる', 'try', 'none')
    ] };
  }
  var e1 = keyPlayer(['SO', 'FB'], 'kik', 'kick');
  var e2 = keyPlayer(['FL', 'CTB', 'No8'], 'tak', 'tackle');
  return { kind: kind, key: e2, title: '勝負どころ：終盤、リードを守れるか！', choices: [
    C('キックで敵陣へ押し返す', 'キック精度が勝負', sceneProb(kick, 'kick', e1), '大きく蹴り出して敵陣で試合を進める', 'キックが甘く、カウンターを浴びた…', 'none', 'oppTry'),
    C('ボールキープで時間を使う', 'スタミナが勝負', sceneProb(sta, 'def', e2), 'ボールを保持し続けて時間を消化した', 'プレッシャーでボールを失い、相手に持っていかれた…', 'none', 'oppTry'),
    C('タックルで止め続ける', 'タックルが勝負', sceneProb(tak + skillCount(st, 'tackle') * 2, 'def', e2), 'タックルの雨で相手を前進させない', 'タックルがずれて突破された…', 'none', 'oppTry')
  ] };
}
function chooseScene(idx) {
  var sc = M.pending, c = sc.choices[idx];
  M.scenes.att++;
  var ok = Math.random() < c.p;
  if (ok) M.scenes.ok++;
  var fx = ok ? c.winFx : c.loseFx;
  var txt = (ok ? '✅ ' : '❌ ') + c.n + ' → ' + (ok ? c.winTxt : c.loseTxt);
  if (fx === 'try') txt += ' ' + tryScore(true);
  else if (fx === 'pg') txt += ' ' + pgScore(true);
  else if (fx === 'oppTry') txt += ' 相手の' + tryScore(false);
  else if (fx === 'oppPg') txt += ' 相手の' + pgScore(false);
  else if (fx === 'fire') { M.bonus += 5; starters().forEach(function (p) { gainTrust(p, 2); }); }
  else if (fx === 'calm') { starters().forEach(function (p) { p.fatigue = Math.max(0, p.fatigue - 10); }); M.bonus += 2; }
  else if (fx === 'switch') {
    M.bonus += 6;
    var others = TACTICS.filter(function (t) { return t.k !== G.tactic; });
    G.tactic = pick(others).k;
    txt += '（戦術を「' + TACTICS.filter(function (t) { return t.k === G.tactic; })[0].n + '」に変更）';
  }
  else if (fx === 'minus') { M.bonus -= 2; }
  if (ok && sc.key) gainTrust(sc.key, 3);
  M.log.push(txt);
  M.pending = null; M.phase = 'play'; M.block++;
  maybeSceneOrEnd();
  render();
}
function computeFactors(won) {
  var att = Math.max(1, M.scenes.att), rate = M.scenes.ok / att;
  var abilityW, tacticW, condW, oppW;
  if (!won) {
    abilityW = clamp((M.power - M.tp0) * 3 + 22, 5, 80);
    tacticW = clamp((1 - rate) * 48 + 6, 5, 80);
    condW = clamp((M.fat0 - 25) * 0.8 + M.inj0 * 9 + 6, 5, 65);
    oppW = 8 + M.oppIdx * 3 + (M.opp.skill ? 7 : 0);
  } else {
    abilityW = clamp((M.tp0 - M.power) * 3 + 22, 5, 80);
    tacticW = clamp(rate * 48 + 6, 5, 80);
    condW = clamp(48 - M.fat0 * 0.55 - M.inj0 * 6, 5, 65);
    oppW = 6 + M.oppIdx * 2;
  }
  var tot = Math.max(1, abilityW + tacticW + condW + oppW);
  function pct(w) { return Math.round(w / tot * 100); }
  var v1 = pct(abilityW), v2 = pct(tacticW), v3 = pct(condW);
  return [
    { n: '能力差', v: v1 },
    { n: '采配（勝負どころ ' + M.scenes.ok + '/' + att + ' 成功）', v: v2 },
    { n: '調子・疲労', v: v3 },
    { n: M.opp.skill ? '相手の特能（' + M.opp.skill.n + '）' : '試合の流れ', v: 100 - v1 - v2 - v3 }
  ];
}
function finishMatch() {
  M.done = true; M.phase = 'done';
  var res;
  if (M.my > M.op) res = 'win';
  else if (M.my < M.op) res = 'lose';
  else res = Math.random() < 0.5 ? 'win' : 'lose';
  M.result = res;
  M.log.push(res === 'win' ? 'ノーサイド！ 桜丘高校の勝利！' : 'ノーサイド。桜丘高校、敗れる…');
  if (M.my === M.op) M.log.push('（同点のため抽選で勝敗を決定）');
  M.factors = computeFactors(res === 'win');
  starters().forEach(function (p) { gainTrust(p, res === 'win' ? 2 : 1); });
  if (res === 'win') {
    G.season.wins++;
    G.rep += M.oppIdx === 0 ? 2 : (M.oppIdx === 3 ? 20 : 6);
    growFromMatch();
    if (M.oppIdx === 3) { G.qualified = true; G.career.hana++; }
    if (M.oppIdx === 4) { G.career.hanaWins++; G.career.titles++; G.rep += 20; }
  } else {
    G.season.losses++;
    /* 格上への善戦ボーナス： 7点差以内で、相手が格上（または互角以上）なら報いる */
    if (M.oppIdx >= 1 && (M.op - M.my) <= 7 && M.power >= M.tp0 - 2) {
      M.gallant = true;
      G.rep += 4;
      growFromMatch(0.4);
      M.log.push('🌟 格上に善戦！ 評判+4。選手たちも大きな経験を積んだ');
    }
  }
  G.players.forEach(function (p) { if (p.injured) p.injured = Math.max(0, p.injured - 1); });
  starters().forEach(function (p) { p.fatigue = Math.min(100, p.fatigue + 8); });
  save();
}
function growFromMatch(prob) {
  var pr = (prob == null ? 0.6 : prob);
  starters().forEach(function (p) {
    if (Math.random() < pr) {
      var s = pick(STATS).k;
      p.stats[s] = Math.min(99, p.stats[s] + 1);
    }
  });
}
function afterMatchNext() {
  var won = M.result === 'win';
  var idx = M.oppIdx;
  M = null;
  if (idx === 0) { advanceMonth(); return; }
  if (idx === 4) { G.season.result = won ? '花園で勝利！' : '花園出場（1回戦敗退）'; seasonEnd(); return; }
  if (!won) {
    G.season.result = idx === 1 ? '予選1回戦敗退' : (idx === 2 ? '予選準決勝敗退' : '予選決勝敗退');
    seasonEnd(); return;
  }
  if (idx === 3) { G.season.result = '花園出場決定'; advanceMonth(); return; }
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
/* ---------------- 新入生スカウト・特別枠(v0.4) ----------------
 * 3層構造の残り2層。一般入部は finishRecruit で不足分を埋める。
 * 卒業・進級は startRecruit で行い、勧誘画面を挟んでから新年度が始まる */
function gradeIdx() { var gi = 0; GRADES.forEach(function (x, i) { if (G.rep >= x.min) gi = i; }); return gi; }
function scoutQuota() { return [1, 1, 2, 2, 3][gradeIdx()]; }
function scarcePosIdx() {
  var counts = POSITIONS.map(function (_, i) { return G.players.filter(function (p) { return p.posIdx === i; }).length; });
  var min = Math.min.apply(null, counts);
  var slack = Math.random() < 0.5 ? 0 : 1;
  var low = [];
  counts.forEach(function (c, i) { if (c <= min + slack) low.push(i); });
  return low.length ? pick(low) : ri(0, 14);
}
var SKILL_HINT = {
  lineout: '中学の大会でラインアウトの制空権を握っていた', maul: 'コンタクトの強さに定評がある',
  tackle: 'タックルの鋭さが目を引く', kick: 'キックの飛距離と精度が評判',
  step: 'ステップの切れ味は中学レベルではない', big: '大事な試合ほど力を出すタイプらしい',
  tough: '中学時代に大きなケガなし。丈夫そうだ'
};
var PERSON_HINT = {
  '熱血': '練習から声が出る熱いタイプ', 'クール': '常に落ち着いた表情の冷静なタイプ',
  '真面目': 'コツコツと努力を続ける真面目なタイプ', '自由人': '型にはまらない自由なプレースタイル',
  '頑張り屋': '誰よりも練習量が多いタイプ', 'マイペース': '自分のペースを崩さないタイプ',
  'リーダー気質': '中学でもキャプテンシーを見せていたタイプ'
};
function makeBlurb(p, extra) {
  var parts = [];
  if (p.h >= 185) parts.push('身長' + p.h + 'cmの大柄で、空中戦が武器になりそう');
  else if (p.w >= 102) parts.push('体重' + p.w + 'kgの迫力ある体格。コンタクトで押せる');
  else if (p.h <= 168) parts.push('小柄だが俊敏。スペースを突く動きが光る');
  else parts.push('バランスの取れた体格で、大きな欠点が見当たらない');
  if ((p.skills || []).length) parts.push(SKILL_HINT[p.skills[0]]);
  parts.push(PERSON_HINT[p.person] || '');
  if (extra) parts.push(extra);
  return parts.filter(function (x) { return x; }).join('。') + '。';
}
function genScoutCands() {
  var gr = gradeOf(), gi = gradeIdx();
  var n = 3 + (gi >= 2 ? 1 : 0) + (gi >= 4 ? 1 : 0);
  var cands = [];
  for (var i = 0; i < n; i++) {
    var elite = Math.random() < 0.18;
    var base = gr.fresh + ri(1, 6) + gi + (elite ? ri(8, 13) : 0);
    var p = makePlayer(scarcePosIdx(), 1, base);
    var sp = clamp(0.52 + gi * 0.06 + (G.rep - 30) * 0.0012 - (base - gr.fresh) * 0.018, 0.15, 0.95);
    var cand = { p: p, sp: Math.round(sp * 100) / 100, elite: elite, viaOb: null, obYear: 0, picked: false, blurb: '' };
    if (G.obs.length && Math.random() < 0.3) {
      var ob = pick(G.obs);
      cand.viaOb = ob.name; cand.obYear = ob.year;
      cand.sp = clamp(cand.sp + 0.10, 0.15, 0.97);
    }
    cand.blurb = makeBlurb(p, cand.viaOb ? ('OBの' + cand.viaOb + 'さん（' + cand.obYear + '年卒）の紹介で名前が挙がった') : null);
    cands.push(cand);
  }
  return cands;
}
var CONVERT_SPORTS = [
  { n: 'サッカー', bonus: { spd: 10, kik: 8 }, skill: 'kick' },
  { n: '柔道', bonus: { pow: 10, tak: 9 }, skill: 'tackle' },
  { n: '陸上', bonus: { spd: 12, sta: 8 }, skill: 'step' },
  { n: '野球', bonus: { pas: 9, pow: 7 }, skill: null }
];
function genSpecial() {
  if (Math.random() > 0.32) return null;
  var gr = gradeOf();
  var types = ['transfer', 'convert', 'returnee'];
  if (G.obs.length) types.push('obson', 'obson');
  var t = pick(types);
  if (t === 'transfer') {
    var p1 = makePlayer(scarcePosIdx(), 2, gr.fresh + ri(8, 13));
    return { type: t, p: p1, accepted: false, title: '🌟 特別枠：転校生',
      desc: '強豪校で出場機会に恵まれなかった2年生が、「試合に出られる環境で勝負したい」と桜丘への転校を決めてきた。即戦力として期待できる。' };
  }
  if (t === 'convert') {
    var sport = pick(CONVERT_SPORTS);
    var opts = { bonus: sport.bonus };
    if (sport.skill) opts.skills = [sport.skill];
    var p2 = makePlayer(scarcePosIdx(), 1, gr.fresh - 2, opts);
    return { type: t, p: p2, sport: sport.n, accepted: false, title: '🌟 特別枠：他競技からの転向（' + sport.n + '）',
      desc: sport.n + 'で鍛えた身体能力は本物。「ラグビーに挑戦したい」と入部を希望してきた。基礎体力は申し分ないが、ラグビーの技術はこれからだ。' };
  }
  if (t === 'returnee') {
    var p3 = makePlayer(scarcePosIdx(), 1, gr.fresh + ri(4, 8), { bonus: { kik: 6, pas: 5 } });
    return { type: t, p: p3, accepted: false, title: '🌟 特別枠：帰国子女',
      desc: 'ラグビー王国ニュージーランドで育った帰国子女。本場仕込みのスキルと、独特の距離感を持つ。' };
  }
  var ob = pick(G.obs);
  var idx = 0;
  POSITIONS.forEach(function (x, i) { if (x.p === ob.pos && !idx) idx = i; });
  var surname = ob.name.split(' ')[0];
  var p4 = makePlayer(idx, 1, gr.fresh + ri(3, 7), { surname: surname, trust: ri(60, 75) });
  if (p4.name === ob.name) p4.name = surname + ' ' + (pick(GIVEN) === ob.name.split(' ')[1] ? '隼' : pick(GIVEN));
  return { type: t, p: p4, obName: ob.name, obYear: ob.year, accepted: false, title: '🌟 特別枠：OBの息子',
    desc: 'OBの' + ob.name + 'さん（' + ob.year + '年卒・' + ob.pos + '）の息子が入部を希望してきた。ポジションも父親と同じ' + ob.pos + '。幼い頃から桜丘のグラウンドで育ち、監督への信頼も厚い。' };
}
function startRecruit() {
  var grads = G.players.filter(function (p) { return p.year === 3; });
  grads.forEach(function (p) {
    G.obs.push({ name: p.name, pos: POSITIONS[p.posIdx].p, avg: Math.round(overall(p)), year: G.year });
  });
  if (G.obs.length > 40) G.obs = G.obs.slice(-40);
  G.players = G.players.filter(function (p) { return p.year !== 3; });
  G.players.forEach(function (p) { p.year++; p.injured = 0; p.fatigue = ri(5, 15); });
  G.year++; G.monthIdx = 0; G.qualified = false; G.nextBonus = 0;
  G.season = { wins: 0, losses: 0, result: '予選敗退' };
  G.summary = null;
  G.recruit = { cands: genScoutCands(), special: genSpecial() };
  sortRoster();
  screen = 'recruit'; save(); render();
}
function togglePick(i) {
  var R = G.recruit; if (!R || !R.cands[i]) return;
  var c = R.cands[i];
  if (c.picked) c.picked = false;
  else {
    if (R.cands.filter(function (x) { return x.picked; }).length >= scoutQuota()) return;
    c.picked = true;
  }
  save(); render();
}
function setSpecial(accept) {
  if (!G.recruit || !G.recruit.special) return;
  G.recruit.special.accepted = !!accept;
  save(); render();
}
function finishRecruit() {
  var R = G.recruit;
  var lines = [];
  var scoutJoined = 0;
  if (R) {
    R.cands.forEach(function (c) {
      if (!c.picked) return;
      if (Math.random() < c.sp) {
        G.players.push(c.p); scoutJoined++;
        lines.push('🌸 スカウト成功！ ' + c.p.name + '（' + POSITIONS[c.p.posIdx].p + '）が入部を決めた');
      } else {
        lines.push('スカウト叶わず… ' + c.p.name + ' は他校へ進学した');
      }
    });
    if (R.special && R.special.accepted) {
      G.players.push(R.special.p);
      lines.push('🌸 ' + R.special.title.replace('🌟 ', '') + ' ― ' + R.special.p.name + '（' + POSITIONS[R.special.p.posIdx].p + '・' + R.special.p.year + '年）が入部した');
    }
  }
  var gr = gradeOf();
  var gen = Math.max(0, gr.count - scoutJoined);
  for (var i = 0; i < gen; i++) G.players.push(makePlayer(scarcePosIdx(), 1, gr.fresh));
  sortRoster();
  G.inst.focus = G.players[0] ? G.players[0].id : 1;
  lines.push('一般入部で ' + gen + ' 名の新入生が加わった');
  G.monthLog = lines;
  G.recruit = null;
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
    if (screen === 'recruit') return recruitScreen();
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
      h('div', { class: 'hero' }, [h('h1', null, ['🏉 Road to HANAZONO']), h('p', null, ['高校ラグビー育成シミュレーション v0.4'])]),
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
      left.push(h('div', { class: 'card grow scroll' }, [h('div', { class: 'sub' }, ['最近の出来事'])].concat(G.monthLog.map(function (l) { return h('div', null, [l]); }))));
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
      return h('option', { value: String(p.id) }, [POSITIONS[p.posIdx].no + ' ' + p.name + '（' + p.year + '年・' + POSITIONS[p.posIdx].p + '・' + p.person + '・' + p.trait.n + '）']);
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
    if (!G.players.some(function (p) { return p.id === selPlayerId; })) selPlayerId = G.players[0] ? G.players[0].id : null;
    var table = h('table', { class: 'squad' });
    table.appendChild(h('tr', null, ['No', '名前', '年', 'Pos', '身長', '体重'].concat(STATS.map(function (s) { return s.n.slice(0, 2); })).concat(['疲労', '信頼']).map(function (x) { return h('th', null, [x]); })));
    G.players.forEach(function (p) {
      var cells = [String(POSITIONS[p.posIdx].no), p.name + (p.injured ? ' 🚑' : ''), String(p.year), POSITIONS[p.posIdx].p, String(p.h), String(p.w)].map(function (x, i) {
        return h('td', i === 1 ? { class: 'name' } : null, [x]);
      });
      STATS.forEach(function (s) { cells.push(h('td', null, [String(p.stats[s.k])])); });
      cells.push(h('td', null, [String(p.fatigue)]));
      cells.push(h('td', null, [String(p.trust)]));
      var tr = h('tr', { class: 'prow' + (p.id === selPlayerId ? ' sel' : ''), onclick: (function (pid) { return function () { selPlayerId = pid; render(); }; })(p.id) }, cells);
      table.appendChild(tr);
    });
    var sel = G.players.filter(function (p) { return p.id === selPlayerId; })[0];
    var detail = h('div', { class: 'card grow scroll' });
    if (sel) {
      var per = personOf(sel);
      detail.appendChild(h('div', { class: 'sec' }, [POSITIONS[sel.posIdx].no + ' ' + sel.name + (sel.injured ? ' 🚑負傷中' : '')]));
      detail.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['学年／ポジション']), h('span', null, [sel.year + '年・' + POSITIONS[sel.posIdx].p + '（' + POSITIONS[sel.posIdx].g + '）'])]));
      detail.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['体格']), h('span', null, [sel.h + 'cm ／ ' + sel.w + 'kg'])]));
      detail.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['性格']), h('span', null, [sel.person])]));
      detail.appendChild(h('div', { class: 'sub' }, [per.d]));
      detail.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['個性']), h('span', null, [sel.trait.n])]));
      var sk = h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['特能']), h('span', { class: 'tags' }, [])]);
      var names = skillNames(sel);
      if (!names.length) sk.children[1].appendChild(document.createTextNode('なし'));
      names.forEach(function (n) { sk.children[1].appendChild(h('span', { class: 'tag' }, [n])); });
      detail.appendChild(sk);
      detail.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['信頼度']), h('span', null, [String(sel.trust) + '（采配の成功率に影響）'])]));
      detail.appendChild(h('div', { class: 'meter' }, [h('div', { style: 'width:' + sel.trust + '%' }, [])]));
      detail.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['疲労']), h('span', null, [String(sel.fatigue)])]));
      STATS.forEach(function (s) {
        detail.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, [s.n]), h('span', null, [String(sel.stats[s.k])])]));
      });
      detail.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['総合']), h('span', { class: 'big' }, [String(Math.round(overall(sel)))])]));
    }
    wrap([hud(), h('div', { class: 'lay2' }, [
      h('div', { class: 'card grow scroll' }, [h('div', { class: 'sec' }, ['選手一覧（行タップで詳細）']), table]),
      col([detail, h('button', { class: 'btn', onclick: function () { screen = G.recruit ? 'recruit' : (G.board ? 'board' : 'inst'); render(); } }, ['戻る'])])
    ])]);
  }
  function preMatchScreen() {
    var mo = MONTHS[G.monthIdx], opp = OPPONENTS[mo.match];
    var vs = h('div', { class: 'card center' }, [
      h('div', { class: 'big' }, ['vs ' + opp.name]),
      h('div', { class: 'sub' }, [opp.note]),
      opp.skill ? h('div', { class: 'sub' }, ['相手の特能：' + opp.skill.n]) : h('span', null, []),
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
    if (M.phase === 'scene' && M.pending) {
      ctrl.appendChild(h('div', { class: 'sec' }, [M.pending.title]));
      if (M.pending.key) ctrl.appendChild(h('div', { class: 'sub' }, ['キーマン：' + M.pending.key.name + '（' + POSITIONS[M.pending.key.posIdx].p + (skillNames(M.pending.key).length ? '・' + skillNames(M.pending.key).join('／') : '') + '）']));
      var box = h('div', { class: 'choices' });
      M.pending.choices.forEach(function (c, i) {
        box.appendChild(h('button', { class: 'btn choice', onclick: function () { chooseScene(i); } }, [
          h('span', { class: 't' }, [c.n]), h('span', { class: 'd' }, [' — ' + c.d + ' ']), h('span', { class: 'd nowrap' }, ['（成功率の目安 ' + Math.round(c.p * 100) + '%）'])
        ]));
      });
      ctrl.appendChild(box);
    } else if (!M.done) {
      ctrl.appendChild(h('div', { class: 'sec' }, ['実況']));
      ctrl.appendChild(h('p', { class: 'sub' }, ['左の実況を見ながら、試合を進めよう。勝負どころでは采配が求められる']));
      ctrl.appendChild(h('button', { class: 'btn primary', onclick: function () { playBlock(); } }, ['試合を進める']));
    } else {
      ctrl.appendChild(h('div', { class: 'sec' }, [M.result === 'win' ? '勝利！ 勝因の内訳' : '試合終了：敗因の内訳']));
      if (M.gallant) ctrl.appendChild(h('p', null, ['🌟 格上に善戦！ 評判+4・経験ボーナスが入った']));
      if (M.factors) {
        M.factors.forEach(function (f) {
          ctrl.appendChild(h('div', { class: 'frow' }, [
            h('span', { class: 'flab' }, [f.n]),
            h('span', { class: 'meter fmeter' }, [h('div', { style: 'width:' + f.v + '%' }, [])]),
            h('span', { class: 'fval' }, [f.v + '%'])
          ]));
        });
        ctrl.appendChild(h('p', { class: 'sub' }, [M.result === 'win' ? '勝ち切れた要因の目安。次もこの形を伸ばそう。' : '敗因の目安。練習指示と采配で一番大きい要素を潰していこう。']));
      }
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
      col([g, h('button', { class: 'btn primary', onclick: function () { startRecruit(); } }, ['新年度へ（新入生を迎える）'])])
    ])]);
  }
  function candHead(p) {
    return h('div', { class: 'rowline' }, [
      h('span', { class: 'big' }, [p.name]),
      h('span', { class: 'sub' }, [POSITIONS[p.posIdx].p + ' ・ ' + p.year + '年 ・ ' + p.h + 'cm／' + p.w + 'kg'])
    ]);
  }
  function recruitScreen() {
    var R = G.recruit;
    if (!R) { wrap([hud(), h('div', { class: 'card' }, ['新入生情報がありません'])]); return; }
    var quota = scoutQuota();
    var pickedN = R.cands.filter(function (c) { return c.picked; }).length;
    var leftKids = [
      h('div', { class: 'sec' }, ['🌸 ' + G.year + '年目 ― 新入生を迎える']),
      h('p', null, ['卒業生が巣立ち、新しい世代がやってくる。中学3年生のスカウト候補から、声をかけたい選手を獲得リスト（' + quota + '名まで）に入れよう。']),
      h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['部の格']), h('span', null, [gradeOf().n])]),
      h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['スカウト獲得枠']), h('span', null, [quota + '名（選択中 ' + pickedN + '名）'])]),
      h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['OB名鑑']), h('span', null, [G.obs.length + '名が記録に残る'])]),
      h('p', { class: 'sub' }, ['寸評はOBや中学の指導者からの伝聞。体格と「らしさ」のヒントにしよう。獲得できなくても、残りの枠は一般入部で埋まる。'])
    ];
    var newObs = G.obs.filter(function (o) { return o.year === G.year - 1; });
    if (newObs.length) {
      leftKids.push(h('div', { class: 'sec' }, ['巣立った卒業生']));
      newObs.slice(-5).forEach(function (o) {
        leftKids.push(h('div', { class: 'rowline' }, [h('span', null, [o.name]), h('span', { class: 'sub' }, [o.pos + '・総合 ' + o.avg])]));
      });
      leftKids.push(h('p', { class: 'sub' }, ['彼らの紹介や息子の入部で、OBはこれからも部に返ってくる。']));
    }
    var left = h('div', { class: 'card grow' }, leftKids);
    var list = h('div', { class: 'stack grow scroll' });
    if (R.special) {
      var sp = R.special;
      var sc = h('div', { class: 'card cand' + (sp.accepted ? ' sel' : '') });
      sc.appendChild(h('div', { class: 'sec' }, [sp.title]));
      sc.appendChild(candHead(sp.p));
      sc.appendChild(h('p', null, [sp.desc]));
      sc.appendChild(h('div', { class: 'hand' }, [
        h('button', { class: 'btn small' + (sp.accepted ? ' primary' : ''), onclick: function () { setSpecial(true); } }, ['迎え入れる']),
        h('button', { class: 'btn small', onclick: function () { setSpecial(false); } }, ['見送る'])
      ]));
      list.appendChild(sc);
    }
    R.cands.forEach(function (c, i) {
      var card = h('div', { class: 'card cand' + (c.picked ? ' sel' : '') });
      card.appendChild(candHead(c.p));
      if (c.elite) card.appendChild(h('div', null, [h('span', { class: 'badge' }, ['目玉候補'])]));
      card.appendChild(h('p', null, [c.blurb]));
      card.appendChild(h('div', { class: 'rowline' }, [
        h('span', { class: 'sub' }, ['獲得成功率の目安']),
        h('span', null, [Math.round(c.sp * 100) + '%'])
      ]));
      card.appendChild(h('button', { class: 'btn small' + (c.picked ? ' primary' : ''), onclick: (function (ix) { return function () { togglePick(ix); }; })(i) }, [c.picked ? '✔ 獲得リストから外す' : '獲得リストに入れる']));
      list.appendChild(card);
    });
    wrap([hud(), h('div', { class: 'lay2' }, [
      col([left]),
      col([list, h('button', { class: 'btn primary', onclick: function () { finishRecruit(); } }, ['新年度を始める'])])
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
      h('button', { class: 'btn', onclick: function () { screen = G.recruit ? 'recruit' : (G.board ? 'board' : 'inst'); render(); } }, ['戻る'])
    ]);
  }

  /* ---------------- 起動 ---------------- */
  if (!loadSaved()) G = null;
  if (G) { sanitize(); save(); } /* マイグレーション結果を即永続化 */
  if (G && G.recruit) screen = 'recruit';
  else if (G && G.board) screen = 'board';
  else if (G && G.summary) screen = 'summary';
  else if (G) screen = 'inst';
  render();
})();
