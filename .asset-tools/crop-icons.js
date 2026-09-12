/* 把 img/icons.png（2×2 网格，2560×1440）裁成四张入口图标。
   背景深灰（RGB≈20~31），用 max 通道 > 阈值判定内容；
   找连通分量后，把「相距 < MERGE 像素」的分量合并成同一图标（含底座等分离部件），
   远距离的角落杂点自然被排除。最后加 margin 裁剪。
   用法：node crop-icons.js */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const SRC = path.join(__dirname, '..', 'img', 'icons.png');
const OUT = path.join(__dirname, '..', 'img');

const QUADS = [
  { name: 'icon-map.png',       x: 0,    y: 0 },
  { name: 'icon-board.png',     x: 1280, y: 0 },
  { name: 'icon-chronicle.png', x: 0,    y: 720 },
  { name: 'icon-garden.png',    x: 1280, y: 720 }
];

const MARGIN = 10;  // 裁剪留边
const THRESH = 42;  // 内容判定：max(R,G,B) > THRESH
const MERGE = 100;  // 分量合并距离（px）

function findComponents(data, W, x0, y0, qw, qh, thresh) {
  const mask = new Uint8Array(qw * qh);
  for (let y = 0; y < qh; y++) {
    for (let x = 0; x < qw; x++) {
      const i = ((y0 + y) * W + (x0 + x)) * 4;
      if (Math.max(data[i], data[i + 1], data[i + 2]) > thresh) mask[y * qw + x] = 1;
    }
  }

  const seen = new Uint8Array(qw * qh);
  const comps = [];
  const stack = [];
  for (let y = 0; y < qh; y++) {
    for (let x = 0; x < qw; x++) {
      const idx = y * qw + x;
      if (!mask[idx] || seen[idx]) continue;
      seen[idx] = 1;
      stack.length = 0;
      stack.push(x, y);
      let minX = x, maxX = x, minY = y, maxY = y, cnt = 0;
      while (stack.length) {
        const cy = stack.pop(), cx = stack.pop();
        cnt++;
        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
        if (cx > 0) { const ni = cy * qw + cx - 1; if (mask[ni] && !seen[ni]) { seen[ni] = 1; stack.push(cx - 1, cy); } }
        if (cx < qw - 1) { const ni = cy * qw + cx + 1; if (mask[ni] && !seen[ni]) { seen[ni] = 1; stack.push(cx + 1, cy); } }
        if (cy > 0) { const ni = (cy - 1) * qw + cx; if (mask[ni] && !seen[ni]) { seen[ni] = 1; stack.push(cx, cy - 1); } }
        if (cy < qh - 1) { const ni = (cy + 1) * qw + cx; if (mask[ni] && !seen[ni]) { seen[ni] = 1; stack.push(cx, cy + 1); } }
      }
      comps.push({ minX, maxX, minY, maxY, cnt });
    }
  }
  return comps;
}

function boxGap(a, b) {
  const dx = Math.max(0, a.minX - b.maxX, b.minX - a.maxX);
  const dy = Math.max(0, a.minY - b.maxY, b.minY - a.maxY);
  return Math.max(dx, dy);
}

fs.createReadStream(SRC)
  .pipe(new PNG())
  .on('parsed', function () {
    const data = this.data;
    const W = this.width, H = this.height;
    const qw = W / 2, qh = H / 2;
    console.log('icons.png =', W + 'x' + H, '，每象限 =', qw + 'x' + qh, '\n');

    QUADS.forEach(function (q) {
      const x0 = q.x, y0 = q.y;
      let comps = findComponents(data, W, x0, y0, qw, qh, THRESH);
      if (!comps.length) { console.log(q.name, '→ 无内容'); return; }

      // 按像素数降序，取最大分量为种子，反复合并相距 < MERGE 的分量
      comps.sort(function (a, b) { return b.cnt - a.cnt; });
      let box = { minX: comps[0].minX, maxX: comps[0].maxX, minY: comps[0].minY, maxY: comps[0].maxY };
      let merged = true;
      while (merged) {
        merged = false;
        for (let i = 1; i < comps.length; i++) {
          if (boxGap(box, comps[i]) < MERGE) {
            box.minX = Math.min(box.minX, comps[i].minX);
            box.maxX = Math.max(box.maxX, comps[i].maxX);
            box.minY = Math.min(box.minY, comps[i].minY);
            box.maxY = Math.max(box.maxY, comps[i].maxY);
            comps.splice(i, 1);
            merged = true;
            break;
          }
        }
      }

      const cminX = Math.max(x0, x0 + box.minX - MARGIN);
      const cmaxX = Math.min(x0 + qw - 1, x0 + box.maxX + MARGIN);
      const cminY = Math.max(y0, y0 + box.minY - MARGIN);
      const cmaxY = Math.min(y0 + qh - 1, y0 + box.maxY + MARGIN);
      const cw = cmaxX - cminX + 1;
      const ch = cmaxY - cminY + 1;

      const out = new PNG({ width: cw, height: ch });
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const si = ((cminY + y) * W + (cminX + x)) * 4;
          const di = (y * cw + x) * 4;
          out.data[di] = data[si];
          out.data[di + 1] = data[si + 1];
          out.data[di + 2] = data[si + 2];
          out.data[di + 3] = data[si + 3];
        }
      }

      const p = path.join(OUT, q.name);
      out.pack().pipe(fs.createWriteStream(p)).on('close', function () {
        console.log(q.name, '→ 图标边界(' + box.minX + ',' + box.minY + ')-(' + box.maxX + ',' + box.maxY + ')',
          '| 图标', (box.maxX - box.minX + 1) + 'x' + (box.maxY - box.minY + 1),
          '| 裁出', cw + 'x' + ch);
      });
    });
  })
  .on('error', function (e) { console.error('读取失败：', e.message); process.exit(1); });
