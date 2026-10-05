import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeInfoCard, makeSkillBoard, makeWelcomeSign } from './textures.js';
import { PROFILE, SKILLS, WELCOME_TEXT } from './profile.js';
import { makeSwayMaterial } from './sway.js';

/**
 * โหลดโมเดลทั้งฉากที่ปั้นใน Blender (assets/bar.glb สร้างจาก blender/build_bar.py)

 */
const WALL_NORMALS = {
  Wall_N: [0, 0, -1],
  Wall_S: [0, 0, 1],
  Wall_E: [1, 0, 0],
  Wall_W: [-1, 0, 0],
};

const cleanName = (n) => (n || '').replace(/\.\d+$/, '');

// canvas texture ที่ใช้กับ UV ของ glTF ต้องปิด flipY (glTF นับ V จากด้านบน)
function forGltf(tex) {
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

export async function loadBarModel(url, mats, { wallHalf, wallH }) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;

  /* ---------------- คลังวัสดุ (ชื่อตรงกับใน blender/build_bar.py) ---------------- */
  const lib = {
    wall: mats.wall,
    floor: mats.floor,
    counterBase: mats.counterBase,
    counterTop: mats.counterTop,
    metal: mats.metal,
    brass: mats.brass,
    fabric: mats.fabric,
    wood_dark: mats.wood_dark,
    leaf: makeSwayMaterial(mats.leaf), // vertex shader: ใบไม้โอนเอน
    pot: mats.pot,
    barrel: mats.barrel,
    felt: mats.felt,
    bulb: mats.bulb,
    frameInner: mats.frameInner,
    mirror: new THREE.MeshStandardMaterial({
      color: 0x16151a,
      metalness: 0.88,
      roughness: 0.1,
      emissive: 0x2b1820,
      emissiveIntensity: 0.18,
    }),
    infoCard: new THREE.MeshStandardMaterial({ map: forGltf(makeInfoCard(PROFILE)), roughness: 0.85 }),
    skillCard: new THREE.MeshStandardMaterial({ map: forGltf(makeSkillBoard('SKILLS', SKILLS)), roughness: 0.85 }),
    welcomeSign: new THREE.MeshStandardMaterial({ map: forGltf(makeWelcomeSign(WELCOME_TEXT)), roughness: 0.72, metalness: 0.02 }),
    photoInner: mats.frameInner.clone(),
  };
  mats.glassColors.forEach((m, i) => (lib[`glass${i}`] = m));
  [0x8b5a43, 0x6b7f9a].forEach((color, i) => {
    lib[`cup${i}`] = new THREE.MeshPhysicalMaterial({
      color, transmission: 0.72, transparent: true, opacity: 0.72, roughness: 0.08, metalness: 0, thickness: 0.04,
    });
  });
  [0xf2ede0, 0xd8b23a, 0x2f5aa8, 0xb23a3a, 0x2a1b12, 0x2f8a4f, 0x8a3a8a, 0xd86b2f].forEach((color, i) => {
    lib[`ball${i}`] = new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.05 });
  });

  // รูปถ่ายจริง (ถ้ายังไม่มีไฟล์ จะเป็นกรอบสีเรียบ ไม่พัง)
  new THREE.TextureLoader().load(
    PROFILE.photo,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      forGltf(tex);
      lib.photoInner.map = tex;
      lib.photoInner.needsUpdate = true;
    },
    undefined,
    () => console.warn(`ยังไม่พบไฟล์รูปที่ ${PROFILE.photo} — วางรูปตัวเองไว้ตรงนั้นแล้วรีเฟรชหน้าเว็บ`)
  );

  // UV จาก Blender ฉายเป็นหน่วยเมตร: ผนังกว้าง 8 ม. ให้ 1 ลายไม้ ≈ 3.3 ม. (เท่ากับ repeat 2.4 x 1.1 ของเดิม)
  if (mats.wall.map) mats.wall.map.repeat.set(0.3, 0.306);

  /* ---------------- ผูกวัสดุ/เงา/ผนัง ---------------- */
  const walls = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const wallNormal = WALL_NORMALS[o.name];
    if (wallNormal) {
      const material = mats.wall.clone();
      material.transparent = true;
      material.depthWrite = false;
      o.material = material;
      walls.push({ mesh: o, normal: new THREE.Vector3(...wallNormal) });
    } else {
      const mapped = lib[cleanName(o.material && o.material.name)];
      if (mapped) o.material = mapped;
    }
    const isSign = o.name.startsWith('Welcome_');
    o.castShadow = !isSign && !o.name.startsWith('Cup_');
    o.receiveShadow = !isSign;
  });

  /* ---------------- ไฟ (แสงไม่ได้ export จาก Blender เพื่อคุมความสว่างในเว็บได้ตรง ๆ) ---------------- */
  const pendantLights = [];
  for (const x of [-1.3, 1.3]) {
    const l = new THREE.PointLight(0xffb566, 6.5, 4.8, 2);
    l.position.set(x, wallH - 1.15 - 0.08, -wallHalf + 1.3 * 0.7);
    root.add(l);
    pendantLights.push(l);
  }
  for (const y of [1.25, 1.95, 2.65]) {
    const glow = new THREE.PointLight(0xff9b63, 1.35, 3.2, 2);
    glow.position.set(0, y - 0.08, -wallHalf + 0.14 + 0.08);
    root.add(glow);
  }

  const need = (name) => {
    const o = root.getObjectByName(name);
    if (!o) throw new Error(`bar.glb ไม่มี object ชื่อ "${name}" — export ใหม่จาก blender/build_bar.py`);
    return o;
  };
  const refs = {
    pendantLights,
    infoStandee: need('InfoStandee'),
    photoFrame: need('PhotoFrame'),
    skillBoard: need('SkillBoard'),
    welcome: need('WelcomeSign'),
  };
  if (walls.length !== 4) throw new Error('bar.glb ต้องมีผนัง Wall_N/S/E/W ครบ 4 ด้าน');

  return { group: root, refs, walls };
}
