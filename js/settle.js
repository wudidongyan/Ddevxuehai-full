/* ============================================================
   学海大陆 · 勇者传记 + 编年史
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

  function fmtDetail(d) {
    const m = d.motive ? '为了【' + esc(d.motive) + '】，' : '';
    if (d.type === 'record') return m + '你记录了 ' + d.amount + (d.unit ? ' ' + esc(d.unit) : '');
    return m + '你完成了「' + esc(d.name) + '」';
  }

  /* ============================================================
     逻辑
     ============================================================ */
  XH.settle = {
    /** 某一天的战报统计（从日志聚合） */
    dailyStats: function (state, dateKey) {
      let nodesLit = 0, questsDone = 0, power = 0, exp = 0, gold = 0;
      const log = state.log || [];
      for (let i = 0; i < log.length; i++) {
        const e = log[i];
        if (e.type !== 'reward') continue;
        if (XH.util.localDateKey(new Date(e.at)) !== dateKey) continue;
        if (e.source === 'node') { nodesLit++; power += e.power || 0; }
        else if (e.source === 'quest') { questsDone++; }
        exp += e.exp || 0;
        gold += e.gold || 0;
      }
      return { nodesLit: nodesLit, questsDone: questsDone, power: power, exp: exp, gold: gold };
    },

    /** 某一天的委托明细（带执念）。历史日期从编年史快照读取。 */
    questDetails: function (state, dateKey) {
      const today = XH.util.localDateKey(new Date());
      if (dateKey !== today) return [];
      const details = [];
      (state.quests || []).forEach(function (q) {
        if (q.type === 'record') {
          const total = XH.quests.todayTotal(q);
          if (total > 0) {
            details.push({ name: q.name, motive: q.motive || '', amount: total, unit: q.unit || '', type: 'record' });
          }
        } else if (q.status === 'lit') {
          details.push({ name: q.name, motive: q.motive || '', amount: 0, unit: '', type: 'checkin' });
        }
      });
      return details;
    },

    /** 把今日总结写入编年史（同日覆盖更新） */
    saveNote: function (state, note) {
      const today = XH.util.localDateKey(new Date());
      const stats = XH.settle.dailyStats(state, today);
      const details = XH.settle.questDetails(state, today);
      const existing = state.chronicle.find(function (c) { return c.date === today; });
      if (existing) {
        existing.nodesLit = stats.nodesLit;
        existing.questsDone = stats.questsDone;
        existing.power = stats.power;
        existing.exp = stats.exp;
        existing.gold = stats.gold;
        existing.note = note;
        existing.questDetails = details;
        existing.savedAt = Date.now();
      } else {
        state.chronicle.push({
          date: today,
          nodesLit: stats.nodesLit,
          questsDone: stats.questsDone,
          power: stats.power,
          exp: stats.exp,
          gold: stats.gold,
          note: note,
          questDetails: details,
          savedAt: Date.now()
        });
      }
      state.chronicle.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    }
  };

  /* ============================================================
     UI
     ============================================================ */
  function renderReport() {
    const today = XH.util.localDateKey(new Date());
    const s = XH.settle.dailyStats(XH.state, today);
    const details = XH.settle.questDetails(XH.state, today);
    const vow = (XH.meditation && XH.meditation.todayVow) ? XH.meditation.todayVow(XH.state) : null;
    const el = $('settle-report');
    const hasActivity = s.nodesLit > 0 || s.questsDone > 0;

    if (!hasActivity && !vow) {
      el.innerHTML =
        '<h2 class="report-title zh">今日大陆沉寂了……</h2>' +
        '<p class="report-body zh">迷雾尚未被驱散，编年史上空无一字。<br>去迷雾地图或委托板，开启今日的远征吧。</p>';
      return;
    }

    let html = '<h2 class="report-title zh">今日战报</h2>';

    // 发愿对照目标战力（达成褒奖 / 未达中性）
    if (vow) {
      const reached = s.power >= vow.targetPower;
      html += '<div class="report-vow zh">发愿：「' + esc(vow.text) + '」</div>';
      html += reached
        ? '<div class="report-vow-result zh">你今日斩获 ' + s.power + ' 战力，达成发愿，凯旋而归！</div>'
        : '<div class="report-vow-result zh">今日斩获 ' + s.power + ' 战力，愿力仍在积蓄，来日方长。</div>';
    }

    if (hasActivity) {
      let parts =
        '今日你驱散了 <b>' + s.nodesLit + '</b> 片迷雾' +
        (s.questsDone > 0 ? '，完成了 <b>' + s.questsDone + '</b> 件委托' : '') + '。<br>' +
        '斩获战力 <b>' + s.power + '</b>，经验 <b>' + s.exp + '</b>，金币 <b>' + s.gold + '</b>。';

      let detailHtml = '';
      if (details.length) {
        detailHtml = '<div class="report-details zh">';
        details.forEach(function (d) {
          detailHtml += '<div class="report-detail-line">· ' + fmtDetail(d) + '</div>';
        });
        detailHtml += '</div>';
      }

      html += '<p class="report-body zh">' + parts + '<br>大陆因你的远征，又亮了几分。</p>' + detailHtml;
    } else {
      html += '<p class="report-body zh">今日尚未斩获战力，愿力仍在积蓄。</p>';
    }

    el.innerHTML = html;
  }

  function renderChronicle() {
    const list = $('chronicle-list');
    const empty = $('chronicle-empty');
    const chron = XH.state.chronicle || [];
    list.innerHTML = '';
    if (!chron.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    chron.forEach(function (c) {
      const entry = document.createElement('div');
      entry.className = 'chronicle-entry';
      const note = c.note ? esc(c.note) : '<span class="chronicle-note-empty zh">（当日未留下只言片语）</span>';
      let detailHtml = '';
      if (c.questDetails && c.questDetails.length) {
        detailHtml = '<div class="chronicle-details zh">';
        c.questDetails.forEach(function (d) {
          detailHtml += '<div>· ' + fmtDetail(d) + '</div>';
        });
        detailHtml += '</div>';
      }
      entry.innerHTML =
        '<div class="chronicle-date">' + esc(c.date) + '</div>' +
        '<div class="chronicle-stats zh">驱散迷雾 ' + c.nodesLit +
          ' · 委托 ' + c.questsDone +
          ' · 战力 ' + c.power +
          ' · 经验 ' + c.exp +
          ' · 金币 ' + c.gold + '</div>' +
        detailHtml +
        '<div class="chronicle-note zh">' + note + '</div>';
      list.appendChild(entry);
    });
  }

  function show() {
    if (XH.audio) XH.audio.play('pageflip');
    renderReport();
    renderChronicle();
    // 预填今日已写的日志
    const today = XH.util.localDateKey(new Date());
    const existing = (XH.state.chronicle || []).find(function (c) { return c.date === today; });
    $('settle-note').value = existing ? existing.note : '';
    XH.ui.showScreen('screen-settle');
  }

  function bind() {
    $('btn-settle-back').addEventListener('click', function () {
      XH.ui.renderStatusBar();
      XH.ui.showScreen('screen-hall');
    });

    $('btn-save-note').addEventListener('click', function () {
      const note = $('settle-note').value.trim();
      if (!note) { XH.ui.showToast('先写下一句远征总结吧'); if (XH.audio) XH.audio.play('error'); return; }
      XH.settle.saveNote(XH.state, note);
      XH.storage.save(XH.state);
      $('settle-note').value = '';
      renderChronicle();
      XH.ui.showToast('已写入编年史');
    });
  }

  XH.settleUI = { show: show, bind: bind };
})();
