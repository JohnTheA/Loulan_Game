/* ============================================================
 * 楼兰 · 丝路物语 —— UI 层（渲染 / 弹窗 / 动画）
 * ============================================================ */

const UI = (() => {
  const $ = (sel) => document.querySelector(sel);
  const AUTOTEST = new URLSearchParams(location.search).has('autotest');
  let currentTab = 'action';

  /* ── 日志 ── */
  function log(text, hl) {
    const p = document.createElement('p');
    p.textContent = text;
    if (hl) p.className = 'hl';
    $('#log').appendChild(p);
    $('#log').scrollTop = $('#log').scrollHeight;
  }

  /* ── 弹窗（Promise 化，支持自动测试） ── */
  function showModal({ title, tag, text, options }, lifeCard) {
    return new Promise((resolve) => {
      const overlay = $('#overlay');
      const modal = $('#modal');
      modal.className = lifeCard ? 'life-card' : '';
      modal.innerHTML = '';
      if (tag) {
        const t = document.createElement('span');
        t.className = 'm-tag'; t.textContent = tag;
        modal.appendChild(t);
      }
      const h = document.createElement('h3');
      h.textContent = title;
      modal.appendChild(h);
      const body = document.createElement('div');
      body.className = 'm-text'; body.textContent = text;
      modal.appendChild(body);
      const enabled = [];
      options.forEach((opt) => {
        const b = document.createElement('button');
        b.className = 'btn' + (opt.primary ? ' primary' : '');
        b.textContent = opt.text;
        b.disabled = !!opt.disabled;
        b.onclick = () => { overlay.classList.add('hidden'); resolve(opt.id); };
        modal.appendChild(b);
        if (!opt.disabled) enabled.push(b);
      });
      overlay.classList.remove('hidden');
      if (AUTOTEST) setTimeout(() => enabled[Math.floor(Math.random() * enabled.length)].click(), 15);
    });
  }
  const showLifeCard = (def) => showModal(def, true);

  /* ── 地图 ── */
  function renderMap() {
    const svg = $('#map-svg');
    let html = '';
    ROUTES.forEach((r) => {
      const a = cityById(r.a), b = cityById(r.b);
      html += `<line class="map-route" x1="${a.x}" y1="${a.y + 6}" x2="${b.x}" y2="${b.y + 6}"/>`;
    });
    CITIES.forEach((c) => {
      const cur = S.location === c.id;
      const decay = c.id === 'loulan' && S.loulanDecay;
      html += `<circle class="map-city${cur ? ' current' : ''}${decay ? ' map-decay' : ''}" cx="${c.x}" cy="${c.y + 6}" r="3.2"/>`;
      html += `<text class="map-label${decay ? ' map-decay' : ''}" x="${c.x - 6}" y="${c.y - 1}">${c.name}${decay ? '·衰' : ''}</text>`;
    });
    let cx, cy;
    if (S.traveling) {
      const a = cityById(S.traveling.from), b = cityById(S.traveling.to);
      cx = (a.x + b.x) / 2; cy = (a.y + b.y) / 2 + 6;
    } else if (S.location) {
      const c = cityById(S.location); cx = c.x; cy = c.y + 6;
    }
    if (cx !== undefined) html += `<text class="map-caravan" x="${cx - 3}" y="${cy - 4}">🐪</text>`;
    svg.innerHTML = html;
  }

  /* ── 主舞台 ── */
  function renderScene() {
    const scene = $('#scene');
    const figures = caravanChars().map((c) => `<span class="figure">${c.emoji}</span>`).join('');
    if (S.traveling) {
      scene.classList.add('walking');
      scene.innerHTML = `<span class="figure">🐪</span>${figures}<span class="figure">🐪</span>`;
    } else {
      scene.classList.remove('walking');
      const city = cityById(S.location);
      scene.innerHTML = `<span>${city ? city.emoji : ''}</span>${figures}`;
    }
  }

  /* ── HUD ── */
  function renderHud() {
    $('#hud-time').textContent = `第 ${S.year} 年 · ${SEASONS[S.season]}`;
    $('#hud-money').textContent = `💰 ${S.money}`;
    $('#hud-loc').textContent = S.traveling
      ? `🐪 ${cityById(S.traveling.from).name} → ${cityById(S.traveling.to).name}`
      : `📍 ${cityById(S.location).name}`;
  }

  /* ── 面板 ── */
  function renderPanel() {
    const panel = $('#panel');
    panel.innerHTML = '';
    if (currentTab === 'action') renderActionTab(panel);
    if (currentTab === 'cargo') renderCargoTab(panel);
    if (currentTab === 'crew') renderCrewTab(panel);
    if (currentTab === 'codex') renderCodexTab(panel);
  }

  function el(parent, tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    parent.appendChild(e);
    return e;
  }

  function renderActionTab(panel) {
    if (S.over) { el(panel, 'div', 'panel-title', '十五年商路已经走完。'); return; }
    if (!S.location) { el(panel, 'div', 'panel-title', '商队行进中……'); return; }
    const city = cityById(S.location);
    el(panel, 'div', 'panel-title', `${city.name} —— ${city.desc}`);

    const listen = el(panel, 'button', 'btn', '');
    listen.innerHTML = `🍵 茶馆 · 听故事 <small>20 银钱</small>`;
    listen.onclick = () => {
      if (S.busy) return;
      if (S.money < 20) { log('银钱不够进茶馆了。'); return; }
      S.money -= 20;
      gainStory(log);
      refresh();
    };

    const tellable = tellableStories();
    const tell = el(panel, 'button', 'btn', '');
    tell.innerHTML = `📖 茶馆 · 讲故事 <small>${tellable.length} 个可讲</small>`;
    tell.disabled = !tellable.length;
    tell.onclick = async () => {
      if (S.busy) return;
      const opts = tellableStories().map((s) => {
        const d = STORY_DEFS.find((x) => x.id === s.id);
        return { id: s.id, text: `《${d.name}》（约 ${d.value} 银钱）` };
      });
      opts.push({ id: 'cancel', text: '算了，今天不讲' });
      const pickId = await showModal({ title: '讲哪个故事？', tag: city.name, text: '茶馆里人声渐静，都等着听远方的事。', options: opts });
      if (pickId !== 'cancel') {
        const r = tellStory(pickId);
        if (r) log(`📖 讲罢《${r.name}》，满堂喝彩。赏钱 ${r.gain} 银钱，${city.name}声望+2。`);
      }
      refresh();
    };

    /* 招募 */
    Object.values(S.chars).forEach((c) => {
      if (c.inCaravan || c.hidden || c.departed || c.city !== S.location || c.id === 'xiaoman') return;
      const b = el(panel, 'button', 'btn', '');
      b.innerHTML = `🤝 邀请 ${c.name}（${c.career}）入队 <small>${c.recruitCost || 0} 银钱</small>`;
      b.disabled = !!(c.recruitCost && S.money < c.recruitCost);
      b.onclick = () => {
        if (S.busy) return;
        if (recruitChar(c.id)) { log(`${c.name}加入了商队。${c.bio}`); refresh(); }
      };
    });

    el(panel, 'div', 'panel-title', '出发（每段路程一季）');
    ROUTES.forEach((r) => {
      let dest = null;
      if (r.a === S.location) dest = r.b;
      if (r.b === S.location) dest = r.a;
      if (!dest) return;
      const d = cityById(dest);
      const b = el(panel, 'button', 'btn primary', '');
      b.innerHTML = `🐪 走${r.name} → ${d.name} <small>补给 ${r.cost}${r.risk >= 2 ? ' · 险' : ''}</small>`;
      b.onclick = () => travelTo(dest);
    });
    const stay = el(panel, 'button', 'btn', '🏕️ 驻留一季（休整，全员恢复）');
    stay.onclick = () => stayHere();
  }

  function renderCargoTab(panel) {
    el(panel, 'div', 'panel-title', `载重 ${cargoCount()} / ${CAPACITY} ${S.location ? '' : '（旅途中无法交易）'}`);
    GOODS.forEach((g) => {
      if (g.crafted && !S.recipes.includes('brocade') && S.cargo[g.id] === 0) return;
      const row = el(panel, 'div', 'goods-row');
      el(row, 'span', 'g-name', `${g.emoji} ${g.name}`);
      el(row, 'span', 'g-price', S.location ? `${S.prices[S.location][g.id]}` : '—');
      el(row, 'span', 'g-qty', `×${S.cargo[g.id]}`);
      const mk = (label, cls, fn, disabled) => {
        const b = el(row, 'button', cls, label);
        b.disabled = disabled || !S.location || S.busy || S.over;
        b.onclick = () => { fn(); refresh(); };
      };
      if (!g.crafted) {
        mk('买5', 'buy', () => buyGood(g.id, 5));
        mk('买1', 'buy', () => buyGood(g.id, 1));
      }
      mk('卖1', 'sell', () => sellGood(g.id, 1), S.cargo[g.id] < 1);
      mk('卖全', 'sell', () => sellGood(g.id, S.cargo[g.id]), S.cargo[g.id] < 1);
    });
    if (S.recipes.includes('brocade')) {
      const b = el(panel, 'button', 'btn', '');
      b.innerHTML = `✨ 合成晕染锦 <small>2 丝绸 + 1 香料</small>`;
      b.disabled = !S.location || S.cargo.silk < 2 || S.cargo.spice < 1;
      b.onclick = () => { if (craftBrocade()) log('✨ 一匹晕染锦织成了——色如流霞，各城都识货。'); refresh(); };
    }
  }

  function personText(c) {
    const p = c.personality;
    const dims = [['勇气', p.courage], ['好奇', p.curiosity], ['虔诚', p.faith], ['交际', p.sociability], ['野心', p.ambition]];
    const bar = (v) => '●'.repeat(Math.round(v / 20)) + '○'.repeat(5 - Math.round(v / 20));
    let t = dims.map(([n, v]) => `${n} ${bar(v)}`).join('　');
    t += `\n爱好：${c.hobbies.join('、') || '—'}　信仰：${c.belief.type}`;
    t += `\n牵挂：${c.bonds.map((b) => `${b.kind}（${b.type === 'place' ? cityById(b.target).name : b.type === 'person' && S.chars[b.target] ? S.chars[b.target].name : b.target}）`).join('、')}`;
    t += `\n\n—— 传记 ——\n` + c.history.map((h) => (h.year ? `[${h.year}年] ` : '') + h.text).join('\n');
    return t;
  }

  function renderCrewTab(panel) {
    el(panel, 'div', 'panel-title', `商队成员（${caravanChars().length} 人）`);
    caravanChars().forEach((c) => {
      const card = el(panel, 'div', 'crew-card');
      el(card, 'div', 'c-emoji', c.emoji);
      const info = el(card, 'div', 'c-info');
      el(info, 'div', 'c-name', `${c.name} · ${c.career}`);
      el(info, 'div', 'c-sub', `${c.age} 岁 · ${c.hobbies.join('、')}`);
      el(card, 'div', 'c-mood', `心情 ${c.mood}\n体力 ${c.health}`);
      card.onclick = () => showModal({
        title: `${c.emoji} ${c.name} · ${c.career}`, tag: `${c.age} 岁`,
        text: personText(c),
        options: [{ id: 'ok', text: '合上名册' }],
      });
    });
  }

  function renderCodexTab(panel) {
    el(panel, 'div', 'panel-title', `声望　敦煌 ${S.rep.dunhuang} · 楼兰 ${S.rep.loulan} · 于阗 ${S.rep.khotan}`);
    el(panel, 'div', 'panel-title', `故事图鉴（${S.codexStories.length}/${STORY_DEFS.length}）`);
    S.codexStories.forEach((id) => {
      const d = STORY_DEFS.find((x) => x.id === id);
      const inst = S.stories.find((s) => s.id === id);
      const item = el(panel, 'div', 'codex-item' + (inst && inst.told ? ' dim' : ''));
      el(item, 'div', 'ci-title', `《${d.name}》— 源自${cityById(d.origin).name}${inst && inst.told ? '（已讲过）' : ''}`);
      el(item, 'div', '', d.text);
    });
    if (S.recipes.length) {
      el(panel, 'div', 'panel-title', '配方');
      const item = el(panel, 'div', 'codex-item');
      el(item, 'div', 'ci-title', '晕染锦 —— 云姑 × 阿依莎');
      el(item, 'div', '', '琵琶曲的调子织进锦缎：2 丝绸 + 1 香料。');
    }
    const departed = Object.values(S.chars).filter((c) => c.departed);
    if (departed.length) {
      el(panel, 'div', 'panel-title', '人物志（离队之人的后来）');
      departed.forEach((c) => {
        const item = el(panel, 'div', 'codex-item');
        el(item, 'div', 'ci-title', `${c.emoji} ${c.name} · ${c.career} · 现居${cityById(c.city).name}`);
        el(item, 'div', '', c.history[c.history.length - 1].text);
      });
    }
  }

  /* ── 旅途动画 ── */
  function travelAnim() {
    renderHud(); renderMap(); renderScene();
    return new Promise((r) => setTimeout(r, AUTOTEST ? 30 : 1400));
  }

  /* ── 结算 ── */
  function showSettlementScreen({ axes, total, grade, digs }) {
    const overlay = $('#overlay');
    const modal = $('#modal');
    modal.className = 'life-card';
    modal.innerHTML = `<span class="m-tag">千年之后 · 考古手记</span>
      <h3>十五年商路 · 结算</h3>
      <div class="grade">${grade}</div>
      ${axes.map((a) => `<div class="score-row"><span>${a.name}</span><span class="stars">${'★'.repeat(a.stars)}${'☆'.repeat(5 - a.stars)}</span></div>`).join('')}
      <div class="m-text" style="margin-top:12px">风沙掩埋了道路，却掩不住故事。千年后，人们在楼兰故地掘出：\n\n${digs.map((d) => '🏺 ' + d).join('\n')}</div>`;
    const b = document.createElement('button');
    b.className = 'btn primary';
    b.textContent = '再走一趟丝路';
    b.onclick = () => { overlay.classList.add('hidden'); initGame(); firstRender(); };
    modal.appendChild(b);
    overlay.classList.remove('hidden');
    if (AUTOTEST) window.__SETTLED = { grade, total, digs: digs.length };
  }

  /* ── 刷新与初始化 ── */
  function refresh() { renderHud(); renderMap(); renderScene(); renderPanel(); }

  function firstRender() {
    refresh();
    $('#log').innerHTML = '';
    log('🐪 商队自敦煌出发。十五年后，且看你与这条路互相成全成什么模样。', true);
    log('（提示：低买高卖跑三城；茶馆听来的故事，到别的城能换钱；多陪伙伴们围炉夜话——人的故事，才是这条路上最贵的货。）');
  }

  function init() {
    document.querySelectorAll('.tab').forEach((t) => {
      t.onclick = () => {
        document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
        t.classList.add('active');
        currentTab = t.dataset.tab;
        renderPanel();
      };
    });
    firstRender();
    if (!AUTOTEST) {
      showModal({
        title: '楼兰 · 丝路物语（原型）', tag: '开罗式 × 大航海式',
        text: '你是一支小商队的主人。\n\n· 十五年为期，年年有"年话"，期满有结算\n· 三城跑商：敦煌的丝茶，于阗的玉与香料\n· 故事也是货：听来的故事，带到远方讲给人听\n· 最要紧的是人：同行的伙伴会因路上的际遇，改变自己的人生——你可以推一把，但拦不住命运\n\n驼铃已响，上路吧。',
        options: [{ id: 'go', text: '出发！' }],
      });
    }
  }

  return { log, showModal, showLifeCard, travelAnim, showSettlementScreen, refresh, init, get AUTOTEST() { return AUTOTEST; } };
})();

/* 启动 */
initGame();
UI.init();
