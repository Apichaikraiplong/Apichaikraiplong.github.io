import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeNeonSign, makeBuntingFlags } from './textures.js';

function mesh(geo, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ------------------------------------------------------------------ *
 *  รูปสี่เหลี่ยมมุมมนสำหรับเคาน์เตอร์: หลังตรง (ชิดผนัง), หน้าโค้งมน 2 มุม
 *  แล้ว extrude ขึ้นด้วย geo.rotateX(-Math.PI/2) — ค่านี้ผ่านการทดสอบจริงแล้วว่า
 *  shape.lineTo(x, -zFwd) จะกลายเป็นตำแหน่งโลกจริงที่ worldZ = +zFwd
 * ------------------------------------------------------------------ */
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

/** เคาน์เตอร์บาร์โค้งมน (แทนทรงกล่องเดิม) ต้นกำเนิดกรุ๊ป = จุดกึ่งกลางขอบหลัง (ชิดผนัง) */
function buildCounter(mats, { width = 5.4, depth = 1.3, radius = 0.65 } = {}) {
  const g = new THREE.Group();
  const baseH = 0.85;
  const topT = 0.07;

  const base = buildRoundedSlab(width, depth, radius, baseH, mats.counterBase);
  g.add(base);

  const top = buildRoundedSlab(width + 0.1, depth + 0.06, radius + 0.05, topT, mats.counterTop);
  top.position.y = baseH;
  g.add(top);

  g.userData.footprint = { width, depth, radius };
  return g;
}

/** ชั้นวางขวดหลังบาร์ (ขอบมนเล็กน้อยให้ดูนุ่มตาขึ้น) */
function buildShelfUnit(mats) {
  const g = new THREE.Group();
  const shelfW = 4.4;
  const shelfD = 0.24;
  const ys = [1.25, 1.95, 2.65];

  ys.forEach((y) => {
    g.add(mesh(new RoundedBoxGeometry(shelfW, 0.045, shelfD, 2, 0.012), mats.counterBase, 0, y, 0));

    const n = 9;
    for (let i = 0; i < n; i++) {
      const bx = -shelfW / 2 + 0.3 + (i * (shelfW - 0.6)) / (n - 1) + (Math.random() - 0.5) * 0.05;
      const glass = mats.glassColors[i % mats.glassColors.length];
      const bh = 0.22 + Math.random() * 0.08;
      const bottle = new THREE.Group();
      bottle.add(mesh(new THREE.CylinderGeometry(0.045, 0.055, bh, 10), glass, 0, bh / 2, 0));
      bottle.add(mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.07, 8), glass, 0, bh + 0.035, 0));
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

  const light = new THREE.PointLight(0xffcf94, 5, 4.5, 2);
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

/** พวงธงประดับที่โบกไหวได้จริงด้วย vertex shader (แขวนพาดหน้าเคาน์เตอร์) */
function buildBunting(width = 5.8) {
  const texture = makeBuntingFlags();
  const geo = new THREE.PlaneGeometry(width, 0.42, 48, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      map: { value: texture },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float u = uv.x;
        float sag = 0.22 * (1.0 - pow(2.0 * u - 1.0, 2.0));
        float sway = sin(uTime * 1.6 + u * 9.0) * 0.05;
        float breeze = cos(uTime * 1.1 + u * 5.0) * 0.035;
        pos.y += -sag + sway;
        pos.z += breeze;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      varying vec2 vUv;
      void main() {
        vec4 tex = texture2D(map, vUv);
        if (tex.a < 0.15) discard;
        gl_FragColor = tex;
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, material);
  m.castShadow = false;
  return m;
}

/** ป้ายไฟนีออนติดผนัง */
function buildNeonSign(text) {
  const tex = makeNeonSign(text);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  return new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.62), mat);
}

/** กรอบรูปเปล่า ไว้ใส่ texture รูปถ่ายตัวเองในภายหลัง */
function buildPhotoFrame(mats) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.62, 0.8, 0.04), mats.wood_dark, 0, 0, 0));
  const inner = mesh(new THREE.PlaneGeometry(0.5, 0.68), mats.frameInner, 0, 0, 0.022);
  g.add(inner);
  g.userData.photoMesh = inner;
  return g;
}

/**
 * ประกอบฉากบาร์ทั้งหมด คืนค่ากรุ๊ป + สิ่งที่ต้องอัปเดตทุกเฟรม/ใช้ทำ picking (refs)
 */
export function buildBarScene(mats, { wallHalf, wallH }) {
  const group = new THREE.Group();
  const refs = { pendantLights: [] };

  const counterWidth = 5.4;
  const counterDepth = 1.3;

  // เคาน์เตอร์โค้งมน วางชิดผนังเหนือ (north, z = -wallHalf)
  const counter = buildCounter(mats, { width: counterWidth, depth: counterDepth, radius: 0.65 });
  counter.position.set(0, 0, -wallHalf);
  group.add(counter);
  refs.counter = counter;

  const shelf = buildShelfUnit(mats);
  shelf.position.set(0, 0, -wallHalf + 0.14);
  group.add(shelf);
  refs.shelf = shelf;

  const neon = buildNeonSign('WELCOME');
  neon.position.set(0, 3.05, -wallHalf + 0.09);
  group.add(neon);
  refs.neonSign = neon;

  const barrel = buildBarrel(mats);
  barrel.position.set(3.4, 0, -3.3);
  group.add(barrel);
  refs.barrel = barrel;

  // เก้าอี้บาร์ 4 ตัวหน้าเคาน์เตอร์
  const frontZ = -wallHalf + counterDepth + 0.75; // ~0.75 ห่างจากขอบหน้าเคาน์เตอร์
  [-1.9, -0.65, 0.6, 1.85].forEach((x) => {
    const stool = buildStool(mats);
    stool.position.set(x, 0, frontZ);
    group.add(stool);
  });

  // โคมไฟห้อย 2 ดวงเหนือเคาน์เตอร์
  [-1.3, 1.3].forEach((x) => {
    const lamp = buildPendantLight(mats, wallH);
    lamp.position.set(x, 0, -wallHalf + counterDepth * 0.7);
    group.add(lamp);
    refs.pendantLights.push(lamp.userData.light);
  });

  // ต้นไม้มุมห้อง (ผนังตะวันตก)
  const plant = buildPlant(mats);
  plant.position.set(-wallHalf + 0.55, 0, wallHalf - 0.7);
  group.add(plant);

  // มาสคอตเป็ดบนเคาน์เตอร์ (จุด cel shading)
  const mascot = buildToonMascot(mats);
  mascot.position.set(1.3, 0.85 + 0.07, -wallHalf + counterDepth * 0.55);
  group.add(mascot);
  refs.mascot = mascot;

  // กรอบรูปเปล่าบนผนังตะวันตก ไว้ใส่รูปตัวเองทีหลัง
  const frame = buildPhotoFrame(mats);
  frame.position.set(-wallHalf + 0.06, 2.1, 1.6);
  frame.rotation.y = Math.PI / 2;
  group.add(frame);
  refs.photoFrame = frame;

  // พวงธงโบกไหวเหนือเคาน์เตอร์ (จุด vertex shader)
  const bunting = buildBunting(counterWidth + 0.4);
  bunting.position.set(0, 3.15, -wallHalf + counterDepth * 0.5);
  group.add(bunting);
  refs.bunting = bunting;

  return { group, refs };
}
