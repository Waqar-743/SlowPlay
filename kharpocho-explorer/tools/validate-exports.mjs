import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import {NodeIO} from '@gltf-transform/core';
import {EXTMeshGPUInstancing,EXTMeshoptCompression,KHRMeshQuantization} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {plainMaterials} from '../src/materials.js';
import {createFort} from '../src/fort.js';
import {heightAt} from '../src/terrain.js';

await MeshoptDecoder.ready;
const output=path.resolve('public/assets');
const manifest=JSON.parse(await fs.readFile(path.join(output,'manifest.json'),'utf8'));
const io=new NodeIO().registerExtensions([EXTMeshGPUInstancing,EXTMeshoptCompression,KHRMeshQuantization]).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const report={checked:new Date().toISOString(),decoder:'glTF Transform NodeIO + MeshoptDecoder',files:[],comparisons:[],collision:{},passed:false};
const vector=new THREE.Vector3(),tmp=new THREE.Matrix4(),world=new THREE.Matrix4(),instance=new THREE.Matrix4(),translation=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
const finite=(array,label)=>{for(const v of array)assert(Number.isFinite(v),`${label}: non-finite value`);};
const boxJSON=box=>({min:box.min.toArray(),max:box.max.toArray()});

async function inspect(file){
  const actualPath=file.startsWith('../')?path.resolve(file):path.join(output,file);
  const bytes=await fs.readFile(actualPath),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  assert.equal(view.getUint32(0,true),0x46546c67,`${file}: invalid GLB header`);
  assert.equal(view.getUint32(4,true),2,`${file}: unsupported GLB version`);
  assert.equal(view.getUint32(8,true),bytes.length,`${file}: GLB size mismatch`);
  const jsonSize=view.getUint32(12,true),json=JSON.parse(bytes.subarray(20,20+jsonSize).toString('utf8'));
  assert((json.buffers??[]).every(b=>!b.uri),`${file}: external buffer dependency`);
  assert((json.images??[]).every(i=>i.uri===undefined&&Number.isInteger(i.bufferView)),`${file}: missing or external image reference`);
  const document=await io.read(actualPath),root=document.getRoot(),cache=new Map();
  let vertices=0,uniqueTriangles=0,renderedTriangles=0,geometryDraws=0,instances=0,checkedAccessors=0;
  for(const accessor of root.listAccessors()){
    const array=accessor.getArray();assert(array&&array.length>0,`${file}: empty accessor`);finite(array,`${file} accessor ${accessor.getName()}`);checkedAccessors++;
  }
  for(const mesh of root.listMeshes())for(const primitive of mesh.listPrimitives()){
    const positions=primitive.getAttribute('POSITION');assert(positions&&positions.getCount()>0,`${file}: empty primitive positions`);
    assert.equal(primitive.getMode(),4,`${file}: expected triangle primitive`);
    const count=positions.getCount(),index=primitive.getIndices(),indices=index?.getArray(),seen=new Uint8Array(count),values=[],el=[];
    if(indices)for(const i of indices)assert(Number.isInteger(i)&&i>=0&&i<count,`${file}: invalid primitive index`);
    const iteration=indices??Array.from({length:count},(_,i)=>i);
    for(const i of iteration)if(!seen[i]){seen[i]=1;positions.getElement(i,el);finite(el,`${file} decoded position`);values.push(el[0],el[1],el[2]);}
    const triangles=(indices?.length??count)/3;assert(Number.isInteger(triangles)&&triangles>0,`${file}: invalid triangle count`);
    const normal=primitive.getAttribute('NORMAL');if(normal)assert.equal(normal.getCount(),count,`${file}: normal count mismatch`);
    const material=primitive.getMaterial();assert(material,`${file}: missing material`);
    const slots=[['baseColor',material.getBaseColorTexture(),material.getBaseColorTextureInfo()],['normal',material.getNormalTexture(),material.getNormalTextureInfo()],['roughness',material.getMetallicRoughnessTexture(),material.getMetallicRoughnessTextureInfo()],['occlusion',material.getOcclusionTexture(),material.getOcclusionTextureInfo()]];
    for(const [slot,texture,info] of slots)if(texture){assert(texture.getImage()?.length>0,`${file}: missing ${slot} image`);assert(primitive.getAttribute(`TEXCOORD_${info.getTexCoord()}`),`${file}: missing ${slot} UV coordinates`);}
    cache.set(primitive,{values:new Float64Array(values),triangles});vertices+=values.length/3;uniqueTriangles+=triangles;
  }
  const textureDetails=root.listTextures().map(texture=>{
    const image=texture.getImage(),mime=texture.getMimeType();assert(image&&image.length>100,`${file}: empty image`);
    if(mime==='image/jpeg')assert(image[0]===255&&image[1]===216,`${file}: malformed JPEG`);
    else if(mime==='image/png')assert(image[0]===137&&image[1]===80,`${file}: malformed PNG`);
    else assert.fail(`${file}: unexpected image MIME ${mime}`);
    return {name:texture.getName(),mimeType:mime,bytes:image.length};
  });
  const bounds=new THREE.Box3(),componentBounds=new Map(),rootNames=[];
  function includePrimitive(primitive,matrix,component){
    const {values,triangles}=cache.get(primitive);renderedTriangles+=triangles;geometryDraws++;
    for(let i=0;i<values.length;i+=3){vector.set(values[i],values[i+1],values[i+2]).applyMatrix4(matrix);bounds.expandByPoint(vector);component.expandByPoint(vector);}
  }
  function visit(node,component){
    finite(node.getMatrix(),`${file} node transform`);
    const mesh=node.getMesh();
    if(mesh){
      world.fromArray(node.getWorldMatrix());const instancing=node.getExtension('EXT_mesh_gpu_instancing');
      if(instancing){
        const t=instancing.getAttribute('TRANSLATION'),q=instancing.getAttribute('ROTATION'),s=instancing.getAttribute('SCALE'),n=(t??q??s).getCount();
        for(const a of instancing.listAttributes())assert.equal(a.getCount(),n,`${file}: inconsistent instancing attributes`);
        const a=[],b=[],c=[];
        for(let i=0;i<n;i++){
          translation.fromArray(t?t.getElement(i,a):[0,0,0]);rotation.fromArray(q?q.getElement(i,b):[0,0,0,1]);scale.fromArray(s?s.getElement(i,c):[1,1,1]);
          instance.compose(translation,rotation,scale);tmp.multiplyMatrices(world,instance);
          for(const primitive of mesh.listPrimitives())includePrimitive(primitive,tmp,component);
        }
        instances+=n;
      }else for(const primitive of mesh.listPrimitives())includePrimitive(primitive,world,component);
    }
    for(const child of node.listChildren())visit(child,component);
  }
  for(const scene of root.listScenes())for(const node of scene.listChildren()){
    rootNames.push(node.getName());const component=new THREE.Box3();componentBounds.set(node.getName(),component);visit(node,component);
  }
  assert(!bounds.isEmpty()&&renderedTriangles>10000,`${file}: no usable decoded geometry`);
  finite([...bounds.min.toArray(),...bounds.max.toArray()],`${file} world bounds`);
  const containsFort=!file.startsWith('khardong-'),containsMountain=!file.toLowerCase().replace('../','').startsWith('kharpocho-fort');
  if(containsFort)assert(rootNames.includes('fort'),`${file}: missing fort root`);
  if(containsMountain){assert(rootNames.includes('mountain'),`${file}: missing mountain root`);const box=componentBounds.get('mountain'),size=box.getSize(new THREE.Vector3());assert(size.x>1200&&size.z>400&&size.y>250,`${file}: mountain incomplete`);}
  if(containsFort){const b=componentBounds.get('fort');assert(b.min.x>400&&b.max.x<600&&b.min.y>140&&b.max.y<190,`${file}: fort coordinate placement incorrect`);}
  const extensions=root.listExtensionsUsed().map(e=>e.extensionName),portable=file.includes('portable')||file.includes('Editable');
  if(portable){assert(!extensions.includes('EXT_mesh_gpu_instancing'),`${file}: portable file still needs GPU instancing`);assert(!extensions.includes('EXT_meshopt_compression'),`${file}: portable file still compressed`);}
  else assert(extensions.includes('EXT_meshopt_compression'),`${file}: expected mesh compression absent`);
  return {file,bytes:bytes.length,nodes:root.listNodes().length,meshes:root.listMeshes().length,checkedAccessors,uniqueReferencedVertices:vertices,uniqueTriangles,renderedTriangles,geometryDraws,gpuInstances:instances,roots:rootNames,bounds:boxJSON(bounds),componentBounds:Object.fromEntries([...componentBounds].map(([name,b])=>[name,boxJSON(b)])),extensions,embeddedImages:textureDetails.length,images:textureDetails,externalDependencies:0,passed:true};
}

for(const item of manifest.exports){const result=await inspect(item.file);assert.equal(result.bytes,item.bytes,`${item.file}: manifest size mismatch`);report.files.push(result);console.log(`${item.file}: ${result.renderedTriangles.toLocaleString()} decoded triangles; ${result.embeddedImages} embedded images; passed`);}

for(const name of ['kharpocho-complete','kharpocho-fort']){
  const compressed=report.files.find(f=>f.file===`${name}.glb`),portable=report.files.find(f=>f.file===(name==='kharpocho-complete'?'../Kharpocho-Complete-Editable.glb':'../Kharpocho-Fort-Editable.glb'));
  assert.equal(compressed.renderedTriangles,portable.renderedTriangles,`${name}: compressed/portable triangle count differs`);
  const deltas=[...compressed.bounds.min.map((v,i)=>Math.abs(v-portable.bounds.min[i])),...compressed.bounds.max.map((v,i)=>Math.abs(v-portable.bounds.max[i]))],maxDelta=Math.max(...deltas);
  assert(maxDelta<.5,`${name}: compressed/portable bounds differ by ${maxDelta}m`);
  for(const component of compressed.roots){const a=compressed.componentBounds[component],b=portable.componentBounds[component];assert(b,`${name}: component missing from portable`);const d=Math.max(...a.min.map((v,i)=>Math.abs(v-b.min[i])),...a.max.map((v,i)=>Math.abs(v-b.max[i])));assert(d<.5,`${name}: component ${component} bounds mismatch`);}
  report.comparisons.push({model:name,renderedTriangles:compressed.renderedTriangles,maxBoundsDifferenceMetres:maxDelta,toleranceMetres:.5,passed:true});
}

const fort=createFort(plainMaterials());assert(Array.isArray(fort.collisionWalls)&&fort.collisionWalls.length>0,'Missing returned collision map');
for(const wall of fort.collisionWalls){finite([...wall.a,...wall.b,wall.bottom,wall.top,wall.thickness],'Collision wall');assert(wall.top>wall.bottom&&wall.thickness>0,'Invalid collision wall extent');}
const gateway=fort.collisionWalls.find(w=>w.gate);assert(gateway,'No gateway collision opening');assert(Math.abs((gateway.a[0]+gateway.b[0])/2-500)<.01,'Gateway collision coordinates do not align with entrance');
const source=await fs.readFile(path.resolve('src/main.js'),'utf8');
report.collision={returnedWorldSpaceWalls:fort.collisionWalls.length,gateway,gateTerrainHeight:heightAt(500,36.7),mainUsesReturnedMap:source.includes('fort.collisionWalls'),passed:true};
report.passed=true;
await fs.writeFile(path.join(output,'export-validation.json'),JSON.stringify(report,null,2));
console.log(`All ${report.files.length} GLB exports passed. Report: public/assets/export-validation.json`);
