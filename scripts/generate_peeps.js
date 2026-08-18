const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const width = 1050;
const height = 700;
const rows = 15;
const cols = 7;

const rowW = Math.floor(width / rows);
const colH = Math.floor(height / cols);

const rawData = Buffer.alloc((width * 4 + 1) * height);

for (let y = 0; y < height; y++) {
  const scanlineOffset = y * (width * 4 + 1);
  rawData[scanlineOffset] = 0; // Filter byte: None
  
  const colIdx = Math.floor(y / colH);
  const localY = y % colH;
  
  for (let x = 0; x < width; x++) {
    const rowIdx = Math.floor(x / rowW);
    const localX = x % rowW;
    const pxOffset = scanlineOffset + 1 + x * 4;
    
    const cx = rowW / 2;
    
    // Silhouette Head
    const headRadius = rowW * 0.16;
    const headY = colH * 0.28;
    const distHead = Math.hypot(localX - cx, localY - headY);
    
    // Body & arms
    const inBody = localX >= cx - rowW * 0.22 && localX <= cx + rowW * 0.22 && localY >= colH * 0.44 && localY <= colH * 0.85;
    // Legs
    const inLegs = ((localX >= cx - rowW * 0.18 && localX <= cx - rowW * 0.04) || (localX >= cx + rowW * 0.04 && localX <= cx + rowW * 0.18)) && localY >= colH * 0.75 && localY <= colH * 0.98;
    
    const isPeep = distHead <= headRadius || inBody || inLegs;
    
    if (isPeep) {
      const shade = (rowIdx + colIdx) % 2 === 0 ? 230 : 180;
      rawData[pxOffset] = shade;     // R
      rawData[pxOffset + 1] = shade; // G
      rawData[pxOffset + 2] = shade; // B
      rawData[pxOffset + 3] = 255;   // A
    } else {
      rawData[pxOffset] = 0;
      rawData[pxOffset + 1] = 0;
      rawData[pxOffset + 2] = 0;
      rawData[pxOffset + 3] = 0;
    }
  }
}

// PNG Header
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  
  let crc = 0 ^ (-1);
  for (let i = 4; i < 8 + len; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ chunk[i]) & 0xff];
  }
  crc = (crc ^ (-1)) >>> 0;
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

const ihdrData = Buffer.alloc(13);
ihdrData.writeUInt32BE(width, 0);
ihdrData.writeUInt32BE(height, 4);
ihdrData[8] = 8;
ihdrData[9] = 6;
ihdrData[10] = 0;
ihdrData[11] = 0;
ihdrData[12] = 0;
const ihdr = makeChunk('IHDR', ihdrData);

const compressed = zlib.deflateSync(rawData);
const idat = makeChunk('IDAT', compressed);
const iend = makeChunk('IEND', Buffer.alloc(0));

const png = Buffer.concat([signature, ihdr, idat, iend]);

const targetDir = path.join(__dirname, '..', 'public', 'images', 'peeps');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

fs.writeFileSync(path.join(targetDir, 'all-peeps.png'), png);
console.log('Successfully wrote', path.join(targetDir, 'all-peeps.png'), png.length, 'bytes');
