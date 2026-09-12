/* ============================================================
   学海大陆 · 迷雾地图数据模型（大陆 / 节点树 / 点亮）
   节点模型：
     { id, name, parentId(null=根), type('region'|'trial'),
       power(仅试炼有意义), status('mist'|'lit') }
   规则：
     - 只有叶子（trial）能被手动点亮
     - 区域（region）战力 = 所有后代叶子战力之和
     - 某区域的所有后代叶子全部点亮时，该区域自动点亮
   ============================================================ */
(function () {
  'use strict';
  const XH = (window.XH = window.XH || {});

  function genId(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  XH.map = {
    genId: genId,

    /* ---------- 大陆 ---------- */
    /** 创建大陆，并自动附带一个根区域节点（与大陆同名） */
    createContinent: function (state, name, reason, battleDay) {
      const rootId = genId('node');
      const cont = {
        id: genId('cont'),
        name: name,
        reason: reason || '',
        battleDay: battleDay || '',
        ultimate: false,
        status: 'active', // 'active' | 'conquered'
        nodes: [{ id: rootId, name: name, parentId: null, type: 'region', power: 0, status: 'mist' }],
        createdAt: Date.now()
      };
      state.continents.push(cont);
      return cont;
    },

    getContinent: function (state, contId) {
      return state.continents.find(function (c) { return c.id === contId; }) || null;
    },

    getRoot: function (cont) {
      return cont.nodes.find(function (n) { return n.parentId === null; }) || null;
    },

    getNode: function (cont, nodeId) {
      return cont.nodes.find(function (n) { return n.id === nodeId; }) || null;
    },

    getChildren: function (cont, parentId) {
      return cont.nodes.filter(function (n) { return n.parentId === parentId; });
    },

    /** 某节点的所有后代（不含自身） */
    getDescendants: function (cont, nodeId) {
      const result = [];
      const queue = XH.map.getChildren(cont, nodeId);
      for (let i = 0; i < queue.length; i++) {
        const n = queue[i];
        result.push(n);
        const kids = XH.map.getChildren(cont, n.id);
        for (let j = 0; j < kids.length; j++) queue.push(kids[j]);
      }
      return result;
    },

    /** 某节点的所有后代叶子（trial，含自身若是叶子） */
    getLeafDescendants: function (cont, nodeId) {
      const node = XH.map.getNode(cont, nodeId);
      if (!node) return [];
      if (node.type === 'trial') return [node];
      const kids = XH.map.getChildren(cont, node.id);
      let leaves = [];
      for (let i = 0; i < kids.length; i++) {
        leaves = leaves.concat(XH.map.getLeafDescendants(cont, kids[i].id));
      }
      return leaves;
    },

    /* ---------- 战力 / 进度 ---------- */
    /** 战力：试炼=自身战力；区域=后代叶子战力之和 */
    nodePower: function (cont, node) {
      if (node.type === 'trial') return node.power;
      const leaves = XH.map.getLeafDescendants(cont, node.id);
      let sum = 0;
      for (let i = 0; i < leaves.length; i++) sum += (leaves[i].power || 0);
      return sum;
    },

    /** 进度（叶子计数）：{ lit, total } */
    nodeProgress: function (cont, node) {
      const leaves = XH.map.getLeafDescendants(cont, node.id);
      let lit = 0;
      for (let i = 0; i < leaves.length; i++) if (leaves[i].status === 'lit') lit++;
      return { lit: lit, total: leaves.length };
    },

    /** 大陆进度（根节点进度） */
    continentProgress: function (cont) {
      const root = XH.map.getRoot(cont);
      return XH.map.nodeProgress(cont, root);
    },

    /** 大陆总战力（根节点战力） */
    continentPower: function (cont) {
      const root = XH.map.getRoot(cont);
      return XH.map.nodePower(cont, root);
    },

    /** 大陆已点亮战力（已点亮后代叶子战力之和） */
    continentLitPower: function (cont) {
      const root = XH.map.getRoot(cont);
      if (!root) return 0;
      const leaves = XH.map.getLeafDescendants(cont, root.id);
      let sum = 0;
      for (let i = 0; i < leaves.length; i++) if (leaves[i].status === 'lit') sum += (leaves[i].power || 0);
      return sum;
    },

    /** 大陆征服度（百分比，0~100） */
    conquestPercent: function (cont) {
      const total = XH.map.continentPower(cont);
      if (total <= 0) return 0;
      return Math.round((XH.map.continentLitPower(cont) / total) * 100);
    },

    /** 全局总战力 = 所有已点亮叶子战力之和 */
    totalPower: function (state) {
      let total = 0;
      for (let i = 0; i < state.continents.length; i++) {
        const root = XH.map.getRoot(state.continents[i]);
        if (!root) continue;
        const leaves = XH.map.getLeafDescendants(state.continents[i], root.id);
        for (let j = 0; j < leaves.length; j++) {
          if (leaves[j].status === 'lit') total += (leaves[j].power || 0);
        }
      }
      return total;
    },

    /** 从节点向上到根的祖先链（不含自身，含根），自底向上： [父, 祖父, ..., 根] */
    getAncestorChain: function (cont, nodeId) {
      const chain = [];
      let cur = XH.map.getNode(cont, nodeId);
      while (cur && cur.parentId !== null) {
        cur = XH.map.getNode(cont, cur.parentId);
        if (cur) chain.push(cur);
      }
      return chain;
    },

    /* ---------- 增删 ---------- */
    /** 在某父节点下新增节点 */
    addNode: function (state, contId, parentId, data) {
      const cont = XH.map.getContinent(state, contId);
      if (!cont) return null;
      const node = {
        id: genId('node'),
        name: data.name,
        parentId: parentId,
        type: data.type, // 'region' | 'trial'
        power: data.type === 'trial' ? (Number(data.power) || 0) : 0,
        status: 'mist'
      };
      cont.nodes.push(node);
      return node;
    },

    /** 删除节点及其所有后代（根节点不可删除） */
    deleteNode: function (state, contId, nodeId) {
      const cont = XH.map.getContinent(state, contId);
      if (!cont) return;
      const node = XH.map.getNode(cont, nodeId);
      if (!node || node.parentId === null) return;
      const toRemove = {};
      toRemove[nodeId] = true;
      const desc = XH.map.getDescendants(cont, nodeId);
      for (let i = 0; i < desc.length; i++) toRemove[desc[i].id] = true;
      cont.nodes = cont.nodes.filter(function (n) { return !toRemove[n.id]; });
    },

    /** 重新计算所有区域节点的点亮状态 + 大陆状态（增删后调用） */
    recomputeLitStates: function (state, contId) {
      const cont = XH.map.getContinent(state, contId);
      if (!cont) return;
      for (let i = 0; i < cont.nodes.length; i++) {
        const n = cont.nodes[i];
        if (n.type !== 'region') continue;
        const p = XH.map.nodeProgress(cont, n);
        n.status = (p.total > 0 && p.lit === p.total) ? 'lit' : 'mist';
      }
      const root = XH.map.getRoot(cont);
      cont.status = (root && root.status === 'lit') ? 'conquered' : 'active';
    },

    /* ---------- 点亮（核心交互） ---------- */
    /**
     * 点亮一个叶子节点，发放奖励，并向上逐级判定自动点亮。
     * 返回：
     *   { reward, leveled, cascade, conquered }
     *   cascade: [ { nodeId, name, isRoot, newlyLit, before:{lit,total}, after:{lit,total} } ]
     *            自底向上（[父, ..., 根]），供 UI 依次播放进度条增长动画
     */
    lightLeaf: function (state, contId, nodeId) {
      const cont = XH.map.getContinent(state, contId);
      const leaf = XH.map.getNode(cont, nodeId);
      if (!leaf || leaf.type !== 'trial' || leaf.status === 'lit') {
        return { error: 'invalid' };
      }

      const chain = XH.map.getAncestorChain(cont, nodeId); // [父, ..., 根]
      const snapshot = [];
      for (let i = 0; i < chain.length; i++) {
        snapshot.push(XH.map.nodeProgress(cont, chain[i]));
      }

      // 1. 点亮叶子
      leaf.status = 'lit';

      // 2. 发放奖励（经验/金币 + 升级；战力由点亮叶子派生，不在此处累加）
      const res = XH.game.applyReward(state, leaf.power);

      // 3. 向上判定自动点亮
      const newlyLit = [];
      let conquered = false;
      for (let i = 0; i < chain.length; i++) {
        const n = chain[i];
        const p = XH.map.nodeProgress(cont, n);
        if (p.total > 0 && p.lit === p.total && n.status === 'mist') {
          n.status = 'lit';
          newlyLit.push(n.id);
          if (n.parentId === null) {
            cont.status = 'conquered';
            conquered = true;
          }
        }
      }

      const cascade = [];
      for (let i = 0; i < chain.length; i++) {
        cascade.push({
          nodeId: chain[i].id,
          name: chain[i].name,
          isRoot: chain[i].parentId === null,
          newlyLit: newlyLit.indexOf(chain[i].id) !== -1,
          before: snapshot[i],
          after: XH.map.nodeProgress(cont, chain[i])
        });
      }

      return {
        reward: res.reward,
        leveled: res.leveled,
        cascade: cascade,
        conquered: conquered
      };
    }
  };
})();
