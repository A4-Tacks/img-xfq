#!/bin/node

import sharp from "sharp";
import getopts from "getopts";

const options = getopts(process.argv.slice(2), {
  alias: {
    h: 'help',
    d: 'decrypt',
  },
  default: {
    help: false,
    decrypt: false,
  },
  unknown(name) {
    throw `unknown option: ${name}`
  }
});

if (options.help) {
  console.log("Usage: img-xfq [-d | --decrypt] [FILE..]");
  process.exit(0)
}

for (let file of options._) {
  await handle(file)
}

async function handle(imgname) {
  const kind = options.decrypt ? '_xfqdec' : '_xfqenc';
  const newname = imgname.replace(/(\.[^.]+)?$/, suf => kind + suf);
  let img = sharp(imgname).raw();
  let {width, height, channels} = await img.metadata()
  console.log({imgname, width, height, channels, newname});
  if (imgname == newname) throw `cannot gen name: ${imgname}`;

  // 小番茄混淆的原逻辑, 改成了nodejs版本
  const curve = gilbert2d(width, height);
  const offset = Math.round((Math.sqrt(5) - 1) / 2 * width * height);

  let imgdata = await img.toBuffer()
  let imgdata2 = Buffer.alloc(width*height*channels)

  if (options.decrypt) {
    for(let i = 0; i < width * height; i++){
      const old_pos = curve[i];
      const new_pos = curve[(i + offset) % (width * height)];
      const old_p = channels * (old_pos[0] + old_pos[1] * width);
      const new_p = channels * (new_pos[0] + new_pos[1] * width);
      imgdata2.set(imgdata.subarray(new_p, new_p + channels), old_p);
    }
  } else {
    for(let i = 0; i < width * height; i++){
      const old_pos = curve[i];
      const new_pos = curve[(i + offset) % (width * height)];
      const old_p = channels * (old_pos[0] + old_pos[1] * width);
      const new_p = channels * (new_pos[0] + new_pos[1] * width);
      imgdata2.set(imgdata.subarray(old_p, old_p + channels), new_p);
    }
  }

  let newimg = sharp(imgdata2, {raw: {width, height, channels}})
  await newimg.toFile(newname)
}

// 完全复制原版算法的希尔伯特曲线生成函数
function gilbert2d(width, height) {
  const coordinates = [];

  if (width >= height) {
    generate2d(0, 0, width, 0, 0, height, coordinates);
  } else {
    generate2d(0, 0, 0, height, width, 0, coordinates);
  }

  return coordinates;
}

function generate2d(x, y, ax, ay, bx, by, coordinates) {
  const w = Math.abs(ax + ay);
  const h = Math.abs(bx + by);

  const dax = Math.sign(ax), day = Math.sign(ay);
  const dbx = Math.sign(bx), dby = Math.sign(by);

  if (h === 1) {
    for (let i = 0; i < w; i++) {
      coordinates.push([x, y]);
      x += dax;
      y += day;
    }
    return;
  }

  if (w === 1) {
    for (let i = 0; i < h; i++) {
      coordinates.push([x, y]);
      x += dbx;
      y += dby;
    }
    return;
  }

  let ax2 = Math.floor(ax / 2), ay2 = Math.floor(ay / 2);
  let bx2 = Math.floor(bx / 2), by2 = Math.floor(by / 2);

  const w2 = Math.abs(ax2 + ay2);
  const h2 = Math.abs(bx2 + by2);

  if (2 * w > 3 * h) {
    if ((w2 % 2) && (w > 2)) {
      ax2 += dax;
      ay2 += day;
    }

    generate2d(x, y, ax2, ay2, bx, by, coordinates);
    generate2d(x + ax2, y + ay2, ax - ax2, ay - ay2, bx, by, coordinates);

  } else {
    if ((h2 % 2) && (h > 2)) {
      bx2 += dbx;
      by2 += dby;
    }

    generate2d(x, y, bx2, by2, ax2, ay2, coordinates);
    generate2d(x + bx2, y + by2, ax, ay, bx - bx2, by - by2, coordinates);
    generate2d(x + (ax - dax) + (bx2 - dbx), y + (ay - day) + (by2 - dby),
      -bx2, -by2, -(ax - ax2), -(ay - ay2), coordinates);
  }
}
