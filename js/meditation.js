/* ============================================================
   学海大陆 · 静思庭（每日发愿 + 随时反思 + 历史）
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

  /* ============================================================
     逻辑
     ============================================================ */
  XH.meditation = {
    /** 今日发愿（无则 null） */
    todayVow: function (state) {
      const today = XH.util.localDateKey(new Date());
      const vows = (state.meditation && state.meditation.vows) || [];
      for (let i = 0; i < vows.length; i++) if (vows[i].date === today) return vows[i];
      return null;
    },

    /** 今日反思条目 */
    todayReflections: function (state) {
      const today = XH.util.localDateKey(new Date());
      const refs = (state.meditation && state.meditation.reflections) || [];
      return refs.filter(function (r) { return XH.util.localDateKey(new Date(r.at)) === today; });
    },

    /** 发愿（每日一次），奖励 +10 EXP +15 金币（独立，不受上限） */
    submitVow: function (state, text, targetPower) {
      if (XH.meditation.todayVow(state)) return { error: 'already' };
      state.meditation = state.meditation || { vows: [], reflections: [], lastPromptDate: '' };
      state.meditation.vows.push({
        date: XH.util.localDateKey(new Date()),
        text: text,
        targetPower: Number(targetPower) || 0,
        at: Date.now()
      });
      const res = XH.game.applyFlatReward(state, 10, 15, 'vow');
      return { reward: res.reward, leveled: res.leveled };
    },

    /** 记录反思；每日首条得 +10 EXP +5 金币（独立） */
    addReflection: function (state, text) {
      state.meditation = state.meditation || { vows: [], reflections: [], lastPromptDate: '' };
      const first = XH.meditation.todayReflections(state).length === 0;
      state.meditation.reflections.push({ text: text, at: Date.now() });
      if (first) {
        const res = XH.game.applyFlatReward(state, 10, 5, 'reflect');
        return { reward: res.reward, leveled: res.leveled, first: true };
      }
      return { first: false };
    },

    /** 今日目标状态：{ target, gained, reached } 或 null（未发愿） */
    targetStatus: function (state) {
      const vow = XH.meditation.todayVow(state);
      if (!vow) return null;
      const today = XH.util.localDateKey(new Date());
      const gained = XH.settle.dailyStats(state, today).power;
      return { target: vow.targetPower, gained: gained, reached: gained >= vow.targetPower };
    },

    /** 今日是否该提示去静思庭发愿（每天首次进大厅） */
    shouldPrompt: function (state) {
      const today = XH.util.localDateKey(new Date());
      return (state.meditation && state.meditation.lastPromptDate) !== today;
    },

    markPrompted: function (state) {
      state.meditation = state.meditation || { vows: [], reflections: [], lastPromptDate: '' };
      state.meditation.lastPromptDate = XH.util.localDateKey(new Date());
    }
  };

  /* ============================================================
     UI
     ============================================================ */
  function render() {
    renderVow();
    renderHistory();
  }

  function renderVow() {
    const vow = XH.meditation.todayVow(XH.state);
    const form = $('vow-form');
    const done = $('vow-done');
    if (vow) {
      form.classList.add('hidden');
      done.classList.remove('hidden');
      $('vow-done-text').textContent = '发愿：「' + vow.text + '」';
      $('vow-done-target').textContent = '目标 ' + vow.targetPower + ' 战力';
    } else {
      form.classList.remove('hidden');
      done.classList.add('hidden');
    }
  }

  function renderHistory() {
    const el = $('meditation-history');
    const state = XH.state;
    const med = state.meditation || { vows: [], reflections: [] };
    const days = {};

    (med.vows || []).forEach(function (v) {
      days[v.date] = days[v.date] || { vow: null, reflections: [], report: null };
      days[v.date].vow = v;
    });
    (med.reflections || []).forEach(function (r) {
      const d = XH.util.localDateKey(new Date(r.at));
      days[d] = days[d] || { vow: null, reflections: [], report: null };
      days[d].reflections.push(r);
    });
    (state.chronicle || []).forEach(function (c) {
      days[c.date] = days[c.date] || { vow: null, reflections: [], report: null };
      days[c.date].report = c;
    });

    const dates = Object.keys(days).sort().reverse();
    el.innerHTML = '';
    if (!dates.length) {
      el.innerHTML = '<div class="med-empty zh">静思庭尚无一字，发愿开启今日的远征吧。</div>';
      return;
    }
    dates.forEach(function (date) {
      el.appendChild(renderDay(date, days[date]));
    });
  }

  function renderDay(date, day) {
    const wrap = document.createElement('div');
    wrap.className = 'med-day';
    let html = '<div class="med-day-date">' + esc(date) + '</div>';

    if (day.vow) {
      html += '<div class="med-vow-line zh">发愿：「' + esc(day.vow.text) + '」<span class="med-vow-target">目标 ' + day.vow.targetPower + ' 战力</span></div>';
    }
    if (day.reflections.length) {
      day.reflections.forEach(function (r) {
        html += '<div class="med-reflect-line zh">· ' + esc(r.text) + '</div>';
      });
    }
    if (day.report) {
      html += '<div class="med-report-line zh">战报：驱散 ' + day.report.nodesLit +
        ' 迷雾 · 经验 ' + day.report.exp + ' · 金币 ' + day.report.gold + '</div>';
    }
    wrap.innerHTML = html;
    return wrap;
  }

  function show() {
    render();
    XH.ui.showScreen('screen-meditation');
  }

  function submitVow() {
    const text = $('vow-text').value.trim();
    if (!text) { $('vow-error').textContent = '今日为何启程？写下你的发愿'; if (XH.audio) XH.audio.play('error'); return; }
    if (text.length > 30) { $('vow-error').textContent = '发愿最多 30 字'; if (XH.audio) XH.audio.play('error'); return; }
    const target = parseInt($('vow-target').value, 10);
    if (!target || target <= 0) { $('vow-error').textContent = '请设定今日目标战力（大于 0）'; if (XH.audio) XH.audio.play('error'); return; }

    const res = XH.meditation.submitVow(XH.state, text, target);
    if (res.error) { $('vow-error').textContent = '今日已发愿，明日再来'; return; }

    XH.storage.save(XH.state);
    $('vow-error').textContent = '';
    $('vow-text').value = '';
    $('vow-target').value = '';
    render();
    XH.ui.renderStatusBar();
    if (XH.ada) XH.ada.trigger('vow_made');

    XH.ui.showFloatText('发愿已成 +15金币 +10EXP', { color: '#ffd700', size: '28px' });
    if (res.leveled) {
      if (XH.audio) XH.audio.play('levelup');
      if (XH.ada) XH.ada.trigger('level_up');
      setTimeout(function () { XH.ui.showFloatText('LEVEL UP!', { color: '#f39c12', size: '52px' }); }, 400);
    }
  }

  function submitReflect() {
    const text = $('reflect-text').value.trim();
    if (!text) { if (XH.audio) XH.audio.play('error'); XH.ui.showToast('先写下此刻的反思吧'); return; }

    const res = XH.meditation.addReflection(XH.state, text);
    XH.storage.save(XH.state);
    $('reflect-text').value = '';
    render();
    XH.ui.renderStatusBar();
    if (XH.ada) XH.ada.trigger('reflection_done');

    if (res.first) {
      XH.ui.showFloatText('今日首思 +5金币 +10EXP', { color: '#ffd700', size: '28px' });
      if (res.leveled) {
        if (XH.audio) XH.audio.play('levelup');
        if (XH.ada) XH.ada.trigger('level_up');
        setTimeout(function () { XH.ui.showFloatText('LEVEL UP!', { color: '#f39c12', size: '52px' }); }, 400);
      }
    } else {
      XH.ui.showToast('反思已记录');
    }
  }

  function bind() {
    $('btn-meditation-back').addEventListener('click', function () {
      XH.ui.renderStatusBar();
      XH.ui.showScreen('screen-hall');
    });

    $('btn-vow-submit').addEventListener('click', submitVow);
    $('btn-reflect-submit').addEventListener('click', submitReflect);

    $('vow-text').addEventListener('keydown', function (e) { if (e.key === 'Enter') submitVow(); });
    $('vow-target').addEventListener('keydown', function (e) { if (e.key === 'Enter') submitVow(); });
  }

  XH.meditationUI = { show: show, bind: bind, render: render };
})();
