/* ============================================================
   学海大陆 · 委托板（每日委托，独立于大陆，不计入战力）
   双模式：打卡型（点击完成）/ 记录型（记录数量累计）
   ============================================================ */
(function () {
  'use strict';
  const XH = (window.XH = window.XH || {});
  const $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtNum(n) {
    n = Number(n) || 0;
    return Number.isInteger(n) ? n : Math.round(n * 10) / 10;
  }

  /* 类型小徽章 SVG：印章（打卡） / 羽毛笔（记录） */
  const ICON_STAMP = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="2" y="2" width="12" height="12" fill="#e94560"/><path d="M4.5 8.5 L7 11 L11.5 5.5" stroke="#fff" stroke-width="2" fill="none"/></svg>';
  const ICON_QUILL = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><path d="M3 13 L14 2 L14 4 L5 13 Z" fill="#00d9ff"/><path d="M14 2 L14 4" stroke="#fff" stroke-width="1.5"/></svg>';

  /* ============================================================
     逻辑
     ============================================================ */
  XH.quests = {
    /** 跨天则把所有委托重置为未完成（每日零点） */
    ensureDailyReset: function (state) {
      const today = XH.util.localDateKey(new Date());
      if (state.questLastReset !== today) {
        for (let i = 0; i < state.quests.length; i++) state.quests[i].status = 'mist';
        state.questLastReset = today;
        XH.storage.save(state);
        return true;
      }
      return false;
    },

    createQuest: function (state, data) {
      const q = {
        id: XH.util.genId('quest'),
        name: data.name,
        power: Number(data.power) || 0,
        status: 'mist',
        builtin: false,
        type: data.type || 'checkin', // 'checkin' | 'record'
        motive: data.motive || '',
        minAmount: data.type === 'checkin' ? (Number(data.minAmount) || 0) : 0, // 打卡型：每日下限
        unit: data.type === 'checkin' ? (data.unit || '') : '',                 // 打卡型：单位
        records: []
      };
      state.quests.push(q);
      return q;
    },

    deleteQuest: function (state, id) {
      state.quests = state.quests.filter(function (q) { return q.id !== id; });
    },

    /** 打卡型：点击完成（每日一次） */
    completeQuest: function (state, id) {
      const q = state.quests.find(function (x) { return x.id === id; });
      if (!q || q.status === 'lit') return { error: 'invalid' };
      q.status = 'lit';
      const res = XH.game.applyReward(state, q.power, 'quest');
      return { reward: res.reward, leveled: res.leveled };
    },

    /** 记录型：记录一次数量（无下限，任意大于 0 的数量都可记录） */
    recordQuest: function (state, id, amount, note) {
      const q = state.quests.find(function (x) { return x.id === id; });
      if (!q) return { error: 'invalid' };
      const amt = Math.round((Number(amount) || 0) * 10) / 10;
      if (!(amt > 0)) return { error: 'invalid' };
      q.records.push({ amount: amt, note: note || '', at: Date.now() });
      q.status = 'lit';
      const res = XH.game.applyReward(state, q.power, 'quest');
      return { reward: res.reward, leveled: res.leveled, amount: amt };
    },

    /** 记录型：今日累计 */
    todayTotal: function (q) {
      const today = XH.util.localDateKey(new Date());
      let sum = 0;
      const recs = q.records || [];
      for (let i = 0; i < recs.length; i++) {
        if (XH.util.localDateKey(new Date(recs[i].at)) === today) sum += (recs[i].amount || 0);
      }
      return sum;
    }
  };

  /* ============================================================
     UI
     ============================================================ */
  let questType = 'checkin';
  let recordTargetId = null;

  function updateBounty() {
    const gold = XH.game.goldToday(XH.state, 'quest');
    const cap = XH.GOLD_CAPS.quest;
    const capped = gold >= cap;
    const el = $('quest-bounty');
    if (el) {
      el.textContent = capped ? '已领完' : '今日委托赏金 ' + gold + '/' + cap;
      el.classList.toggle('capped', capped);
    }
  }

  function allQuestsDone() {
    const qs = XH.state.quests;
    return qs.length > 0 && qs.every(function (q) { return q.status === 'lit'; });
  }

  function render() {
    updateBounty();
    const quests = XH.state.quests;
    const checkins = quests.filter(function (q) { return q.type !== 'record'; });
    const records = quests.filter(function (q) { return q.type === 'record'; });

    renderSection('checkin-list', 'checkin-empty', 'checkin-count', checkins);
    renderSection('record-list', 'record-empty', 'record-count', records);
  }

  function renderSection(listId, emptyId, countId, quests) {
    const list = $(listId);
    const empty = $(emptyId);
    const count = $(countId);
    list.innerHTML = '';
    count.textContent = '· ' + quests.length;
    if (!quests.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    quests.forEach(function (q) { list.appendChild(renderQuestCard(q)); });
  }

  function renderQuestCard(q) {
    const isRecord = q.type === 'record';
    const total = isRecord ? XH.quests.todayTotal(q) : 0;
    const isLit = q.status === 'lit';
    const card = document.createElement('div');
    card.className = 'node-card trial ' + (isLit ? 'lit' : 'mist');
    card.setAttribute('data-quest-id', q.id);

    let statusLine;
    if (isRecord) {
      statusLine = total > 0 ? '今日已记录 ' + fmtNum(total) : '今日尚未记录';
    } else {
      statusLine = isLit ? '已完成' : '未完成';
    }

    const minLine = (!isRecord && q.minAmount > 0)
      ? '<div class="quest-min zh">目标 ≥ ' + fmtNum(q.minAmount) + (q.unit ? ' ' + esc(q.unit) : '') + '</div>'
      : '';

    const motive = q.motive
      ? '<div class="motive-line zh" title="' + esc(q.motive) + '">' + esc(q.motive) + '</div>'
      : '<div class="motive-line motive-empty zh">（无执念）</div>';

    card.innerHTML =
      '<div class="node-head">' +
        '<span class="quest-type-icon">' + (isRecord ? ICON_QUILL : ICON_STAMP) + '</span>' +
        '<span class="node-name">' + esc(q.name) + '</span>' +
        '<button class="node-del" title="撤销委托">✕</button>' +
      '</div>' +
      motive +
      '<div class="node-power">战力 ' + q.power + '</div>' +
      minLine +
      '<div class="node-status zh">' + statusLine + '</div>';

    const motiveEl = card.querySelector('.motive-line');
    if (motiveEl) {
      motiveEl.addEventListener('click', function (e) {
        e.stopPropagation();
        XH.ui.showMotiveModal(q.motive || '尚未立下执念');
      });
    }

    card.querySelector('.node-del').addEventListener('click', function (e) {
      e.stopPropagation();
      XH.quests.deleteQuest(XH.state, q.id);
      XH.storage.save(XH.state);
      render();
    });

    card.addEventListener('click', function (e) { onQuestClick(q, e); });

    return card;
  }

  function onQuestClick(q, evt) {
    if (q.type === 'record') {
      recordTargetId = q.id;
      $('record-modal-name').textContent = q.name;
      $('record-amount').value = '';
      $('record-note').value = '';
      $('record-modal-error').textContent = '';
      $('record-modal-overlay').classList.add('open');
      $('record-amount').focus();
      return;
    }

    // 打卡型
    if (q.status === 'lit') {
      XH.ui.showBurst(evt.clientX, evt.clientY, '已完成', { color: '#9a9ab8', size: '16px' });
      if (XH.audio) XH.audio.play('error');
      return;
    }
    const res = XH.quests.completeQuest(XH.state, q.id);
    if (res.error) { XH.ui.showToast('此委托无法完成'); return; }
    XH.storage.save(XH.state);

    if (XH.audio) {
      XH.audio.play('light');
      if (!res.reward.capped) setTimeout(function () { XH.audio.play('gold'); }, 230);
    }

    // 卡片点亮动画
    const card = document.querySelector('.node-card[data-quest-id="' + q.id + '"]');
    if (card) {
      card.classList.remove('mist');
      card.classList.add('lit', 'just-lit');
      const st = card.querySelector('.node-status');
      if (st) st.textContent = '已完成';
      setTimeout(function () { card.classList.remove('just-lit'); }, 950);
    }

    XH.ui.showRewardBurst(evt.clientX, evt.clientY, res.reward);

    XH.ui.updateStatusBar({
      gold: res.reward.gold > 0,
      exp: res.reward.exp > 0,
      level: res.leveled,
      power: false
    });
    updateBounty();

    if (XH.ada) {
      XH.ada.trigger('quest_done');
      if (allQuestsDone()) XH.ada.trigger('all_quests_done');
    }

    if (res.leveled) {
      if (XH.audio) XH.audio.play('levelup');
      if (XH.ada) XH.ada.trigger('level_up');
      setTimeout(function () {
        XH.ui.showFloatText('LEVEL UP!', { color: '#f39c12', size: '52px' });
      }, 350);
    }
  }

  function confirmRecord() {
    const q = XH.state.quests.find(function (x) { return x.id === recordTargetId; });
    if (!q) { $('record-modal-overlay').classList.remove('open'); return; }
    const amount = parseFloat($('record-amount').value);
    const note = $('record-note').value.trim();
    if (!(amount > 0)) { $('record-modal-error').textContent = '请输入本次数量'; if (XH.audio) XH.audio.play('error'); return; }

    const res = XH.quests.recordQuest(XH.state, q.id, amount, note);
    if (res.error) { $('record-modal-error').textContent = '记录失败'; return; }

    XH.storage.save(XH.state);
    const card = document.querySelector('.node-card[data-quest-id="' + q.id + '"]');
    const r = card ? card.getBoundingClientRect() : null;
    const cx = r ? r.left + r.width / 2 : window.innerWidth / 2;
    const cy = r ? r.top + r.height / 2 : window.innerHeight / 2;
    $('record-modal-overlay').classList.remove('open');

    render();
    XH.ui.showRewardBurst(cx, cy, res.reward);
    XH.ui.updateStatusBar({
      gold: res.reward.gold > 0,
      exp: res.reward.exp > 0,
      level: res.leveled,
      power: false
    });

    if (XH.ada && allQuestsDone()) XH.ada.trigger('all_quests_done');

    if (XH.audio) {
      XH.audio.play('light');
      if (!res.reward.capped) setTimeout(function () { XH.audio.play('gold'); }, 230);
    }
    if (res.leveled) {
      if (XH.audio) XH.audio.play('levelup');
      if (XH.ada) XH.ada.trigger('level_up');
      setTimeout(function () {
        XH.ui.showFloatText('LEVEL UP!', { color: '#f39c12', size: '52px' });
      }, 350);
    }
  }

  function show() {
    XH.quests.ensureDailyReset(XH.state);
    render();
    XH.ui.showScreen('screen-quests');
  }

  function setQuestTypeUI(type) {
    questType = type;
    $('quest-type-checkin').classList.toggle('active', type === 'checkin');
    $('quest-type-record').classList.toggle('active', type === 'record');
    $('checkin-fields').classList.toggle('hidden', type !== 'checkin');
  }

  function confirmQuest() {
    const name = $('quest-name').value.trim();
    if (!name || name.length > 12) { $('quest-modal-error').textContent = '名号需为 1~12 个字'; if (XH.audio) XH.audio.play('error'); return; }
    const motive = $('quest-motive').value.trim();
    if (!motive) { $('quest-modal-error').textContent = '请写下你的执念（此战所图为何？）'; if (XH.audio) XH.audio.play('error'); return; }
    if (motive.length > 30) { $('quest-modal-error').textContent = '执念最多 30 字'; if (XH.audio) XH.audio.play('error'); return; }
    const power = parseInt($('quest-power').value, 10);
    if (!power || power <= 0 || power > 9999) { $('quest-modal-error').textContent = '战力需为 1~9999 的整数'; if (XH.audio) XH.audio.play('error'); return; }

    let minAmount = 0, unit = '';
    if (questType === 'checkin') {
      minAmount = parseFloat($('quest-min').value);
      unit = $('quest-unit').value.trim();
      if (!(minAmount > 0)) { $('quest-modal-error').textContent = '请设定下限（每日最低目标，大于 0）'; if (XH.audio) XH.audio.play('error'); return; }
      if (!unit) { $('quest-modal-error').textContent = '请填写单位名（如：次）'; if (XH.audio) XH.audio.play('error'); return; }
    }

    XH.quests.createQuest(XH.state, { name: name, power: power, type: questType, motive: motive, minAmount: minAmount, unit: unit });
    XH.storage.save(XH.state);
    $('quest-modal-overlay').classList.remove('open');
    render();
  }

  function bind() {
    $('btn-quests-back').addEventListener('click', function () {
      XH.ui.renderStatusBar();
      XH.ui.showScreen('screen-hall');
    });

    $('btn-add-quest').addEventListener('click', function () {
      $('quest-name').value = '';
      $('quest-motive').value = '';
      $('quest-power').value = '';
      $('quest-min').value = '';
      $('quest-unit').value = '';
      $('quest-modal-error').textContent = '';
      setQuestTypeUI('checkin');
      $('quest-modal-overlay').classList.add('open');
      $('quest-name').focus();
    });

    $('quest-type-checkin').addEventListener('click', function () { setQuestTypeUI('checkin'); });
    $('quest-type-record').addEventListener('click', function () { setQuestTypeUI('record'); });

    $('btn-quest-confirm').addEventListener('click', confirmQuest);
    $('btn-quest-cancel').addEventListener('click', function () {
      $('quest-modal-overlay').classList.remove('open');
    });
    $('quest-modal-overlay').addEventListener('click', function (e) {
      if (e.target === this) this.classList.remove('open');
    });

    // 记录弹窗
    $('btn-record-confirm').addEventListener('click', confirmRecord);
    $('btn-record-cancel').addEventListener('click', function () {
      $('record-modal-overlay').classList.remove('open');
    });

    $('quest-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmQuest(); });
    $('quest-power').addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmQuest(); });
    $('record-amount').addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmRecord(); });
    $('record-note').addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmRecord(); });
  }

  XH.questsUI = { show: show, bind: bind, render: render };
})();
