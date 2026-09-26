import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { makeWoodPanel, makeCheckerFloor, makeToonGradient } from './textures.js';
import { buildBarScene } from './bar-props.js';
import { setupPicking } from './interactions.js';

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
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);
const maxAniso = renderer.capabilities.getMaxAnisotropy();

/* -------------------------------- scene --------------------------------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x241a22);
scene.fog = new THREE.Fog(0x241a22, 14, 30);

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
const floorTex = makeCheckerFloor(10, maxAniso);

const mats = {
  wall: new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.88 }),
  floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55 }),
  counterBase: new THREE.MeshStandardMaterial({ map: counterTex, roughness: 0.7 }),
  counterTop: new THREE.MeshStandardMaterial({ color: 0x2c1c12, roughness: 0.3, metalness: 0.05 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.35, metalness: 0.9 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc8a055, roughness: 0.3, metalness: 0.85 }),
  fabric: new THREE.MeshStandardMaterial({ color: 0xb23a3a, roughness: 0.9 }),
  wood_dark: new THREE.MeshStandardMaterial({ color: 0x2a1b12, roughness: 0.65 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x3d7a45, roughness: 0.8 }),
  pot: new THREE.MeshStandardMaterial({ color: 0xb5651d, roughness: 0.85 }),
  barrel: new THREE.MeshStandardMaterial({ map: makeWoodPanel({ r: 120, g: 82, b: 42 }, maxAniso, 10), roughness: 0.75 }),
  bulb: new THREE.MeshBasicMaterial({ color: 0xfff2c8 }),
  eye: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }),
  frameInner: new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.9 }),
  glassColors: [0x3f6b4f, 0x6b3f3f, 0x3f5a6b, 0x5a4a6b].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.78 })
  ),
  toon: new THREE.MeshToonMaterial({ color: 0xffd34d, gradientMap: makeToonGradient(3) }),
  toonAccent: new THREE.MeshToonMaterial({ color: 0xff8a3d, gradientMap: makeToonGradient(3) }),
};

function add(m, { receive = true } = {}) {
  m.receiveShadow = receive;
  room.add(m);
  return m;
}

/* --------------------------------- floor --------------------------------- */
const floor = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), mats.floor);
floor.rotation.x = -Math.PI / 2;
add(floor);

/* ---------------------- ผนัง 4 ด้าน (ใช้เทคนิคเฟดผนัง) -------------------- */
const walls = [];
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
  return m;
}
makeWall(SIZE, WALL_H, WALL_T, 0, WALL_H / 2, -HALF - WALL_T / 2, new THREE.Vector3(0, 0, -1)); // เหนือ (บาร์หลัก)
makeWall(SIZE, WALL_H, WALL_T, 0, WALL_H / 2, HALF + WALL_T / 2, new THREE.Vector3(0, 0, 1)); // ใต้
makeWall(WALL_T, WALL_H, SIZE, HALF + WALL_T / 2, WALL_H / 2, 0, new THREE.Vector3(1, 0, 0)); // ตะวันออก
makeWall(WALL_T, WALL_H, SIZE, -HALF - WALL_T / 2, WALL_H / 2, 0, new THREE.Vector3(-1, 0, 0)); // ตะวันตก (มีต้นไม้+กรอบรูป)

// บัวขอบล่างของทุกผนัง (เส้นไม้เข้มบางๆ)
[
  [SIZE, -HALF - WALL_T / 2, 0],
  [SIZE, HALF + WALL_T / 2, 0],
].forEach(([len, z]) => {
  const skirt = mesh_(new THREE.BoxGeometry(len, 0.16, 0.04), mats.wood_dark, 0, 0.08, z + (z < 0 ? 0.02 : -0.02));
  room.add(skirt);
});
function mesh_(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/* --------------------------------- props ---------------------------------- */
const { group: barGroup, refs } = buildBarScene(mats, { wallHalf: HALF, wallH: WALL_H });
room.add(barGroup);

/* ---------------------------------- lights --------------------------------- */
const hemi = new THREE.HemisphereLight(0x6b4a35, 0x140d08, 0.55);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffdcae, 1.7);
key.position.set(6, 6.5, 5);
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

/* ------------------------------------ camera -------------------------------- */
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(9, 6.8, 8.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.2, -0.4);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 4.5;
controls.maxDistance = 22;
controls.minPolarAngle = 0.15;
controls.maxPolarAngle = 1.5; // ไม่ให้มุดลงใต้พื้น
// ไม่จำกัดมุมซ้าย-ขวา -> หมุนได้ครบ 360 องศา
controls.update();

const hint = document.getElementById('hint');
controls.addEventListener('start', () => hint && hint.classList.add('gone'));

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
// TODO: แก้ title/desc ตรงนี้เป็นข้อมูลจริง (ชื่อ-สกุล/รหัส/สาขา/คณะ/มหาวิทยาลัย และรูปถ่าย) ทีหลัง
const pickables = [
  { object: refs.neonSign, title: 'ป้ายต้อนรับ', desc: '(ใส่ชื่อ-นามสกุล / รหัสนักศึกษา / สาขา / คณะ / มหาวิทยาลัย ตรงนี้ภายหลัง)' },
  { object: refs.photoFrame, title: 'รูปถ่ายส่วนตัว', desc: '(จะใส่รูปถ่ายตัวเองเป็น texture ในกรอบนี้ภายหลัง)' },
  { object: refs.mascot, title: 'มาสคอตประจำพอร์ต', desc: 'ตัวละครที่แสดงผลด้วยเทคนิค cel shading (MeshToonMaterial + gradient map)' },
  { object: refs.shelf, title: 'ชั้นวางขวด', desc: 'วัสดุ PBR หลายแบบ: แก้ว (roughness ต่ำ), ไม้ (roughness สูง)' },
  { object: refs.barrel, title: 'ถังไม้', desc: 'ไม้ + ห่วงโลหะ (metalness สูง) ตัวอย่างวัสดุ PBR ผสมกันหลายชนิด' },
  { object: refs.counter, title: 'เคาน์เตอร์บาร์', desc: 'จุดศูนย์กลางของฉาก ขึ้นรูปด้วย ExtrudeGeometry ให้โค้งมน' },
];
const panelEls = {
  root: document.getElementById('info-panel'),
  title: document.getElementById('info-title'),
  desc: document.getElementById('info-desc'),
  close: document.getElementById('info-close'),
};
const picking = setupPicking(camera, renderer, pickables, panelEls);

/* --------------------- แผงปรับแสง: เปิดด้วย ?gui ต่อท้าย URL --------------------- */
const gui = new GUI({ title: 'Lighting' });
gui.add(renderer, 'toneMappingExposure', 0.3, 2.5, 0.01).name('exposure');
gui.add(key, 'intensity', 0, 5, 0.05).name('key light');
gui.add(hemi, 'intensity', 0, 2, 0.01).name('ambient');
gui
  .add({ pendant: 5 }, 'pendant', 0, 15, 0.5)
  .name('pendant lights')
  .onChange((v) => refs.pendantLights.forEach((l) => (l.intensity = v)));
gui.add(scene, 'environmentIntensity', 0, 1.5, 0.01).name('environment');
if (!new URLSearchParams(location.search).has('gui')) gui.hide();

/* ----------------------------------- resize --------------------------------- */
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = camera.aspect < 1 ? 55 : 40;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);
onResize();

/* ------------------------------ เช็กขนาดฉากไม่เกิน 10x10 ------------------------------ */
const bbox = new THREE.Box3().setFromObject(room).getSize(new THREE.Vector3());
console.log(`Scene footprint: ${bbox.x.toFixed(2)} x ${bbox.z.toFixed(2)} (limit 10 x 10)`);

/* ------------------------------------- loop ---------------------------------- */
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  if (refs.bunting) refs.bunting.material.uniforms.uTime.value = t;
  updateWallFade();
  picking.update();
  controls.update();
  renderer.render(scene, camera);
});
