const fs   = require('fs');
const path = require('path');

const SIZES = [16, 32, 48, 256];

// Dark bg (#0d0d0d), red "L" (#b91c1c) — BGRA order for BMP
const BG = [0x0d, 0x0d, 0x0d, 0xff];
const FG = [0x1c, 0x1c, 0xb9, 0xff];

function makePixels(size) {
  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) buf.set(BG, i * 4);

  const margin = Math.max(1, Math.round(size * 0.15));
  const stroke = Math.max(1, Math.round(size * 0.20));

  // Vertical bar (left side)
  for (let y = margin; y < size - margin; y++)
    for (let x = margin; x < margin + stroke; x++)
      buf.set(FG, (y * size + x) * 4);

  // Horizontal bar (bottom)
  for (let y = size - margin - stroke; y < size - margin; y++)
    for (let x = margin; x < size - margin; x++)
      buf.set(FG, (y * size + x) * 4);

  return buf;
}

function makeBmpData(size) {
  const pixels = makePixels(size);

  // Flip rows bottom-up (BMP convention)
  const flipped = Buffer.alloc(pixels.length);
  for (let y = 0; y < size; y++)
    pixels.copy(flipped, y * size * 4, (size - 1 - y) * size * 4, (size - y) * size * 4);

  // AND mask — all zeros = fully opaque
  const andRowBytes = Math.ceil(size / 32) * 4;
  const andMask     = Buffer.alloc(andRowBytes * size, 0x00);

  // BITMAPINFOHEADER (40 bytes); height doubled for ICO XOR+AND layout
  const hdr = Buffer.alloc(40);
  hdr.writeUInt32LE(40,              0);
  hdr.writeInt32LE(size,             4);
  hdr.writeInt32LE(size * 2,         8);
  hdr.writeUInt16LE(1,              12);
  hdr.writeUInt16LE(32,             14);
  hdr.writeUInt32LE(0,              16);
  hdr.writeUInt32LE(pixels.length,  20);

  return Buffer.concat([hdr, flipped, andMask]);
}

function buildIco(sizes) {
  const bmps       = sizes.map(makeBmpData);
  const headerSize = 6 + sizes.length * 16;

  const icoHdr = Buffer.alloc(6);
  icoHdr.writeUInt16LE(0, 0); // reserved
  icoHdr.writeUInt16LE(1, 2); // type = icon
  icoHdr.writeUInt16LE(sizes.length, 4);

  let offset = headerSize;
  const dirEntries = bmps.map((bmp, i) => {
    const sz  = sizes[i];
    const ent = Buffer.alloc(16);
    ent[0] = sz === 256 ? 0 : sz; // 0 encodes 256 in the ICO spec
    ent[1] = sz === 256 ? 0 : sz;
    ent[2] = 0; // color count
    ent[3] = 0; // reserved
    ent.writeUInt16LE(1,          4);
    ent.writeUInt16LE(32,         6);
    ent.writeUInt32LE(bmp.length, 8);
    ent.writeUInt32LE(offset,    12);
    offset += bmp.length;
    return ent;
  });

  return Buffer.concat([icoHdr, ...dirEntries, ...bmps]);
}

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

const ico = buildIco(SIZES);
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), ico);
console.log(`Created assets/icon.ico  (${ico.length} bytes, sizes: ${SIZES.join(', ')}px)`);
