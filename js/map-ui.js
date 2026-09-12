/* ============================================================
   学海大陆 · 迷雾地图 UI（大陆列表 / 地图页 / 点亮动画 / 弹窗）
   ============================================================ */
(function () {
  'use strict';
  const XH = (window.XH = window.XH || {});
  const $ = function (id) { return document.getElementById(id); };

  const nav = { contId: null, nodeId: null }; // nodeId = 当前区域节点（根开始）
  const STATUS_TEXT = { active: '进行中', conquered: '已征服' };

  let deleteTarget = null;
  let nodeType = 'region';
  let addParentId = null;
  let battleDayTargetId = null;
  let battleDayForceUltimate = false;
  let ultimateTargetId = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function showOverlay(id) { $(id).classList.add('open'); }
  function hideOverlay(id) { $(id).classList.remove('open'); }

  function currentCont() { return XH.map.getContinent(XH.state, nav.contId); }
  function currentNode() { const c = currentCont(); return c ? XH.map.getNode(c, nav.nodeId) : null; }

  /* ============================================================
     大陆列表
     ============================================================ */
  function renderContinents() {
    const list = $('continent-list');
    const empty = $('continent-empty');
    const conts = XH.state.continents;
    list.innerHTML = '';

    if (!conts.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    // 终极大陆置顶
    const sorted = conts.slice().sort(function (a, b) {
      return (b.ultimate ? 1 : 0) - (a.ultimate ? 1 : 0);
    });

    sorted.forEach(function (cont) {
      const p = XH.map.continentProgress(cont);
      const pw = XH.map.continentPower(cont);
      const pct = p.total ? (p.lit / p.total) * 100 : 0;
      const card = document.createElement('div');
      card.className = 'continent-card pixel-panel' + (cont.status === 'conquered' ? ' conquered' : '') + (cont.ultimate ? ' ultimate' : '');
      const reason = cont.reason
        ? '<div class="motive-line zh" title="' + esc(cont.reason) + '">' + esc(cont.reason) + '</div>'
        : '<div class="motive-line motive-empty zh">（无征服理由）</div>';
      const ultimateBadge = cont.ultimate ? '<span class="ultimate-badge zh">终极远征</span>' : '';

      card.innerHTML =
        '<div class="cc-head">' +
          '<span class="cc-name">' + esc(cont.name) + '</span>' +
          '<span class="badge ' + cont.status + '">' + STATUS_TEXT[cont.status] + '</span>' +
          ultimateBadge +
        '</div>' +
        reason +
        '<div class="cc-power">总战力 ' + pw + '</div>' +
        '<div class="cc-bar"><div class="cc-fill" style="transform:scaleX(' + (pct / 100) + ')"></div></div>' +
        '<div class="cc-progress zh">肃清 ' + p.lit + '/' + p.total + '</div>' +
        battleDayLine(cont) +
        '<div class="cc-actions">' +
          '<button class="cc-btn cc-btn-day" data-cont="' + cont.id + '">' + (cont.battleDay ? '决战之日' : '补绑决战之日') + '</button>' +
          '<button class="cc-btn cc-btn-ultimate" data-cont="' + cont.id + '">' + (cont.ultimate ? '已钦定' : '钦定为终极') + '</button>' +
        '</div>';

      card.addEventListener('click', function () { openContinent(cont.id); });
      const reasonEl = card.querySelector('.motive-line');
      if (reasonEl) reasonEl.addEventListener('click', function (e) {
        e.stopPropagation();
        XH.ui.showMotiveModal(cont.reason || '尚未立下征服理由');
      });
      card.querySelector('.cc-btn-day').addEventListener('click', function (e) {
        e.stopPropagation();
        openBattleDayModal(cont.id, false);
      });
      card.querySelector('.cc-btn-ultimate').addEventListener('click', function (e) {
        e.stopPropagation();
        onClickUltimate(cont.id);
      });
      list.appendChild(card);
    });
  }

  function battleDayLine(cont) {
    if (!cont.battleDay) return '';
    const days = XH.util.daysUntil(cont.battleDay);
    const text = (days != null && days > 0) ? '距决战之日还有 ' + days + ' 天' : '决战日已到';
    return '<div class="cc-battleday zh">' + text + '</div>';
  }

  function showContinentList() {
    renderContinents();
    XH.ui.showScreen('screen-continents');
  }

  function bindContinents() {
    $('btn-continents-back').addEventListener('click', function () {
      XH.ui.renderStatusBar();
      XH.ui.showScreen('screen-hall');
    });
    $('btn-new-continent').addEventListener('click', function () {
      $('continent-name-input').value = '';
      $('continent-reason').value = '';
      $('continent-battleday').value = '';
      $('continent-modal-error').textContent = '';
      showOverlay('continent-modal-overlay');
      $('continent-name-input').focus();
    });
    $('btn-continent-confirm').addEventListener('click', confirmNewContinent);
    $('btn-continent-cancel').addEventListener('click', function () { hideOverlay('continent-modal-overlay'); });
  }

  function confirmNewContinent() {
    const name = $('continent-name-input').value.trim();
    if (!name || name.length > 12) {
      $('continent-modal-error').textContent = '大陆之名需为 1~12 个字';
      if (XH.audio) XH.audio.play('error');
      return;
    }
    const reason = $('continent-reason').value.trim();
    if (!reason) {
      $('continent-modal-error').textContent = '请写下征服理由（为何要征服这片大陆？）';
      if (XH.audio) XH.audio.play('error');
      return;
    }
    if (reason.length > 30) {
      $('continent-modal-error').textContent = '征服理由最多 30 字';
      if (XH.audio) XH.audio.play('error');
      return;
    }
    const battleDay = $('continent-battleday').value || '';
    const cont = XH.map.createContinent(XH.state, name, reason, battleDay);
    XH.storage.save(XH.state);
    hideOverlay('continent-modal-overlay');
    openContinent(cont.id);
  }

  /* ============================================================
     进入大陆 / 地图渲染
     ============================================================ */
  function openContinent(contId) {
    nav.contId = contId;
    const cont = XH.map.getContinent(XH.state, contId);
    nav.nodeId = XH.map.getRoot(cont).id;
    renderMap();
    XH.ui.showScreen('screen-map');
  }

  function renderMap() {
    const cont = currentCont();
    const node = currentNode();
    if (!cont || !node) return;

    $('map-continent-name').textContent = cont.name;
    const badge = $('map-continent-status');
    badge.textContent = STATUS_TEXT[cont.status];
    badge.className = 'badge ' + cont.status;
    updateMapBounty();

    renderBreadcrumb(cont, node);
    renderCurrentRegion(cont, node);
    renderChildren(cont, node);
  }

  function updateMapBounty() {
    const gold = XH.game.goldToday(XH.state, 'node');
    const cap = XH.GOLD_CAPS.node;
    const capped = gold >= cap;
    const el = $('map-bounty');
    if (el) {
      el.textContent = capped ? '已领完' : '今日征服赏金 ' + gold + '/' + cap;
      el.classList.toggle('capped', capped);
    }
  }

  function renderBreadcrumb(cont, node) {
    const bc = $('map-breadcrumb');
    bc.innerHTML = '';
    const chain = XH.map.getAncestorChain(cont, node.id); // [父,...,根]
    const ordered = chain.slice().reverse();               // [根,...,父]
    ordered.forEach(function (anc) {
      const p = XH.map.nodeProgress(cont, anc);
      const pct = p.total ? (p.lit / p.total) * 100 : 0;
      const crumb = document.createElement('span');
      crumb.className = 'crumb' + (anc.status === 'lit' ? ' lit' : '');
      crumb.setAttribute('data-node-id', anc.id);
      crumb.innerHTML =
        '<span class="crumb-name">' + esc(anc.name) + '</span>' +
        '<span class="crumb-fillwrap"><span class="crumb-fill" style="transform:scaleX(' + (pct / 100) + ')"></span></span>' +
        '<span class="crumb-arrow">▸</span>';
      crumb.addEventListener('click', function () {
        nav.nodeId = anc.id;
        renderMap();
      });
      bc.appendChild(crumb);
    });
  }

  function renderCurrentRegion(cont, node) {
    $('current-region-name').textContent = node.name;
    const p = XH.map.nodeProgress(cont, node);
    const pw = XH.map.nodePower(cont, node);
    $('current-region-counter').textContent = '肃清 ' + p.lit + '/' + p.total;
    $('current-region-power').textContent = '战力 ' + pw;
    const fill = $('current-region-fill');
    fill.style.transition = 'none';
    fill.style.transform = 'scaleX(' + (p.total ? p.lit / p.total : 0) + ')';
    $('current-region-card').classList.toggle('lit', node.status === 'lit');
  }

  function renderChildren(cont, node) {
    const grid = $('map-children');
    const empty = $('map-empty');
    const children = XH.map.getChildren(cont, node.id);
    grid.innerHTML = '';
    if (!children.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    children.forEach(function (child) {
      grid.appendChild(renderNodeCard(cont, child));
    });
  }

  function renderNodeCard(cont, node) {
    const isRegion = node.type === 'region';
    const isLit = node.status === 'lit';
    const p = XH.map.nodeProgress(cont, node);
    const pw = XH.map.nodePower(cont, node);
    const pct = p.total ? (p.lit / p.total) * 100 : 0;

    const card = document.createElement('div');
    card.className = 'node-card ' + (isRegion ? 'region' : 'trial') + ' ' + (isLit ? 'lit' : 'mist');
    card.setAttribute('data-node-id', node.id);

    let inner =
      '<div class="node-head">' +
        '<span class="node-name">' + esc(node.name) + '</span>' +
        '<span class="node-badge ' + (isRegion ? 'region-badge' : 'trial-badge') + '">' + (isRegion ? '区域' : '试炼') + '</span>' +
        '<button class="node-del" title="焚毁">✕</button>' +
      '</div>' +
      '<div class="node-power">战力 ' + pw + '</div>';

    if (isRegion) {
      inner +=
        '<div class="node-bar"><div class="node-fill" style="transform:scaleX(' + (pct / 100) + ')"></div></div>' +
        '<div class="node-progress zh">肃清 ' + p.lit + '/' + p.total + '</div>';
    } else {
      inner += '<div class="node-status zh">' + (isLit ? '已点亮' : '迷雾') + '</div>';
    }
    card.innerHTML = inner;

    card.querySelector('.node-del').addEventListener('click', function (e) {
      e.stopPropagation();
      openDeleteModal(node.id, node.name);
    });

    card.addEventListener('click', function (e) {
      if (isRegion) {
        nav.nodeId = node.id;
        renderMap();
      } else {
        onLeafClick(cont, node, e);
      }
    });

    return card;
  }

  /* ============================================================
     点亮交互
     ============================================================ */
  function onLeafClick(cont, leaf, evt) {
    if (leaf.status === 'lit') {
      XH.ui.showBurst(evt.clientX, evt.clientY, '已点亮', { color: '#9a9ab8', size: '16px' });
      if (XH.audio) XH.audio.play('error');
      return;
    }

    const result = XH.map.lightLeaf(XH.state, nav.contId, leaf.id);
    if (result.error) { XH.ui.showToast('此节点无法点亮'); return; }
    XH.storage.save(XH.state);

    const reward = result.reward;

    if (XH.audio) {
      XH.audio.play('light');
      if (!reward.capped) setTimeout(function () { XH.audio.play('gold'); }, 230);
    }

    // 1. 叶子卡片点亮动画
    const card = document.querySelector('.node-card[data-node-id="' + leaf.id + '"]');
    if (card) {
      card.classList.remove('mist');
      card.classList.add('lit', 'just-lit');
      const st = card.querySelector('.node-status');
      if (st) st.textContent = '已点亮';
      setTimeout(function () { card.classList.remove('just-lit'); }, 950);
    }

    // 2. 鼠标位置飘字（金币达到上限时显示"赏金已领完"）
    XH.ui.showRewardBurst(evt.clientX, evt.clientY, reward);

    // 阿黛事件：点亮普通/高战力试炼，赏金上限后仍继续点亮
    if (XH.ada) {
      XH.ada.trigger(leaf.power >= 61 ? 'light_high' : 'light_normal');
      if (reward.capped) XH.ada.trigger('bounty_capped');
    }

    // 3. 状态栏跳动
    XH.ui.updateStatusBar({
      gold: reward.gold > 0,
      power: true,
      exp: reward.exp > 0,
      level: result.leveled
    });
    updateMapBounty();

    // 4. 升级飘字
    if (result.leveled) {
      if (XH.audio) XH.audio.play('levelup');
      if (XH.ada) XH.ada.trigger('level_up');
      setTimeout(function () {
        XH.ui.showFloatText('LEVEL UP!', { color: '#f39c12', size: '52px' });
      }, 350);
    }

    // 5. 祖先进度条依次增长（自底向上传导）
    result.cascade.forEach(function (step, i) {
      const delay = 200 + i * 300;
      if (XH.audio) setTimeout(function () { XH.audio.play('transmit', i); }, delay);
      const fill = getBarFill(step.nodeId);
      const fromPct = step.before.total ? (step.before.lit / step.before.total) * 100 : 0;
      const toPct = step.after.total ? (step.after.lit / step.after.total) * 100 : 0;
      animateBar(fill, fromPct, toPct, delay, function () {
        if (step.newlyLit) {
          const shell = getNodeShell(step.nodeId);
          if (shell) {
            shell.classList.add('lit', 'just-lit');
            setTimeout(function () { shell.classList.remove('just-lit'); }, 950);
          }
          if (step.isRoot) {
            celebrateConquest(cont);
          } else {
            if (XH.audio) XH.audio.play('regionclear');
            if (XH.ada) XH.ada.trigger('region_clear');
            const r = shell ? shell.getBoundingClientRect() : null;
            if (r) {
              XH.ui.showBurst(r.left + r.width / 2, r.top + r.height / 2,
                '区域已肃清！', { color: '#f39c12', size: '24px' });
            } else {
              XH.ui.showFloatText('区域已肃清！', { color: '#f39c12', size: '30px' });
            }
          }
        }
      });
    });

    // 6. 同步当前区域卡片的计数
    updateCurrentRegionStats(cont);
  }

  function animateBar(fill, fromPct, toPct, delay, onDone) {
    if (!fill) { if (onDone) onDone(); return; }
    setTimeout(function () {
      fill.style.transition = 'none';
      fill.style.transform = 'scaleX(' + (fromPct / 100) + ')';
      void fill.offsetWidth;
      fill.style.transition = 'transform 0.34s steps(4)';
      fill.style.transform = 'scaleX(' + (toPct / 100) + ')';
      fill.classList.add('bar-glow');
      setTimeout(function () {
        fill.classList.remove('bar-glow');
        if (onDone) onDone();
      }, 360);
    }, delay);
  }

  function getBarFill(nodeId) {
    if (nodeId === nav.nodeId) return $('current-region-fill');
    const crumb = document.querySelector('.crumb[data-node-id="' + nodeId + '"]');
    return crumb ? crumb.querySelector('.crumb-fill') : null;
  }

  function getNodeShell(nodeId) {
    if (nodeId === nav.nodeId) return $('current-region-card');
    return document.querySelector('.crumb[data-node-id="' + nodeId + '"]');
  }

  function updateCurrentRegionStats(cont) {
    const node = currentNode();
    if (!node) return;
    const p = XH.map.nodeProgress(cont, node);
    $('current-region-counter').textContent = '肃清 ' + p.lit + '/' + p.total;
  }

  function celebrateConquest(cont) {
    if (XH.audio) XH.audio.play('conquer');
    if (cont.ultimate) {
      if (XH.ada) XH.ada.trigger('expedition_finale');
      XH.ui.showFloatText('远征终章！\n' + cont.name + ' · 终极大陆已征服', { color: '#ffd700', size: '58px', duration: 4200 });
      spawnSparkles();
      setTimeout(function () { spawnSparkles(); }, 700);
    } else {
      if (XH.ada) XH.ada.trigger('continent_clear');
      XH.ui.showFloatText('大陆已征服！\n' + cont.name, { color: '#ffd700', size: '52px', duration: 3200 });
      spawnSparkles();
    }
    const badge = $('map-continent-status');
    badge.textContent = STATUS_TEXT[cont.status];
    badge.className = 'badge ' + cont.status;
  }

  function spawnSparkles() {
    const layer = $('float-text-layer');
    const colors = ['#ffd700', '#e94560', '#00d9ff', '#f39c12', '#ff6b6b', '#ffffff'];
    for (let i = 0; i < 50; i++) {
      const s = document.createElement('div');
      s.className = 'sparkle';
      s.style.left = (Math.random() * 100) + 'vw';
      s.style.top = '-5vh';
      s.style.background = colors[(Math.random() * colors.length) | 0];
      const size = 2 + Math.random() * 4;
      s.style.width = size + 'px';
      s.style.height = size + 'px';
      s.style.animationDuration = (1.6 + Math.random() * 2) + 's';
      s.style.animationDelay = (Math.random() * 0.6) + 's';
      layer.appendChild(s);
      setTimeout(function () { s.remove(); }, 4200);
    }
  }

  /* ============================================================
     增设 / 删除节点
     ============================================================ */
  function openNodeModal() {
    addParentId = nav.nodeId;
    nodeType = 'region';
    $('node-name').value = '';
    $('node-power').value = '';
    $('node-modal-error').textContent = '';
    setTypeUI('region');
    showOverlay('node-modal-overlay');
    $('node-name').focus();
  }

  function setTypeUI(type) {
    nodeType = type;
    $('type-region').classList.toggle('active', type === 'region');
    $('type-trial').classList.toggle('active', type === 'trial');
    $('power-field').classList.toggle('hidden', type !== 'trial');
  }

  function confirmNode() {
    const name = $('node-name').value.trim();
    if (!name || name.length > 12) { $('node-modal-error').textContent = '名号需为 1~12 个字'; if (XH.audio) XH.audio.play('error'); return; }
    let power = 0;
    if (nodeType === 'trial') {
      power = parseInt($('node-power').value, 10);
      if (!power || power <= 0 || power > 9999) { $('node-modal-error').textContent = '战力需为 1~9999 的整数'; if (XH.audio) XH.audio.play('error'); return; }
    }
    XH.map.addNode(XH.state, nav.contId, addParentId, { name: name, type: nodeType, power: power });
    XH.map.recomputeLitStates(XH.state, nav.contId);
    XH.storage.save(XH.state);
    hideOverlay('node-modal-overlay');
    renderMap();
    XH.ui.renderStatusBar();
  }

  function openDeleteModal(nodeId, name) {
    deleteTarget = nodeId;
    $('delete-node-name').textContent = name;
    showOverlay('delete-modal-overlay');
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    XH.map.deleteNode(XH.state, nav.contId, deleteTarget);
    XH.map.recomputeLitStates(XH.state, nav.contId);
    XH.storage.save(XH.state);
    deleteTarget = null;
    hideOverlay('delete-modal-overlay');
    renderMap();
    XH.ui.renderStatusBar();
  }

  /* ---------- 决战之日 / 终极远征 ---------- */
  function openBattleDayModal(contId, forceUltimate) {
    const cont = XH.map.getContinent(XH.state, contId);
    if (!cont) return;
    battleDayTargetId = contId;
    battleDayForceUltimate = forceUltimate;
    $('battleday-modal-name').textContent = cont.name;
    $('battleday-input').value = cont.battleDay || XH.util.localDateKey(new Date());
    $('battleday-modal-error').textContent = '';
    showOverlay('battleday-modal-overlay');
  }

  function confirmBattleDay() {
    const dateVal = $('battleday-input').value;
    if (!dateVal) { $('battleday-modal-error').textContent = '请选择决战之日'; if (XH.audio) XH.audio.play('error'); return; }
    const cont = XH.map.getContinent(XH.state, battleDayTargetId);
    if (!cont) { hideOverlay('battleday-modal-overlay'); return; }
    cont.battleDay = dateVal;
    XH.storage.save(XH.state);
    hideOverlay('battleday-modal-overlay');

    if (battleDayForceUltimate) {
      onClickUltimate(battleDayTargetId);
    } else {
      renderContinents();
      XH.ui.renderStatusBar();
    }
  }

  function onClickUltimate(contId) {
    const cont = XH.map.getContinent(XH.state, contId);
    if (!cont || cont.ultimate) return;

    // 终极大陆必须绑定决战之日
    if (!cont.battleDay) {
      openBattleDayModal(contId, true);
      return;
    }

    const current = XH.state.continents.find(function (c) { return c.ultimate; });
    if (current && current.id !== contId) {
      ultimateTargetId = contId;
      showOverlay('ultimate-confirm-overlay');
    } else {
      doDesignate(contId);
    }
  }

  function doDesignate(contId) {
    XH.state.continents.forEach(function (c) { c.ultimate = (c.id === contId); });
    XH.storage.save(XH.state);
    renderContinents();
    XH.ui.renderStatusBar();
    if (XH.ada) XH.ada.trigger('designate_ultimate');
  }

  function confirmUltimate() {
    if (!ultimateTargetId) return;
    doDesignate(ultimateTargetId);
    ultimateTargetId = null;
    hideOverlay('ultimate-confirm-overlay');
  }

  /* ============================================================
     绑定
     ============================================================ */
  function bind() {
    bindContinents();

    $('btn-map-back').addEventListener('click', showContinentList);
    $('btn-add-node').addEventListener('click', openNodeModal);

    $('btn-node-confirm').addEventListener('click', confirmNode);
    $('btn-node-cancel').addEventListener('click', function () { hideOverlay('node-modal-overlay'); });
    $('type-region').addEventListener('click', function () { setTypeUI('region'); });
    $('type-trial').addEventListener('click', function () { setTypeUI('trial'); });

    $('btn-delete-confirm').addEventListener('click', confirmDelete);
    $('btn-delete-cancel').addEventListener('click', function () { hideOverlay('delete-modal-overlay'); });

    $('btn-battleday-confirm').addEventListener('click', confirmBattleDay);
    $('btn-battleday-cancel').addEventListener('click', function () { hideOverlay('battleday-modal-overlay'); });
    $('btn-ultimate-confirm').addEventListener('click', confirmUltimate);
    $('btn-ultimate-cancel').addEventListener('click', function () { hideOverlay('ultimate-confirm-overlay'); });

    document.querySelectorAll('.modal-overlay').forEach(function (ov) {
      ov.addEventListener('click', function (e) { if (e.target === ov) ov.classList.remove('open'); });
    });

    // 输入框回车确认
    $('continent-name-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmNewContinent(); });
    $('continent-reason').addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmNewContinent(); });
    $('node-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmNode(); });
    $('node-power').addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmNode(); });
  }

  XH.mapUI = {
    bind: bind,
    showContinentList: showContinentList,
    openContinent: openContinent,
    renderContinents: renderContinents
  };
})();
