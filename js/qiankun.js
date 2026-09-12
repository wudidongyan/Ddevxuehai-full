/* ============================================================
   学海大陆 · 乾坤袋（存档码导出 / 导入）
   纯本地，无需联网；编码用 TextEncoder/Base64 正确处理 UTF-8。
   ============================================================ */
(function () {
  'use strict';
  const XH = (window.XH = window.XH || {});
  const $ = function (id) { return document.getElementById(id); };

  let pendingImportData = null;

  function openModal() {
    $('qiankun-export').value = XH.storage.exportCode(XH.state);
    $('qiankun-import').value = '';
    $('qiankun-import-error').textContent = '';
    $('qiankun-modal-overlay').classList.add('open');
  }

  function copyCode() {
    const el = $('qiankun-export');
    const text = el.value;
    if (!text) return;
    if (XH.ada) XH.ada.trigger('export_code');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { XH.ui.showToast('已复制到剪贴板'); },
        function () { legacyCopy(el, text); }
      );
    } else {
      legacyCopy(el, text);
    }
  }

  function legacyCopy(el, text) {
    el.focus();
    el.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    if (ok) XH.ui.showToast('已复制到剪贴板');
    else XH.ui.showToast('复制失败，请手动全选复制');
    el.blur();
  }

  function doImport() {
    const code = $('qiankun-import').value;
    const state = XH.storage.parseCode(code);
    if (!state) {
      $('qiankun-import-error').textContent = '存档码无效或已损坏';
      if (XH.audio) XH.audio.play('error');
      return;
    }
    $('qiankun-import-error').textContent = '';
    pendingImportData = state;
    $('qiankun-confirm-overlay').classList.add('open');
  }

  function confirmImport() {
    if (!pendingImportData) return;
    XH.storage.save(pendingImportData);
    location.reload();
  }

  function bind() {
    $('btn-qiankun').addEventListener('click', openModal);
    $('btn-qiankun-copy').addEventListener('click', copyCode);
    $('btn-qiankun-close').addEventListener('click', function () {
      $('qiankun-modal-overlay').classList.remove('open');
    });
    $('btn-qiankun-import').addEventListener('click', doImport);
    $('btn-qiankun-confirm-ok').addEventListener('click', confirmImport);
    $('btn-qiankun-confirm-cancel').addEventListener('click', function () {
      pendingImportData = null;
      $('qiankun-confirm-overlay').classList.remove('open');
    });
  }

  XH.qiankunUI = { bind: bind };
})();
