import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {plainMaterials} from '../src/materials.js';
import {createTerrain,heightAt} from '../src/terrain.js';
import {createFort} from '../src/fort.js';
import {createEnvironment} from '../src/environment.js';

const m=plainMaterials(),terrain=createTerrain(m),fort=createFort(m),environment=createEnvironment(m);
let triangles=0,meshCount=0,instances=0,invalid=[];
for(const model of [terrain.group,fort.group,environment.group]){
  assert(model?.isObject3D,'Every scene component must contain genuine 3D geometry.');
  model.updateMatrixWorld(true);
  model.traverse(o=>{
    if(!o.isMesh)return;meshCount++;
    const g=o.geometry,p=g.attributes.position;
    assert(p&&p.count>0,`${o.name} has no positions`);
    for(let i=0;i<p.array.length;i++)if(!Number.isFinite(p.array[i])){invalid.push(o.name);break;}
    if(g.index){let max=0;for(const i of g.index.array)max=Math.max(max,i);assert(max<p.count,`Invalid index in ${o.name}`);}
    triangles+=(g.index?.count??p.count)/3*(o.isInstancedMesh?o.count:1);
    if(o.isInstancedMesh)instances+=o.count;
  });
}
assert.equal(invalid.length,0,`Non-finite geometry: ${invalid.join(',')}`);
const bounds=new THREE.Box3().setFromObject(terrain.group),size=bounds.getSize(new THREE.Vector3());
assert(size.x>1200&&size.z>400&&size.y>250,'Complete mountain must extend from its broad natural base to the high ridge.');
assert(heightAt(500,0)>140&&heightAt(500,0)<175,'Fort shoulder must meet its foundations.');
let peak=-Infinity;for(let x=-1000;x<700;x+=10)for(let z=-270;z<310;z+=10)peak=Math.max(peak,heightAt(x,z));
assert(peak>heightAt(500,0)+100,'The higher ridge must rise behind the fort shoulder.');
assert(fort.hotspots?.length>=3,'Documented architectural features must be inspectable.');
const report={checked:new Date().toISOString(),meshCount,instancedObjects:instances,renderedTrianglesAllLOD:Math.round(triangles),mountainBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},sampledPeak:peak,fortShoulder:heightAt(500,0),terrain:terrain.stats,fort:fort.stats,validation:'Finite geometry and indices, complete mountain extents, shoulder siting, and landmark inspection passed.'};
await fs.mkdir('public/assets',{recursive:true});await fs.writeFile('public/assets/geometry-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
