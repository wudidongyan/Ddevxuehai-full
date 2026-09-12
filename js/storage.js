/* ============================================================
   学海大陆 · 存档层（localStorage）
   ============================================================ */
(function () {
  'use strict';
  const XH = (window.XH = window.XH || {});

  const KEY = 'xuehai_save_v1';

  XH.util = {
    genId: function (prefix) {
      return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },
    /** 本地时区的 YYYY-MM-DD（用于每日零点重置/编年史） */
    localDateKey: function (d) {
      d = d || new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    },
    /** 距某日期（YYYY-MM-DD）的自然日数：正数=未来，0=今天，负数=已过 */
    daysUntil: function (dateStr) {
      if (!dateStr) return null;
      const today = XH.util.localDateKey(new Date());
      const p = function (s) { const a = s.split('-'); return { y: +a[0], m: +a[1], d: +a[2] }; };
      const t1 = p(today), t2 = p(dateStr);
      return Math.round((Date.UTC(t2.y, t2.m - 1, t2.d) - Date.UTC(t1.y, t1.m - 1, t1.d)) / 86400000);
    }
  };

  /** 预置的 3 个示例委托 */
  function presetQuests() {
    const mk = function (id, name, power) {
      return { id: id, name: name, power: power, status: 'mist', builtin: true,
               type: 'checkin', motive: '', minAmount: 0, unit: '', records: [] };
    };
    return [
      mk('q_preset_1', '晨光试炼', 20),
      mk('q_preset_2', '迷雾巡查', 40),
      mk('q_preset_3', '深渊远征', 80)
    ];
  }

  /* UTF-8 字节 ↔ Base64（正确处理中文，避免乱码） */
  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  /**
   * 生成一份全新的冒险者存档。
   * 结构：冒险者信息 / 大陆列表 / 委托列表 / 编年史 / 日志。
   */
  function defaultState(name, classId, oath) {
    return {
      version: 1,
      adventurer: {
        name: name || '',
        classId: classId || 'arcanist',
        oath: oath || '',
        level: 1,
        exp: 0,          // 当前等级累计经验
        gold: 0,         // 金币
        power: 0,        // 兼容字段（总战力现由已点亮叶子派生，见 XH.map.totalPower）
        createdAt: Date.now()
      },
      continents: [],    // 大陆列表：{ id, name, reason, status, nodes: [...], createdAt }
      quests: presetQuests(),          // 委托列表：{ id, name, power, status, builtin, type, motive, minAmount, unit, records }
      questLastReset: XH.util.localDateKey(new Date()), // 委托上次重置日期
      bounty: {                         // 每日赏金（委托 / 大陆征服 独立计数）
        quest: { date: XH.util.localDateKey(new Date()), gold: 0 },
        node:  { date: XH.util.localDateKey(new Date()), gold: 0 }
      },
      meditation: {                     // 静思庭：发愿 + 反思
        vows: [],          // { date, text, targetPower, at }
        reflections: [],   // { text, at }
        lastPromptDate: '' // 大厅发愿提示上次展示日期
      },
      loginStreak: { count: 0, lastDate: '' },  // 连续上线天数（阿黛事件）
      chronicle: [],     // 编年史：{ date, nodesLit, questsDone, power, exp, gold, note, questDetails, savedAt }
      log: []            // 日志：{ type, source, power, exp, gold, at }
    };
  }

  XH.storage = {
    KEY: KEY,

    defaultState: defaultState,
    presetQuests: presetQuests,

    /** 校验并补齐历史存档缺失字段；无效返回 null */
    normalize: function (state) {
      if (!state || !state.adventurer || typeof state.adventurer.level !== 'number') return null;
      // 迁移：补齐历史存档缺失的新字段
      if (!Array.isArray(state.quests)) state.quests = [];
      if (typeof state.questLastReset !== 'string') {
        if (state.quests.length === 0) state.quests = presetQuests();
        state.questLastReset = XH.util.localDateKey(new Date());
      }
      // 委托：补齐类型/执念/记录字段
      state.quests.forEach(function (q) {
        if (q.type !== 'record' && q.type !== 'checkin') q.type = 'checkin';
        if (typeof q.motive !== 'string') q.motive = '';
        if (q.minAmount == null) q.minAmount = 0;
        if (typeof q.unit !== 'string') q.unit = '';
        if (!Array.isArray(q.records)) q.records = [];
      });
      // 大陆：补齐征服理由 / 决战之日 / 终极标记
      if (!Array.isArray(state.continents)) state.continents = [];
      state.continents.forEach(function (c) {
        if (typeof c.reason !== 'string') c.reason = '';
        if (typeof c.battleDay !== 'string') c.battleDay = '';
        if (typeof c.ultimate !== 'boolean') c.ultimate = false;
      });
      // 赏金计数
      if (!state.bounty || !state.bounty.quest || !state.bounty.node) {
        const today = XH.util.localDateKey(new Date());
        state.bounty = { quest: { date: today, gold: 0 }, node: { date: today, gold: 0 } };
      }
      if (!Array.isArray(state.chronicle)) state.chronicle = [];
      if (!Array.isArray(state.log)) state.log = [];
      // 静思庭
      if (!state.meditation || !Array.isArray(state.meditation.vows) || !Array.isArray(state.meditation.reflections)) {
        state.meditation = { vows: [], reflections: [], lastPromptDate: '' };
      }
      // 连续上线天数（阿黛事件）
      if (!state.loginStreak || typeof state.loginStreak.count !== 'number') {
        state.loginStreak = { count: 0, lastDate: '' };
      }
      return state;
    },

    /** 读取存档；无存档或损坏时返回 null */
    load: function () {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        return XH.storage.normalize(JSON.parse(raw));
      } catch (e) {
        return null;
      }
    },

    /** 写入存档 */
    save: function (state) {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
        return true;
      } catch (e) {
        return false;
      }
    },

    /** 导出存档码（UTF-8 + Base64，含版本号） */
    exportCode: function (state) {
      const payload = {
        app: 'xuehai',
        codeVersion: 1,
        savedAt: Date.now(),
        data: state
      };
      return bytesToBase64(new TextEncoder().encode(JSON.stringify(payload)));
    },

    /** 解析并校验存档码；无效返回 null（不修改当前存档） */
    parseCode: function (code) {
      try {
        const codeStr = String(code).replace(/\s+/g, ''); // 去除空白/换行，防粘贴折行
        if (!codeStr) return null;
        const json = new TextDecoder().decode(base64ToBytes(codeStr));
        const payload = JSON.parse(json);
        if (!payload || payload.app !== 'xuehai') return null;
        if (typeof payload.codeVersion !== 'number') return null;
        return XH.storage.normalize(payload.data);
      } catch (e) {
        return null;
      }
    },

    /** 清除存档 */
    clear: function () {
      localStorage.removeItem(KEY);
    }
  };
})();
