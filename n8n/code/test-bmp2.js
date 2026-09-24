const fs = require('fs');

function antitransposeBmp(buf) {
  if (buf.length < 54 || buf[0] !== 0x42 || buf[1] !== 0x4D) throw new Error('not BMP: ' + buf.length + 'b');
  const dataOffset = buf.readUInt32LE(10);
  const W = buf.readInt32LE(18);
  const H = buf.readInt32LE(22);
  const bpp = buf.readUInt16LE(28);
  const ch = bpp / 8;
  const aH = Math.abs(H);
  const topDown = H < 0;
  const rowIn = Math.ceil(W * ch / 4) * 4;

  // Extract to flat top-down buffer
  const px = Buffer.alloc(W * aH * ch);
  for (let r = 0; r < aH; r++) {
    const srcRow = topDown ? r : (aH - 1 - r);
    buf.copy(px, r * W * ch, dataOffset + srcRow * rowIn, dataOffset + srcRow * rowIn + W * ch);
  }

  // Antitranspose: out is aH x W (swapped dims)
  // out(x, y) = in(W-1-y, aH-1-x)  where x in [0,aH), y in [0,W)
  const outW = aH, outH = W;
  const outPx = Buffer.alloc(outW * outH * ch);
  for (let y = 0; y < outH; y++) {       // y in [0, W) = output row
    for (let x = 0; x < outW; x++) {     // x in [0, aH) = output col
      const sRow = aH - 1 - x;           // source row in [0, aH)
      const sCol = W - 1 - y;           // source col in [0, W)
      const sIdx = (sRow * W + sCol) * ch;
      const dIdx = (y * outW + x) * ch;
      px.copy(outPx, dIdx, sIdx, sIdx + ch);
    }
  }

  // Write new BMP (top-down, negative height)
  const rowOut = Math.ceil(outW * ch / 4) * 4;
  const pixelSize = rowOut * outH;
  const out = Buffer.alloc(dataOffset + pixelSize);
  buf.copy(out, 0, 0, dataOffset); // copy header
  out.writeUInt32LE(dataOffset + pixelSize, 2);
  out.writeInt32LE(outW, 18);
  out.writeInt32LE(-outH, 22); // negative = top-down
  out.writeUInt32LE(pixelSize, 34);
  // Write top-down rows with padding
  for (let r = 0; r < outH; r++) {
    const rowBuf = Buffer.alloc(rowOut);
    outPx.copy(rowBuf, 0, r * outW * ch, r * outW * ch + outW * ch);
    rowBuf.copy(out, dataOffset + r * rowOut);
  }
  return out;
}

const inp = fs.readFileSync('js-test-input.bmp');
console.log('in:', inp.readInt32LE(18), 'x', inp.readInt32LE(22), 'bpp', inp.readUInt16LE(28));
const out = antitransposeBmp(inp);
fs.writeFileSync('test-bmp-out.bmp', out);
console.log('out:', out.readInt32LE(18), 'x', Math.abs(out.readInt32LE(22)));

// Verify
const { execSync } = require('child_process');
const result = execSync(`python3 -c "
from PIL import Image
import numpy as np
a = np.array(Image.open('js-test-input.bmp'))
b = np.array(Image.open('test-bmp-out.bmp'))
expected = a[::-1, ::-1].T
print('expected:', expected.shape, 'actual:', b.shape)
print('diffs:', int(np.sum(expected != b)), '/', expected.size)
"`).toString();
console.log(result);
