import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import GUI from 'three/addons/libs/lil-gui.module.min.js';

// ---------- ขนาดฉาก (1 หน่วย = 1 เมตร) ----------
const SIZE = 8; // พื้น 8x8 ทำให้ฉากทั้งหมดไม่เกิน 10x10
const HALF = SIZE / 2;
const WALL_H = 4;
const WALL_T = 0.2;
const SLAB_T = 0.3; // ความหนาของแท่นพื้น
const SHOW_PLINTHS = false; // false = ห้องเปล่า ไม่มีแท่นตั้งของ

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.NeutralToneMapping; // สีไม่เพี้ยน โทนขาวไม่ไหม้
renderer.toneMappingExposure = 1.0;
document.getElementById('app').appendChild(renderer.domElement);

// ---------- scene ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc8cad0);

// แสงฟุ้งเบาๆ จากรอบห้อง (ยังไม่มีเงา) ไว้ให้ส่วนที่แดดไม่ถึงไม่ดำสนิท
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

const room = new THREE.Group();
scene.add(room);

// ที่ว่างไว้สำหรับโมเดลจาก Blender ในงวดถัดไป
const props = new THREE.Group();
scene.add(props);

// ---------- texture ผิวหยาบๆ วาดเองด้วย canvas ----------
function makeGrain(r, g, b, noise) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // เม็ดละเอียดทั้งภาพ
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * noise;
    img.data[i] = r + n;
    img.data[i + 1] = g + n;
    img.data[i + 2] = b + n;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  // ด่างจางๆ กว้างๆ ให้ผิวไม่แบนเกินไป (วาดวนรอบขอบให้ต่อกันเนียน)
  for (let k = 0; k < 40; k++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const rad = 80 + Math.random() * 180;
    const c = Math.random() < 0.5 ? '0,0,0' : '255,255,255';
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        const grad = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
        grad.addColorStop(0, `rgba(${c},0.035)`);
        grad.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

// ---------- วัสดุ ----------
const floorTex = makeGrain(176, 178, 184, 14); // คอนกรีตเทาเย็น
floorTex.repeat.set(3, 3);
const wallTex = makeGrain(232, 231, 228, 8); // ปูนขาวอมเทา
wallTex.repeat.set(2, 2);

const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 });
const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 });
const plinthMat = new THREE.MeshStandardMaterial({ color: 0xf1f0ed, roughness: 0.85 });

function addToRoom(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  room.add(mesh);
}

// ---------- พื้น (แท่นหนา 0.3) ----------
const slab = new THREE.Mesh(new THREE.BoxGeometry(SIZE, SLAB_T, SIZE), floorMat);
slab.position.y = -SLAB_T / 2;
addToRoom(slab);

// ---------- ผนังหลัง ----------
const backWall = new THREE.Mesh(new THREE.BoxGeometry(SIZE + WALL_T, WALL_H, WALL_T), wallMat);
backWall.position.set(-WALL_T / 2, WALL_H / 2, -HALF - WALL_T / 2);
addToRoom(backWall);

// ---------- ผนังซ้าย เจาะช่องแคบสูง 3 ช่องให้แดดลอดเข้ามา ----------
// วาดรูปผนังเป็น 2D (u = ตำแหน่งตามแนวผนัง, v = ความสูง) แล้วดันให้มีความหนา
const wallShape = new THREE.Shape();
wallShape.moveTo(0, 0);
wallShape.lineTo(SIZE, 0);
wallShape.lineTo(SIZE, WALL_H);
wallShape.lineTo(0, WALL_H);
wallShape.lineTo(0, 0);

const slitWidth = 0.6;
const slitBottom = 0.5;
const slitTop = 3.5;
for (const centerU of [1.6, 4, 6.4]) {
  const hole = new THREE.Path();
  hole.moveTo(centerU - slitWidth / 2, slitBottom);
  hole.lineTo(centerU + slitWidth / 2, slitBottom);
  hole.lineTo(centerU + slitWidth / 2, slitTop);
  hole.lineTo(centerU - slitWidth / 2, slitTop);
  hole.lineTo(centerU - slitWidth / 2, slitBottom);
  wallShape.holes.push(hole);
}

const leftWall = new THREE.Mesh(
  new THREE.ExtrudeGeometry(wallShape, { depth: WALL_T, bevelEnabled: false }),
  wallMat
);
leftWall.rotation.y = -Math.PI / 2; // แกน x ของรูป -> แกน z ของโลก, ความหนาชี้ออกนอกห้อง
leftWall.position.set(-HALF, 0, -HALF);
addToRoom(leftWall);

// ---------- แท่นตั้งของ (ยังว่าง ไว้วางชิ้นงานทีหลัง) ----------
const plinthData = [
  { x: -1.6, z: -2.2, w: 1.0, h: 0.5 },
  { x: 1.4, z: -2.6, w: 0.8, h: 1.1 },
  { x: 2.4, z: 0.9, w: 0.9, h: 0.7 },
  { x: -0.6, z: 1.4, w: 0.7, h: 0.35 },
];
if (SHOW_PLINTHS) {
  plinthData.forEach((p, i) => {
    const plinth = new THREE.Mesh(new RoundedBoxGeometry(p.w, p.h, p.w, 3, 0.015), plinthMat);
    plinth.position.set(p.x, p.h / 2, p.z);
    plinth.name = `plinth_${i + 1}`;
    addToRoom(plinth);
  });
}

// ---------- แสง ----------
// แดดเฉียงจากซ้าย ลอดช่องผนังมาเป็นแถบยาวบนพื้น
const sun = new THREE.DirectionalLight(0xfff0dc, 3.2);
sun.position.set(-9, 5, 1);
sun.target.position.set(0, 0, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.left = -8;
sun.shadow.camera.right = 8;
sun.shadow.camera.top = 8;
sun.shadow.camera.bottom = -8;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 25;
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

// ---------- กล้อง ----------
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(8.5, 6.5, 8.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-0.4, 1.3, -0.4);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 3;   
controls.maxDistance = 25;  
controls.minPolarAngle = 0.1;
controls.maxPolarAngle = 1.45;
controls.update();

// ---------- แผงปรับแสง: เปิดหน้าเว็บด้วย ?gui ต่อท้าย URL ----------
const gui = new GUI({ title: 'Lighting' });
gui.add(renderer, 'toneMappingExposure', 0.3, 2.5, 0.01).name('exposure');
gui.add(sun, 'intensity', 0, 8, 0.05).name('sun');
gui.add(scene, 'environmentIntensity', 0, 1.5, 0.01).name('ambient');
if (!new URLSearchParams(location.search).has('gui')) gui.hide();

// ---------- resize ----------
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = camera.aspect < 1 ? 58 : 38; // จอแนวตั้งใช้มุมกว้างขึ้น
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);
onResize();

// ---------- เช็กขนาดฉากไม่เกิน 10x10 ----------
const size = new THREE.Box3().setFromObject(room).getSize(new THREE.Vector3());
console.log(`Scene footprint: ${size.x.toFixed(2)} x ${size.z.toFixed(2)} (limit 10 x 10)`);

// ---------- loop ----------
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
