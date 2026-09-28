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

/** ป้ายต้อนรับของร้าน: ตัวอักษรตัวใหญ่ ย่อขนาดอัตโนมัติให้พอดีกรอบ (canvas 1280x300 = ระนาบ 2.0 x 0.469 ม.) */
export function makeWelcomeSign(text = '1990 BAR WELCOME') {
  const w = 1280;
  const h = 300;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#211713';
  ctx.fillRect(16, 16, w - 32, h - 32);
  ctx.strokeStyle = '#9a733d';
  ctx.lineWidth = 4;
  ctx.strokeRect(22, 22, w - 44, h - 44);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 150;
  ctx.font = `400 ${size}px Georgia, "Times New Roman", serif`;
  while (ctx.measureText(text).width > w - 140 && size > 40) {
    size -= 4;
    ctx.font = `400 ${size}px Georgia, "Times New Roman", serif`;
  }
  ctx.fillStyle = '#f4e7d4';
  ctx.fillText(text, w / 2, h / 2 + 4);

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

/** ตัดบรรทัดตามคำ (ภาษาอังกฤษ) ให้ไม่เกินความกว้างที่กำหนด */
function wrapWords(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? cur + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * ป้ายข้อมูลส่วนตัวตั้งโต๊ะ (ภาษาอังกฤษทั้งหมด)
 * จัดเลย์เอาต์อัตโนมัติ: ตัดบรรทัดตามคำ และย่อตัวอักษรลงจนเนื้อหาทั้งหมดอยู่ในกรอบ ไม่ล้น
 */
export function makeInfoCard(profile) {
  const w = 480;
  const h = 600;
  const PAD = 56;
  const maxW = w - PAD * 2;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#f2e6c9';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#5b3a22';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.strokeStyle = '#8a5a34';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  // ชื่อ: ย่อให้พอดีความกว้าง แล้วตัดบรรทัดถ้าจำเป็น
  let nameSize = 40;
  ctx.font = `bold ${nameSize}px Georgia, serif`;
  while (nameSize > 24 && ctx.measureText(profile.name).width > maxW) {
    nameSize -= 2;
    ctx.font = `bold ${nameSize}px Georgia, serif`;
  }
  const nameLines = wrapWords(ctx, profile.name, maxW);
  const nameLH = nameSize * 1.15;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#3a2418';
  nameLines.forEach((ln, i) => ctx.fillText(ln, w / 2, 96 + i * nameLH));
  const divY = 96 + (nameLines.length - 1) * nameLH + 28;
  ctx.strokeStyle = '#8a5a34';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, divY);
  ctx.lineTo(w - PAD, divY);
  ctx.stroke();

  const rows = [
    ['STUDENT ID', profile.studentId],
    ['MAJOR', profile.major],
    ['FACULTY', profile.faculty],
    ['UNIVERSITY', profile.university],
  ];
  const top = divY + 34;
  const bottom = h - 78; // เว้นด้านล่างไว้ให้ฐานตั้งโต๊ะบังได้

  const layout = (s) => {
    const labelPx = 19 * s;
    const valuePx = 26 * s;
    const lineH = valuePx * 1.22;
    const gap = 26 * s;
    ctx.font = `bold ${valuePx}px Georgia, serif`;
    const items = rows.map(([label, value]) => ({ label, lines: wrapWords(ctx, value, maxW) }));
    const total = items.reduce((sum, it) => sum + labelPx * 1.4 + it.lines.length * lineH + gap, 0) - gap;
    return { labelPx, valuePx, lineH, gap, items, total };
  };
  let s = 1;
  let L = layout(s);
  while (L.total > bottom - top && s > 0.5) {
    s -= 0.05;
    L = layout(s);
  }

  ctx.textAlign = 'left';
  let y = top;
  for (const it of L.items) {
    ctx.font = `${L.labelPx}px Georgia, serif`;
    ctx.fillStyle = '#8a5a34';
    ctx.fillText(it.label, PAD, y + L.labelPx * 0.9);
    ctx.font = `bold ${L.valuePx}px Georgia, serif`;
    ctx.fillStyle = '#3a2418';
    it.lines.forEach((ln, i) => ctx.fillText(ln, PAD, y + L.labelPx * 1.4 + L.valuePx * 0.95 + i * L.lineH));
    y += L.labelPx * 1.4 + it.lines.length * L.lineH + L.gap;
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** ป้ายทักษะแบบรายการหัวข้อ (bullet list) สไตล์เดียวกับป้ายข้อมูลส่วนตัว */
export function makeSkillBoard(title, skills) {
  const w = 480;
  const h = 600;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#f2e6c9';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#5b3a22';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.strokeStyle = '#8a5a34';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#3a2418';
  ctx.font = 'bold 44px Georgia, "Noto Serif Thai", serif';
  ctx.fillText(title, w / 2, 92);
  ctx.strokeStyle = '#8a5a34';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(80, 118);
  ctx.lineTo(w - 80, 118);
  ctx.stroke();

  ctx.textAlign = 'left';
  const dotColors = ['#b23a3a', '#3f6b4f', '#3f5a6b', '#c8a055', '#6b3f6b', '#a05a2c'];
  const startY = 195;
  const rowH = Math.min(82, (h - startY - 40) / Math.max(skills.length, 1));
  skills.forEach((s, i) => {
    const y = startY + i * rowH;
    ctx.fillStyle = dotColors[i % dotColors.length];
    ctx.beginPath();
    ctx.arc(58, y - 11, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2418';
    ctx.font = 'bold 32px Georgia, "Noto Sans Thai", sans-serif';
    ctx.fillText(s, 88, y);
  });

  const tex2 = new THREE.CanvasTexture(c);
  tex2.colorSpace = THREE.SRGBColorSpace;
  return tex2;
}
