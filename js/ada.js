/* ============================================================
   学海大陆 · 阿黛事件系统
   大厅接待员阿黛：游戏事件触发她说话 + 切换表情。
   核心接口：XH.ada.trigger('事件id', params)。
   台词集中在 EVENTS 配置里，以后加台词只改配置。
   ============================================================ */
(function () {
  'use strict';
  const XH = (window.XH = window.XH || {});
  const $ = function (id) { return document.getElementById(id); };

  /* 表情图加载失败时回退的原 SVG 头像 */
  const SVG_FALLBACK =
    '<svg viewBox="0 0 64 64" shape-rendering="crispEdges">' +
    '<rect x="8" y="10" width="48" height="46" fill="#f4b183" stroke="#000" stroke-width="3"/>' +
    '<rect x="6" y="6" width="52" height="14" fill="#6b4f2a" stroke="#000" stroke-width="2"/>' +
    '<rect x="6" y="6" width="10" height="10" fill="#6b4f2a"/>' +
    '<rect x="48" y="6" width="10" height="10" fill="#6b4f2a"/>' +
    '<rect x="20" y="30" width="8" height="8" fill="#000"/>' +
    '<rect x="36" y="30" width="8" height="8" fill="#000"/>' +
    '<rect x="16" y="42" width="8" height="4" fill="#e94560" opacity="0.7"/>' +
    '<rect x="40" y="42" width="8" height="4" fill="#e94560" opacity="0.7"/>' +
    '<rect x="26" y="44" width="12" height="4" fill="#000"/>' +
    '</svg>';

  /* ============================================================
     台词配置：事件 id → { expr, priority, cooldown, oncePerDay, lines }
     priority 越大越优先（高优先级可插队）
     ============================================================ */
  const EVENTS = {
    // 1. 新访客首次进大厅
    first_visit: { expr: 'smile', priority: 60, oncePerDay: true, lines: [
      '欢迎来到公会大厅！我是阿黛，你的远征向导。',
      '头一回来？去迷雾地图，开辟你的第一块大陆吧。',
      '别慌，点亮第一片迷雾，远征就开始了。'
    ] },
    // 2. 每日首次进大厅（按时段问候）
    daily_greet: { expr: 'smile', priority: 40, oncePerDay: true, lines: {
      morning: ['早啊，远征者。新的一天，从点亮一片迷雾开始？', '早安！今晨的委托板已经更新了。'],
      noon: ['午安。今天的委托和大陆，都在等你呢。', '中午好，可别错过每日结算。'],
      evening: ['晚上好。夜深了，静思庭还亮着灯。', '夜晚的大陆，也别有一番风景。']
    } },
    // 3. 点亮普通试炼（30 秒冷却）
    light_normal: { expr: 'smile', priority: 20, cooldown: 30000, lines: [
      '漂亮，又点亮一片。',
      '不错，迷雾散开的感觉真好。',
      '继续，这片大陆在变亮。'
    ] },
    // 4. 点亮 61+ 高战力试炼
    light_high: { expr: 'laugh', priority: 50, lines: [
      '哇，这一击战力惊人！',
      '厉害！高战力试炼都被你拿下了。',
      '这一下，连我都热血沸腾了。'
    ] },
    // 5. 区域肃清
    region_clear: { expr: 'laugh', priority: 50, lines: [
      '区域肃清！漂亮。',
      '整片区域都点亮了，真利落。',
      '一鼓作气，区域清得干干净净。'
    ] },
    // 6. 大陆征服·非终极
    continent_clear: { expr: 'laugh', priority: 60, lines: [
      '大陆征服！这可不是小事。',
      '又一块大陆臣服于你了。',
      '漂亮，你的版图又大了一块。'
    ] },
    // 7. 升级 LEVEL UP
    level_up: { expr: 'laugh', priority: 50, lines: [
      '升级了！感觉如何？',
      'LEVEL UP！你越来越强了。',
      '又变强了，真是好样的。'
    ] },
    // 8. 钦定终极大陆 / 立誓
    designate_ultimate: { expr: 'serious', priority: 60, lines: [
      '钦定为终极远征……这是庄重的誓约。',
      '好，这片大陆就是你的终极目标了。',
      '立誓已记下，愿你早日凯旋。'
    ] },
    // 9. 决战日 ≤7 天
    battle_day: { expr: 'serious', priority: 80, oncePerDay: true, lines: [
      '决战之日近了，做好准备。',
      '决战之日就在眼前，整装待发吧。',
      '日子不多了，但也别慌，你行的。'
    ] },
    // 10. 远征终章·终极大陆征服（最高优先级）
    expedition_finale: { expr: 'laugh', priority: 100, lines: [
      '远征终章！终极大陆已征服，你是当之无愧的传奇！',
      '这一刻，值得被编年史永远铭记。',
      '凯旋而归吧，远征者，你是最耀眼的。'
    ] },
    // 11. 完成打卡委托（30 秒冷却，敬礼 salute）
    quest_done: { expr: 'salute', priority: 20, cooldown: 30000, lines: [
      '打卡成功，漂亮。',
      '委托完成，干净利落。',
      '又完成一件，好样的。',
      '收到！委托完成确认！',
      '是！长官！这件委托已清点完毕！'
    ] },
    // 12. 今日发愿
    vow_made: { expr: 'smile', priority: 20, lines: [
      '发愿已成，愿你今日如愿。',
      '愿力已种下，去点亮它吧。',
      '好，就朝着这个目标去吧。'
    ] },
    // 13. 重置存档（最高优先级，告别）
    reset_farewell: { expr: 'serious', priority: 100, lines: [
      '要重来了吗？那么，就此别过，远征者。',
      '愿下一次相遇，你还是那个一往无前的你。',
      '契约焚毁，往事清零。保重。'
    ] },
    // 14. 今日委托全清
    all_quests_done: { expr: 'wink', priority: 20, oncePerDay: true, lines: [
      '板上空空如也，效率高得离谱。',
      '委托全清！今天没什么能难住你了。',
      '一块不剩，真有你的。'
    ] },
    // 15. 赏金到上限后仍继续点亮
    bounty_capped: { expr: 'wink', priority: 20, oncePerDay: true, lines: [
      '今天的赏金发光啦，这句夸奖是免费的哦。',
      '赏金领完了还在冲？这股劲头我佩服。',
      '金币发光了，但你的远征还在继续。'
    ] },
    // 16. 连续 N 天上线（3/7/30 梯度，30+ 用 laugh）
    streak: { expr: 'smile', priority: 40, oncePerDay: true, tiers: [
      { min: 30, expr: 'laugh', lines: ['整整三十天没断了，你简直是公会的一面旗帜。', '连续三十天，这份毅力值得整片大陆喝彩。'] },
      { min: 7, expr: 'smile', lines: ['连续七天上线，这份坚持我可都看在眼里。', '一周不断，好样的。'] },
      { min: 3, expr: 'smile', lines: ['又来了？我开始期待每天见到你了。', '连续三天了，不错嘛。'] }
    ] },
    // 17. 乾坤袋导出存档码
    export_code: { expr: 'smile', priority: 20, lines: [
      '把家当都打包带走啦？路上小心。',
      '存档码收好了，换设备也不怕。'
    ] },
    // 18. 写完一条反思
    reflection_done: { expr: 'smile', priority: 20, oncePerDay: true, lines: [
      '写下来就是你的了，谁都抢不走。',
      '记录下的每一步，都会在编年史里留痕。',
      '静下来想想，也是一种远征。'
    ] }
  };

  /* 随机闲聊（点气泡，无冷却，表情随机 smile/wink） */
  const CHAT_LINES = [
    '迷雾地图上，每一团迷雾都藏着一片等待征服的大陆。',
    '委托板会发布试炼，点亮节点就能获得战力与金币。',
    '编年史会记录你的每一次远征，记得常常翻阅。',
    '战力越高，能接下的试炼越难，奖励也越丰厚。',
    '征服大陆靠的是日复一日的远征，而非一时的心血来潮。',
    '金币是这片大陆的硬通货，攒着总有用处。',
    '经验满了就会升级，升级那一刻，整片大陆都会为你喝彩。',
    '每个冒险者都有自己的誓言，别忘了当初为何出发。',
    '静思庭的风，能让人想清楚很多事。',
    '要我说，你今天已经做得很好了。'
  ];

  /* ============================================================
     状态与队列
     ============================================================ */
  let queue = [];        // 排队中的事件
  let current = null;    // 当前播放 { id, priority }
  let lastAt = {};       // 事件 id → 上次触发时间戳
  let npcTimer = null;
  let npcFullText = '';
  let npcTyping = false;

  function today() { return XH.util.localDateKey(new Date()); }

  function canTrigger(eventId) {
    const ev = EVENTS[eventId];
    const last = lastAt[eventId];
    if (!last) return true;
    if (ev.cooldown && Date.now() - last < ev.cooldown) return false;
    if (ev.oncePerDay && XH.util.localDateKey(new Date(last)) === today()) return false;
    return true;
  }

  /* ---------- 表情切换（加载失败回退 SVG） ----------
     文件命名约定：img/opt/ada-{expr}.png，加载失败自动回退 SVG。
     已接入表情：smile / laugh / serious / wink / salute */
  function setExpression(expr) {
    const avatar = $('npc-avatar');
    if (!avatar) return;
    let img = avatar.querySelector('.npc-avatar-img');
    if (!img) {
      avatar.innerHTML = '';
      img = document.createElement('img');
      img.className = 'npc-avatar-img';
      img.alt = '阿黛';
      avatar.appendChild(img);
    }
    img.onerror = function () { avatar.innerHTML = SVG_FALLBACK; };
    img.src = 'img/opt/ada-' + expr + '.png';
  }

  /* ---------- 打字机 ---------- */
  function npcSay(text, onDone) {
    npcFullText = text;
    npcTyping = true;
    const el = $('npc-text');
    let i = 0;
    el.textContent = '';
    clearInterval(npcTimer);
    npcTimer = setInterval(function () {
      i++;
      if (i % 3 === 0 && XH.audio) XH.audio.play('type');
      el.textContent = text.slice(0, i);
      if (i >= text.length) {
        clearInterval(npcTimer);
        npcTyping = false;
        if (onDone) onDone();
      }
    }, 55);
  }

  function npcStop() {
    clearInterval(npcTimer);
    npcTyping = false;
  }

  /* ---------- 台词解析（含时段/连续天数梯度） ---------- */
  function resolve(eventId, params) {
    const ev = EVENTS[eventId];
    let expr = ev.expr;
    let lines = ev.lines;

    if (eventId === 'daily_greet') {
      const h = new Date().getHours();
      lines = (h < 11) ? lines.morning : (h < 18) ? lines.noon : lines.evening;
    } else if (eventId === 'streak') {
      const c = (params && params.count) || 0;
      for (let i = 0; i < ev.tiers.length; i++) {
        if (c >= ev.tiers[i].min) { expr = ev.tiers[i].expr; lines = ev.tiers[i].lines; break; }
      }
    }

    return { expr: expr, line: lines[(Math.random() * lines.length) | 0] };
  }

  function play(eventId, params) {
    const ev = EVENTS[eventId];
    const r = resolve(eventId, params);
    current = { id: eventId, priority: ev.priority };
    setExpression(r.expr);
    npcSay(r.line, function () {
      current = null;
      dequeue();
    });

    // 不在大厅时弹轻提示，让用户当场看到阿黛的反应
    const hall = $('screen-hall');
    if (hall && !hall.classList.contains('active') && XH.ui && XH.ui.showToast) {
      XH.ui.showToast('阿黛：' + r.line);
    }
  }

  function dequeue() {
    if (queue.length) {
      const item = queue.shift();
      play(item.id, item.params);
    }
  }

  /* ---------- 核心触发 ---------- */
  function trigger(eventId, params) {
    const ev = EVENTS[eventId];
    if (!ev) return;
    if (!canTrigger(eventId)) return;
    lastAt[eventId] = Date.now();

    if (!current) {
      play(eventId, params);
    } else if (ev.priority > current.priority) {
      npcStop();          // 高优先级插队：打断当前
      play(eventId, params);
    } else {
      queue.push({ id: eventId, params: params });  // 低优先级排队
    }
  }

  /* ---------- 点气泡：随机闲聊 ---------- */
  function chat() {
    if (npcTyping) {
      npcStop();
      $('npc-text').textContent = npcFullText;
      current = null;
      dequeue();
    } else {
      setExpression(Math.random() < 0.5 ? 'smile' : 'wink');
      npcSay(CHAT_LINES[(Math.random() * CHAT_LINES.length) | 0]);
    }
  }

  /* ---------- 连续上线天数 ---------- */
  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return XH.util.localDateKey(d);
  }

  function updateStreak(state) {
    const ls = state.loginStreak || { count: 0, lastDate: '' };
    const firstToday = ls.lastDate !== today();
    if (firstToday) {
      ls.count = (ls.lastDate === yesterdayKey()) ? ls.count + 1 : 1;
      ls.lastDate = today();
      state.loginStreak = ls;
      XH.storage.save(state);
    }
    return { count: ls.count, firstToday: firstToday };
  }

  /* ---------- 进入大厅 ---------- */
  function onHallEnter() {
    const state = XH.state;
    if (!state) return;

    // 1. 新访客（无大陆）：引导开辟
    if (!state.continents || state.continents.length === 0) {
      updateStreak(state);
      trigger('first_visit');
      return;
    }

    const streak = updateStreak(state);

    // 2. 每日首次（时段问候）+ 16. 连续 N 天
    if (streak.firstToday) {
      trigger('daily_greet');
      if (streak.count >= 3) trigger('streak', { count: streak.count });
    }

    // 9. 决战日 ≤7 天
    const urgent = state.continents.some(function (c) {
      if (!c.battleDay || c.status === 'conquered') return false;
      const days = XH.util.daysUntil(c.battleDay);
      return days != null && days >= 0 && days <= 7;
    });
    if (urgent) trigger('battle_day');
  }

  XH.ada = { trigger: trigger, chat: chat, onHallEnter: onHallEnter, setExpression: setExpression };
})();
