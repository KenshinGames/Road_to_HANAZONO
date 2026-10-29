/* Road to HANAZONO v0.18 — 横画面 / 月＋すごろく進行 / 世代交代キャリアループ
 * v0.3: 選手データ拡張(身長・体重・性格・特能・信頼度) + 試合の場面連動型停止点 + 敗因の分解表示
 * v0.4: 新入生3層の完成(スカウト＋特別枠) + OB連携
 * v0.5: 立ち絵表現(パーツ組み合わせ式の自動生成) + 試合カットイン + 会話劇 + 季節感
 * v0.6: 花園トーナメント化(初戦→決勝) + 相手校の個性(戦術傾向・エース) + スカウティング + 時短スキップ + 個人スタッツ
 * v0.7: キャプテン任命と校風 + 選手イベント拡充(性格×信頼度・進路) + ケガの段階化(軽症/重症・欠場期間) + 成長のソフトキャップ化
 * v0.8: メンバー編成(スタメン15名を試合前に編成) + 選手交代(停止点で交代・負傷交代) + 調子(コンディション5段階)
 * v0.9: シーズン目標 + ライバル校の物語(帝都のエース代替わり) + 記録室拡張(通算スタッツ・歴代チーム) + 難易度選択 + 設備解放
 * v0.9.1: タイトル画面に夕景イラスト（ChatGPT生成）を全面背景として採用（見た目のみ）
 * v0.10: 効果音（WebAudio合成）／実績（トロフィー）13種／遊び方ガイド／再開時あらすじ
 * v0.11: シーンイラスト4枚（ChatGPT生成：優勝・卒業・合宿・雨）を組み込み／調子の色分け表示
 * v0.12: 試合の読み応え（実況バリエーション拡充＋試合内の重複回避／スカウティング弱点ヒント／ハーフタイム形勢サマリー／敗因・勝因の相対バー表示）
 *        ＋調子表示を固定サイズの顔アイコンのみに見直し（ユーザー提示の参照画像に基づく配色、ラベル廃止）
 * v0.13: 育成の手触り（月次成長レポート＝盤面の練習で実際に伸びた分の内訳を次の月頭指示画面にカード表示／
 *        選手詳細に調子の推移＝直近最大6件を顔アイコンの列で表示／信頼度イベントに復帰・キャプテン・上級生指導・進路の続きを追加）
 * v0.14: 記録の深化（シーズン別成績＝到達結果・今季勝敗・部の格・目標と達成可否をシーズンごとに career.seasonHist へ記録／
 *        対戦校別の通算成績 career.oppRec／歴代キャプテン career.captains／OB名鑑に卒業時の最終能力6種と進路を保存・表示）
 * v0.15: デザイン統一（能力ランク S〜G＋ランク色の併記を全画面に導入する表示変換／選手詳細を名前バナー＋プロフィール帯＋
 *        特能タググリッドに作り替え／成長レポートを濃緑ボード＋名前プレート＋「ランク 数値 → ランク 数値」形式に作り替え／
 *        初回ヒント＝新規開始の最初の月だけ月頭指示に1行／見出しバーの濃紺トーン統一）。数値ロジック・バランスは無変更
 * v0.16: 試合の采配（後半の戦術変更＝ハーフタイム／後半最初の停止点で攻め方を1回だけ変更でき、対応する勝負どころに +0.04 の小幅補正／
 *        PGキッカー指名＝対戦確認で任意指名。指名時は本人のキック値・特能・調子で成功率が決まり外れることもある（おまかせ時は従来どおり）／
 *        相手エースへのマーク指示＝エースの得点を抑える代わりに他の選手が動きやすくなるトレードオフ（得点ロール -2／+1.5、場面 -0.01〜+0.01）／
 *        交代パネルと編成の控え一覧に疲労・不調・ケガ明けの警告タグ）。指名と戦術変更は試合内の一時データで、セーブ形式は無変更
 * v0.17: 横画面レイアウト再整理（表示構造のみ。ゲームロジック・数値・セーブ形式は無変更）。
 *        ①HUD を1行に圧縮（状態はチップ、選手一覧／記録・OB は右端ピル、遊び方はアイコンボタン化）
 *        ②決定系ボタン（指示を確定／目標を決める／キックオフ／新年度を始める・新年度へ）を画面下部の固定アクションバーへ分離
 *        ③月頭指示の左カラムを「月のバナーを背景＋半透明カード（目標・設備／最近の出来事）」のヒーローパネルに統合し、
 *          バナーの帯状潰れとラベルの割れを解消 ④選手データを master-detail 化（左=一覧／右=詳細＋能力・プロフィールのタブ切替。
 *          一覧テーブルと詳細の全項目は保持） ⑤対戦確認の vs カードを内部スクロール化して 1060×600 のはみ出しを解消
 * v0.18: ライバル（他校エースの実在化＝帝都以外の各校にも名前・立ち絵・学年・特能・主要能力を持つエースを設定し、
 *        （学校, 世代）からの決定的シード生成で代替わりさせる。セーブに状態は持たず、年度から常に同じ人物を再現する／
 *        対戦確認に両軍キーマンの対比カード（立ち絵・特能・主要能力のランク表示）を追加／
 *        因縁の深化＝対戦校ごとの現在の連勝・連敗ストリーク career.streaks を記録し、ストリークで変わる実況と
 *        ライバル専用イベント（月次イベント枠に排他で割り込む）を追加）。エースの能力は学校の既存の強さ oppPower から
 *        導出する表示専用の数字で、試合の数式への影響は従来の skill 経由の補正のみ（新規の強さの源泉は作らない） */
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
  /* v0.7: 校風（チーム方針）。g=成長 f=疲労の溜まり t=信頼の伸び r=疲労の抜け */
  var ETHOS = [
    { k: 'discipline', n: '規律', d: '疲労が溜まりにくく、信頼が育ちやすい', g: 1.0, f: 0.9, t: 1.15, r: 1.0 },
    { k: 'free', n: '自由', d: 'のびのび育てる。疲労が抜けやすく、成長は穏やか', g: 0.96, f: 0.95, t: 0.95, r: 1.3 },
    { k: 'passion', n: '熱血', d: '成長は速いが、疲労も溜まりやすい', g: 1.08, f: 1.12, t: 1.05, r: 0.9 }
  ];
  var INJ_PARTS = ['左膝', '右肩', '足首', '太ももの裏', '腰', '手首'];
  /* v0.8: 調子（コンディション）。-2..2 の5段階で、場面成功率と練習効率に薄く効く
   * v0.12: 表示は「固定サイズの円形顔アイコンのみ」に見直し（ユーザー決定。パワプロ系の参照画像に基づく）。
   * 配色は 絶好調=ピンク / 好調=赤 / 普通=黄 / 不調=水色 / 絶不調=紫。テキストラベルは付けない
   * （文字は画面幅を圧迫し、要素ごとに表示幅が変わるのを避けるため）。寸法は FORM_FACE_PX で全画面共通に固定し、
   * 段階の判別は「色＋表情」だけで行う。ヘルパーは formFace の1箇所だけ */
  var FORM_FACE_PX = 20;
  var FORMS = [
    { v: -2, n: '絶不調', c: '#9d5bd6' },
    { v: -1, n: '不調', c: '#56b4e7' },
    { v: 0, n: '普通', c: '#f2c531' },
    { v: 1, n: '好調', c: '#ef4b3f' },
    { v: 2, n: '絶好調', c: '#e843c8' }
  ];
  function formOf(p) { return FORMS.filter(function (x) { return x.v === (p.form || 0); })[0] || FORMS[2]; }
  /* v0.12: 調子の顔アイコン（SVG・固定サイズ・ラベルなし）。表情は段階ごとに変える：
   * 絶好調=口を開けた大笑顔 / 好調=笑顔 / 普通=真顔（直線の口） / 不調=困り顔（眉＋下がった口） / 絶不調=落ち込んだ顔（閉じ目＋下がった口） */
  function formFace(p) { return formFaceVal(formOf(p).v); }
  /* v0.13: 調子の値そのものから顔アイコンを作る（選手詳細の「調子の推移」で過去の段階を並べるため） */
  function formFaceVal(v) {
    var f = FORMS.filter(function (x) { return x.v === v; })[0] || FORMS[2];
    var eyes = '<g fill="#33302e"><ellipse cx="14" cy="17" rx="1.7" ry="2.4"/><ellipse cx="26" cy="17" rx="1.7" ry="2.4"/></g>';
    var inner;
    if (f.v === 2) inner = eyes + '<path d="M12.5 21 Q20 33.5 27.5 21 Q20 25.5 12.5 21 Z" fill="#6b2237"/><path d="M15.8 26.4 Q20 28.8 24.2 26.4 Q20 30.2 15.8 26.4 Z" fill="#e56b7f"/>';
    else if (f.v === 1) inner = eyes + '<path d="M13 21.5 Q20 28.5 27 21.5" stroke="#33302e" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
    else if (f.v === 0) inner = eyes + '<path d="M14.5 24 H25.5" stroke="#33302e" stroke-width="2.2" stroke-linecap="round"/>';
    else if (f.v === -1) inner = eyes + '<g stroke="#33302e" stroke-width="1.9" fill="none" stroke-linecap="round"><path d="M10.8 12.4 L16.8 14.2"/><path d="M29.2 12.4 L23.2 14.2"/><path d="M13.5 27.5 Q20 21.8 26.5 27.5"/></g>';
    else inner = '<g stroke="#33302e" stroke-width="2" fill="none" stroke-linecap="round"><path d="M11 17.5 Q14 20.2 17 17.5"/><path d="M23 17.5 Q26 20.2 29 17.5"/><path d="M13.5 28 Q20 22.3 26.5 28"/></g>';
    var el = h('span', { class: 'formface', title: f.n, 'data-form': String(f.v) }, []);
    el.innerHTML = '<svg viewBox="0 0 40 40" width="' + FORM_FACE_PX + '" height="' + FORM_FACE_PX + '" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="' + f.c + '" stroke="rgba(0,0,0,.18)" stroke-width="1.5"/>' + inner + '</svg>';
    return el;
  }
  function rollForm() { var r = Math.random(); return r < 0.12 ? -1 : (r < 0.24 ? 1 : 0); }
  /* v0.16: 交代判断の警告（表示のみで強制はしない）。疲労が高い（70以上）／調子が不調以下（-1以下）／ケガ明けすぐ の3条件 */
  function warnReasons(p) {
    var r = [];
    if ((p.fatigue || 0) >= 70) r.push('疲労');
    if ((p.form || 0) <= -1) r.push('不調');
    if (p.justBack) r.push('ケガ明け');
    return r;
  }
  function warnEl(p) {
    var r = warnReasons(p);
    if (!r.length) return null;
    return h('span', { class: 'warntag' }, ['⚠ ' + r.join('・')]);
  }
  /* v0.13: 調子の推移の記録。各選手の formHist（直近最大6件・古い順）に、現在の調子が前回記録と違えば積む。
   * 調子が更新されるタイミング（月替わりの driftForm／盤面マスの解決／試合後／セーブ読み込み時）に
   * syncFormHist を呼び、差分だけを残す。調子の変動ロジック自体には一切関与しない */
  function syncFormHist() {
    if (!G || !Array.isArray(G.players)) return;
    G.players.forEach(function (p) {
      if (!Array.isArray(p.formHist)) p.formHist = [];
      var cur = clamp(Math.round(p.form || 0), -2, 2);
      if (!p.formHist.length || p.formHist[p.formHist.length - 1] !== cur) {
        p.formHist.push(cur);
        if (p.formHist.length > 6) p.formHist = p.formHist.slice(-6);
      }
    });
  }
  /* v0.9: シーズン目標（年初に1つ選ぶ。rank が達成判定の物差し） */
  var GOALS = [
    { k: 'win1', n: '予選でまず1勝', rank: 1, d: '花園予選の初戦を突破する' },
    { k: 'final', n: '県決勝に進出', rank: 2, d: '予選準決勝を勝ち、花園まであと1勝に迫る' },
    { k: 'hana', n: '花園出場', rank: 3, d: '県予選を制して全国大会へ' },
    { k: 'hanawin', n: '花園で1勝', rank: 4, d: '全国の舞台でまず1勝を挙げる' },
    { k: 'title', n: '花園優勝', rank: 5, d: '全国制覇。監督としての最高到達点' }
  ];
  /* v0.9: 設備解放（部の格のマイルストーンで解放。お金の概念は入れない） */
  var FACILITIES = [
    { k: 'weights', n: 'ウェイト場', gi: 2, d: '部の格「中堅」で解放。パワー練習の伸びが上がる' },
    { k: 'video', n: 'ビデオ分析室', gi: 3, d: '部の格「強豪」で解放。準備ボーナスの上限と作戦会議の実りが増える' },
    { k: 'dorm', n: '寮・専用グラウンド', gi: 4, d: '部の格「名門」で解放。ケアと休養で疲労が抜けやすくなる' }
  ];
  var UNIT_STAT = { FW: 'pow', BK: 'pas', SP: 'kik' };
  var UNIT_NAME = { FW: 'FW（フィジカル）', BK: 'BK（スキル）', SP: 'セットピース' };
  /* 相手校: 戦術傾向(style)とエース(ace)で個性を持たせる。ace.skill は SKILLS の key。
   * v0.18: ace は初代（世代0）の姿で、effOpp が年度に応じた現在のエース（代替わり含む）に差し替える。
   * jersey は相手校のユニフォーム色（エースの立ち絵用） */
  var OPP_STYLES = {
    fw: { n: 'FW主体', d: 'スクラムとモールで押し込む重戦車スタイル' },
    wide: { n: '展開ラグビー', d: 'バックスに大きく展開して走り勝つ' },
    kick: { n: 'キック多用', d: 'キックで敵陣に入り、ペナルティを誘う' },
    def: { n: '堅守', d: '低いタックルで粘り強く守り、カウンターを狙う' }
  };
  var OPPONENTS = [
    { name: '青葉高校', power: 38, note: '練習試合。力試し', skill: null, jersey: '#2e7d4f',
      style: 'wide', ace: { name: '風間 駿', pos: 'WTB', skill: 'step' } },
    { name: '県立西高校', power: 52, note: '花園予選 1回戦', skill: { n: '堅いディフェンス', key: 'def' }, jersey: '#b03a2e',
      style: 'def', ace: { name: '岩崎 剛', pos: 'CTB', skill: 'tackle' } },
    { name: '県立工業高校', power: 60, note: '花園予選 準決勝。FWの圧力が強い', skill: { n: 'モールの核がいるFW陣', key: 'maul' }, jersey: '#d97b16',
      style: 'fw', ace: { name: '大熊 鉄平', pos: 'No8', skill: 'maul' } },
    { name: '帝都学園', power: 69, note: '花園予選 決勝。県内王者の強豪校', skill: { n: '大舞台に強いエース', key: 'big' }, jersey: '#26221f',
      style: 'kick', ace: { name: '白鳥 圭', pos: 'SO', skill: 'big' } },
    { name: '東都第一高校', power: 77, note: '花園 初戦。全国レベルの強豪', skill: { n: 'ロングキッカーの司令塔', key: 'kick' }, jersey: '#3f7fbf',
      style: 'wide', ace: { name: '東雲 悠真', pos: 'SO', skill: 'kick' } },
    { name: '北辰学園', power: 85, note: '花園 決勝。全国屈指のタレント軍団', skill: { n: '鉄壁のラインアウト', key: 'lineout' }, jersey: '#5b3a8e',
      style: 'fw', ace: { name: '北原 蒼汰', pos: 'LO', skill: 'lineout' } }
  ];
  /* 試合の格ごとの停止点プラン（場面連動）。halftime は block5=40分 に来る並び */
  var STOP_PLANS = [
    ['setpiece', 'goal'],                                   // 練習試合: 2回
    ['setpiece', 'penalty', 'goal'],                        // 予選1回戦: 3回
    ['setpiece', 'goal', 'penalty', 'late'],                // 準決勝: 4回
    ['setpiece', 'goal', 'halftime', 'penalty', 'late'],    // 予選決勝: 5回
    ['setpiece', 'goal', 'halftime', 'penalty', 'late'],    // 花園初戦: 5回
    ['setpiece', 'goal', 'halftime', 'penalty', 'late']     // 花園決勝: 5回
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
    { m: '1月', cells: 8, match: 4, needWin: true },
    { m: '1月・花園決勝', cells: 8, match: 5, needWin: true }
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
  var subOutId = null;    /* v0.8: 交代UIで選択中の「下げる選手」 */
  var selKickerId = null; /* v0.16: 対戦確認で指名した PG キッカー（選手ID）。null=おまかせ。startMatch で消費される */
  var selMarkId = null;   /* v0.16: 対戦確認で指名したエースのマークマン（選手ID）。null=なし。同上 */
  var lineupSlot = null;
  var squadTab = 'stat'; /* v0.17: 選手詳細のタブ（'stat'=能力 / 'prof'=プロフィール）。表示専用でセーブには入れない */
  /* ===== v0.10: 効果音（WebAudio 合成・外部ファイルなし） =====
   * 設定はゲームのセーブとは別キー hanazono.sound に保存する。
   * AudioContext はユーザー操作の流れでのみ生成・再開し、失敗しても例外を外に出さない。
   * AudioContext が無い環境（jsdom 等）では全て無音で素通りする。 */
  var SOUND_KEY = 'hanazono.sound';
  var soundOn = true;
  try { soundOn = localStorage.getItem(SOUND_KEY) !== '0'; } catch (e) { soundOn = true; }
  var AC = null;              /* AudioContext */
  var sfxSuppressed = false;  /* 時短表示中は音を重ねない */
  function audioCtx() {
    try {
      if (!AC) {
        var Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        AC = new Ctor();
      }
      if (AC.state === 'suspended') { var p = AC.resume(); if (p && p.catch) p.catch(function () {}); }
      return AC;
    } catch (e) { return null; }
  }
  function tone(o) {
    var ac = audioCtx(); if (!ac) return;
    try {
      var t0 = ac.currentTime + (o.at || 0);
      var osc = ac.createOscillator(), g = ac.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(Math.max(1, o.f), t0);
      if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t0 + o.d);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(o.v || 0.07, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
      osc.connect(g); g.connect(ac.destination);
      osc.start(t0); osc.stop(t0 + o.d + 0.05);
    } catch (e) {}
  }
  function noiseBurst(o) { /* 歓声風ノイズ：ホワイトノイズをバンドパスに通す */
    var ac = audioCtx(); if (!ac) return;
    try {
      var dur = o.d || 0.5, t0 = ac.currentTime + (o.at || 0);
      var len = Math.max(1, Math.floor(ac.sampleRate * dur));
      var buf = ac.createBuffer(1, len, ac.sampleRate);
      var chn = buf.getChannelData(0);
      for (var i = 0; i < len; i++) chn[i] = Math.random() * 2 - 1;
      var src = ac.createBufferSource(); src.buffer = buf;
      var f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = o.freq || 900; f.Q.value = 0.7;
      var g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(o.v || 0.1, t0 + (o.a || 0.08));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(ac.destination);
      src.start(t0); src.stop(t0 + dur + 0.05);
    } catch (e) {}
  }
  function whistle(at) { /* ホイッスル：高音の方形波に速いビブラート */
    var ac = audioCtx(); if (!ac) return;
    try {
      var t0 = ac.currentTime + (at || 0), dur = 0.32;
      var osc = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
      osc.type = 'square'; osc.frequency.value = 2350;
      lfo.type = 'sine'; lfo.frequency.value = 30; lg.gain.value = 240;
      lfo.connect(lg); lg.connect(osc.frequency);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.025, t0 + 0.03);
      g.gain.setValueAtTime(0.025, t0 + dur - 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(ac.destination);
      osc.start(t0); lfo.start(t0); osc.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05);
    } catch (e) {}
  }
  function sfx(name, arg) {
    if (!soundOn || sfxSuppressed) return;
    try {
      if (name === 'tap') tone({ f: 640, f2: 500, type: 'triangle', d: 0.05, v: 0.045 });
      else if (name === 'steps') { var n = arg || 1, i; for (i = 0; i < n; i++) tone({ f: 320 + i * 36, type: 'triangle', d: 0.045, v: 0.04, at: i * 0.1 }); tone({ f: 520, d: 0.07, v: 0.055, at: n * 0.1 }); tone({ f: 780, d: 0.1, v: 0.055, at: n * 0.1 + 0.06 }); }
      else if (name === 'kick') tone({ f: 165, f2: 55, d: 0.16, v: 0.15 });
      else if (name === 'try') { noiseBurst({ d: 0.9, v: 0.13, freq: 1000, a: 0.15 }); whistle(0.05); tone({ f: 523, d: 0.12, v: 0.05, at: 0.02 }); tone({ f: 659, d: 0.12, v: 0.05, at: 0.12 }); tone({ f: 784, d: 0.2, v: 0.055, at: 0.22 }); }
      else if (name === 'concede') noiseBurst({ d: 0.45, v: 0.05, freq: 480 });
      else if (name === 'scene') { tone({ f: 880, type: 'triangle', d: 0.09, v: 0.055 }); tone({ f: 1174, type: 'triangle', d: 0.13, v: 0.055, at: 0.07 }); }
      else if (name === 'good') { tone({ f: 587, d: 0.09, v: 0.06 }); tone({ f: 880, d: 0.14, v: 0.06, at: 0.07 }); }
      else if (name === 'bad') tone({ f: 330, f2: 262, type: 'triangle', d: 0.18, v: 0.055 });
      else if (name === 'win') { [523, 659, 784, 1046].forEach(function (f, i) { tone({ f: f, d: 0.16, v: 0.065, at: i * 0.11 }); }); noiseBurst({ d: 1.0, v: 0.09, freq: 1100, a: 0.2 }); }
      else if (name === 'lose') { [392, 330, 262].forEach(function (f, i) { tone({ f: f, type: 'triangle', d: 0.22, v: 0.055, at: i * 0.16 }); }); }
      else if (name === 'achv') { [784, 988, 1175].forEach(function (f, i) { tone({ f: f, type: 'triangle', d: 0.14, v: 0.065, at: i * 0.08 }); }); }
      else if (name === 'whistle') whistle(0);
    } catch (e) {}
  }
  function toggleSound() {
    soundOn = !soundOn;
    try { localStorage.setItem(SOUND_KEY, soundOn ? '1' : '0'); } catch (e) {}
    if (soundOn) sfx('tap');
    render();
  }
  function soundBtn() {
    return h('button', { class: 'btn', onclick: function () { toggleSound(); } }, [soundOn ? '🔊 サウンド ON' : '🔇 サウンド OFF']);
  }
  var guideFrom = 'title'; /* 遊び方ガイドから戻る先 */
  function guideBtn(cls, sty) {
    var at = { class: cls, onclick: function () { guideFrom = screen; screen = 'guide'; render(); } };
    if (sty) at.style = sty;
    return h('button', at, ['📖 遊び方']);
  }

  /* ===== v0.10: トースト通知（実績達成時） ===== */
  function showToast(msg) {
    try {
      var layer = document.getElementById('toasts');
      if (!layer) { layer = document.createElement('div'); layer.id = 'toasts'; layer.className = 'toasts'; document.body.appendChild(layer); }
      var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
      layer.appendChild(t);
      setTimeout(function () { try { t.classList.add('show'); } catch (e) {} }, 10);
      setTimeout(function () {
        try { t.classList.remove('show'); } catch (e) {}
        setTimeout(function () { try { if (t.parentNode) t.parentNode.removeChild(t); } catch (e) {} }, 450);
      }, 3400);
    } catch (e) {}
  }

  /* ===== v0.10: 実績（トロフィー）。met が null のものはイベント時に直接 unlock する ===== */
  var ACHIEVEMENTS = [
    { id: 'firstwin', n: '初勝利', d: '監督として初めて試合に勝つ', met: function () { return (G.career.wins || 0) >= 1; } },
    { id: 'qual', n: '県予選突破', d: '花園予選で決勝に進出する', met: function () { return (G.career.maxBest || 0) >= 2; } },
    { id: 'hana1', n: '花園初出場', d: '花園（全国大会）に出場する', met: function () { return G.career.hana >= 1; } },
    { id: 'hanawin', n: '花園初勝利', d: '花園で1勝を挙げる', met: function () { return G.career.hanaWins >= 1; } },
    { id: 'hanatitle', n: '花園優勝', d: '花園で優勝する', met: function () { return G.career.hanaTitles >= 1; } },
    { id: 'wins10', n: '通算10勝', d: '監督通算で10勝する', met: function () { return (G.career.wins || 0) >= 10; } },
    { id: 'wins50', n: '通算50勝', d: '監督通算で50勝する', met: function () { return (G.career.wins || 0) >= 50; } },
    { id: 'giant', n: '格上撃破', d: '格上の相手に勝利する（善戦ではなく勝利）', met: null },
    { id: 'ob10', n: 'OB10人輩出', d: '卒業生をOBとして10人送り出す', met: function () { return G.obs.length >= 10; } },
    { id: 'ob30', n: 'OB30人輩出', d: '卒業生をOBとして30人送り出す', met: function () { return G.obs.length >= 30; } },
    { id: 'ace90', n: 'エース育成', d: '選手を総合90まで育てる', met: function () { return G.players.some(function (p) { return overall(p) >= 90; }) || G.obs.some(function (o) { return (o.avg || 0) >= 90; }); } },
    { id: 'noinj', n: '無事是名馬', d: 'ケガ人を1人も出さずにシーズンを完走する', met: null },
    { id: 'grade5', n: '名門到達', d: '部の格が「名門」に到達する', met: function () { return gradeIdx() >= 4; } }
  ];
  function achvDef(id) { for (var i = 0; i < ACHIEVEMENTS.length; i++) if (ACHIEVEMENTS[i].id === id) return ACHIEVEMENTS[i]; return null; }
  function unlockAchv(id) {
    if (!G || !G.career) return false;
    if (!G.career.achv || typeof G.career.achv !== 'object') G.career.achv = {};
    if (G.career.achv[id]) return false;
    G.career.achv[id] = G.year;
    var a = achvDef(id);
    if (a) { showToast('🏆 実績達成！「' + a.n + '」'); sfx('achv'); }
    return true;
  }
  function checkAchievements() {
    if (!G || !G.career) return;
    ACHIEVEMENTS.forEach(function (a) {
      if (!a.met) return;
      var ok = false; try { ok = !!a.met(); } catch (e) {}
      if (ok) unlockAchv(a.id);
    });
  }

  /* ===== v0.10: 再開時あらすじ（セーブ読み込みで再開した初回だけ出す） ===== */
  var showDigest = false;
  function maybeDigest() {
    if (!showDigest || !G) return;
    try {
      if (document.getElementById('digest')) return;
      var mo = MONTHS[G.monthIdx] || { m: '—' };
      var wrapEl = h('div', { class: 'digest', id: 'digest' });
      var card = h('div', { class: 'card digest-card' });
      card.appendChild(h('div', { class: 'sec' }, ['📋 おかえりなさい、監督 ― 前回までのあらすじ']));
      var rows = [
        ['いま', G.year + '年目・' + mo.m + '／部の格 ' + gradeOf().n + '／総合力 ' + teamPower()],
        ['今季ここまで', G.season.wins + '勝 ' + G.season.losses + '敗' + (G.qualified ? '（花園出場決定）' : '')]
      ];
      if (G.history && G.history.length) { var lh = G.history[G.history.length - 1]; rows.push(['これまでの歩み', lh.year + '年目の結果：' + lh.result]); }
      if (G.goalSet) rows.push(['今年の目標', goalOf().n]);
      rows.push(['今月の予定', mo.match != null ? '月末に ' + effOpp(mo.match).name + ' 戦がある' : (mo.camp ? '夏合宿の月。練習の実りが1.5倍になる' : '公式戦はない。育成と体調管理の月')]);
      rows.forEach(function (r) {
        card.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, [r[0]]), h('span', null, [r[1]])]));
      });
      card.appendChild(h('button', { class: 'btn primary', style: 'margin-top:12px', onclick: function () {
        showDigest = false;
        var d = document.getElementById('digest');
        if (d && d.parentNode) d.parentNode.removeChild(d);
      } }, ['グラウンドへ戻る ▶']));
      wrapEl.appendChild(card);
      document.body.appendChild(wrapEl);
    } catch (e) {}
  }
  /* v0.8: 編成画面で選択中のスロット */
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
  function skillNameByKey(key) { var s = SKILLS.filter(function (x) { return x.key === key; })[0]; return s ? s.n : key; }
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
      trait: pick(TRAITS), injured: 0, injSev: null, injPart: null, fatigue: ri(5, 20), form: rollForm(),
      h: sz.h, w: sz.w, person: opts.person || pick(PERSONS).n,
      skills: opts.skills ? opts.skills.slice() : rollSkills(pos),
      trust: typeof opts.trust === 'number' ? opts.trust : (year >= 2 ? ri(35, 60) : ri(22, 45)),
      srec: { tries: 0, plays: 0 }, crec: { tries: 0, plays: 0 },
      /* v0.13: 調子の推移（空で開始し、更新のたびに積まれる）／復帰イベント用フラグ／進路イベント既見フラグ */
      formHist: [], backMark: false, futureSeen: false, justBack: false
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
    /* v0.6: 個人スタッツ（今季のトライ・好プレー） */
    if (!p.srec || typeof p.srec !== 'object') p.srec = { tries: 0, plays: 0 };
    if (typeof p.srec.tries !== 'number' || !isFinite(p.srec.tries)) p.srec.tries = 0;
    if (typeof p.srec.plays !== 'number' || !isFinite(p.srec.plays)) p.srec.plays = 0;
    /* v0.8: 調子（-2..2） */
    if (typeof p.form !== 'number' || !isFinite(p.form)) p.form = ri(-1, 1);
    p.form = clamp(Math.round(p.form), -2, 2);
    /* v0.9: キャリア通算スタッツ */
    if (!p.crec || typeof p.crec !== 'object') p.crec = { tries: 0, plays: 0 };
    if (typeof p.crec.tries !== 'number' || !isFinite(p.crec.tries)) p.crec.tries = 0;
    if (typeof p.crec.plays !== 'number' || !isFinite(p.crec.plays)) p.crec.plays = 0;
  }
  /* v0.9: 個人スタッツは今季（srec）とキャリア通算（crec）の両方に積む */
  function addStat(p, kind) {
    if (!p) return;
    if (!p.srec) p.srec = { tries: 0, plays: 0 };
    if (!p.crec) p.crec = { tries: 0, plays: 0 };
    p.srec[kind]++; p.crec[kind]++;
  }
  function overall(p) { return STATS.reduce(function (a, s) { return a + p.stats[s.k]; }, 0) / 6; }
  /* v0.15: 能力ランク（表示変換のみ。数値ロジックには一切関与しない）。
   * 帯域は S=90以上 / A=80台 / B=70台 / C=60台 / D=50台 / E=40台 / F=30台 / G=29以下。
   * 色はユーザー提示のパワプロ系参照画像の段階色に寄せたもので、c=明背景用 / cb=濃色背景（成長レポートのボード）用。
   * 能力の実分布（入部時 34〜46 前後、ソフトキャップ 85〜、上限 99）では S はキャリア終盤のスターだけが届く帯域になる */
  var RANKS = [
    { r: 'S', min: 90, c: '#e843c8', cb: '#ff7ae0' },
    { r: 'A', min: 80, c: '#ef4b3f', cb: '#ff7a6e' },
    { r: 'B', min: 70, c: '#f07f13', cb: '#ffa04d' },
    { r: 'C', min: 60, c: '#c79400', cb: '#ffd94d' },
    { r: 'D', min: 50, c: '#7ba41f', cb: '#b5d94e' },
    { r: 'E', min: 40, c: '#2f9dbd', cb: '#6fd3ee' },
    { r: 'F', min: 30, c: '#3f6fd8', cb: '#7fa8f0' },
    { r: 'G', min: -999, c: '#9668c9', cb: '#c39ae8' }
  ];
  function rankOf(v) {
    v = Math.round(v);
    for (var i = 0; i < RANKS.length; i++) if (v >= RANKS[i].min) return RANKS[i];
    return RANKS[RANKS.length - 1];
  }
  function rankEl(v, onDark) {
    var rk = rankOf(v);
    var el = h('span', { class: 'rk', 'data-rank': rk.r }, []);
    el.style.color = onDark ? rk.cb : rk.c;
    el.textContent = rk.r;
    return el;
  }
  /* ランク文字＋数値の併記部品（cls: 'sm'=一覧などの小型 / 'lg'=詳細の大型） */
  function rankValEl(v, cls, onDark) {
    var wrap15 = h('span', { class: 'rkval' + (cls ? ' ' + cls : '') }, []);
    wrap15.appendChild(rankEl(v, onDark));
    wrap15.appendChild(document.createTextNode(' ' + Math.round(v)));
    return wrap15;
  }
  /* v0.15: 成長レポートの名前プレート色（名前から決定的に選ぶ。参照画像の色つき名前プレートに寄せたパレット） */
  var PLATE_COLORS = ['#f7d54d', '#f6b8cd', '#f49a8c', '#a8d97c', '#f2a541', '#9fd3e8'];
  function plateColor(name) {
    var s = 0;
    for (var i = 0; i < name.length; i++) s += name.charCodeAt(i) * (i + 1);
    return PLATE_COLORS[s % PLATE_COLORS.length];
  }
  function newGame(diff) {
    namePool = {};
    G = {
      year: 1, monthIdx: 0, players: [], obs: [], rep: 30, nextId: 1,
      career: { hana: 0, hanaWins: 0, titles: 0, hanaTitles: 0, wins: 0, maxBest: 0, achv: {}, seasonHist: [], oppRec: {}, captains: [], streaks: {} },
      season: { wins: 0, losses: 0, result: '予選敗退', bestWin: 0, hanaWins: 0, hanaTitle: false, injuries: 0 },
      inst: { team: 'sta', unit: 'FW', focus: 1, level: 0 },
      captainId: null, ethos: 'discipline', lineup: null,
      board: null, qualified: false, tactic: 'fw', nextBonus: 0,
      monthLog: [], summary: null,
      /* v0.13: 月次成長レポートの記録（当月の蓄積と、前月のスナップショット） */
      growAcc: null, growReport: null,
      /* v0.9: 難易度・シーズン目標・ライバル・歴代チーム・設備 */
      difficulty: diff === 'challenge' ? 'challenge' : 'normal',
      goal: null, goalSet: false,
      rival: { name: '白鳥 圭', pos: 'SO', skill: 'big', grade: 2 },
      rivalW: 0, rivalL: 0, rivalLast: null, rivalNews: null,
      history: [], facSeen: []
    };
    for (var i = 0; i < 15; i++) {
      var yr = i < 5 ? 3 : (i < 10 ? 2 : 1);
      G.players.push(makePlayer(i, yr, yr === 3 ? 50 : yr === 2 ? 44 : 38));
    }
    for (var j = 0; j < 3; j++) G.players.push(makePlayer(ri(0, 14), ri(1, 2), 40));
    sortRoster();
    var capBest = null;
    G.players.forEach(function (p) { if (!capBest || p.trust > capBest.trust) capBest = p; });
    G.captainId = capBest ? capBest.id : null;
    recordCaptain(); /* v0.14: 初代キャプテンの任命も歴代キャプテンに残す（保存前に記録する） */
    G.goal = recommendedGoal().k; /* v0.9: 目標の初期値は部の格のおすすめ（目標画面で変更できる） */
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
    /* v0.7: ケガは「離脱の残り月数＋重症度＋部位」で持つ。旧セーブの 0/1 は軽症1か月に読み替える */
    if (typeof p.injured !== 'number' || !isFinite(p.injured) || p.injured < 0) p.injured = p.injured ? 1 : 0;
    p.injured = Math.min(6, Math.floor(p.injured));
    if (p.injured > 0) {
      if (p.injSev !== 'light' && p.injSev !== 'heavy') p.injSev = 'light';
      if (typeof p.injPart !== 'string' || !p.injPart) p.injPart = '負傷';
    } else { p.injSev = null; p.injPart = null; }
    migratePlayer(p);
    /* v0.13: 調子履歴（数値 -2..2 の配列・最大6件に丸める）とイベント用フラグの検証 */
    if (!Array.isArray(p.formHist)) p.formHist = [];
    p.formHist = p.formHist.filter(function (v) { return typeof v === 'number' && isFinite(v); })
      .map(function (v) { return clamp(Math.round(v), -2, 2); }).slice(-6);
    if (typeof p.backMark !== 'boolean') p.backMark = !!p.backMark;
    /* v0.16: ケガ明けすぐフラグ（交代パネルの警告表示用。復帰時に立ち、出場した試合の終了で落ちる） */
    if (typeof p.justBack !== 'boolean') p.justBack = !!p.justBack;
    if (typeof p.futureSeen !== 'boolean') p.futureSeen = !!p.futureSeen;
    /* v0.14: 進路イベントで決まった進路ラベル（卒業時に OB 名鑑へ引き継ぐ）。文字列でなければ未確定として落とす */
    if (typeof p.futurePath !== 'string' || !p.futurePath) p.futurePath = null;
  }
  function sanitize() {
    if (!G || !G.players) return;
    G.players.forEach(fixPlayer);
    /* v0.6: 通算記録の欠けたフィールドを補完（花園優勝回数など） */
    if (!G.career || typeof G.career !== 'object') G.career = { hana: 0, hanaWins: 0, titles: 0, hanaTitles: 0, seasonHist: [], oppRec: {}, captains: [], streaks: {} };
    ['hana', 'hanaWins', 'titles', 'hanaTitles', 'wins', 'maxBest'].forEach(function (k) {
      if (typeof G.career[k] !== 'number' || !isFinite(G.career[k])) G.career[k] = 0;
    });
    /* v0.10: 実績。最高到達（倒した相手の最大index）を今季と履歴結果から復元し、判定できる実績はトーストなしで補完する */
    var bw0 = (G.season && typeof G.season.bestWin === 'number' && isFinite(G.season.bestWin)) ? G.season.bestWin : 0;
    if (bw0 > G.career.maxBest) G.career.maxBest = bw0;
    (Array.isArray(G.history) ? G.history : []).forEach(function (hh) {
      var rr = hh && hh.result ? String(hh.result) : '', bb = 0;
      if (rr.indexOf('花園優勝') >= 0) bb = 5;
      else if (rr.indexOf('花園決勝進出') >= 0 || rr.indexOf('準優勝') >= 0) bb = 4;
      else if (rr.indexOf('花園') >= 0) bb = 3;
      else if (rr.indexOf('予選決勝敗退') >= 0) bb = 2;
      else if (rr.indexOf('予選準決勝敗退') >= 0) bb = 1;
      if (bb > G.career.maxBest) G.career.maxBest = bb;
    });
    if (!G.career.achv || typeof G.career.achv !== 'object' || Array.isArray(G.career.achv)) G.career.achv = {};
    ACHIEVEMENTS.forEach(function (a) {
      if (a.met && !G.career.achv[a.id]) { var okA = false; try { okA = !!a.met(); } catch (e) {} if (okA) G.career.achv[a.id] = G.year; }
    });
    if (typeof G.monthIdx !== 'number' || G.monthIdx < 0 || G.monthIdx >= MONTHS.length) G.monthIdx = 0;
    /* v0.7: 校風とキャプテンの検証（キャプテンが卒業・不在なら信頼度トップを自動で引き継ぐ） */
    if (!ETHOS.some(function (e) { return e.k === G.ethos; })) G.ethos = 'discipline';
    /* v0.8: 編成（スタメン15名のID列）の検証。壊れていたら自動選出に戻す */
    if (G.lineup != null) {
      var lok = Array.isArray(G.lineup) && G.lineup.length === 15 &&
        G.lineup.every(function (id) { return G.players.some(function (p) { return p.id === id; }); }) &&
        G.lineup.filter(function (id, i) { return G.lineup.indexOf(id) === i; }).length === 15;
      if (!lok) G.lineup = null;
    }
    /* v0.9: シーズンの到達度トラッキング */
    if (!G.season || typeof G.season !== 'object') G.season = { wins: 0, losses: 0, result: '予選敗退' };
    ['wins', 'losses', 'bestWin', 'hanaWins'].forEach(function (k) {
      if (typeof G.season[k] !== 'number' || !isFinite(G.season[k])) G.season[k] = 0;
    });
    if (typeof G.season.injuries !== 'number' || !isFinite(G.season.injuries) || G.season.injuries < 0) G.season.injuries = 0; /* v0.10: 今季のケガ発生数 */
    if (typeof G.season.hanaTitle !== 'boolean') G.season.hanaTitle = !!G.season.hanaTitle;
    /* v0.9: 難易度（旧セーブは ふつう） */
    if (G.difficulty !== 'challenge') G.difficulty = 'normal';
    /* v0.9: 目標。旧セーブはおすすめ目標を自動で入れて確定扱いにする（画面は挟まない） */
    if (typeof G.goalSet !== 'boolean') G.goalSet = true;
    if (!GOALS.some(function (x) { return x.k === G.goal; })) G.goal = recommendedGoal().k;
    /* v0.9: ライバル（帝都学園のエース） */
    if (!G.rival || typeof G.rival !== 'object' || typeof G.rival.name !== 'string' || !G.rival.name) {
      G.rival = { name: '白鳥 圭', pos: 'SO', skill: 'big', grade: 2 };
    }
    if (['PR', 'HO', 'LO', 'FL', 'No8', 'SH', 'SO', 'CTB', 'WTB', 'FB'].indexOf(G.rival.pos) < 0) G.rival.pos = 'SO';
    if (!SKILLS.some(function (s) { return s.key === G.rival.skill; })) G.rival.skill = 'big';
    if (typeof G.rival.grade !== 'number' || !isFinite(G.rival.grade)) G.rival.grade = 2;
    G.rival.grade = clamp(Math.round(G.rival.grade), 1, 3);
    if (typeof G.rivalW !== 'number' || !isFinite(G.rivalW)) G.rivalW = 0;
    if (typeof G.rivalL !== 'number' || !isFinite(G.rivalL)) G.rivalL = 0;
    if (G.rivalLast !== 'win' && G.rivalLast !== 'lose') G.rivalLast = null;
    if (typeof G.rivalNews !== 'string') G.rivalNews = null;
    /* v0.9: 歴代チームと設備の解放済み記録 */
    if (!Array.isArray(G.history)) G.history = [];
    G.history = G.history.filter(function (hh) { return hh && typeof hh.year === 'number' && typeof hh.power === 'number'; });
    if (!Array.isArray(G.facSeen)) {
      G.facSeen = FACILITIES.filter(function (f) { return gradeIdx() >= f.gi; }).map(function (f) { return f.k; });
    }
    /* v0.15: 初回ヒントの表示済みフラグ。旧セーブは「最初の月（1年目・4月）にいる場合だけ未表示」として移行する */
    if (typeof G.hintSeen !== 'boolean') G.hintSeen = !(G.year === 1 && G.monthIdx === 0);
    if (!G.players.some(function (p) { return p.id === G.captainId; })) {
      var cb = null;
      G.players.forEach(function (p) { if (!cb || (p.trust || 0) > (cb.trust || 0)) cb = p; });
      G.captainId = cb ? cb.id : null;
    }
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
    /* v0.13: 月次成長レポートの記録（表示専用のデータ）。形が壊れていたら捨てる */
    if (!G.growAcc || typeof G.growAcc !== 'object' || Array.isArray(G.growAcc) ||
        typeof G.growAcc.y !== 'number' || typeof G.growAcc.m !== 'number' ||
        !G.growAcc.by || typeof G.growAcc.by !== 'object' || Array.isArray(G.growAcc.by)) G.growAcc = null;
    if (!G.growReport || typeof G.growReport !== 'object' || Array.isArray(G.growReport) ||
        typeof G.growReport.label !== 'string' || !Array.isArray(G.growReport.rows) || !G.growReport.rows.length) G.growReport = null;
    /* v0.14: 記録の深化（シーズン別成績・対戦校別成績・歴代キャプテン）の検証と移行。
     * 旧セーブでは実記録として残っている範囲（歴代チームの年・結果、帝都との通算）だけを初期値にし、推測では埋めない */
    if (!Array.isArray(G.career.seasonHist)) {
      G.career.seasonHist = (Array.isArray(G.history) ? G.history : []).filter(function (hh) {
        return hh && typeof hh.year === 'number' && typeof hh.result === 'string';
      }).map(function (hh) {
        return { y: hh.year, result: hh.result, w: null, l: null, grade: null, goal: null, goalOk: null };
      }).slice(-30);
    } else {
      G.career.seasonHist = G.career.seasonHist.filter(function (sh) {
        return sh && typeof sh.y === 'number' && isFinite(sh.y) && typeof sh.result === 'string';
      }).map(function (sh) {
        return {
          y: sh.y, result: sh.result,
          w: (typeof sh.w === 'number' && isFinite(sh.w)) ? sh.w : null,
          l: (typeof sh.l === 'number' && isFinite(sh.l)) ? sh.l : null,
          grade: (typeof sh.grade === 'string' && sh.grade) ? sh.grade : null,
          goal: (typeof sh.goal === 'string' && sh.goal) ? sh.goal : null,
          goalOk: (typeof sh.goalOk === 'boolean') ? sh.goalOk : null
        };
      }).slice(-30);
    }
    if (!G.career.oppRec || typeof G.career.oppRec !== 'object' || Array.isArray(G.career.oppRec)) {
      G.career.oppRec = {};
      var rw0 = (typeof G.rivalW === 'number' && isFinite(G.rivalW)) ? G.rivalW : 0;
      var rl0 = (typeof G.rivalL === 'number' && isFinite(G.rivalL)) ? G.rivalL : 0;
      if (rw0 + rl0 > 0) G.career.oppRec['帝都学園'] = { p: rw0 + rl0, w: rw0, l: rl0 };
    } else {
      Object.keys(G.career.oppRec).forEach(function (nm) {
        var r0 = G.career.oppRec[nm];
        if (!r0 || typeof r0 !== 'object' || Array.isArray(r0)) { delete G.career.oppRec[nm]; return; }
        ['p', 'w', 'l'].forEach(function (k) { if (typeof r0[k] !== 'number' || !isFinite(r0[k]) || r0[k] < 0) r0[k] = 0; });
      });
    }
    /* v0.18: 対戦校ごとの現在の連勝・連敗ストリーク。旧セーブには無いので「不明＝空」から始め、
     * これからの試合結果でだけ育てる（過去の連勝・連敗を推測で復元しない） */
    if (!G.career.streaks || typeof G.career.streaks !== 'object' || Array.isArray(G.career.streaks)) G.career.streaks = {};
    Object.keys(G.career.streaks).forEach(function (nm2) {
      var sv = G.career.streaks[nm2];
      if (typeof sv !== 'number' || !isFinite(sv)) { delete G.career.streaks[nm2]; return; }
      G.career.streaks[nm2] = clamp(Math.round(sv), -99, 99);
    });
    if (!Array.isArray(G.career.captains)) G.career.captains = [];
    else {
      G.career.captains = G.career.captains.filter(function (cp) {
        return cp && typeof cp.id === 'number' && typeof cp.name === 'string' && cp.name && Array.isArray(cp.years);
      }).map(function (cp) {
        return {
          id: cp.id, name: cp.name,
          grade: (typeof cp.grade === 'number' && isFinite(cp.grade)) ? clamp(Math.round(cp.grade), 1, 3) : null,
          years: cp.years.filter(function (y) { return typeof y === 'number' && isFinite(y); })
        };
      }).slice(-30);
    }
    recordCaptain();
    /* v0.13: 読み込み時点の調子を推移の起点として記録する */
    syncFormHist();
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
  function autoStarterIds() {
    var used = {}, out = [];
    for (var n = 0; n < 15; n++) {
      var cands = G.players.filter(function (p) { return p.posIdx === n && !used[p.id]; })
        .sort(function (a, b) { return overall(b) - overall(a); });
      var chosen = cands.filter(function (p) { return !p.injured; })[0] || cands[0] || null;
      if (!chosen) {
        var rest = G.players.filter(function (p) { return !used[p.id]; }).sort(function (a, b) { return overall(b) - overall(a); });
        chosen = rest.filter(function (p) { return !p.injured; })[0] || rest[0] || null;
      }
      if (chosen) { used[chosen.id] = 1; out.push(chosen.id); }
    }
    return out;
  }
  /* v0.8: 実効スタメンのID列。編成（G.lineup）があれば尊重し、
   * ケガ・不在で欠けた枠は「そのポジションの健康な最上位→全体の健康な最上位」で自動補完する */
  function lineupIds() {
    if (!Array.isArray(G.lineup) || G.lineup.length !== 15) return autoStarterIds();
    var used = {}, out = [];
    for (var n = 0; n < 15; n++) {
      var p = G.players.filter(function (x) { return x.id === G.lineup[n]; })[0];
      if (p && !p.injured && !used[p.id]) { used[p.id] = 1; out.push(p.id); continue; }
      var cands = G.players.filter(function (x) { return x.posIdx === n && !used[x.id] && !x.injured; })
        .sort(function (a, b) { return overall(b) - overall(a); });
      var chosen = cands[0];
      if (!chosen) {
        var rest = G.players.filter(function (x) { return !used[x.id] && !x.injured; }).sort(function (a, b) { return overall(b) - overall(a); });
        chosen = rest[0];
        if (!chosen) {
          var rest2 = G.players.filter(function (x) { return !used[x.id]; }).sort(function (a, b) { return overall(b) - overall(a); });
          chosen = rest2[0];
        }
      }
      out.push(chosen ? chosen.id : null);
      if (chosen) used[chosen.id] = 1;
    }
    return out;
  }
  function starters() {
    return lineupIds().map(function (id) { return G.players.filter(function (p) { return p.id === id; })[0]; }).filter(Boolean);
  }
  /* 試合中は M.fieldIds（交代を反映した現在の顔ぶれ）、それ以外は starters() を返す */
  function fieldPlayers() {
    if (M && Array.isArray(M.fieldIds) && M.fieldIds.length) {
      return M.fieldIds.map(function (id) { return G.players.filter(function (p) { return p.id === id; })[0]; }).filter(Boolean);
    }
    return starters();
  }
  function fieldPower() {
    var f = fieldPlayers(); if (!f.length) return 0;
    return Math.round(f.reduce(function (a, p) { return a + overall(p); }, 0) / f.length * 10) / 10;
  }
  function teamPower() {
    var st = starters(); if (!st.length) return 0;
    return Math.round(st.reduce(function (a, p) { return a + overall(p); }, 0) / st.length * 10) / 10;
  }
  function clutchBonus() { return starters().reduce(function (a, p) { return a + (p.trait.clutch || 0); }, 0) / 4; }
  function avgTrust(players) { if (!players.length) return 50; return players.reduce(function (a, p) { return a + (p.trust || 50); }, 0) / players.length; }
  function skillCount(players, key) { return players.filter(function (p) { return hasSkill(p, key); }).length; }
  function avgAttr(players, key) { if (!players.length) return 0; return players.reduce(function (a, p) { return a + (p[key] || 0); }, 0) / players.length; }
  function ethosOf() { return ETHOS.filter(function (e) { return e.k === G.ethos; })[0] || ETHOS[0]; }
  function captainOf() { return G.players.filter(function (p) { return p.id === G.captainId; })[0] || null; }
  /* v0.14: 歴代キャプテンの記録。sanitize（＝毎回の描画と読み込み）から呼ばれ、現在のキャプテンを履歴に残す。
   * 任命の変更も卒業時の自動引き継ぎも、次に sanitize が走った時点でここに集約される。同じ選手は1エントリに
   * まとめ、務めたキャリア年を years に併記する。表示専用の記録で、キャプテンの効果には一切関与しない */
  function recordCaptain() {
    if (!G || !G.career || !Array.isArray(G.players)) return;
    var cap = captainOf(); if (!cap) return;
    if (!Array.isArray(G.career.captains)) G.career.captains = [];
    var ent = null;
    G.career.captains.forEach(function (c) { if (c.id === cap.id) ent = c; });
    if (!ent) {
      ent = { id: cap.id, name: cap.name, grade: cap.year, years: [] };
      G.career.captains.push(ent);
      if (G.career.captains.length > 30) G.career.captains = G.career.captains.slice(-30);
    }
    if (ent.years.indexOf(G.year) < 0) {
      ent.years.push(G.year);
      ent.years.sort(function (a, b) { return a - b; });
    }
  }
  function gainTrust(p, amt) {
    /* 校風で伸びが変わり、キャプテンは信頼を集めやすい */
    var mul = ethosOf().t * (p.id === G.captainId ? 1.3 : 1);
    p.trust = clamp(Math.round((p.trust || 50) + amt * (personOf(p).trust || 1) * mul), 0, 99);
  }
  /* v0.7: ケガの発生と時間経過での回復 */
  function hurtPlayer(p, heavy) {
    if (G.season) G.season.injuries = (G.season.injuries || 0) + 1; /* v0.10: 実績「ケガ人ゼロ」用に数える */
    p.injured = heavy ? ri(2, 3) : 1;
    p.injSev = heavy ? 'heavy' : 'light';
    p.injPart = pick(INJ_PARTS);
    return p.injured;
  }
  function tickInjuries() {
    var recovered = [];
    G.players.forEach(function (p) {
      if (p.injured > 0) {
        p.injured--;
        /* v0.13: ケガ（体調不良を除く）から復帰したら、復帰イベント用フラグを立てる */
        if (p.injured === 0) { if (p.injPart !== '体調不良') p.backMark = true; p.justBack = true; p.injSev = null; p.injPart = null; recovered.push(p.name); }
      }
    });
    return recovered;
  }
  /* v0.9: 目標のおすすめ（部の格に応じる）と達成ランク */
  function recommendedGoal() { return GOALS[gradeIdx()] || GOALS[0]; }
  function goalOf() { return GOALS.filter(function (x) { return x.k === G.goal; })[0] || recommendedGoal(); }
  function achievedRank() {
    var s = G.season || {};
    if (s.hanaTitle) return 5;
    if ((s.hanaWins || 0) > 0) return 4;
    if (G.qualified) return 3;
    if ((s.bestWin || 0) >= 2) return 2;
    if ((s.bestWin || 0) >= 1) return 1;
    return 0;
  }
  /* v0.9: 設備と難易度のヘルパー */
  function hasFacility(k) {
    var f = FACILITIES.filter(function (x) { return x.k === k; })[0];
    return !!f && gradeIdx() >= f.gi;
  }
  function bonusCap() { return hasFacility('video') ? 8 : 6; }
  function repGain(n) { return G.difficulty === 'challenge' ? Math.max(1, Math.round(n * 0.7)) : n; }
  /* v0.9: 帝都学園のエースは G.rival（存命の人物）に差し替える。
   * v0.18: 帝都以外の各校のエースも「その年度に在籍している人物」として effOpp が返す。
   * 他校分はセーブに状態を持たず、(学校, 世代) からの決定的シード生成で再現する（下記） */
  function effOpp(idx) {
    var opp = OPPONENTS[idx];
    var c = {}; Object.keys(opp).forEach(function (k) { c[k] = opp[k]; });
    if (idx === 3 && G.rival) {
      var rp = 0; POSITIONS.forEach(function (x, i) { if (x.p === G.rival.pos) rp = i; });
      var rseed = 0; for (var ri2 = 0; ri2 < G.rival.name.length; ri2++) rseed = (rseed * 31 + G.rival.name.charCodeAt(ri2)) >>> 0;
      c.ace = { name: G.rival.name, pos: G.rival.pos, skill: G.rival.skill, grade: G.rival.grade, epoch: -1,
        posIdx: rp, person: '熱血', h: 176, w: 82, seedId: -(900000 + (rseed % 50000)) };
      return c;
    }
    c.ace = oppAceAt(idx, G.year);
    return c;
  }
  function newRivalAce(grade) {
    return { name: uniqName(), pos: pick(['SO', 'SO', 'CTB', 'FB']), skill: pick(['big', 'kick', 'step', 'big']), grade: grade || 1 };
  }
  /* ===== v0.18: 他校エースの決定的生成 =====
   * 世代（epoch）ごとに在任年数（2〜3年）と入部時学年がシードで決まるため、(学校, 年度) から
   * 常に同じ人物・同じ学年が再現できる。世代0は v0.6 から固定だった OPPONENTS[].ace を初代として使う。
   * エースの「能力」は aceStatsOf で学校の既存の強さ（oppPower）から導出する表示専用の数字であり、
   * 試合の数式に新規の強さを足すことはしない（試合への影響は従来どおり skill 経由の既存補正のみ） */
  var ACE_POS_BY_STYLE = {
    fw: ['No8', 'LO', 'FL', 'PR', 'HO'],
    wide: ['WTB', 'FB', 'CTB', 'SO'],
    kick: ['SO', 'FB', 'SH', 'CTB'],
    def: ['CTB', 'FL', 'No8', 'FB']
  };
  var ACE_SKILL_STAT = { lineout: 'pow', maul: 'pow', tackle: 'tak', kick: 'kik', step: 'spd', big: 'sta', tough: 'sta' };
  function aceEpochSeed(idx, epoch) { return ((idx + 3) * 7919 + epoch * 104729 + 29) >>> 0; }
  /* 世代の在任年数と入部時学年（在任 L 年なら入部は 4-L 年生＝卒業時は必ず3年） */
  function aceTenure(idx, epoch) {
    var R = rng32(aceEpochSeed(idx, epoch) ^ 0x51ab);
    var len = 2 + Math.floor(R() * 2);
    return { len: len, entry: 4 - len };
  }
  function genOppAce(idx, epoch) {
    var base = OPPONENTS[idx];
    var R = rng32(aceEpochSeed(idx, epoch));
    var ten = aceTenure(idx, epoch);
    var name, pos, skill;
    if (epoch === 0) {
      name = base.ace.name; pos = base.ace.pos; skill = base.ace.skill;
    } else {
      name = SURNAMES[Math.floor(R() * SURNAMES.length)] + ' ' + GIVEN[Math.floor(R() * GIVEN.length)];
      var pool = ACE_POS_BY_STYLE[base.style] || ['SO', 'CTB'];
      pos = pool[Math.floor(R() * pool.length)];
      var aff = (SKILL_AFFINITY[pos] || []).slice();
      if (aff.indexOf(base.ace.skill) < 0) aff.push(base.ace.skill);
      skill = aff[Math.floor(R() * aff.length)];
    }
    var posIdx = 0; POSITIONS.forEach(function (x, i) { if (x.p === pos) posIdx = i; });
    var sz = POS_SIZE[pos] || [170, 185, 70, 95];
    return {
      name: name, pos: pos, skill: skill, grade: ten.entry, epoch: epoch, posIdx: posIdx,
      person: PERSONS[Math.floor(R() * PERSONS.length)].n,
      h: sz[0] + Math.floor(R() * (sz[1] - sz[0] + 1)),
      w: sz[2] + Math.floor(R() * (sz[3] - sz[2] + 1)),
      seedId: -((idx + 1) * 100003 + epoch * 131 + 7)
    };
  }
  /* 指定年度にその学校のエースである人物（学年は在任年数ぶん進んだ値で返す） */
  function oppAceAt(idx, year) {
    var start = 1, epoch = 0;
    while (epoch < 80) {
      var ten = aceTenure(idx, epoch);
      if (year < start + ten.len) {
        var a = genOppAce(idx, epoch);
        a.grade = ten.entry + (year - start);
        return a;
      }
      start += ten.len; epoch++;
    }
    return genOppAce(idx, 0);
  }
  /* エースの表示用能力（6能力）。学校の総合力から決定的に導出するだけで、勝敗の計算には使わない */
  function aceStatsOf(ace, power) {
    var seed = 0;
    for (var i = 0; i < ace.name.length; i++) seed = (seed * 31 + ace.name.charCodeAt(i)) >>> 0;
    seed = (seed + (ace.epoch + 2) * 131) >>> 0;
    var R = rng32(seed ^ 0x77aa);
    var posMain = (POSITIONS[ace.posIdx] || POSITIONS[9]).main;
    var skStat = ACE_SKILL_STAT[ace.skill] || posMain;
    var st = {};
    STATS.forEach(function (s) {
      var v = power + Math.floor(R() * 12) - 6;
      if (s.k === posMain) v += 8;
      if (s.k === skStat) v += 5;
      st[s.k] = clamp(Math.round(v), 25, 97);
    });
    return st;
  }
  function aceOverallOf(ace, power) {
    var st = aceStatsOf(ace, power);
    return STATS.reduce(function (a, s) { return a + st[s.k]; }, 0) / 6;
  }
  /* エースの立ち絵要素（相手校ジャージ色で描く。portraitSVG は p.jersey を見て色を変える） */
  function acePortraitEl(idx, ace, cls) {
    return portraitEl({ id: ace.seedId, name: ace.name, posIdx: ace.posIdx, w: ace.w, h: ace.h, person: ace.person, jersey: OPPONENTS[idx].jersey || '#44506b' }, cls);
  }
  /* ===== v0.18: 対戦校との現在の連勝・連敗（career.streaks。正=桜丘の連勝、負=連敗） =====
   * oppRec（通算）とは別に持つ。v0.14 の oppRec 移行の形（厳密な初期値）を変えないためで、
   * 旧セーブのストリークは「不明＝0」から始める（推測で埋めない） */
  function streakOf(name) {
    var s = (G.career && G.career.streaks) ? G.career.streaks[name] : 0;
    return (typeof s === 'number' && isFinite(s)) ? s : 0;
  }
  function streakText(st) {
    if (st >= 2) return '目下 ' + st + '連勝中';
    if (st <= -2) return '目下 ' + (-st) + '連敗中';
    if (st === 1) return '前回対戦は勝利';
    if (st === -1) return '前回対戦は敗戦';
    return '';
  }
  function effOf(p) { return p.fatigue >= 70 ? 0.55 : (p.fatigue >= 40 ? 0.85 : 1); }
  function avgFatigue() { return Math.round(G.players.reduce(function (a, p) { return a + p.fatigue; }, 0) / Math.max(1, G.players.length)); }

  /* ---------------- 月頭指示と盤面 ---------------- */
  function unitOf(p) {
    var pos = POSITIONS[p.posIdx];
    if (SP_POS[pos.p]) return 'SP';
    return pos.g;
  }
  /* v0.8: 調子は月が替わるたびにゆるやかに揺れる */
  function driftForm() {
    G.players.forEach(function (p) {
      var r = Math.random();
      if (r < 0.22) p.form = clamp((p.form || 0) + 1, -2, 2);
      else if (r < 0.42) p.form = clamp((p.form || 0) - 1, -2, 2);
    });
  }
  function startMonth() {
    driftForm();
    syncFormHist(); /* v0.13: 月替わりの調子変動を推移に記録 */
    G.hintSeen = true; /* v0.15: 初回ヒントは最初の月を始めたら二度と出さない */
    var mo = MONTHS[G.monthIdx];
    var tpl = mo.cells >= 12 ? ['pS', 'pS', 'pS', 'pS', 'pB', 'pB', 'ev', 'ev', 'rec', 'free', 'meet'] : ['pS', 'pS', 'pB', 'ev', 'rec', 'free'];
    var cells = shuffle(tpl.slice()).map(function (t) { return { t: t, done: false }; });
    cells.push({ t: 'end', done: false });
    G.board = { cells: cells, pos: -1, hand: drawCards(3), log: [] };
    if (mo.camp) G.board.log.push('夏合宿の月。練習の実りが1.5倍になる');
    /* v0.9: 部の格が上がって新たに解放された設備を知らせる */
    var newFac = FACILITIES.filter(function (f) { return hasFacility(f.k) && (G.facSeen || []).indexOf(f.k) < 0; });
    if (newFac.length) {
      G.facSeen = (G.facSeen || []).concat(newFac.map(function (f) { return f.k; }));
      G.board.log.push('🏟 設備が解放された！ ' + newFac.map(function (f) { return f.n + '（' + f.d + '）'; }).join('／'));
    }
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
    syncFormHist(); /* v0.13: マス解決で動いた調子を推移に記録 */
    sfx('steps', v);
    checkAchievements();
    save(); render();
  }
  function resolveCell(t) {
    var b = G.board;
    if (t === 'pS' || t === 'pB') return applyPractice(t === 'pB');
    if (t === 'ev') { var e = rollEvent(); b.log.push('🎲 ' + (e ? e.t : '穏やかな日々。特に何もなかった')); if (e && e.dlg) b.dlg = e.dlg; return; }
    if (t === 'rec') {
      var rr = ethosOf().r;
      /* v0.9: 寮・専用グラウンドがあるとケアの回復量が増える */
      var recAmt = hasFacility('dorm') ? 32 : 25;
      G.players.forEach(function (p) { p.fatigue = Math.max(0, p.fatigue - Math.round(recAmt * rr)); });
      /* v0.8: ケアの日は調子も上向きやすい */
      var upN = 0;
      G.players.forEach(function (p) { if ((p.form || 0) < 0 && Math.random() < 0.65) { p.form++; upN++; } });
      if (upN) b.log.push('💊 ケアが効いて ' + upN + ' 名の調子が上向いた');
      var inj = G.players.filter(function (p) { return p.injured > 0; }).sort(function (a, c) { return c.injured - a.injured; })[0];
      if (inj) {
        inj.injured--;
        if (inj.injured === 0) { if (inj.injPart !== '体調不良') inj.backMark = true; inj.justBack = true; inj.injSev = null; inj.injPart = null; b.log.push('💊 ケアの日。疲労が抜け、' + inj.name + ' が復帰した'); }
        else b.log.push('💊 ケアの日。疲労が抜け、' + inj.name + ' の回復が進んだ（復帰まであと' + inj.injured + 'か月）');
      }
      else b.log.push('💊 ケアの日。全員の疲労が回復した');
      return;
    }
    if (t === 'free') {
      G.players.forEach(function (p) { p.fatigue = Math.max(0, p.fatigue - Math.round((hasFacility('dorm') ? 16 : 12) * ethosOf().r)); });
      G.players.forEach(function (p) { if ((p.form || 0) < 0 && Math.random() < 0.45) p.form++; });
      b.log.push('😴 完全休養。リフレッシュした'); return;
    }
    if (t === 'meet') { G.nextBonus = Math.min(bonusCap(), G.nextBonus + (hasFacility('video') ? 4 : 3)); G.players.forEach(function (p) { p.fatigue = Math.max(0, p.fatigue - 4); }); b.log.push('📋 作戦会議。次の試合の準備が整った（次の試合 +' + G.nextBonus + '）'); return; }
    if (t === 'end') return monthEnd();
  }
  /* v0.7: 成長のソフトキャップ。85から逓減し、99に近いほど小さくなるが完全には止まらない。
   * 減衰で失われた「余剰」の一部は信頼度に変換され、無駄にならない */
  function softDecay(cur) {
    if (cur < 85) return 1;
    return Math.max(0.1, 1 - (cur - 85) / 14 * 0.9);
  }
  /* v0.13: 月次成長レポート用の記録（表示専用。成長計算そのものには一切関与しない）。
   * 盤面の練習マスで実際に伸びた分（99で頭打ちした分は実際に増えた分だけ）を当月分として貯め、
   * 月末に snapshotGrowth で確定させ、次の月頭指示画面にカードで出す。誰も伸びなかった月はレポートなし */
  function growAcc() {
    if (!G.growAcc || G.growAcc.y !== G.year || G.growAcc.m !== G.monthIdx) {
      G.growAcc = { y: G.year, m: G.monthIdx, by: {} };
    }
    return G.growAcc;
  }
  function accGrowEntry(p) {
    var a = growAcc(), e = a.by[p.id];
    if (!e) e = a.by[p.id] = { name: p.name, stats: {}, trust: 0, focus: false };
    if (p.id === G.inst.focus) e.focus = true;
    return e;
  }
  function accGrow(p, stat, delta) { if (delta > 0) { var e = accGrowEntry(p); e.stats[stat] = (e.stats[stat] || 0) + delta; } }
  function accTrust(p, amt) { if (amt > 0) accGrowEntry(p).trust += amt; }
  function snapshotGrowth() {
    G.growReport = null;
    var a = G.growAcc;
    if (a && a.y === G.year && a.m === G.monthIdx) {
      var rows = Object.keys(a.by).map(function (id) {
        var e = a.by[id], tot = 0;
        STATS.forEach(function (s) { tot += e.stats[s.k] || 0; });
        return { name: e.name, stats: e.stats, trust: e.trust, total: tot, focus: !!e.focus };
      }).filter(function (r) { return r.total > 0 || r.trust > 0; })
        .sort(function (x, y) { return (y.total - x.total) || (y.trust - x.trust); });
      if (rows.length) G.growReport = { label: MONTHS[G.monthIdx].m, rows: rows };
    }
    G.growAcc = null;
  }
  function applyPractice(big) {
    var inst = G.inst, lvl = LEVELS[inst.level];
    var campMul = MONTHS[G.monthIdx].camp ? 1.5 : 1;
    var eth = ethosOf();
    var gains = [];
    var surplusNotes = [];
    G.players.forEach(function (p) {
      var eff = effOf(p);
      var per = personOf(p);
      var surplus = 0;
      function gain(stat, base) {
        var cur = p.stats[stat];
        /* バランス調整(v0.7): 練習の伸びは ×0.8 に抑え、相手の梯子を引き上げた */
        var raw = base * 0.8 * lvl.mul * p.trait.growth * per.growth * campMul * eff * eth.g * rnd(0.7, 1.3);
        if (p.id === G.captainId) raw *= 1.1;
        /* v0.8: 調子が良い選手は練習の実りも良い */
        raw *= 1 + (p.form || 0) * 0.05;
        /* v0.9: ウェイト場があればパワー練習の伸びが上がる */
        if (stat === 'pow' && hasFacility('weights')) raw *= 1.15;
        var decay = softDecay(cur);
        var effGain = cur >= 99 ? 0 : raw * decay;
        surplus += raw - effGain;
        var g = Math.floor(effGain);
        if (Math.random() < effGain - g) g++;
        if (g > 0 && cur < 99) {
          p.stats[stat] = Math.min(99, cur + g);
          gains.push({ name: p.name, stat: stat, g: g, focus: p.id === inst.focus });
          accGrow(p, stat, p.stats[stat] - cur); /* v0.13: レポート用に実際に増えた分を記録 */
        }
      }
      gain(inst.team, big ? ri(1, 3) : ri(0, 2));
      if (unitOf(p) === inst.unit) gain(UNIT_STAT[inst.unit], big ? ri(1, 2) : ri(0, 1));
      if (p.id === inst.focus) gain(inst.team, ri(2, 4));
      if (surplus >= 1.5) {
        var tg = Math.max(1, Math.round(surplus * 0.8));
        var trustBefore = p.trust || 50;
        gainTrust(p, tg);
        accTrust(p, (p.trust || 50) - trustBefore); /* v0.13: レポート用に実際に増えた信頼度を記録 */
        surplusNotes.push(p.name + ' 信頼+' + tg);
      }
      p.fatigue = Math.min(100, p.fatigue + Math.round(lvl.fat * (big ? 1.3 : 1) * per.fat * eth.f));
      var injMul = hasSkill(p, 'tough') ? 0.35 : 1;
      if (!p.injured && Math.random() < 0.010 * lvl.inj * p.trait.inj * injMul * (p.fatigue >= 70 ? 2 : 1)) {
        var heavy = Math.random() < (p.trait.n === '怪我がち' ? 0.35 : 0.22);
        var months = hurtPlayer(p, heavy);
        G.board.log.push('🚑 ' + p.name + ' が練習で負傷（' + (heavy ? '重症' : '軽症') + '・' + p.injPart + '）。復帰まであと' + months + 'か月。' +
          (p.fatigue >= 70 ? '疲労が溜まった状態で負荷の高い練習を続けたのが響いた。休養とのバランスを見直したい' : '接触プレーでのアクシデントだった'));
      }
    });
    gains.sort(function (a, b) { return b.g - a.g; });
    var top = gains.slice(0, 3).map(function (g) {
      return (g.focus ? '⭐' : '') + g.name + '（' + STATS.filter(function (s) { return s.k === g.stat; })[0].n + '+' + g.g + '）';
    });
    G.board.log.push((big ? '🔥 特訓！ ' : '💪 練習。') + (top.length ? top.join('、') : '大きな伸びはなし') +
      (surplusNotes.length ? '（限界に近い能力の余剰が信頼に変わった：' + surplusNotes.slice(0, 2).join('、') + '）' : ''));
  }
  /* v0.14: 進路の選択肢。進路イベントの文面（text）と OB 名鑑の進路ラベル（label）は同じ組を使い、表現を矛盾させない */
  var OB_PATHS = [
    { label: '大学でラグビー継続', text: '卒業後は大学でもラグビーを続ける決意を固めた' },
    { label: '実業団へ就職', text: '実業団への就職が内定。それでも最後の花園に全てを懸けている' },
    { label: '大学進学（受験）', text: '受験勉強と両立しながら、後輩の面倒も見ている' }
  ];
  /* 卒業時の進路：進路イベントで決まっていればそれを、なければ卒業時に1つ確定させる */
  function obPathOf(p) { return p.futurePath ? p.futurePath : pick(OB_PATHS).label; }
  /* v0.7: 性格×信頼度で分岐する選手ドラマ（面談・後輩指導・3年生の進路） */
  function playerDrama() {
    var seniors = G.players.filter(function (p) { return p.year === 3; });
    var lowTrust = G.players.filter(function (p) { return (p.trust || 50) < 35; });
    var highTrust = G.players.filter(function (p) { return (p.trust || 50) >= 70; });
    /* v0.13: ケガから復帰した選手の一言。復帰フラグ（backMark）が立っている間は最優先で拾い、拾ったら下げる */
    var backs = G.players.filter(function (p) { return p.backMark; });
    if (backs.length) {
      var bp = backs[0];
      bp.backMark = false;
      gainTrust(bp, 5);
      bp.form = clamp((bp.form || 0) + 1, -2, 2);
      return { t: 'ケガから復帰した ' + bp.name + ' が全体練習に合流。「もう大丈夫です」と笑顔を見せた。本人の信頼と調子が上向いた', dlg: { pid: bp.id, text: dlgLine(bp, 'comeback') } };
    }
    var r = Math.random();
    if (seniors.length && r < 0.35) {
      var s = pick(seniors);
      gainTrust(s, 5);
      /* v0.13: 進路イベントを経験した3年生には「その後」の続きが出る（信頼+2・次の試合+1の控えめな効果） */
      if (s.futureSeen) {
        gainTrust(s, 2);
        G.nextBonus = Math.min(bonusCap(), G.nextBonus + 1);
        return { t: '進路のその後。3年 ' + s.name + '（' + s.person + '）が「進路のことは決めました。あとは花園だけです」と言い切った。チームが引き締まった（次の試合 +1）', dlg: { pid: s.id, text: dlgLine(s, 'future2') } };
      }
      s.futureSeen = true;
      G.nextBonus = Math.min(bonusCap(), G.nextBonus + 2);
      var path = pick(OB_PATHS);
      s.futurePath = path.label; /* v0.14: 決まった進路を本人に記録し、卒業時に OB 名鑑へそのまま引き継ぐ */
      return { t: '進路の季節。3年 ' + s.name + '（' + s.person + '）は' + path.text + '。チームの士気が上がった（次の試合 +2）', dlg: { pid: s.id, text: dlgLine(s, 'future') } };
    }
    if (lowTrust.length && r < 0.68) {
      var v = pick(lowTrust);
      gainTrust(v, 10);
      v.form = clamp((v.form || 0) + 1, -2, 2);
      return { t: '面談：' + v.name + '（' + v.person + '・信頼度が低め）の本音を聞けた。監督への信頼が深まり、調子も上向いた', dlg: { pid: v.id, text: dlgLine(v, 'honest') } };
    }
    /* v0.13: キャプテンの声かけ（信頼の厚いキャプテンがいる時だけ。効果は既存イベントの範囲内） */
    var cap = captainOf();
    if (cap && (cap.trust || 50) >= 60 && Math.random() < 0.5) {
      gainTrust(cap, 3);
      G.nextBonus = Math.min(bonusCap(), G.nextBonus + 2);
      return { t: 'キャプテン ' + cap.name + ' が練習前に全員を集めて声をかけた。チームの空気が引き締まった（次の試合 +2）', dlg: { pid: cap.id, text: dlgLine(cap, 'captain') } };
    }
    /* v0.13: 上級生が下級生を指導（信頼の厚い上級生と1年生がいる時だけ） */
    var seniorMentors = G.players.filter(function (p) { return p.year >= 2 && (p.trust || 50) >= 60; });
    var juniors = G.players.filter(function (p) { return p.year === 1; });
    if (seniorMentors.length && juniors.length && Math.random() < 0.5) {
      var sm = pick(seniorMentors);
      gainTrust(sm, 2);
      juniors.forEach(function (p) { gainTrust(p, 3); });
      return { t: '上級生の ' + sm.name + '（' + sm.person + '）が練習後に1年生を残して基礎を指導。後輩たちの信頼が育った', dlg: { pid: sm.id, text: dlgLine(sm, 'senior') } };
    }
    if (highTrust.length) {
      var m = pick(highTrust);
      G.players.filter(function (p) { return p.year === 1; }).forEach(function (p) { gainTrust(p, 3); });
      return { t: m.name + '（信頼厚い' + m.person + '）が後輩の指導役に。1年生の信頼が育った', dlg: { pid: m.id, text: dlgLine(m, 'mentor') } };
    }
    var q = pick(G.players);
    gainTrust(q, 6);
    q.form = clamp((q.form || 0) + 1, -2, 2);
    return { t: q.name + ' と面談。今のチームへの思いを語ってくれた', dlg: { pid: q.id, text: dlgLine(q, 'talk') } };
  }
  /* v0.18: ライバル専用イベント。因縁が育っている相手（連勝・連敗が続いている学校）か、
   * 今年エースが代替わりした学校がある時だけ、約1割で排他的に割り込む（既存イベントとは競合しない）。
   * 材料が無ければ null を返し、通常のイベント抽選に落ちる。効果は既存イベントの範囲内の小さなものだけ。
   * 材料の判定は決定的（乱数を消費しない）で、抽選の乱数は材料がある時だけ引く
   * （因縁が無い時期の盤面イベントの乱数列を v0.17 までと変えないため） */
  function rivalEvent() {
    var cands = [];
    OPPONENTS.forEach(function (op, idx) {
      var st = streakOf(op.name);
      if (Math.abs(st) >= 2) cands.push({ kind: 'streak', idx: idx, st: st });
    });
    if (G.year > 1) {
      OPPONENTS.forEach(function (op, idx) {
        if (idx === 3) return; /* 帝都の代替わりは G.rivalNews で別途報じられる */
        if (oppAceAt(idx, G.year).name !== oppAceAt(idx, G.year - 1).name) cands.push({ kind: 'ace', idx: idx });
      });
    }
    if (!cands.length) return null;
    if (Math.random() >= 0.10) return null;
    var c = pick(cands);
    var op = OPPONENTS[c.idx];
    if (c.kind === 'ace') {
      var a = oppAceAt(c.idx, G.year);
      return { t: '📰 ライバル校の話題。' + op.name + ' のエースが代替わりし、新エースは ' + a.grade + '年の ' + a.name + '（' + a.pos + '・' + skillNameByKey(a.skill) + '）だという。次の対戦では要注意だ' };
    }
    var cap = G.players.filter(function (p) { return p.id === G.captainId; })[0] || (G.players.length ? pick(G.players) : null);
    var dlg = cap ? { pid: cap.id, text: dlgLine(cap, 'rival') } : null;
    if (c.st <= -2) {
      G.nextBonus = Math.min(bonusCap(), G.nextBonus + 2);
      return { t: '🔥 地元紙が「' + op.name + ' への ' + (-c.st) + '連敗」を特集。選手たちは雪辱に燃えている（次の試合 +2）', dlg: dlg };
    }
    G.rep += repGain(3);
    return { t: '📰 スポーツ紙が「桜丘の ' + op.name + ' への ' + c.st + '連勝」を取り上げた。注目度が上がった（評判 +' + repGain(3) + '）', dlg: dlg };
  }
  function rollEvent() {
    var re = rivalEvent(); if (re) return re;
    var r = Math.random();
    if (r < 0.24) return null;
    var healthy = G.players.filter(function (p) { return !p.injured; });
    if (r < 0.34) {
      G.nextBonus = Math.min(bonusCap(), G.nextBonus + 3);
      var seniors = G.players.filter(function (p) { return p.year === 3; });
      var spk = seniors.length ? pick(seniors) : pick(G.players);
      return { t: 'OBの先輩が練習に顔を出し、差し入れと熱いアドバイス。士気が上がった（次の試合 +3）', dlg: spk ? { pid: spk.id, text: dlgLine(spk, 'ob') } : null };
    }
    if (r < 0.46) return playerDrama();
    if (r < 0.54) { G.rep += repGain(5); return { t: '地域の小学生向けラグビー体験会を開催。部の評判が上がった（評判 +' + repGain(5) + '）' }; }
    if (r < 0.64) {
      var anyInj = G.players.some(function (p) { return p.injured > 0; });
      G.players.forEach(function (p) { if (p.injured > 0) { p.injured--; if (!p.injured) { if (p.injPart !== '体調不良') p.backMark = true; p.justBack = true; p.injSev = null; p.injPart = null; } } });
      return { t: anyInj ? 'マネージャーが入部！ ケアが行き届き、負傷者の回復が早まった（離脱期間が1か月短くなった）' : 'マネージャーが入部！ ケア体制が整い、選手のコンディションが安定した' };
    }
    if (r < 0.74) { G.nextBonus = Math.min(bonusCap(), G.nextBonus + 4); return { t: 'ライバル校の試合映像を入手。弱点が見えた（次の試合 +4）' }; }
    if (r < 0.84 && healthy.length) { var v = pick(healthy); v.injured = 1; v.injSev = 'light'; v.injPart = '体調不良'; if (G.season) G.season.injuries = (G.season.injuries || 0) + 1; return { t: v.name + ' が体調を崩した。1か月ほど休養し、次の試合は欠場する', bad: true, dlg: { pid: v.id, text: dlgLine(v, 'sick') } }; }
    if (r < 0.92 && G.players.length) {
      var q = pick(G.players);
      if (q.person === '自由人' || q.person === 'マイペース') { q.fatigue = Math.max(0, q.fatigue - 18); return { t: q.name + '（' + q.person + '）は休日にしっかり気分転換。本人の疲労が抜けた', dlg: { pid: q.id, text: dlgLine(q, 'rest') } }; }
      if (q.person === 'リーダー気質' || q.person === '熱血') { G.nextBonus = Math.min(bonusCap(), G.nextBonus + 3); return { t: q.name + '（' + q.person + '）が自主練に皆を誘い、チームの士気が上がった（次の試合 +3）', dlg: { pid: q.id, text: dlgLine(q, 'cheer') } }; }
      q.trust = clamp((q.trust || 50) + 4, 0, 99); return { t: q.name + '（' + q.person + '）とじっくり面談。監督への信頼が深まった', dlg: { pid: q.id, text: dlgLine(q, 'talk') } };
    }
    var s = pick(G.players);
    s.stats.sta = Math.max(20, s.stats.sta - 2);
    return { t: 'テスト期間。' + s.name + ' は勉強との両立に苦戦（スタミナ -2）', bad: true };
  }
  function monthEnd() {
    var mo = MONTHS[G.monthIdx];
    G.monthLog = G.board ? G.board.log.slice(-6) : [];
    G.board = null;
    snapshotGrowth(); /* v0.13: この月の成長内訳をレポートとして確定（次の月頭指示画面で表示） */
    if (mo.match != null) {
      if (mo.needWin && !G.qualified) { seasonEnd(); return; }
      screen = 'preMatch'; save(); render(); return;
    }
    /* 試合のない月は月末にケガの離脱期間が進む（試合月は finishMatch 側で進める） */
    tickInjuries().forEach(function (n) { G.monthLog.push('🏥 ' + n + ' がケガから復帰した'); });
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
/* v0.16: 後半の戦術変更。ハーフタイム（無い試合は後半最初の停止点）で1回だけ提示され、
 * 選んだ攻め方は M.htPlan に入り、後半の場面判定（sceneProb）で対応する勝負どころに +0.04 の小幅補正が付く。
 * キッカー指名・マーク指名・戦術変更はすべて試合内の一時データ（M／モジュール変数）で、セーブ形式には入れない */
var HT_PLANS = {
  fw: { n: 'FWで押し込む', key: 'maul', comm: '後半、桜丘はFWで押し込む形に切り替えた！ スクラムとモールで圧力をかけていく' },
  bk: { n: 'BKで展開する', key: 'wide', comm: '後半、桜丘はBKで大きく展開する形に切り替えた！ ボールが大きく横に動き始める' },
  kick: { n: 'キックで陣地を取る', key: 'kick', comm: '後半、桜丘はキックで陣地を取る形に切り替えた！ 相手陣で試合を進める' }
};
function htPlanScene() {
  function PC(plan, n, d) {
    return { n: n, d: d, p: 1, plan: plan, winTxt: '', loseTxt: '', winFx: 'none', loseFx: 'none' };
  }
  return {
    kind: 'httac', key: null, title: '後半の戦術変更：残りの攻め方を選ぶ',
    choices: [PC('fw', HT_PLANS.fw.n, 'モール主体の攻めが、この後の勝負どころで効きやすくなる'),
      PC('bk', HT_PLANS.bk.n, 'バックス展開の攻めが、この後の勝負どころで効きやすくなる'),
      PC('kick', HT_PLANS.kick.n, 'キックを使う場面が、この後効きやすくなる'),
      PC(null, '変更しない', '前半の形のまま戦う')]
  };
}
/* v0.16: エースのマークが生きているか（マークマンが出場中で倒れておらず、相手にエースがいる） */
function markActive() {
  return !!(M && M.markId && M.opp && M.opp.ace
    && fieldPlayers().some(function (p) { return p.id === M.markId; })
    && M.knock.indexOf(M.markId) < 0);
}
/* v0.16: PGを蹴る選手。指名があればその選手（出場中で倒れていない場合）、なければ従来どおり最適キーマン */
function kickerOf() {
  if (M && M.kickerId) {
    var d = fieldPlayers().filter(function (p) { return p.id === M.kickerId && M.knock.indexOf(p.id) < 0; })[0];
    if (d) return d;
  }
  return keyPlayer(['SO', 'FB'], 'kik', 'kick');
}
/* v0.16: 指名キッカーのオープンPG成功率。本人のキック値・「ロングキッカー」・調子から決まる（おまかせ時は使わない）。
 * 基準 0.78 に 能力 ±0.007/点・調子 ±0.015/段・特能 +0.05 を重ね、0.50〜0.97 に収める */
function pgChance(p) {
  return clamp(0.78 + (p.stats.kik - 55) * 0.007 + (p.form || 0) * 0.015 + (hasSkill(p, 'kick') ? 0.05 : 0), 0.5, 0.97);
}
/* v0.16: キッカー指名UIの目安（段階表示のみ。成功率は数値で見せない） */
function kickMark(p) {
  var v = p.stats.kik + (hasSkill(p, 'kick') ? 8 : 0) + (p.form || 0) * 2;
  return v >= 70 ? '◎' : (v >= 55 ? '○' : '△');
}
/* バランス調整(v0.7): 年次ドリフトは県予選（idx1〜3）にだけ小さく掛け、花園の2校は「固定の全国の壁」にする
 * v0.9: 帝都はエースの学年でも強くなる。難易度チャレンジは全校 +3 */
function oppPower(idx) {
  var p = OPPONENTS[idx].power + (idx >= 1 && idx <= 3 ? Math.min(6, G.year - 1) : 0);
  if (idx === 3 && G.rival) p += (G.rival.grade - 1) * 2;
  if (G.difficulty === 'challenge') p += 3;
  return p;
}
function stopBlocks(n) {
  var out = [];
  for (var i = 1; i <= n; i++) {
    var b = Math.round(i * 10 / (n + 1));
    if (b >= 1 && b <= 9 && out.indexOf(b) < 0) out.push(b);
  }
  return out;
}
function startMatch(oppIdx) {
  var opp = effOpp(oppIdx);
  var plan = (STOP_PLANS[oppIdx] || STOP_PLANS[0]).slice();
  var st = starters();
  subOutId = null;
  M = {
    opp: opp, oppIdx: oppIdx, power: oppPower(oppIdx), block: 0, my: 0, op: 0,
    log: [], phase: 'play', pending: null, done: false, result: null,
    bonus: G.nextBonus + clutchBonus(),
    plan: plan, stopAt: stopBlocks(plan.length), goalFlip: Math.random() < 0.5,
    scenes: { att: 0, ok: 0 }, factors: null, gallant: false,
    /* v0.12: 試合内だけの一時データ（セーブには入らない）。usedComm=実況の重複回避、hist=得点イベント、htShown/htLines=ハーフタイム形勢サマリー */
    usedComm: {}, hist: [], htShown: false, htLines: null,
    tp0: teamPower(),
    fat0: st.length ? Math.round(st.reduce(function (a, p) { return a + p.fatigue; }, 0) / st.length) : 0,
    inj0: st.filter(function (p) { return p.injured; }).length,
    /* v0.8: 交代管理（現在の顔ぶれ・交代回数・負傷で動けない選手）と調子の初期値 */
    fieldIds: st.map(function (p) { return p.id; }),
    subs: 0, subsMax: 5, knock: [],
    form0: st.length ? Math.round(st.reduce(function (a, p) { return a + (p.form || 0); }, 0) / st.length * 10) / 10 : 0,
    /* v0.16: 采配の一時データ（セーブには入らない）。kickerId=PGキッカー指名、markId=エースのマークマン、
     * htPlan=後半の戦術変更、htOffered=戦術変更を提示済みか、htDeferred=戦術変更の後に回す勝負どころ */
    kickerId: null, markId: null, htPlan: null, htOffered: false, htDeferred: null
  };
  G.nextBonus = 0;
  /* v0.16: 対戦確認での指名をこの試合に持ち込む（出場メンバーにいる場合だけ有効。指名はこの試合限りで消費される） */
  if (selKickerId != null && M.fieldIds.indexOf(selKickerId) >= 0) M.kickerId = selKickerId;
  if (selMarkId != null && M.fieldIds.indexOf(selMarkId) >= 0 && opp.ace) M.markId = selMarkId;
  selKickerId = null; selMarkId = null;
  M.log.push('キックオフ（' + MONTHS[G.monthIdx].m + '・' + seasonPhrase() + '）。相手は ' + opp.name + '（総合力 ' + M.power + '）。' + opp.note);
  if (opp.skill) M.log.push('相手の特能：' + opp.skill.n);
  if (opp.style && OPP_STYLES[opp.style]) M.log.push('相手の戦術傾向：' + OPP_STYLES[opp.style].n + ' ― ' + OPP_STYLES[opp.style].d);
  if (opp.ace) M.log.push('相手のエース：' + opp.ace.name + '（' + opp.ace.pos + '・' + skillNameByKey(opp.ace.skill) + '・' + opp.ace.grade + '年）。要注意だ');
  if (M.kickerId) { var kp0 = st.filter(function (p) { return p.id === M.kickerId; })[0]; if (kp0) M.log.push('🦵 今日のPGキッカーは ' + kp0.name + ' が務める'); }
  if (M.markId) { var mp0 = st.filter(function (p) { return p.id === M.markId; })[0]; if (mp0) M.log.push('🎯 マーク指示：' + mp0.name + ' が相手エース ' + opp.ace.name + ' を重点マークする（その分、他の選手への対応は薄くなる）'); }
  /* v0.18: 他校エースの代替わりと、対戦校との現在の連勝・連敗をキックオフ実況に出す（帝都は下の v0.9 専用実況がある） */
  if (oppIdx !== 3 && opp.ace) {
    if (G.year > 1) {
      var prevAce = oppAceAt(oppIdx, G.year - 1);
      if (prevAce && prevAce.name !== opp.ace.name) M.log.push('📰 ' + opp.name + ' は今年からエースが代替わり。新エースは ' + opp.ace.grade + '年の ' + opp.ace.name + ' だ');
    }
    var stK = streakOf(opp.name);
    if (stK >= 3) M.log.push('この相手には目下 ' + stK + '連勝中。桜丘の選手たちに気負いはない');
    else if (stK === 2) M.log.push('この相手には2連勝中。相性の良さを今日も示したい');
    else if (stK <= -3) M.log.push('この相手には ' + (-stK) + '連敗中。因縁の壁を、今日こそ破りたい');
    else if (stK === -2) M.log.push('この相手には2連敗中。雪辱への思いは強い');
  }
  /* v0.9: 帝都との因縁を実況にも出す */
  if (oppIdx === 3 && G.rival) {
    M.log.push('因縁の相手、帝都学園。エースは ' + G.rival.grade + '年の ' + G.rival.name + '。' +
      (G.rival.grade >= 3 ? '高校最後の冬に懸ける思いは強い' : '昨年より一段と力をつけている'));
    if (G.rivalLast === 'lose') M.log.push('昨年はこの相手に敗れた。雪辱の舞台が整った');
    else if (G.rivalLast === 'win') M.log.push('昨年はこの相手を破っている。帝都イレブンは雪辱に燃えているはずだ');
  }
  sfx('whistle');
  screen = 'match'; render();
}
function convProb() { return clamp(0.45 + (statAvg(starters(), 'kik') - 50) * 0.008, 0.2, 0.9); }
function tryScore(mine) {
  sfx(mine ? 'try' : 'concede');
  var pts = 5, txt = 'トライ！';
  if (Math.random() < convProb()) { pts += 2; txt += ' コンバージョンも成功（+7点）'; }
  else txt += ' コンバージョンは外れた（+5点）';
  if (mine) M.my += pts; else M.op += pts;
  if (M && M.hist) M.hist.push({ b: M.block, mine: mine, pts: pts, k: 'try' });
  return txt;
}
function pgScore(mine) { sfx('kick'); if (mine) M.my += 3; else M.op += 3; if (M && M.hist) M.hist.push({ b: M.block, mine: mine, pts: 3, k: 'pg' }); return 'ペナルティゴール成功（+3点）'; }
function scoreRoll(diff) { return Math.random() < clamp(0.32 + diff * 0.012, 0.05, 0.75); }
/* ===== v0.12: 実況バリエーション =====
 * 場面カテゴリごとに複数パターンを持ち、commPick が「同じ試合で直近に使った文」を避けて選ぶ。
 * 使用履歴は M.usedComm（試合内のみの一時データ。セーブ形式は変えない）。
 * 季節（月）の言及・キーマン以外の選手名・帝都との因縁専用の文も文脈に沿って混ぜる */
/* COMM-BEGIN */
var COMM = {
  myTry: [
    function (c) { return '桜丘、攻め込む。' + c.scorer + ' が駆け抜けた！'; },
    function (c) { return c.assist + ' のパスが通った！ ' + c.scorer + ' が走り切る！'; },
    function (c) { return '連続攻撃で相手を崩した。最後は ' + c.scorer + ' がねじ込んだ！'; },
    function (c) { return c.scorer + ' がステップで一人かわし、そのまま一直線！'; },
    function (c) { return 'FWが土台を作り、BKが仕留める。締めは ' + c.scorer + '！'; },
    function (c) { return c.season + '、' + c.scorer + ' の快走がスタンドを沸かせた！'; }
  ],
  oppTry: [
    function (c) { return '相手の攻撃を止めきれない。持っていかれた'; },
    function (c) { return '相手BKの展開に振り切られた'; },
    function (c) { return 'ゴール前の粘りが届かない。押し込まれた'; }
  ],
  oppAce: [
    function (c) { return '相手のエース ' + c.ace + ' が突破。止めきれなかった'; },
    function (c) { return 'ここでエース ' + c.ace + ' に仕事をされた'; },
    function (c) { return c.ace + ' の個人技が光る。桜丘、対応が一歩遅れた'; }
  ],
  myPg: [
    function (c) { return '桜丘のPG。' + c.kicker + ' が狙う'; },
    function (c) { return '反則を誘った！ PGのチャンスは ' + c.kicker + ' に託される'; },
    function (c) { return 'ここは確実に3点を取りにいく。キッカーは ' + c.kicker; },
    function (c) { return c.kicker + ' の右足にチームの思いが乗る'; }
  ],
  oppPg: [
    function (c) { return '相手のPG。確実に決められた'; },
    function (c) { return '反則が響いた。相手PGで3点を失う'; },
    function (c) { return '相手はPGで手堅く加点してきた'; }
  ],
  noScore: [
    function (c) { return '中盤での攻防。スコアは動かない'; },
    function (c) { return '両チーム譲らない。泥臭い攻防が続く'; },
    function (c) { return '桜丘の好守！ 相手の波状攻撃をしのいだ'; },
    function (c) { return '相手の好守に阻まれる。あと一歩が遠い'; },
    function (c) { return 'キックの蹴り合い。陣地は五分五分'; },
    function (c) { return '一進一退。' + c.season + '、両ベンチの声が飛ぶ'; },
    function (c) { return 'スクラムで互角の押し合い。観客のどよめきが起こる'; },
    function (c) { return 'タックルが冴える時間帯。互いに決定機を作れない'; }
  ],
  lateDry: [
    function (c) { return '残り時間はわずか。スコアは動かないが、緊張感が高まる'; },
    function (c) { return 'ロスタイムの空気。ベンチ全員が立ち上がって見守る'; },
    function (c) { return '時計が進む。ワンプレーの重みが増していく'; }
  ],
  endWin: [
    function (c) { return 'ノーサイド！ 桜丘高校の勝利！'; },
    function (c) { return c.margin >= 15 ? 'ノーサイド！ 桜丘高校、圧勝だ！' : 'ノーサイド！ 接戦を制した桜丘高校の勝利！'; },
    function (c) { return '試合終了の笛！ 桜丘ベンチが沸き立つ。桜丘高校の勝利！'; }
  ],
  endLose: [
    function (c) { return 'ノーサイド。桜丘高校、敗れる…'; },
    function (c) { return c.margin <= 7 ? 'ノーサイド。あと一歩が届かなかった。桜丘高校、敗れる…' : 'ノーサイド。力の差を見せつけられた。桜丘高校、敗れる…'; },
    function (c) { return '試合終了。うなだれる選手たち。桜丘高校、敗れる…'; }
  ]
};
var RIVAL_COMM = {
  myTry: [
    function (c) { return '因縁の相手に食らいつく！ ' + c.scorer + ' が決めた！'; },
    function (c) { return '雪辱への一歩。' + c.scorer + ' が帝都の壁をこじ開けた！'; }
  ],
  oppTry: [
    function (c) { return 'また帝都にやられた。この壁の高さを思い知らされる'; },
    function (c) { return '因縁の相手の意地を見た。桜丘、押し返された'; }
  ],
  noScore: [
    function (c) { return '因縁対決らしい重い空気。互いに一歩も引かない'; },
    function (c) { return '県の頂点を懸けた意地のぶつかり合い。スコアは動かない'; }
  ]
};
/* COMM-END */
/* v0.18: ストリークが懸かった試合の決着実況（帝都以外。因縁が育った相手との試合でだけ、
 * 通常プールに混ざる）。判定には「この試合の前」時点のストリークを使う
 * （finishMatch は決着実況の後にストリークを更新する） */
var STREAK_COMM = {
  endWin: [
    function (c) { return '長く続いた ' + c.school + ' への連敗を、ついに止めた！'; },
    function (c) { return '雪辱成就。この日のために積んできた練習が実った'; },
    function (c) { return c.school + ' の壁を越えた。この一勝は、来年への財産になる'; }
  ],
  endLose: [
    function (c) { return '相性の良さもここまでか。' + c.school + ' の意地に押し返された'; },
    function (c) { return '連勝は止まった。相手もまた、力をつけてきている'; },
    function (c) { return c.school + ' に土をつけられた。因縁はまだ続いていく'; }
  ]
};
/* 月（季節）の言及。試合があるのは 6月・10月・11月・12月・1月 */
function seasonPhrase() {
  var m = MONTHS[G.monthIdx].m;
  if (m === '6月') return '梅雨空の下';
  if (m === '10月') return '秋晴れの空の下';
  if (m === '11月') return '冷たい風の中';
  if (m === '12月') return '年の瀬の寒空の下';
  if (m.indexOf('1月') === 0) return '花園の冬空の下';
  return 'グラウンドに声が響く中';
}
/* カテゴリのパターンから1つ選ぶ。同じ試合で使ったパターンは、プールが一周するまで再使用しない */
function commPick(cat, ctx) {
  var pool = (COMM[cat] || []).slice();
  if (M && M.oppIdx === 3 && RIVAL_COMM[cat]) pool = pool.concat(RIVAL_COMM[cat]);
  /* v0.18: 帝都以外でも、連勝・連敗が懸かった試合ではストリーク専用の決着文が混ざる */
  if (M && M.oppIdx !== 3 && STREAK_COMM[cat]) {
    var stk = streakOf(M.opp.name);
    if ((cat === 'endWin' && stk <= -2) || (cat === 'endLose' && stk >= 2)) pool = pool.concat(STREAK_COMM[cat]);
  }
  if (!pool.length) return '';
  var c2 = ctx || {};
  if (M && !c2.school) c2.school = M.opp.name;
  if (!M) return pool[0](c2);
  M.usedComm = M.usedComm || {};
  var used = M.usedComm[cat] || (M.usedComm[cat] = []);
  var avail = [];
  pool.forEach(function (_, i) { if (used.indexOf(i) < 0) avail.push(i); });
  if (!avail.length) { used.length = 0; avail = pool.map(function (_, i) { return i; }); }
  var idx = pick(avail);
  used.push(idx);
  if (used.length > Math.max(1, pool.length - 1)) used.shift();
  return pool[idx](c2);
}
function playBlock() {
  var diff = fieldPower() - M.power + M.bonus;
  if (scoreRoll(diff)) {
    var able = fieldPlayers().filter(function (p) { return M.knock.indexOf(p.id) < 0; });
    var scorer = pick(able.length ? able : fieldPlayers());
    var mates = (able.length ? able : fieldPlayers()).filter(function (p) { return p !== scorer; });
    var assist = mates.length ? pick(mates) : scorer;
    if (scorer) addStat(scorer, 'tries');
    M.log.push(commPick('myTry', { scorer: scorer ? scorer.name : '桜丘の選手', assist: assist ? assist.name : '仲間', season: seasonPhrase() }) + ' ' + tryScore(true));
  }
  else {
    /* v0.16: マーク指示がある間は、相手エースの得点は抑えられるが他の選手の得点はわずかに増える（トレードオフ）。
     * エースが絡むかどうかは相手の得点ロールより前に決める（補正をロールへ反映するため）。
     * 補正はエース絡み -2／それ以外 +1.5（得点ロールの既存レンジ内に収まる小幅なもの） */
    var acePlay = !!(M.opp.ace && Math.random() < (markActive() ? 0.28 : 0.45));
    var oAdj = markActive() ? (acePlay ? -2 : 1.5) : 0;
    if (scoreRoll(-diff + 6 + oAdj)) {
      M.log.push(commPick(acePlay ? 'oppAce' : 'oppTry', { ace: M.opp.ace ? M.opp.ace.name + '（' + M.opp.ace.pos + '）' : '相手のエース', season: seasonPhrase() }) + ' ' + tryScore(false));
    }
    else if (Math.random() < 0.3) {
      /* v0.16: PGキッカーの指名があればその選手が蹴る（おまかせ時は従来どおりキーマン選出で確実に決まる）。
       * 指名時のみ、本人の能力・特能・調子で決まる pgChance で外れることがある（決めた時だけ plays に記録） */
      var kicker = kickerOf();
      var designated = !!(M.kickerId && kicker && kicker.id === M.kickerId);
      if (designated && Math.random() >= pgChance(kicker)) {
        M.log.push(commPick('myPg', { kicker: kicker.name }) + ' しかし、キックはわずかに外れた…');
      } else {
        if (kicker) addStat(kicker, 'plays');
        M.log.push(commPick('myPg', { kicker: kicker ? kicker.name : 'キッカー' }) + ' ' + pgScore(true));
      }
    }
    else if (Math.random() < 0.22) M.log.push(commPick('oppPg', {}) + ' ' + pgScore(false));
    else M.log.push(commPick(M.block >= 8 ? 'lateDry' : 'noScore', { season: seasonPhrase() }));
  }
  /* v0.8: 試合中の負傷。負傷した選手はキーマン・得点役から外れ、次の停止点で交代できる（交代しないと試合後に治療が必要） */
  if (Math.random() < 0.012) {
    var kc = fieldPlayers().filter(function (p) { return M.knock.indexOf(p.id) < 0; });
    if (kc.length) {
      var hurt = pick(kc);
      M.knock.push(hurt.id);
      M.bonus -= 2;
      M.log.push('🚑 ' + hurt.name + ' が接触プレーで負傷！ 次の勝負どころで交代させよう（交代しない場合は試合後に治療が必要になる）');
    }
  }
  M.block++;
  /* v0.12: 折り返し（40分）でハーフタイム形勢サマリーを1回出す。ハーフタイム場面のある試合では maybeSceneOrEnd 側で出す */
  if (M.block === 5 && M.plan.indexOf('halftime') < 0) showHtSummary();
  maybeSceneOrEnd();
  render();
}
/* v0.12: ハーフタイム形勢サマリー。前半終了（block5=40分）で1回だけ出す。
 * 集計は実際に記録した得点イベント（M.hist）と勝負どころの成功数だけを使う（新しい数値は作らない）。
 * 試合の流れ（停止点・交代）には触れず、表示のみ */
function showHtSummary() {
  if (!M || M.htShown) return;
  M.htShown = true;
  var myT = 0, opT = 0, myP = 0, opP = 0;
  (M.hist || []).forEach(function (e) {
    if (e.k === 'try') { if (e.mine) myT++; else opT++; }
    else { if (e.mine) myP++; else opP++; }
  });
  var d = M.my - M.op;
  var msg = d >= 15 ? '大きなリードで折り返す。後半も気を抜かず、自分たちの形を貫こう' :
    d > 0 ? 'リードして折り返す。相手は後半、必ず勝負を仕掛けてくる。最初の10分が山場だ' :
    d === 0 ? '互角のまま後半へ。後半の最初の得点が、この試合の流れを決める' :
    d > -15 ? 'ビハインドだが射程圏内。後半の勝負どころで流れは必ず来る。一つずつ返そう' :
    '苦しい前半だった。まず1トライを返して、試合を立て直そう';
  var chances = (myT + myP) - (opT + opP);
  var flow = chances > 0 ? '得点のチャンスは桜丘が多く作れている' :
    chances < 0 ? '得点のチャンスは相手が上。後半はまず陣地を取り返したい' :
    '得点のチャンスは互角のつくり合い';
  if (M.scenes.att > 0) flow += '（勝負どころはここまで ' + M.scenes.ok + '/' + M.scenes.att + ' 成功）';
  M.htLines = [
    '⏸ ハーフタイム：桜丘 ' + M.my + ' － ' + M.op + ' ' + M.opp.name,
    '前半の得点内訳 ― 桜丘：トライ' + myT + '・PG' + myP + ' ／ ' + M.opp.name + '：トライ' + opT + '・PG' + opP,
    flow + '。' + msg
  ];
  M.htLines.forEach(function (ln) { M.log.push(ln); });
}
function maybeSceneOrEnd() {
  if (M.block >= 10) return finishMatch();
  var idx = M.stopAt.indexOf(M.block);
  if (idx >= 0) {
    /* v0.16: ハーフタイム場面の無い試合では、後半最初の停止点で先に後半の戦術変更を提示し、本来の勝負どころはその後に回す */
    if (!M.htOffered && M.block >= 5 && M.plan.indexOf('halftime') < 0) {
      M.htOffered = true;
      M.htDeferred = M.plan[idx];
      M.phase = 'scene';
      M.pending = htPlanScene();
      sfx('scene');
      M.log.push('⚑ ' + M.pending.title);
      return;
    }
    M.phase = 'scene';
    M.pending = makeScene(M.plan[idx]);
    sfx('scene');
    applyOppAdj(M.pending);
    if (M.pending.kind === 'halftime') showHtSummary();
    M.log.push('⚑ ' + M.pending.title + (M.pending.key ? '（キーマン：' + M.pending.key.name + '）' : ''));
  }
}
/* 相手の傾向とエースを場面の成功率に薄く反映する */
function applyOppAdj(sc) {
  var d = 0;
  if (sc.kind === 'setpiece' && M.opp.style === 'fw') d -= 0.02;
  if (sc.kind === 'goal' && sc.side === 'att') {
    if (M.opp.style === 'def') d -= 0.03;
    if (M.opp.ace && M.opp.ace.skill === 'tackle') d -= 0.02;
  }
  if (sc.kind === 'goal' && sc.side === 'def') {
    if (M.opp.style === 'wide') d -= 0.03;
    if (M.opp.ace && (M.opp.ace.skill === 'step' || M.opp.ace.skill === 'maul')) d -= 0.02;
  }
  /* v0.16: マーク指示の場面への反映。エースの特能が絡む守備場面は抑え気味に（上の -0.02 を +0.01 だけ戻す）、
   * エース以外の守備場面は他の選手への対応が薄くなり -0.01 */
  if (sc.kind === 'goal' && sc.side === 'def' && markActive()) {
    d += (M.opp.ace && (M.opp.ace.skill === 'step' || M.opp.ace.skill === 'maul')) ? 0.01 : -0.01;
  }
  if (sc.kind === 'setpiece' && M.opp.ace && M.opp.ace.skill === 'lineout') d -= 0.02;
  if (d) sc.choices.forEach(function (c) { c.p = clamp(c.p + d, 0.05, 0.95); });
}
/* 場面の成功率： 能力値に体格・特能・信頼度・疲労・戦術・大舞台補正を重ねる */
function sceneProb(statVal, tacKey, keyPlayer) {
  var st = fieldPlayers();
  /* v0.8: 調子（チーム平均とキーマン本人）が成功率に薄く効く */
  var favg = st.length ? st.reduce(function (a, p) { return a + (p.form || 0); }, 0) / st.length : 0;
  var adj = (avgTrust(st) - 50) * 0.0015 + M.bonus * 0.006 - Math.max(0, M.fat0 - 35) * 0.001
    + favg * 0.008 + (keyPlayer ? (keyPlayer.form || 0) * 0.01 : 0);
  if (M.oppIdx >= 3) adj += skillCount(st, 'big') * 0.015 + (keyPlayer && hasSkill(keyPlayer, 'big') ? 0.03 : 0);
  if (M.opp.skill && M.oppIdx >= 2) adj -= 0.03;
  /* 相手の戦術傾向：モール主体の相手にはモール合戦、キック多用の相手にはキック合戦で分が悪い */
  if (M.opp.style === 'fw' && tacKey === 'maul') adj -= 0.025;
  if (M.opp.style === 'kick' && tacKey === 'kick') adj -= 0.025;
  var tac = TACTICS.filter(function (t) { return t.k === G.tactic; })[0];
  if (tac && tac.key === tacKey) adj += 0.10;
  /* v0.16: 後半の戦術変更。選んだ攻め方に対応する勝負どころだけに +0.04（戦術ボーナス +0.10 より小さい小幅補正） */
  if (M.htPlan && HT_PLANS[M.htPlan] && HT_PLANS[M.htPlan].key === tacKey) adj += 0.04;
  return clamp(0.45 + (statVal - M.power) * 0.02 + adj, 0.05, 0.95);
}
function keyPlayer(posNames, stat, skillKey) {
  var knocked = function (p) { return M && M.knock.indexOf(p.id) >= 0; };
  var st = fieldPlayers().filter(function (p) { return posNames.indexOf(POSITIONS[p.posIdx].p) >= 0 && !knocked(p); });
  if (!st.length) st = fieldPlayers().filter(function (p) { return !knocked(p); });
  if (!st.length) st = fieldPlayers();
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
  var st = fieldPlayers();
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
      return { kind: kind, side: 'att', key: a2, title: '勝負どころ：ゴール前、あと少しでトライ！', choices: [
        C('モールで押し込む', 'FWのパワーと総体重が勝負', sceneProb(fwPow + wAdj + skillCount(st, 'maul') * 2, 'maul', a1), 'モールでじりじり進み、最後は押し込んだ！', 'モールが崩れた…ターンオーバー', 'try', 'none'),
        C('バックスに展開', 'パスとスピード、「ステップ職人」が勝負', sceneProb(bkGo + skillCount(st, 'step') * 2.5, 'wide', a2), a2.name + ' がステップで抜けた！', 'パスが乱れてノックオン', 'try', 'none'),
        C('キックパスで裏へ', 'キック精度が勝負', sceneProb(kick + (hasSkill(a3, 'kick') ? 4 : 0), 'kick', a3), 'キックパスが通り、WTBが抑えた！', 'キックが深すぎてタッチへ', 'try', 'none')
      ] };
    }
    var d1 = keyPlayer(['FL', 'CTB', 'No8'], 'tak', 'tackle');
    return { kind: kind, side: 'def', key: d1, title: '勝負どころ：自陣ゴール前、相手の猛攻！', choices: [
      C('前に出てプレッシャー', 'タックルと「タックルマン」が勝負', sceneProb(tak + skillCount(st, 'tackle') * 2, 'def', d1), d1.name + ' の強烈なタックルでボールを奪った！', 'タックルがずれて突破された…', 'none', 'oppTry'),
      C('受けて立って粘る', 'スタミナと体の重さが勝負', sceneProb(sta + wAdj * 0.5, 'def', d1), '何度も止めて、最後は相手の反則を誘った！', '粘りきれず押し込まれた…', 'none', 'oppTry'),
      C('勝負タックル', 'ハイリスク・ハイリターン', sceneProb(tak - 6, 'def', d1), '起死回生のタックル！ ボールがこぼれた', 'かわされて一気に持っていかれた…', 'none', 'oppTry')
    ] };
  }
  if (kind === 'penalty') {
    var p1 = kickerOf(); /* v0.16: PGキッカーの指名があればその選手が蹴る（おまかせ時は従来どおり最適キーマン） */
    var p2 = keyPlayer(['PR', 'HO', 'LO', 'FL', 'No8'], 'pow', 'maul');
    return { kind: kind, key: p1, title: '勝負どころ：相手の反則！ ペナルティの選択', choices: [
      C('ショット（PGを狙う）', 'キッカーの精度と「ロングキッカー」が勝負', sceneProb((M.kickerId && p1 && p1.id === M.kickerId ? p1.stats.kik : kick) + 8 + (hasSkill(p1, 'kick') ? 4 : 0), 'kick', p1), p1.name + ' のキックが決まった！', 'PGがわずかに外れた…', 'pg', 'none'),
      C('タッチに蹴ってラインアウト', '成功すればトライチャンス', sceneProb(kick + skillCount(st, 'lineout') * 2, 'kick', p1), '大きくタッチを割り、ラインアウトから攻め切った！', 'タッチを割りきれず、チャンスが流れた', 'try', 'none'),
      C('スクラムを選択', 'FWの総体重が勝負', sceneProb(fwPow + wAdj, 'maul', p2), 'スクラムで圧力をかけ、そのまま押し込んだ！', 'スクラムで押し切れなかった', 'try', 'none')
    ] };
  }
  if (kind === 'halftime') {
    /* キャプテンがいるチームは、その信頼の深さが檄の効きを決める */
    var cap = captainOf();
    var tr = cap ? (cap.trust || 50) : avgTrust(st);
    return { kind: kind, key: cap, title: 'ハーフタイム：ロッカールームでの指示', choices: [
      C('檄を飛ばす', '信頼関係が深いほど火がつく', clamp(0.5 + (tr - 50) * 0.004, 0.2, 0.9), '選手の目に火がついた！ 後半の勢いが増す', '熱が入りすぎて少し硬くなった', 'fire', 'none'),
      C('落ち着いて立て直す', '疲労を抜き、形を確認する', 0.8, '呼吸を整えた。疲労が抜け、後半の形も確認できた', '時間切れで話しきれなかった', 'calm', 'none'),
      C('戦術を切り替える', '成功すれば流れが変わる', 0.55, '新しい形が噛み合い、流れを引き寄せた！', '連携が乱れてしまった…', 'switch', 'minus')
    ] };
  }
  /* late: 終盤 */
  var behind = M.my <= M.op;
  if (behind) {
    var l1 = kickerOf(); /* v0.16: 同上（終盤のPGも指名キッカーが蹴る） */
    var l2 = keyPlayer(['WTB', 'CTB', 'FB'], 'spd', 'step');
    var l3 = keyPlayer(['PR', 'HO', 'LO', 'FL', 'No8'], 'pow', 'maul');
    return { kind: kind, key: l2, title: '勝負どころ：終盤、逆転を狙う！', choices: [
      C('PGで確実に3点', 'キック精度が勝負', sceneProb((M.kickerId && l1 && l1.id === M.kickerId ? l1.stats.kik : kick) + 8, 'kick', l1), 'PGで詰め寄った！', 'PGがわずかに外れた…', 'pg', 'none'),
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
  /* v0.16: 後半の戦術変更は采配の選択そのもの。成功判定はなく、勝負どころ（scenes.att）にも数えない */
  if (sc.kind === 'httac') {
    M.htPlan = c.plan || null;
    M.log.push(M.htPlan ? '📋 ' + HT_PLANS[M.htPlan].comm : '📋 後半も前半の形のまま戦う。選手たちに動揺はない');
    subOutId = null;
    if (M.htDeferred) {
      var dk = M.htDeferred; M.htDeferred = null;
      M.phase = 'scene';
      M.pending = makeScene(dk);
      applyOppAdj(M.pending);
      M.log.push('⚑ ' + M.pending.title + (M.pending.key ? '（キーマン：' + M.pending.key.name + '）' : ''));
    } else {
      M.pending = null; M.phase = 'play';
      M.block++;
      maybeSceneOrEnd();
    }
    render();
    return;
  }
  M.scenes.att++;
  var ok = Math.random() < c.p;
  if (ok) M.scenes.ok++;
  var fx = ok ? c.winFx : c.loseFx;
  var txt = (ok ? '✅ ' : '❌ ') + c.n + ' → ' + (ok ? c.winTxt : c.loseTxt);
  if (fx === 'try') txt += ' ' + tryScore(true);
  else if (fx === 'pg') txt += ' ' + pgScore(true);
  else if (fx === 'oppTry') txt += ' 相手の' + tryScore(false);
  else if (fx === 'oppPg') txt += ' 相手の' + pgScore(false);
  else if (fx === 'fire') { M.bonus += 5; fieldPlayers().forEach(function (p) { gainTrust(p, 2); }); }
  else if (fx === 'calm') { fieldPlayers().forEach(function (p) { p.fatigue = Math.max(0, p.fatigue - 10); }); M.bonus += 2; }
  else if (fx === 'switch') {
    M.bonus += 6;
    var others = TACTICS.filter(function (t) { return t.k !== G.tactic; });
    G.tactic = pick(others).k;
    txt += '（戦術を「' + TACTICS.filter(function (t) { return t.k === G.tactic; })[0].n + '」に変更）';
  }
  else if (fx === 'minus') { M.bonus -= 2; }
  /* v0.6: 個人スタッツ（キーマンの活躍を記録） */
  if (ok && sc.key) {
    if (fx === 'try') addStat(sc.key, 'tries');
    else if (fx === 'pg') addStat(sc.key, 'plays');
    else if (fx === 'none' && c.loseFx === 'oppTry') addStat(sc.key, 'plays');
  }
  if (ok && sc.key) {
    gainTrust(sc.key, 3);
    /* v0.8: 活躍したキーマンは調子も上向くことがある */
    if (Math.random() < 0.3) sc.key.form = clamp((sc.key.form || 0) + 1, -2, 2);
  }
  sfx(ok ? 'good' : 'bad');
  M.log.push(txt);
  /* v0.16: ハーフタイムの指示の直後に、後半の戦術変更を1回だけ提示する（勝負どころには数えない） */
  if (sc.kind === 'halftime' && !M.htOffered) {
    M.htOffered = true;
    M.pending = htPlanScene();
    M.phase = 'scene'; subOutId = null;
    M.log.push('⚑ ' + M.pending.title);
    render();
    return;
  }
  M.pending = null; M.phase = 'play'; subOutId = null; M.block++;
  maybeSceneOrEnd();
  render();
}
/* v0.12: 要因分解バーの色（computeFactors の並び順に対応：能力差／采配／調子・疲労／相手の特能・流れ） */
var FACTOR_COLORS = ['#4a6fa5', '#f2762e', '#9333c6', '#66707a'];
function computeFactors(won) {
  var att = Math.max(1, M.scenes.att), rate = M.scenes.ok / att;
  var abilityW, tacticW, condW, oppW;
  if (!won) {
    abilityW = clamp((M.power - M.tp0) * 3 + 22, 5, 80);
    tacticW = clamp((1 - rate) * 48 + 6, 5, 80);
    condW = clamp((M.fat0 - 25) * 0.8 + M.inj0 * 9 + 6 - (M.form0 || 0) * 4, 5, 65);
    oppW = 8 + M.oppIdx * 3 + (M.opp.skill ? 7 : 0);
  } else {
    abilityW = clamp((M.tp0 - M.power) * 3 + 22, 5, 80);
    tacticW = clamp(rate * 48 + 6, 5, 80);
    condW = clamp(48 - M.fat0 * 0.55 - M.inj0 * 6 + (M.form0 || 0) * 4, 5, 65);
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
  M.log.push(commPick(res === 'win' ? 'endWin' : 'endLose', { margin: Math.abs(M.my - M.op) }));
  if (M.my === M.op) M.log.push('（同点のため抽選で勝敗を決定）');
  M.factors = computeFactors(res === 'win');
  fieldPlayers().forEach(function (p) { gainTrust(p, res === 'win' ? 2 : 1); });
  /* v0.8: 出場した選手の調子がゆるやかに動く（勝てば上向きやすい） */
  fieldPlayers().forEach(function (p) {
    if (Math.random() < 0.3) p.form = clamp((p.form || 0) + (Math.random() < (res === 'win' ? 0.62 : 0.42) ? 1 : -1), -2, 2);
  });
  /* v0.9: シーズン到達度と因縁の記録 */
  if (M.oppIdx === 3) {
    G.rivalLast = res;
    if (res === 'win') G.rivalW++; else G.rivalL++;
  }
  /* v0.14: 対戦校別の通算成績（記録のみ。時短スキップの試合も finishMatch を通るため含まれる） */
  if (!G.career.oppRec || typeof G.career.oppRec !== 'object' || Array.isArray(G.career.oppRec)) G.career.oppRec = {};
  var orc = G.career.oppRec[M.opp.name];
  if (!orc) { orc = { p: 0, w: 0, l: 0 }; G.career.oppRec[M.opp.name] = orc; }
  orc.p++; if (res === 'win') orc.w++; else orc.l++;
  /* v0.18: 現在の連勝・連敗ストリークも更新する（記録と実況の素材専用。勝敗の数式には使わない）。
   * 節目（3連勝・3連敗・長い連敗/連勝のストップ）だけ、結果ログに一文を添える */
  if (!G.career.streaks || typeof G.career.streaks !== 'object' || Array.isArray(G.career.streaks)) G.career.streaks = {};
  var stPrev = streakOf(M.opp.name);
  var stNew = res === 'win' ? (stPrev > 0 ? stPrev + 1 : 1) : (stPrev < 0 ? stPrev - 1 : -1);
  G.career.streaks[M.opp.name] = stNew;
  if (stNew === 3) M.log.push('🔥 ' + M.opp.name + ' に3連勝。因縁の相手への相性の良さが、数字にも表れてきた');
  else if (stNew === -3) M.log.push('😖 ' + M.opp.name + ' に3連敗。この壁の高さを、来年こそ越えたい');
  else if (stPrev <= -3 && res === 'win') M.log.push('🎉 長い連敗を止めた！ ' + M.opp.name + ' への雪辱を果たした一戦になった');
  else if (stPrev >= 3 && res !== 'win') M.log.push('連勝は ' + stPrev + ' で止まった。' + M.opp.name + ' もまた、力をつけてきている');
  if (res === 'win') {
    G.season.wins++;
    G.season.bestWin = Math.max(G.season.bestWin || 0, M.oppIdx);
    /* v0.10: 実績用の通算勝利と最高到達、格上撃破（相手の総合力が試合開始時の自チームより上での勝利） */
    G.career.wins = (G.career.wins || 0) + 1;
    G.career.maxBest = Math.max(G.career.maxBest || 0, G.season.bestWin);
    if (M.power > M.tp0) unlockAchv('giant');
    if (M.oppIdx === 4 || M.oppIdx === 5) G.season.hanaWins = (G.season.hanaWins || 0) + 1;
    if (M.oppIdx === 5) G.season.hanaTitle = true;
    G.rep += repGain(M.oppIdx === 0 ? 2 : (M.oppIdx === 3 ? 20 : 6));
    growFromMatch();
    if (M.oppIdx === 3) { G.qualified = true; G.career.hana++; }
    if (M.oppIdx === 4) { G.career.hanaWins++; G.rep += repGain(10); M.log.push('🎉 花園で勝った！ あと1勝で全国制覇だ'); }
    if (M.oppIdx === 5) {
      G.career.hanaWins++; G.career.hanaTitles++; G.career.titles = G.career.hanaTitles;
      G.rep += repGain(30);
      M.log.push('🏆 花園優勝！ 桜丘高校が全国の頂点に立った！');
    }
  } else {
    G.season.losses++;
    /* 格上への善戦ボーナス： 7点差以内で、相手が格上（または互角以上）なら報いる */
    if (M.oppIdx >= 1 && (M.op - M.my) <= 7 && M.power >= M.tp0 - 2) {
      M.gallant = true;
      G.rep += repGain(4);
      growFromMatch(0.4);
      M.log.push('🌟 格上に善戦！ 評判+' + repGain(4) + '。選手たちも大きな経験を積んだ');
    }
  }
  var recovered = tickInjuries();
  if (recovered.length) M.log.push('🏥 ' + recovered.join('、') + ' は来月から復帰できる見込み');
  /* v0.8: 試合中に負傷したまま出場を続けた選手は、試合後に治療（軽症）が必要になる。
   * tickInjuries の後に付ける（付けた直後に回復が進んでしまわないように） */
  if (M.knock && M.knock.length) {
    M.knock.forEach(function (id) {
      var p = G.players.filter(function (x) { return x.id === id; })[0];
      if (p && !p.injured) {
        hurtPlayer(p, false);
        M.log.push('🏥 ' + p.name + ' は試合中の負傷で治療が必要になった（軽症・' + p.injPart + '。復帰まであと' + p.injured + 'か月）');
      }
    });
  }
  fieldPlayers().forEach(function (p) { p.fatigue = Math.min(100, p.fatigue + 8); });
  /* v0.16: 試合に出た選手は「ケガ明けすぐ」の扱いを卒業する（交代パネルの警告表示用フラグ） */
  fieldPlayers().forEach(function (p) { p.justBack = false; });
  if (res === 'win') sfx('win'); else sfx('lose');
  checkAchievements();
  syncFormHist(); /* v0.13: 試合後の調子変動を推移に記録 */
  save();
}
function growFromMatch(prob) {
  var pr = (prob == null ? 0.6 : prob);
  fieldPlayers().forEach(function (p) {
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
  if (idx === 4) {
    if (won) { G.season.result = '花園決勝進出'; advanceMonth(); return; }
    G.season.result = '花園出場（初戦敗退）'; seasonEnd(); return;
  }
  if (idx === 5) {
    G.season.result = won ? '🏆 花園優勝！' : '花園準優勝（決勝敗退）';
    seasonEnd(); return;
  }
  if (!won) {
    G.season.result = idx === 1 ? '予選1回戦敗退' : (idx === 2 ? '予選準決勝敗退' : '予選決勝敗退');
    seasonEnd(); return;
  }
  if (idx === 3) { G.season.result = '花園出場決定'; advanceMonth(); return; }
  advanceMonth();
}
/* v0.8: 選手交代。停止点で控えと入れ替える（上限 subsMax 回）。
 * 負傷した選手（M.knock）の交代は回数に数えない。
 * キーマンが下がった場合は、その場面を交代後の顔ぶれで作り直す */
function doSub(outId, inId) {
  if (!M || M.done) return;
  var oi = M.fieldIds.indexOf(outId);
  if (oi < 0) return;
  var inP = G.players.filter(function (p) { return p.id === inId; })[0];
  var outP = G.players.filter(function (p) { return p.id === outId; })[0];
  if (!inP || !outP || inP.injured || M.fieldIds.indexOf(inId) >= 0) return;
  var free = M.knock.indexOf(outId) >= 0;
  if (!free && M.subs >= M.subsMax) return;
  M.fieldIds[oi] = inId;
  if (free) M.knock = M.knock.filter(function (id) { return id !== outId; });
  else M.subs++;
  M.log.push('🔁 交代：' + outP.name + '（' + POSITIONS[outP.posIdx].p + '）OUT → ' + inP.name + '（' + POSITIONS[inP.posIdx].p + '）IN' +
    (free ? '（負傷交代のため回数に数えない）' : '（交代 ' + M.subs + '/' + M.subsMax + '）'));
  gainTrust(inP, 1);
  subOutId = null;
  if (M.phase === 'scene' && M.pending && M.pending.key && M.pending.key.id === outId) {
    var kind = M.pending.kind, side = M.pending.side, guard = 0;
    do { M.pending = makeScene(kind); guard++; } while (kind === 'goal' && M.pending.side !== side && guard < 4);
    applyOppAdj(M.pending);
    M.log.push('⚑ ' + M.pending.title + (M.pending.key ? '（キーマン：' + M.pending.key.name + '）' : ''));
  }
  render();
}
/* v0.6: 時短スキップ。戦力差の大きい格下戦だけ、試合経過を省略して結果と要因だけを出す */
function canSkip(oppIdx) {
  return oppIdx < 3 && (teamPower() - oppPower(oppIdx)) >= 8;
}
function skipMatch(oppIdx) {
  sfxSuppressed = true; /* v0.10: 高速再生中は音を重ねない（結果の音だけ最後に鳴らす） */
  startMatch(oppIdx);
  var guard = 0;
  while (M && !M.done && guard++ < 300) {
    if (M.phase === 'scene' && M.pending) {
      var bi = 0;
      if (M.pending.kind === 'httac') {
        /* v0.16: 時短では後半の戦術変更を「変更しない」に固定し、従来の自動プレイと条件を揃える */
        M.pending.choices.forEach(function (c, i) { if (!c.plan) bi = i; });
      } else {
        M.pending.choices.forEach(function (c, i) { if (c.p > M.pending.choices[bi].p) bi = i; });
      }
      chooseScene(bi);
    } else playBlock();
  }
  if (!M) return;
  var lines = [
    '⏩ 時短：戦力差のある試合のため、経過を省略して結果のみ表示した',
    '最終スコア ― 桜丘 ' + M.my + ' － ' + M.op + ' ' + M.opp.name,
    M.result === 'win' ? '桜丘高校の勝利！' : '桜丘高校、敗れる…'
  ];
  if (M.gallant) lines.push('🌟 格上に善戦！ 評判と経験のボーナスが入った');
  M.log = lines;
  sfxSuppressed = false;
  sfx(M.result === 'win' ? 'win' : 'lose');
  screen = 'match'; save(); render();
}
function advanceMonth() {
  G.monthIdx++;
  screen = 'inst'; save(); render();
}

/* ---------------- 年度末と世代交代 ---------------- */
function seasonEnd() {
G.growReport = null; /* v0.13: シーズン終了時はサマリーが締めになるため、月次成長レポートは持ち越さない */
var grads = G.players.filter(function (p) { return p.year === 3;});
/* v0.9: シーズン目標の達成判定（達成で評判ボーナス、格上達成は大きめ。未達は小幅減にとどめる） */
var goalObj = goalOf();
var ar = achievedRank();
var goalEval;
if (ar >= goalObj.rank) {
  var gd = repGain(4 + goalObj.rank * 2 + (ar > goalObj.rank ? 3 : 0));
  G.rep += gd;
  goalEval = { ok: true, delta: gd, text: '🎯 シーズン目標「' + goalObj.n + '」達成！ 評判+' + gd + (ar > goalObj.rank ? '（目標を超える快挙！）' : '') };
} else {
  G.rep = Math.max(0, G.rep - 3);
  goalEval = { ok: false, delta: -3, text: '🎯 シーズン目標「' + goalObj.n + '」には届かなかった（評判-3）。来年こそ達成しよう' };
}
/* v0.9: 歴代チームにこの年のチームを記録する */
if (!Array.isArray(G.history)) G.history = [];
G.history.push({ year: G.year, power: teamPower(), result: G.season.result });
if (G.history.length > 60) G.history = G.history.slice(-60);
/* v0.14: シーズン別成績（到達結果・今季勝敗・部の格・シーズン目標と達成可否）をキャリア履歴に残す（直近30件） */
if (!Array.isArray(G.career.seasonHist)) G.career.seasonHist = [];
G.career.seasonHist.push({ y: G.year, result: G.season.result, w: G.season.wins, l: G.season.losses, grade: gradeOf().n, goal: goalObj.n, goalOk: !!goalEval.ok });
if (G.career.seasonHist.length > 30) G.career.seasonHist = G.career.seasonHist.slice(-30);
G.summary = {
result: G.season.result, wins: G.season.wins, losses: G.season.losses,
goalEval: goalEval,
grade: gradeOf().n, grads: grads.map(function (p) { return { name: p.name, pos: POSITIONS[p.posIdx].p, avg: Math.round(overall(p))};}),
firstHana: G.qualified && G.career.hana === 1,
stars: G.players.slice().filter(function (p) { return p.srec && (p.srec.tries > 0 || p.srec.plays > 0); })
.sort(function (a, b) { return (b.srec.tries * 3 + b.srec.plays) - (a.srec.tries * 3 + a.srec.plays); })
.slice(0, 3).map(function (p) { return { name: p.name, pos: POSITIONS[p.posIdx].p, tries: p.srec.tries, plays: p.srec.plays }; })
};
/* v0.10: ケガ人ゼロで完走したら実績。その他の到達系もシーズン終わりに判定する */
if ((G.season.injuries || 0) === 0) unlockAchv('noinj');
checkAchievements();
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
    /* v0.9: OB名鑑にキャリア通算スタッツも併記する */
    /* v0.14: OB 名鑑に最終能力（6能力のスナップショット）と進路も残す */
    var st14 = {};
    STATS.forEach(function (s) { st14[s.k] = Math.round(p.stats[s.k]); });
    G.obs.push({ name: p.name, pos: POSITIONS[p.posIdx].p, avg: Math.round(overall(p)), year: G.year, tries: p.crec ? p.crec.tries : 0, plays: p.crec ? p.crec.plays : 0, st: st14, path: obPathOf(p) });
  });
  /* v0.9: ライバル（帝都のエース）の進級と代替わり */
  if (G.rival) {
    G.rival.grade++;
    if (G.rival.grade > 3) {
      var oldAce = G.rival.name;
      G.rival = newRivalAce(1);
      G.rivalNews = '📰 帝都学園のエース ' + oldAce + ' が卒業。新しいエースは1年の ' + G.rival.name + '（' + G.rival.pos + '・' + skillNameByKey(G.rival.skill) + '）だという';
    }
  }
  if (G.obs.length > 40) G.obs = G.obs.slice(-40);
  G.players = G.players.filter(function (p) { return p.year !== 3; });
  G.players.forEach(function (p) { p.year++; p.injured = 0; p.injSev = null; p.injPart = null; p.fatigue = ri(5, 15); p.justBack = false; p.srec = { tries: 0, plays: 0 }; });
  G.year++; G.monthIdx = 0; G.qualified = false; G.nextBonus = 0;
  G.lineup = null; /* v0.8: 編成はシーズン単位で保持し、新年度は自動選出に戻す */
  G.goal = null; G.goalSet = false; /* v0.9: 新年度は目標を選び直す */
  G.season = { wins: 0, losses: 0, result: '予選敗退', bestWin: 0, hanaWins: 0, hanaTitle: false, injuries: 0 };
  G.summary = null;
  G.recruit = { cands: genScoutCands(), special: genSpecial() };
  sortRoster();
  checkAchievements(); /* v0.10: OB輩出の実績は卒業のタイミングで判定 */
  screen = 'recruit'; sanitize(); save(); render(); /* v0.14: 卒業で空いたキャプテンの引き継ぎと記録を、保存にも反映させる（描画時の sanitize と同じ内容） */
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
  if (G.rivalNews) { lines.push(G.rivalNews); G.rivalNews = null; }
  G.monthLog = lines;
  G.recruit = null;
  checkAchievements();
  screen = 'goal'; save(); render(); /* v0.9: 新年度はまず目標を決める */
}

  /* ---------------- 立ち絵(v0.5): パーツ組み合わせ式SVG生成 ----------------
   * 選手IDをシードに決定的に生成する（同じ選手はいつも同じ顔になる）。
   * レイヤー: 背景 → ユニフォーム姿(体重で肩幅) → 首・耳・顔 → 髪 → 眉・目・鼻・口(性格で変化) */
  function rng32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hairPath(style, rx, top, c) {
    var L = 50 - rx, Rr = 50 + rx;
    var crown = 2 * top - 46; /* 外側カーブの制御点（頭頂が顔の上端に合うよう調整） */
    var open = '<path fill="' + c + '" d="';
    var HL = top + 8.5; /* 前髪の基準位置 */
    var fringe = ' L ' + (50 + rx * 0.5) + ' ' + (HL + 2) + ' L 50 ' + HL + ' L ' + (50 - rx * 0.5) + ' ' + (HL + 2);
    if (style === 0) { /* 坊主: 浅いカーブの生え際 */
      return open + 'M ' + L + ' 45 Q 50 ' + crown + ' ' + Rr + ' 45 Q 50 ' + (2 * (top + 4.5) - 45) + ' ' + L + ' 45 Z"/>';
    }
    if (style === 2) { /* ツンツン */
      var pts = [[L, 47], [L + 1, top + 4], [L + 5, top + 7], [L + 9, top + 1], [45, top + 6], [50, top], [55, top + 6], [Rr - 9, top + 1], [Rr - 5, top + 7], [Rr - 1, top + 4], [Rr, 47]];
      return open + 'M ' + pts.map(function (q) { return q[0] + ' ' + q[1]; }).join(' L ') + fringe + ' L ' + L + ' 47 Z"/>';
    }
    if (style === 3) { /* ウェーブ前髪 */
      return open + 'M ' + L + ' 48 Q 50 ' + crown + ' ' + Rr + ' 48'
        + ' L ' + (50 + rx * 0.55) + ' ' + (HL + 3) + ' L ' + (50 + rx * 0.18) + ' ' + (HL + 0.5)
        + ' L ' + (50 - rx * 0.18) + ' ' + (HL + 3) + ' L ' + (50 - rx * 0.55) + ' ' + (HL + 0.5)
        + ' L ' + L + ' 48 Z"/>';
    }
    if (style === 4) { /* サイドパート: 斜めに流れる前髪 */
      return open + 'M ' + L + ' 47 Q 50 ' + crown + ' ' + Rr + ' 47'
        + ' L ' + (50 + rx * 0.35) + ' ' + (HL + 0.5) + ' L ' + (50 - rx * 0.45) + ' ' + (HL + 3.5)
        + ' L ' + L + ' 47 Z"/>';
    }
    if (style === 5) { /* 長め（サイドが耳にかかる） */
      return open + 'M ' + L + ' 48 Q 50 ' + crown + ' ' + Rr + ' 48' + fringe + ' L ' + L + ' 48 Z"/>'
        + '<rect x="' + (L - 1) + '" y="37" width="4" height="20" rx="2" fill="' + c + '"/>'
        + '<rect x="' + (Rr - 3) + '" y="37" width="4" height="20" rx="2" fill="' + c + '"/>';
    }
    /* 短髪 */
    return open + 'M ' + L + ' 48 Q 50 ' + crown + ' ' + Rr + ' 48' + fringe + ' L ' + L + ' 48 Z"/>';
  }
  function eyesSVG(style) {
    var cy = 51.5, dx = 6.7;
    function eye(cx) {
      if (style === 2) return '<path d="M ' + (cx - 3.4) + ' ' + cy + ' Q ' + cx + ' ' + (cy - 2.8) + ' ' + (cx + 3.4) + ' ' + cy + '" stroke="#33261d" stroke-width="1.7" fill="none" stroke-linecap="round"/>';
      if (style === 1) return '<path d="M ' + (cx - 3.4) + ' ' + (cy + 0.6) + ' L ' + cx + ' ' + (cy - 2.2) + ' L ' + (cx + 3.4) + ' ' + (cy + 0.6) + '" stroke="#33261d" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="' + cx + '" cy="' + (cy + 0.2) + '" r="1.3" fill="#33261d"/>';
      return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="3.3" ry="2.5" fill="#ffffff"/><circle cx="' + cx + '" cy="' + (cy + 0.3) + '" r="1.55" fill="#33261d"/><circle cx="' + (cx + 0.6) + '" cy="' + (cy - 0.5) + '" r="0.55" fill="#ffffff"/>';
    }
    return eye(50 - dx) + eye(50 + dx);
  }
  function mouthSVG(person) {
    var st = 'stroke="#8a5a44" stroke-width="1.7" fill="none" stroke-linecap="round"';
    if (person === '熱血') return '<ellipse cx="50" cy="60.5" rx="3.4" ry="2.2" fill="#8a4a3c"/>';
    if (person === '頑張り屋' || person === 'リーダー気質') return '<path d="M 44.5 59.8 Q 50 64 55.5 59.8" ' + st + '/>';
    if (person === '真面目') return '<path d="M 46.2 60.2 Q 50 62.8 53.8 60.2" ' + st + '/>';
    if (person === '自由人') return '<path d="M 45 60.4 Q 51 63.4 55.8 58.8" ' + st + '/>';
    return '<path d="M 45.6 60.8 L 54.4 60.8" ' + st + '/>'; /* クール・マイペース */
  }
  function portraitSVG(p) {
    var R = rng32((p.id * 2654435761) ^ 0x9e3779b9);
    function pk(arr) { return arr[Math.floor(R() * arr.length)]; }
    function rr(a, b) { return a + Math.floor(R() * (b - a + 1)); }
    var pos = POSITIONS[p.posIdx] || POSITIONS[0];
    /* v0.18: 相手校エースの立ち絵では p.jersey でユニフォーム色を差し替える（自校選手は従来どおり紺） */
    var jersey = p.jersey || '#1b2a52';
    var skin = pk(['#f6cfae', '#eebd93', '#e2aa7c', '#cb9264']);
    var hairC = pk(['#262019', '#3a2a1e', '#54382a', '#6e4b2a', '#191921']);
    var hairStyle = rr(0, 5), faceShape = rr(0, 2), eyeStyle = rr(0, 2), browThick = R() < 0.4;
    var bw = clamp((p.w - 62) / 50, 0, 1);
    var sh = 26 + bw * 10;
    var rx = [16, 14.5, 15][faceShape], ry = [15, 17, 16][faceShape];
    var top = 47 - ry;
    var s = '';
    s += '<rect width="100" height="120" fill="' + (pos.g === 'FW' ? '#e4f0e5' : '#e3ebf5') + '"/>';
    s += '<circle cx="50" cy="50" r="33" fill="#ffffff" opacity="0.45"/>';
    /* 桜丘ユニフォーム: 紺 × 白（v0.10: 生成イラストの配色に合わせて変更）。白のV襟・帯・袖ライン、背番号つき */
    s += '<path d="M ' + (50 - sh) + ' 120 L ' + (50 - sh + 3) + ' 85 Q 50 74 ' + (50 + sh - 3) + ' 85 L ' + (50 + sh) + ' 120 Z" fill="' + jersey + '"/>';
    s += '<path d="M ' + (50 - sh + 1) + ' 104 L ' + (50 + sh - 1) + ' 104 L ' + (50 + sh) + ' 111 L ' + (50 - sh) + ' 111 Z" fill="#f7f3e6"/>';
    s += '<path d="M 41.5 85 L 50 95 L 58.5 85 L 58.5 89.5 L 50 99.5 L 41.5 89.5 Z" fill="#f7f3e6"/>';
    s += '<path d="M ' + (50 - sh + 2.2) + ' 94 L ' + (50 - sh + 4.6) + ' 85.2" stroke="#f7f3e6" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    s += '<path d="M ' + (50 + sh - 2.2) + ' 94 L ' + (50 + sh - 4.6) + ' 85.2" stroke="#f7f3e6" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    s += '<text x="62.5" y="99" font-size="8.5" font-weight="700" fill="#ffffff" opacity="0.92" font-family="sans-serif">' + pos.no + '</text>';
    s += '<rect x="44.5" y="62" width="11" height="16" rx="3" fill="' + skin + '"/>';
    s += '<rect x="44.5" y="62" width="11" height="5" fill="#000000" opacity="0.08"/>';
    s += '<ellipse cx="' + (50 - rx) + '" cy="52" rx="2.3" ry="3.6" fill="' + skin + '"/>';
    s += '<ellipse cx="' + (50 + rx) + '" cy="52" rx="2.3" ry="3.6" fill="' + skin + '"/>';
    if (faceShape === 2) s += '<rect x="' + (50 - rx) + '" y="' + top + '" width="' + (rx * 2) + '" height="' + (ry * 2) + '" rx="8" fill="' + skin + '"/>';
    else s += '<ellipse cx="50" cy="47" rx="' + rx + '" ry="' + ry + '" fill="' + skin + '"/>';
    s += hairPath(hairStyle, rx, top, hairC);
    s += '<g stroke="' + hairC + '" stroke-width="' + (browThick ? 2.6 : 1.8) + '" stroke-linecap="round" fill="none">'
      + '<path d="M ' + (50 - rx + 4) + ' 46 L ' + (50 - 3) + ' ' + (eyeStyle === 1 ? 47 : 45.3) + '"/>'
      + '<path d="M ' + (50 + 3) + ' ' + (eyeStyle === 1 ? 47 : 45.3) + ' L ' + (50 + rx - 4) + ' 46"/></g>';
    s += eyesSVG(eyeStyle);
    s += '<path d="M 50 53.5 Q 51.6 56.8 49.9 58.2" stroke="#b9804f" stroke-width="1.3" fill="none" opacity="0.65" stroke-linecap="round"/>';
    s += mouthSVG(p.person);
    return '<svg viewBox="0 0 100 120" width="100%" role="img" aria-label="' + p.name + '" preserveAspectRatio="xMidYMid meet">' + s + '</svg>';
  }
  function portraitEl(p, cls) {
    var d = h('div', { class: 'portrait ' + (cls || '') });
    d.innerHTML = portraitSVG(p);
    return d;
  }
  /* 試合カットインのひとこと（性格で口調が変わる） */
  function cutinLine(p, kind) {
    var L = {
      setpiece: ['任せてください、押し込みます！', 'ここは俺たちが取る！', '落ち着いて、確実にいこう'],
      goal: ['絶対に決める！', 'スペースは見えている…！', '行くぞ、ついてこい！'],
      penalty: ['確実に決めます', '狙いは定めた。あとは蹴るだけ', '冷静に、正確にいきます'],
      late: ['最後まで走り切る！', 'まだ終わっていない…！', 'みんな、気持ちで負けるな！'],
      halftime: ['後半、必ず取り返します！', '形を確認して、立て直そう', '気持ちは切れていない！']
    };
    var arr = L[kind] || L.goal;
    if (p.person === '熱血' || p.person === '頑張り屋' || p.person === 'リーダー気質') return arr[0];
    if (p.person === 'クール' || p.person === 'マイペース') return arr[2 % arr.length];
    return arr[Math.abs(p.id) % arr.length];
  }
  /* 会話劇のセリフ（性格で口調が変わる） */
  function dlgLine(p, kind) {
    var T = {
      sick: { '熱血': 'くそ…よりによって今…。すぐ治して戻ります！', 'クール': '…無理はしない。次の試合に合わせる', 'default': 'すみません、体調を崩しました…' },
      talk: { '熱血': '監督、もっと強くなりたいです。付き合ってください！', 'リーダー気質': 'チームのこと、少し相談してもいいですか', '真面目': 'やるべきことが、はっきりしました', 'default': '監督と話せて、気持ちが固まりました' },
      cheer: { '熱血': 'みんな、もう1セットいこう！ 声出していけ！', 'リーダー気質': '全員で声を掛け合おう。それが桜丘の強さだ', 'default': 'みんな、もう1セットいこう！' },
      future: { '熱血': '最後の冬、全力で駆け抜けます！ 卒業しても、ずっと桜丘のOBです', '真面目': '進路の準備と両立して、最後までやり切ります', 'default': '卒業してもこの部のことは忘れません。まず花園に行きます' },
      honest: { 'クール': '…実は、監督にだけは言おうと思ってました', '自由人': '正直、練習はキツいっす。でも辞める気はないですよ', 'マイペース': '焦らなくていいって言われて、少し楽になりました', 'default': '本当は…少し悩んでました。聞いてくれて助かりました' },
      mentor: { 'リーダー気質': '後輩は俺たちに任せてください', '熱血': '1年、ついてこい！ 一緒に強くなろう！', 'default': '後輩に教えることで、自分も伸びています' },
      rest: { '自由人': '休むのも練習のうち、ってやつですよ', 'マイペース': 'しっかり寝ました。もう大丈夫です', 'default': 'いい気分転換になりました' },
      ob: { 'default': '先輩、ありがとうございます！ 次の試合、絶対に勝ちます' },
      /* v0.13: 追加イベントのセリフ */
      comeback: { '熱血': '待たせました！ もう全開でいけます！', 'クール': '…復帰した。ここから取り返す', '真面目': 'リハビリで学んだことを、プレーで返します', 'default': 'ご心配をおかけしました。もう大丈夫です' },
      captain: { 'リーダー気質': '最後まで声を出し続けよう。それが桜丘のラグビーだ', '熱血': '俺が引っ張る！ 全員ついてこい！', 'default': 'みんなで声を掛け合っていこう' },
      senior: { 'リーダー気質': '基礎が一番大事だ。焦らなくていい', '真面目': '分からないことは何でも聞いて。去年の自分を見ているようだ', '熱血': '1年、遠慮するな！ ガンガンいけ！', 'default': '教えることで、自分の基礎も固まります' },
      future2: { '熱血': '進路は決めた。あとは花園で全部出すだけです！', '真面目': 'やるべきことは終わりました。最後の冬に集中します', 'default': '決めました。あとはこのチームで勝つだけです' },
      /* v0.18: ライバル専用イベントのキャプテンの一言 */
      rival: { '熱血': 'あの相手には、絶対に負けたくないっす！', 'リーダー気質': '相手のことより、自分たちのラグビーを磨こう', 'クール': '…データは見た。次は勝ち方も変わる', 'default': '次の対戦が楽しみです。全力でぶつかります' }
    };
    var m = T[kind] || {};
    return m[p.person] || m['default'] || '';
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
  /* 季節の重ね描き（v0.5）: 月インデックスでシーンに季節感を足す。
   * バナーは slice で大きく切り取られる（縦長バナーでは可視域が x≒205〜355 まで狭まる）ため、
   * 要素は中央の可視域に集める */
  function seasonSVG(mi) {
    if (mi === 0) { /* 4月: 桜の花びら */
      return '<g fill="#ffb7cd" opacity="0.9"><circle cx="225" cy="18" r="4"/><circle cx="255" cy="40" r="3"/><circle cx="285" cy="14" r="3.4"/><circle cx="315" cy="30" r="3"/><circle cx="245" cy="48" r="2.6"/><circle cx="300" cy="46" r="2.6"/><circle cx="270" cy="24" r="2.4"/><circle cx="332" cy="20" r="3"/></g>';
    }
    if (mi === 3 || mi === 4) { /* 7・8月: 入道雲と強い日差し */
      return '<circle cx="326" cy="16" r="11" fill="#ffdf5c"/><g fill="#ffffff" opacity="0.96"><ellipse cx="252" cy="28" rx="42" ry="12"/><ellipse cx="272" cy="20" rx="27" ry="10"/></g>';
    }
    if (mi != null && mi >= 7) { /* 11月〜1月: 淡い冬の光と粉雪 */
      return '<rect width="560" height="150" fill="#dfe9f2" opacity="0.22"/><g fill="#ffffff" opacity="0.85"><circle cx="225" cy="22" r="2"/><circle cx="255" cy="44" r="1.6"/><circle cx="285" cy="18" r="2"/><circle cx="320" cy="38" r="1.6"/><circle cx="340" cy="24" r="2"/><circle cx="265" cy="58" r="1.4"/><circle cx="330" cy="62" r="1.4"/></g>';
    }
    return '';
  }
  function sceneSVG(kind, mi) {
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
      + postsSVG(452, 128, 0.9, '#ffffff') + ballSVG(320, 132, 0.9) + seasonSVG(mi) + '</svg>';
    if (kind === 'train') return open
      + '<defs><linearGradient id="sk2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a5dcff"/><stop offset="1" stop-color="#eafaff"/></linearGradient>'
      + '<linearGradient id="gr2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#63bd74"/><stop offset="1" stop-color="#2f8550"/></linearGradient></defs>'
      + '<rect width="560" height="46" fill="url(#sk2)"/>' + cloudsSVG('#ffffff')
      + '<rect y="46" width="560" height="104" fill="url(#gr2)"/>'
      + '<g stroke="#ffffff" opacity="0.8"><path d="M0 84 H560" stroke-width="3"/><path d="M0 122 H560" stroke-width="4"/><path d="M120 46 L70 150 M440 46 L490 150" stroke-width="2.5"/></g>'
      + postsSVG(90, 108, 1.05, '#ffffff')
      + '<g fill="#f2762e"><polygon points="300,138 312,118 324,138"/><polygon points="356,142 366,126 376,142"/><polygon points="410,138 420,122 430,138"/></g>'
      + ballSVG(255, 128, 1.15) + seasonSVG(mi) + '</svg>';
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
  /* v0.11: 月次バナーの写真差し替え（月インデックス→写真キー）。
   * ここに登録された月だけ、月頭指示などの月次バナー（train/home）が写真に切り替わる。
   * 冬の朝練イラストが追加生成されたら { 9: 'winter', 10: 'winter' } のように足すだけでよい */
  var MONTH_PHOTOS = { 4: 'camp' };
  /* v0.11: 写真バナー（画像は CSS 側に data URI で埋め込み済み。cover で切り取り表示） */
  function photoBanner(key, cls) {
    return h('div', { class: 'banner photobanner photo-' + key + (cls ? ' ' + cls : '') });
  }
  function banner(kind, cls, mi) {
    if (mi != null && MONTH_PHOTOS[mi] && (kind === 'train' || kind === 'home')) return photoBanner(MONTH_PHOTOS[mi], cls);
    var d = h('div', { class: 'banner' + (cls ? ' ' + cls : '') });
    d.innerHTML = sceneSVG(kind, mi).replace('<svg ', '<svg preserveAspectRatio="xMidYMid slice" ');
    return d;
  }

  /* ---------------- 画面（固定レイアウト） ---------------- */
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'onclick') {
        /* v0.10: ボタンはタップ音を一元的に鳴らす（AudioContext が無い環境では無音で素通り） */
        if (tag === 'button') { var _fn = attrs[k]; el.onclick = function (ev) { sfx('tap'); _fn(ev); }; }
        else el.onclick = attrs[k];
      }
      else el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function mount(node) { var a = document.getElementById('app'); a.innerHTML = ''; a.appendChild(node); maybeDigest(); }
  function render() {
    sanitize();
    if (screen === 'guide') return guideScreen();
    if (!G) return titleScreen();
    if (screen === 'goal') return goalScreen();
    if (screen === 'inst') return instScreen();
    if (screen === 'board') return boardScreen();
    if (screen === 'squad') return squadScreen();
    if (screen === 'preMatch') return preMatchScreen();
    if (screen === 'lineup') return lineupScreen();
    if (screen === 'match') return matchScreen();
    if (screen === 'summary') return summaryScreen();
    if (screen === 'recruit') return recruitScreen();
    if (screen === 'records') return recordsScreen();
    return boardScreen();
  }
  /* v0.17: HUD は1行固定。状態表示は小さなチップにまとめ、画面遷移ボタンは右端のピルに集約する。
   * 遊び方はアイコンボタン化。音トグルは運用・テスト上の理由で短いラベル（音ON/音OFF）を残す */
  function hudBtn(label, target) {
    return h('button', { class: 'hudbtn', onclick: function () { screen = target; render(); } }, [label]);
  }
  function hudChip(label, val) {
    return h('span', { class: 'chip' }, [label + ' ', h('b', null, [val])]);
  }
  function hud() {
    var mo = MONTHS[G.monthIdx] || { m: '—' };
    return h('div', { class: 'hud' }, [
      h('span', { class: 'ttl' }, ['🏉 桜丘高校']),
      h('span', { class: 'chip' }, [G.year + '年目 ・ ' + mo.m]),
      hudChip('部の格', gradeOf().n),
      hudChip('総合力', String(teamPower())),
      hudChip('評判', String(G.rep)),
      h('span', { class: 'sp' }, []),
      hudBtn('選手一覧', 'squad'),
      hudBtn('記録・OB', 'records'),
      h('button', { class: 'hudbtn icon', title: '遊び方', onclick: function () { guideFrom = screen; screen = 'guide'; render(); } }, ['📖']),
      h('button', { class: 'hudbtn icon', title: soundOn ? 'サウンド ON（タップで OFF）' : 'サウンド OFF（タップで ON）', onclick: function () { toggleSound(); } }, [soundOn ? '🔊 音ON' : '🔇 音OFF'])
    ]);
  }
  /* v0.17: 画面下部の固定アクションバー。決定系ボタンはここに置き、コンテンツと重ならないようにする */
  function actionBar(buttons) {
    return h('div', { class: 'actionbar' }, buttons);
  }
  function wrap(children) {
    var w = h('div', { class: 'stack shell' });
    w.appendChild(h('div', { class: 'portrait-note' }, ['📱 横画面にすると1画面に収まるよ']));
    children.forEach(function (c) { w.appendChild(c); });
    mount(w);
  }
  function col(children) { return h('div', { class: 'col' }, children); }
  function titleScreen() {
    var inner = h('div', { class: 'titlewrap titlephoto' }, [
      h('div', { class: 'hero' }, [h('h1', null, ['🏉 Road to HANAZONO']), h('p', null, ['高校ラグビー育成シミュレーション v0.18'])]),
      h('div', { class: 'card center title-card' }, [
        h('p', null, ['弱小・桜丘高校ラグビー部の監督に就任した。月頭に練習指示を出し、進行カードで日々を進め、選手を育てよう。世代を超えて、花園の常連校を目指す。']),
        h('button', { class: 'btn primary', onclick: function () { newGame('normal'); screen = 'goal'; render(); } }, ['監督に就任する（ふつう）']),
        h('button', { class: 'btn', onclick: function () { newGame('challenge'); screen = 'goal'; render(); } }, ['監督に就任する（チャレンジ）']),
        h('p', { class: 'sub' }, ['難易度は開始時だけの選択。チャレンジは相手が少し強く（全校+3）、評判の伸びが渋い（×0.7）']),
        h('div', { class: 'hand', style: 'margin-top:10px;justify-content:center' }, [guideBtn('btn'), soundBtn()])
      ])
    ]);
    mount(h('div', { class: 'stack shell' }, [inner]));
  }
    /* v0.10: 遊び方ガイド（タイトルとHUDから開く。左＝目的と流れ、右＝見方とコツ） */
  function guideScreen() {
    var back = function () {
      var t = (guideFrom && guideFrom !== 'guide') ? guideFrom : (G ? (G.recruit ? 'recruit' : (G.summary ? 'summary' : (G.board ? 'board' : 'inst'))) : 'title');
      screen = t; render();
    };
    var L = h('div', { class: 'card grow scroll' });
    L.appendChild(h('div', { class: 'sec' }, ['🎯 目的']));
    L.appendChild(h('p', null, ['弱小公立・桜丘高校ラグビー部の監督として、選手を育て、世代交代を重ねながら花園（全国大会）の常連校を目指す育成シミュレーションです。評判が上がると「部の格」（弱小→そこそこ→中堅→強豪→名門）が上がり、入部してくる新入生の質も上がる好循環が生まれます。記録室では実績（トロフィー）も集まります。']));
    L.appendChild(h('div', { class: 'sec' }, ['📅 1年の流れ']));
    [['① 年初の目標', 'シーズン目標を決める。達成で評判ボーナス、未達でも小さなペナルティのみ'],
     ['② 月頭指示', '全体方針・ユニット練習・重点育成・練習強度・キャプテン・校風を決める'],
     ['③ すごろく進行', '進行カードでマスを進む。止まったマスで練習・イベント・回復などが起きる'],
     ['④ 試合', '6月=練習試合、10〜12月=花園予選、1月=花園。勝負どころでは采配（選択肢）を選ぶ'],
     ['⑤ シーズン終了', '結果を振り返り、3年生は卒業してOB名鑑へ'],
     ['⑥ 勧誘', 'スカウト候補・特別枠・一般入部で新チームを作って新年度へ']].forEach(function (r) {
      L.appendChild(h('div', { class: 'rowline kvrow' }, [h('b', null, [r[0]]), h('span', { class: 'sub' }, [r[1]])]));
    });
    var R = h('div', { class: 'card grow scroll' });
    R.appendChild(h('div', { class: 'sec' }, ['👀 画面の見方']));
    R.appendChild(h('p', null, ['左＝情報（実況・盤面・選手一覧）、右＝操作（選択肢・ボタン）が基本配置です。試合は左の実況を読み、右で采配を選んでください。画面上部のバーでは年・月・部の格・総合力・評判がいつでも確認できます。']));
    R.appendChild(h('div', { class: 'sec' }, ['💡 監督のコツ']));
    [['疲労管理', '疲労70以上で練習効率も試合の成功率も大きく落ちる。ケア（💊）と休み（😴）のマス、強度「通常」を織り交ぜよう'],
     ['信頼度', '試合の出場と活躍で上がり、采配の成功率に効く。重点育成と起用でエースを育てよう'],
     ['ケガ予防', '強度を上げるほどケガのリスクも上がる。疲労をためないことが一番の予防になる'],
     ['スカウト', '寸評は体格・特能・性格のヒント。成功率とOB紹介の有無を見て枠を使おう'],
     ['格上戦', '7点差以内の善戦でも評判と経験が得られる。試合後の「敗因の内訳」が次への教材になる'],
     ['時短', '戦力差の大きい試合は対戦確認画面から「結果のみ表示」で飛ばせる'],
     ['采配', '対戦確認でPGキッカーと、相手エースへのマークを指名できる（どちらも任意）。後半には戦術変更の機会もあり、選んだ攻め方が少しだけ効きやすくなる']].forEach(function (r) {
      R.appendChild(h('div', { class: 'rowline kvrow' }, [h('b', null, [r[0]]), h('span', { class: 'sub' }, [r[1]])]));
    });
    R.appendChild(h('button', { class: 'btn primary', style: 'margin-top:12px', onclick: back }, [G ? '◀ 戻る' : '◀ タイトルへ戻る']));
    var kids = [];
    if (G) kids.push(hud());
    kids.push(h('div', { class: 'sec' }, ['📖 遊び方 ― Road to HANAZONO']));
    kids.push(h('div', { class: 'lay2' }, [col([L]), col([R])]));
    wrap(kids);
  }
  /* v0.9: シーズン目標の設定（年初のみ）。おすすめは部の格で決まり、格上目標も選べる */
  function goalScreen() {
    var rec = recommendedGoal();
    var cur = goalOf();
    var left = [banner('home', 'grow', 0)];
    var info = h('div', { class: 'card grow' }, [
      h('div', { class: 'sec' }, ['🎯 ' + G.year + '年目の目標を決めよう']),
      h('p', null, ['シーズンの物差しになる目標を1つ選ぶ。達成すれば評判が上がり、格上の目標を達成すればなお大きい。届かなくても罰は小さい（評判-3）から、思い切って高い目標を掲げるのも監督の腕の見せどころ。']),
      h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['現在の部の格']), h('span', null, [gradeOf().n])]),
      h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['昨季の結果']), h('span', null, [G.history.length ? G.history[G.history.length - 1].result : '―（初年度）'])]),
      h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['おすすめの目標']), h('span', null, [rec.n])])
    ]);
    left.push(info);
    var box = h('div', { class: 'card choices grow scroll' });
    box.appendChild(h('div', { class: 'sec' }, ['今年の目標']));
    GOALS.forEach(function (gl) {
      box.appendChild(h('button', { class: 'btn choice' + (cur.k === gl.k ? ' primary' : ''), onclick: function () { G.goal = gl.k; save(); render(); } }, [
        h('span', { class: 't' }, [gl.n + (rec.k === gl.k ? ' ⭐おすすめ' : '') + (cur.k === gl.k ? ' ✔選択中' : '')]),
        h('span', { class: 'd' }, [' — ' + gl.d + '（達成ボーナス 評判+' + repGain(4 + gl.rank * 2) + '〜）'])
      ]));
    });
    var right = [box];
    wrap([hud(), h('div', { class: 'lay2' }, [col(left), col(right)]),
      actionBar([h('button', { class: 'btn primary', onclick: function () { G.goalSet = true; save(); screen = 'inst'; render(); } }, ['目標を決めてシーズンを始める'])])]);
  }
  function instScreen() {
    var mo = MONTHS[G.monthIdx];
    /* v0.17: 左カラムは「月のバナーを背景に敷き、半透明カードを重ねる」ヒーローパネルに統合する
     * （タイトル画面 v0.9.1 で実績のある手法）。バラ積みカードをやめ、バナーの帯状潰れと、
     * ラベルが縦に割れる問題（設備など）を解消する。表示内容（目標・設備・難易度・最近の出来事）は従来どおり */
    var gObj = goalOf();
    var heroPanel = h('div', { class: 'heropanel grow' });
    heroPanel.appendChild(banner('train', 'herobg', G.monthIdx));
    var heroBody = h('div', { class: 'herobody' });
    var glass = h('div', { class: 'glasscard' });
    glass.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'glab' }, ['🎯 今年の目標']), h('span', { class: 'gval' }, [gObj.n])]));
    glass.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'glab' }, ['🏟 設備']), h('span', { class: 'gval' }, [FACILITIES.filter(function (f) { return hasFacility(f.k); }).map(function (f) { return f.n; }).join('・') || 'なし'])]));
    if (G.difficulty === 'challenge') glass.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'glab' }, ['難易度']), h('span', { class: 'gval' }, ['チャレンジ'])]));
    heroBody.appendChild(glass);
    if (G.monthLog && G.monthLog.length) {
      var glog = h('div', { class: 'glasscard herolog' });
      glog.appendChild(h('div', { class: 'sub' }, ['最近の出来事']));
      G.monthLog.forEach(function (l) { glog.appendChild(h('div', null, [l])); });
      heroBody.appendChild(glog);
    }
    heroPanel.appendChild(heroBody);
    var left = [heroPanel];
    /* v0.15: 先月の成長レポートを作り替え。濃緑ボード＋色つき名前プレート＋「ランク 数値 → ランク 数値」形式
     * （データは v0.13 の growReport をそのまま使用し、様式のみ変更）。変化後の数値は現在の能力から
     * レポートの伸び分を差し引いて逆算し、矢印の幅がレポートの伸び分と一致するようにする。
     * 選手が見つからない場合は伸び分のみ表示。特能はプレイ中の獲得・変化が存在しない
     * （生成時にのみ決まる）ため、このレポートには含めない */
    if (G.growReport && G.growReport.rows && G.growReport.rows.length) {
      var gr = h('div', { class: 'card growreport grboard' });
      gr.appendChild(h('div', { class: 'grtitle' }, ['〜 ' + G.growReport.label + 'の成長レポート 〜']));
      var lineupNow = lineupIds();
      G.growReport.rows.slice(0, 10).forEach(function (r) {
        var pl = G.players.filter(function (p) { return p.name === r.name; })[0];
        var rowEl = h('div', { class: 'grrow' });
        var who = h('div', { class: 'grwho' });
        who.appendChild(h('span', { class: 'grrole' }, [r.focus ? '重点' : (pl && lineupNow.indexOf(pl.id) >= 0 ? 'スタメン' : '控え')]));
        who.appendChild(h('span', { class: 'grplate', style: 'background:' + plateColor(r.name) }, [r.name]));
        if (pl) who.appendChild(h('span', { class: 'gryear' }, [pl.year + '年']));
        rowEl.appendChild(who);
        var chg = h('div', { class: 'grchg' });
        STATS.filter(function (s) { return r.stats[s.k]; }).forEach(function (s) {
          var item = h('span', { class: 'gritem' });
          item.appendChild(document.createTextNode(s.n + ' '));
          if (pl) {
            var after = pl.stats[s.k];
            item.appendChild(rankValEl(after - r.stats[s.k], null, true));
            item.appendChild(h('span', { class: 'grarrow' }, ['➡']));
            item.appendChild(rankValEl(after, null, true));
          } else {
            item.appendChild(document.createTextNode('+' + r.stats[s.k]));
          }
          chg.appendChild(item);
        });
        if (r.trust > 0) {
          var ti = h('span', { class: 'gritem grtrust' });
          ti.appendChild(document.createTextNode('信頼度 '));
          ti.appendChild(h('span', { class: 'grarrow' }, [r.trust >= 8 ? '↑↑↑' : (r.trust >= 4 ? '↑↑' : '↑')]));
          chg.appendChild(ti);
        }
        rowEl.appendChild(chg);
        gr.appendChild(rowEl);
      });
      if (G.growReport.rows.length > 10) {
        gr.appendChild(h('div', { class: 'sub' }, ['ほか ' + (G.growReport.rows.length - 10) + ' 名も成長した']));
      }
      gr.appendChild(h('button', { class: 'btn small grcheck', onclick: function () { G.growReport = null; save(); render(); } }, ['確認した']));
      left.push(gr);
    }
    var card = h('div', { class: 'card grow scroll' });
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
    /* v0.7: キャプテン任命（信頼度トップを推奨表示）と校風 */
    var byTrust = G.players.slice().sort(function (a, b) { return (b.trust || 0) - (a.trust || 0); });
    var s5 = h('select', null, byTrust.map(function (p, i) {
      return h('option', { value: String(p.id) }, [(i === 0 ? '⭐推奨 ' : '') + p.name + '（' + p.year + '年・' + POSITIONS[p.posIdx].p + '・信頼 ' + p.trust + '）']);
    }));
    s5.value = String(G.captainId); s5.onchange = function () { G.captainId = +s5.value; recordCaptain(); save(); render(); }; /* v0.14: 任命はその場で歴代キャプテンに記録してから保存 */
    var s6 = h('select', null, ETHOS.map(function (e) { return h('option', { value: e.k }, [e.n + ' ― ' + e.d]); }));
    s6.value = G.ethos; s6.onchange = function () { G.ethos = s6.value; save(); };
    form.appendChild(field('全体方針（チーム全員の底上げ）', s1));
    form.appendChild(field('ユニット練習', s2));
    form.appendChild(field('重点育成する選手', s3));
    form.appendChild(field('練習強度（成長と疲労・ケガのバランス）', s4));
    form.appendChild(field('キャプテン（檄の効きと信頼の集まりやすさに影響）', s5));
    form.appendChild(field('校風（チーム方針）', s6));
    card.appendChild(form);
    var right = [];
    /* v0.15: 初回ヒント。新規開始の最初の月（1年目・4月）の月頭指示にだけ1行出す */
    if (!G.hintSeen && G.year === 1 && G.monthIdx === 0) {
      right.push(h('div', { class: 'card hintcard' }, ['💡 まずは全体方針と重点育成する選手を選んで、月を始めよう。練習で選手が育ち、月末には試合が待っている']));
    }
    right.push(card);
    wrap([hud(), h('div', { class: 'lay2' }, [col(left), col(right)]),
      actionBar([h('button', { class: 'btn primary', onclick: function () { startMonth(); } }, ['指示を確定して月を始める'])])]);
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
    var rightKids = [handCard, info];
    if (b.dlg) {
      var dp = G.players.filter(function (p) { return p.id === b.dlg.pid; })[0];
      if (dp) {
        var dg = h('div', { class: 'card dlg' });
        dg.appendChild(portraitEl(dp, 'dlg-p'));
        dg.appendChild(h('div', null, [
          h('div', null, [h('b', null, [dp.name]), h('span', { class: 'sub' }, ['（' + dp.person + '）'])]),
          h('div', null, ['「' + b.dlg.text + '」'])
        ]));
        rightKids.push(dg);
      }
    }
    rightKids.push(log);
    wrap([hud(), h('div', { class: 'lay2' }, [col([boardCard]), col(rightKids)])]);
    var lg = document.querySelector('.log'); if (lg) lg.scrollTop = lg.scrollHeight;
  }
  /* v0.17: 選手データ画面を master-detail 化（左＝選手リスト／右＝選択中選手の詳細＋上部タブ）。
   * パワプロの選手データ画面（photo-7）の様式に寄せ、詳細は「能力」「プロフィール」のタブで切り替える。
   * 一覧テーブルの列構成と詳細の全項目（v0.15 のランク併記・特能タググリッド・調子の推移など）は保持し、配置だけを変える。
   * タブの両ペインは DOM に残して表示だけを切り替える（切り替えた先にしか無い項目を作らないため） */
  function squadScreen() {
    if (!G.players.some(function (p) { return p.id === selPlayerId; })) selPlayerId = G.players[0] ? G.players[0].id : null;
    var table = h('table', { class: 'squad' });
    table.appendChild(h('tr', null, ['No', '名前', '年', 'Pos', '身長', '体重'].concat(STATS.map(function (s) { return s.n.slice(0, 2); })).concat(['疲労', '信頼']).map(function (x) { return h('th', null, [x]); })));
    G.players.forEach(function (p) {
      var cells = [String(POSITIONS[p.posIdx].no), null, String(p.year), POSITIONS[p.posIdx].p, String(p.h), String(p.w)].map(function (x, i) {
        if (i === 1) {
          var td = h('td', { class: 'name' });
          var pm = h('span', { class: 'pmini' });
          pm.innerHTML = portraitSVG(p);
          td.appendChild(pm);
          td.appendChild(document.createTextNode(p.name + ' '));
          td.appendChild(formFace(p));
          td.appendChild(document.createTextNode((p.id === G.captainId ? ' ©主将' : '') + (p.injured ? ' 🚑' + (p.injured > 1 ? '（あと' + p.injured + 'か月）' : '') : '')));
          return td;
        }
        return h('td', null, [x]);
      });
      STATS.forEach(function (s) { cells.push(h('td', null, [rankValEl(p.stats[s.k], 'sm')])); }); /* v0.15: ランク併記 */
      cells.push(h('td', null, [String(p.fatigue)]));
      cells.push(h('td', null, [String(p.trust)]));
      var tr = h('tr', { class: 'prow' + (p.id === selPlayerId ? ' sel' : ''), onclick: (function (pid) { return function () { selPlayerId = pid; render(); }; })(p.id) }, cells);
      table.appendChild(tr);
    });
    var sel = G.players.filter(function (p) { return p.id === selPlayerId; })[0];
    var detail = h('div', { class: 'card grow scroll pdetail' });
    if (sel) {
      var per = personOf(sel);
      var spos = POSITIONS[sel.posIdx];
      /* v0.15: 名前バナー（背番号チップ＋名前＋学年・ポジションのバッジ） */
      var bannerEl = h('div', { class: 'pname' });
      bannerEl.appendChild(h('span', { class: 'pno' }, [String(spos.no)]));
      bannerEl.appendChild(h('span', { class: 'pname-t' }, [sel.name]));
      bannerEl.appendChild(h('span', { class: 'pbadge' }, [sel.year + '年']));
      bannerEl.appendChild(h('span', { class: 'pbadge' }, [spos.p + '（' + spos.g + '）']));
      if (sel.id === G.captainId) bannerEl.appendChild(h('span', { class: 'pbadge cap' }, ['©主将']));
      if (sel.injured) bannerEl.appendChild(h('span', { class: 'pbadge inj' }, ['🚑負傷中']));
      detail.appendChild(bannerEl);
      /* v0.17: 上部タブ（能力／プロフィール） */
      detail.appendChild(h('div', { class: 'tabs' }, [
        h('button', { class: 'tabbtn' + (squadTab === 'stat' ? ' on' : ''), onclick: function () { squadTab = 'stat'; render(); } }, ['能力']),
        h('button', { class: 'tabbtn' + (squadTab === 'prof' ? ' on' : ''), onclick: function () { squadTab = 'prof'; render(); } }, ['プロフィール'])
      ]));
      /* 能力ペイン：能力値（ランク＋数値＋伸びしろメーター）と特能・個性タググリッド */
      var statPane = h('div', { class: 'tabpane' + (squadTab === 'stat' ? '' : ' tabhide') });
      statPane.appendChild(h('div', { class: 'sec' }, ['能力']));
      STATS.forEach(function (s) {
        var v = sel.stats[s.k];
        var stage = v >= 99 ? '限界' : (v >= 93 ? '限界間近' : (v >= 85 ? 'あと少し' : ''));
        var color = v >= 93 ? '#c62f3b' : (v >= 85 ? '#e8862e' : null);
        var valSpan = h('span', { class: 'pstat-val' }, []);
        valSpan.appendChild(rankValEl(v, 'lg'));
        if (stage) valSpan.appendChild(document.createTextNode(' ・' + stage));
        statPane.appendChild(h('div', { class: 'rowline' }, [
          h('span', { class: 'sub' }, [s.n]),
          valSpan
        ]));
        statPane.appendChild(h('div', { class: 'meter capmeter' }, [h('div', { style: 'width:' + v + '%' + (color ? ';background:' + color : '') }, [])]));
      });
      var totSpan = h('span', { class: 'pstat-val' }, []);
      totSpan.appendChild(rankValEl(Math.round(overall(sel)), 'lg'));
      statPane.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['総合']), totSpan]));
      statPane.appendChild(h('div', { class: 'sec' }, ['特能・個性']));
      var grid = h('div', { class: 'taggrid' });
      var names = skillNames(sel);
      if (!names.length && !sel.trait) grid.appendChild(h('span', { class: 'sub' }, ['なし']));
      names.forEach(function (n) { grid.appendChild(h('span', { class: 'tag good' }, [n])); });
      if (sel.trait) grid.appendChild(h('span', { class: 'tag ' + (sel.trait.n === '怪我がち' ? 'bad' : 'mid') }, [sel.trait.n]));
      statPane.appendChild(grid);
      detail.appendChild(statPane);
      /* プロフィールペイン：立ち絵＋素性（体格・性格・ケガ）、記録、調子まわり、信頼度・疲労 */
      var profPane = h('div', { class: 'tabpane' + (squadTab === 'prof' ? '' : ' tabhide') });
      var head = h('div', { class: 'detail-head' });
      head.appendChild(portraitEl(sel, 'detail-p'));
      var hinfo = h('div', { style: 'flex:1;min-width:0' });
      hinfo.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['学年／ポジション']), h('span', null, [sel.year + '年・' + spos.p + '（' + spos.g + '）'])]));
      hinfo.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['体格']), h('span', null, [sel.h + 'cm ／ ' + sel.w + 'kg'])]));
      hinfo.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['性格']), h('span', null, [sel.person])]));
      hinfo.appendChild(h('div', { class: 'sub' }, [per.d]));
      if (sel.injured) {
        hinfo.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['ケガの状態']), h('span', null, [(sel.injSev === 'heavy' ? '重症' : '軽症') + '（' + (sel.injPart || '負傷') + '）・復帰まであと' + sel.injured + 'か月'])]));
      }
      head.appendChild(hinfo);
      profPane.appendChild(head);
      profPane.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['今季の記録']), h('span', null, ['トライ ' + (sel.srec ? sel.srec.tries : 0) + ' ／ 好プレー ' + (sel.srec ? sel.srec.plays : 0)])]));
      profPane.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['キャリア通算']), h('span', null, ['トライ ' + (sel.crec ? sel.crec.tries : 0) + ' ／ 好プレー ' + (sel.crec ? sel.crec.plays : 0)])]));
      profPane.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['調子']), h('span', null, [formFace(sel), '（成功率と練習効率に影響）'])]));
      /* v0.13: 調子の推移。直近最大6件を v0.12 の顔アイコン（固定サイズ・ラベルなし）の列で、古い順→最新で並べる */
      var histSpan = h('span', { class: 'formhist' }, []);
      if (sel.formHist && sel.formHist.length) sel.formHist.forEach(function (v) { histSpan.appendChild(formFaceVal(v)); });
      else histSpan.appendChild(document.createTextNode('―'));
      profPane.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['調子の推移']), histSpan]));
      profPane.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['信頼度']), h('span', null, [String(sel.trust) + '（采配の成功率に影響）'])]));
      profPane.appendChild(h('div', { class: 'meter' }, [h('div', { style: 'width:' + sel.trust + '%' }, [])]));
      profPane.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['疲労']), h('span', null, [String(sel.fatigue)])]));
      detail.appendChild(profPane);
    }
    wrap([hud(), h('div', { class: 'lay2 laysquad' }, [
      h('div', { class: 'card grow scroll squadlist' }, [h('div', { class: 'sec' }, ['選手データ（行タップで詳細）']), table]),
      col([detail, h('button', { class: 'btn', onclick: function () { screen = G.recruit ? 'recruit' : (G.board ? 'board' : 'inst'); render(); } }, ['戻る'])])
    ])]);
  }
  /* v0.8: メンバー編成。左にスタメン（背番号順）、右に控えと操作。
   * スタメンの行をタップで選択 → 控えをタップで入れ替え。スタメン同士のタップで枠の交換もできる。
   * 編成は G.lineup に保存してシーズン中保持する（新年度は自動選出に戻る）。
   * ケガ・欠場中の選手は「入れる」ことができない（枠にいる場合は試合で自動補完される） */
  function swapLineupWith(slot, benchId) {
    var ids = lineupIds().slice();
    ids[slot] = benchId;
    G.lineup = ids;
    lineupSlot = null;
    save(); render();
  }
  function lineupScreen() {
    var ids = lineupIds();
    var inSet = {};
    ids.forEach(function (id) { if (id != null) inSet[id] = 1; });
    var left = h('div', { class: 'card grow scroll' });
    left.appendChild(h('div', { class: 'sec' }, ['スタメン（背番号順）― 行タップで選択']));
    var table = h('table', { class: 'squad' });
    table.appendChild(h('tr', null, ['No', 'Pos', '名前', '年', '総合', '疲労', '調子'].map(function (x) { return h('th', null, [x]); })));
    ids.forEach(function (id, n) {
      var p = G.players.filter(function (x) { return x.id === id; })[0];
      var pos = POSITIONS[n];
      var filled = Array.isArray(G.lineup) && G.lineup[n] !== id;
      var cells = [String(pos.no), pos.p,
        p ? (p.name + (filled ? ' ※' : '')) : '―',
        p ? String(p.year) : '', '',
        p ? String(p.fatigue) : ''];
      var tds = cells.map(function (x) { return h('td', null, [x]); });
      if (p) tds[4].appendChild(rankValEl(Math.round(overall(p)), 'sm')); /* v0.15: 総合もランク併記 */
      tds.push(h('td', null, p ? [formFace(p)] : []));
      var tr = h('tr', { class: 'prow' + (lineupSlot === n ? ' sel' : ''), onclick: (function (nn) {
        return function () {
          if (lineupSlot === nn) { lineupSlot = null; render(); return; }
          if (lineupSlot != null) {
            var cur = lineupIds().slice();
            var t = cur[lineupSlot]; cur[lineupSlot] = cur[nn]; cur[nn] = t;
            G.lineup = cur; lineupSlot = null; save(); render(); return;
          }
          lineupSlot = nn; render();
        };
      })(n) }, tds);
      table.appendChild(tr);
    });
    left.appendChild(table);
    left.appendChild(h('div', { class: 'sub' }, ['※ はケガなどで編成どおりに出られないため自動補完された枠。編成はシーズンを通して保持され、試合中の交代とは別に次の試合にも引き継がれる']));
    var right = h('div', { class: 'card grow scroll' });
    right.appendChild(h('div', { class: 'sec' }, ['控えメンバー']));
    if (lineupSlot == null) right.appendChild(h('div', { class: 'sub' }, ['先に左のスタメンから、入れ替えたい選手を選んでください。スタメン同士の入れ替えは、続けて別のスタメンをタップ']));
    else {
      var selP = G.players.filter(function (x) { return x.id === ids[lineupSlot]; })[0];
      right.appendChild(h('div', { class: 'sub' }, [(selP ? selP.name : '―') + ' と入れ替える控えを選んでください']));
    }
    var bench = G.players.filter(function (p) { return !inSet[p.id]; });
    if (!bench.length) right.appendChild(h('div', { class: 'sub' }, ['控えがいない']));
    bench.forEach(function (p) {
      if (p.injured) {
        right.appendChild(h('div', { class: 'rowline subrow' }, [
          h('span', null, ['🚑 ' + p.name]),
          h('span', { class: 'sub' }, [POSITIONS[p.posIdx].p + '・' + (p.injSev === 'heavy' ? '重症' : '軽症') + '（' + (p.injPart || '負傷') + '）・復帰まであと' + p.injured + 'か月'])
        ]));
        return;
      }
      var bk = ['IN ' + POSITIONS[p.posIdx].p + ' ' + p.name + '（' + p.year + '年・総合 ', rankValEl(Math.round(overall(p)), 'sm'), '・疲労' + p.fatigue + '・', formFace(p), '）'];
      var bwe = warnEl(p); if (bwe) bk.push(bwe); /* v0.16: 警告表示（疲労・不調・ケガ明け） */
      right.appendChild(h('button', { class: 'btn small subbtn', onclick: (function (pid) {
        return function () { if (lineupSlot != null) swapLineupWith(lineupSlot, pid); };
      })(p.id) }, bk));
    });
    var rightCol = [right,
      h('button', { class: 'btn', onclick: function () { G.lineup = null; lineupSlot = null; save(); render(); } }, ['自動選出に戻す']),
      h('button', { class: 'btn primary', onclick: function () { screen = 'preMatch'; render(); } }, ['試合前に戻る'])
    ];
    wrap([hud(), h('div', { class: 'lay2' }, [col([left]), col(rightCol)])]);
  }
  /* v0.12: スカウティングの弱点ヒント。相手の内部データ（戦術傾向 style／エース ace／特能 skill）から
   * 実際に導ける狙い目だけを最大2つ出す。存在しない能力値（相手の個別スタッツ等）は作らない */
  function scoutHints(opp) {
    var hints = [];
    if (opp.style === 'fw') hints.push('FWの圧力は本物。ただしBKの展開力は相対的に控えめで、ボールを大きく動かすと活路が開ける');
    else if (opp.style === 'wide') hints.push('BKの展開は鋭いが、FW正面の圧力にはやや弱い。セットピースで押し込む形が効く');
    else if (opp.style === 'kick') hints.push('キックで陣地を取る分、ボールを長く保持して攻め続ける形は少ない。反則を減らしてキックの機会を与えないことが鍵');
    else if (opp.style === 'def') hints.push('守備は堅いが、得点力は突出していない。PGで確実に点を重ねれば、焦れて反則も増えてくる');
    var kickStrong = opp.style === 'kick' || (opp.ace && opp.ace.skill === 'kick') || (opp.skill && opp.skill.key === 'kick');
    if (kickStrong) hints.push('相手のキックの精度が高い。ゴール前の反則は厳禁（PGで確実に点差を広げられる）');
    else if (opp.ace) hints.push('得点源はエース ' + opp.ace.name + '（' + opp.ace.pos + '・' + skillNameByKey(opp.ace.skill) + '）に寄っている。エースを止めれば攻撃は鈍る');
    return hints.slice(0, 2);
  }
  function preMatchScreen() {
    var mo = MONTHS[G.monthIdx], opp = effOpp(mo.match);
    /* v0.16: キッカー／マークの指名（任意）。現在のスタメンにいない指名は無効として落とす */
    var stNow = starters();
    if (selKickerId != null && !stNow.some(function (p) { return p.id === selKickerId; })) selKickerId = null;
    if (selMarkId != null && !stNow.some(function (p) { return p.id === selMarkId; })) selMarkId = null;
    var vs = h('div', { class: 'card center grow scroll' }, [
      h('div', { class: 'big' }, ['vs ' + opp.name]),
      h('div', { class: 'sub' }, [opp.note]),
      opp.skill ? h('div', { class: 'sub' }, ['相手の特能：' + opp.skill.n]) : h('span', null, []),
      h('div', { class: 'rowline' }, [h('span', null, ['桜丘の総合力']), h('span', { class: 'big' }, [String(teamPower())])]),
      h('div', { class: 'rowline' }, [h('span', null, ['相手の総合力']), h('span', { class: 'big' }, [String(oppPower(mo.match))])]),
      h('div', { class: 'rowline' }, [h('span', null, ['スタメン編成']), h('span', null, [Array.isArray(G.lineup) ? 'カスタム編成' : '自動選出（総合力順）'])])
    ]);
    /* v0.6: スカウティング（相手の傾向・総合力・エース） */
    if (opp.style || opp.ace) {
      var sc = h('div', { class: 'card scout' });
      sc.appendChild(h('div', { class: 'sec' }, ['🔍 スカウティング']));
      if (opp.style && OPP_STYLES[opp.style]) {
        sc.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['戦術傾向']), h('span', null, [OPP_STYLES[opp.style].n])]));
        sc.appendChild(h('div', { class: 'sub' }, [OPP_STYLES[opp.style].d]));
      }
      sc.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['相手の総合力']), h('span', null, [String(oppPower(mo.match))])]));
      if (opp.ace) {
        /* v0.18: 全校のエースに学年が付いた（帝都は従来から） */
        var aceLabel = opp.ace.name + '（' + (opp.ace.grade ? opp.ace.grade + '年・' : '') + opp.ace.pos + '）';
        sc.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['エース']), h('span', null, [aceLabel])]));
        sc.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['エースの特能']), h('span', null, [skillNameByKey(opp.ace.skill)])]));
      }
      /* v0.9: 帝都との因縁（通算対戦と前年の結果） */
      if (mo.match === 3 && G.rival) {
        sc.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['帝都との通算']), h('span', null, [G.rivalW + '勝 ' + G.rivalL + '敗'])]));
        sc.appendChild(h('div', { class: 'sub' }, [
          G.rivalLast === 'lose' ? '昨年は決勝でこの相手に敗れた。雪辱を果たす時だ' :
          G.rivalLast === 'win' ? '昨年はこの相手を破って花園へ。帝都は雪辱に燃えている' :
          G.rival.grade >= 3 ? 'エース ' + G.rival.name + ' は高校最後の冬。集大成の強さを見せてくるだろう' : '県決勝の常連。エースを中心に年々力をつけている'
        ]));
      }
      /* v0.18: 帝都以外の学校とも、通算対戦と現在の連勝・連敗（因縁の育ち）を出す */
      if (mo.match !== 3) {
        var orcP = (G.career.oppRec || {})[opp.name];
        if (orcP && orcP.p) {
          sc.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['通算対戦']), h('span', null, [orcP.w + '勝 ' + orcP.l + '敗'])]));
          var stPv = streakOf(opp.name), stPt = streakText(stPv);
          if (stPt) sc.appendChild(h('div', { class: 'sub' }, [stPt + (stPv <= -2 ? '。今日こそ雪辱を果たしたい' : stPv >= 2 ? '。相性の良さが自信になる' : '')]));
        }
      }
      /* v0.12: 弱点ヒント（内部データから導く具体的な狙い目を最大2つ） */
      var hints = scoutHints(opp);
      if (hints.length) {
        sc.appendChild(h('div', { class: 'sec' }, ['🎯 弱点ヒント']));
        hints.forEach(function (t) { sc.appendChild(h('div', { class: 'hint' }, ['・' + t])); });
      }
      vs.appendChild(sc);
    }
    /* v0.18: 両軍キーマンの対比カード（vs カードの内部スクロールに収める）。
     * 自軍キーマン＝相手エースと同じ部門（FW/BK）の先発で総合力トップの選手。
     * 相手エースの能力は aceStatsOf の表示専用数字（学校の総合力 oppPower から導出）で、ランク併記で見せる */
    if (opp.ace) {
      var kmBox = h('div', { class: 'keyman' });
      kmBox.appendChild(h('div', { class: 'sec' }, ['⚔ キーマン対比']));
      var aceGrp = (POSITIONS[opp.ace.posIdx] || POSITIONS[9]).g;
      var mine = null;
      starters().forEach(function (p) {
        if (POSITIONS[p.posIdx].g !== aceGrp) return;
        if (!mine || overall(p) > overall(mine)) mine = p;
      });
      if (!mine) starters().forEach(function (p) { if (!mine || overall(p) > overall(mine)) mine = p; });
      var aPow = oppPower(mo.match);
      var aSt = aceStatsOf(opp.ace, aPow);
      var aMain = (POSITIONS[opp.ace.posIdx] || POSITIONS[9]).main;
      var kmCols = h('div', { class: 'kmcols' });
      var mc = h('div', { class: 'kmcol' });
      mc.appendChild(h('div', { class: 'kmhead' }, ['桜丘高校']));
      if (mine) {
        var mMain = POSITIONS[mine.posIdx].main;
        mc.appendChild(portraitEl(mine, 'cand-p'));
        mc.appendChild(h('div', { class: 'kmname' }, [mine.name]));
        mc.appendChild(h('div', { class: 'sub' }, [POSITIONS[mine.posIdx].p + '・' + mine.year + '年']));
        mc.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['総合']), rankValEl(Math.round(overall(mine)), 'sm')]));
        mc.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, [STATS.filter(function (s) { return s.k === mMain; })[0].n]), rankValEl(Math.round(mine.stats[mMain]), 'sm')]));
        mc.appendChild(h('div', { class: 'sub' }, ['特能：' + (mine.skills && mine.skills.length ? mine.skills.map(skillNameByKey).join('・') : 'なし')]));
      }
      var oc = h('div', { class: 'kmcol' });
      oc.appendChild(h('div', { class: 'kmhead' }, [opp.name]));
      oc.appendChild(acePortraitEl(mo.match, opp.ace, 'cand-p'));
      oc.appendChild(h('div', { class: 'kmname' }, [opp.ace.name]));
      oc.appendChild(h('div', { class: 'sub' }, [opp.ace.pos + '・' + opp.ace.grade + '年']));
      oc.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, ['総合']), rankValEl(Math.round(aceOverallOf(opp.ace, aPow)), 'sm')]));
      oc.appendChild(h('div', { class: 'rowline' }, [h('span', { class: 'sub' }, [STATS.filter(function (s) { return s.k === aMain; })[0].n]), rankValEl(aSt[aMain], 'sm')]));
      oc.appendChild(h('div', { class: 'sub' }, ['特能：' + skillNameByKey(opp.ace.skill)]));
      kmCols.appendChild(mc);
      kmCols.appendChild(oc);
      kmBox.appendChild(kmCols);
      vs.appendChild(kmBox);
    }
    var box = h('div', { class: 'card choices grow scroll' });
    box.appendChild(h('div', { class: 'sec' }, ['今日の戦術']));
    TACTICS.forEach(function (tc) {
      box.appendChild(h('button', { class: 'btn choice' + (G.tactic === tc.k ? ' primary' : ''), onclick: function () { G.tactic = tc.k; save(); render(); } }, [
        h('span', { class: 't' }, [tc.n]), h('span', { class: 'd' }, [' — ' + tc.d])
      ]));
    });
    /* v0.16: PGキッカーとエースのマークマンの指名（任意・この試合限り）。キッカーの目安は段階表示（◎○△）のみで、成功率は数値で見せない */
    var prep = h('div', { class: 'card choices' });
    prep.appendChild(h('div', { class: 'sec' }, ['🦵 キッカー＆マーク（任意）']));
    prep.appendChild(h('label', { class: 'lab' }, ['PGキッカー（おまかせ時は自動で最適な選手が蹴る）']));
    var ksel = h('select', null, [h('option', { value: '' }, ['おまかせ'])]
      .concat(stNow.map(function (p) { return h('option', { value: String(p.id) }, [kickMark(p) + ' ' + p.name + '（' + POSITIONS[p.posIdx].p + '）']); })));
    ksel.value = selKickerId == null ? '' : String(selKickerId);
    ksel.onchange = function () { selKickerId = ksel.value === '' ? null : +ksel.value; };
    prep.appendChild(ksel);
    if (opp.ace) {
      prep.appendChild(h('label', { class: 'lab' }, ['エース ' + opp.ace.name + '（' + opp.ace.pos + '）へのマーク（抑える代わりに他が空く）']));
      var msel = h('select', null, [h('option', { value: '' }, ['マークしない'])]
        .concat(stNow.map(function (p) { return h('option', { value: String(p.id) }, [p.name + '（' + POSITIONS[p.posIdx].p + '）']); })));
      msel.value = selMarkId == null ? '' : String(selMarkId);
      msel.onchange = function () { selMarkId = msel.value === '' ? null : +msel.value; };
      prep.appendChild(msel);
    }
    var rightKids = [box, prep,
      h('button', { class: 'btn', onclick: function () { lineupSlot = null; screen = 'lineup'; render(); } }, ['👥 メンバー編成'])];
    if (canSkip(mo.match)) {
      rightKids.push(h('button', { class: 'btn', onclick: function () { skipMatch(mo.match); } }, ['⏩ 結果のみ表示（スキップ）']));
      rightKids.push(h('div', { class: 'sub' }, ['戦力差の大きい格下戦は、経過を省略して結果と勝因・敗因だけを確認できる（決勝・花園では使えない）']));
    }
    /* v0.11: 花園の大一番（初戦・決勝）だけ、雨のナイター写真を試合バナーにする。通常の試合は従来の SVG バナー */
    var matchBanner = mo.match >= 4 ? photoBanner('rain', 'pmb') : banner('match', 'pmb');
    wrap([hud(), h('div', { class: 'lay2' }, [
      col([matchBanner, vs]),
      col(rightKids)
    ]), actionBar([h('button', { class: 'btn primary', onclick: function () { startMatch(mo.match); } }, ['キックオフ'])])]);
  }
  /* v0.8: 停止点での交代パネル（右カラム・選択肢の下）。
   * 2タップ式：下げる選手 → 入れる選手。負傷交代は回数に数えない */
  function subPanelEl() {
    var box = h('div', { class: 'subbox' });
    var leftN = M.subsMax - M.subs;
    box.appendChild(h('div', { class: 'sec' }, ['🔁 選手交代（残り' + leftN + '回）']));
    M.knock.forEach(function (id) {
      var kp = G.players.filter(function (p) { return p.id === id; })[0];
      if (kp) box.appendChild(h('div', { class: 'subwarn' }, ['🚑 ' + kp.name + ' が負傷中。この選手の交代は回数に数えられない']));
    });
    var bench = G.players.filter(function (p) { return M.fieldIds.indexOf(p.id) < 0 && !p.injured; });
    if (leftN <= 0 && !M.knock.length) { box.appendChild(h('div', { class: 'sub' }, ['交代回数を使い切った'])); return box; }
    if (!bench.length) { box.appendChild(h('div', { class: 'sub' }, ['交代できる控えがいない'])); return box; }
    if (subOutId == null || M.fieldIds.indexOf(subOutId) < 0) {
      box.appendChild(h('div', { class: 'sub' }, ['まず下げる選手を選ぶ（疲労・調子を見て判断）']));
      var list = h('div', { class: 'sublist' });
      fieldPlayers().forEach(function (p) {
        var outKids = ['OUT ' + POSITIONS[p.posIdx].no + ' ' + p.name + '（疲労' + p.fatigue + '・', formFace(p), (M.knock.indexOf(p.id) >= 0 ? '・🚑負傷' : '') + '）'];
        var owe = warnEl(p); if (owe) outKids.push(owe); /* v0.16: 警告表示（疲労・不調・ケガ明け） */
        list.appendChild(h('button', { class: 'btn small subbtn', onclick: (function (pid) {
          return function () { subOutId = pid; render(); };
        })(p.id) }, outKids));
      });
      box.appendChild(list);
    } else {
      var outP = G.players.filter(function (p) { return p.id === subOutId; })[0];
      box.appendChild(h('div', { class: 'sub' }, [(outP ? outP.name : '―') + ' を下げる。入れる選手を選ぶ']));
      var list2 = h('div', { class: 'sublist' });
      bench.forEach(function (p) {
        var inKids = ['IN ' + POSITIONS[p.posIdx].p + ' ' + p.name + '（総合 ', rankValEl(Math.round(overall(p)), 'sm'), '・疲労' + p.fatigue + '・', formFace(p), '）'];
        var iwe = warnEl(p); if (iwe) inKids.push(iwe); /* v0.16: 警告表示 */
        list2.appendChild(h('button', { class: 'btn small subbtn', onclick: (function (pid) {
          return function () { doSub(subOutId, pid); };
        })(p.id) }, inKids));
      });
      box.appendChild(list2);
      box.appendChild(h('button', { class: 'btn small', onclick: function () { subOutId = null; render(); } }, ['交代をやめる']));
    }
    return box;
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
      /* v0.12: ハーフタイムは形勢サマリーを采配パネルにも出す（同じ内容は実況ログにも残る） */
      if (M.pending.kind === 'halftime' && M.htLines) {
        var ht = h('div', { class: 'htbox' });
        M.htLines.forEach(function (ln) { ht.appendChild(h('div', null, [ln])); });
        ctrl.appendChild(ht);
      }
      if (M.pending.key) ctrl.appendChild(h('div', { class: 'sub' }, ['キーマン：' + M.pending.key.name + '（' + POSITIONS[M.pending.key.posIdx].p + (skillNames(M.pending.key).length ? '・' + skillNames(M.pending.key).join('／') : '') + '）']));
      var box = h('div', { class: 'choices' });
      M.pending.choices.forEach(function (c, i) {
        box.appendChild(h('button', { class: 'btn choice', onclick: function () { chooseScene(i); } }, [
          h('span', { class: 't' }, [c.n]), h('span', { class: 'd' }, [' — ' + c.d + ' ']), h('span', { class: 'd nowrap' }, ['（成功率の目安 ' + Math.round(c.p * 100) + '%）'])
        ]));
      });
      ctrl.appendChild(box);
      ctrl.appendChild(subPanelEl());
    } else if (!M.done) {
      ctrl.appendChild(h('div', { class: 'sec' }, ['実況']));
      ctrl.appendChild(h('p', { class: 'sub' }, ['左の実況を見ながら、試合を進めよう。勝負どころでは采配が求められる']));
      ctrl.appendChild(h('button', { class: 'btn primary', onclick: function () { playBlock(); } }, ['試合を進める']));
    } else {
      ctrl.appendChild(h('div', { class: 'sec' }, [M.result === 'win' ? '勝利！ 勝因の内訳' : '試合終了：敗因の内訳']));
      if (M.gallant) ctrl.appendChild(h('p', null, ['🌟 格上に善戦！ 評判と経験のボーナスが入った']));
      if (M.factors) {
        /* v0.12: 相対バー表示。最大の要因を100%スケールにして降順＋色分けし、一目で主因が分かるようにする。
         * バーの % ラベルは従来どおり全体に占める割合（computeFactors の数値は無変更） */
        var fs = M.factors.map(function (f, i) { return { n: f.n, v: f.v, i: i }; }).sort(function (a, b) { return b.v - a.v; });
        var fmax = Math.max.apply(null, fs.map(function (f) { return f.v; }).concat([1]));
        fs.forEach(function (f, rank) {
          ctrl.appendChild(h('div', { class: 'frow' + (rank === 0 ? ' ftop' : '') }, [
            h('span', { class: 'flab' }, [f.n + (rank === 0 ? '（最大）' : '')]),
            h('span', { class: 'meter fmeter' }, [h('div', { style: 'width:' + Math.round(f.v / fmax * 100) + '%;background:' + FACTOR_COLORS[f.i] }, [])]),
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
    var leftKids = [];
    if (M.phase === 'scene' && M.pending && M.pending.key) {
      var kp = M.pending.key;
      var cut = h('div', { class: 'cutin' });
      cut.appendChild(portraitEl(kp, 'cutin-p'));
      cut.appendChild(h('div', null, [
        h('div', null, [h('b', null, [kp.name]), h('span', { class: 'sub' }, ['（' + POSITIONS[kp.posIdx].p + (skillNames(kp).length ? '・' + skillNames(kp).join('／') : '') + '）'])]),
        h('div', { class: 'cutin-line' }, ['「' + cutinLine(kp, M.pending.kind) + '」'])
      ]));
      leftKids.push(cut);
    }
    leftKids.push(log);
    wrap([sb, h('div', { class: 'lay2' }, [col(leftKids), col([ctrl])])]);
    var lg = document.querySelector('.log'); if (lg) lg.scrollTop = lg.scrollHeight;
  }
  function summaryScreen() {
    var s = G.summary;
    var result = h('div', { class: 'card center' }, [
      h('div', { class: 'big' }, [G.year + '年目のシーズン終了']),
      h('p', null, [s.result + '（' + s.wins + '勝 ' + s.losses + '敗）']),
      s.goalEval ? h('p', null, [s.goalEval.text]) : h('span', null, []),
      s.firstHana ? h('p', null, ['🎉 創部以来、初の花園出場！']) : h('span', null, []),
      h('div', { class: 'rowline' }, [h('span', null, ['部の格']), h('span', { class: 'big' }, [s.grade])]),
      h('div', { class: 'rowline' }, [h('span', null, ['通算 花園出場']), h('span', null, [G.career.hana + '回'])]),
      h('div', { class: 'rowline' }, [h('span', null, ['通算 花園優勝']), h('span', null, [G.career.hanaTitles + '回'])])
    ]);
    var g = h('div', { class: 'card grow scroll' });
    if (s.stars && s.stars.length) {
      g.appendChild(h('div', { class: 'sec' }, ['⭐ 今季の活躍']));
      s.stars.forEach(function (x) {
        g.appendChild(h('div', { class: 'rowline' }, [h('span', null, [x.name]), h('span', { class: 'sub' }, [x.pos + '・トライ ' + x.tries + '／好プレー ' + x.plays])]));
      });
    }
    g.appendChild(h('div', { class: 'sec' }, ['卒業する3年生（' + s.grads.length + '人）']));
    s.grads.forEach(function (x) {
      var gs = h('span', { class: 'sub' }, []);
      gs.appendChild(document.createTextNode(x.pos + '・総合 '));
      gs.appendChild(rankValEl(x.avg, 'sm')); /* v0.15: ランク併記 */
      g.appendChild(h('div', { class: 'rowline' }, [h('span', null, [x.name]), gs]));
    });
    g.appendChild(h('div', { class: 'sub' }, ['彼らはOBとして記録に残る。お疲れさま']));
    var nextBtn = h('button', { class: 'btn primary', onclick: function () { startRecruit(); } }, ['新年度へ（新入生を迎える）']);
    /* v0.11: 花園優勝の年は、優勝イラストを全面背景にした特別なエンディング表示にする */
    if (s.result && s.result.indexOf('花園優勝') >= 0) {
      result.classList.add('title-card');
      g.classList.add('title-card');
      var full = h('div', { class: 'photofull photo-champion' }, [
        h('div', { class: 'hero' }, [
          h('h1', null, ['🏆 花園優勝！']),
          h('p', null, ['桜丘高校が全国の頂点に立った ― ' + G.year + '年目のシーズン'])
        ]),
        h('div', { class: 'lay2' }, [col([result]), col([g])]),
        actionBar([nextBtn])
      ]);
      wrap([hud(), full]);
      return;
    }
    /* v0.11: 通常のシーズン終了は「卒業の日」イラストをヒーローに（卒業生の送り出しが主役の画面） */
    wrap([hud(), h('div', { class: 'lay2' }, [
      col([photoBanner('graduation', 'grow'), result]),
      col([g])
    ]), actionBar([nextBtn])]);
  }
  function candHead(p) {
    var d = h('div', { class: 'cand-head' });
    d.appendChild(portraitEl(p, 'cand-p'));
    d.appendChild(h('div', { style: 'flex:1;min-width:0' }, [
      h('div', { class: 'rowline' }, [
        h('span', { class: 'big' }, [p.name]),
        h('span', { class: 'sub' }, [POSITIONS[p.posIdx].p + ' ・ ' + p.year + '年 ・ ' + p.h + 'cm／' + p.w + 'kg'])
      ])
    ]));
    return d;
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
        var os = h('span', { class: 'sub' }, []);
        os.appendChild(document.createTextNode(o.pos + '・総合 '));
        os.appendChild(rankValEl(o.avg, 'sm')); /* v0.15: ランク併記 */
        leftKids.push(h('div', { class: 'rowline' }, [h('span', null, [o.name]), os]));
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
      col([list])
    ]), actionBar([h('button', { class: 'btn primary', onclick: function () { finishRecruit(); } }, ['新年度を始める'])])]);
  }
  function recordsScreen() {
    var c = h('div', { class: 'card grow scroll' });
    c.appendChild(h('div', { class: 'sec' }, ['監督の記録']));
    c.appendChild(h('div', { class: 'rowline' }, [h('span', null, ['在任']), h('span', null, [G.year + '年目'])]));
    c.appendChild(h('div', { class: 'rowline' }, [h('span', null, ['難易度']), h('span', null, [G.difficulty === 'challenge' ? 'チャレンジ' : 'ふつう'])]));
    c.appendChild(h('div', { class: 'rowline' }, [h('span', null, ['花園出場']), h('span', null, [G.career.hana + '回'])]));
    c.appendChild(h('div', { class: 'rowline' }, [h('span', null, ['花園での勝利']), h('span', null, [G.career.hanaWins + '勝'])]));
    c.appendChild(h('div', { class: 'rowline' }, [h('span', null, ['花園優勝']), h('span', null, [G.career.hanaTitles + '回'])]));
    if (G.rival) {
      c.appendChild(h('div', { class: 'rowline' }, [h('span', null, ['帝都学園との通算']), h('span', null, [G.rivalW + '勝 ' + G.rivalL + '敗'])]));
      c.appendChild(h('div', { class: 'rowline' }, [h('span', null, ['現在の帝都エース']), h('span', null, [G.rival.name + '（' + G.rival.grade + '年・' + G.rival.pos + '）'])]));
    }
    /* v0.9: 設備の解放状況 */
    c.appendChild(h('div', { class: 'sec' }, ['🏟 設備']));
    FACILITIES.forEach(function (f) {
      var has = hasFacility(f.k);
      c.appendChild(h('div', { class: 'rowline' }, [
        h('span', null, [(has ? '✓ ' : '🔒 ') + f.n]),
        h('span', { class: 'sub' }, [has ? '解放済み' : '部の格「' + GRADES[f.gi].n + '」で解放'])
      ]));
      c.appendChild(h('div', { class: 'sub' }, [f.d]));
    });
    /* v0.9: 歴代チーム（総合力ピークを「歴代最強」とする） */
    c.appendChild(h('div', { class: 'sec' }, ['📖 歴代チーム']));
    if (!G.history.length) c.appendChild(h('div', { class: 'sub' }, ['まだシーズンを終えていない']));
    var peak = G.history.reduce(function (a, hh) { return Math.max(a, hh.power); }, 0);
    G.history.slice().reverse().forEach(function (hh) {
      c.appendChild(h('div', { class: 'rowline' }, [
        h('span', null, [hh.year + '年目' + (hh.power === peak && peak > 0 ? ' 👑歴代最強' : '')]),
        h('span', { class: 'sub' }, ['総合力 ' + hh.power + '・' + hh.result])
      ]));
    });
    /* v0.14: シーズン別成績（これからのシーズンから蓄積。旧セーブは年・結果のみ復元され、他は「—」） */
    c.appendChild(h('div', { class: 'sec' }, ['📅 シーズン別成績']));
    var shs = (G.career.seasonHist || []).slice().reverse();
    if (!shs.length) c.appendChild(h('div', { class: 'sub' }, ['まだシーズンを終えていない']));
    shs.forEach(function (sh) {
      var bits = [sh.result,
        (typeof sh.w === 'number' && typeof sh.l === 'number') ? (sh.w + '勝 ' + sh.l + '敗') : '勝敗 —',
        '格：' + (sh.grade || '—'),
        sh.goal ? ('目標「' + sh.goal + '」' + (sh.goalOk ? '達成' : '未達')) : '目標 —'];
      c.appendChild(h('div', { class: 'rowline' }, [
        h('span', null, [sh.y + '年目']),
        h('span', { class: 'sub' }, [bits.join('・')])
      ]));
    });
    /* v0.14: 対戦校別の通算成績（帝都学園は因縁校として目立たせる）
     * v0.18: 現在の連勝・連敗と今のエースも併記する。因縁の 🔥 は帝都固定ではなく、
     * ストリークが3以上育った学校にも付く（ただし帝都は常時） */
    c.appendChild(h('div', { class: 'sec' }, ['⚔ 対戦校別成績']));
    OPPONENTS.forEach(function (op, oi) {
      var r = (G.career.oppRec || {})[op.name];
      var stR = streakOf(op.name);
      var aceNow = effOpp(oi).ace;
      var bits = [r && r.p ? (r.p + '戦 ' + r.w + '勝 ' + r.l + '敗') : '対戦なし'];
      var stT = streakText(stR); if (stT) bits.push(stT);
      if (aceNow) bits.push('現エース：' + aceNow.name + '（' + aceNow.grade + '年・' + aceNow.pos + '）');
      c.appendChild(h('div', { class: 'rowline' }, [
        h('span', null, [op.name + (op.name === '帝都学園' || Math.abs(stR) >= 3 ? ' 🔥因縁' : '')]),
        h('span', { class: 'sub' }, [bits.join('・')])
      ]));
    });
    /* v0.14: 歴代キャプテン（同じ選手は1行にまとめ、務めた年を併記） */
    c.appendChild(h('div', { class: 'sec' }, ['👑 歴代キャプテン']));
    var caps = G.career.captains || [];
    if (!caps.length) c.appendChild(h('div', { class: 'sub' }, ['まだ記録がない']));
    caps.forEach(function (cp) {
      c.appendChild(h('div', { class: 'rowline' }, [
        h('span', null, [cp.name]),
        h('span', { class: 'sub' }, ['就任：' + cp.years.map(function (y) { return y + '年目'; }).join('・') + (cp.grade ? '／就任時 ' + cp.grade + '年' : '')])
      ]));
    });
    /* v0.9: 現役選手のキャリア通算トップ5 */
    c.appendChild(h('div', { class: 'sec' }, ['🏉 通算スタッツ（現役）']));
    var tops = G.players.slice().filter(function (p) { return p.crec && (p.crec.tries > 0 || p.crec.plays > 0); })
      .sort(function (a, b) { return (b.crec.tries * 3 + b.crec.plays) - (a.crec.tries * 3 + a.crec.plays); }).slice(0, 5);
    if (!tops.length) c.appendChild(h('div', { class: 'sub' }, ['まだ記録がない']));
    tops.forEach(function (p) {
      c.appendChild(h('div', { class: 'rowline' }, [
        h('span', null, [p.name]),
        h('span', { class: 'sub' }, [POSITIONS[p.posIdx].p + '・トライ ' + p.crec.tries + '／好プレー ' + p.crec.plays])
      ]));
    });
    /* v0.10: 実績（トロフィー）一覧。達成済みは色つき、未達成は条件のみ表示 */
    c.appendChild(h('div', { class: 'sec' }, ['🏆 実績（トロフィー）']));
    var achvGot = ACHIEVEMENTS.filter(function (a) { return G.career.achv && G.career.achv[a.id]; }).length;
    c.appendChild(h('div', { class: 'sub' }, ['達成 ' + achvGot + ' / ' + ACHIEVEMENTS.length + ' ― 監督キャリアを通じて集まる勲章']));
    ACHIEVEMENTS.forEach(function (a) {
      var yr = G.career.achv ? G.career.achv[a.id] : null;
      c.appendChild(h('div', { class: 'rowline achv' + (yr ? ' got' : '') }, [
        h('span', null, [(yr ? '🏆 ' : '🔒 ') + a.n + (yr ? '（' + yr + '年目に達成）' : '')]),
        h('span', { class: 'sub' }, [a.d])
      ]));
    });
    var o = h('div', { class: 'card scroll', style: 'height:100%' });
    o.appendChild(h('div', { class: 'sec' }, ['OB名鑑（' + G.obs.length + '人）']));
    if (!G.obs.length) o.appendChild(h('div', { class: 'sub' }, ['まだ卒業生がいない']));
    G.obs.slice().reverse().forEach(function (x) {
      /* v0.14: 名鑑に進路と最終能力（6能力）も出す。旧 OB（v0.14 以前の卒業生）は不明項目を「—」にする */
      /* v0.15: OB の総合と最終能力もランク併記に統一する */
      var obHead = h('span', { class: 'sub' }, []);
      obHead.appendChild(document.createTextNode(x.pos + '・' + x.year + '年卒・総合 '));
      obHead.appendChild(rankValEl(x.avg, 'sm'));
      obHead.appendChild(document.createTextNode('・進路 ' + (x.path || '—')));
      o.appendChild(h('div', { class: 'rowline' }, [h('span', null, [x.name]), obHead]));
      var stLine = h('div', { class: 'sub obstats' }, []);
      if (x.st && typeof x.st === 'object' && !Array.isArray(x.st)) {
        STATS.forEach(function (s, si) {
          if (si) stLine.appendChild(document.createTextNode('・'));
          stLine.appendChild(document.createTextNode(s.n + ' '));
          if (typeof x.st[s.k] === 'number') stLine.appendChild(rankValEl(x.st[s.k], 'sm'));
          else stLine.appendChild(document.createTextNode('—'));
        });
      } else stLine.appendChild(document.createTextNode('最終能力 —'));
      if ((x.tries || 0) > 0) stLine.appendChild(document.createTextNode('／トライ ' + x.tries));
      if ((x.plays || 0) > 0) stLine.appendChild(document.createTextNode('／好プレー ' + x.plays));
      o.appendChild(stLine);
    });
    wrap([hud(), h('div', { class: 'lay2' }, [col([c]), o]),
      h('button', { class: 'btn', onclick: function () { screen = G.recruit ? 'recruit' : (G.board ? 'board' : 'inst'); render(); } }, ['戻る'])
    ]);
  }

  /* ---------------- 起動 ---------------- */
  if (!loadSaved()) G = null;
  if (G) { sanitize(); save(); showDigest = true; } /* マイグレーション結果を即永続化／v0.10: 再開時はあらすじを1回出す */
  if (G && G.recruit) screen = 'recruit';
  else if (G && G.board) screen = 'board';
  else if (G && G.summary) screen = 'summary';
  else if (G && !G.goalSet && G.monthIdx === 0) screen = 'goal';
  else if (G) screen = 'inst';
  render();
})();
