const item = items[0];
if (!item.binary || !item.binary.image) return items;
const buf = Buffer.from(item.binary.image.data, 'base64');
if (buf.length < 54 || buf[0] !== 0x42 || buf[1] !== 0x4D) return items;
const dataOffset = buf.readUInt32LE(10);
const W = buf.readInt32LE(18);
const H = buf.readInt32LE(22);
const bpp = buf.readUInt16LE(28);
const ch = bpp / 8;
const aH = Math.abs(H);
const topDown = H < 0;
const rowIn = Math.ceil(W * ch / 4) * 4;
const px = Buffer.alloc(W * aH * ch);
for (let r = 0; r < aH; r++) {
  const srcRow = topDown ? r : (aH - 1 - r);
  buf.copy(px, r * W * ch, dataOffset + srcRow * rowIn, dataOffset + srcRow * rowIn + W * ch);
}
const outW = aH, outH = W;
const outPx = Buffer.alloc(outW * outH * ch);
for (let y = 0; y < outH; y++) {
  for (let x = 0; x < outW; x++) {
    const sIdx = ((aH - 1 - x) * W + (W - 1 - y)) * ch;
    const dIdx = (y * outW + x) * ch;
    px.copy(outPx, dIdx, sIdx, sIdx + ch);
  }
}
const rowOut = Math.ceil(outW * ch / 4) * 4;
const pixelSize = rowOut * outH;
const out = Buffer.alloc(dataOffset + pixelSize);
buf.copy(out, 0, 0, dataOffset);
out.writeUInt32LE(dataOffset + pixelSize, 2);
out.writeInt32LE(outW, 18);
out.writeInt32LE(-outH, 22);
out.writeUInt32LE(pixelSize, 34);
for (let r = 0; r < outH; r++) {
  const rowBuf = Buffer.alloc(rowOut);
  outPx.copy(rowBuf, 0, r * outW * ch, r * outW * ch + outW * ch);
  rowBuf.copy(out, dataOffset + r * rowOut);
}
return [{ json: {}, binary: { image: { data: out.toString('base64'), mimeType: 'image/bmp', fileName: 't180.bmp', fileExtension: 'bmp' } } }];
