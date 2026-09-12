/* ============================================================
   学海大陆 · UI 层（过场 / 向导 / 大厅 / 飘字 / 打字机）
   ============================================================ */
(function () {
  'use strict';
  const XH = (window.XH = window.XH || {});

  const $ = function (id) { return document.getElementById(id); };

  /* ---------- 预加载：进入大厅时预解码四张内页背景，避免切页现场解码 ---------- */
  let innerBgsPreloaded = false;
  const INNER_BG_SRCS = ['img/opt/bg-map.png', 'img/opt/bg-board.png', 'img/opt/bg-chronicle.png', 'img/opt/bg-garden.png'];
  function preloadInnerBackgrounds() {
    if (innerBgsPreloaded) return;
    innerBgsPreloaded = true;
    for (let i = 0; i < INNER_BG_SRCS.length; i++) {
      const im = new Image();
      im.src = INNER_BG_SRCS[i];
      if (im.decode) im.decode().catch(function () {});
    }
  }

  /* ---------- 黑场过场 ---------- */
  function blackout(mid, after) {
    const ov = $('transition-overlay');
    ov.classList.remove('fade-in', 'fade-out');
    ov.style.willChange = 'opacity';
    // 用双 rAF 让浏览器在下一帧提交样式，替代强制回流（不读 offsetWidth）
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        ov.classList.add('fade-in');
        if (XH.audio) XH.audio.play('transition');
        setTimeout(function () {
          if (mid) mid();
          ov.classList.remove('fade-in');
          ov.classList.add('fade-out');
          setTimeout(function () {
            ov.classList.remove('fade-out');
            ov.style.willChange = '';
            if (after) after();
          }, 250);
        }, 250);
      });
    });
  }

  /* ---------- 屏幕切换 ---------- */
  let screenSwitching = false;
  function showScreen(id) {
    if (screenSwitching) return;
    const target = $(id);
    if (!target) return;
    if (target.classList.contains('active')) return;
    screenSwitching = true;
    blackout(function () {
      const screens = document.querySelectorAll('.screen');
      for (let i = 0; i < screens.length; i++) screens[i].classList.remove('active');
      // will-change：过场动画期间提升到合成层，动画结束后移除（screenIn 0.22s）
      target.style.willChange = 'transform, opacity';
      target.classList.add('active');
      setTimeout(function () { target.style.willChange = ''; }, 260);
      if (id === 'screen-hall') preloadInnerBackgrounds();
    }, function () {
      screenSwitching = false;
    });
  }

  /* ---------- 全屏飘字 ---------- */
  function showFloatText(text, opts) {
    opts = opts || {};
    const layer = $('float-text-layer');
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    el.style.color = opts.color || '#ffd700';
    el.style.fontSize = opts.size || '48px';
    el.style.animationDuration = (opts.duration || 2200) + 'ms';
    layer.appendChild(el);
    setTimeout(function () { el.remove(); }, (opts.duration || 2200) + 80);
  }

  /* ---------- 提示条 ---------- */
  function showToast(text) {
    const layer = $('toast-layer');
    const el = document.createElement('div');
    el.className = 'toast zh';
    el.textContent = text;
    layer.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }

  /* ---------- 鼠标位置飘字 ---------- */
  function showBurst(x, y, text, opts) {
    opts = opts || {};
    const layer = $('float-text-layer');
    const el = document.createElement('div');
    el.className = 'float-burst';
    el.innerHTML = text; // 支持富文本（如赏金已领完的划线样式）
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.color = opts.color || '#ffd700';
    el.style.fontSize = opts.size || '20px';
    layer.appendChild(el);
    setTimeout(function () { el.remove(); }, 1400);
  }

  /* ---------- 奖励飘字（含金币上限提示） ---------- */
  function showRewardBurst(x, y, reward) {
    if (reward.capped) {
      showBurst(x, y, '+' + reward.exp + 'EXP · <span class="gold-cap">赏金已领完</span>',
        { color: '#ffd700', size: '20px' });
    } else {
      showBurst(x, y, '+' + reward.exp + 'EXP +' + reward.gold + '金币',
        { color: '#ffd700', size: '20px' });
    }
  }

  /* ---------- 执念/征服理由 完整内容弹窗 ---------- */
  function showMotiveModal(text) {
    $('motive-modal-text').textContent = text;
    $('motive-modal-overlay').classList.add('open');
  }

  /* ---------- 标题页星空 ---------- */
  function buildStars() {
    const field = $('starfield');
    if (!field) return;
    const colors = ['#ffffff', '#ffffff', '#ffffff', '#00d9ff', '#ffd700', '#f39c12'];
    const COUNT = 90;
    for (let i = 0; i < COUNT; i++) {
      const s = document.createElement('div');
      s.className = 'star';
      const size = Math.random() < 0.85 ? 2 : 3;
      s.style.width = size + 'px';
      s.style.height = size + 'px';
      s.style.left = (Math.random() * 100) + '%';
      s.style.top = (Math.random() * 100) + '%';
      s.style.background = colors[(Math.random() * colors.length) | 0];
      s.style.animationDuration = (1.2 + Math.random() * 3) + 's';
      s.style.animationDelay = (Math.random() * 3) + 's';
      field.appendChild(s);
    }
  }

  /* ---------- 契约仪式：职业卡片 ---------- */
  let selectedClassId = null;

  function renderClassCards() {
    const list = $('class-list');
    list.innerHTML = '';
    if (selectedClassId === null) selectedClassId = XH.CLASSES[0].id;

    XH.CLASSES.forEach(function (c) {
      const card = document.createElement('div');
      card.className = 'class-card';
      card.setAttribute('data-id', c.id);
      if (c.id === selectedClassId) card.classList.add('selected');
      card.style.setProperty('--rune-color', c.color);

      const rune = document.createElement('div');
      rune.className = 'class-rune';
      rune.innerHTML = '<span>' + c.rune + '</span>';

      const name = document.createElement('div');
      name.className = 'class-name';
      name.textContent = c.name;

      const desc = document.createElement('div');
      desc.className = 'class-desc zh';
      desc.textContent = c.desc;

      card.appendChild(rune);
      card.appendChild(name);
      card.appendChild(desc);

      card.addEventListener('click', function () {
        selectedClassId = c.id;
        const cards = list.querySelectorAll('.class-card');
        for (let i = 0; i < cards.length; i++) cards[i].classList.remove('selected');
        card.classList.add('selected');
      });

      list.appendChild(card);
    });
  }

  /* ---------- 契约仪式：血手印长按 ---------- */
  let holdTimer = null;
  let holdStart = 0;
  let holding = false;
  let contractDone = false;
  const HOLD_MS = 2000;

  function bindHandprint() {
    const zone = $('handprint-zone');
    const progress = $('handprint-progress');
    const hint = $('handprint-hint');

    function start(e) {
      if (contractDone) return;
      e.preventDefault();
      if (holding) return;
      holding = true;
      holdStart = Date.now();
      zone.classList.add('holding');
      progress.style.transform = 'scaleY(0)';
      hint.textContent = '保持按住，契约正在生效…';
      if (XH.audio) XH.audio.play('chargeStart');
      holdTimer = setInterval(function () {
        const pct = Math.min(1, (Date.now() - holdStart) / HOLD_MS);
        progress.style.transform = 'scaleY(' + pct + ')';
        if (XH.audio) XH.audio.play('charge', pct);
        if (Date.now() - holdStart >= HOLD_MS) {
          cancel();
          completeContract();
        }
      }, 30);
    }

    function cancel() {
      if (!holding) return;
      holding = false;
      clearInterval(holdTimer);
      holdTimer = null;
      zone.classList.remove('holding');
      progress.style.transform = 'scaleY(0)';
      hint.textContent = '按住不放，直至契约生效';
      if (XH.audio) XH.audio.play('chargeStop');
    }

    function completeContract() {
      contractDone = true;
      hint.textContent = '契约已成！';
      progress.style.transform = 'scaleY(1)';
      if (XH.audio) XH.audio.play('contract');

      // 组装新存档
      XH.state = XH.storage.defaultState(
        XH.ritual.name,
        XH.ritual.classId,
        XH.ritual.oath
      );
      XH.storage.save(XH.state);

      showFloatText('契约已成', { color: '#ffd700', size: '56px', duration: 1800 });
      setTimeout(function () {
        renderHall();
        showScreen('screen-hall');
        if (XH.ada) XH.ada.onHallEnter();
      }, 1900);
    }

    zone.addEventListener('pointerdown', start);
    zone.addEventListener('pointerup', cancel);
    zone.addEventListener('pointerleave', cancel);
    zone.addEventListener('pointercancel', cancel);
    zone.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  /* ---------- 契约仪式：装配流程 ---------- */
  function bindRitual() {
    XH.ritual = { name: '', classId: '', oath: '' };

    // 第一步：名号
    const nameInput = $('input-name');
    $('btn-name-next').addEventListener('click', goNameNext);
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') goNameNext();
    });

    function goNameNext() {
      const name = nameInput.value.trim();
      if (!name || name.length > 12) {
        $('name-error').textContent = '名号需为 1~12 个字';
        if (XH.audio) XH.audio.play('error');
        return;
      }
      $('name-error').textContent = '';
      XH.ritual.name = name;
      showScreen('screen-ritual-2');
    }

    // 第二步：职业
    renderClassCards();
    $('btn-class-prev').addEventListener('click', function () { showScreen('screen-ritual-1'); });
    $('btn-class-next').addEventListener('click', function () {
      XH.ritual.classId = selectedClassId;
      showScreen('screen-ritual-3');
    });

    // 第三步：誓言
    $('btn-oath-prev').addEventListener('click', function () { showScreen('screen-ritual-2'); });
    $('btn-oath-next').addEventListener('click', function () {
      XH.ritual.oath = $('input-oath').value.trim();
      renderContractPreview();
      contractDone = false;
      $('handprint-progress').style.transform = 'scaleY(0)';
      $('handprint-hint').textContent = '按住不放，直至契约生效';
      showScreen('screen-ritual-4');
    });

    // 第四步：血手印
    $('btn-contract-prev').addEventListener('click', function () { showScreen('screen-ritual-3'); });
    bindHandprint();
  }

  function renderContractPreview() {
    const cls = XH.game.classById(XH.ritual.classId);
    const oath = XH.ritual.oath || '此身为刃，誓破万重迷雾。';
    $('contract-preview').innerHTML =
      '冒险者 <b>' + XH.ritual.name + '</b> · 职业 <b>' + cls.name + '</b><br>' +
      '誓言：「' + oath + '」';
  }

  /* ---------- 大厅：状态栏 ---------- */
  function totalPower() {
    if (XH.map && XH.map.totalPower) return XH.map.totalPower(XH.state);
    return (XH.state && XH.state.adventurer && XH.state.adventurer.power) || 0;
  }

  function renderStatusBar() {
    const a = XH.state.adventurer;
    const cls = XH.game.classById(a.classId);
    const need = XH.game.expNeeded(a.level);

    $('status-name').textContent = a.name;
    $('status-class').textContent = cls.name;
    $('status-level').textContent = 'LV.' + a.level;
    $('status-gold').textContent = a.gold + ' G';
    $('status-power').textContent = '战力 ' + totalPower();
    $('exp-text').textContent = a.exp + ' / ' + need;
    $('exp-fill').style.transform = 'scaleX(' + Math.min(1, a.exp / need) + ')';

    // 今日目标（静思庭发愿）
    const targetEl = $('status-target');
    if (targetEl) {
      if (XH.meditation && XH.meditation.targetStatus) {
        const ts = XH.meditation.targetStatus(XH.state);
        if (ts) {
          targetEl.textContent = '今日目标 ' + ts.target + '/' + ts.gained;
          targetEl.classList.toggle('reached', ts.reached);
        } else {
          targetEl.textContent = '';
          targetEl.classList.remove('reached');
        }
      }
    }

    updateUltimateBanner();
  }

  function updateUltimateBanner() {
    const el = $('ultimate-banner');
    if (!el || !XH.state) return;
    const ult = XH.state.continents.find(function (c) { return c.ultimate; });
    if (!ult) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    const pct = XH.map.conquestPercent(ult);
    const days = XH.util.daysUntil(ult.battleDay);
    $('ultimate-banner-name').textContent = ult.name;
    $('ultimate-banner-progress').textContent = '征服度 ' + pct + '%';
    $('ultimate-banner-days').textContent = (days != null && days > 0) ? '距决战之日还有 ' + days + ' 天' : '决战日已到';
  }

  function popEl(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  /** 刷新状态栏，并对指定字段做「跳动」动画 */
  function updateStatusBar(pop) {
    renderStatusBar();
    pop = pop || {};
    if (pop.gold) popEl('status-gold');
    if (pop.power) popEl('status-power');
    if (pop.exp) popEl('exp-text');
    if (pop.level) popEl('status-level');
  }

  function renderHall() {
    renderStatusBar();
  }

  /* ---------- 大厅：交互区域 ---------- */
  function bindHall() {
    const map = document.querySelector('.station-map');
    const board = document.querySelector('.station-board');
    const settle = document.querySelector('.station-settle');
    const meditate = document.querySelector('.station-meditate');

    map.addEventListener('click', function () {
      if (XH.mapUI && XH.mapUI.showContinentList) {
        XH.mapUI.showContinentList();
      } else {
        showToast('迷雾地图仍在测绘中，大陆远征即将开放。');
      }
    });
    board.addEventListener('click', function () {
      if (XH.questsUI && XH.questsUI.show) {
        XH.questsUI.show();
      } else {
        showToast('委托板空空如也，试炼委托将在后续版本发布。');
      }
    });
    settle.addEventListener('click', function () {
      if (XH.settleUI && XH.settleUI.show) {
        XH.settleUI.show();
      } else {
        showToast('勇者传记正在装订中……');
      }
    });
    meditate.addEventListener('click', function () {
      if (XH.meditationUI && XH.meditationUI.show) {
        XH.meditationUI.show();
      } else {
        showToast('静思庭尚在修建中……');
      }
    });

    // 向导对话框
    $('npc-bubble').addEventListener('click', function () {
      if (XH.ada) XH.ada.chat();
    });

    // 重置存档（低调，两段式确认）
    const btnReset = $('btn-reset');
    let armed = false;
    let armTimer = null;
    btnReset.addEventListener('click', function () {
      if (!armed) {
        armed = true;
        btnReset.textContent = '确认重置？';
        btnReset.classList.add('armed');
        armTimer = setTimeout(function () {
          armed = false;
          btnReset.textContent = '重置存档';
          btnReset.classList.remove('armed');
        }, 3200);
      } else {
        clearTimeout(armTimer);
        btnReset.textContent = '重置存档';
        btnReset.classList.remove('armed');
        if (XH.ada) XH.ada.trigger('reset_farewell');
        setTimeout(function () {
          XH.storage.clear();
          location.reload();
        }, 1900);
      }
    });

    // 执念/征服理由弹窗关闭
    const btnMotiveClose = $('btn-motive-close');
    if (btnMotiveClose) btnMotiveClose.addEventListener('click', function () {
      $('motive-modal-overlay').classList.remove('open');
    });
  }

  /* ---------- 对外暴露 ---------- */
  XH.ui = {
    buildStars: buildStars,
    showScreen: showScreen,
    showFloatText: showFloatText,
    showToast: showToast,
    showBurst: showBurst,
    showRewardBurst: showRewardBurst,
    showMotiveModal: showMotiveModal,
    bindRitual: bindRitual,
    bindHall: bindHall,
    renderHall: renderHall,
    renderStatusBar: renderStatusBar,
    updateStatusBar: updateStatusBar
  };
})();
