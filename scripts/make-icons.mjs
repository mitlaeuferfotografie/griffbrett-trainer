// Erzeugt die App-Icons (PNG) ohne Zusatzpakete: stilisiertes Griffbrett
// (Saiten senkrecht, Bünde waagerecht) mit einem markierten Ton.
// Aufruf: npm run icons  → public/icons/icon-{180,192,512}.png
import fs from 'node:fs';
import zlib from 'node:zlib';

const BG = [2, 6, 23]; // slate-950
const BOARD = [30, 41, 59]; // slate-800
const STRING = [148, 163, 184]; // slate-400
const FRET = [71, 85, 105]; // slate-600
const NUT = [226, 232, 240]; // slate-200
const DOT = [99, 102, 241]; // indigo-500

// Farbe an Position (u, v) in 0…1
function shade(u, v) {
  const bx0 = 0.24, bx1 = 0.76, by0 = 0.16, by1 = 0.9;
  if (u < bx0 || u > bx1 || v < by0 || v > by1) return BG;
  // Saiten: dickste (tiefste) links, höchste rechts – wie beim Blick auf die Gitarre
  // markierter Ton (3. Saite von links, 3. Bundfeld)
  const sx = (i) => bx0 + 0.04 + (i * (bx1 - bx0 - 0.08)) / 5;
  const fy = (j) => by0 + 0.05 + j * 0.15;
  const dx = u - sx(2), dy = v - (fy(2) + fy(3)) / 2;
  if (dx * dx + dy * dy < 0.052 * 0.052) return DOT;
  if (v < by0 + 0.05) return NUT;
  for (let i = 0; i < 6; i++) if (Math.abs(u - sx(i)) < 0.006 + (5 - i) * 0.0012) return STRING;
  for (let j = 1; j < 6; j++) if (Math.abs(v - fy(j)) < 0.008) return FRET;
  return BOARD;
}

function render(size) {
  const ss = 4;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const c = shade((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
          r += c[0]; g += c[1]; b += c[2];
        }
      const n = ss * ss;
      row[1 + x * 3] = Math.round(r / n);
      row[2 + x * 3] = Math.round(g / n);
      row[3 + x * 3] = Math.round(b / n);
    }
    rows.push(row);
  }
  return png(size, size, Buffer.concat(rows));
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync('public/icons', { recursive: true });
for (const size of [180, 192, 512]) {
  fs.writeFileSync(`public/icons/icon-${size}.png`, render(size));
  console.log(`public/icons/icon-${size}.png`);
}
