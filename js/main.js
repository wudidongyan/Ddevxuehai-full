/* ============================================================
   学海大陆 · 入口（初始化 + 调试 API）
   ============================================================ */
(function () {
  'use strict';
  const XH = (window.XH = window.XH || {});

  /* 当前存档（null 表示尚未缔结契约） */
  XH.state = null;

  function init() {
    XH.state = XH.storage.load();

    XH.ui.buildStars();
    XH.audio.init();
    XH.ui.bindRitual();
    XH.ui.bindHall();
    XH.mapUI.bind();
    XH.questsUI.bind();
    XH.settleUI.bind();
    XH.meditationUI.bind();
    XH.qiankunUI.bind();

    // 跨天时重置每日委托
    if (XH.state) XH.quests.ensureDailyReset(XH.state);

    document.getElementById('btn-start').addEventListener('click', function () {
      if (XH.state) {
        // 已有存档：直接进入大厅
        XH.ui.renderHall();
        XH.ui.showScreen('screen-hall');
        XH.ada.onHallEnter();
      } else {
        // 首次：进入契约仪式
        document.getElementById('input-name').value = '';
        document.getElementById('name-error').textContent = '';
        document.getElementById('input-oath').value = '';
        XH.ui.showScreen('screen-ritual-1');
      }
    });
  }

  /* ---------- 调试 / 测试 API（控制台可用） ----------
   * XH.state           查看当前存档
   * XH.addExp(n)       直接加经验（测试升级）
   * XH.reset()         清除存档并重载
   */
  XH.addExp = function (n) {
    if (!XH.state) return null;
    const leveled = XH.game.addExp(XH.state, Number(n) || 0);
    XH.storage.save(XH.state);
    XH.ui.renderStatusBar();
    if (leveled) XH.ui.showFloatText('LEVEL UP!', { color: '#f39c12', size: '52px' });
    return leveled;
  };

  XH.reset = function () {
    XH.storage.clear();
    location.reload();
  };

  document.addEventListener('DOMContentLoaded', init);
})();
