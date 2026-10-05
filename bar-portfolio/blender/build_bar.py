
import bpy, bmesh, math, os, random, sys
from mathutils import Vector


SIZE, HALF, WALL_H, WALL_T = 8.0, 4.0, 3.6, 0.15
COUNTER_W, COUNTER_D = 5.4, 1.3
WELCOME_Z = 0.10                     
WELCOME_W, WELCOME_H = 2.0, 0.469    


def out_path():
    if '--' in sys.argv:
        rest = sys.argv[sys.argv.index('--') + 1:]
        if rest:
            return os.path.abspath(rest[0])
    root = None
    try:
        f = os.path.abspath(__file__)
        if os.path.isfile(f):
            root = os.path.dirname(os.path.dirname(f))
    except NameError:
        pass
    if not root:
        root = os.path.dirname(bpy.data.filepath) or os.getcwd()
    return os.path.join(root, 'assets', 'bar.glb')



bpy.ops.wm.read_factory_settings(use_empty=True)
COLL = bpy.context.scene.collection


def T(x, y, z):
    """พิกัด Three.js (x, y-ขึ้น, z) -> Blender (x, -z, y)  (glTF exporter แปลงกลับเป็น Y-up ให้เอง)"""
    return Vector((x, -z, y))


def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def col(h):
    return (lin(((h >> 16) & 255) / 255), lin(((h >> 8) & 255) / 255), lin((h & 255) / 255), 1.0)


_mats = {}


def M(name, color=0xffffff, rough=0.5, metal=0.0, emit=None, emit_strength=0.0, alpha=1.0):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = col(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit is not None:
        b.inputs['Emission Color'].default_value = col(emit)
        b.inputs['Emission Strength'].default_value = emit_strength
    if alpha < 1.0:
        b.inputs['Alpha'].default_value = alpha
    _mats[name] = m
    return m



wall_m = M('wall', 0x603f28, 0.82, 0.02)
floor_m = M('floor', 0xcfc0ad, 0.42, 0.06)
cbase_m = M('counterBase', 0x8a603a, 0.58, 0.02)
ctop_m = M('counterTop', 0x24150f, 0.23, 0.08)
metal_m = M('metal', 0x6f6963, 0.24, 0.95)
brass_m = M('brass', 0xb98a3b, 0.22, 0.92)
fabric_m = M('fabric', 0xb23a3a, 0.9)
wooddark_m = M('wood_dark', 0x2a1b12, 0.65)
leaf_m = M('leaf', 0x3d7a45, 0.8)
pot_m = M('pot', 0xb5651d, 0.85)
barrel_m = M('barrel', 0x78522a, 0.75)
felt_m = M('felt', 0x173b25, 0.98)
bulb_m = M('bulb', 0xfff4cf, 0.2, emit=0xffb56e, emit_strength=4.2)
frame_in_m = M('frameInner', 0xd8d2c4, 0.9)
mirror_m = M('mirror', 0x16151a, 0.1, 0.88)
glass_ms = [M(f'glass{i}', c, 0.12) for i, c in enumerate([0x3f6b4f, 0x6b3f3f, 0x3f5a6b, 0x5a4a6b])]
cup_ms = [M('cup0', 0x8b5a43, 0.08, alpha=0.72), M('cup1', 0x6b7f9a, 0.08, alpha=0.72)]
ball_ms = [M(f'ball{i}', c, 0.25, 0.05) for i, c in enumerate(
    [0xf2ede0, 0xd8b23a, 0x2f5aa8, 0xb23a3a, 0x2a1b12, 0x2f8a4f, 0x8a3a8a, 0xd86b2f])]
info_m = M('infoCard', 0xf2e6c9, 0.85)      # texture ใส่ตอนรันเว็บ (ข้อความมาจาก src/profile.js)
skill_m = M('skillCard', 0xf2e6c9, 0.85)
welcome_m = M('welcomeSign', 0x211713, 0.72, 0.02)
photo_m = M('photoInner', 0xd8d2c4, 0.9)



def bm_box(w, h, d):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
    return bm


def bm_rbox(w, h, d, r):
    bm = bm_box(w, h, d)
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=r, offset_type='OFFSET', segments=2, affect='EDGES')
    return bm


def bm_cyl(rt, rb, h, seg=16, cap=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=seg, radius1=rb, radius2=rt, depth=h)
    return bm


def bm_sphere(r, us=14, vs=10):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=us, v_segments=vs, radius=r)
    return bm


def bm_torus(R, r, seg=24, tseg=8):
    bm = bmesh.new()
    vs = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        for j in range(tseg):
            b = 2 * math.pi * j / tseg
            k = R + r * math.cos(b)
            vs.append(bm.verts.new((k * math.cos(a), k * math.sin(a), r * math.sin(b))))
    for i in range(seg):
        for j in range(tseg):
            bm.faces.new((vs[i * tseg + j], vs[((i + 1) % seg) * tseg + j],
                          vs[((i + 1) % seg) * tseg + (j + 1) % tseg], vs[i * tseg + (j + 1) % tseg]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_plane(w, h):
    """แผ่นระนาบ UV 0-1 เต็มแผ่น (วาง/หมุนด้วย panel() ให้หันหน้าไป +Z ของ Three)"""
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in ((-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0))]
    f = bm.faces.new(v)
    uv = bm.loops.layers.uv.verify()
    for l, (u, vv) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        l[uv].uv = (u, vv)
    return bm


def bm_slab(width, depth, radius, height, n=14):
    """เคาน์เตอร์โค้งมน: หลังตรงชิดผนัง หน้าโค้ง 2 มุม (เหมือน roundedFrontShape เดิม)"""
    hw = width / 2
    r = min(radius, depth, hw)
    pts = [(-hw, 0), (hw, 0), (hw, depth - r)]

    def quad(p0, c, p1):
        for i in range(1, n + 1):
            t = i / n
            pts.append(((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0],
                        (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]))

    quad((hw, depth - r), (hw, depth), (hw - r, depth))
    pts.append((-hw + r, depth))
    quad((-hw + r, depth), (-hw, depth), (-hw, depth - r))
    xy = [(x, -z) for x, z in pts]                       # -> แกน Blender
    area = sum(xy[i][0] * xy[(i + 1) % len(xy)][1] - xy[(i + 1) % len(xy)][0] * xy[i][1] for i in range(len(xy)))
    if area < 0:
        xy.reverse()
    bm = bmesh.new()
    bot = [bm.verts.new((x, y, 0)) for x, y in xy]
    top = [bm.verts.new((x, y, height)) for x, y in xy]
    bm.faces.new(list(reversed(bot)))
    bm.faces.new(top)
    for i in range(len(xy)):
        j = (i + 1) % len(xy)
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def uv_box(bm, s=1.0):
    """UV ฉายตามแกน หน่วยเมตร (ใช้กับผนัง/เคาน์เตอร์ ให้ลายไม้ไม่ยืด)"""
    bm.normal_update()
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            c = l.vert.co
            u, v = (c.x, c.y) if ax == 2 else ((c.y, c.z) if ax == 0 else (c.x, c.z))
            l[uv].uv = (u * s, v * s)


def uv_cyl(bm, h):
    """UV รอบทรงกระบอก สำหรับถังไม้"""
    bm.normal_update()
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        side = abs(f.normal.z) < 0.5
        us = []
        for l in f.loops:
            c = l.vert.co
            us.append(math.atan2(c.y, c.x) / (2 * math.pi) + 0.5 if side else 0.5 + c.x)
        if side and max(us) - min(us) > 0.5:
            us = [u + 1 if u < 0.5 else u for u in us]
        for l, u in zip(f.loops, us):
            c = l.vert.co
            l[uv].uv = (u, (c.z + h / 2) / h if side else 0.5 + c.y)


def empty(name, loc=(0, 0, 0), ry=0.0, parent=None):
    e = bpy.data.objects.new(name, None)
    COLL.objects.link(e)
    e.location = T(*loc)
    e.rotation_euler = (0, 0, ry)
    if parent:
        e.parent = parent
    return e


def obj(name, bm, mat, loc=(0, 0, 0), rot=(0, 0, 0), parent=None, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = bool(smooth) and len(p.vertices) <= 4     # ฝาทรงกระบอก (n-gon) ให้เรียบแบน
    ob = bpy.data.objects.new(name, me)
    COLL.objects.link(ob)
    ob.location = T(*loc)
    ob.rotation_euler = rot
    ob.data.materials.append(mat)
    if parent:
        ob.parent = parent
    return ob


def panel(name, w, h, mat, loc, parent):
    """แผ่นป้ายตั้ง: หมุน X 90° ให้หันหน้าไป +Z ของ Three"""
    return obj(name, bm_plane(w, h), mat, loc, (math.pi / 2, 0, 0), parent)


# ---------------------------------------------------------------- ห้อง: พื้น + ผนัง 4 ด้าน + บัว
bmf = bmesh.new()
fv = [bmf.verts.new(p) for p in ((-HALF, -HALF, 0), (HALF, -HALF, 0), (HALF, HALF, 0), (-HALF, HALF, 0))]
ff = bmf.faces.new(fv)
uvl = bmf.loops.layers.uv.verify()
for l, (u, v) in zip(ff.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
    l[uvl].uv = (u, v)
obj('Floor', bmf, floor_m)


def wall(name, w, h, d, x, y, z):
    bm = bm_box(w, h, d)
    uv_box(bm)
    obj(name, bm, wall_m, (x, y, z))


wall('Wall_N', SIZE, WALL_H, WALL_T, 0, WALL_H / 2, -HALF - WALL_T / 2)    # ผนังบาร์หลัก
wall('Wall_S', SIZE, WALL_H, WALL_T, 0, WALL_H / 2, HALF + WALL_T / 2)
wall('Wall_E', WALL_T, WALL_H, SIZE, HALF + WALL_T / 2, WALL_H / 2, 0)     # ผนังป้าย WELCOME + Skills
wall('Wall_W', WALL_T, WALL_H, SIZE, -HALF - WALL_T / 2, WALL_H / 2, 0)    # ผนังกรอบรูป + ต้นไม้
obj('Skirt_N', bm_box(SIZE, 0.16, 0.04), wooddark_m, (0, 0.08, -HALF - WALL_T / 2 + 0.02))
obj('Skirt_S', bm_box(SIZE, 0.16, 0.04), wooddark_m, (0, 0.08, HALF + WALL_T / 2 - 0.02))

# ---------------------------------------------------------------- เคาน์เตอร์บาร์
counter = empty('Counter', (0, 0, -HALF))
b = bm_slab(COUNTER_W, COUNTER_D, 0.65, 0.85)
uv_box(b)
obj('Counter_Base', b, cbase_m, parent=counter)
obj('Counter_Top', bm_slab(COUNTER_W + 0.1, COUNTER_D + 0.06, 0.70, 0.07), ctop_m, (0, 0.85, 0), parent=counter)
obj('Counter_Rail', bm_cyl(0.028, 0.028, COUNTER_W - 0.45, 14), brass_m, (0, 0.16, COUNTER_D + 0.28),
    (0, math.pi / 2, 0), counter, True)
for s in (-1, 1):
    obj('Counter_Post', bm_cyl(0.022, 0.022, 0.34, 10), brass_m, (s * (COUNTER_W / 2 - 0.18), 0.17, COUNTER_D + 0.28),
        parent=counter, smooth=True)

# แก้ว 2 ใบบนเคาน์เตอร์
for i, x in enumerate((-0.55, 0.2)):
    obj(f'Cup_{i}', bm_cyl(0.055, 0.045, 0.22, 16, cap=False), cup_ms[i], (x, 1.01, -HALF + 0.52), smooth=True)
    obj(f'CupStem_{i}', bm_cyl(0.009, 0.009, 0.14, 8), metal_m, (x, 0.94, -HALF + 0.52), smooth=True)

# ---------------------------------------------------------------- ชั้นวางขวดหลังบาร์
random.seed(1990)
shelf = empty('Shelf', (0, 0, -HALF + 0.14))
SHELF_W, SHELF_D = 4.4, 0.24
obj('Shelf_Mirror', bm_box(SHELF_W + 0.16, 2.25, 0.045), mirror_m, (0, 1.95, -0.025), parent=shelf)
for y in (1.25, 1.95, 2.65):
    obj('Shelf_Board', bm_rbox(SHELF_W, 0.045, SHELF_D, 0.012), cbase_m, (0, y, 0), parent=shelf)
    n = 9
    for i in range(n):
        bx = -SHELF_W / 2 + 0.3 + i * (SHELF_W - 0.6) / (n - 1) + (random.random() - 0.5) * 0.05
        bh = 0.22 + random.random() * 0.08
        gm = glass_ms[i % 4]
        bottle = empty('Bottle', (bx, y + 0.023, 0), parent=shelf)
        obj('Bottle_Body', bm_cyl(0.045, 0.055, bh, 10), gm, (0, bh / 2, 0), parent=bottle, smooth=True)
        obj('Bottle_Neck', bm_cyl(0.018, 0.03, 0.07, 8), gm, (0, bh + 0.035, 0), parent=bottle, smooth=True)
        obj('Bottle_Ring', bm_torus(0.032, 0.006, 12, 5), brass_m, (0, bh + 0.003, 0), parent=bottle, smooth=True)

# ---------------------------------------------------------------- โคมไฟห้อย 2 ดวง
for i, x in enumerate((-1.3, 1.3)):
    lamp = empty(f'PendantLight_{i}', (x, 0, -HALF + COUNTER_D * 0.7))
    drop = 1.15
    shade_y = WALL_H - drop
    obj('Pendant_Cord', bm_cyl(0.012, 0.012, drop, 6), wooddark_m, (0, WALL_H - drop / 2, 0), parent=lamp)
    obj('Pendant_Shade', bm_cyl(0.22, 0.002, 0.16, 16, cap=False), brass_m, (0, shade_y, 0), parent=lamp, smooth=True)
    obj('Pendant_Bulb', bm_sphere(0.06, 10, 8), bulb_m, (0, shade_y - 0.07, 0), parent=lamp, smooth=True)

# ---------------------------------------------------------------- ถังไม้ / เก้าอี้บาร์ / ต้นไม้
barrel = empty('Barrel', (3.4, 0, -3.3))
bb = bm_cyl(0.42, 0.46, 0.85, 20)
uv_cyl(bb, 0.85)
obj('Barrel_Body', bb, barrel_m, (0, 0.425, 0), parent=barrel, smooth=True)
for y in (0.18, 0.62):
    obj('Barrel_Hoop', bm_torus(0.44, 0.02, 24, 6), metal_m, (0, y, 0), parent=barrel, smooth=True)

stool_z = -HALF + COUNTER_D + 0.75
for i, x in enumerate((-1.9, -0.65, 0.6, 1.85)):
    st = empty(f'Stool_{i}', (x, 0, stool_z))
    obj('Stool_Seat', bm_cyl(0.22, 0.20, 0.07, 18), fabric_m, (0, 0.62, 0), parent=st, smooth=True)
    obj('Stool_Post', bm_cyl(0.05, 0.05, 0.55, 8), metal_m, (0, 0.275, 0), parent=st, smooth=True)
    obj('Stool_Foot', bm_torus(0.16, 0.015, 18, 6), metal_m, (0, 0.22, 0), parent=st, smooth=True)

plant = empty('Plant', (-HALF + 0.55, 0, HALF - 0.7))
obj('Plant_Pot', bm_cyl(0.26, 0.32, 0.4, 14), pot_m, (0, 0.2, 0), parent=plant, smooth=True)
obj('Plant_Stem', bm_cyl(0.03, 0.045, 0.55, 6), wooddark_m, (0, 0.6, 0), parent=plant, smooth=True)
for x, y, z, r in ((0, 1.0, 0, 0.32), (0.16, 0.85, 0.1, 0.22), (-0.18, 0.8, -0.08, 0.24), (0.05, 1.25, -0.12, 0.2)):
    obj('Plant_Leaves', bm_sphere(r, 12, 9), leaf_m, (x, y, z), parent=plant, smooth=True)

# ---------------------------------------------------------------- โต๊ะสนุกเกอร์ (เอาไม้คิวออกแล้ว)
pool = empty('PoolTable', (1.3, 0, 1.9))
TW, TD, LEG_H, FRAME_H, FELT_T, RAIL_T = 1.9, 1.0, 0.75, 0.08, 0.02, 0.09
for sx in (-1, 1):
    for sz in (-1, 1):
        obj('Pool_Leg', bm_cyl(0.05, 0.06, LEG_H, 10), wooddark_m,
            (sx * (TW / 2 - 0.12), LEG_H / 2, sz * (TD / 2 - 0.12)), parent=pool, smooth=True)
obj('Pool_Frame', bm_rbox(TW, FRAME_H, TD, 0.012), cbase_m, (0, LEG_H + FRAME_H / 2, 0), parent=pool)
felt_y = LEG_H + FRAME_H + FELT_T / 2
obj('Pool_Felt', bm_box(TW - 0.1, FELT_T, TD - 0.1), felt_m, (0, felt_y, 0), parent=pool)
rail_y = felt_y + 0.045
obj('Pool_Rail', bm_box(TW, 0.08, RAIL_T), wooddark_m, (0, rail_y, TD / 2 - RAIL_T / 2), parent=pool)
obj('Pool_Rail', bm_box(TW, 0.08, RAIL_T), wooddark_m, (0, rail_y, -(TD / 2 - RAIL_T / 2)), parent=pool)
obj('Pool_Rail', bm_box(RAIL_T, 0.08, TD), wooddark_m, (TW / 2 - RAIL_T / 2, rail_y, 0), parent=pool)
obj('Pool_Rail', bm_box(RAIL_T, 0.08, TD), wooddark_m, (-(TW / 2 - RAIL_T / 2), rail_y, 0), parent=pool)
for px, pz in ((-TW / 2, -TD / 2), (TW / 2, -TD / 2), (-TW / 2, TD / 2), (TW / 2, TD / 2), (0, -TD / 2), (0, TD / 2)):
    obj('Pool_Pocket', bm_sphere(0.065, 12, 8), wooddark_m, (px, felt_y + 0.015, pz), parent=pool, smooth=True)
for i in range(8):
    ang = i / 8 * 2 * math.pi
    rad = 0.06 + (i % 3) * 0.09
    obj(f'Pool_Ball_{i}', bm_sphere(0.045, 14, 10), ball_ms[i],
        (math.cos(ang) * rad * (TW / TD), felt_y + 0.065, math.sin(ang) * rad), parent=pool, smooth=True)

# ---------------------------------------------------------------- ป้าย/กรอบรูป (คลิกได้: InfoStandee / PhotoFrame / SkillBoard)
info = empty('InfoStandee', (-1.6, 0.85 + 0.07, -HALF + COUNTER_D * 0.55))
IW, IH = 0.55, 0.68
obj('Standee_Back', bm_box(IW + 0.04, IH + 0.04, 0.02), wooddark_m, (0, IH / 2, 0), parent=info)
panel('Standee_Panel', IW, IH, info_m, (0, IH / 2, 0.012), info)
obj('Standee_Base', bm_box(IW * 0.5, 0.03, 0.14), wooddark_m, (0, 0.015, 0.07), parent=info)

photo = empty('PhotoFrame', (-HALF + 0.06, 2.1, 1.6), math.pi / 2)
obj('Photo_Frame', bm_box(0.62, 0.8, 0.04), wooddark_m, parent=photo)
panel('Photo_Panel', 0.5, 0.68, photo_m, (0, 0, 0.022), photo)

skill = empty('SkillBoard', (HALF - 0.06, 2.0, 1.9), -math.pi / 2)
obj('Skill_Frame', bm_box(0.65, 0.8, 0.04), wooddark_m, parent=skill)
panel('Skill_Panel', 0.6, 0.75, skill_m, (0, 0, 0.023), skill)

welcome = empty('WelcomeSign', (HALF - 0.06, 2.12, WELCOME_Z), -math.pi / 2)
panel('Welcome_Panel', WELCOME_W, WELCOME_H, welcome_m, (0, 0, 0), welcome)

# ---------------------------------------------------------------- export
path = out_path()
os.makedirs(os.path.dirname(path), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True,
                          export_cameras=False, export_lights=False)
print('EXPORTED ->', path, '| objects:', len(bpy.data.objects))
