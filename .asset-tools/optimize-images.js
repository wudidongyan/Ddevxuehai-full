/* 生成优化版图片：阿黛 2048×2048 → 512×512，背景 2560×1440 → 1920×1080。
   用面积平均（box filter，预乘 alpha）降采样，保证缩小后不发虚、透明边不渗色。
   输出到 img/opt/（同名），原图保留不动。用法：node optimize-images.js */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..', 'img');
const OUT_DIR = path.join(ROOT, 'opt');

const JOBS = [
  // 阿黛头像 → 512×512
  ['ada-smile.png',   512, 512],
  ['ada-laugh.png',   512, 512],
  ['ada-serious.png', 512, 512],
  ['ada-wink.png',    512, 512],
  ['ada-salute.png',  512, 512],
  // 背景 → 1920×1080
  ['hall-bg.png',     1920, 1080],
  ['bg-map.png',      1920, 1080],
  ['bg-board.png',    1920, 1080],
  ['bg-chronicle.png',1920, 1080],
  ['bg-garden.png',   1920, 1080],
];

function resize(src, dstW, dstH) {
  const W = src.width, H = src.height;
  const out = new PNG({ width: dstW, height: dstH });
  const sd = src.data, od = out.data;
  const sx = W / dstW, sy = H / dstH;

  for (let oy = 0; oy < dstH; oy++) {
    const y0 = oy * sy, y1 = Math.min((oy + 1) * sy, H);
    const iy0 = Math.floor(y0), iy1 = Math.min(Math.ceil(y1), H);
    for (let ox = 0; ox < dstW; ox++) {
      const x0 = ox * sx, x1 = Math.min((ox + 1) * sx, W);
      const ix0 = Math.floor(x0), ix1 = Math.min(Math.ceil(x1), W);

      let r = 0, g = 0, b = 0, a = 0, weight = 0;
      for (let syi = iy0; syi < iy1; syi++) {
        const oyTop = Math.max(syi, y0), oyBot = Math.min(syi + 1, y1);
        const overlapY = oyBot - oyTop;
        if (overlapY <= 0) continue;
        for (let sxi = ix0; sxi < ix1; sxi++) {
          const oxL = Math.max(sxi, x0), oxR = Math.min(sxi + 1, x1);
          const overlapX = oxR - oxL;
          if (overlapX <= 0) continue;
          const w = overlapX * overlapY;
          const si = (syi * W + sxi) * 4;
          const sa = sd[si + 3] / 255;
          r += sd[si] * sa * w;
          g += sd[si + 1] * sa * w;
          b += sd[si + 2] * sa * w;
          a += sa * w;
          weight += w;
        }
      }

      const di = (oy * dstW + ox) * 4;
      if (weight > 0) {
        const avgA = a / weight;
        od[di + 3] = Math.round(avgA * 255);
        if (avgA > 0) {
          od[di] = Math.round(r / weight / avgA);
          od[di + 1] = Math.round(g / weight / avgA);
          od[di + 2] = Math.round(b / weight / avgA);
        } else {
          od[di] = od[di + 1] = od[di + 2] = 0;
        }
      }
    }
  }
  return out;
}

function fmt(n) { return (n / 1024).toFixed(0) + 'KB'; }

fs.mkdirSync(OUT_DIR, { recursive: true });

let pending = JOBS.length;
JOBS.forEach(function (job) {
  const name = job[0], dstW = job[1], dstH = job[2];
  const srcPath = path.join(ROOT, name);
  if (!fs.existsSync(srcPath)) {
    console.error('缺少源文件：' + name);
    pending--;
    return;
  }
  fs.createReadStream(srcPath)
    .pipe(new PNG())
    .on('parsed', function () {
      const srcBytes = fs.statSync(srcPath).size;
      const outPng = resize(this, dstW, dstH);
      const outPath = path.join(OUT_DIR, name);
      outPng.pack().pipe(fs.createWriteStream(outPath)).on('close', function () {
        const dstBytes = fs.statSync(outPath).size;
        console.log(name + '  ' + this.width + 'x' + this.height + ' → ' + dstW + 'x' + dstH +
          '  ' + fmt(srcBytes) + ' → ' + fmt(dstBytes) +
          '  (-' + Math.round((1 - dstBytes / srcBytes) * 100) + '%)');
        if (--pending === 0) console.log('\n全部完成，输出目录：img/opt/');
      }.bind(this));
    })
    .on('error', function (e) { console.error(name + ' 读取失败：' + e.message); pending--; });
});
