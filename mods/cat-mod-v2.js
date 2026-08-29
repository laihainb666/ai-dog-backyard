/* =====================================================================
 * 🐱 后院猫咪模组 cat-mod.js  v2.0.0
 * 基于《通用游戏AI逻辑模板》：猫 = 独立 AI 实体
 *   猫状态(CatState) + 猫动作(CatActions) + 猫策略(CatStrategies) + 猫评估(CatEvaluate)
 * 特性：
 *  1. 院子里出现一只由 AI 驱动的猫（本地规则/随机/贪心，或远程大模型代理大脑）
 *  2. 猫拥有独立状态：精力/饥饿/心情/膀胱/友好度，会自己吃喝睡玩
 *  3. 与狗狗深度互动：蹭蹭、玩耍、偷吃狗粮、被撸被吓跑
 *  4. 存档/渲染/决策循环全部走模组钩子，不改主程序
 * 加载方式：游戏内「📂 加载模组(.js)」选择本文件，或填 URL 加载
 * ===================================================================== */
(function () {
  'use strict';

  /* ============ 猫状态 State ============ */
  const CAT = {
    x: 500, y: 320, tx: 500, ty: 320, face: -1, moving: false,
    energy: 92, hunger: 18, mood: 78, bladder: 30,
    action: 'idle', sleeping: false, sleepingT: 0,
    scratchT: 0, hissT: 0, meowT: 0, petT: 0, loveT: 0,
    aff: 0,                // 对狗友好度 0-100
    fear: 0,               // 恐惧值（被吓）
    strategy: 'cat-rule',  // cat-rule / cat-random / cat-greedy / cat-remote
    remoteOn: false,       // 是否让远程大模型代理猫大脑
    decideT: 0, walkT: 0,
    alive: true, bornT: 0,
  };

  /* 猫动作注册表（模板：动作空间） */
  const CatActions = {};
  function registerAction(name, def) { CatActions[name] = def; }
  function candidates() {
    return ['cat_move_to', 'cat_sleep', 'cat_scratch', 'cat_play', 'cat_meow',
      'cat_eat', 'cat_hiss', 'cat_approach_dog', 'cat_think'];
  }

  /* ============ 猫动作 Actions ============ */
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function goToCat(x, y) {
    CAT.tx = clamp(x, 40, (S.worldW || W) - 40); CAT.ty = clamp(y, 90, (S.worldH || H) - 50);
    if (dist(CAT, { x: CAT.tx, y: CAT.ty }) > 6) { CAT.moving = true; CAT.action = 'walk'; CAT.sleeping = false; }
  }
  function catExec(name, args) {
    args = args || {}; const dog = S.dog;
    let result = '';
    switch (name) {
      case 'cat_move_to':
        goToCat(args.x != null ? args.x : rand(W), args.y != null ? args.y : rand(H));
        CAT.action = 'walk'; result = `溜达到 (${CAT.tx | 0},${CAT.ty | 0})`; break;
      case 'cat_sleep':
        goToCat(168, 260);
        setTimeout(() => { if (dist(CAT, { x: 168, y: 260 }) < 60) { CAT.sleeping = true; CAT.sleepingT = 0; CAT.action = 'sleep'; } }, 800);
        result = '去树荫睡觉'; break;
      case 'cat_scratch':
        CAT.action = 'scratch'; CAT.scratchT = 1.2;
        setTimeout(() => { if (CAT.action === 'scratch') CAT.action = 'idle'; }, 1200);
        result = '挠痒痒'; break;
      case 'cat_play':
        goToCat(CAT.x + (rand(2) ? 1 : -1) * rand(120), CAT.y - rand(80));
        CAT.action = 'play'; CAT.playT = 2;
        setTimeout(() => { if (CAT.playT) CAT.playT = 0; }, 2000);
        if (CAT.energy > 40) CAT.energy = clamp(CAT.energy - 6, 0, 100);
        result = '自己追影子玩'; break;
      case 'cat_meow':
        CAT.action = 'meow'; CAT.meowT = 1; think('喵～');
        setTimeout(() => { if (CAT.action === 'meow') CAT.action = 'idle'; }, 900);
        result = '喵喵叫'; break;
      case 'cat_eat':
        goToCat(600, 520);
        setTimeout(() => { if (dist(CAT, { x: 600, y: 520 }) < 55 && S.foodBowl.fill > 0) {
            S.foodBowl.fill--; CAT.hunger = clamp(CAT.hunger - 40, 0, 100);
            CAT.mood = clamp(CAT.mood + 6, 0, 100); CAT.action = 'eat';
            think('猫偷吃了狗粮！'); log('🐱 猫偷吃了一勺狗粮…');
            if (dist({ x: dog.x, y: dog.y }, { x: 600, y: 520 }) < 80) { dog.mood = clamp(dog.mood - 5, 0, 100); log('🐕 狗狗有点不满'); }
          } }, 900);
        result = '去偷吃狗粮'; break;
      case 'cat_hiss':
        CAT.action = 'hiss'; CAT.hissT = 1.4;
        think('哈——！离我远点！'); log('🐱 猫对狗哈气（嘶——）');
        dog.mood = clamp(dog.mood - 4, 0, 100); CAT.aff = clamp(CAT.aff - 4, 0, 100);
        setTimeout(() => { if (CAT.action === 'hiss') CAT.action = 'idle'; }, 1400);
        result = '哈气警告'; break;
      case 'cat_approach_dog': {
        goToCat(dog.x + 30, dog.y);
        setTimeout(() => { if (dist(CAT, { x: dog.x + 30, y: dog.y }) < 65 && CAT.aff > 20) {
            CAT.loveT = 2.5; CAT.mood = clamp(CAT.mood + 10, 0, 100);
            dog.mood = clamp(dog.mood + 6, 0, 100); dog.loyalty = clamp(dog.loyalty + 2, 0, 100);
            think('猫蹭了蹭我，好开心～'); log('🐱🐕 猫和狗狗蹭蹭和好了');
            addXp(5);
          } }, 1100);
        result = '去找狗互动'; break;
      }
      case 'cat_think':
        if (args.thought) think('🐱 ' + args.thought);
        result = '表达想法'; break;
      default: result = '未知猫动作';
    }
    return result;
  }

  /* ============ 猫评估 Evaluate ============ */
  function catEvalState() {
    return CAT.energy * 0.5 + (100 - CAT.hunger) * 0.4 + CAT.mood * 0.6 + CAT.aff * 0.3;
  }
  function catEvalAction(name) {
    const hour = S.t / 3600, night = hour >= 22 || hour < 6;
    let s = 0;
    switch (name) {
      case 'cat_sleep': s = (100 - CAT.energy) * 1.2 + (CAT.energy < 35 ? 40 : 0) + (night ? 30 : 0); break;
      case 'cat_eat': s = CAT.hunger * 1.0 + (CAT.hunger > 55 ? 30 : 0) + (S.foodBowl.fill <= 0 ? -25 : 0); break;
      case 'cat_play': s = (CAT.energy > 45 && !night) ? 18 : -8; break;
      case 'cat_scratch': s = 6 + rand(5); break;
      case 'cat_meow': s = 3 + rand(6); break;
      case 'cat_hiss': s = (CAT.aff < 15 && dist(CAT, S.dog) < 80) ? 20 : -10; break;
      case 'cat_approach_dog': s = (CAT.aff > 20 && CAT.mood > 50) ? 22 : -15; break;
      case 'cat_move_to': s = 5 + rand(6); break;
      case 'cat_think': s = 1; break;
    }
    return s + rand(2);
  }

  /* ============ 猫策略 Strategies ============ */
  const CatStrategies = {};
  function catDecide() {
    const st = CAT.strategy;
    if (st === 'cat-random') { catExec(candidates()[ri(candidates().length)], {}); return; }
    if (st === 'cat-greedy') {
      let best = 'cat_move_to', bs = -1e9;
      candidates().forEach(a => { const sc = catEvalAction(a); if (sc > bs) { bs = sc; best = a; } });
      catExec(best, {}); return;
    }
    if (st === 'cat-remote' && CAT.remoteOn) { callCatAPI(); return; }
    /* cat-rule 规则策略 */
    const hour = S.t / 3600, night = hour >= 22 || hour < 6;
    if (CAT.sleeping) return;
    if (CAT.fear > 0) { CAT.fear -= 8; goToCat(CAT.x - 90, CAT.y - 30); return; }
    if (CAT.energy < 30) { catExec('cat_sleep', {}); return; }
    if (CAT.hunger > 60 && S.foodBowl.fill > 0) { catExec('cat_eat', {}); return; }
    if (CAT.aff > 20 && dist(CAT, S.dog) < 160 && rand(5) < 1) { catExec('cat_approach_dog', {}); return; }
    if (dist(CAT, S.dog) < 40 && CAT.aff < 15) { catExec('cat_hiss', {}); return; }
    if (CAT.hunger > 35 && S.foodBowl.fill > 0 && rand(4) < 1) { catExec('cat_eat', {}); return; }
    const acts = ['cat_move_to', 'cat_move_to', 'cat_scratch', 'cat_play', 'cat_meow', 'cat_play'];
    if (night) acts.push('cat_sleep');
    catExec(acts[ri(acts.length)], {});
  }

  /* ============ 远程大模型代理猫大脑 ============ */
  let catBusy = false;
  const catTools = [
    { name: 'cat_move_to', desc: '猫移动到某个位置 (x:40-920, y:90-570)。', params: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, reason: { type: 'string' } }, required: ['x', 'y'] } },
    { name: 'cat_sleep', desc: '去树荫下睡觉，恢复精力。', params: { type: 'object', properties: { reason: { type: 'string' } } } },
    { name: 'cat_scratch', desc: '挠痒痒。', params: { type: 'object', properties: { reason: { type: 'string' } } } },
    { name: 'cat_play', desc: '自己玩耍（追影子/打滚），消耗精力但开心。', params: { type: 'object', properties: { reason: { type: 'string' } } } },
    { name: 'cat_meow', desc: '喵喵叫，表达情绪。', params: { type: 'object', properties: { reason: { type: 'string' } } } },
    { name: 'cat_eat', desc: '去狗粮碗偷吃狗粮，降低饥饿。', params: { type: 'object', properties: { reason: { type: 'string' } } } },
    { name: 'cat_hiss', desc: '对狗哈气表示不满。', params: { type: 'object', properties: { reason: { type: 'string' } } } },
    { name: 'cat_approach_dog', desc: '主动靠近狗狗蹭蹭互动，增进感情。', params: { type: 'object', properties: { reason: { type: 'string' } } } },
    { name: 'cat_think', desc: '表达猫的内心想法（用户可见）。', params: { type: 'object', properties: { thought: { type: 'string' } }, required: ['thought'] } }
  ];
  async function callCatAPI() {
    if (catBusy || S.paused) return;
    if (!cfg.key) { log('⚠ 猫远程大脑需要 API Key（AI大脑面板）'); return; }
    catBusy = true;
    try {
      const url = cfg.base.replace(/\/$/, '') + '/chat/completions';
      const body = {
        model: cfg.model,
        messages: [
          { role: 'system', content: '你是后院的一只猫，名叫咪咪。高冷傲娇、好奇心强，偶尔偷吃狗粮，会主动蹭喜欢的狗狗。请基于身体状态、时间、天气与狗狗互动，每次先 cat_think() 表达想法，再调用一个工具。' },
          { role: 'user', content: `【时间】${fmtTime()} 天气:${weatherName()}\n【身体】精力${CAT.energy | 0} 饥饿${CAT.hunger | 0} 心情${CAT.mood | 0} 对狗友好度${CAT.aff | 0}\n【位置】x=${CAT.x | 0},y=${CAT.y | 0} 狗位置 x=${S.dog.x | 0},y=${S.dog.y | 0}\n【狗粮碗】剩${Math.max(0, S.foodBowl.fill)}份\n【状态】${CAT.sleeping ? '睡觉中' : CAT.action}` }
        ],
        tools: catTools.map(t => ({ type: 'function', function: { name: t.name, description: t.desc, parameters: t.params } })),
        tool_choice: 'auto'
      };
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key }, body: JSON.stringify(body) });
      if (!res.ok) { const t = await res.text(); throw new Error('HTTP ' + res.status + ' ' + t.slice(0, 120)); }
      const data = await res.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) return;
      const calls = msg.tool_calls || [];
      for (const c of calls) {
        const fn = c.function || {}; let args = {};
        try { args = JSON.parse(fn.arguments || '{}'); } catch (e) { }
        if (CatActions[fn.name]) { const r = catExec(fn.name, args); log('🐱🤖 AI → ' + fn.name + ' (' + r + ')'); }
      }
      if (!calls.length && msg.content) think('🐱 ' + String(msg.content).slice(0, 90));
    } catch (e) { log('⚠ 猫远程大脑失败: ' + e.message); }
    catBusy = false;
  }

  /* ============ 猫 UI（插入侧边面板） ============ */
  function buildCatUI() {
    const side = document.querySelector('.side');
    const card = document.createElement('div');
    card.className = 'card'; card.id = 'catCard';
    card.innerHTML = `
      <h3>🐱 猫咪 · 独立AI大脑 <small style="color:var(--sub)">v2.0</small></h3>
      <div class="lblrow"><span>⚡ 精力</span><span id="cNrg"></span></div><div class="bar"><i id="cbNrg" style="width:0%;background:#9ad5ff"></i></div>
      <div class="lblrow"><span>🍤 饥饿</span><span id="cHng"></span></div><div class="bar"><i id="cbHng" style="width:0%;background:#ffc94d"></i></div>
      <div class="lblrow"><span>😼 心情</span><span id="cMood"></span></div><div class="bar"><i id="cbMood" style="width:0%;background:#ff9ad5"></i></div>
      <div class="lblrow"><span>💕 对狗友好度</span><span id="cAff"></span></div><div class="bar"><i id="cbAff" style="width:0%;background:#ffb347"></i></div>
      <label style="margin-top:8px">猫的策略（同样基于通用AI模板）</label>
      <select id="catStrategy" onchange="__catSetStrat()">
        <option value="cat-rule">规则 Rule（默认）</option>
        <option value="cat-random">随机 Random</option>
        <option value="cat-greedy">贪心 Greedy</option>
        <option value="cat-remote">远程大模型（代理猫大脑）</option>
      </select>
      <div class="note" style="margin-top:4px">远程代理复用「AI大脑」面板的 API 配置。选远程后需点下方按钮确认开启。</div>
      <div class="row" style="margin-top:6px">
        <button class="blue" onclick="__catToggleRemote()" id="catRemoteBtn">📡 开启远程代理</button>
        <button class="ghost" onclick="__catPet()">🤚 撸猫</button>
        <button class="ghost" onclick="__catFeed()">🍤 喂小鱼干</button>
      </div>
      <div class="note" style="margin-top:4px">狗执行「撸猫/吓猫」、猫自己会蹭狗、偷吃狗粮，互动会实时反映在双方状态。</div>`;
    side.insertBefore(card, side.querySelector('.card'));
    window.__catSetStrat = function () {
      CAT.strategy = $('catStrategy').value;
      CAT.remoteOn = CAT.strategy === 'cat-remote';
      updateCatRemoteBtn(); log('🐱 猫策略切换：' + $('catStrategy').selectedOptions[0].textContent);
    };
    window.__catToggleRemote = function () {
      CAT.remoteOn = !CAT.remoteOn;
      if (CAT.remoteOn && CAT.strategy !== 'cat-remote') { CAT.strategy = 'cat-remote'; $('catStrategy').value = 'cat-remote'; }
      updateCatRemoteBtn(); log(CAT.remoteOn ? '📡 猫大脑已接入远程大模型' : '🐱 猫回到本地AI');
    };
    window.__catPet = function () { CAT.petT = 2; CAT.mood = clamp(CAT.mood + 12, 0, 100); CAT.aff = clamp(CAT.aff + 6, 0, 100); think('咪咪呼噜呼噜～'); log('🤚 撸了猫，猫很开心'); };
    window.__catFeed = function () { CAT.hunger = clamp(CAT.hunger - 30, 0, 100); CAT.mood = clamp(CAT.mood + 10, 0, 100); CAT.aff = clamp(CAT.aff + 8, 0, 100); think('小鱼干真香！'); log('🍤 喂了猫小鱼干'); };
  }
  function updateCatRemoteBtn() {
    const b = $('catRemoteBtn'); if (!b) return;
    b.textContent = CAT.remoteOn ? '📡 远程代理已开启' : '📡 开启远程代理';
    b.style.background = CAT.remoteOn ? 'var(--acc)' : '';
  }
  function updateCatUI() {
    if (!$('cNrg')) return;
    $('cNrg').textContent = CAT.energy | 0; $('cbNrg').style.width = CAT.energy + '%';
    $('cHng').textContent = CAT.hunger | 0; $('cbHng').style.width = CAT.hunger + '%';
    $('cMood').textContent = CAT.mood | 0; $('cbMood').style.width = CAT.mood + '%';
    $('cAff').textContent = CAT.aff | 0; $('cbAff').style.width = CAT.aff + '%';
  }

  /* ============ 猫渲染 Render ============ */
  function drawCat(g) {
    const c = CAT;
    const tailA = c.action === 'play' ? Math.sin(Date.now() / 70) * 0.8 : (c.sleeping ? -0.4 : Math.sin(Date.now() / 900) * 0.3);
    const b = breedStyle();
    g.save(); g.translate(c.x, c.y); g.scale(c.face, 1);
    /* 尾巴 */
    g.strokeStyle = '#e8865a'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-12, 2);
    g.quadraticCurveTo(-22, -2, -24 + Math.sin(Date.now() / 70) * 3, -14 + tailA * 8);
    g.stroke();
    /* 脚 */
    g.fillStyle = '#f0a070';
    const lf = c.moving ? Math.sin(c.walkT) * 3 : 0;
    if (!c.sleeping) [[-7, 8, lf], [3, 8, -lf], [8, 8, -lf], [17, 8, lf]].forEach(L => g.fillRect(L[0], 7, 4.5, 8 + L[2]));
    /* 身体 */
    g.fillStyle = '#f09868'; g.beginPath(); g.ellipse(4, 1, 17, 10, 0, 0, 7); g.fill();
    g.fillStyle = '#fbe3cf'; g.beginPath(); g.ellipse(8, 6, 9, 4.5, 0, 0, 7); g.fill();
    /* 花纹 */
    g.strokeStyle = '#d97a4a'; g.lineWidth = 2;
    [[-3, -4], [4, -5], [10, -3]].forEach(p => { g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] + 4, p[1] - 3); g.stroke(); });
    /* 头 */
    g.fillStyle = '#f09868'; g.beginPath(); g.arc(20, -7, 10, 0, 7); g.fill();
    /* 耳朵 */
    g.beginPath(); g.moveTo(12, -13); g.lineTo(12, -23); g.lineTo(19, -15); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(27, -13); g.lineTo(29, -22); g.lineTo(24, -14); g.closePath(); g.fill();
    g.fillStyle = '#eeb0a0'; g.beginPath(); g.moveTo(13, -15); g.lineTo(14, -21); g.lineTo(18, -16); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(27, -15); g.lineTo(28, -20); g.lineTo(25, -15); g.closePath(); g.fill();
    /* 眼睛/表情 */
    g.strokeStyle = '#2a1a10'; g.lineWidth = 1.2;
    if (c.sleeping) { g.beginPath(); g.arc(17, -7, 3, 0, Math.PI); g.stroke(); g.beginPath(); g.arc(24, -7, 3, 0, Math.PI); g.stroke(); }
    else if (c.hissT > 0) { g.beginPath(); g.arc(17, -8, 2, 0, 7); g.stroke(); g.beginPath(); g.arc(24, -8, 2, 0, 7); g.stroke(); g.beginPath(); g.moveTo(15, -6); g.lineTo(12, -8); g.stroke(); g.beginPath(); g.moveTo(26, -6); g.lineTo(29, -8); g.stroke(); }
    else {
      const ey = c.action === 'play' ? Math.sin(Date.now() / 300) * 0.8 : 0;
      g.fillStyle = '#2a1a10'; g.beginPath(); g.ellipse(17 + ey, -8, 1.8, 3, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(24 + ey, -8, 1.8, 3, 0, 0, 7); g.fill();
    }
    /* 鼻子胡须 */
    g.fillStyle = '#e86a5a'; g.beginPath(); g.arc(20.5, -5, 1.5, 0, 7); g.fill();
    g.strokeStyle = 'rgba(60,40,20,.6)'; g.lineWidth = 0.8;
    [[18, -4, 12, -6], [18, -3, 12, -3], [23, -4, 29, -6], [23, -3, 29, -3]].forEach(l => { g.beginPath(); g.moveTo(l[0], l[1]); g.lineTo(l[2], l[3]); g.stroke(); });
    /* 嘴巴 */
    g.beginPath(); g.moveTo(20.5, -3.5); g.quadraticCurveTo(19, -1, 17.5, -2); g.moveTo(20.5, -3.5); g.quadraticCurveTo(22, -1, 23.5, -2); g.stroke();
    /* 睡觉 Z */
    if (c.sleeping && Math.random() < 0.06) { g.fillStyle = '#8aa'; g.font = '13px sans-serif'; g.fillText('Z', 28 + rand(8), -22 - rand(8)); }
    /* 互动效果 */
    if (c.petT > 0 && Math.random() < 0.35) { g.fillStyle = '#ff9ad5'; g.font = '12px sans-serif'; g.fillText('♡', 28 + rand(8), -26 - rand(5)); }
    if (c.loveT > 0) { g.fillStyle = '#ffb347'; g.font = '12px sans-serif'; g.fillText('💞', -30, -20); }
    if (c.fear > 20) { g.fillStyle = '#666'; g.font = '11px sans-serif'; g.fillText('💦', 28, -24); }
    /* 名字 */
    g.fillStyle = 'rgba(0,0,0,.5)'; g.font = '10px sans-serif'; g.fillText('咪咪', -10, 22);
    g.restore();
  }

  /* ============ 模组主体 ============ */
  Dog.Mods.register({
    id: 'cat-mod',
    name: '🐱 后院猫咪（完整AI）',
    version: '2.0.0',
    desc: '新增一只由AI驱动的猫：独立状态/动作/策略/评估（通用AI模板），可选远程大模型代理大脑，与狗狗深度互动。',

    onLoad(D) {
      /* 狗的动作扩展：撸猫 / 吓猫（升级版） */
      D.Actions.register('pet_cat', {
        desc: '去猫身边互动（摸摸/蹭蹭）', label: '撸猫', value(dog, S) { return CAT.aff > 10 ? 15 : 3; },
        params: { type: 'object', properties: { reason: { type: 'string' } } },
        run(args) {
          if (!CAT.alive) return '猫不在';
          goTo(CAT.x, CAT.y);
          setTimeout(() => {
            if (distSafe({ x: CAT.x, y: CAT.y }) < 70) {
              CAT.petT = 2; CAT.mood = clamp(CAT.mood + 10, 0, 100); CAT.aff = clamp(CAT.aff + 5, 0, 100);
              S.loyalty = clamp(S.loyalty + 3, 0, 100); S.mood = clamp(S.mood + 6, 0, 100); addXp(4);
              think('喵呜～我们做朋友吧'); log('🐱 撸猫成功，猫很开心'); checkAchieve();
            }
          }, 900);
          return '去找猫玩';
        }
      });
      D.Actions.register('scare_cat', {
        desc: '汪汪叫把猫吓跑（掉好感）', label: '吓猫', value(dog, S) { return CAT.aff < 15 ? 8 : -5; },
        params: { type: 'object', properties: { reason: { type: 'string' } } },
        run(args) {
          if (!CAT.alive) return '猫不在';
          doBark(); S.loyalty = clamp(S.loyalty - 5, 0, 100);
          CAT.fear = 60; CAT.mood = clamp(CAT.mood - 15, 0, 100); CAT.aff = clamp(CAT.aff - 10, 0, 100);
          CAT.sleeping = false;
          think('哈哈哈猫被我吓跑了'); log('🐱 猫被吓跑了…');
          return '吓跑猫';
        }
      });
      /* 成就：猫咪之友（友好度达标） */
      const idx = ACH.findIndex(a => a[0] === 'cat3');
      if (idx >= 0) { ACH[idx][2] = () => CAT.aff >= 60; }
      else { ACH.push(['cat3', '🐱 猫咪之友', () => CAT.aff >= 60]); }
      /* 构建 UI */
      buildCatUI();
      updateCatRemoteBtn();
      log('🐱 完整猫咪模组已就绪：猫有自己的 AI 大脑（规则/随机/贪心/远程大模型）');
    },

    onUnload() {
      const c = $('catCard'); if (c) c.remove();
    },

    hooks: {
    onTick(dt) {
      const c = CAT;
      if (!c.alive) return;
      c.bornT += dt;
      /* 状态演化 */
      const hour = S.t / 3600, night = hour >= 22 || hour < 6;
      if (c.sleeping) {
        c.energy = clamp(c.energy + 5.5 * dt, 0, 100); c.sleepingT += dt;
        if (c.energy > 96 || c.sleepingT > 22) { c.sleeping = false; c.sleepingT = 0; c.action = 'idle'; think('喵～睡饱了'); }
      } else {
        c.energy = clamp(c.energy - (night ? 0.08 : 0.26) * dt, 0, 100);
        c.hunger = clamp(c.hunger + 0.11 * dt, 0, 100);
      }
      if (c.hunger > 85) c.mood = clamp(c.mood - 0.4 * dt, 0, 100);
      if (c.petT > 0) c.petT -= dt; if (c.loveT > 0) c.loveT -= dt; if (c.hissT > 0) c.hissT -= dt; if (c.scratchT > 0) c.scratchT -= dt;
      c.mood = clamp(c.mood + (c.sleeping ? 0.15 : -0.05) * dt - (night ? 0.1 : 0) * dt, 0, 100);
      if (c.fear > 0) c.fear -= 6 * dt;
      /* 移动 */
      if (c.moving) {
        const dx = c.tx - c.x, dy = c.ty - c.y, dd = Math.hypot(dx, dy), sp = 85 * dt;
        if (dd < 5) { c.x = c.tx; c.y = c.ty; c.moving = false; if (!c.sleeping && c.action === 'walk') c.action = 'idle'; }
        else { c.x += dx / dd * sp; c.y += dy / dd * sp; if (Math.abs(dx) > 2) c.face = dx > 0 ? 1 : -1; c.walkT += dt * 11; }
      }
      /* 决策循环（独立于狗） */
      if (!S.paused && !c.sleeping) {
        c.decideT += dt * S.speed;
        if (c.decideT >= 5) { c.decideT = 0; catDecide(); }
      }
      updateCatUI();
    },

    onRender(g) { drawCat(g); },

    onAction(name, args, result) {
      if (name === 'pet_cat') { /* 狗撸猫时的即时反馈 */ }
      if (name === 'scare_cat') { /* 已在上方处理 */ }
    },

    onSave(data) {
      data.cat = { x: CAT.x, y: CAT.y, energy: CAT.energy, hunger: CAT.hunger, mood: CAT.mood,
        aff: CAT.aff, fear: CAT.fear, sleeping: CAT.sleeping, strategy: CAT.strategy, remoteOn: CAT.remoteOn };
    },
    onLoad(data) {
      if (data.cat) {
        const c = data.cat;
        Object.assign(CAT, { x: c.x, y: c.y, tx: c.x, ty: c.y, energy: c.energy, hunger: c.hunger,
          mood: c.mood, aff: c.aff, fear: c.fear || 0, sleeping: !!c.sleeping, strategy: c.strategy || 'cat-rule', remoteOn: !!c.remoteOn });
        if ($('catStrategy')) $('catStrategy').value = CAT.strategy;
        updateCatRemoteBtn();
      }
    }
  }
  });
})();
