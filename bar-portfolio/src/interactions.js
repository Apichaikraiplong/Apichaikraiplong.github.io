import * as THREE from 'three';


export function setupPicking(camera, renderer, pickables, onPick) {
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
    const hits = raycaster.intersectObjects(pickables.map((p) => p.object), true);
    if (hits.length === 0) return null;
    const hitObj = hits[0].object;
    return pickables.find((p) => p.object === hitObj || isDescendant(p.object, hitObj)) || null;
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
    triggerHighlight(found.object);
    if (onPick) onPick(found);
  }

  function onPointerMove(e) {
    if (downPos) return; // กำลังลากกล้องอยู่ ไม่ต้องเช็ก hover
    const found = pickAt(e.clientX, e.clientY);
    renderer.domElement.style.cursor = found ? 'pointer' : 'default';
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointermove', onPointerMove);

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
