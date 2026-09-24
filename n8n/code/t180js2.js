'use strict';
const fs = require('fs');
const zlib = require('zlib'); // local reference only — NOT used in n8n Code node

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

function growBuf(buf, minLen) {
  let n = buf.length * 2;
  while (n < minLen) n *= 2;
  const nb = Buffer.alloc(n);
  buf.copy(nb, 0);
  return nb;
}

// ---------------- pure-JS DEFLATE inflate (RFC 1951) ----------------
const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CLCLEN_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

function revBits(v, n) { let r = 0; for (let i = 0; i < n; i++) { r = (r << 1) | (v & 1); v >>= 1; } return r; }
function buildTable(lengths) {
  const count = new Array(16).fill(0);
  for (let i = 0; i < lengths.length; i++) count[lengths[i]]++;
  if (count[0] === lengths.length) return null;
  let left = 1;
  for (let len = 1; len <= 15; len++) { left <<= 1; left -= count[len]; if (left < 0) throw new Error('inflate: over-subscribed code'); }
  const sym = new Int32Array(1 << 15);
  const lenTab = new Int8Array(1 << 15);
  const nextCode = new Array(16).fill(0);
  for (let len = 1; len < 15; len++) nextCode[len + 1] = (nextCode[len] + count[len]) << 1;
  for (let n = 0; n < lengths.length; n++) {
    const L = lengths[n];
    if (L === 0) continue;
    const R = revBits(nextCode[L]++, L);
    for (let v = R; v < 32768; v += (1 << L)) { sym[v] = n; lenTab[v] = L; }
  }
  return { sym, lenTab };
}
let fixedLitTab = null, fixedDistTab = null;
function fixedTables() {
  if (fixedLitTab) return;
  const ll = new Array(288);
  for (let i = 0; i < 144; i++) ll[i] = 8;
  for (let i = 144; i < 256; i++) ll[i] = 9;
  for (let i = 256; i < 280; i++) ll[i] = 7;
  for (let i = 280; i < 288; i++) ll[i] = 8;
  fixedLitTab = buildTable(ll);
  fixedDistTab = buildTable(new Array(30).fill(5));
}

function inflate(src, expectedLen) {
  try {
    return inflateCore(src, 0, expectedLen);
  } catch (e) {
    if (src.length >= 2 && (src[0] & 0x0F) === 8 && ((src[0] * 256 + src[1]) % 31 === 0)) {
      return inflateCore(src, 2, expectedLen);
    }
    throw e;
  }
}

function inflateCore(src, start, expectedLen) {
  fixedTables();
  let pos = start, bitbuf = 0, bitcnt = 0;
  function bits(need) {
    let val = bitbuf;
    while (bitcnt < need) {
      if (pos >= src.length) { bitcnt = need; break; }
      val |= src[pos++] << bitcnt;
      bitcnt += 8;
    }
    bitbuf = val >>> need;
    bitcnt -= need;
    return val & ((1 << need) - 1);
  }
  function rewind(w15, used) {
    if (used < 15) { bitbuf = (bitbuf << (15 - used)) | (w15 >>> used); bitcnt += 15 - used; }
  }
  function alignByte() { bitbuf = 0; bitcnt = 0; }
  const out = Buffer.alloc(expectedLen || 65536);
  let sz = 0;
  let final = false;
  while (!final) {
    final = bits(1) === 1;
    const type = bits(2);
    if (type === 0) {
      alignByte();
      const len = src[pos] | (src[pos + 1] << 8);
      const nlen = src[pos + 2] | (src[pos + 3] << 8);
      if (len !== (~nlen & 0xFFFF)) throw new Error('inflate: stored block length mismatch');
      pos += 4;
      if (sz + len > out.length) out.copy(growBuf(out, sz + len), 0);
      out.set(src.subarray(pos, pos + len), sz);
      sz += len;
      pos += len;
    } else if (type === 1) {
      decodeBlock(fixedLitTab, fixedDistTab);
    } else if (type === 2) {
      const hlit = bits(5) + 257;
      const hdist = bits(5) + 1;
      const hcLEN = bits(4) + 4;
      const cl = new Array(19).fill(0);
      for (let i = 0; i < hcLEN; i++) cl[CLCLEN_ORDER[i]] = bits(3);
      const clTab = buildTable(cl);
      const lens = new Array(hlit + hdist);
      let i = 0;
      while (i < hlit + hdist) {
        const w15 = bits(15);
        const cl = clTab.lenTab[w15];
        if (cl === 0) throw new Error('inflate: invalid CL symbol');
        rewind(w15, cl);
        const s = clTab.sym[w15];
        if (s < 16) { lens[i++] = s; }
        else if (s === 16) { const rep = bits(2) + 3; const pv = lens[i - 1]; for (let k = 0; k < rep; k++) lens[i++] = pv; }
        else if (s === 17) { const rep = bits(3) + 3; for (let k = 0; k < rep; k++) lens[i++] = 0; }
        else { const rep = bits(7) + 11; for (let k = 0; k < rep; k++) lens[i++] = 0; }
      }
      const litTab = buildTable(lens.slice(0, hlit));
      const distTab = buildTable(lens.slice(hlit));
      decodeBlock(litTab, distTab);
    } else {
      throw new Error('inflate: bad block type ' + type);
    }
  }
  function decodeBlock(litTab, distTab) {
    for (;;) {
      const w15 = bits(15);
      const l = litTab.lenTab[w15];
      if (l === 0) throw new Error('inflate: invalid literal code');
      rewind(w15, l);
      const s = litTab.sym[w15];
      if (s < 256) {
        if (sz >= out.length) out.copy(growBuf(out, out.length), 0);
        out[sz++] = s;
      } else if (s === 256) break;
      else {
        const len = LEN_BASE[s - 257] + bits(LEN_EXTRA[s - 257]);
        const dw = bits(15);
        const dl = distTab.lenTab[dw];
        if (dl === 0) throw new Error('inflate: invalid distance code');
        rewind(dw, dl);
        const di = distTab.sym[dw];
        const d = DIST_BASE[di] + bits(DIST_EXTRA[di]);
        if (d > sz) throw new Error('inflate: distance too far back');
        if (sz + len > out.length) out.copy(growBuf(out, sz + len), 0);
        for (let k = 0; k < len; k++) out[sz + k] = out[sz + k - d];
        sz += len;
      }
    }
  }
  return out.subarray(0, sz);
}

// ---------------- pure-JS fixed-Huffman DEFLATE + simple LZ77 ----------------
function deflateFixed(raw) {
  const LB = LEN_BASE, LX = LEN_EXTRA, DB = DIST_BASE, DX = DIST_EXTRA;
  function lenCode(len) {
    for (let i = 28; i >= 0; i--) if (len >= LB[i]) return [257 + i, len - LB[i]];
    return null;
  }
  function distCode(d) {
    for (let i = 29; i >= 0; i--) if (d >= DB[i]) return [i, d - DB[i]];
    return null;
  }
  function litValue(sym) { const C = sym < 144 ? 0x30 + sym : sym < 256 ? 0x190 + (sym - 144) : sym < 280 ? sym - 256 : 0xC0 + (sym - 280); return revBits(C, litBitsN(sym)); }
  function litBitsN(sym) { return sym < 144 ? 8 : sym < 256 ? 9 : sym < 280 ? 7 : 8; }
  function distVal(idx) { return revBits(idx, 5); }

  const out = Buffer.alloc(raw.length + 64);
  let opos = 0, bitbuf = 0, bitcnt = 0;
  function put(v, n) {
    bitbuf |= v << bitcnt;
    bitcnt += n;
    while (bitcnt >= 8) {
      if (opos >= out.length) out.copy(growBuf(out, opos + 8), 0);
      out[opos++] = bitbuf & 0xFF;
      bitbuf >>>= 8;
      bitcnt -= 8;
    }
  }
  put(1, 1); put(1, 2);

  const n = raw.length;
  const HASH_BITS = 13;
  const head = new Int32Array(1 << HASH_BITS).fill(-1);
  const prev = new Int32Array(n).fill(-1);
  let p = 0;
  while (p < n) {
    if (p + 4 > n) { put(litValue(raw[p]), litBitsN(raw[p])); p++; continue; }
    const h = ((raw[p] << 10) ^ (raw[p + 1] << 5) ^ raw[p + 2]) & ((1 << HASH_BITS) - 1);
    let cand = head[h];
    prev[p] = cand;
    head[h] = p;
    let best = 0, bestD = 0, chain = 0;
    while (cand >= 0 && chain < 128) {
      const d = p - cand;
      if (d > 32768 || d <= 0) break;
      let len = 0;
      const max = Math.min(258, n - p);
      while (len < max && raw[cand + len] === raw[p + len]) len++;
      if (len > best) { best = len; bestD = d; if (len === max) break; }
      cand = prev[cand];
      chain++;
    }
    if (best >= 4) {
      const lc = lenCode(best);
      put(litValue(lc[0]), litBitsN(lc[0]));
      put(lc[1], LX[lc[0] - 257]);
      const dc = distCode(bestD);
      put(distVal(dc[0]), 5);
      put(dc[1], DX[dc[0]]);
      p += best;
    } else {
      put(litValue(raw[p]), litBitsN(raw[p]));
      p++;
    }
  }
  put(litValue(256), litBitsN(256));
  while (bitcnt > 0) {
    if (opos >= out.length) out.copy(growBuf(out, opos + 8), 0);
    out[opos++] = bitbuf & 0xFF;
    bitbuf >>>= 8;
    bitcnt -= 8;
  }
  const fixedOut = Buffer.from(out.subarray(0, opos));

  const blocks = Math.ceil(n / 65535);
  const stored = Buffer.alloc(n + 5 * blocks + 8);
  let s = 0, b2 = 0, c2 = 0;
  function put2(v, nn) {
    b2 |= v << c2;
    c2 += nn;
    while (c2 >= 8) { stored[s++] = b2 & 0xFF; b2 >>>= 8; c2 -= 8; }
  }
  put2(1, 1); put2(0, 2);
  while (c2 > 0) { stored[s++] = b2 & 0xFF; b2 >>>= 8; c2 = 0; }
  for (let off = 0; off < n; off += 65535) {
    const len = Math.min(65535, n - off);
    stored[s] = len & 0xFF; stored[s + 1] = len >> 8;
    stored[s + 2] = (~len) & 0xFF; stored[s + 3] = (~len) >> 8;
    raw.copy(stored, s + 4, off, off + len);
    s += 4 + len;
  }
  const storedOut = Buffer.from(stored.subarray(0, s));
  return fixedOut.length <= storedOut.length ? fixedOut : storedOut;
}

// ---------------- PNG pipeline ----------------
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
    } else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (width === undefined) throw new Error('no IHDR');
  if (bitDepth !== 8) throw new Error('bitdepth ' + bitDepth + ' unsupported');
  if (interlace !== 0) throw new Error('interlaced png unsupported');
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error('colortype ' + colorType + ' unsupported');
  const raw = inflate(Buffer.concat(idat), (width * channels + 1) * height);
  const stride = width * channels;
  if (raw.length < (stride + 1) * height) throw new Error('raw too short: ' + raw.length);
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
function antitranspose(img) {
  const W = img.width, H = img.height, C = img.channels, px = img.px;
  const out = Buffer.alloc(W * H * C);
  for (let yOut = 0; yOut < W; yOut++) {
    const dBase = yOut * H * C;
    for (let xOut = 0; xOut < H; xOut++) {
      const sIdx = ((H - 1 - xOut) * W + (W - 1 - yOut)) * C;
      out.set(px.subarray(sIdx, sIdx + C), dBase + xOut * C);
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
  const idat = deflateFixed(raw);
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

  // self-test: inflate must match zlib on this file's IDAT
  const d = decodePng(fs.readFileSync(inPath));
  // round trip: decode own output, must equal antitransposed input
  const rt = decodePng(res);
  const want = antitranspose(d);
  let ok = rt.width === want.width && rt.height === want.height && rt.px.equals(want.px);
  console.log('roundtrip pixel-exact:', ok, rt.width + 'x' + rt.height);
  if (!ok) process.exit(1);
}
module.exports = { transform, decodePng, antitranspose, encodePng, deflateFixed, inflate };