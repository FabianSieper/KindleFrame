'use strict';
const zlib = require('zlib');
const fs = require('fs');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504E47 || buf.readUInt32BE(4) !== 0x0D0A1A0A) throw new Error('bad png signature');
  let off = 8;
  let width, height, bitDepth, colorType, interlace;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len;
  }
  if (width === undefined) throw new Error('no IHDR');
  if (bitDepth !== 8) throw new Error('bitdepth ' + bitDepth + ' unsupported');
  if (interlace !== 0) throw new Error('interlaced png unsupported');
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error('colortype ' + colorType + ' unsupported');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const expected = (stride + 1) * height;
  if (raw.length < expected) throw new Error('idat too short: ' + raw.length + ' < ' + expected);
  const px = Buffer.alloc(height * stride);
  const prior = Buffer.alloc(stride);
  let r = 0;
  for (let y = 0; y < height; y++) {
    const f = raw[r++];
    const row = px.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const rv = raw[r + x];
      const a = x >= channels ? row[x - channels] : 0;
      const b = prior[x];
      const c = x >= channels ? prior[x - channels] : 0;
      let v;
      switch (f) {
        case 0: v = rv; break;
        case 1: v = rv + a; break;
        case 2: v = rv + b; break;
        case 3: v = rv + ((a + b) >> 1); break;
        case 4: v = rv + paeth(a, b, c); break;
        default: throw new Error('bad filter ' + f);
      }
      row[x] = v & 0xFF;
    }
    r += stride;
    prior.set(row);
  }
  return { width, height, channels, px };
}

// antitransverse: in (W x H) -> out (H x W),  out[yOut][xOut] = in[W-1-yOut][H-1-xOut]
function antitranspose(img) {
  const W = img.width, H = img.height, C = img.channels, px = img.px;
  const out = Buffer.alloc(W * H * C);
  for (let yOut = 0; yOut < W; yOut++) {
    const xPart = (W - 1 - yOut) * C;
    const dBase = yOut * H * C;
    for (let xOut = 0; xOut < H; xOut++) {
      const sIdx = ((H - 1 - xOut) * W + (W - 1 - yOut)) * C;
      out.set(px.subarray(sIdx, sIdx + C), dBase + xOut * C);
      void xPart;
    }
  }
  return { width: H, height: W, channels: C, px: out };
}

function encodePng(img) {
  const W = img.width, H = img.height, C = img.channels, px = img.px;
  const colortype = { 1: 0, 3: 2, 4: 6 }[C];
  if (colortype === undefined) throw new Error('cannot map channels ' + C);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = colortype; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = W * C;
  const raw = Buffer.alloc((stride + 1) * H);
  const prior = Buffer.alloc(stride);
  let r = 0;
  for (let y = 0; y < H; y++) {
    const row = px.subarray(y * stride, (y + 1) * stride);
    let bestF = 0, bestCost = Infinity, bestBuf = null;
    for (let f = 0; f < 5; f++) {
      const cand = Buffer.alloc(stride + 1);
      cand[0] = f;
      let cost = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= C ? row[x - C] : 0;
        const b = prior[x];
        const c = x >= C ? prior[x - C] : 0;
        let v;
        switch (f) {
          case 0: v = row[x]; break;
          case 1: v = row[x] - a; break;
          case 2: v = row[x] - b; break;
          case 3: v = row[x] - ((a + b) >> 1); break;
          case 4: v = row[x] - paeth(a, b, c); break;
        }
        cand[x + 1] = v & 0xFF;
        cost += v < 0 ? -v : v;
      }
      if (cost < bestCost) { bestCost = cost; bestF = f; bestBuf = cand; }
    }
    raw.set(bestBuf, r);
    r += stride + 1;
    prior.set(row);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function transform(base64In) {
  const buf = Buffer.from(base64In, 'base64');
  const img = decodePng(buf);
  const out = antitranspose(img);
  return encodePng(out);
}

if (require.main === module) {
  const [inPath, outPath] = process.argv.slice(2);
  const t0 = Date.now();
  const res = transform(fs.readFileSync(inPath).toString('base64'));
  fs.writeFileSync(outPath, res);
  console.log('out bytes:', res.length, 'ms:', Date.now() - t0);
}
module.exports = { transform, decodePng, antitranspose, encodePng };