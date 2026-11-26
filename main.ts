// World News in One Day: Wednesday 25 November 2026
// Original newspaper front page renderer. Node 22, stdlib only, no network.
// Draws a 1024x1024 PNG to /output/entry.png. Fully deterministic.
import * as fs from "node:fs";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- canvas ----
const img = new Uint8Array(W * H * 3);

type RGB = [number, number, number];
const PAPER: RGB = [248, 243, 232];
const INK: RGB = [18, 18, 18];
const RED: RGB = [164, 30, 34];
const BLUE: RGB = [29, 78, 137];
const NAVY: RGB = [12, 22, 48];
const GOLD: RGB = [176, 128, 24];
const GREY: RGB = [110, 108, 100];
const WHITE: RGB = [255, 255, 255];
const SKY: RGB = [214, 228, 240];
const GREEN: RGB = [32, 110, 62];

function px(x: number, y: number, c: RGB): void {
  if (x < clip.x0 || y < clip.y0 || x >= clip.x1 || y >= clip.y1) return;
  const i = (y * W + x) * 3;
  img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2];
}
// Optional clip rectangle (defaults to the whole canvas).
let clip = { x0: 0, y0: 0, x1: W, y1: H };
function setClip(x0: number, y0: number, x1: number, y1: number): void {
  clip = { x0, y0, x1, y1 };
}
function clearClip(): void {
  clip = { x0: 0, y0: 0, x1: W, y1: H };
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) px(xx, yy, c);
}
function hline(x: number, y: number, w: number, c: RGB, t = 1): void {
  rect(x, y, w, t, c);
}
function vline(x: number, y: number, h: number, c: RGB, t = 1): void {
  rect(x, y, t, h, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    px(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r * r) px(cx + x, cy + y, c);
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const a = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / d;
      const b = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / d;
      const g = 1 - a - b;
      if (a >= 0 && b >= 0 && g >= 0) px(x, y, c);
    }
}
// Deterministic pseudo-random (fixed seed LCG) for star positions.
let seed = 20261125;
function rnd(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

// ------------------------------------------------------------------ font ----
// Hand-drawn 5x7 bitmap font. Each glyph: 7 rows of 5 bits.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  '"': ["01010", "01010", "01010", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "*": ["00000", "00100", "10101", "01110", "10101", "00100", "00000"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "<": ["00010", "00100", "01000", "10000", "01000", "00100", "00010"],
  ">": ["01000", "00100", "00010", "00001", "00010", "00100", "01000"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
};

function charWidth(scale: number): number { return 6 * scale; }
function textWidth(s: string, scale: number): number {
  return s.length * charWidth(scale) - scale;
}
function drawChar(x: number, y: number, ch: string, scale: number, c: RGB): void {
  const g = FONT[ch] ?? FONT["?"];
  for (let r = 0; r < 7; r++)
    for (let col = 0; col < 5; col++)
      if (g[r][col] === "1") rect(x + col * scale, y + r * scale, scale, scale, c);
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  const up = s.toUpperCase();
  for (let i = 0; i < up.length; i++)
    drawChar(x + i * charWidth(scale), y, up[i], scale, c);
}
function drawTextCenter(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}
function wrap(text: string, maxW: number, scale: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (textWidth(t, scale) <= maxW) cur = t;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
function paragraph(x: number, y: number, text: string, maxW: number, scale: number, c: RGB, lh: number): number {
  const lines = wrap(text, maxW, scale);
  for (let i = 0; i < lines.length; i++) drawText(x, y + i * lh, lines[i], scale, c);
  return y + lines.length * lh;
}

// ------------------------------------------------------------------ page ----
// Paper background
rect(0, 0, W, H, PAPER);

// Top rule + masthead
hline(30, 22, 964, INK, 4);
drawTextCenter(512, 38, "THE WORLD IN ONE DAY", 6, INK);
drawTextCenter(512, 92, "WEDNESDAY 25 NOVEMBER 2026", 4, RED);
hline(30, 138, 964, INK, 4);
hline(30, 146, 964, INK, 1);

// ---- Lead story panel: Shenzhou-24 / Pakistan's first astronaut ----
const LX = 30, LY = 158, LW = 964, LH = 330;
rect(LX, LY, LW, LH, WHITE);
rect(LX, LY, LW, 3, INK); rect(LX, LY + LH - 3, LW, 3, INK);
rect(LX, LY, 3, LH, INK); rect(LX + LW - 3, LY, 3, LH, INK);

// Left text column
drawText(LX + 22, LY + 18, "SPACE - CHINA", 2, RED);
drawText(LX + 22, LY + 48, "PAKISTAN'S FIRST", 4, INK);
drawText(LX + 22, LY + 84, "ASTRONAUT IN ORBIT", 4, INK);
hline(LX + 22, LY + 122, 480, RED, 3);
paragraph(
  LX + 22, LY + 140,
  "Shenzhou-24 launched at 00:18 UTC from Jiuquan carrying Muhammad Zeeshan Ali, the first Pakistani in orbit and the first foreign astronaut to visit China's Tiangong space station. The craft docked the same day; Ali stays 5-10 days for experiments.",
  500, 2, INK, 19,
);
drawText(LX + 22, LY + 296, "CREW: TANG HONGBO - WU YI - M. ZEESHAN ALI", 2, BLUE);

// Right art: night sky, rocket, station, Earth
const AX = 590, AY = 172, AW = 384, AH = 302;
rect(AX, AY, AW, AH, NAVY);
seed = 20261125;
for (let i = 0; i < 46; i++) {
  const sx = AX + 6 + Math.floor(rnd() * (AW - 12));
  const sy = AY + 6 + Math.floor(rnd() * (AH - 120));
  const s = rnd() > 0.85 ? 2 : 1;
  rect(sx, sy, s, s, WHITE);
}
// Earth arc at bottom, clipped to the art box so it never spills out
setClip(AX, AY, AX + AW, AY + AH);
rect(AX, AY + AH - 26, AW, 26, [34, 96, 150]);
disc(AX + AW - 40, AY + AH + 130, 170, BLUE);
disc(AX + AW - 40, AY + AH + 130, 150, [46, 120, 178]);
clearClip();
// Tiangong station (small, top right)
rect(AX + 268, AY + 44, 62, 10, WHITE);
rect(AX + 278, AY + 30, 42, 8, [190, 200, 220]);
rect(AX + 292, AY + 56, 14, 26, [190, 200, 220]);
line(AX + 268, AY + 49, AX + 250, AY + 40, WHITE);
line(AX + 330, AY + 49, AX + 348, AY + 40, WHITE);
// Rocket, centre-left of the art
const RX = AX + 92, RY = AY + 78;
tri(RX + 14, RY - 34, RX, RY + 6, RX + 28, RY + 6, RED);          // nose cone
rect(RX, RY + 6, 28, 96, WHITE);                                   // body
rect(RX + 8, RY + 6, 12, 96, [225, 232, 240]);                    // body shading
rect(RX - 10, RY + 62, 10, 40, RED);                              // left fin
rect(RX + 28, RY + 62, 10, 40, RED);                              // right fin
rect(RX + 4, RY + 102, 20, 10, [120, 120, 120]);                  // engine
tri(RX + 4, RY + 112, RX + 24, RY + 112, RX + 14, RY + 158, [255, 150, 40]); // flame
tri(RX + 8, RY + 112, RX + 20, RY + 112, RX + 14, RY + 142, [255, 220, 80]);
drawText(AX + 14, AY + AH - 22, "SHENZHOU-24 - TIANGONG", 2, WHITE);

// ---- 3x2 panel grid: the day's other stories (full-day 25 Nov research) ----
function panel(x: number, y: number, w: number, h: number, kicker: string, head: string[], body: string): void {
  rect(x, y, w, h, WHITE);
  rect(x, y, w, 2, INK); rect(x, y + h - 2, w, 2, INK);
  rect(x, y, 2, h, INK); rect(x + w - 2, y, 2, h, INK);
  drawText(x + 16, y + 12, kicker, 2, RED);
  let yy = y + 34;
  for (const ln of head) { drawText(x + 16, yy, ln, 3, INK); yy += 26; }
  hline(x + 16, yy + 2, 56, RED, 2);
  paragraph(x + 16, yy + 10, body, w - 32, 2, INK, 17);
}

// Row 1
panel(30, 500, 308, 164, "COLOMBIA", ["HOSTAGES FREED", "IN CARTAGENA"], "All hostages freed as forces stormed a Cartagena supermarket; one captor killed.");
panel(358, 500, 308, 164, "INDONESIA", ["MINERS TRAPPED", "100 M DEEP"], "Dozens trapped in a flooded West Java gold mine; 26-29 unaccounted for, 100 m deep.");
panel(686, 500, 308, 164, "BANGLADESH", ["WAGE UP 36%", "TO 17,000 TAKA"], "Garment wage up 36% to 17,000 taka after weeks of protests; workers asked 30,000.");
// Row 2
panel(30, 676, 308, 164, "UKRAINE", ["115BN NEEDED", "FOR 2027"], "Zelenskyy: Ukraine needs 115bn euros in 2027. Sea drones sank corvette Merkury.");
panel(358, 676, 308, 164, "HORMUZ", ["MINES CLAIM", "IN THE STRAIT"], "IRGC claims tankers hit mines in Hormuz Strait; Trump warns of a 'very traumatic' outcome.");
panel(686, 676, 308, 164, "TECH", ["HUAWEI GUILTY", "CIA BREACHED"], "Brooklyn jury convicts Huawei on sanctions charges; hackers breached a CIA system.");

// ---- Bottom strip: six more stories, two rows of three ----
hline(30, 856, 964, INK, 2);
const strip: [string, string][] = [
  ["NORTH KOREA", "Swiss office shut; head expelled in 48 hours."],
  ["UNITED KINGDOM", "MI5 warns Ukraine backers of Russian sabotage."],
  ["YEMEN / SAUDI", "Coalition hits Hodeidah; drone hits Riyadh."],
  ["GAZA", "Strikes kill 7, incl. a Hamas security chief."],
  ["CHINA", "Shanghai chief Chen Jining investigated."],
  ["PACIFIC", "Australia-Solomon Islands security treaty signed."],
];
for (let i = 0; i < 6; i++) {
  const sx = 30 + (i % 3) * 328;
  const sy = 866 + Math.floor(i / 3) * 62;
  drawText(sx, sy, strip[i][0], 2, RED);
  paragraph(sx, sy + 20, strip[i][1], 308, 2, INK, 17);
}
hline(30, 992, 964, INK, 2);
drawTextCenter(512, 1002, "WORLD NEWS IN ONE DAY - 25 NOVEMBER 2026", 2, GREY);

// ------------------------------------------------------------------- PNG ----
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0; // filter: none
  raw.set(img.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // colour type RGB
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

fs.mkdirSync("/output", { recursive: true });
fs.writeFileSync("/output/entry.png", png);
console.log("wrote /output/entry.png", png.length, "bytes");
