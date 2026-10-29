import * as THREE from 'three';

// Metres in a local interpretive coordinate system: east +X, south +Z.
// The long Khardong bluff, higher eastern spike and lower fort shoulder are
// inferred from the cited whole-hill and elevated photographs, not a survey.
export const FORT_ORIGIN = Object.freeze({x:500,y:155,z:0});

const clamp=THREE.MathUtils.clamp;
const mix=THREE.MathUtils.lerp;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const ridge=[[-1080,0],[-1015,32],[-940,115],[-830,195],[-650,233],[-480,244],[-315,228],[-150,238],[5,235],[125,254],[220,300],[285,328],[325,313],[365,267],[410,207],[450,178],[500,160],[548,145],[590,102],[640,38],[705,0]];
const halfWidths=[[-1080,8],[-1000,85],[-850,170],[-650,240],[-400,267],[-100,260],[150,247],[300,228],[410,200],[500,166],[580,138],[640,80],[705,2]];

function profile(points,x){
  if(x<=points[0][0])return points[0][1];
  for(let i=1;i<points.length;i++)if(x<=points[i][0]){
    const t=(x-points[i-1][0])/(points[i][0]-points[i-1][0]);
    return mix(points[i-1][1],points[i][1],t*t*(3-2*t));
  }
  return points[points.length-1][1];
}
function hash(x,z){let h=Math.imul(x,374761393)+Math.imul(z,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;}
function noise(x,z){
  const a=Math.floor(x),b=Math.floor(z),u=x-a,v=z-b;
  const s=u*u*(3-2*u),t=v*v*(3-2*v);
  return mix(mix(hash(a,b),hash(a+1,b),s),mix(hash(a,b+1),hash(a+1,b+1),s),t)*2-1;
}
function fractal(x,z){return noise(x,z)*.57+noise(x*2.07+12,z*2.07-7)*.27+noise(x*4.19-3,z*4.19+19)*.11+noise(x*8.31,z*8.31)*.05;}
function rand(seed=4759){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function ridgeZ(x){return -17+noise(x*.004,7)*19+Math.sin(x*.007)*11;}

function bareHeight(x,z){
  if(x<-1080||x>705)return -2.3;
  const crest=profile(ridge,x),center=ridgeZ(x);
  const width=profile(halfWidths,x)*(z<center?.91:1.14);
  // A broken, asymmetric rim supplies the broad bluff, rather than a radial cone.
  const edgeWarp=(noise(x*.024,z*.011)*12+noise(x*.071,z*.028)*3)*smooth(0,50,crest);
  const t=Math.abs(z-center)/(Math.max(12,width)+edgeWarp);
  if(t>=1.105)return -2.3;
  const q=clamp(t,0,1);
  const cross=Math.pow(Math.max(0,1-Math.pow(q,1.22)),.63);
  let h=crest*cross;
  // Geometric ribs descend as distinct fins, separated by eroded slot gullies.
  const footFade=smooth(0,35,h),crestFade=smooth(0,.26,q);
  const fold=Math.abs(Math.sin(x*.089+z*.025+noise(x*.022,z*.018)*7.2));
  const fold2=Math.abs(Math.sin(x*.174-z*.041+noise(x*.039,z*.021)*1.3));
  const ribs=(fold*.74+fold2*.26-.41)*(17+crest*.045)*crestFade;
  const fractures=fractal(x*.047,z*.049)*(6.2+crest*.045)+fractal(x*.145,z*.126)*3.9;
  const strata=Math.sin(h*.29+x*.008)*1.05+Math.sin(h*.087+x*.014)*1.5;
  h+=(ribs+fractures+strata)*footFade;
  // Deep transverse faults interrupt the crest and avoid a regular extrusion.
  for(const [cx,cz,depth,wx,wz] of [[-740,-47,20,23,140],[-390,36,25,19,122],[-75,-55,24,28,145],[174,19,19,15,104],[356,48,18,14,90]]){
    h-=depth*Math.exp(-(((x-cx)/wx)**2+((z-cz)/wz)**2))*footFade;
  }
  // The pale river-facing scree chute visible beside the eastern spike.
  const chuteX=204+(z+20)*.69;
  const chute=Math.exp(-(((x-chuteX)/48)**2))*smooth(-5,-130,z)*smooth(-250,-180,z);
  h-=chute*13;
  // Low talus aprons continue beyond the cliffs to the natural alluvial base.
  if(t>1){h=mix(6*(1-(t-1)/.105),-2.3,smooth(1,1.105,t));}
  return Math.max(-2.3,h);
}

function naturalHeight(x,z){
  let h=bareHeight(x,z);
  // A rock shoulder is integrated into the eastern massif. The walled area
  // occupies this naturally stepped ledge; there is no separate platform mesh.
  const dx=Math.abs(x-500),dz=Math.abs(z);
  const shoulder=1-Math.max(smooth(65,112,dx),smooth(38,84,dz));
  if(shoulder>0){
    const ledge=154.62+.16*noise(x*.22,z*.2)+.12*Math.sin(x*.17+z*.13);
    h=mix(h,ledge,shoulder);
  }
  return h;
}

// Establish the ascent along successively higher contours. Survey-free path
// alignment is interpretive, but grades and the final gateway are coherent.
const approachLine=[];
for(let i=0;i<=470;i++){
  const t=i/470,x=500+Math.sin(t*Math.PI*10)*60*(1-.25*t);
  const ascent=t+Math.sin(t*Math.PI*20)/(Math.PI*20),target=3+151.4*ascent;
  let z=325;
  for(;z>30;z-=1.5)if(naturalHeight(x,z)>=target)break;
  let lo=z,hi=z+1.5;
  for(let k=0;k<8;k++){const mid=(lo+hi)/2;if(naturalHeight(x,mid)>=target)lo=mid;else hi=mid;}
  approachLine.push({x,z:(lo+hi)/2,y:target});
}
// Smooth small contour irregularities, preserving the five broad traverses.
const unsmoothed=approachLine.map(p=>({...p}));
for(let i=0;i<approachLine.length;i++){
  let x=0,z=0,n=0;
  for(let j=Math.max(0,i-4);j<=Math.min(470,i+4);j++){x+=unsmoothed[j].x;z+=unsmoothed[j].z;n++;}
  approachLine[i].x=x/n;approachLine[i].z=z/n;
}
for(let i=0;i<24;i++){
  const t=i/23,p=approachLine[447+i];
  p.x=mix(p.x,500,smooth(0,1,t));p.z=mix(p.z,36.7,smooth(0,1,t));p.y=mix(p.y,154.65,smooth(0,1,t));
}
const first=approachLine[0];
approachLine.unshift({x:405,z:303,y:-1.9},{x:455,z:279,y:-1.6},{x:first.x,z:first.z+24,y:-1.1});
const pathCells=new Map(),cellSize=10;
for(let i=1;i<approachLine.length;i++){
  const a=approachLine[i-1],b=approachLine[i];
  for(let cx=Math.floor((Math.min(a.x,b.x)-5)/cellSize);cx<=Math.floor((Math.max(a.x,b.x)+5)/cellSize);cx++)
    for(let cz=Math.floor((Math.min(a.z,b.z)-5)/cellSize);cz<=Math.floor((Math.max(a.z,b.z)+5)/cellSize);cz++){
      const key=`${cx},${cz}`;if(!pathCells.has(key))pathCells.set(key,[]);pathCells.get(key).push(i);
    }
}
function nearestPath(x,z){
  const candidates=pathCells.get(`${Math.floor(x/cellSize)},${Math.floor(z/cellSize)}`);
  let distance=Infinity,y=0;
  if(candidates)for(const i of candidates){
    const a=approachLine[i-1],b=approachLine[i],dx=b.x-a.x,dz=b.z-a.z;
    const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1),d=Math.hypot(x-a.x-dx*t,z-a.z-dz*t);
    if(d<distance){distance=d;y=mix(a.y,b.y,t);}
  }
  return {distance,y};
}
export function heightAt(x,z){
  const h=naturalHeight(x,z);
  if(x<390||x>575||z<36||z>310)return h;
  const path=nearestPath(x,z);
  return path.distance<3.6?mix(h,path.y,1-smooth(.8,3.6,path.distance)):h;
}

function screeFactor(x,z){
  const diagonal=204+(z+20)*.69;
  return Math.exp(-(((x-diagonal)/48)**2))*smooth(-8,-135,z)*smooth(-265,-205,z);
}

function surfaceGeometry(nx,nz){
  const xmin=-1125,xmax=750,zmin=-322,zmax=350;
  const positions=new Float32Array((nx+1)*(nz+1)*3),uvs=new Float32Array((nx+1)*(nz+1)*2),colors=new Float32Array((nx+1)*(nz+1)*3);
  const indices=new Uint32Array(nx*nz*6);
  let vi=0,ui=0;
  const color=new THREE.Color();
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    let x=mix(xmin,xmax,i/nx),z=mix(zmin,zmax,j/nz);
    // Stagger the sample lattice gently so fractures do not align to a grid.
    if(i>0&&i<nx&&j>0&&j<nz){x+=noise(i*.75,j*.77)*(xmax-xmin)/nx*.2;z+=noise(i*.81+7,j*.69)*(zmax-zmin)/nz*.2;}
    const y=heightAt(x,z),geology=fractal(x*.016,z*.019),scree=screeFactor(x,z);
    positions[vi]=x;positions[vi+1]=y;positions[vi+2]=z;
    // Texture supplies the mineral palette; these restrained tints add geology.
    color.setRGB(.86+geology*.075,.85+geology*.065,.82+geology*.055);
    if(scree>.02)color.lerp(new THREE.Color(.98,.94,.84),scree*.72);
    if(y<12)color.lerp(new THREE.Color(.94,.89,.80),.35);
    colors[vi]=color.r;colors[vi+1]=color.g;colors[vi+2]=color.b;vi+=3;
    uvs[ui++]=x/24;uvs[ui++]=z/24+y/35;
  }
  let ii=0;
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const a=j*(nx+1)+i,b=a+nx+1;
    if(Math.max(positions[a*3+1],positions[(a+1)*3+1],positions[b*3+1],positions[(b+1)*3+1])<-.8)continue;
    // Alternate diagonals reduce visible directional triangulation.
    if((i+j)%2){indices[ii++]=a;indices[ii++]=b;indices[ii++]=b+1;indices[ii++]=a;indices[ii++]=b+1;indices[ii++]=a+1;}
    else{indices[ii++]=a;indices[ii++]=b;indices[ii++]=a+1;indices[ii++]=a+1;indices[ii++]=b;indices[ii++]=b+1;}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geo.setAttribute('uv1',new THREE.BufferAttribute(uvs.slice(),2));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.setIndex(new THREE.BufferAttribute(indices.slice(0,ii),1));geo.computeVertexNormals();geo.computeBoundingSphere();
  return geo;
}

function fracturedRockGeometry(detail=1){
  const g=new THREE.IcosahedronGeometry(1,detail),p=g.attributes.position,c=[],uv=[];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=1+noise(x*5.3+19,z*5.8+y*2)*.18;
    p.setXYZ(i,x*r,(y*.8+Math.abs(x)*.12)*r,z*r);
    uv.push(x*.37+z*.22,y*.45+z*.18);c.push(.89,.88,.85);
  }
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('uv1',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.computeVertexNormals();return g;
}

function makeRockInstances(material,count,sizeRange,name,seed,onApron=false){
  const random=rand(seed),dummy=new THREE.Object3D(),color=new THREE.Color();
  const mesh=new THREE.InstancedMesh(fracturedRockGeometry(onApron?0:1),material,count);
  mesh.name=name;let n=0,tries=0;
  while(n<count&&tries++<count*24){
    const x=-1070+random()*1770,z=-300+random()*635,y=heightAt(x,z);
    const fortKeepout=Math.abs(x-500)<78&&Math.abs(z)<48;
    if(fortKeepout)continue;
    if(onApron?(y>105||y<-1.8):(y<11||y>315))continue;
    const size=sizeRange[0]+Math.pow(random(),2.2)*(sizeRange[1]-sizeRange[0]);
    if(nearestPath(x,z).distance<size*.8+2.3)continue;
    const sx=size*(.75+random()*.7),sy=size*(.46+random()*.8),sz=size*(.6+random()*.8);
    dummy.position.set(x,y-sy*.72,z);dummy.scale.set(sx,sy,sz);
    dummy.rotation.set((random()-.5)*.65,random()*Math.PI*2,(random()-.5)*.6);dummy.updateMatrix();mesh.setMatrixAt(n,dummy.matrix);
    const tint=.82+random()*.18;color.setRGB(tint,tint*.985,tint*.95);mesh.setColorAt(n,color);n++;
  }
  mesh.count=n;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.castShadow=!onApron;mesh.receiveShadow=true;mesh.computeBoundingSphere();return mesh;
}

function approach(material){
  const count=approachLine.length-1,width=1.55,positions=[],uv=[],idx=[],points=[];
  for(let i=0;i<=count;i++){
    const p=approachLine[i],previous=approachLine[Math.max(0,i-1)],next=approachLine[Math.min(count,i+1)];
    const tangent=new THREE.Vector3(next.x-previous.x,0,next.z-previous.z).normalize(),perp=new THREE.Vector3(tangent.z,0,-tangent.x);
    const y=heightAt(p.x,p.z)+.20;points.push(new THREE.Vector3(p.x,y+.45,p.z));
    const w=width*(.9+.12*Math.sin(i*.63));
    for(const side of [-1,1]){
      const x=p.x+perp.x*w*.5*side,z=p.z+perp.z*w*.5*side;
      positions.push(x,heightAt(x,z)+.36,z);uv.push(i*.18,(side+1)*.5);
    }
    if(i<count){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('uv1',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
  const mat=material.clone();mat.color.setHex(0xb9aa8d);mat.polygonOffset=true;mat.polygonOffsetFactor=-2;mat.polygonOffsetUnits=-2;mat.side=THREE.DoubleSide;
  const mesh=new THREE.Mesh(g,mat);mesh.name='Southern climbing approach · interpretive switchback alignment';mesh.receiveShadow=true;
  return {mesh,points};
}

export function createTerrain(materials,{quality='high'}={}){
  const group=new THREE.Group();group.name='mountain';
  const mountainMeshes=[],lod=new THREE.LOD();lod.name='Khardong complete massif · distance LOD';
  const highGeo=surfaceGeometry(700,240),lowGeo=surfaceGeometry(300,100);
  const high=new THREE.Mesh(highGeo,materials.rock),low=new THREE.Mesh(lowGeo,materials.rock);
  for(const mesh of [high,low]){mesh.castShadow=true;mesh.receiveShadow=true;}
  high.name=`Fractured Khardong massif · ${highGeo.index.count/3} triangles`;low.name=`Khardong massif · ${lowGeo.index.count/3} triangles`;
  // The LOD's origin is at the massif centre; close architecture keeps full detail.
  lod.addLevel(high,0);lod.addLevel(low,quality==='low'?850:3200);group.add(lod);mountainMeshes.push(high,low);
  const crags=makeRockInstances(materials.rock,quality==='low'?1150:2600,[1.4,7.8],'Embedded fractured rock fins and outcrops',5082);
  const debris=makeRockInstances(materials.scree,quality==='low'?2800:9500,[.13,1.9],'Talus aprons · loose stones and angular debris',6179,true);
  const boulders=makeRockInstances(materials.rock,quality==='low'?650:1500,[.5,3.1],'Slope rubble · weathered cliff fragments',9851);
  group.add(crags,debris,boulders);
  const path=approach(materials.sand);group.add(path.mesh);
  const summit=new THREE.Vector3(282,heightAt(282,ridgeZ(282)),ridgeZ(282));
  // The inventory records watchtower remains above the main fort. Only a low
  // broken square footing is interpreted here; no lost tower height is asserted.
  const tower=new THREE.Group();tower.name='Higher ridge watchtower footing · inferred surviving geometry';
  const towerMaterial=materials.stone.clone();towerMaterial.color.multiplyScalar(.85);
  const towerStone=new THREE.BoxGeometry(1,.42,.65),towerRandom=rand(1984);
  for(const side of [0,1,2,3])for(let j=0;j<5;j++){
    const x=summit.x+(side<2?j-2:(side===2?-2:2));
    const z=summit.z+(side<2?(side===0?-2:2):j-2);
    const foundation=heightAt(x,z)-.5,rows=2+Math.floor(towerRandom()*4);
    for(let row=0;row<rows;row++){
      if(side===1&&j===2&&row<3)continue;
      const stone=new THREE.Mesh(towerStone,towerMaterial);stone.position.set(x,foundation+row*.40,z);stone.rotation.y=side<2?0:Math.PI/2;stone.scale.set(.88+towerRandom()*.17,1,.9+towerRandom()*.17);stone.castShadow=stone.receiveShadow=true;tower.add(stone);
    }
  }
  group.add(tower);
  const stats={highTriangles:highGeo.index.count/3,lowTriangles:lowGeo.index.count/3,instancedRocks:crags.count+debris.count+boulders.count,rockOutcrops:crags.count,looseDebris:debris.count+boulders.count,pathLength:Math.round(path.points.reduce((sum,p,i)=>i?sum+p.distanceTo(path.points[i-1]):0,0)),extentMetres:[1875,672],maxReliefMetres:Math.round(summit.y),survey:false};
  group.userData={...stats,interpretation:'Photo-guided natural massif; approximate scale and unseen slopes. No measured DEM, survey or photogrammetric reconstruction.',coordinates:'X east, Z south, Y up; relative metres'};
  return {group,mountainMeshes,pathPoints:path.points,summit,stats};
}
