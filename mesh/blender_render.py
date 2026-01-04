# Blender 3.x/4.x script
# Usage (example):
#   blender --background --python blender_render.py -- \
#     --obj ribbon.obj --out render.png --mode illustration1
#
# Notes:
# - No paid plugins required.
# - This script assumes Cycles is available.

import argparse
import math
import os
import sys

import bpy


def _parse_args(argv):
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--obj", required=True, help="Path to OBJ file")
    parser.add_argument("--out", required=True, help="Output PNG path")
    parser.add_argument("--mode", default="illustration1", choices=["illustration1", "illustration2"])
    parser.add_argument("--width", type=int, default=2048)
    return parser.parse_args(argv)


def _reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def _ensure_cycles():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences
    cycles = prefs.addons["cycles"].preferences if "cycles" in prefs.addons else None
    if cycles:
        cycles.compute_device_type = "NONE"


def _world_setup():
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)

    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = 1.0

    # Soft grey gradient using "Gradient Texture" into ColorRamp
    texcoord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    grad = nt.nodes.new("ShaderNodeTexGradient")
    ramp = nt.nodes.new("ShaderNodeValToRGB")

    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.92, 0.92, 0.92, 1.0)
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = (0.75, 0.75, 0.75, 1.0)

    nt.links.new(texcoord.outputs["Generated"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], grad.inputs["Vector"])
    nt.links.new(grad.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def _import_obj(path):
    bpy.ops.wm.obj_import(filepath=path)
    objs = [o for o in bpy.context.selected_objects if o.type == "MESH"]
    if not objs:
        raise RuntimeError("No mesh imported")
    obj = objs[0]
    bpy.context.view_layer.objects.active = obj
    return obj


def _shade_material(obj):
    mat = bpy.data.materials.new(name="Mono")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.92, 0.92, 0.92, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.25
    bsdf.inputs["Specular"].default_value = 0.6

    obj.data.materials.clear()
    obj.data.materials.append(mat)


def _modifiers(obj):
    # Subdivision for smoothing
    sub = obj.modifiers.new(name="Subsurf", type="SUBSURF")
    sub.levels = 2
    sub.render_levels = 2

    # Solidify for thin shell
    sol = obj.modifiers.new(name="Solidify", type="SOLIDIFY")
    sol.thickness = 0.01
    sol.offset = 0.0

    # Wireframe ribs
    wf = obj.modifiers.new(name="Wireframe", type="WIREFRAME")
    wf.thickness = 0.004
    wf.use_even_offset = True
    wf.use_replace = False


def _lights(mode):
    # Key
    bpy.ops.object.light_add(type="AREA", location=(3.5, -3.0, 4.0))
    key = bpy.context.object
    key.data.energy = 1500.0 if mode == "illustration1" else 2000.0
    key.data.size = 2.5

    # Fill
    bpy.ops.object.light_add(type="AREA", location=(-4.5, -1.0, 2.5))
    fill = bpy.context.object
    fill.data.energy = 500.0 if mode == "illustration1" else 350.0
    fill.data.size = 3.5

    # Rim
    bpy.ops.object.light_add(type="AREA", location=(-1.0, 5.5, 3.5))
    rim = bpy.context.object
    rim.data.energy = 700.0 if mode == "illustration2" else 450.0
    rim.data.size = 2.0


def _camera(mode, obj):
    bpy.ops.object.camera_add()
    cam = bpy.context.object

    # Frame the object via bounds
    bpy.context.view_layer.update()
    bb = [obj.matrix_world @ bpy.mathutils.Vector(corner) for corner in obj.bound_box]
    center = sum(bb, bpy.mathutils.Vector((0, 0, 0))) / 8.0

    if mode == "illustration1":
        cam.location = center + bpy.mathutils.Vector((0.0, -5.5, 2.5))
        cam.rotation_euler = (math.radians(70), 0.0, 0.0)
        cam.data.lens = 45
        cam.data.dof.use_dof = True
        cam.data.dof.focus_distance = 4.5
        cam.data.dof.aperture_fstop = 3.2
    else:
        cam.location = center + bpy.mathutils.Vector((0.3, -1.1, 0.55))
        cam.rotation_euler = (math.radians(78), 0.0, math.radians(7))
        cam.data.lens = 85
        cam.data.dof.use_dof = True
        cam.data.dof.focus_distance = 1.1
        cam.data.dof.aperture_fstop = 1.8

    bpy.context.scene.camera = cam


def _ground(mode):
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, -1.2))
    plane = bpy.context.object
    mat = bpy.data.materials.new(name="Ground")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.85, 0.85, 0.85, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.65
    plane.data.materials.append(mat)


def _render(out_path, width):
    scene = bpy.context.scene
    scene.cycles.samples = 128

    # Ambient occlusion (Cycles uses AO via shader; approximate by enabling denoise + good lighting)
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"

    scene.render.resolution_x = width
    scene.render.resolution_y = int(width * 0.75)

    scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)


def main():
    args = _parse_args(sys.argv)
    obj_path = os.path.abspath(args.obj)
    out_path = os.path.abspath(args.out)

    _reset_scene()
    _ensure_cycles()
    _world_setup()

    mesh_obj = _import_obj(obj_path)
    _shade_material(mesh_obj)
    _modifiers(mesh_obj)

    # Center object at origin for nicer camera framing
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    mesh_obj.location = (0, 0, 0)

    _ground(args.mode)
    _lights(args.mode)
    _camera(args.mode, mesh_obj)

    _render(out_path, args.width)


if __name__ == "__main__":
    main()
