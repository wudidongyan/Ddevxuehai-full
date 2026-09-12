/* ============================================================
   学海大陆 · 8-bit 音效系统（Web Audio 实时合成，无外部文件）
   方波/三角波/锯齿波 + 噪声，红白机 chiptune 风格。
   AudioContext 在首次用户交互后才初始化，规避自动播放限制。
   ============================================================ */
(function () {
  'use strict';
  const XH = (window.XH = window.XH || {});

  const MUTE_KEY = 'xuehai_muted';
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let muted = false;
  let chargeOsc = null;
  let chargeGain = null;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.4; // 总音量克制，点缀而非轰炸
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function getNoise(c) {
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  /* 单音：振荡器 + 包络 */
  function tone(o) {
    const c = ensureCtx();
    if (!c || !master) return;
    const t0 = c.currentTime + (o.at || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.slideTo), t0 + o.dur);
    const vol = o.vol != null ? o.vol : 0.15;
    const attack = o.attack != null ? o.attack : 0.002;
    const release = o.release != null ? o.release : 0.03;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.setValueAtTime(vol, Math.max(t0 + attack, t0 + o.dur - release));
    g.gain.linearRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.05);
  }

  /* 噪声：缓冲源 + 滤波器 + 包络 */
  function noise(o) {
    const c = ensureCtx();
    if (!c || !master) return;
    const t0 = c.currentTime + (o.at || 0);
    const src = c.createBufferSource();
    src.buffer = getNoise(c);
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = o.filterType || 'lowpass';
    f.frequency.setValueAtTime(o.filterFreq || 3000, t0);
    const g = c.createGain();
    const vol = o.vol != null ? o.vol : 0.12;
    const attack = o.attack != null ? o.attack : 0.005;
    const release = o.release != null ? o.release : 0.05;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.setValueAtTime(vol, Math.max(t0 + attack, t0 + o.dur - release));
    g.gain.linearRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + o.dur + 0.05);
  }

  /* ---------- 音效实现 ---------- */
  function sClick() { tone({ freq: 1000, type: 'square', dur: 0.03, vol: 0.08, release: 0.02 }); }

  function sTransition() {
    // 三角波上扬+回落，透亮的"咻"而不是闷"嗡"
    tone({ freq: 160, slideTo: 400, type: 'triangle', dur: 0.12, vol: 0.14 });
    tone({ freq: 400, slideTo: 130, type: 'triangle', dur: 0.22, vol: 0.11, at: 0.11 });
  }

  function sLight() {
    [523.25, 659.25, 783.99].forEach(function (f, i) {
      tone({ freq: f, type: 'square', dur: 0.1, vol: 0.15, at: i * 0.075, release: 0.06 });
    });
  }

  function sGold() {
    tone({ freq: 987.77, type: 'square', dur: 0.08, vol: 0.14, release: 0.03 });
    tone({ freq: 1318.51, type: 'square', dur: 0.3, vol: 0.14, at: 0.08, release: 0.08 });
  }

  function sTransmit(level) {
    tone({ freq: 480 * Math.pow(1.1, level || 0), type: 'triangle', dur: 0.055, vol: 0.07, release: 0.03 });
  }

  function sLevelUp() {
    [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
      tone({ freq: f, type: 'square', dur: i === 3 ? 0.32 : 0.1, vol: 0.15, at: i * 0.09, release: i === 3 ? 0.1 : 0.05 });
    });
  }

  function sRegionClear() {
    [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5].forEach(function (f, i) {
      tone({ freq: f, type: 'square', dur: i === 5 ? 0.4 : 0.11, vol: 0.15, at: i * 0.1, release: i === 5 ? 0.12 : 0.05 });
    });
  }

  function sConquer() {
    const seq = [
      [392.0, 0.12, 0],
      [392.0, 0.12, 0.13],
      [392.0, 0.16, 0.26],
      [523.25, 0.16, 0.44],
      [659.25, 0.18, 0.62],
      [783.99, 0.2, 0.82],
      [1046.5, 0.65, 1.04]
    ];
    seq.forEach(function (s) {
      tone({ freq: s[0], type: 'square', dur: s[1], vol: 0.17, at: s[2], release: 0.08 });
    });
    [523.25, 659.25, 783.99, 1046.5].forEach(function (f) {
      tone({ freq: f, type: 'square', dur: 0.6, vol: 0.08, at: 1.72, release: 0.2 });
    });
  }

  /* 血手印：持续蓄力音，音调随进度升高 */
  function startCharge() {
    const c = ensureCtx();
    if (!c || !master || muted) return;
    stopCharge();
    chargeOsc = c.createOscillator();
    chargeGain = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 320;
    chargeOsc.type = 'sawtooth';
    chargeOsc.frequency.value = 70;
    chargeGain.gain.value = 0.12;
    chargeOsc.connect(f);
    f.connect(chargeGain);
    chargeGain.connect(master);
    chargeOsc.start();
  }
  function updateCharge(p) {
    if (chargeOsc) chargeOsc.frequency.value = 70 + (p || 0) * 150;
  }
  function stopCharge() {
    if (chargeOsc) {
      try { chargeOsc.stop(); chargeOsc.disconnect(); } catch (e) {}
      chargeOsc = null;
    }
    if (chargeGain) {
      try { chargeGain.disconnect(); } catch (e) {}
      chargeGain = null;
    }
  }
  function sContract() {
    tone({ freq: 100, slideTo: 35, type: 'sine', dur: 0.6, vol: 0.45, attack: 0.006, release: 0.3 });
    tone({ freq: 55, type: 'sine', dur: 0.5, vol: 0.35, attack: 0.006, release: 0.25 });
    noise({ dur: 0.2, vol: 0.22, filterType: 'lowpass', filterFreq: 600, attack: 0.004, release: 0.1 });
  }

  function sError() {
    // 两拍下降三角波，轻脆的"den-den"拒绝音
    tone({ freq: 260, type: 'triangle', dur: 0.07, vol: 0.12 });
    tone({ freq: 195, type: 'triangle', dur: 0.1, vol: 0.12, at: 0.07 });
  }

  function sType() { tone({ freq: 240, type: 'triangle', dur: 0.02, vol: 0.03, release: 0.012 }); }

  function sPageFlip() { noise({ dur: 0.22, vol: 0.1, filterType: 'bandpass', filterFreq: 1800, attack: 0.03, release: 0.12 }); }

  /* ---------- 播放接口 ---------- */
  function play(name, param) {
    if (muted) return;
    if (!ensureCtx()) return;
    switch (name) {
      case 'click': sClick(); break;
      case 'transition': sTransition(); break;
      case 'light': sLight(); break;
      case 'gold': sGold(); break;
      case 'transmit': sTransmit(param); break;
      case 'levelup': sLevelUp(); break;
      case 'regionclear': sRegionClear(); break;
      case 'conquer': sConquer(); break;
      case 'chargeStart': startCharge(); break;
      case 'charge': updateCharge(param); break;
      case 'chargeStop': stopCharge(); break;
      case 'contract': sContract(); break;
      case 'error': sError(); break;
      case 'type': sType(); break;
      case 'pageflip': sPageFlip(); break;
    }
  }

  /* ---------- 静音开关 ---------- */
  function applyMuteIcon() {
    const btn = document.getElementById('btn-mute');
    if (btn) btn.classList.toggle('muted', muted);
  }

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {}
    if (muted) stopCharge();
    applyMuteIcon();
  }

  function toggleMute() { setMuted(!muted); }

  function loadMuted() {
    try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { muted = false; }
  }

  function init() {
    loadMuted();
    applyMuteIcon();

    const btn = document.getElementById('btn-mute');
    if (btn) btn.addEventListener('click', toggleMute);

    // 通用 UI 点击音（按钮/入口/面包屑/区域卡）
    document.addEventListener('click', function (e) {
      const t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('button') || t.closest('.station') || t.closest('.crumb') || t.closest('.node-card.region')) {
        play('click');
      }
    });

    // 首次交互即初始化 AudioContext（自动播放策略）
    const resume = function () {
      ensureCtx();
      document.removeEventListener('pointerdown', resume);
      document.removeEventListener('keydown', resume);
    };
    document.addEventListener('pointerdown', resume);
    document.addEventListener('keydown', resume);
  }

  XH.audio = { play: play, toggleMute: toggleMute, isMuted: function () { return muted; }, init: init, ensureCtx: ensureCtx };
})();
