import * as THREE from 'three';

function addGrain(ctx, size, strength) {
  for (let k = 0; k < 50; k++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const rad = 60 + Math.random() * 160;
    const c = Math.random() < 0.5 ? '0,0,0' : '255,255,255';
    const grad = ctx.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, `rgba(${c},${strength})`);
    grad.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

/** ผนัง/เคาน์เตอร์ไม้: มีลายไม้แนวนอนและรอยต่อแผ่นไม้แนวตั้ง */
export function makeWoodPanel({ r, g, b }, maxAniso = 8, planks = 6) {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);

  // ลายไม้แนวนอน
  for (let i = 0; i < 90; i++) {
    const y = Math.random() * size;
    ctx.strokeStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.08})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + (Math.random() - 0.5) * 10, size * 0.6, y + (Math.random() - 0.5) * 10, size, y + (Math.random() - 0.5) * 6);
    ctx.stroke();
  }

  // รอยต่อแผ่นไม้แนวตั้ง
  const pw = size / planks;
  for (let i = 1; i < planks; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(i * pw - 1.5, 0, 3, size);
  }

  addGrain(ctx, size, 0.03);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}

/** พื้นลายตาราง (แดงเข้ม/ครีม) แบบร้านอาหารคลาสสิก */
export function makeCheckerFloor(tiles = 10, maxAniso = 8, colorA = '#efe3cf', colorB = '#7c2233') {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const t = size / tiles;
  for (let y = 0; y < tiles; y++) {
    for (let x = 0; x < tiles; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? colorA : colorB;
      ctx.fillRect(x * t, y * t, t, t);
    }
  }
  addGrain(ctx, size, 0.025);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

/** ป้ายไฟนีออนแบบตัวหนังสือเรืองแสง สำหรับ MeshBasicMaterial (unlit) */
export function makeNeonSign(text = 'WELCOME', glow = '#ff3f6e') {
  const w = 640;
  const h = 260;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  // กล่องพื้นหลังเข้ม ขอบมน
  ctx.fillStyle = 'rgba(15,10,20,0.92)';
  const r = 28;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(w, 0, w, h, r);
  ctx.arcTo(w, h, 0, h, r);
  ctx.arcTo(0, h, 0, 0, r);
  ctx.arcTo(0, 0, w, 0, r);
  ctx.closePath();
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 118px Georgia, "Times New Roman", serif';

  // วาดซ้ำหลายชั้นเพื่อให้ดูเรืองแสง (glow) รอบตัวอักษร
  ctx.shadowColor = glow;
  for (const blur of [40, 26, 14]) {
    ctx.shadowBlur = blur;
    ctx.fillStyle = glow;
    ctx.fillText(text, w / 2, h / 2 + 6);
  }
  ctx.shadowBlur = 4;
  ctx.fillStyle = '#fff6f0';
  ctx.fillText(text, w / 2, h / 2 + 6);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** พวงธงสามเหลี่ยมหลากสี ใช้เป็น texture ของริบบิ้นที่ขยับด้วย vertex shader */
export function makeBuntingFlags(colors = ['#d1495b', '#edae49', '#2e8b7a', '#3f6fa0', '#f2cd60'], count = 16) {
  const w = 1024;
  const h = 220;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const fw = w / count;
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[i % colors.length];
    const x0 = i * fw + fw * 0.06;
    const flagW = fw * 0.88;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0 + flagW, 0);
    ctx.lineTo(x0 + flagW / 2, h * 0.82);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** เกรเดียนต์ 3 ระดับ สำหรับ MeshToonMaterial (ทำให้แสงตกเป็นขั้นบันไดแบบ cel shading) */
export function makeToonGradient(steps = 3) {
  const c = document.createElement('canvas');
  c.width = steps;
  c.height = 1;
  const ctx = c.getContext('2d');
  for (let i = 0; i < steps; i++) {
    const v = Math.round((i / (steps - 1)) * 255);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(i, 0, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}
