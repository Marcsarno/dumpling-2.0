"""Debug renders from raw arrays inside Blender (glTF coords converted: x, -z, y)."""
import bpy
import numpy as np
from mathutils import Vector, Matrix

VIEWS = {
    'front': ((0, -3, 0.64), 0.5), 'back': ((0, 3, 0.64), 0.5),
    'sideL': ((3, -0.01, 0.62), 0.4), 'sideR': ((-3, -0.01, 0.62), 0.4),
    'belowL': ((0.35, -0.01, -2.4), 0.36), 'belowR': ((-0.35, -0.01, -2.4), 0.36),
}


def to_blender(P):
    return np.stack([P[:, 0], -P[:, 2], P[:, 1]], 1)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'VERTEX'
    scene.render.resolution_x = 900; scene.render.resolution_y = 900
    cam_data = bpy.data.cameras.new('cam'); cam_data.type = 'ORTHO'
    cam = bpy.data.objects.new('cam', cam_data); scene.collection.objects.link(cam); scene.camera = cam
    return scene


def add_mesh(name, P, T, face_colors=None, vert_colors=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(to_blender(P).tolist(), [], T.tolist())
    me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    if face_colors is not None or vert_colors is not None:
        attr = me.color_attributes.new('c', 'FLOAT_COLOR', 'CORNER')
        cols = np.zeros((len(me.loops), 4), np.float32); cols[:, 3] = 1
        for poly in me.polygons:
            for li in poly.loop_indices:
                cols[li, :3] = face_colors[poly.index] if face_colors is not None else vert_colors[me.loops[li].vertex_index]
        attr.data.foreach_set('color', cols.reshape(-1))
        me.color_attributes.active_color = attr
    return ob


def add_points(P, radius=0.003, color=(1, 1, 0)):
    for p in to_blender(np.asarray(P)):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=p.tolist(), segments=8, ring_count=6)


def look_at(loc, tgt, up):
    f = (tgt - loc).normalized(); r = f.cross(up).normalized(); u = r.cross(f)
    m = Matrix((r, u, -f)).transposed().to_4x4(); m.translation = loc
    return m


def render(out_prefix, views=None):
    scene = bpy.context.scene; cam = scene.camera
    for name in views or VIEWS:
        loc, sc = VIEWS[name]
        loc = Vector(loc); tgt = Vector((loc.x if 'below' in name else 0, -0.01, 0.62))
        if 'side' in name: tgt = Vector((0, -0.01, 0.62))
        cam.location = loc
        cam.matrix_world = look_at(loc, tgt, Vector((0, 1, 0)) if 'below' in name else Vector((0, 0, 1)))
        cam.data.ortho_scale = sc
        scene.render.filepath = f'{out_prefix}_{name}.png'
        bpy.ops.render.render(write_still=True)
