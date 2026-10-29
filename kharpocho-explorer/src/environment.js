import * as THREE from 'three';

function random(seed=974) { return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}; }
export function createEnvironment(materials) {
  const group=new THREE.Group();group.name='Skardu valley · interpretive context';
  const rand=random(), dummy=new THREE.Object3D();
  const groundGeo=new THREE.PlaneGeometry(18000,14000,160,120);groundGeo.rotateX(-Math.PI/2);
  const p=groundGeo.attributes.position, uv=groundGeo.attributes.uv;
  for(let i=0;i<p.count;i++) { const x=p.getX(i),z=p.getZ(i); p.setY(i,-2.7+Math.sin(x*.003)*Math.cos(z*.004)*1.1);uv.setXY(i,x/90,z/90); }
  groundGeo.computeVertexNormals();
  const ground=new THREE.Mesh(groundGeo,materials.sand);ground.receiveShadow=true;ground.name='Alluvial valley floor';group.add(ground);
  function ribbon(name,center,width,material,level) {
    const pos=[],uvs=[],indices=[],segments=280;
    for(let i=0;i<=segments;i++) {
      const x=-7000+i*14000/segments,z=center(x),w=width(x);
      for(const edge of [-1,1]){pos.push(x,level+Math.sin(x*.006)*.12,z+w*edge);uvs.push(x/80,(z+w*edge)/80);}
      if(i<segments){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,material);mesh.name=name;mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  const riverCenter=x=>-650+240*Math.sin(x/1300)+85*Math.sin(x/420);
  const wetSand=materials.sand.clone();wetSand.color.setHex(0x8b806c);wetSand.roughness=.8;
  ribbon('Indus · damp shoreline',riverCenter,x=>200+45*Math.sin(x/390),wetSand,-1.1);
  const river=ribbon('Indus · northern river channel',riverCenter,x=>164+33*Math.sin(x/440),materials.water,-.7);
  ribbon('Indus · braided secondary channel',x=>-330+45*Math.sin(x/480),x=>9+5*Math.sin(x/260),materials.water,-.65);
  // Freestanding natural banks; these are geographical context, not a survey of present channels.
  const bar=materials.sand.clone();bar.color.setHex(0xd4c8b1);
  ribbon('Pale alluvial sandbar',x=>-390+60*Math.sin(x/900),x=>40+22*Math.sin(x/420),bar,-.35);

  // Several real 3D mountain chains; no panorama plane or billboard backdrop.
  for(let ring=0;ring<3;ring++){
    const vertices=[],colors=[],uvs=[],idx=[],count=360,rows=28;
    const radius=7500+ring*2800;
    for(let j=0;j<=rows;j++) for(let i=0;i<=count;i++){
      const angle=i/count*Math.PI*2;
      const irregular=Math.sin(angle*13+ring)*.19+Math.sin(angle*29)*.10+Math.sin(angle*51)*.065;
      const peak=510+ring*180+(Math.sin(angle*7+2)+1)*190+(Math.sin(angle*19+ring)+1)*120;
      const t=j/rows;
      const rad=radius+(t-.5)*1900;
      const profile=Math.pow(Math.sin(t*Math.PI),1.15);
      const h=profile*peak*(1+irregular)+Math.sin(angle*71+t*5)*47*profile+Math.sin(angle*131-t*19)*22*profile-8;
      vertices.push(Math.cos(angle)*rad,h,Math.sin(angle)*rad);
      uvs.push(angle*180,h/38+t*17);
      const c=new THREE.Color(ring===0?0xa39a87:ring===1?0xb6ab96:0xc8bda7);
      c.multiplyScalar(.83+.17*rand());colors.push(c.r,c.g,c.b);
      if(j<rows&&i<count){const a=j*(count+1)+i,b=a+count+1;idx.push(a,a+1,b,b,a+1,b+1);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(idx);geo.computeVertexNormals();
    const rangeMaterial=materials.rock.clone();rangeMaterial.color.setHex(0xd8cbb9);rangeMaterial.flatShading=true;
    const mesh=new THREE.Mesh(geo,rangeMaterial);mesh.name=`Distant barren range ${ring+1}`;mesh.receiveShadow=true;group.add(mesh);
  }
  const buildings=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0xb6aa93,roughness:1}),480);
  const roofs=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x8f8878,roughness:1}),480);
  for(let i=0;i<480;i++){
    const centers=[[-950,650],[-450,650],[100,610],[620,850],[1120,1000],[-1400,1120]],center=centers[Math.floor(i/80)];
    const x=center[0]+((i%10)-4.5)*21+(rand()-.5)*8,z=center[1]+(Math.floor(i/10)%8)*23+(rand()-.5)*8,h=3+rand()*5;
    dummy.position.set(x,h/2-2,z);dummy.scale.set(5+rand()*8,h,5+rand()*9);dummy.rotation.y=(rand()-.5)*.35;dummy.updateMatrix();buildings.setMatrixAt(i,dummy.matrix);
    dummy.position.y=h-1.8;dummy.scale.y=.35;dummy.scale.x*=1.07;dummy.scale.z*=1.07;dummy.updateMatrix();roofs.setMatrixAt(i,dummy.matrix);
  }
  buildings.name='Simplified Skardu settlement';roofs.name='Flat earthen valley rooftops';buildings.castShadow=true;buildings.receiveShadow=true;group.add(buildings,roofs);
  const trunkMat=materials.timber.clone(),leafMat=new THREE.MeshStandardMaterial({color:0x69705a,roughness:1});
  const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.22,.36,1,5),trunkMat,500);
  const leaves=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),leafMat,500);
  for(let i=0;i<500;i++){
    const x=(rand()-.5)*3800;
    const z=i<180?-260-rand()*90:450+rand()*1800;
    const h=4+rand()*9;
    dummy.position.set(x,h*.4-2,z);dummy.scale.set(1,h*.8,1);dummy.rotation.set(0,rand()*6.28,0);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
    dummy.position.y=h*.74-2;dummy.scale.set(1.1+rand()*1.4,h*.48,1.2+rand());dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
  }
  trunks.name='Sparse valley poplar trunks';leaves.name='Sparse muted poplar foliage';trunks.castShadow=leaves.castShadow=true;group.add(trunks,leaves);
  return {group,river};
}

export function createDust(){
  const positions=[],rnd=random(58);
  for(let i=0;i<230;i++)positions.push((rnd()-.5)*1700,20+rnd()*230,(rnd()-.5)*800);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const points=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xe2cfaa,size:.58,transparent:true,opacity:.17,depthWrite:false}));points.name='Wind-carried mineral dust';
  return points;
}
