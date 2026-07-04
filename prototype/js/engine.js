/* ============================================================
 * 楼兰 · 丝路物语 —— 游戏引擎
 * 时间循环 / 贸易 / 旅途事件 / 人生转折 / 离场模拟 / 结算
 * ============================================================ */

const SEASONS = ['春', '夏', '秋', '冬'];
const END_YEAR = 15;
const CAPACITY = 60;
const DRAMA_CAP_PER_YEAR = 2;

let S = null; // 全局游戏状态（纯数据，可序列化）

/* ── 工具 ── */
const rnd = (n) => Math.floor(Math.random() * n);
const chanceRoll = (p) => Math.random() < p;
const pick = (arr) => arr[rnd(arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const cityById = (id) => CITIES.find((c) => c.id === id);
const goodById = (id) => GOODS.find((g) => g.id === id);
const charById = (id) => S.chars[id];
const caravanChars = () => Object.values(S.chars).filter((c) => c.inCaravan);
const hasFlag = (c, f) => c.lifeFlags.includes(f);
const addFlag = (c, f) => { if (!hasFlag(c, f)) c.lifeFlags.push(f); };
const cargoCount = () => Object.values(S.cargo).reduce((a, b) => a + b, 0);
const routeBetween = (a, b) => ROUTES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));

function bestGuide() {
  return caravanChars().reduce((m, c) => Math.max(m, c.skills.guide || 0), 0);
}

/* ── 初始化 ── */
function initGame() {
  S = {
    year: 1, season: 0, money: 600,
    location: 'dunhuang', traveling: null,
    cargo: { silk: 0, tea: 0, jade: 0, spice: 0, carpet: 0, brocade: 0 },
    prices: {}, chars: {}, stories: [], codexStories: [],
    recipes: [], echoHooks: [], firedRules: [], firedCityEvents: [],
    rep: { dunhuang: 0, loulan: 0, khotan: 0 },
    craftBond: 0, nightTravel: false, loulanDecay: false,
    dramaThisYear: 0, moneyAtYearStart: 600,
    yearEvents: [], visited: ['dunhuang'],
    stats: { trips: 0, turnings: 0, reunions: 0, storiesTold: 0, southRoute: false },
    over: false, busy: false,
  };
  CHAR_DEFS.forEach((d) => {
    S.chars[d.id] = JSON.parse(JSON.stringify(d));
    const c = S.chars[d.id];
    c.lifeFlags = [];
    c.departed = false;
    c.history = [{ year: 0, text: c.bio }];
  });
  CITIES.forEach((city) => {
    S.prices[city.id] = {};
    GOODS.forEach((g) => { S.prices[city.id][g.id] = BASE_PRICES[city.id][g.id]; });
  });
  driftPrices();
}

/* ── 价格 ── */
function driftPrices() {
  CITIES.forEach((city) => {
    GOODS.forEach((g) => {
      const base = BASE_PRICES[city.id][g.id];
      let mult = 0.85 + Math.random() * 0.45; // 0.85 ~ 1.30
      if (city.id === 'loulan' && S.loulanDecay) mult *= 0.8; // 楼兰衰落：物价萎缩
      S.prices[city.id][g.id] = Math.max(3, Math.round(base * mult));
    });
  });
}

/* ── 贸易 ── */
function buyGood(id, n) {
  const price = S.prices[S.location][id];
  n = Math.min(n, Math.floor(S.money / price), CAPACITY - cargoCount());
  if (n <= 0) return false;
  S.money -= price * n;
  S.cargo[id] += n;
  return true;
}
function sellGood(id, n) {
  n = Math.min(n, S.cargo[id]);
  if (n <= 0) return false;
  S.money += S.prices[S.location][id] * n;
  S.cargo[id] -= n;
  return true;
}
function craftBrocade() {
  if (!S.recipes.includes('brocade')) return false;
  if (S.cargo.silk < 2 || S.cargo.spice < 1) return false;
  S.cargo.silk -= 2; S.cargo.spice -= 1; S.cargo.brocade += 1;
  return true;
}

/* ── 故事 ── */
function gainStory(log) {
  const owned = S.stories.map((s) => s.id);
  const cands = STORY_DEFS.filter((d) => !owned.includes(d.id));
  if (!cands.length) { log && log('旅人讲的故事你早已听过——看来你已经是半个说书人了。'); return null; }
  const d = pick(cands);
  S.stories.push({ id: d.id, told: false });
  if (!S.codexStories.includes(d.id)) S.codexStories.push(d.id);
  log && log(`📖 收集到故事《${d.name}》：${d.text}`);
  return d;
}
function tellableStories() {
  return S.stories.filter((s) => !s.told && STORY_DEFS.find((d) => d.id === s.id).origin !== S.location);
}
function tellStory(storyId) {
  const inst = S.stories.find((s) => s.id === storyId && !s.told);
  if (!inst) return null;
  const d = STORY_DEFS.find((x) => x.id === storyId);
  const far = (d.origin === 'dunhuang' && S.location === 'khotan') || (d.origin === 'khotan' && S.location === 'dunhuang');
  const gain = Math.round(d.value * (far ? 1.6 : 1));
  inst.told = true;
  S.money += gain;
  S.rep[S.location] += 2;
  S.stats.storiesTold += 1;
  return { name: d.name, gain };
}
function consumeStoryForBribe() {
  const inst = S.stories.find((s) => !s.told);
  if (!inst) return null;
  inst.told = true;
  return STORY_DEFS.find((d) => d.id === inst.id).name;
}

/* ── 事件效果执行 ── */
function applyResult(res, log) {
  if (res.moneyLoss) { S.money = Math.max(0, S.money - res.moneyLoss); }
  if (res.cargoLossRatio) {
    GOODS.forEach((g) => {
      const lost = Math.round(S.cargo[g.id] * res.cargoLossRatio);
      S.cargo[g.id] -= lost;
    });
  }
  caravanChars().forEach((c) => {
    if (res.moodAll) c.mood = clamp(c.mood + res.moodAll, 0, 100);
    if (res.healthAll) c.health = clamp(c.health + res.healthAll, 0, 100);
    if (res.flagAll) addFlag(c, res.flagAll);
    if (res.bondAll) c.mood = clamp(c.mood + 2, 0, 100);
  });
  if (res.flagChar) { const c = charById(res.flagChar[0]); if (c && c.inCaravan) addFlag(c, res.flagChar[1]); }
  if (res.charMood) { const c = charById(res.charMood[0]); if (c) c.mood = clamp(c.mood + res.charMood[1], 0, 100); }
  if (res.healthChar) { const c = charById(res.healthChar[0]); if (c) c.health = clamp(c.health + res.healthChar[1], 0, 100); }
  if (res.bondPair) {
    const both = res.bondPair.every((id) => charById(id) && charById(id).inCaravan);
    if (both) S.craftBond += 1;
  }
  if (res.gainStory) gainStory(log);
  if (res.useStory) { const n = consumeStoryForBribe(); if (n) log(`（讲掉了故事《${n}》）`); }
  if (res.swap) {
    const [from, to, n] = res.swap;
    if (S.cargo[from] >= n) { S.cargo[from] -= n; S.cargo[to] += n; }
  }
  if (res.priceTip) {
    const other = pick(CITIES.filter((c) => c.id !== S.location));
    let best = GOODS[0];
    GOODS.forEach((g) => { if (S.prices[other.id][g.id] > S.prices[other.id][best.id]) best = g; });
    log(`💡 打听到行情：${other.name}的${best.name}正卖高价（约 ${S.prices[other.id][best.id]} 银钱）。`);
  }
  if (res.recruit) {
    const c = charById(res.recruit);
    c.hidden = false; c.inCaravan = true; c.city = null;
    c.history.push({ year: S.year, text: `${S.year} 年，因${res.turning ? '玉市萧条' : '机缘'}加入商队。` });
    if (res.turning) { S.stats.turnings += 1; S.yearEvents.push(`${c.name}因世事变迁加入了商队。`); }
  }
  if (res.log) log(res.log);
}

/* ============================================================
 * 人生转折规则表 —— 8 条（对应设计文档 03 的六大类别）
 * ============================================================ */
const LIFE_RULES = [
  {
    /* ① 天灾劫后：劫后皈依 */
    id: 'tp_monk', once: true, yearEnd: false,
    candidate: () => charById('tiemuer'),
    check: (c) => c.inCaravan && hasFlag(c, 'sandstorm_survivor') && c.personality.faith > 40 && cityById(S.location) && cityById(S.location).hasTemple,
    chance: () => 0.55,
    card: (c) => ({
      title: '人生卡片 · 劫后皈依', tag: '天灾劫后',
      text: `自那场沙暴之后，${c.name}常常一个人望着佛寺的方向发呆。\n这天他找到你，声音很轻："那晚风里，我听见了钟声。我想留下来，出家修行。"\n他的骆驼"雪蹄"，他想托付给商队。`,
      options: [
        { id: 'stay', text: '恳切挽留："商队不能没有你。"' },
        { id: 'fund', text: '资助他修行（100 银钱），全了这份缘' },
        { id: 'letgo', text: '默默帮他收拾行装，送他到寺门口' },
      ],
    }),
    resolve(c, choice, log) {
      if (choice === 'stay' && chanceRoll(0.4)) {
        c.mood = clamp(c.mood - 15, 0, 100);
        c.history.push({ year: S.year, text: `${S.year} 年，曾动念出家，被劝留。心里始终留着一口钟声。` });
        log(`${c.name}沉默了很久，最后点了点头。他留下了，但夜里守营时，总朝着寺的方向坐。`);
        return;
      }
      if (choice === 'fund') S.money = Math.max(0, S.money - 100);
      departChar(c, S.location, 'monk',
        `${S.year} 年，沙暴劫后皈依佛门，于${cityById(S.location).name}佛寺剃度，法号"释安"。`);
      S.rep[S.location] += choice === 'fund' ? 8 : 3;
      gainStory(log);
      log(`${c.name}在寺门前回头，朝商队深深一揖。${choice === 'stay' ? '你终究没能留住他——有些路，人只能自己走。' : ''}驼铃再响时，队里少了一个人，多了一个故事。`);
    },
  },
  {
    /* ② 文化触动：乐音入梦 */
    id: 'tp_musician', once: true, yearEnd: false,
    candidate: () => charById('aisha'),
    check: (c) => c.inCaravan && hasFlag(c, 'heard_khotan_music') && c.personality.curiosity > 65 && S.location === 'khotan',
    chance: () => 0.5,
    card: (c) => ({
      title: '人生卡片 · 乐音入梦', tag: '文化触动',
      text: `自听过玉河乐会，${c.name}夜夜抱着母亲留下的琵琶练到三更。\n这天她红着眼睛来找你："乐坊的师父说我有天分，肯收我。\n我想留在于阗学乐……可商队待我恩重，我说不出口。"`,
      options: [
        { id: 'stay', text: '挽留："再跟商队走两年，如何？"' },
        { id: 'fund', text: '替她付清拜师礼（100 银钱）' },
        { id: 'letgo', text: '"去吧。哪天你的曲子传到敦煌，就是我们商队的骄傲。"' },
      ],
    }),
    resolve(c, choice, log) {
      if (choice === 'stay' && chanceRoll(0.35)) {
        c.mood = clamp(c.mood - 20, 0, 100);
        c.history.push({ year: S.year, text: `${S.year} 年，忍痛推却了乐坊的邀约，随商队继续西行。` });
        log(`${c.name}低头应了。那晚的琵琶声，断断续续，像下不完的雨。`);
        return;
      }
      if (choice === 'fund') S.money = Math.max(0, S.money - 100);
      departChar(c, 'khotan', 'musician',
        `${S.year} 年，在于阗拜师学乐，抱着母亲的琵琶开始了另一种人生。`);
      gainStory(log);
      log(`送别那天，${c.name}在城门口弹了一曲。曲子没有名字——她说，等学成了，就叫它《驼铃》。`);
    },
  },
  {
    /* ③ 牵挂拉力：归乡之心 */
    id: 'tp_homesick', once: true, yearEnd: false,
    candidate: () => charById('yungu'),
    check: (c) => c.inCaravan && c.mood < 55 && S.year >= 4 && S.location === 'dunhuang',
    chance: () => 0.45,
    card: (c) => ({
      title: '人生卡片 · 归乡之心', tag: '牵挂拉力',
      text: `回到敦煌，${c.name}去看了老家的织坊——门板歪了，机杼上落满沙土。\n她回来时眼圈红红的："爹娘老了，织坊撑不住了。\n我想回家，把织坊重新开起来。"`,
      options: [
        { id: 'stay', text: '劝她："织坊可以雇人，商队缺不了你。"' },
        { id: 'fund', text: '出 100 银钱，帮织坊修屋添机' },
        { id: 'letgo', text: '"回去吧。等你的锦织出来，我第一个来买。"' },
      ],
    }),
    resolve(c, choice, log) {
      if (choice === 'stay' && chanceRoll(0.4)) {
        c.mood = clamp(c.mood + 5, 0, 100);
        c.history.push({ year: S.year, text: `${S.year} 年，动过归乡的念头，终究又背起了行囊。` });
        log(`${c.name}想了一夜，第二天还是上了驼。只是路过织坊时，她多看了两眼。`);
        return;
      }
      if (choice === 'fund') S.money = Math.max(0, S.money - 100);
      departChar(c, 'dunhuang', 'home',
        `${S.year} 年，回敦煌重开家中织坊${choice === 'fund' ? '（商队资助了修缮）' : ''}。`);
      log(`${c.name}留下一小段亲手织的锦，说："想我了就看看它。"织坊的灯，当晚就亮了。`);
    },
  },
  {
    /* ⑤ 队内羁绊：百日同行，织音成锦 */
    id: 'tp_recipe', once: true, yearEnd: false,
    candidate: () => charById('yungu'),
    check: (c) => c.inCaravan && charById('aisha').inCaravan && S.craftBond >= 2 && !S.recipes.includes('brocade'),
    chance: () => 0.7,
    card: (c) => ({
      title: '人生卡片 · 织音成锦', tag: '队内羁绊',
      text: `篝火边合计了不知多少个夜晚，云姑和阿依莎突然同时跳了起来——\n"把琵琶曲的调子织成晕色！丝绸打底，用香料染出层层渐变！"\n两个姑娘手舞足蹈，像是发现了宝藏。这也许真是一门独门生意。`,
      options: [
        { id: 'fund', text: '太妙了！出 50 银钱置办染具，试！' },
        { id: 'letgo', text: '鼓励她们先小试一匹看看' },
      ],
    }),
    resolve(c, choice, log) {
      if (choice === 'fund') S.money = Math.max(0, S.money - 50);
      S.recipes.push('brocade');
      c.career = '锦缎大家';
      c.history.push({ year: S.year, text: `${S.year} 年，与阿依莎共创"晕染锦"技法，织工成了开宗立派的锦缎大家。` });
      charById('aisha').history.push({ year: S.year, text: `${S.year} 年，与云姑共创"晕染锦"——琵琶曲的调子，织进了锦缎里。` });
      S.stats.turnings += 1;
      S.yearEvents.push('云姑与阿依莎共创了"晕染锦"技法！（货物页可用 2 丝绸+1 香料合成）');
      log(`🎉 新配方【晕染锦】诞生！文化在商队的篝火边完成了一次融合。（城市中可在货物页合成：2 丝绸 + 1 香料 → 1 晕染锦）`);
    },
  },
  {
    /* ⑥ 岁月自然：老骥归山（年末结算触发） */
    id: 'tp_retire', once: true, yearEnd: true,
    candidate: () => charById('laozhou'),
    check: (c) => c.inCaravan && c.age >= 58,
    chance: () => 0.8,
    card: (c) => ({
      title: '人生卡片 · 老骥归山', tag: '岁月自然',
      text: `年关围炉，老周喝了两碗酒，忽然说："我这把老骨头，颠不动喽。\n开春想回敦煌，寻个小院，种两架葡萄。"\n火光里，他鬓角全白了。你才想起，他跟了商队这么多年。`,
      options: [
        { id: 'fund', text: '奉上一份厚厚的养老钱（150 银钱）' },
        { id: 'letgo', text: '斟满酒："这些年，辛苦您了。"' },
      ],
    }),
    resolve(c, choice, log) {
      if (choice === 'fund') { S.money = Math.max(0, S.money - 150); S.rep.dunhuang += 6; }
      departChar(c, 'dunhuang', 'retire',
        `${S.year} 年，年老还乡，在敦煌城郊置了小院，种葡萄，晒太阳。`);
      log(`开春，老周牵着他那峰老骆驼回了敦煌。走前他把三十年的路图留给了商队："井的位置都在上头，别走岔了。"`);
    },
  },
  {
    /* 天灾劫后·拜师：崖边之后 */
    id: 'tp_guide_apprentice', once: true, yearEnd: false,
    candidate: () => charById('yungu'),
    check: (c) => c.inCaravan && hasFlag(c, 'rescued_on_cliff') && charById('laozhou').inCaravan,
    chance: () => 0.6,
    auto: true,
    resolve(c, _choice, log) {
      c.skills.guide = (c.skills.guide || 0) + 1;
      if (!c.hobbies.includes('认路')) c.hobbies.push('认路');
      c.history.push({ year: S.year, text: `${S.year} 年，崖边被老周所救，此后拜他为师学认路。织锦的手，也开始画路图了。` });
      S.stats.turnings += 1;
      S.yearEvents.push('云姑拜老周为师，学起了认路（商队向导能力提升）。');
      log(`自那次崖边脱险，云姑总跟在老周身边问东问西。老织工多了一门新手艺——认路。人的爱好，就是这样被一次命悬一线改变的。`);
    },
  },
  {
    /* 星象痴：夜观星河 */
    id: 'tp_stargazer', once: true, yearEnd: false,
    candidate: () => caravanChars().find((c) => hasFlag(c, 'stargazer_night') && c.personality.curiosity >= 60 && !c.hobbies.includes('认星星')),
    check: (c) => !!c,
    chance: () => 0.55,
    auto: true,
    resolve(c, _choice, log) {
      c.hobbies.push('认星星');
      c.history.push({ year: S.year, text: `${S.year} 年，迷上了观星，学会了以星辰辨路。` });
      S.nightTravel = true;
      S.stats.turnings += 1;
      S.yearEvents.push(`${c.name}迷上了观星——商队从此可借星光夜行，避开白日风沙（沙暴更少遇到）。`);
      log(`🌌 ${c.name}整夜整夜地看星星，竟真琢磨出了以星辨路的门道。商队解锁【夜行】：沙暴遭遇大减。`);
    },
  },
];
/* 第 ④ 条（世事变迁·玉市萧条）以城市事件形式实现，见 data.js CITY_EVENTS */

/* ── 离队 ── */
function departChar(c, cityId, kind, historyText) {
  c.inCaravan = false;
  c.departed = true;
  c.city = cityId;
  c.departedKind = kind;
  c.departYear = S.year;
  c.history.push({ year: S.year, text: historyText });
  S.echoHooks.push({ city: cityId, charId: c.id, kind, fired: false });
  S.stats.turnings += 1;
  S.yearEvents.push(`${c.name} 离开了商队：${historyText}`);
  if (kind === 'monk') c.career = '僧侣';
  if (kind === 'musician') c.career = '乐师学徒';
  if (kind === 'home') c.career = '织坊主人';
  if (kind === 'retire') c.career = '归老田园';
}

/* ── 人生结算（每季末扫描） ── */
async function lifeScan(atYearEnd) {
  for (const rule of LIFE_RULES) {
    if (S.dramaThisYear >= DRAMA_CAP_PER_YEAR) break;
    if (rule.once && S.firedRules.includes(rule.id)) continue;
    if (!!rule.yearEnd !== !!atYearEnd) continue;
    const c = rule.candidate();
    if (!c || !rule.check(c)) continue;
    if (!chanceRoll(rule.chance(c))) continue;

    S.firedRules.push(rule.id);
    S.dramaThisYear += 1;
    if (rule.auto) {
      rule.resolve(c, null, UI.log);
      UI.refresh();
    } else {
      const cardDef = rule.card(c);
      const choice = await UI.showLifeCard(cardDef);
      rule.resolve(c, choice, UI.log);
      UI.refresh();
    }
  }
}

/* ── 离场角色的简化模拟（每年一次） ── */
const OFFSCREEN_TABLES = {
  monk: ['在佛寺扫地担水，抄经的手渐渐稳了。', '开始为过往商旅祈福医病，寺里香火多了几分。', '已能登坛讲经，人称"驼铃法师"。', '在寺壁画了一幅商队图，说是纪念前半生。'],
  musician: ['在乐坊里从最苦的基本功练起。', '新曲《驼铃》在于阗的茶肆间传开了。', '成了玉河乐会的座上乐师，弹琵琶时总闭着眼。', '开始收学生了，教的第一支曲子还是《驼铃》。'],
  home: ['把织坊里外翻修了一遍，机杼声重新响起。', '织坊的锦在敦煌市集上有了名气。', '带出了几个好徒弟，织坊挂出了新招牌。', '她织的"驼队晚照"锦，据说被官府买去进贡了。'],
  retire: ['在院里搭好了葡萄架，每天给老骆驼梳毛。', '收了个机灵的少年做关门徒弟，名叫小满。', '常坐在城门口茶摊，给年轻驼夫讲路上的井在哪儿。', '把一生走过的路画成了一幅图，挂在堂屋正中。'],
};
function offscreenSim() {
  Object.values(S.chars).forEach((c) => {
    if (!c.departed) return;
    const idx = S.year - c.departYear;
    const table = OFFSCREEN_TABLES[c.departedKind];
    if (!table || idx < 0 || idx >= table.length) return;
    c.history.push({ year: S.year, text: `${S.year} 年，${table[idx]}` });
    if (c.departedKind === 'retire' && idx === 1) {
      charById('xiaoman').hidden = false;
      S.echoHooks.push({ city: 'dunhuang', charId: 'xiaoman', kind: 'apprentice', fired: false });
      S.yearEvents.push('听说老周在敦煌收了个徒弟，叫小满。');
    }
  });
}

/* ── 重逢（命运回响） ── */
async function checkReunions() {
  const hooks = S.echoHooks.filter((h) => h.city === S.location && !h.fired);
  for (const h of hooks) {
    h.fired = true;
    const c = charById(h.charId);
    const recent = c.history[c.history.length - 1].text;
    S.stats.reunions += 1;
    if (h.kind === 'monk') {
      caravanChars().forEach((x) => { x.health = clamp(x.health + 15, 0, 100); x.mood = clamp(x.mood + 5, 0, 100); });
      S.rep[S.location] += 5;
      await UI.showModal({
        title: `重逢 · ${c.name}`, tag: '命运回响',
        text: `佛寺里，一个熟悉的身影正在扫院子。是${c.name}——如今的释安师父。\n（${recent}）\n他为商队每个人诵了一遍平安经，又拿出寺里的伤药："路上用得着。"\n【全员恢复体力，${cityById(S.location).name}声望+5】`,
        options: [{ id: 'ok', text: '合十道别："后会有期。"' }],
      });
      UI.log(`在${cityById(S.location).name}佛寺与${c.name}重逢。全员体力+15。`);
    } else if (h.kind === 'musician') {
      S.money += 80;
      caravanChars().forEach((x) => { x.mood = clamp(x.mood + 8, 0, 100); });
      await UI.showModal({
        title: `重逢 · ${c.name}`, tag: '命运回响',
        text: `乐坊传来一支陌生又熟悉的曲子——《驼铃》。\n（${recent}）\n一曲终了，${c.name}从台上跑下来，眼睛还是当年那么亮。她把这场演出的赏钱塞给你："本钱是商队给的，分红得认账！"\n【获得 80 银钱，全员心情+8】`,
        options: [{ id: 'ok', text: '收下："下次的新曲，先弹给商队听。"' }],
      });
      UI.log(`听了${c.name}的《驼铃》，收到分红 80 银钱。`);
    } else if (h.kind === 'home') {
      const gift = S.recipes.includes('brocade') ? 'brocade' : 'silk';
      S.cargo[gift] += gift === 'brocade' ? 1 : 3;
      await UI.showModal({
        title: `重逢 · ${c.name}`, tag: '命运回响',
        text: `织坊的机杼声老远就听见了。${c.name}系着围裙迎出来，非要留商队吃饭。\n（${recent}）\n临走她往驼袋里塞了自家的织物："拿去卖，别客气——没有商队，就没有这间织坊。"`,
        options: [{ id: 'ok', text: '"你织的锦，走到哪儿我们都替你吆喝。"' }],
      });
      UI.log(`探望了${c.name}的织坊，收到她亲手织的${gift === 'brocade' ? '晕染锦' : '丝绸'}。`);
    } else if (h.kind === 'retire') {
      caravanChars().forEach((x) => { x.mood = clamp(x.mood + 6, 0, 100); });
      await UI.showModal({
        title: `重逢 · ${c.name}`, tag: '命运回响',
        text: `城郊小院，葡萄架下，老周眯着眼晒太阳，那峰老骆驼卧在墙根。\n（${recent}）\n他拉着你说了一下午的路——哪口井甜，哪段道邪。走时他挥挥手："驼铃响着，我就放心。"`,
        options: [{ id: 'ok', text: '"您的路图，商队一直带着。"' }],
      });
      UI.log(`去敦煌城郊看了老周。全员心情+6。`);
    } else if (h.kind === 'apprentice') {
      const choice = await UI.showModal({
        title: '师父的托付', tag: '命运回响',
        text: `一个少年在城门口拦住商队，脆生生地喊："可是当年老周师父带过的商队？\n师父说，他认得的路都教给我了，让我来投奔你们！"\n少年叫小满，眼睛亮得像大漠的星星。`,
        options: [
          { id: 'yes', text: '收下！"老周的徒弟，就是自家人。"' },
          { id: 'no', text: '婉拒："商队眼下人手够了。"' },
        ],
      });
      if (choice === 'yes') {
        const x = charById('xiaoman');
        x.inCaravan = true; x.city = null;
        x.history.push({ year: S.year, text: `${S.year} 年，奉师命加入商队，接过了老周的路图。` });
        S.yearEvents.push('小满加入商队——老周的路，有人接着走了。');
        UI.log('👦 小满加入了商队！师徒两代，一条路。');
      } else {
        UI.log('小满蔫蔫地走了。也许他会在别的商队找到自己的路。');
      }
    }
    UI.refresh();
  }
}

/* ── 城市事件 ── */
async function checkCityEvents() {
  for (const ev of CITY_EVENTS) {
    if (ev.city !== S.location) continue;
    if (ev.once && S.firedCityEvents.includes(ev.id)) continue;
    if (ev.minYear && S.year < ev.minYear) continue;
    if (ev.id === 'cev_khotan_music' && charById('aisha') && hasFlag(charById('aisha'), 'heard_khotan_music')) continue;
    if (ev.recruitGuard && !charById(ev.recruitGuard).hidden) continue;
    if (!chanceRoll(ev.chance)) continue;
    if (ev.once) S.firedCityEvents.push(ev.id);
    const choiceIdx = await UI.showModal({
      title: ev.name, tag: cityById(ev.city).name,
      text: ev.text,
      options: ev.choices.map((c, i) => ({ id: String(i), text: c.text })),
    });
    const choice = ev.choices[Number(choiceIdx)];
    applyResult(choice.result || {}, UI.log);
    if (choice.recruit) applyResult({ recruit: choice.recruit, turning: choice.result && choice.result.turning }, UI.log);
    UI.refresh();
  }
}

/* ── 旅途 ── */
async function travelTo(dest) {
  if (S.busy || S.over) return;
  const route = routeBetween(S.location, dest);
  if (!route) return;
  if (S.money < route.cost) { UI.log(`补给不足：走${route.name}需要 ${route.cost} 银钱。`); return; }
  S.busy = true;
  S.money -= route.cost;
  const from = S.location;
  S.traveling = { from, to: dest };
  S.location = null;
  UI.log(`🐪 商队踏上${route.name}，向${cityById(dest).name}进发（补给 -${route.cost}）。`);
  UI.refresh();
  await UI.travelAnim(from, dest);

  /* 旅途事件：风险高的路遇事更多 */
  const nEvents = route.risk >= 2 ? 2 : 1;
  for (let i = 0; i < nEvents; i++) {
    let pool = TRAVEL_EVENTS.filter((e) => route.risk >= e.minRisk);
    if (S.nightTravel) pool = pool.filter((e) => e.id !== 'ev_sandstorm' || chanceRoll(0.3));
    if (route.risk < 2) pool = pool.filter((e) => e.id !== 'ev_snowpass');
    /* 事件里点名的角色不在队中时，剔除该事件 */
    if (!charById('tiemuer').inCaravan) pool = pool.filter((e) => e.id !== 'ev_sickcamel');
    if (!charById('yungu').inCaravan || !charById('laozhou').inCaravan) pool = pool.filter((e) => e.id !== 'ev_snowpass');
    if (!charById('aisha').inCaravan || !charById('yungu').inCaravan) pool = pool.filter((e) => e.id !== 'ev_campfire');
    const bag = [];
    pool.forEach((e) => { for (let k = 0; k < e.weight; k++) bag.push(e); });
    const ev = pick(bag);
    await runTravelEvent(ev, route);
  }

  caravanChars().forEach((c) => { c.mood = clamp(c.mood - 2, 0, 100); });
  S.traveling = null;
  S.location = dest;
  S.stats.trips += 1;
  if (route.risk >= 2) S.stats.southRoute = true;
  if (!S.visited.includes(dest)) S.visited.push(dest);
  UI.log(`抵达${cityById(dest).name}。${cityById(dest).desc}`);
  UI.refresh();

  await checkReunions();
  await checkCityEvents();
  await endSeason();
  S.busy = false;
  UI.refresh();
}

async function runTravelEvent(ev, route) {
  const options = [];
  ev.choices.forEach((c, i) => {
    let disabled = false, note = '';
    if (c.needStory && !S.stories.some((s) => !s.told)) { disabled = true; note = '（没有故事可讲）'; }
    if (c.needSkill && bestGuide() < c.needSkill[1]) { disabled = true; note = '（缺少高明的向导）'; }
    if (c.needGood && S.cargo[c.needGood[0]] < c.needGood[1]) { disabled = true; note = `（${goodById(c.needGood[0]).name}不足）`; }
    options.push({ id: String(i), text: c.text + note, disabled });
  });
  const choiceIdx = await UI.showModal({ title: ev.name, tag: route.name, text: ev.text, options });
  applyResult(ev.choices[Number(choiceIdx)].result || {}, UI.log);
  UI.refresh();
}

/* ── 驻留一季 ── */
async function stayHere() {
  if (S.busy || S.over) return;
  S.busy = true;
  caravanChars().forEach((c) => {
    c.mood = clamp(c.mood + 8, 0, 100);
    c.health = clamp(c.health + 10, 0, 100);
  });
  const wage = 15 + caravanChars().length * 3;
  S.money += wage;
  UI.log(`商队在${cityById(S.location).name}休整了一季，大家顺便打了些短工（+${wage} 银钱）。`);
  await endSeason();
  S.busy = false;
  UI.refresh();
}

/* ── 季末与年末 ── */
async function endSeason() {
  await lifeScan(false);
  S.season += 1;
  if (S.season >= 4) {
    S.season = 0;
    await endYear();
  }
  driftPrices();
  UI.refresh();
}

async function endYear() {
  await lifeScan(true);
  Object.values(S.chars).forEach((c) => { c.age += 1; });
  offscreenSim();

  if (S.year === 8 && !S.loulanDecay) {
    S.loulanDecay = true;
    S.yearEvents.push('⚠️ 有驼队带来消息：孔雀河上游改道，楼兰的水一年比一年浅了……');
  }

  /* 年话 */
  const delta = S.money - S.moneyAtYearStart;
  const lines = S.yearEvents.length ? S.yearEvents : ['商队平平安安走了一年，没什么大事——平安本身就是大事。'];
  await UI.showModal({
    title: `${S.year} 年 · 年话`, tag: '围炉夜话',
    text: `这一年，银钱${delta >= 0 ? '多' : '少'}了 ${Math.abs(delta)}。\n\n` + lines.map((l) => '· ' + l).join('\n'),
    options: [{ id: 'ok', text: S.year >= END_YEAR ? '十五年，走到头了……' : '为新的一年满饮此杯！' }],
  });

  S.yearEvents = [];
  S.moneyAtYearStart = S.money;
  S.dramaThisYear = 0;
  S.year += 1;

  if (S.year > END_YEAR) {
    S.over = true;
    await showSettlement();
  }
}

/* ── 结算 ── */
function starsOf(v, t) { return v >= t[3] ? 5 : v >= t[2] ? 4 : v >= t[1] ? 3 : v >= t[0] ? 2 : 1; }

async function showSettlement() {
  const repSum = S.rep.dunhuang + S.rep.loulan + S.rep.khotan;
  const seen = S.codexStories.length + S.recipes.length * 2 + S.visited.length;
  const fate = S.stats.turnings + S.stats.reunions;
  const foot = S.stats.trips + (S.stats.southRoute ? 3 : 0);
  const axes = [
    { name: '财富', stars: starsOf(S.money, [300, 800, 1500, 2600]) },
    { name: '声望', stars: starsOf(repSum, [8, 18, 32, 50]) },
    { name: '见闻', stars: starsOf(seen, [4, 7, 10, 13]) },
    { name: '缘分', stars: starsOf(fate, [1, 3, 5, 8]) },
    { name: '足迹', stars: starsOf(foot, [8, 14, 20, 27]) },
  ];
  const total = axes.reduce((a, x) => a + x.stars, 0);
  const grade = total >= 21 ? 'S' : total >= 17 ? 'A' : total >= 13 ? 'B' : total >= 9 ? 'C' : 'D';

  /* 考古出土（彩蛋点题：路会被沙埋，故事会留下来） */
  const digs = ['一册商队账簿木简，字迹被沙磨得温润。'];
  Object.values(S.chars).forEach((c) => {
    if (!c.departed) return;
    if (c.departedKind === 'monk') digs.push('一页佉卢文写经残片，落款"释安"——经文边角画着一串小小的驼铃。');
    if (c.departedKind === 'musician') digs.push('一枚刻着曲谱的木简，曲名依稀可辨：《驼铃》。');
    if (c.departedKind === 'home') digs.push('半幅"驼队晚照"锦残片，晕色技法失传已久。');
    if (c.departedKind === 'retire') digs.push('一幅手绘路图，图上每口水井旁都点着朱砂。');
  });
  if (S.recipes.includes('brocade')) digs.push('晕染锦残片一角，色如落日熔金——织法至今无人能复原。');
  if (S.stats.storiesTold > 0) digs.push(`变文抄本 ${S.stats.storiesTold} 页，讲的都是商队带来的故事。`);
  if (charById('xiaoman').inCaravan) digs.push('一方画像砖：老者授图，少年牵驼——师徒两代人，同一条路。');

  UI.showSettlementScreen({ axes, total, grade, digs });
}

/* ── 招募 ── */
function recruitChar(id) {
  const c = charById(id);
  if (!c || c.inCaravan || c.hidden) return false;
  if (c.recruitCost && S.money < c.recruitCost) return false;
  if (c.recruitCost) S.money -= c.recruitCost;
  c.inCaravan = true;
  const fromCity = c.city;
  c.city = null;
  c.history.push({ year: S.year, text: `${S.year} 年，于${cityById(fromCity).name}加入商队。` });
  return true;
}
