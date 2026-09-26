import * as THREE from 'three';

/**
 * ผูก 3D interaction (picking) เข้ากับ canvas
 * pickables: [{ object: THREE.Object3D, title: string, desc: string }]
 * panelEls:  { root, title, desc, close } (element จาก index.html)
 * คืนค่า { update() } ให้เรียกทุกเฟรมเพื่อเล่นแอนิเมชันตอนคลิกโดน
 */
export function setupPicking(camera, renderer, pickables, panelEls) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const highlights = new Map(); // object -> { start, baseScale }
  let downPos = null;

  function isDescendant(root, obj) {
    let o = obj;
    while (o) {
      if (o === root) return true;
      o = o.parent;
    }
    return false;
  }

  function pickAt(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const meshes = pickables.map((p) => p.object);
    const hits = raycaster.intersectObjects(meshes, true);
    if (hits.length === 0) return null;
    const hitObj = hits[0].object;
    return pickables.find((p) => p.object === hitObj || isDescendant(p.object, hitObj)) || null;
  }

  function showPanel(found) {
    panelEls.title.textContent = found.title;
    panelEls.desc.textContent = found.desc;
    panelEls.root.classList.remove('hidden');
  }

  function triggerHighlight(obj) {
    const existing = highlights.get(obj);
    highlights.set(obj, { start: performance.now(), baseScale: existing ? existing.baseScale : obj.scale.x });
  }

  function onPointerDown(e) {
    downPos = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp(e) {
    if (!downPos) return;
    const dx = e.clientX - downPos.x;
    const dy = e.clientY - downPos.y;
    downPos = null;
    if (Math.hypot(dx, dy) > 6) return; // ลากกล้อง ไม่ใช่การคลิก
    const found = pickAt(e.clientX, e.clientY);
    if (!found) return;
    showPanel(found);
    triggerHighlight(found.object);
  }

  function onPointerMove(e) {
    if (downPos) return; // กำลังลากกล้องอยู่ ไม่ต้องเช็ก hover
    const found = pickAt(e.clientX, e.clientY);
    renderer.domElement.style.cursor = found ? 'pointer' : 'default';
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  panelEls.close.addEventListener('click', () => panelEls.root.classList.add('hidden'));

  return {
    update() {
      const now = performance.now();
      for (const [obj, h] of highlights) {
        const t = (now - h.start) / 500;
        if (t >= 1) {
          obj.scale.setScalar(h.baseScale);
          highlights.delete(obj);
          continue;
        }
        const bounce = Math.sin(t * Math.PI) * 0.18;
        obj.scale.setScalar(h.baseScale * (1 + bounce));
      }
    },
  };
}
