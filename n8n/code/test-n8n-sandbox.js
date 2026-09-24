const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync(__dirname + '/t180-n8n.js', 'utf8');
const coreOnly = code.replace(/const inputB64[\s\S]*$/, '');
const input = fs.readFileSync(__dirname + '/js-test-input.png').toString('base64');
const sandbox = {
  Buffer, ArrayBuffer, DataView, Uint8Array, Int32Array, Int8Array,
  Math, JSON, console,
  __input: input, __out: null
};
const ctx = vm.createContext(sandbox);
const t0 = Date.now();
vm.runInContext(coreOnly + '\n__out = transform(Buffer.from(__input, "base64")).toString("base64");', ctx, { timeout: 30000 });
const ms = Date.now() - t0;
console.log('sandbox OK, ms:', ms, 'out b64 len:', sandbox.__out ? sandbox.__out.length : 'null');
if (!sandbox.__out) process.exit(1);
// Verify against golden
const t = require('./t180js2.js');
const outBuf = Buffer.from(sandbox.__out, 'base64');
const a = t.decodePng(outBuf);
const b = t.decodePng(fs.readFileSync(__dirname + '/js-test-gt.png'));
let diff = 0;
for (let i = 0; i < Math.min(a.px.length, b.px.length); i++) if (a.px[i] !== b.px[i]) diff++;
console.log('pixel diffs vs golden:', diff, '/', a.px.length);
console.log(diff === 0 ? 'PIXEL-PERFECT IN SANDBOX' : 'MISMATCH');
