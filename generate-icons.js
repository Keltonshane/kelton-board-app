/**
 * Generates PNG icon files for the Kelton Board PWA.
 * Run once: node generate-icons.js
 * Requires only Node.js built-ins (no npm packages).
 */
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── CRC32 ──────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBuf    = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput  = Buffer.concat([typeBytes, data]);
  const crcBuf    = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

// ── PNG builder ─────────────────────────────────────────────
function makePNG(size, bg, fg) {
  const [br, bg2, bb] = bg;
  const [fr, fg2, fb] = fg;

  // RGBA pixel buffer — start with background
  const pixels = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4]     = br;
    pixels[i * 4 + 1] = bg2;
    pixels[i * 4 + 2] = bb;
    pixels[i * 4 + 3] = 255;
  }

  function setRect(x0, y0, x1, y1) {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        const idx = (y * size + x) * 4;
        pixels[idx] = fr; pixels[idx + 1] = fg2; pixels[idx + 2] = fb;
      }
    }
  }

  // Draw "L" shape — proportional to icon size
  const pad   = Math.round(size * 0.165);
  const thick = Math.round(size * 0.195);

  // Vertical stem of the L
  setRect(pad, pad, pad + thick, size - pad);
  // Horizontal foot of the L
  setRect(pad, size - pad - thick, size - pad, size - pad);

  // Build PNG scanlines (filter byte 0 = None per row)
  const scanlines = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    scanlines[rowStart] = 0; // filter byte
    pixels.copy(scanlines, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit depth, RGBA color type

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Generate ────────────────────────────────────────────────
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

const BG = [13, 13, 13];   // #0d0d0d
const FG = [185, 28, 28];  // #b91c1c

const icons = [
  { size: 16,  name: 'favicon.png'  },
  { size: 180, name: 'icon-180.png' },
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
];

icons.forEach(({ size, name }) => {
  const outPath = path.join(assetsDir, name);
  fs.writeFileSync(outPath, makePNG(size, BG, FG));
  console.log(`  ✓  ${name}  (${size}×${size})`);
});

console.log('\nDone. Icons saved to assets/');
