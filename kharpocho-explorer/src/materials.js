import * as THREE from 'three';

export const textureExtension=(name,kind)=>kind==='normal'&&!['rock','stone'].includes(name)?'png':'jpg';
export const surfaceTint=name=>({rock:0xd4d2ca,stone:0xb5b0a1,plaster:0xc9bb9d,timber:0xe1d6c0}[name]??0xffffff);

export function plainMaterials() {
  return {
    rock: new THREE.MeshStandardMaterial({color:0xb0a89a,roughness:.95,vertexColors:true}),
    scree: new THREE.MeshStandardMaterial({color:0x8c8271,roughness:1}),
    stone: new THREE.MeshStandardMaterial({color:0xb9aa8e,roughness:.94}),
    plaster: new THREE.MeshStandardMaterial({color:0xb5a07b,roughness:1}),
    sand: new THREE.MeshStandardMaterial({color:0xc4b795,roughness:.99}),
    timber: new THREE.MeshStandardMaterial({color:0x62503a,roughness:.9}),
    dark: new THREE.MeshStandardMaterial({color:0x24221c,roughness:1}),
    water: new THREE.MeshStandardMaterial({color:0x6a8179,metalness:.12,roughness:.26,transparent:true,opacity:.90}),
  };
}

export async function createMaterials(progress=()=>{}, {quality='high'}={}) {
  const mats=plainMaterials(), loader=new THREE.TextureLoader();
  let complete=0;
  const names=['rock','stone','sand','plaster','timber'];
  await Promise.all(names.map(async name=>{
    const mat=mats[name];
    mat.userData.textureSet=name;
    await Promise.all(['color','normal','roughness','ao','height'].map(async kind=>{
      const texture=await loader.loadAsync(`/textures/${quality==='low'?'low/':''}${name}-${kind}.${kind==='height'?'png':textureExtension(name,kind)}`);
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.anisotropy=8;
      texture.colorSpace=kind==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;
      if(kind==='color')mat.map=texture;
      if(kind==='normal')mat.normalMap=texture;
      if(kind==='roughness')mat.roughnessMap=texture;
      if(kind==='ao'){mat.aoMap=texture;mat.aoMapIntensity=.35;}
      if(kind==='height'&&(name==='rock'||name==='stone')){mat.displacementMap=texture;mat.displacementScale=name==='rock'?.22:.035;mat.displacementBias=-mat.displacementScale*.5;}
      progress(++complete/25);
    }));
    mat.color.setHex(surfaceTint(name));
    mat.normalScale.setScalar(name==='rock'?1.15:.8);
    mat.needsUpdate=true;
  }));
  mats.scree=mats.rock.clone();mats.scree.vertexColors=false;mats.scree.color.setHex(0xb5aa95);
  return mats;
}

export async function updateTextureQuality(scene,quality){
  const fresh=await createMaterials(()=>{},{quality}),old=new Set(),changed=new Set();
  scene.traverse(object=>{
    const items=Array.isArray(object.material)?object.material:[object.material];
    for(const material of items){
      if(!material||changed.has(material))continue;
      const source=fresh[material.userData.textureSet];if(!source)continue;
      for(const key of ['map','normalMap','roughnessMap','aoMap','displacementMap']){if(material[key])old.add(material[key]);material[key]=source[key];}
      material.needsUpdate=true;changed.add(material);
    }
  });
  old.forEach(texture=>texture.dispose());
  Object.values(fresh).forEach(material=>material.dispose());
}
