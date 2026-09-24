const fs = require('fs');

function antitransposeBmp(buf) {
  if (buf[0] !== 0x42 || buf[1] !== 0x4D) throw new Error('not BMP');
  const dataOffset = buf.readUInt32LE(10);
  const W = buf.readInt32LE(18);
  const H = buf.readInt32LE(22);
  const bpp = buf.readUInt16LE(28);
  const ch = bpp / 8;
  const rowIn = Math.ceil(W * ch / 4) * 4;
  const topDown = H < 0;
  const aH = Math.abs(H);

  // Extract pixels into a flat buffer (top-down order)
  const px = Buffer.alloc(W * aH * ch);
  for (let y = 0; y < aH; y++) {
    const srcRow = topDown ? y : (aH - 1 - y);
    buf.copy(px, y * W * ch, dataOffset + srcRow * rowIn, dataOffset + srcRow * rowIn + W * ch);
  }

  // Antitranspose: out(x,y) = in(W-1-y, H-1-x), output is aH x W
  const outW = aH, outH = W;
  const outPx = Buffer.alloc(outW * outH * ch);
  for (let yOut = 0; yOut < outW; yOut++) {
    for (let xOut = 0; xOut < outH; xOut++) {
      const sIdx = ((aH - 1 - xOut) * W + (W - 1 - yOut)) * ch;
      px.copy(outPx, (yOut * outH + xOut) * ch, sIdx, sIdx + ch);
    }
  }

  // Write new BMP (bottom-up, same bpp)
  const rowOut = Math.ceil(outW * ch / 4) * 4;
  const pixelSize = rowOut * outH;
  const out = Buffer.alloc(dataOffset + pixelSize);
  // Copy header
  buf.copy(out, 0, 0, dataOffset);
  // Update header fields
  out.writeUInt32LE(dataOffset + pixelSize, 2); // filesize
  out.writeInt32LE(-outH, 18); // height (negative = top-down for simplicity)
  out.writeUInt32LE(outW, 18 + 0); // width
  // Actually let me write it properly:
  out.writeInt32LE(outW, 18);  // width
  out.writeInt32LE(outH, 22);  // height positive = bottom-up
  out.writeUInt32LE(pixelSize, 34); // imagesize

  // Write pixels bottom-up
  for (let y = 0; y < outH; y++) {
    const srcRow = outH - 1 - y; // bottom-up
    const padded = Buffer.alloc(rowOut);
    outPx.copy(padded, 0, srcRow * outW * ch, srcRow * outW * ch + outW * ch);
    padded.copy(out, dataOffset + y * rowOut);
  }
  return out;
}

// Test
const inp = fs.readFileSync('js-test-input.bmp');
const out = antitransposeBmp(inp);
fs.writeFileSync('test-bmp-out.bmp', out);
console.log('input:', inp.readInt32LE(18), 'x', inp.readInt32LE(22));
console.log('output:', out.readInt32LE(18), 'x', out.readInt32LE(22));

// Verify with PIL
const { execSync } = require('child_process');
execSync(`python3 -c "
from PIL import Image
import numpy as np
a = np.array(Image.open('js-test-input.bmp'))
b = np.array(Image.open('test-bmp-out.bmp'))
# antitranspose: rotate 180 + transpose
expected = np.rot90(a, 2).T  # rotate 180 then transpose
# or equivalently: flip both axes then transpose
print('expected shape:', expected.shape)
print('actual shape:', b.shape)
diffs = np.sum(expected != b)
print('pixel diffs:', diffs, '/', expected.size)
"`);
