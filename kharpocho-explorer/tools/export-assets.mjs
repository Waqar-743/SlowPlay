import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import {Document,NodeIO} from '@gltf-transform/core';
import {EXTMeshGPUInstancing,EXTMeshoptCompression, KHRMeshQuantization} from '@gltf-transform/extensions';
import {dedup,prune,meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import {plainMaterials,textureExtension,surfaceTint} from '../src/materials.js';
import {createTerrain} from '../src/terrain.js';
import {createFort} from '../src/fort.js';
import {createEnvironment} from '../src/environment.js';

const target=path.resolve('public/assets');await fs.mkdir(target,{recursive:true});
const compressedOnly=process.argv.includes('--compressed-only');
const previous=compressedOnly?JSON.parse(await fs.readFile(path.join(target,'manifest.json'),'utf8')):null;
const mats=plainMaterials();
for(const name of ['rock','stone','sand','plaster','timber']){mats[name].color.setHex(surfaceTint(name));mats[name].userData.textureSet=name;}
mats.scree.userData.textureSet='rock';
const terrain=createTerrain(mats),fort=createFort(mats),env=createEnvironment(mats);

async function exportGroup(name,objects,{portable=false}={}){
  const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(name);
  Object.assign(doc.getRoot().getAsset(),{version:'2.0',generator:'Kharpocho digital heritage reconstruction / Three.js + glTF Transform',copyright:'Original model: CC BY 4.0. Interpretive reconstruction; see research.md. Reference photos retain separate credits.'});
  const gpu=doc.createExtension(EXTMeshGPUInstancing), geos=new Map(),materials=new Map(),textures=new Map(),palettes=new Map();
  function tintedMesh(base,color){
    const shade=Math.round(color.r*12)/12;
    if(!palettes.has(base))palettes.set(base,new Map());const cache=palettes.get(base);if(cache.has(shade))return cache.get(shade);
    const mesh=doc.createMesh('Weathered instance palette');
    for(const primitive of base.listPrimitives()){
      const material=primitive.getMaterial().clone(),c=material.getBaseColorFactor();material.setBaseColorFactor([c[0]*shade,c[1]*shade*.98,c[2]*shade*.94,c[3]]);
      mesh.addPrimitive(primitive.clone().setMaterial(material));
    }
    cache.set(shade,mesh);return mesh;
  }
  function accessor(attr,type,label){
    let array=attr.array;
    if(attr.isInterleavedBufferAttribute){array=new Float32Array(attr.count*attr.itemSize);for(let i=0;i<attr.count;i++)for(let j=0;j<attr.itemSize;j++)array[i*attr.itemSize+j]=attr.data.array[i*attr.data.stride+attr.offset+j];}
    return doc.createAccessor(label).setType(type).setArray(array).setNormalized(!!attr.normalized).setBuffer(buffer);
  }
  async function image(set,kind){
    const key=`${set}-${kind}`;if(textures.has(key))return textures.get(key);
    const ext=textureExtension(set,kind),file=`${key}.${ext}`;
    const t=doc.createTexture(key).setImage(await fs.readFile(path.resolve('public/textures',file))).setMimeType(ext==='png'?'image/png':'image/jpeg');textures.set(key,t);return t;
  }
  async function material(mat){
    if(materials.has(mat.uuid))return materials.get(mat.uuid);
    const m=doc.createMaterial(mat.name||`Weathered ${mat.userData.textureSet||'surface'}`).setBaseColorFactor([...mat.color.toArray(),mat.opacity??1]).setMetallicFactor(mat.metalness??0).setRoughnessFactor(mat.roughness??1).setDoubleSided(mat.side===THREE.DoubleSide);
    if(mat.transparent)m.setAlphaMode('BLEND');
    const set=mat.userData.textureSet;
    if(set){m.setBaseColorTexture(await image(set,'color')).setNormalTexture(await image(set,'normal')).setNormalScale(.7).setMetallicRoughnessTexture(await image(set,'roughness')).setOcclusionTexture(await image(set,'ao')).setOcclusionStrength(.35);}
    materials.set(mat.uuid,m);return m;
  }
  async function mesh(geometry,mat){
    const key=geometry.uuid+mat.uuid;
    if(geos.has(key))return geos.get(key);
    const primitive=doc.createPrimitive().setMaterial(await material(mat));
    const semantics={position:'POSITION',normal:'NORMAL',uv:'TEXCOORD_0',uv1:'TEXCOORD_1',color:'COLOR_0'};
    for(const [key,semantic]of Object.entries(semantics)){
      const a=geometry.attributes[key];if(a)primitive.setAttribute(semantic,accessor(a,`VEC${a.itemSize}`,semantic));
    }
    if(geometry.index)primitive.setIndices(accessor(geometry.index,'SCALAR','indices'));
    const m=doc.createMesh(geometry.name||'Modeled surface').addPrimitive(primitive);geos.set(key,m);return m;
  }
  async function nodeFor(obj){
    const n=doc.createNode(obj.name||obj.type).setTranslation(obj.position.toArray()).setRotation(obj.quaternion.toArray()).setScale(obj.scale.toArray());
    n.setExtras({interpretation:obj.userData?.evidence??'Reference-informed geometry; dimensions approximate'});
    if(obj.isMesh){
      const mat=Array.isArray(obj.material)?obj.material[0]:obj.material;
      n.setMesh(await mesh(obj.geometry,mat));
      if(obj.isInstancedMesh){
        const ts=new Float32Array(obj.count*3),qs=new Float32Array(obj.count*4),ss=new Float32Array(obj.count*3);
        const matrix=new THREE.Matrix4(),t=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
        for(let i=0;i<obj.count;i++){obj.getMatrixAt(i,matrix);matrix.decompose(t,q,s);t.toArray(ts,i*3);q.toArray(qs,i*4);s.toArray(ss,i*3);}
        const ext=gpu.createInstancedMesh().setAttribute('TRANSLATION',accessor(new THREE.BufferAttribute(ts,3),'VEC3','instance translations')).setAttribute('ROTATION',accessor(new THREE.BufferAttribute(qs,4),'VEC4','instance rotations')).setAttribute('SCALE',accessor(new THREE.BufferAttribute(ss,3),'VEC3','instance scales'));
        if(obj.instanceColor)ext.setAttribute('_COLOR_0',accessor(obj.instanceColor,'VEC3','instance colors'));
        if(portable){
          const baseMesh=n.getMesh();n.setMesh(null);
          const color=new THREE.Color();
          for(let i=0;i<obj.count;i++){if(obj.instanceColor)obj.getColorAt(i,color);else color.setRGB(1,1,1);n.addChild(doc.createNode(`Masonry or rock instance ${i+1}`).setMesh(obj.instanceColor?tintedMesh(baseMesh,color):baseMesh).setTranslation(Array.from(ts.slice(i*3,i*3+3))).setRotation(Array.from(qs.slice(i*4,i*4+4))).setScale(Array.from(ss.slice(i*3,i*3+3))));}
        }else n.setExtension('EXT_mesh_gpu_instancing',ext);
      }
    }
    const children=obj.isLOD?[obj.levels[0].object]:obj.children;
    for(const child of children){if(!child.isLight&&!child.isPoints&&!child.isLine)n.addChild(await nodeFor(child));}
    return n;
  }
  for(const object of objects)scene.addChild(await nodeFor(object));
  if(portable)gpu.dispose();
  await doc.transform(dedup(),prune());
  await MeshoptEncoder.ready;
  if(!portable)await doc.transform(meshopt({encoder:MeshoptEncoder,level:'medium',quantizationVolume:'mesh',quantizePosition:16,quantizeNormal:12}));
  const io=new NodeIO().registerExtensions([EXTMeshGPUInstancing,EXTMeshoptCompression,KHRMeshQuantization]).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
  const localName=name==='kharpocho-complete-portable'?'Kharpocho-Complete-Editable.glb':name==='kharpocho-fort-portable'?'Kharpocho-Fort-Editable.glb':null;
  const file=localName?path.resolve('..',localName):path.join(target,name+'.glb');await io.write(file,doc);
  const size=(await fs.stat(file)).size;
  console.log(JSON.stringify({file,name,bytes:size,meshes:doc.getRoot().listMeshes().length,nodes:doc.getRoot().listNodes().length}));
  return {file:localName?'../'+localName:name+'.glb',bytes:size,localOnly:!!localName};
}
const exports=[];
exports.push(await exportGroup('kharpocho-complete',[terrain.group,fort.group,env.group]));
exports.push(await exportGroup('kharpocho-fort',[fort.group]));
exports.push(await exportGroup('khardong-mountain',[terrain.group]));
if(!compressedOnly){
  exports.push(await exportGroup('kharpocho-fort-portable',[fort.group],{portable:true}));
  exports.push(await exportGroup('kharpocho-complete-portable',[terrain.group,fort.group,env.group],{portable:true}));
}else exports.push(...previous.exports.filter(item=>item.localOnly));
await fs.writeFile(path.join(target,'manifest.json'),JSON.stringify({version:1,coordinateSystem:'Y up; X east; Z south. Meters are approximate, not survey dimensions.',fortOrigin:[500,155,0],license:'CC BY 4.0',exports},null,2));
