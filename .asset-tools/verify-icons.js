/* 验证裁出的四张入口图标：尺寸、边缘截断、ASCII 观感 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const OUT = path.join(__dirname, '..', 'img');
const FILES = ['icon-map.png', 'icon-board.png', 'icon-chronicle.png', 'icon-garden.png'];
const THRESH = 42;

FILES.forEach(function (f) {
  const p = path.join(OUT, f);
  fs.createReadStream(p).pipe(new PNG()).on('parsed', function () {
    const data = this.data, W = this.width, H = this.height;
    let minX = W, maxX = -1, minY = H, maxY = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (Math.max(data[i], data[i + 1], data[i + 2]) > THRESH) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    const touchesEdge = (minX <= 1 || maxX >= W - 2 || minY <= 1 || maxY >= H - 2);
    console.log(f, '尺寸', W + 'x' + H,
      '| 内容边界(' + minX + ',' + minY + ')-(' + maxX + ',' + maxY + ')',
      '| 边缘截断:', touchesEdge ? '⚠️ 有' : '✅ 无');

    // ASCII 观感（缩放到 ~44x22）
    const cols = 44, rows = 22;
    let grid = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = Math.floor((c + 0.5) / cols * W);
        const y = Math.floor((r + 0.5) / rows * H);
        const i = (y * W + x) * 4;
        grid += Math.max(data[i], data[i + 1], data[i + 2]) > THRESH ? '#' : '.';
      }
      grid += '\n';
    }
    console.log(grid);
  });
});
