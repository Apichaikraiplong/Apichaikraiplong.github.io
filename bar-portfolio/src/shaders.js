import * as THREE from 'three';

/**
 * Custom shaders (ทุกตัวมีทั้ง vertex shader และ fragment shader)
 *
 * 1) Cel shading  : celVertex + celFragment   -> เป็ดบนเคาน์เตอร์ (แสงตกเป็นขั้น 3 ระดับ + highlight + rim light)
 * 2) Outline      : outlineVertex + outlineFragment -> เส้นขอบการ์ตูนรอบเป็ด (inverted hull)
 * 3) Wobble orb   : orbVertex + orbFragment   -> ลูกแก้วเวทมนตร์ที่ผิวบิดตัวตามเวลา (vertex เปลี่ยนตำแหน่ง realtime,
 *                                                fragment ไล่สีเป็นแถบ + fresnel glow)
 */

/* ============================== 1) CEL SHADING ============================== */
const celVertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewDirW;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(transpose(inverse(modelMatrix))) * normal);
    vViewDirW = cameraPosition - worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const celFragment = /* glsl */ `
  uniform vec3 uBase;      // สีกลาง
  uniform vec3 uShade;     // สีส่วนเงา
  uniform vec3 uLight;     // สีส่วนสว่าง
  uniform vec3 uRim;       // สีขอบเรืองแสง
  uniform vec3 uLightDir;  // ทิศทางแสง (world space, ชี้จากวัตถุไปหาแสง)

  varying vec3 vNormalW;
  varying vec3 vViewDirW;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vViewDirW);
    vec3 L = normalize(uLightDir);

    // แสง diffuse แปลงเป็น 0..1 แล้วตัดเป็นขั้นบันได 3 ระดับ (เงา / กลาง / สว่าง)
    float ndl = dot(N, L) * 0.5 + 0.5;
    float band1 = smoothstep(0.40, 0.44, ndl);
    float band2 = smoothstep(0.70, 0.74, ndl);
    vec3 col = mix(uShade, uBase, band1);
    col = mix(col, uLight, band2);

    // specular แบบเป็นจุดแข็ง ๆ (ไม่ไล่เฉด)
    vec3 H = normalize(L + V);
    float s = pow(max(dot(N, H), 0.0), 48.0);
    col += vec3(1.0) * smoothstep(0.45, 0.50, s) * 0.35;

    // rim light ตรงขอบวัตถุ
    float rim = 1.0 - max(dot(N, V), 0.0);
    col += uRim * smoothstep(0.68, 0.72, rim) * 0.45;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function makeCelMaterial({ base, shade, light, rim }, lightDir) {
  return new THREE.ShaderMaterial({
    vertexShader: celVertex,
    fragmentShader: celFragment,
    uniforms: {
      uBase: { value: new THREE.Color(base) },
      uShade: { value: new THREE.Color(shade) },
      uLight: { value: new THREE.Color(light) },
      uRim: { value: new THREE.Color(rim) },
      uLightDir: { value: lightDir }, // ใช้ Vector3 ตัวเดียวกันทุก material
    },
  });
}

/* ================================ 2) OUTLINE ================================ */
const outlineVertex = /* glsl */ `
  uniform float uThickness;
  void main() {
    vec3 p = position + normal * uThickness; // ดันจุดออกไปตามแนว normal
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const outlineFragment = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4(uColor, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function makeOutlineMaterial(color = 0x2a1208, thickness = 0.006) {
  return new THREE.ShaderMaterial({
    vertexShader: outlineVertex,
    fragmentShader: outlineFragment,
    uniforms: { uColor: { value: new THREE.Color(color) }, uThickness: { value: thickness } },
    side: THREE.BackSide, // เรนเดอร์เฉพาะด้านใน -> เหลือเป็นเส้นขอบรอบวัตถุ
  });
}

/* ============================ 3) WOBBLE ORB ============================ */
const orbVertex = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  varying vec3 vNormalW;
  varying vec3 vViewDirW;
  varying vec3 vLocalPos;
  varying float vDisp;

  void main() {
    // ผิวบิดตัวเป็นคลื่นหลายความถี่ซ้อนกัน เปลี่ยนตำแหน่งจุดยอดตามเวลา
    float d = sin(position.x * 26.0 + uTime * 2.0) * 0.5
            + sin(position.y * 30.0 + uTime * 1.6) * 0.3
            + sin(position.z * 22.0 + uTime * 2.4) * 0.2;
    vec3 p = position + normal * d * uAmp;

    vDisp = d;
    vLocalPos = p;
    vec4 worldPos = modelMatrix * vec4(p, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDirW = cameraPosition - worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const orbFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uGlow;
  varying vec3 vNormalW;
  varying vec3 vViewDirW;
  varying vec3 vLocalPos;
  varying float vDisp;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vViewDirW);

    // แถบสีไหลขึ้นตามความสูง + ขยับตามคลื่นของผิว
    float bands = 0.5 + 0.5 * sin(vLocalPos.y * 38.0 - uTime * 2.0 + vDisp * 3.0);
    vec3 col = mix(uColorA, uColorB, bands);

    // fresnel: ขอบลูกแก้วเรืองแสง
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.5);
    col += uGlow * fres * 0.9;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function makeOrbMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: orbVertex,
    fragmentShader: orbFragment,
    uniforms: {
      uTime: { value: 0 },
      uAmp: { value: 0.012 },
      uColorA: { value: new THREE.Color(0x7a2a6e) },
      uColorB: { value: new THREE.Color(0xff9a3c) },
      uGlow: { value: new THREE.Color(0xffd9a0) },
    },
  });
}

/* ============================ วัตถุที่ใช้ shader ในฉาก ============================ */
const COUNTER_TOP = 0.92; // ความสูงผิวเคาน์เตอร์
const COUNTER_Z = -3.45;  // แนวหน้าเคาน์เตอร์ (ห้อง 8x8, ผนังเหนือ z = -4)

/** เพิ่มเมชพร้อมเส้นขอบ (ลูกเป็นเมชย่อย BackSide) */
function celPart(geometry, material, outlineMat, x, y, z) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (outlineMat) m.add(new THREE.Mesh(geometry, outlineMat));
  return m;
}

/**
 * สร้างเป็ด cel shading + ลูกแก้ว vertex-wobble วางบนเคาน์เตอร์
 * @param {THREE.Vector3} lightPosition ตำแหน่งไฟหลัก (key light) ใช้คำนวณทิศแสงของ cel shader
 */
export function buildShaderProps(lightPosition) {
  const group = new THREE.Group();
  const lightDir = lightPosition.clone().normalize();

  /* ---------- เป็ด (cel shading) ---------- */
  const yellow = makeCelMaterial({ base: 0xffd34d, shade: 0xc98a1c, light: 0xfff1a8, rim: 0xfff3c0 }, lightDir);
  const orange = makeCelMaterial({ base: 0xff8a3d, shade: 0xb8481c, light: 0xffc08a, rim: 0xffd0a8 }, lightDir);
  const line = makeOutlineMaterial(0x2a1208, 0.006);

  const duck = new THREE.Group();
  duck.position.set(2.0, COUNTER_TOP, COUNTER_Z);
  duck.add(celPart(new THREE.SphereGeometry(0.15, 24, 16), yellow, line, 0, 0.15, 0));          // ลำตัว
  duck.add(celPart(new THREE.SphereGeometry(0.095, 24, 16), yellow, line, 0, 0.32, 0.03));      // หัว
  duck.add(celPart(new THREE.SphereGeometry(0.06, 16, 12), yellow, line, 0, 0.17, -0.15));      // หาง

  const beakGeo = new THREE.SphereGeometry(0.05, 16, 12);
  beakGeo.scale(1.0, 0.45, 1.4);
  duck.add(celPart(beakGeo, orange, line, 0, 0.305, 0.13));                                     // ปาก

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const sx of [-0.04, 0.04]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), eyeMat);
    eye.position.set(sx, 0.34, 0.105);
    duck.add(eye);
  }
  group.add(duck);

  /* ---------- ลูกแก้ว (vertex shader ทำให้ผิวบิด) ---------- */
  const orbMat = makeOrbMaterial();
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 6), orbMat);
  const orbBaseY = COUNTER_TOP + 0.2;
  orb.position.set(0.9, orbBaseY, COUNTER_Z);
  group.add(orb);

  return {
    group,
    /** เรียกทุกเฟรม: t = เวลาเป็นวินาที */
    update(t) {
      orbMat.uniforms.uTime.value = t;
      orb.position.y = orbBaseY + Math.sin(t * 1.4) * 0.015;
      duck.rotation.y = Math.sin(t * 0.7) * 0.3;
    },
  };
}
