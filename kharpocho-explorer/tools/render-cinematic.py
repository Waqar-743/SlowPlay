import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector

site=Path(__file__).resolve().parents[1]
root=site.parent
output=site/'public'/'presentation'
output.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(site.parent/'Kharpocho-Complete-Editable.glb'))
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE_NEXT'
if hasattr(scene.eevee,'taa_render_samples'):scene.eevee.taa_render_samples=16
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.cycles.max_bounces=4
scene.cycles.diffuse_bounces=2
scene.cycles.glossy_bounces=2
scene.render.resolution_x=1440
scene.render.resolution_y=900
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
scene.view_settings.view_transform='AgX'
scene.view_settings.exposure=.45

world=bpy.data.worlds.new('Skardu high desert light');world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.67,.73,.78,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.55
scene.world=world
def xyz(p):return Vector((p[0],-p[2],p[1]))
def aim(obj,target):obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
sun_data=bpy.data.lights.new('Late western sunlight','SUN');sun_data.energy=3.3;sun_data.angle=math.radians(1.0);sun_data.color=(1.0,.86,.67)
sun=bpy.data.objects.new('Late western sunlight',sun_data);scene.collection.objects.link(sun);sun.location=xyz((-700,450,900));aim(sun,xyz((0,100,0)))
fill_data=bpy.data.lights.new('Cool sky fill','SUN');fill_data.energy=.35;fill_data.angle=math.radians(25);fill_data.color=(.72,.82,1.0);fill_data.use_shadow=False
fill=bpy.data.objects.new('Cool sky fill',fill_data);scene.collection.objects.link(fill);fill.location=xyz((1000,900,-300));aim(fill,xyz((100,100,0)))
camera_data=bpy.data.cameras.new('Cinematic survey');camera=bpy.data.objects.new('Cinematic survey',camera_data);scene.collection.objects.link(camera);scene.camera=camera
camera_data.clip_start=.25;camera_data.clip_end=22000
camera_data.lens=35
# A subtle depth mist preserves the arid valley's atmospheric scale.
scene.view_layers[0].use_pass_mist=True
world.mist_settings.start=700;world.mist_settings.depth=12000;world.mist_settings.falloff='QUADRATIC'
scene.use_nodes=True
tree=scene.node_tree;tree.nodes.clear();layers=tree.nodes.new('CompositorNodeRLayers');mix=tree.nodes.new('CompositorNodeMixRGB');mix.blend_type='MIX';mix.inputs[2].default_value=(.73,.70,.63,1)
tree.links.new(layers.outputs['Image'],mix.inputs[1]);tree.links.new(layers.outputs['Mist'],mix.inputs[0]);out=tree.nodes.new('CompositorNodeComposite');tree.links.new(mix.outputs[0],out.inputs[0])

views=[
('01-complete-mountain',(1600,540,1450),(-80,155,0)),
('02-fort-and-ridge',(655,252,182),(496,158,0)),
('03-timber-gateway',(517,166,68),(500,158,36)),
('04-indus-face',(1100,310,-1250),(115,117,0)),
]
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(site.parent/'Kharpocho-Fort.blend'))
for name,position,target in views:
    camera.location=xyz(position);aim(camera,xyz(target));scene.render.filepath=str(output/(name+'.png'))
    if name=='03-timber-gateway':world.mist_settings.start=100
    else:world.mist_settings.start=700
    bpy.ops.render.render(write_still=True)
    print('RENDER_COMPLETE',name,flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(site.parent/'Kharpocho-Fort.blend'))
print('Saved editable Blender scene and four physical 3D renders.',flush=True)
