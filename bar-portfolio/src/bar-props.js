import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeWelcomeSign, makeInfoCard, makeSkillBoard } from './textures.js';
import { PROFILE, SKILLS, WELCOME_TEXT } from './profile.js';


function mesh(geo, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ================================================================== *
 *  1) เคาน์เตอร์บาร์ทรงโค้งมน
 * ================================================================== */

/* รูปสี่เหลี่ยมมุมมน: หลังตรง (ชิดผนัง), หน้าโค้งมน 2 มุม แล้ว extrude ขึ้นด้วย
 * geo.rotateX(-Math.PI/2) — ค่านี้ผ่านการทดสอบจริงแล้วว่า shape.lineTo(x, -zFwd)
 * จะกลายเป็นตำแหน่งโลกจริงที่ worldZ = +zFwd (ดูรายละเอียดในข้อความที่ตอบผู้ใช้) */
function roundedFrontShape(width, depthFwd, radius) {
  const halfW = width / 2;
  const r = Math.min(radius, depthFwd, halfW);
  const s = new THREE.Shape();
  s.moveTo(-halfW, 0);
  s.lineTo(halfW, 0);
  s.lineTo(halfW, -(depthFwd - r));
  s.quadraticCurveTo(halfW, -depthFwd, halfW - r, -depthFwd);
  s.lineTo(-halfW + r, -depthFwd);
  s.quadraticCurveTo(-halfW, -depthFwd, -halfW, -(depthFwd - r));
  s.lineTo(-halfW, 0);
  return s;
}

function buildRoundedSlab(width, depthFwd, radius, height, mat) {
  const shape = roundedFrontShape(width, depthFwd, radius);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 14 });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** เคาน์เตอร์บาร์โค้งมน ต้นกำเนิดกรุ๊ป = จุดกึ่งกลางขอบหลัง (ชิดผนัง) */
function buildCounter(mats, { width = 5.4, depth = 1.3, radius = 0.65 } = {}) {
  const g = new THREE.Group();
  const baseH = 0.85;
  const topT = 0.07;

  const base = buildRoundedSlab(width, depth, radius, baseH, mats.counterBase);
  g.add(base);

  const top = buildRoundedSlab(width + 0.1, depth + 0.06, radius + 0.05, topT, mats.counterTop);
  top.position.y = baseH;
  g.add(top);

  // ราวพักเท้าทองเหลืองด้านหน้า เพิ่ม silhouette แบบบาร์คลาสสิก
  const rail = mesh(new THREE.CylinderGeometry(0.028, 0.028, width - 0.45, 14), mats.brass, 0, 0.16, depth + 0.28);
  rail.rotation.z = Math.PI / 2;
  g.add(rail);

  [-1, 1].forEach((side) => {
    const post = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 10), mats.brass, side * (width / 2 - 0.18), 0.17, depth + 0.28);
    g.add(post);
  });

  g.userData.footprint = { width, depth, radius };
  return g;
}

/** ชั้นวางขวดหลังบาร์ (ขอบมนเล็กน้อยให้ดูนุ่มตาขึ้น) */
function buildShelfUnit(mats) {
  const g = new THREE.Group();
  const shelfW = 4.4;
  const shelfD = 0.24;
  const ys = [1.25, 1.95, 2.65];

  // แผ่นกระจกมืดด้านหลัง ทำหน้าที่เหมือน back-bar mirror โดยไม่ต้องใช้ real-time reflection
  const mirrorMat = new THREE.MeshStandardMaterial({
    color: 0x16151a,
    metalness: 0.88,
    roughness: 0.1,
    emissive: 0x2b1820,
    emissiveIntensity: 0.18
  });
  g.add(mesh(new THREE.BoxGeometry(shelfW + 0.16, 2.25, 0.045), mirrorMat, 0, 1.95, -0.025));

  ys.forEach((y) => {
    g.add(mesh(new RoundedBoxGeometry(shelfW, 0.045, shelfD, 2, 0.012), mats.counterBase, 0, y, 0));
    const glow = new THREE.PointLight(0xff9b63, 1.35, 3.2, 2);
    glow.position.set(0, y - 0.08, 0.08);
    g.add(glow);

    const n = 9;
    for (let i = 0; i < n; i++) {
      const bx = -shelfW / 2 + 0.3 + (i * (shelfW - 0.6)) / (n - 1) + (Math.random() - 0.5) * 0.05;
      const glass = mats.glassColors[i % mats.glassColors.length];
      const bh = 0.22 + Math.random() * 0.08;
      const bottle = new THREE.Group();
      bottle.add(mesh(new THREE.CylinderGeometry(0.045, 0.055, bh, 10), glass, 0, bh / 2, 0));
      bottle.add(mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.07, 8), glass, 0, bh + 0.035, 0));
      bottle.add(mesh(new THREE.TorusGeometry(0.032, 0.006, 5, 12), mats.brass, 0, bh + 0.003, 0));
      bottle.position.set(bx, y + 0.023, 0);
      g.add(bottle);
    }
  });

  return g;
}

/** ถังไม้เก่าประดับข้างเคาน์เตอร์ พร้อมห่วงโลหะ */
function buildBarrel(mats) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.85, 16), mats.barrel, 0, 0.425, 0));
  [0.18, 0.62].forEach((y) => {
    const hoop = mesh(new THREE.TorusGeometry(0.44, 0.02, 6, 20), mats.metal, 0, y, 0);
    hoop.rotation.x = Math.PI / 2;
    g.add(hoop);
  });
  return g;
}

/** เก้าอี้บาร์ทรงกลม ขาเหล็ก */
function buildStool(mats) {
  const g = new THREE.Group();
  const seatY = 0.62;
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.07, 16), mats.fabric, 0, seatY, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, seatY - 0.07, 8), mats.metal, 0, (seatY - 0.07) / 2, 0));
  const foot = mesh(new THREE.TorusGeometry(0.16, 0.015, 6, 16), mats.metal, 0, 0.22, 0);
  foot.rotation.x = Math.PI / 2;
  g.add(foot);
  return g;
}

/** โคมไฟห้อยเพดานสไตล์บาร์ พร้อมหลอดไฟจริง */
function buildPendantLight(mats, ceilingY) {
  const g = new THREE.Group();
  const dropY = 1.15;
  const cord = mesh(new THREE.CylinderGeometry(0.012, 0.012, dropY, 6), mats.wood_dark, 0, ceilingY - dropY / 2, 0);
  const shadeY = ceilingY - dropY;
  const shade = mesh(new THREE.ConeGeometry(0.22, 0.16, 16, 1, true), mats.brass, 0, shadeY, 0);
  shade.rotation.x = Math.PI;
  const bulb = mesh(new THREE.SphereGeometry(0.06, 10, 8), mats.bulb, 0, shadeY - 0.07, 0);
  bulb.castShadow = false;

  const light = new THREE.PointLight(0xffb566, 6.5, 4.8, 2);
  light.position.set(0, shadeY - 0.08, 0);

  g.add(cord, shade, bulb, light);
  g.userData.light = light;
  return g;
}

/** ต้นไม้กระถางมุมห้อง */
function buildPlant(mats) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.4, 12), mats.pot, 0, 0.2, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.55, 6), mats.wood_dark, 0, 0.6, 0));
  const clusters = [
    [0, 1.0, 0, 0.32],
    [0.16, 0.85, 0.1, 0.22],
    [-0.18, 0.8, -0.08, 0.24],
    [0.05, 1.25, -0.12, 0.2],
  ];
  clusters.forEach(([x, y, z, r]) => {
    g.add(mesh(new THREE.SphereGeometry(r, 10, 8), mats.leaf, x, y, z));
  });
  return g;
}

/* ================================================================== *
 *  2) โต๊ะสนุกเกอร์ (มุมสันทนาการของห้อง)
 * ================================================================== */

/** โต๊ะสนุกเกอร์ขนาดย่อ: ขา + เฟรม + ผ้าสักหลาด + ราง 4 ด้าน + หลุม 6 หลุม + ลูกบอล */
function buildPoolTable(mats) {
  const g = new THREE.Group();
  const tableW = 1.9; // ตามแนว x
  const tableD = 1.0; // ตามแนว z
  const legH = 0.75;
  const frameH = 0.08;
  const feltT = 0.02;
  const railT = 0.09;

  const legGeo = new THREE.CylinderGeometry(0.05, 0.06, legH, 10);
  const legOffX = tableW / 2 - 0.12;
  const legOffZ = tableD / 2 - 0.12;
  [
    [-legOffX, -legOffZ],
    [legOffX, -legOffZ],
    [-legOffX, legOffZ],
    [legOffX, legOffZ],
  ].forEach(([x, z]) => g.add(mesh(legGeo, mats.wood_dark, x, legH / 2, z)));

  g.add(mesh(new RoundedBoxGeometry(tableW, frameH, tableD, 2, 0.012), mats.counterBase, 0, legH + frameH / 2, 0));

  const feltY = legH + frameH + feltT / 2;
  g.add(mesh(new THREE.BoxGeometry(tableW - 0.1, feltT, tableD - 0.1), mats.felt, 0, feltY, 0));

  const railY = feltY + 0.045;
  g.add(mesh(new THREE.BoxGeometry(tableW, 0.08, railT), mats.wood_dark, 0, railY, tableD / 2 - railT / 2));
  g.add(mesh(new THREE.BoxGeometry(tableW, 0.08, railT), mats.wood_dark, 0, railY, -(tableD / 2 - railT / 2)));
  g.add(mesh(new THREE.BoxGeometry(railT, 0.08, tableD), mats.wood_dark, tableW / 2 - railT / 2, railY, 0));
  g.add(mesh(new THREE.BoxGeometry(railT, 0.08, tableD), mats.wood_dark, -(tableW / 2 - railT / 2), railY, 0));

  const pocketGeo = new THREE.SphereGeometry(0.065, 10, 8);
  [
    [-tableW / 2, -tableD / 2],
    [tableW / 2, -tableD / 2],
    [-tableW / 2, tableD / 2],
    [tableW / 2, tableD / 2],
    [0, -tableD / 2],
    [0, tableD / 2],
  ].forEach(([x, z]) => g.add(mesh(pocketGeo, mats.wood_dark, x, feltY + 0.015, z)));

  const ballGeo = new THREE.SphereGeometry(0.045, 12, 10);
  const ballColors = [0xf2ede0, 0xd8b23a, 0x2f5aa8, 0xb23a3a, 0x2a1b12, 0x2f8a4f, 0x8a3a8a, 0xd86b2f];
  ballColors.forEach((color, i) => {
    const bm = new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.05 });
    const angle = (i / ballColors.length) * Math.PI * 2;
    const rad = 0.06 + (i % 3) * 0.09;
    const bx = Math.cos(angle) * rad * (tableW / tableD);
    const bz = Math.sin(angle) * rad;
    g.add(mesh(ballGeo, bm, bx, feltY + 0.065, bz));
  });

  return g;
}

/* ================================================================== *
 *  3) ป้าย/มาสคอต (ของตกแต่งที่สื่อความหมาย)
 * ================================================================== */

/** มาสคอตเป็ดตัวเล็กบนเคาน์เตอร์ ใช้ cel shading (MeshToonMaterial) */
function buildToonMascot(mats) {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.15, 16, 12), mats.toon, 0, 0.15, 0);
  body.scale.set(1, 0.85, 1.05);
  const head = mesh(new THREE.SphereGeometry(0.095, 16, 12), mats.toon, 0, 0.32, 0.03);
  const beak = mesh(new THREE.ConeGeometry(0.045, 0.09, 10), mats.toonAccent, 0, 0.305, 0.13);
  beak.rotation.x = Math.PI / 2;
  const eyeGeo = new THREE.SphereGeometry(0.015, 8, 6);
  const eyeL = mesh(eyeGeo, mats.eye, -0.045, 0.345, 0.085);
  const eyeR = mesh(eyeGeo, mats.eye, 0.045, 0.345, 0.085);
  g.add(body, head, beak, eyeL, eyeR);
  return g;
}

/* ================================================================== *
 *  4) เนื้อหาส่วนตัว (ดึงข้อมูลจาก profile.js — แก้ที่ไฟล์เดียวพอ)
 * ================================================================== */

/** กรอบรูปติดผนัง โหลด texture รูปถ่ายจริงจาก PROFILE.photo (ถ้ายังไม่มีไฟล์ จะเป็นกรอบว่างสีพื้นไปก่อน ไม่พัง) */
function buildPhotoFrame(mats, photoPath) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.62, 0.8, 0.04), mats.wood_dark, 0, 0, 0));
  const inner = mesh(new THREE.PlaneGeometry(0.5, 0.68), mats.frameInner, 0, 0, 0.022);
  g.add(inner);
  g.userData.photoMesh = inner;

  new THREE.TextureLoader().load(
    photoPath,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      inner.material.map = tex;
      inner.material.needsUpdate = true;
    },
    undefined,
    () => console.warn(`ยังไม่พบไฟล์รูปที่ ${photoPath} — วางรูปตัวเองไว้ตรงนั้นแล้วรีเฟรชหน้าเว็บ`)
  );

  return g;
}

/** ป้ายข้อมูลส่วนตัวแบบตั้งโต๊ะ (ดึงข้อความจาก PROFILE ใน profile.js) */
function buildInfoStandee(mats) {
  const g = new THREE.Group();
  const w = 0.55;
  const h = 0.68;
  const tex = makeInfoCard(PROFILE);
  const panelMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });

  g.add(mesh(new THREE.BoxGeometry(w + 0.04, h + 0.04, 0.02), mats.wood_dark, 0, h / 2, 0));
  const panel = mesh(new THREE.PlaneGeometry(w, h), panelMat, 0, h / 2, 0.012);
  g.add(panel);
  g.add(mesh(new THREE.BoxGeometry(w * 0.5, 0.03, 0.14), mats.wood_dark, 0, 0.015, 0.07));

  g.userData.panelMesh = panel;
  return g;
}

/** ป้าย Skill ติดผนัง (ดึงรายการจาก SKILLS ใน profile.js) */
function buildSkillBoard(mats) {
  const g = new THREE.Group();
  const w = 0.6;
  const h = 0.75;
  const tex = makeSkillBoard('SKILLS', SKILLS);
  const panelMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });

  g.add(mesh(new THREE.BoxGeometry(w + 0.05, h + 0.05, 0.04), mats.wood_dark, 0, 0, 0));
  const panel = mesh(new THREE.PlaneGeometry(w, h), panelMat, 0, 0, 0.023);
  g.add(panel);

  g.userData.panelMesh = panel;
  return g;
}

/* ================================================================== *
 *  5) ประกอบฉากทั้งหมด
 * ================================================================== */

/**
 * ประกอบฉากบาร์ทั้งหมด คืนค่ากรุ๊ป + สิ่งที่ต้องอัปเดตทุกเฟรม/ใช้ทำ picking (refs)
 */
export function buildBarScene(mats, { wallHalf, wallH }) {
  const group = new THREE.Group();
  const refs = { pendantLights: [], accentLights: [] };

  const counterWidth = 5.4;
  const counterDepth = 1.3;

  /* ---------- แนวบาร์ ชิดผนังเหนือ (north, z = -wallHalf) ---------- */
  const counter = buildCounter(mats, { width: counterWidth, depth: counterDepth, radius: 0.65 });
  counter.position.set(0, 0, -wallHalf);
  group.add(counter);
  refs.counter = counter;

  // แก้วสองใบหน้าเคาน์เตอร์ เพิ่มจุดสะท้อนแสงเล็ก ๆ
  [-0.55, 0.2].forEach((x, i) => {
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: i === 0 ? 0x8b5a43 : 0x6b7f9a,
      transmission: 0.72,
      transparent: true,
      opacity: 0.72,
      roughness: 0.08,
      metalness: 0.0,
      thickness: 0.04
    });
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.22, 16, 1, true), glassMat);
    glass.position.set(x, 1.01, -wallHalf + 0.52);
    glass.castShadow = false;
    group.add(glass);
    const stem = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.14, 8), mats.metal, x, 0.94, -wallHalf + 0.52);
    group.add(stem);
  });

  const shelf = buildShelfUnit(mats);
  shelf.position.set(0, 0, -wallHalf + 0.14);
  group.add(shelf);
  refs.shelf = shelf;

  // ป้าย 1990 BAR WELCOME อยู่กำแพงเดียวกับป้าย Skills แต่ไม่ใช่ป้ายที่กดได้
  const welcome = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 0.469),
    new THREE.MeshStandardMaterial({ map: makeWelcomeSign(WELCOME_TEXT), roughness: 0.72, metalness: 0.02 })
  );
  welcome.position.set(wallHalf - 0.06, 2.12, 0.1); // ขยับไปทางซ้าย (เดิม z = 0.55)
  welcome.rotation.y = -Math.PI / 2;
  welcome.castShadow = false;
  welcome.receiveShadow = false;
  group.add(welcome);
  refs.welcome = welcome;

  const barrel = buildBarrel(mats);
  barrel.position.set(3.4, 0, -3.3);
  group.add(barrel);
  refs.barrel = barrel;

  const frontZ = -wallHalf + counterDepth + 0.75; // เก้าอี้ห่างจากขอบหน้าเคาน์เตอร์ ~0.75
  [-1.9, -0.65, 0.6, 1.85].forEach((x) => {
    const stool = buildStool(mats);
    stool.position.set(x, 0, frontZ);
    group.add(stool);
  });

  [-1.3, 1.3].forEach((x) => {
    const lamp = buildPendantLight(mats, wallH);
    lamp.position.set(x, 0, -wallHalf + counterDepth * 0.7);
    group.add(lamp);
    refs.pendantLights.push(lamp.userData.light);
  });

  const infoStandee = buildInfoStandee(mats);
  infoStandee.position.set(-1.6, 0.85 + 0.07, -wallHalf + counterDepth * 0.55);
  group.add(infoStandee);
  refs.infoStandee = infoStandee;

  /* ---------- มุมสันทนาการ: โต๊ะสนุกเกอร์ (พื้นที่โล่งกลางห้อง) ---------- */
  const poolTable = buildPoolTable(mats);
  poolTable.position.set(1.3, 0, 1.9);
  group.add(poolTable);
  refs.poolTable = poolTable;

  /* ---------- ผนังตะวันตก: ต้นไม้ + กรอบรูป ---------- */
  const plant = buildPlant(mats);
  plant.position.set(-wallHalf + 0.55, 0, wallHalf - 0.7);
  group.add(plant);

  const frame = buildPhotoFrame(mats, PROFILE.photo);
  frame.position.set(-wallHalf + 0.06, 2.1, 1.6);
  frame.rotation.y = Math.PI / 2;
  group.add(frame);
  refs.photoFrame = frame;

  /* ---------- ผนังตะวันออก: ป้าย Skill (ใกล้มุมโต๊ะสนุกเกอร์) ---------- */
  const skillBoard = buildSkillBoard(mats);
  skillBoard.position.set(wallHalf - 0.06, 2.0, 1.9);
  skillBoard.rotation.y = -Math.PI / 2;
  group.add(skillBoard);
  refs.skillBoard = skillBoard;

  return { group, refs };
}
