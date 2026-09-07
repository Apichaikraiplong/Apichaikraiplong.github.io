# Next Gen Rendering — PBR Robot Viewer

เว็บแอป WebGL (Three.js) สำหรับ Assignment #3 — โหลดโมเดลตัวละคร `.glb` แสดงผลด้วย
PBR Shader (Base Color / Metallic / Roughness) พร้อม HDRI skybox จากไฟล์ `.exr`,
พื้น/สิ่งปลูกสร้างที่ใช้ PBR Shader เช่นกัน, ปรับตำแหน่งแหล่งกำเนิดแสงด้วย mouse
(ลากทรงกลมสีทอง) และ GUI, และคลิกเลือกวัตถุเพื่อแก้ค่า PBR แบบเรียลไทม์

## โครงสร้างไฟล์

```
index.html          ← ทั้งแอปอยู่ในไฟล์เดียว (HTML + CSS + JS module)
assets/robot.glb     ← โมเดลตัวละคร (จากไฟล์ที่อัปโหลด)
assets/studio.exr    ← HDRI environment / skybox (จากไฟล์ที่อัปโหลด)
```

ไลบรารีทั้งหมด (Three.js, OrbitControls, DragControls, GLTFLoader, EXRLoader, lil-gui)
โหลดผ่าน CDN (jsDelivr) ด้วย `<script type="importmap">` — ไม่ต้อง build, ไม่ต้อง npm install

## วิธี deploy ขึ้น GitHub Pages

1. สร้าง repo ใหม่บน GitHub (หรือใช้ repo เดิม)
2. คัดลอกทั้งโฟลเดอร์นี้ (`index.html` + โฟลเดอร์ `assets/`) ไปไว้ที่ root ของ repo
3. commit + push:
   ```
   git init
   git add .
   git commit -m "Assignment 3: Next Gen Rendering"
   git branch -M main
   git remote add origin https://github.com/<username>/<repo>.git
   git push -u origin main
   ```
4. ไปที่ repo → **Settings → Pages** → Source เลือก branch `main` (root) → Save
5. รอสัก 1-2 นาที เว็บจะขึ้นที่ `https://<username>.github.io/<repo>/`
   (ใช้ URL นี้ส่งเป็นคำตอบของ assignment ได้เลย)

ไฟล์ `assets/robot.glb` มีขนาด ~23.7MB — อยู่ในลิมิตปกติของ GitHub ต่อไฟล์ (100MB)
จึง push ตรง ๆ ได้โดยไม่ต้องใช้ Git LFS

## การใช้งานหน้าเว็บ

- **ลากเมาส์** = หมุนกล้อง, **สกอลล์** = ซูมเข้า/ออก
- **คลิกที่วัตถุ** (พื้น, แท่น, เสา, หรือส่วนต่าง ๆ ของหุ่นยนต์) เพื่อเลือก แล้วปรับ
  Base Color / Metallic / Roughness ได้จากพาเนลมุมขวาบน (หรือเลือกจาก dropdown "Object")
- **ลากทรงกลมสีทอง** ในฉาก = ย้ายตำแหน่งแหล่งกำเนิดแสงแบบ real-time (มี slider X/Y/Z
  ในพาเนลให้ปรับละเอียดด้วยเช่นกัน)
- พาเนล **Environment / Skybox** ปรับ exposure, ความเข้มของแสงจาก HDRI, และเปิด/ปิดพื้นหลัง HDRI
- ติ๊ก **Show PBR reference chart** เพื่อโชว์แถวลูกบอลอ้างอิง metallic 0→1 และ
  roughness 0→1 แยกกัน ใช้ประกอบอธิบายคุณสมบัติของ PBR ในคลิปนำเสนอได้

## ปรับแต่งเพิ่มเติม (ถ้าต้องการ)

- เปลี่ยนเวอร์ชัน Three.js: แก้เลข `0.170.0` ใน `<script type="importmap">`
- ตำแหน่งเริ่มต้นกล้อง / ขนาดโมเดล: แก้ค่าคงที่ในช่วงต้นของ `<script type="module">`
  (`camera.position.set(...)`, ตัวแปร `scale` ใน callback ของ `gltfLoader.load`)
- อยากได้แสงเพิ่ม (เช่น rim light) หรือมุมกล้องล็อกไว้หลายมุม: เพิ่ม Light/Camera preset
  ในบล็อก GUI ได้ตามรูปแบบเดิม
