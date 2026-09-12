/* ============================================================
   学海大陆 · 游戏逻辑（职业 / 奖励 / 升级）
   ============================================================ */
(function () {
  'use strict';
  const XH = (window.XH = window.XH || {});

  /* 职业（纯装饰，无数值差异） */
  XH.CLASSES = [
    { id: 'arcanist',  name: '奥术法师', rune: '奥', color: '#00d9ff',
      desc: '以奥能点亮迷雾，用咒语揭开未知大陆的面纱。' },
    { id: 'bard',      name: '吟游诗人', rune: '吟', color: '#ffd700',
      desc: '以歌谣记录远征，用旋律鼓舞每一个黎明。' },
    { id: 'runesmith', name: '符文工匠', rune: '符', color: '#f39c12',
      desc: '以符文铸造装备，把点滴淬炼成钢铁意志。' },
    { id: 'alchemist', name: '炼金术士', rune: '炼', color: '#e94560',
      desc: '以炼金化腐朽为神奇，将每次试炼凝成精华。' },
    { id: 'guardian',  name: '守望骑士', rune: '守', color: '#ff6b6b',
      desc: '以盾牌守护誓言，用长枪刺穿每一团迷雾。' }
  ];

  /* 奖励三档：按节点战力区间发放 */
  XH.REWARD_TIERS = [
    { max: 20,       exp: 10, gold: 5  },
    { max: 60,       exp: 20, gold: 10 },
    { max: Infinity, exp: 30, gold: 15 }
  ];

  /* 每日金币上限（委托 / 大陆征服 独立） */
  XH.GOLD_CAPS = { node: 50, quest: 30 };

  XH.game = {
    classById: function (id) {
      return XH.CLASSES.find(function (c) { return c.id === id; }) || XH.CLASSES[0];
    },

    /** 根据节点战力返回 { exp, gold } 奖励 */
    rewardForPower: function (power) {
      for (var i = 0; i < XH.REWARD_TIERS.length; i++) {
        if (power <= XH.REWARD_TIERS[i].max) {
          return { exp: XH.REWARD_TIERS[i].exp, gold: XH.REWARD_TIERS[i].gold };
        }
      }
      return { exp: 30, gold: 15 };
    },

    /** 升到下一级所需经验：第 1 级需 100，之后每级 = 上一级 ×1.5 */
    expNeeded: function (level) {
      return Math.floor(100 * Math.pow(1.5, level - 1));
    },

    /**
     * 增加经验并结算升级（可能连续升级）。
     * 返回 true 表示发生了升级。
     */
    addExp: function (state, amount) {
      const a = state.adventurer;
      a.exp += amount;
      let leveled = false;
      let guard = 0;
      while (a.exp >= XH.game.expNeeded(a.level) && guard < 1000) {
        a.exp -= XH.game.expNeeded(a.level);
        a.level += 1;
        leveled = true;
        guard++;
      }
      return leveled;
    },

    /** 某来源今日已领取的金币（跨天自动归零） */
    goldToday: function (state, source) {
      const today = XH.util.localDateKey(new Date());
      const b = state.bounty && state.bounty[source];
      if (b && b.date === today) return b.gold || 0;
      return 0;
    },

    /**
     * 发放金币，受「该来源每日上限」约束。
     * 返回实际发放的金币数（EXP / 战力不受任何上限）。
     */
    grantGold: function (state, source, amount) {
      const cap = XH.GOLD_CAPS[source];
      if (cap == null) return amount;
      const today = XH.util.localDateKey(new Date());
      let b = state.bounty && state.bounty[source];
      let already = 0;
      if (b && b.date === today) already = b.gold || 0;
      const room = Math.max(0, cap - already);
      const granted = Math.min(amount, room);
      state.bounty[source] = { date: today, gold: already + granted };
      state.adventurer.gold += granted;
      return granted;
    },

    /**
     * 结算一次「点亮」：
     * 发放 tier 奖励（经验全额、金币受上限）、记录日志、处理升级。
     * source 标记来源：'node'（迷雾叶子，计入战力）或 'quest'（委托，不计入战力）。
     * 返回 { reward: { exp, gold, tierGold, capped }, leveled }。
     * 注意：总战力由已点亮叶子派生（见 XH.map.totalPower），此处不再累加。
     */
    applyReward: function (state, power, source) {
      source = source || 'node';
      const r = XH.game.rewardForPower(power);
      const gold = XH.game.grantGold(state, source, r.gold);
      const leveled = XH.game.addExp(state, r.exp);
      state.log.push({
        type: 'reward',
        source: source,
        power: power,
        exp: r.exp,
        gold: gold,
        at: Date.now()
      });
      return {
        reward: { exp: r.exp, gold: gold, tierGold: r.gold, capped: gold < r.gold },
        leveled: leveled
      };
    },

    /**
     * 结算一次「固定奖励」（如静思庭发愿/反思）：
     * 金币/经验直接发放，不受任何每日上限约束；仅记录日志 + 处理升级。
     */
    applyFlatReward: function (state, exp, gold, source) {
      state.adventurer.gold += gold;
      const leveled = XH.game.addExp(state, exp);
      state.log.push({
        type: 'reward',
        source: source,
        power: 0,
        exp: exp,
        gold: gold,
        at: Date.now()
      });
      return {
        reward: { exp: exp, gold: gold, tierGold: gold, capped: false },
        leveled: leveled
      };
    }
  };
})();
