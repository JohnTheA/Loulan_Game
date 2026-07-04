/* ============================================================
 * 楼兰 · 丝路物语 —— 原型数据（城市/货物/角色/故事/事件）
 * ============================================================ */

const GOODS = [
  { id: 'silk',    name: '丝绸',   emoji: '🧵' },
  { id: 'tea',     name: '茶叶',   emoji: '🍵' },
  { id: 'jade',    name: '玉石',   emoji: '🟢' },
  { id: 'spice',   name: '香料',   emoji: '🌶️' },
  { id: 'carpet',  name: '地毯',   emoji: '🧶' },
  { id: 'brocade', name: '晕染锦', emoji: '👘', crafted: true },
];

/* 基础价：东货西贵，西货东贵。晕染锦为合成品，处处高价 */
const BASE_PRICES = {
  dunhuang: { silk: 20, tea: 15, jade: 80, spice: 60, carpet: 70, brocade: 160 },
  loulan:   { silk: 32, tea: 26, jade: 54, spice: 42, carpet: 50, brocade: 150 },
  khotan:   { silk: 46, tea: 40, jade: 30, spice: 24, carpet: 34, brocade: 160 },
};

const CITIES = [
  { id: 'dunhuang', name: '敦煌', x: 84, y: 18, emoji: '🏯', hasTemple: true,
    desc: '河西重镇，石窟与商旅之城。' },
  { id: 'loulan',   name: '楼兰', x: 52, y: 30, emoji: '🏜️', hasTemple: true,
    desc: '孔雀河畔的绿洲王城。水，是它的命。' },
  { id: 'khotan',   name: '于阗', x: 16, y: 44, emoji: '🕌', hasTemple: false,
    desc: '玉河之国，乐舞与美玉之乡。' },
];

const ROUTES = [
  { a: 'dunhuang', b: 'loulan', cost: 30, risk: 1, name: '白龙堆道' },
  { a: 'loulan',   b: 'khotan', cost: 30, risk: 1, name: '且末道' },
  { a: 'dunhuang', b: 'khotan', cost: 70, risk: 2, name: '南山险道' },
];

/* ── 角色 ──
 * 四维人生：personality / hobbies / belief / bonds
 * history 即传记，年话与结算彩蛋都从这里读 */
const CHAR_DEFS = [
  {
    id: 'laozhou', name: '老周', emoji: '🧓', culture: 'han', age: 52, career: '向导',
    personality: { courage: 70, curiosity: 30, faith: 30, sociability: 55, ambition: 25 },
    hobbies: ['喝茶'], belief: { type: '敬祖', intensity: 30 },
    bonds: [{ type: 'place', target: 'dunhuang', kind: '故乡', strength: 75 }],
    skills: { trade: 1, guide: 4, music: 0, craft: 0 },
    mood: 70, health: 80, inCaravan: true,
    bio: '敦煌人，走了三十年商路的老向导，认得每一口井。',
  },
  {
    id: 'aisha', name: '阿依莎', emoji: '🧕', culture: 'sogdian', age: 19, career: '商队学徒',
    personality: { courage: 45, curiosity: 88, faith: 20, sociability: 70, ambition: 55 },
    hobbies: ['琵琶'], belief: { type: '祆教', intensity: 20 },
    bonds: [{ type: 'item', target: '母亲的琵琶', kind: '遗物', strength: 90 }],
    skills: { trade: 3, guide: 0, music: 2, craft: 1 },
    mood: 75, health: 95, inCaravan: true,
    bio: '粟特商人之女，什么都想看一眼，什么都想学一手。',
  },
  {
    id: 'tiemuer', name: '铁木尔', emoji: '🧔', culture: 'nomad', age: 27, career: '驼夫',
    personality: { courage: 45, curiosity: 40, faith: 55, sociability: 35, ambition: 20 },
    hobbies: ['喂骆驼'], belief: { type: '长生天', intensity: 40 },
    bonds: [{ type: 'item', target: '白骆驼"雪蹄"', kind: '相依', strength: 85 }],
    skills: { trade: 0, guide: 1, music: 0, craft: 1 },
    mood: 65, health: 90, inCaravan: true,
    bio: '草原来的驼夫，话不多，骆驼都听他的。',
  },
  {
    id: 'yungu', name: '云姑', emoji: '👩', culture: 'han', age: 24, career: '织工',
    personality: { courage: 35, curiosity: 55, faith: 35, sociability: 60, ambition: 45 },
    hobbies: ['织锦'], belief: { type: '礼佛', intensity: 35 },
    bonds: [{ type: 'place', target: 'dunhuang', kind: '故乡织坊', strength: 70 }],
    skills: { trade: 1, guide: 0, music: 0, craft: 3 },
    mood: 70, health: 85, inCaravan: true,
    bio: '敦煌织坊出身，一双手能让丝线开出花来。',
  },
  {
    id: 'banruo', name: '般若', emoji: '🧑‍🦲', culture: 'loulan', age: 38, career: '游方僧',
    personality: { courage: 55, curiosity: 65, faith: 90, sociability: 50, ambition: 10 },
    hobbies: ['抄经'], belief: { type: '礼佛', intensity: 90 },
    bonds: [{ type: 'place', target: 'loulan', kind: '受戒之地', strength: 60 }],
    skills: { trade: 0, guide: 2, music: 0, craft: 0, medicine: 3 },
    mood: 80, health: 75, inCaravan: false, city: 'loulan', recruitCost: 150,
    bio: '楼兰佛寺的游方僧，会医术，一路讲经一路行。',
  },
  {
    id: 'yuchi', name: '尉迟迦罗', emoji: '👳', culture: 'khotan', age: 45, career: '玉商',
    personality: { courage: 50, curiosity: 45, faith: 40, sociability: 75, ambition: 70 },
    hobbies: ['相玉'], belief: { type: '礼佛', intensity: 40 },
    bonds: [{ type: 'place', target: 'khotan', kind: '祖业', strength: 65 }],
    skills: { trade: 4, guide: 1, music: 0, craft: 0 },
    mood: 60, health: 85, inCaravan: false, city: 'khotan', hidden: true,
    bio: '于阗玉商世家，眼光毒辣。玉市萧条让他动了远行的念头。',
  },
  {
    id: 'xiaoman', name: '小满', emoji: '👦', culture: 'han', age: 16, career: '向导学徒',
    personality: { courage: 60, curiosity: 75, faith: 25, sociability: 65, ambition: 60 },
    hobbies: ['认星星'], belief: { type: '敬祖', intensity: 20 },
    bonds: [{ type: 'person', target: 'laozhou', kind: '师父', strength: 80 }],
    skills: { trade: 0, guide: 2, music: 0, craft: 0 },
    mood: 80, health: 100, inCaravan: false, city: 'dunhuang', hidden: true,
    bio: '老周收的关门徒弟，脚程快，眼睛亮。',
  },
];

/* ── 故事池：可收集、可在异地讲述换钱换声望 ── */
const STORY_DEFS = [
  { id: 'st_white_dragon', name: '白龙堆的白龙', origin: 'loulan',  value: 40, text: '据说白龙堆的沙脊夜里会动，那是一条守着故城的白龙。' },
  { id: 'st_jade_river',   name: '玉河捞玉的姑娘', origin: 'khotan', value: 40, text: '于阗人说，月圆之夜下河的姑娘能摸到最好的籽玉。' },
  { id: 'st_mogao_lamp',   name: '千佛洞的长明灯', origin: 'dunhuang', value: 40, text: '莫高窟有一盏灯，据说自开窟那天起就没灭过。' },
  { id: 'st_lost_city',    name: '沙下的城',       origin: 'loulan',  value: 55, text: '老驼夫都说，沙暴过后有人见过一座城的轮廓，一炷香后又被沙埋了。' },
  { id: 'st_dancing_girl', name: '旋舞的胡姬',     origin: 'khotan', value: 45, text: '于阗乐坊有位胡姬，旋舞时裙摆展开像一朵火焰花。' },
  { id: 'st_camel_king',   name: '驼王认主',       origin: 'dunhuang', value: 35, text: '敦煌驼市流传：真正的驼王一生只认一个主人。' },
  { id: 'st_monk_west',    name: '西行取经僧',     origin: 'dunhuang', value: 50, text: '有位僧人独自西行求法，出玉门关时只带了一钵一杖。' },
  { id: 'st_water_ghost',  name: '孔雀河的水信',   origin: 'loulan',  value: 55, text: '楼兰人相信河水改道前，水面会先漂来上游的红柳枝——那是河神的信。' },
];

/* ── 旅途事件卡 ──
 * choice.effect 由引擎执行；flag 会打给在场角色，是人生转折的开关 */
const TRAVEL_EVENTS = [
  {
    id: 'ev_sandstorm', name: '沙暴压境', weight: 3, minRisk: 1,
    text: '天边升起一堵土黄色的墙，驼铃声都被风吞了。老练的商队知道：这是要命的沙暴。',
    choices: [
      { text: '顶风硬闯，抢在最猛之前穿过去',
        result: { moneyLoss: 0, cargoLossRatio: 0.25, healthAll: -15, flagAll: 'sandstorm_survivor',
          guideHelp: true, log: '商队在飞沙里挣扎了一天一夜，货物丢了一些，人都活着。这份劫后余生，每个人心里滋味不同。' } },
      { text: '绕远路避开风口（多耗 40 银钱补给）',
        result: { moneyLoss: 40, moodAll: -5, log: '多走了五天冤枉路，人困驼乏，好在有惊无险。' } },
      { text: '就地扎营，蒙住骆驼眼睛硬扛',
        result: { cargoLossRatio: 0.1, healthAll: -8, flagAll: 'sandstorm_survivor',
          log: '风声像鬼哭了一整夜。天亮时人人满头沙土，帐篷破了两顶——但都挺过来了。' } },
    ],
  },
  {
    id: 'ev_bandits', name: '盗匪拦路', weight: 2, minRisk: 1,
    text: '前方沙丘后转出十几骑，弯刀在太阳下明晃晃。为首的胡匪打量着你们的驼队。',
    choices: [
      { text: '破财免灾，交 60 银钱买路',
        result: { moneyLoss: 60, log: '钱袋轻了，命还在。匪首还咧嘴一笑："下次多带点货。"' } },
      { text: '讲个故事贿赂匪首（消耗一个故事）', needStory: true,
        result: { useStory: true, moodAll: 5, log: '匪首听得入了神，末了竟叫人送来一皮囊马奶酒："这故事值一条路！"' } },
      { text: '让向导带小路悄悄绕开', needSkill: ['guide', 3],
        result: { moodAll: 3, log: '老向导带着商队钻进一条干河床，绕过了匪帮的眼线。众人对他佩服得五体投地。' } },
    ],
  },
  {
    id: 'ev_oasis', name: '甘泉绿洲', weight: 2, minRisk: 1,
    text: '沙丘尽头忽然冒出一丛胡杨——是一处没在地图上的小绿洲，泉水清得能看见底。',
    choices: [
      { text: '痛快歇一天，人和骆驼都泡个够',
        result: { moodAll: 10, healthAll: 8, log: '泉边一夜好眠。第二天出发时，连骆驼的步子都轻快了。' } },
      { text: '灌满水囊就走，赶路要紧',
        result: { moodAll: 2, log: '水囊沉甸甸的，心里也踏实了。' } },
    ],
  },
  {
    id: 'ev_traveler', name: '独行的旅人', weight: 2, minRisk: 1,
    text: '一个风尘仆仆的旅人向商队讨水喝。他说自己从更西边来，一肚子都是路上的见闻。',
    choices: [
      { text: '请他吃顿热饭，听他讲故事',
        result: { moneyLoss: 10, gainStory: true, log: '旅人讲了一路见闻，末了郑重把一个故事送给你们："故事比金子轻，比金子远。"' } },
      { text: '给口水，各走各路',
        result: { log: '旅人道了谢，很快消失在地平线上。' } },
    ],
  },
  {
    id: 'ev_campfire', name: '篝火夜话', weight: 3, minRisk: 1,
    text: '夜里扎营，篝火噼啪作响。大家围着火堆，话匣子渐渐打开了。',
    choices: [
      { text: '让阿依莎弹一曲琵琶',
        result: { moodAll: 8, bondPair: ['aisha', 'yungu'], log: '琵琶声里，云姑看着火光出神："这曲子……要是能织进锦缎里就好了。"阿依莎眼睛一亮。' } },
      { text: '聊聊各自家乡的事',
        result: { moodAll: 5, bondAll: 5, log: '一晚上下来，大家又亲近了几分。原来每个人身后，都拖着长长的来路。' } },
    ],
  },
  {
    id: 'ev_starnight', name: '大漠星河', weight: 2, minRisk: 1,
    text: '今夜无风，银河横贯天顶，亮得惊人。守夜的人都看呆了。',
    choices: [
      { text: '叫醒大家一起看星星',
        result: { moodAll: 6, flagAll: 'stargazer_night', log: '有人指着星星认路，有人许愿，有人只是安静地看。这样的夜，走多少趟沙漠也遇不上几回。' } },
      { text: '让大家抓紧睡，明天赶路',
        result: { log: '星河无声流转，只有守夜人独享了这一夜。' } },
    ],
  },
  {
    id: 'ev_sickcamel', name: '骆驼病了', weight: 2, minRisk: 1,
    text: '铁木尔的白骆驼"雪蹄"突然卧地不起，口吐白沫。铁木尔的脸一下子白了。',
    choices: [
      { text: '停下一天，全力救治（30 银钱药钱）',
        result: { moneyLoss: 30, charMood: ['tiemuer', 15], flagChar: ['tiemuer', 'camel_saved'],
          log: '折腾到后半夜，"雪蹄"终于站起来了。铁木尔抱着驼脖子，半天没说话。' } },
      { text: '把货分给其他骆驼，让它空身慢慢走',
        result: { cargoLossRatio: 0.08, charMood: ['tiemuer', 5], log: '"雪蹄"慢吞吞地跟在队尾，总算缓了过来。' } },
    ],
  },
  {
    id: 'ev_snowpass', name: '雪封山口', weight: 3, minRisk: 2,
    text: '南山险道的垭口落了早雪，一脚深一脚浅。忽然，前面的云姑脚下一滑，向崖边跌去——',
    choices: [
      { text: '（老周飞身拽住了她）', auto: true,
        result: { flagChar: ['yungu', 'rescued_on_cliff'], charMood: ['yungu', -5], healthChar: ['yungu', -10],
          log: '千钧一发，老周一把拽住云姑的手腕。过了垭口，云姑还在发抖，看老周的眼神却变了——那是能把命交出去的人。' } },
    ],
  },
  {
    id: 'ev_merchant_meet', name: '相遇的商队', weight: 2, minRisk: 1,
    text: '迎面来了一支波斯商队，双方停下互通消息。对方管事的提出临时换些货。',
    choices: [
      { text: '换！把丝绸换成香料（丝绸-3，香料+3）', needGood: ['silk', 3],
        result: { swap: ['silk', 'spice', 3], log: '两边都觉得自己赚了——这就是好买卖。临别时对方还送了一小包无花果干。' } },
      { text: '只打听消息，不换货',
        result: { priceTip: true, log: '对方管事的透露了下一站的行情，拱手作别。' } },
    ],
  },
];

/* ── 城市事件：到达时可能触发 ── */
const CITY_EVENTS = [
  {
    id: 'cev_khotan_music', city: 'khotan', once: false, chance: 0.7,
    name: '于阗乐会',
    text: '今夜玉河边有乐会，龟兹琵琶与于阗鼓声隔水相和，半城人都出来听。',
    choices: [
      { text: '带大家去听（10 银钱）',
        result: { moneyLoss: 10, moodAll: 8, flagAll: 'heard_khotan_music',
          log: '乐声像河水一样漫过来。阿依莎抱着琵琶站在最前面，一动不动，眼睛亮得吓人。' } },
      { text: '早些歇息，明日还要看货',
        result: { log: '乐声隐隐传到客栈，像一个没做完的梦。' } },
    ],
  },
  {
    id: 'cev_jade_slump', city: 'khotan', once: true, minYear: 3, chance: 0.9,
    name: '玉市萧条',
    text: '于阗玉市冷冷清清。玉商尉迟迦罗在自家铺子前拦住你：“东边的商路一乱，玉就砸在手里了。老弟，带我一程如何？我这双眼睛，走到哪儿都能替你相出好货。”',
    choices: [
      { text: '欢迎！商队正缺一位行家', recruit: 'yuchi',
        result: { log: '尉迟迦罗当天就锁了铺门，把钥匙交给邻居："铺子会等我，路不会。"——世事变迁，又一个人的人生拐了弯。', turning: true } },
      { text: '婉言谢绝，商队人手够了',
        result: { log: '尉迟迦罗笑笑，拱手道："也罢，玉在椟中，总有识家。"' } },
    ],
  },
];
