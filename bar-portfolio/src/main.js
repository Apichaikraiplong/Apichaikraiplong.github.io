import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { makeWoodPanel, makeCheckerFloor, makeToonGradient } from './textures.js';
import { buildBarScene } from './bar-props.js'; // ฉากสำรองแบบโค้ดล้วน (ใช้เมื่อโหลด bar.glb ไม่ได้)
import { loadBarModel } from './bar-model.js'; // ฉากหลัก: โมเดลที่ปั้นใน Blender
import { setupPicking } from './interactions.js';

const BAR_MODEL_URL = './assets/bar.glb';

/* ------------------------------------------------------------------ *
 *  ขนาดฉาก (1 หน่วย = 1 เมตร) พื้นห้อง 8x8 อยู่ในขอบเขต 10x10 ตามโจทย์
 * ------------------------------------------------------------------ */
const SIZE = 8;
const HALF = SIZE / 2;
const WALL_H = 3.6;
const WALL_T = 0.15;

/* ------------------------------- renderer ------------------------------ */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);
const maxAniso = renderer.capabilities.getMaxAnisotropy();

/* -------------------------------- scene --------------------------------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d090b);
scene.fog = new THREE.FogExp2(0x170e11, 0.028);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.25;

const room = new THREE.Group();
scene.add(room);

/* ------------------------------- materials ------------------------------ */
const wallTex = makeWoodPanel({ r: 96, g: 63, b: 40 }, maxAniso, 7);
wallTex.repeat.set(2.4, 1.1);
const counterTex = makeWoodPanel({ r: 138, g: 96, b: 58 }, maxAniso, 5);
counterTex.repeat.set(1.6, 1);
const floorTex = makeCheckerFloor(10, maxAniso, '#eadfcf', '#4a1822');

const mats = {
  wall: new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.82, metalness: 0.02 }),
  floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.42, metalness: 0.06 }),
  counterBase: new THREE.MeshStandardMaterial({ map: counterTex, roughness: 0.58, metalness: 0.02 }),
  counterTop: new THREE.MeshStandardMaterial({ color: 0x24150f, roughness: 0.23, metalness: 0.08 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x6f6963, roughness: 0.24, metalness: 0.95 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb98a3b, roughness: 0.22, metalness: 0.92 }),
  fabric: new THREE.MeshStandardMaterial({ color: 0xb23a3a, roughness: 0.9 }),
  wood_dark: new THREE.MeshStandardMaterial({ color: 0x2a1b12, roughness: 0.65 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x3d7a45, roughness: 0.8 }),
  pot: new THREE.MeshStandardMaterial({ color: 0xb5651d, roughness: 0.85 }),
  barrel: new THREE.MeshStandardMaterial({ map: makeWoodPanel({ r: 120, g: 82, b: 42 }, maxAniso, 10), roughness: 0.75 }),
  felt: new THREE.MeshStandardMaterial({ color: 0x173b25, roughness: 0.98 }),
  bulb: new THREE.MeshStandardMaterial({ color: 0xfff4cf, emissive: 0xffb56e, emissiveIntensity: 4.2, roughness: 0.2 }),
  eye: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }),
  frameInner: new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.9 }),
  glassColors: [0x3f6b4f, 0x6b3f3f, 0x3f5a6b, 0x5a4a6b].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.78 })
  ),
  toon: new THREE.MeshToonMaterial({ color: 0xffd34d, gradientMap: makeToonGradient(3) }),
  toonAccent: new THREE.MeshToonMaterial({ color: 0xff8a3d, gradientMap: makeToonGradient(3) }),
};

/* ------------- ผนัง 4 ด้าน (ใช้เทคนิคเฟดผนัง) — ผนังจริงมาจาก Blender หรือจากฉากสำรอง ------------- */
const walls = [];

/** ฉากสำรอง: สร้างห้อง+ของทั้งหมดด้วยโค้ด (ทำงานเมื่อ assets/bar.glb โหลดไม่สำเร็จ) */
function buildProceduralWorld() {
  wallTex.repeat.set(2.4, 1.1);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);

  function makeWall(w, h, d, x, y, z, normal) {
    const material = mats.wall.clone();
    material.transparent = true;
    material.depthWrite = false;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    room.add(m);
    walls.push({ mesh: m, normal: normal.clone().normalize() });
  }
  makeWall(SIZE, WALL_H, WALL_T, 0, WALL_H / 2, -HALF - WALL_T / 2, new THREE.Vector3(0, 0, -1));
  makeWall(SIZE, WALL_H, WALL_T, 0, WALL_H / 2, HALF + WALL_T / 2, new THREE.Vector3(0, 0, 1));
  makeWall(WALL_T, WALL_H, SIZE, HALF + WALL_T / 2, WALL_H / 2, 0, new THREE.Vector3(1, 0, 0));
  makeWall(WALL_T, WALL_H, SIZE, -HALF - WALL_T / 2, WALL_H / 2, 0, new THREE.Vector3(-1, 0, 0));

  [-HALF - WALL_T / 2, HALF + WALL_T / 2].forEach((z) => {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(SIZE, 0.16, 0.04), mats.wood_dark);
    skirt.position.set(0, 0.08, z + (z < 0 ? 0.02 : -0.02));
    room.add(skirt);
  });

  const { group, refs: r } = buildBarScene(mats, { wallHalf: HALF, wallH: WALL_H });
  room.add(group);
  return r;
}

let refs;
try {
  const world = await loadBarModel(BAR_MODEL_URL, mats, { wallHalf: HALF, wallH: WALL_H });
  room.add(world.group);
  walls.push(...world.walls);
  refs = world.refs;
  console.log('โหลดโมเดลจาก Blender สำเร็จ:', BAR_MODEL_URL);
} catch (err) {
  console.warn('โหลด assets/bar.glb ไม่ได้ — ใช้ฉากสำรองแบบโค้ดแทน', err);
  refs = buildProceduralWorld();
}

/* ---------------------------------- lights --------------------------------- */
const hemi = new THREE.HemisphereLight(0x6e4c3d, 0x0a0507, 0.34);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffd5a3, 1.35);
key.position.set(5.5, 7.5, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -6;
key.shadow.camera.right = 6;
key.shadow.camera.top = 6;
key.shadow.camera.bottom = -6;
key.shadow.camera.near = 1;
key.shadow.camera.far = 20;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.03;
scene.add(key);

const rim = new THREE.SpotLight(0x9f7cff, 18, 16, Math.PI * 0.18, 0.55, 1.5);
rim.position.set(-4.2, 3.7, 2.7);
rim.target.position.set(0, 1.2, 0);
rim.castShadow = false;
scene.add(rim, rim.target);

const warmFill = new THREE.PointLight(0xff9360, 7, 8, 2);
warmFill.position.set(2.8, 1.9, -1.4);
scene.add(warmFill);

const coolFill = new THREE.PointLight(0x8f7fff, 2.2, 10, 2);
coolFill.position.set(-3.0, 2.4, 3.2);
scene.add(coolFill);

/* -------------------------------- atmosphere -------------------------------- */
const dustCount = 420;
const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(dustCount * 3);
for (let i = 0; i < dustCount; i++) {
  const i3 = i * 3;
  dustPos[i3] = THREE.MathUtils.randFloatSpread(9.5);
  dustPos[i3 + 1] = Math.random() * 3.6 + 0.15;
  dustPos[i3 + 2] = THREE.MathUtils.randFloatSpread(9.5);
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(
  dustGeo,
  new THREE.PointsMaterial({ color: 0xffddba, size: 0.014, transparent: true, opacity: 0.12, depthWrite: false })
);
scene.add(dust);

/* ------------------------------------ camera -------------------------------- */
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(9, 6.8, 8.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.2, -0.4);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.enableZoom = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.28;
controls.minDistance = 4.5;
controls.maxDistance = 22;
controls.minPolarAngle = 0.15;
controls.maxPolarAngle = 1.5; // ไม่ให้มุดลงใต้พื้น
// ไม่จำกัดมุมซ้าย-ขวา -> หมุนได้ครบ 360 องศา
controls.update();

/* -------------------------------- post processing -------------------------------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.48, 0.62, 0.74);
composer.addPass(bloom);

const pointer = new THREE.Vector2();
const pointerTarget = new THREE.Vector2();
window.addEventListener('pointermove', (e) => {
  pointerTarget.x = (e.clientX / window.innerWidth - 0.5) * 2;
  pointerTarget.y = (e.clientY / window.innerHeight - 0.5) * 2;
});

const hint = document.getElementById('hint');
let resumeRotateTimer = null;
controls.addEventListener('start', () => {
  if (hint) hint.classList.add('gone');
  controls.autoRotate = false;
  clearTimeout(resumeRotateTimer);
});
controls.addEventListener('end', () => {
  clearTimeout(resumeRotateTimer);
  resumeRotateTimer = setTimeout(() => { if (!focusAnim) controls.autoRotate = true; }, 2600);
});

/* --------------------- คลิกป้าย/วัตถุแล้วกล้องเลื่อนไปโฟกัสให้อัตโนมัติ --------------------- */
let focusAnim = null;
function focusOn(object3D) {
  const targetPos = new THREE.Vector3();
  object3D.getWorldPosition(targetPos);

  // คงมุมมอง/ทิศทางเดิมของกล้อง แค่ย้ายจุดหมุน (target) มาที่วัตถุ แล้วปรับระยะให้พอดี
  const offset = camera.position.clone().sub(controls.target);
  const dist = THREE.MathUtils.clamp(offset.length(), 3.5, 6.5);
  offset.setLength(dist);

  focusAnim = {
    fromPos: camera.position.clone(),
    toPos: targetPos.clone().add(offset),
    fromTarget: controls.target.clone(),
    toTarget: targetPos.clone(),
    start: performance.now(),
    duration: 750,
  };
  controls.enabled = false;
}

/* --------------------- เทคนิค "บ้านตุ๊กตา": เฟดผนังที่บังกล้องออก -------------------- */
const toCam = new THREE.Vector3();
function updateWallFade() {
  toCam.set(camera.position.x, 0, camera.position.z).normalize();
  for (const w of walls) {
    const facing = w.normal.dot(toCam); // > 0 แปลว่ากล้องอยู่ฝั่งนอกผนังนี้ (บังมุมมอง)
    const targetOpacity = facing > 0.15 ? 0 : 1;
    w.mesh.material.opacity = THREE.MathUtils.lerp(w.mesh.material.opacity, targetOpacity, 0.12);
  }
}

/* ------------------------------- 3D interaction (Picking) ------------------------------ */
// คลิกป้าย: ป้ายเด้ง + กล้องเลื่อนไปโฟกัส (ไม่มีหน้าต่าง GUI แล้ว)
const pickables = [{ object: refs.infoStandee }, { object: refs.photoFrame }, { object: refs.skillBoard }];
const picking = setupPicking(camera, renderer, pickables, (found) => focusOn(found.object));

/* ----------------------------------- resize --------------------------------- */
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = camera.aspect < 1 ? 55 : 40;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);
onResize();
setTimeout(() => document.getElementById('loader')?.classList.add('done'), 900);

/* ------------------------------ เช็กขนาดฉากไม่เกิน 10x10 ------------------------------ */
const bbox = new THREE.Box3().setFromObject(room).getSize(new THREE.Vector3());
console.log(`Scene footprint: ${bbox.x.toFixed(2)} x ${bbox.z.toFixed(2)} (limit 10 x 10)`);

/* ------------------------------------- loop ---------------------------------- */
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  updateWallFade();
  picking.update();

  pointer.lerp(pointerTarget, 0.045);
  dust.rotation.y = t * 0.012;
  dust.position.x = Math.sin(t * 0.11) * 0.12;

  if (focusAnim) {
    const p = Math.min((performance.now() - focusAnim.start) / focusAnim.duration, 1);
    const ease = p * p * (3 - 2 * p); // smoothstep
    camera.position.lerpVectors(focusAnim.fromPos, focusAnim.toPos, ease);
    controls.target.lerpVectors(focusAnim.fromTarget, focusAnim.toTarget, ease);
    if (p >= 1) {
      focusAnim = null;
      controls.enabled = true;
    }
  }
  if (!focusAnim && controls.autoRotate) {
    controls.target.x = THREE.MathUtils.lerp(controls.target.x, pointer.x * 0.10, 0.018);
    controls.target.y = THREE.MathUtils.lerp(controls.target.y, 1.2 - pointer.y * 0.045, 0.018);
  }
  controls.update();
  composer.render();
});
