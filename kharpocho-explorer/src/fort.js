import * as THREE from 'three';

// An interpreted ruin, informed by the DoAM inventory, Hakal's field photographs
// and the 1914 mosque photograph reproduced by Klimburg. No surveyed plan exists
// in this project: room positions and the shallow bastions are explicitly inferred.
export function createFort(materials) {
  const group = new THREE.Group(); group.name = 'fort'; group.position.set(500,155,0);
  const collisionWalls=[];
  let seed=174723;
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const range=(a,b)=>a+(b-a)*rnd();
  const buckets=new Map(), dummy=new THREE.Object3D(), color=new THREE.Color();
  const box=new THREE.BoxGeometry(1,1,1);
  const stoneShapes=Array.from({length:5},(_,k)=>{
    const g=new THREE.BoxGeometry(1,1,1,2,1,2),p=g.attributes.position;
    // Shared face vertices receive identical offsets; masonry has broken, uneven arrises.
    const warp=(x,y,z,s)=>Math.sin(x*17.4+y*32.2+z*27.8+k*5.31+s)*.105;
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);p.setXYZ(i,x+warp(x,y,z,1),y+warp(x,y,z,3),z+warp(x,y,z,6));}
    g.computeVertexNormals();return g;
  });
  const debrisGeometry=new THREE.DodecahedronGeometry(1,0);
  const woodMat=materials.timber;
  const darkWood=woodMat.clone();darkWood.color.multiplyScalar(.66);
  const paleWood=woodMat.clone();paleWood.color.multiplyScalar(1.15);
  const earthMat=materials.plaster;
  const ruinRock=(materials.scree??materials.rock).clone();ruinRock.vertexColors=false;
  const mortar=materials.plaster.clone();mortar.color.multiplyScalar(.71);
  const iron=new THREE.MeshStandardMaterial({color:0x332e25,roughness:.91,metalness:.32});
  const matList={stone:materials.stone,earth:earthMat,wood:woodMat,darkWood,paleWood,rock:ruinRock,dark:materials.dark,mortar,iron};
  function instance(kind,geom,pos,scale,rot=[0,0,0],tint=1){
    const key=kind+'_'+geom.uuid;
    if(!buckets.has(key))buckets.set(key,{kind,geom,items:[]});
    buckets.get(key).items.push({pos,scale,rot,tint});
  }
  function beam(pos,size,yaw=0,kind='wood'){instance(kind,box,pos,size,[0,yaw,0],range(.8,1.15));}
  function stone(pos,size,yaw=0,tint=range(.55,1.07)){instance('stone',stoneShapes[Math.floor(rnd()*5)],[pos[0],pos[1]+range(-.045,.045),pos[2]],size,[range(-.055,.055),yaw+range(-.065,.065),range(-.055,.055)],tint);}
  function mesh(geometry,material,name,pos){const m=new THREE.Mesh(geometry,material);m.name=name;m.castShadow=true;m.receiveShadow=true;if(pos)m.position.fromArray(pos);group.add(m);return m;}
  function rubble(x,z,n,radius=3,y=0){for(let i=0;i<n;i++){const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*radius,s=range(.14,.68);instance('rock',debrisGeometry,[x+Math.cos(a)*r,y+s*.35,z+Math.sin(a)*r],[s*range(.8,1.8),s*.55,s*range(.7,1.5)],[rnd()*2,rnd()*6,rnd()*2],range(.65,1.15));}}
  function crib(x,y,z,h,yaw=0){
    const c=Math.cos(yaw),s=Math.sin(yaw);
    for(let j=0;j<h/.42;j++){
      const yy=y+j*.42;
      if(j%2===0){for(const d of [-.42,.42])beam([x+s*d,yy,z+c*d],[1.13,.23,.22],yaw,'darkWood');}
      else for(const d of [-.43,.43])beam([x+c*d,yy,z-s*d],[.22,.23,1.08],yaw,'darkWood');
    }
  }

  // Per row voids produce real embrasures and gateways instead of black decals.
  function wall(a,b,{height=6,base=-2.6,thickness=2.3,broken=true,gate=false,slits=true,earth=true,name='rampart'}={}){
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length,yaw=-Math.atan2(dz,dx),nx=-uz,nz=ux;
    collisionWalls.push({a:[a[0]+500,a[1]],b:[b[0]+500,b[1]],bottom:155+base,top:155+height+.9,thickness:thickness+.55,gate});
    const wallGroup=new THREE.Group();wallGroup.name=name;group.add(wallGroup);
    const row=.43, cols=Math.ceil(length/1.25), tops=Array.from({length:cols+1},(_,i)=>height+(broken?Math.sin(i*.67)*.62+range(-.55,.28):range(-.12,.14)));
    const slitTs=[];if(slits)for(let t=6;t<length-4;t+=range(10,14))slitTs.push(t);
    for(let y=base;y<height+.75;y+=row){
      const voids=[];
      if(y>2.05&&y<3.85)for(const t of slitTs)voids.push([t-.16,t+.16]);
      if(gate&&y<4.65)voids.push([length*.5-2.25,length*.5+2.25]);
      voids.sort((c,d)=>c[0]-d[0]);
      let t=0;
      while(t<length-.08){
        let end=Math.min(length,t+range(.39,1.64));
        const hole=voids.find(v=>t<v[1]&&end>v[0]);
        if(hole){if(t>=hole[0]-.03){t=hole[1];continue;}end=hole[0];}
        const l=end-t;if(l<.12){t=end+.015;continue;}
        const centre=(t+end)*.5, cap=tops[Math.min(cols,Math.floor(centre/length*cols))];
        if(y+row*.5<cap){
          const batter=Math.max(0,(height-y)*.065),w=thickness+batter;
          instance('mortar',box,[a[0]+ux*centre,y+row*.46,a[1]+uz*centre],[l+.01,row+.015,Math.max(.25,w-.28)],[0,yaw,0],range(.82,1.02));
          stone([a[0]+ux*centre+nx*range(-.12,.12),y+row*.46,a[1]+uz*centre+nz*range(-.12,.12)],[l-.025,row*range(.65,1.16),w*range(.88,1.08)],yaw);
          // Individual inner/outer small facing stones prevent an ashlar appearance.
          if(rnd()<.24&&y>-.2){const side=rnd()<.5?-1:1;stone([a[0]+ux*centre+nx*(w*.5+.025)*side,y+.14,a[1]+uz*centre+nz*(w*.5+.025)*side],[l*.4,.19,.19],yaw,range(.72,1.08));}
        }
        t=end+.02;
      }
    }
    // Cator beams are interrupted at the doorway, with interlocking cribbage ends.
    for(const y of [.15,1.8,3.55,5.1]){
      if(y>height-.25)continue;
      for(let t=.2;t<length-.1;){
        let l=Math.min(range(3.2,5.8),length-t),c=t+l*.5;
        if(gate&&y<4.65&&Math.abs(c-length*.5)<l*.5+2.3){t=length*.5+2.3;continue;}
        for(const side of [-1,1])beam([a[0]+ux*c+nx*(thickness*.5+.06)*side,y,a[1]+uz*c+nz*(thickness*.5+.06)*side],[l,.17,.22],yaw,'darkWood');
        t+=l+.13;
      }
    }
    if(earth){
      for(let t=1;t<length-1;t+=range(2.8,3.8)){
        if(gate&&Math.abs(t-length*.5)<3)continue;
        const h=tops[Math.min(cols,Math.floor(t/length*cols))];
        if(rnd()<.14)continue;
        // Low irregular earthen merlons, characteristic adobe parapet fabric.
        instance('earth',stoneShapes[Math.floor(rnd()*5)],[a[0]+ux*t,h+.38,a[1]+uz*t],[range(1.4,2.1),range(.6,.95),thickness*.65],[range(-.02,.02),yaw,range(-.02,.02)],range(.76,1.08));
      }
    }
    for(const t of [.5,length-.5])crib(a[0]+ux*t,0,a[1]+uz*t,Math.min(4.5,height),yaw);
    return {length,height};
  }

  // The asymmetric, elongated enclosure wraps the natural eastern shoulder.
  const footprint=[[-61,-29],[55,-26],[64,17],[45,34],[0,35],[-57,30],[-66,5]];
  wall(footprint[0],footprint[1],{height:6.6,name:'north-cator-rampart'});
  wall(footprint[1],footprint[2],{height:5.8,name:'east-rock-rampart'});
  wall(footprint[2],footprint[3],{height:5.35});
  // South entrance is centred at x=0; split the adjoining wall to preserve its opening.
  wall([45,34],[5,35],{height:6.25,name:'south-east-rampart'});
  wall([-5,35],[-57,30],{height:6.7,name:'south-west-rampart'});
  wall(footprint[5],footprint[6],{height:5.4,slits:false});
  wall(footprint[6],footprint[0],{height:5.85,slits:false});
  wall([-5,35],[5,35],{height:6.7,gate:true,slits:false,name:'main-gateway'});
  // These low, broad wall projections follow the enclosure; their distribution is interpretive.
  const bastions=[[-57,-28,Math.PI],[-21,-28,Math.PI],[23,-27,Math.PI],[58,-17,-Math.PI*.5],[59,21,-.7],[35,34,0],[-45,31,0]];
  for(let k=0;k<bastions.length;k++){
    const [cx,cz,axis]=bastions[k],r=range(3.5,4.3),height=range(5.3,6.7);
    for(let y=-2;y<height;y+=.48){
      const rr=r+(height-y)*.08,n=Math.ceil(Math.PI*rr/1.05);
      for(let i=0;i<n;i++){
        const a=axis+i/n*Math.PI,b=axis+(i+1)/n*Math.PI,mid=(a+b)/2;
        if(y>2.2&&y<3.8&&(i===Math.floor(n*.4)||i===Math.floor(n*.72)))continue;
        if(y>height-.45&&rnd()<.12)continue;
        stone([cx+Math.cos(mid)*rr,y+.22,cz+Math.sin(mid)*rr],[(b-a)*rr*.96,.42,1.65],-mid-Math.PI*.5);
      }
    }
    for(let a=0;a<Math.PI;a+=.62){const m=axis+a;instance('earth',stoneShapes[k%5],[cx+Math.cos(m)*r,height+.33,cz+Math.sin(m)*r],[1.3,.75,1.1],[0,-m,0],range(.8,1.05));}
    for(const y of [1.7,3.5,5.0])for(let a=0;a<Math.PI;a+=.3){const m=axis+a+.15;beam([cx+Math.cos(m)*(r+.17),y,cz+Math.sin(m)*(r+.17)],[r*.31,.17,.2],-m-Math.PI*.5,'darkWood');}
  }

  // Uneven court: broken rock paving rests within the hill, never on a platform.
  for(let i=0;i<340;i++){
    const x=range(-57,57),z=range(-24,29);
    if((x<-36&&z<6&&z>-17)||(x>14&&x<44&&z>9&&z<26))continue;
    const y=-.38+Math.sin(x*.14)*.13+Math.cos(z*.21)*.09;
    stone([x,y,z],[range(.65,1.9),range(.15,.28),range(.5,1.4)],range(-.7,.7),range(.66,.98));
  }
  for(let i=0;i<110;i++){const x=range(-61,61),z=range(-24,28);if((Math.abs(x)<6&&z>20)||(Math.abs(x+3)<7&&Math.abs(z+2)<5))continue;instance('rock',debrisGeometry,[x,-.22,z],[range(.6,3.8),range(.35,1.3),range(.8,3.1)],[rnd()*.4,rnd()*6,rnd()*.4],range(.65,1.0));}
  const courtRock=new THREE.PlaneGeometry(70,40,90,50);courtRock.rotateX(-Math.PI/2);
  const cp=courtRock.attributes.position,cu=courtRock.attributes.uv;
  for(let i=0;i<cp.count;i++){const x=cp.getX(i),z=cp.getZ(i);const edge=Math.max(0,1-Math.max(Math.abs(x)/35,Math.abs(z)/20));const pool=Math.hypot((x+3)/9,(z+2)/7);const relief=(Math.sin(x*.27+z*.11)*.35+Math.sin(x*.61-z*.23)*.22+Math.max(0,Math.sin(x*.14+z*.15))*1.7)*edge;cp.setY(i,-.55+(pool>1.4?relief:0));cu.setXY(i,x/6,z/6);}
  courtRock.computeVertexNormals();const courtMaterial=materials.rock.clone();courtMaterial.vertexColors=false;mesh(courtRock,courtMaterial,'Exposed fractured summit rock in courtyard');

  // Long low casemates along the northern wall, open to the courtyard.
  for(let bay=0;bay<8;bay++){
    const x=-42+bay*11.9;
    wall([x-5.55,-25],[x-5.55,-13.3],{height:range(2.8,4.4),thickness:1.0,slits:false,earth:false,name:'barracks-partition'});
    const complete=bay!==1&&bay!==5;
    if(complete){
      for(const side of [-1,1])beam([x+side*4.45,1.8,-13.3],[.45,3.8,.48],0,'darkWood');
      beam([x,3.7,-13.3],[10.0,.6,.62]);
      for(let z=-24.4;z<-13;z+=1.5)beam([x,3.9,z],[10.35,.32,.36]);
      for(let j=0;j<16;j++)beam([x-4.8+j*.63,4.12,-19],[.57,.18,11.3],0,'paleWood');
      mesh(new THREE.BoxGeometry(10.3,.22,11.4),earthMat,'dusty-earthen-barracks-roof',[x,4.3,-19]);
      // Shallow sagging roof deposits and exposed edges break the silhouette.
      for(let n=0;n<8;n++)stone([x+range(-4.6,4.6),4.48,-19+range(-5,5)],[range(.35,.7),.14,range(.3,.6)],rnd());
    }else{
      for(let j=0;j<5;j++)beam([x-4+j*1.8,range(1.1,2.3),-19],[.35,.35,range(3,10)],range(-.3,.3),'darkWood');
      rubble(x,-17,45,5.6);
    }
    // Low sleeping ledge and smaller storage recesses are inferred functional details.
    mesh(new THREE.BoxGeometry(8.8,.42,2.0),mortar,'barracks-stone-ledge',[x,.13,-23.3]);
  }
  wall([-48,-13],[-48,-25],{height:4.4,thickness:1.1,earth:false,slits:false});
  wall([53,-13],[53,-25],{height:4.2,thickness:1.1,earth:false,slits:false});

  // A modest hall wing, not an invented palace: broken flat roofs and small openings.
  wall([15,9],[46,9],{height:4.8,thickness:1.5,earth:false,name:'upper-hall-rear-wall'});
  wall([46,9],[46,25],{height:4.4,thickness:1.35,earth:false,slits:false});
  wall([15,9],[15,25],{height:3.1,thickness:1.3,earth:false,slits:false});
  wall([15,25],[24,25],{height:4.2,thickness:1.3,earth:false,slits:false});
  wall([29,25],[46,25],{height:4.9,thickness:1.3,earth:false,slits:true});
  wall([31,9],[31,24],{height:3.7,thickness:1.0,earth:false,slits:false});
  for(let i=0;i<8;i++)beam([33+i*1.7,4.72,17],[.32,.42,16.2]);
  mesh(new THREE.BoxGeometry(14.6,.28,15.8),earthMat,'partial-upper-hall-earth-roof',[38.6,5.05,17]);
  for(let i=0;i<20;i++)beam([32.2+i*.7,4.9,17],[.57,.16,15.8],0,'paleWood');
  for(let i=0;i<6;i++){const b=beam([19+i*1.9,range(1.3,3.6),17],[.3,.3,range(4.5,12.5)],range(-.6,.6),'darkWood');}
  for(const x of [24.3,28.7])beam([x,2.05,25],[.36,4.1,.42],0,'darkWood');
  beam([26.5,4.2,25],[5.2,.45,.5]);rubble(22,17,70,5.6);

  // Remaining low room outlines, with masonry collapsed along the natural court.
  wall([-22,9],[-10,9],{height:1.45,thickness:.9,earth:false,slits:false});
  wall([-22,9],[-22,22],{height:2.05,thickness:.9,earth:false,slits:false});
  wall([-22,22],[-13,22],{height:.85,thickness:.9,earth:false,slits:false});
  wall([-10,9],[-10,15],{height:1.05,thickness:.9,earth:false,slits:false});
  rubble(-19,15,70,7.5);rubble(46,-5,50,6);rubble(-55,21,60,5);

  // Small water-storage feature. Its use is documented; form and position are inferred.
  const poolX=-3,poolZ=-2,poolW=9.5,poolD=6.5;
  mesh(new THREE.BoxGeometry(poolW,.25,poolD),mortar,'cistern-dark-bed',[poolX,-.4,poolZ]);
  for(const z of [poolZ-poolD/2,poolZ+poolD/2])wall([poolX-poolW/2,z],[poolX+poolW/2,z],{height:.48,base:-.6,thickness:.7,earth:false,slits:false,broken:false});
  for(const x of [poolX-poolW/2,poolX+poolW/2])wall([x,poolZ-poolD/2],[x,poolZ+poolD/2],{height:.43,base:-.6,thickness:.7,earth:false,slits:false,broken:false});
  const water=mesh(new THREE.PlaneGeometry(poolW-1.0,poolD-1.0,16,10),materials.water,'shallow-courtyard-water',[poolX,-.17,poolZ]);water.rotation.x=-Math.PI/2;
  const wp=water.geometry.attributes.position;for(let i=0;i<wp.count;i++)wp.setZ(i,Math.sin(wp.getX(i)*2.2+wp.getY(i)*.6)*.015);water.geometry.computeVertexNormals();
  for(let i=0;i<7;i++)stone([poolX+poolW/2+1.5+i*.85,-.05,poolZ+1.7],[.8,.25,.7],range(-.2,.2));

  // Mosque: small timber pavilion with a lower level and an arcaded upper veranda.
  const mx=-46,mz=-4.5,ww=14.5,dd=13.0,fy=1.0;
  wall([mx-6.2,mz-5.4],[mx+6.2,mz-5.4],{height:fy,base:-3.5,thickness:1.0,slits:false,earth:false,name:'mosque-lower-stone-wall'});
  for(const x of [mx-6.1,mx+6.1])wall([x,mz-5],[x,mz+5.4],{height:fy,base:-3.7,thickness:.9,slits:false,earth:false});
  // Exposed lower timber rooms on the east side, recessed under the veranda.
  for(const z of [mz-5.3,mz-.2,mz+5.1]){
    beam([mx+6.5,-.7,z],[.44,3.5,.48],0,'darkWood');
    beam([mx+6.5,-2.35,z],[.4,.25,4.7],0,'darkWood');
  }
  mesh(new THREE.BoxGeometry(ww,.4,dd),darkWood,'mosque-upper-floor',[mx,fy,mz]);
  for(let i=0;i<24;i++)beam([mx-ww*.48+i*ww/24,fy+.25,mz],[ww/25,.13,dd*.96],0,'paleWood');
  const iy=fy+2.05;
  // A small central prayer chamber, around which the veranda remains open.
  for(const z of [mz-3.35,mz+3.35]){
    for(let x=mx-3.5;x<mx+3.5;x+=.39){
      if(z>mz&&Math.abs(x-mx)<1.1)continue;
      beam([x,iy,z],[.36,3.65,.22],0,rnd()<.3?'paleWood':'wood');
    }
  }
  for(const x of [mx-3.65,mx+3.65])for(let z=mz-3.4;z<mz+3.4;z+=.42){
    if(Math.abs(z-mz)<1.15)continue;
    beam([x,iy,z],[.23,3.65,.39]);
  }
  // Recessed lattice panels with genuine apertures.
  for(const side of [-1,1]){
    const x=mx+side*3.67;
    for(let j=0;j<8;j++)beam([x,iy+.25,mz-1.05+j*.3],[.15,1.6,.055],0,'darkWood');
    for(let j=0;j<6;j++)beam([x,iy-.48+j*.28,mz],[.15,.055,2.3],0,'darkWood');
    for(const z of [mz-1.25,mz+1.25])beam([x,iy,z],[.28,2.25,.2],0,'paleWood');
    for(const y of [iy-1.1,iy+1.1])beam([x,y,mz],[.28,.2,2.7],0,'paleWood');
  }
  const postTop=fy+4.1,outerX=[mx-6.8,mx-3.4,mx,mx+3.4,mx+6.8],outerZ=[mz-5.9,mz-2.95,mz,mz+2.95,mz+5.9];
  function archBetween(a,b,y,height=.95){
    const d=Math.hypot(b[0]-a[0],b[1]-a[1]),yaw=-Math.atan2(b[1]-a[1],b[0]-a[0]);
    const shape=new THREE.Shape();shape.moveTo(-d/2,0);shape.lineTo(-d/2,height);shape.lineTo(d/2,height);shape.lineTo(d/2,0);
    shape.bezierCurveTo(d*.32,.04,d*.20,height*.55,0,height*.77);shape.bezierCurveTo(-d*.20,height*.55,-d*.32,.04,-d/2,0);
    const geo=new THREE.ExtrudeGeometry(shape,{depth:.17,bevelEnabled:false,curveSegments:7});
    const m=mesh(geo,woodMat,'mosque-cusped-veranda-bracket',[(a[0]+b[0])/2,y,(a[1]+b[1])/2]);m.rotation.y=yaw;
  }
  for(const z of [mz-5.9,mz+5.9]){
    for(const x of outerX){beam([x,fy+2.15,z],[.27,4.0,.3],0,'darkWood');beam([x,fy+.5,z],[.46,.25,.47]);beam([x,postTop-.2,z],[.58,.24,.55]);}
    for(let i=0;i<outerX.length-1;i++)archBetween([outerX[i],z],[outerX[i+1],z],fy+2.9,1.15);
    beam([mx,postTop,z],[ww+.2,.34,.4]);
  }
  for(const x of [mx-6.8,mx+6.8]){
    for(const z of outerZ.slice(1,-1)){beam([x,fy+2.15,z],[.27,4,.3],0,'darkWood');beam([x,postTop-.2,z],[.55,.24,.55]);}
    for(let i=0;i<outerZ.length-1;i++)archBetween([x,outerZ[i]],[x,outerZ[i+1]],fy+2.9,1.15);
    beam([x,postTop,mz],[.4,.34,dd+.3]);
  }
  // Low weathered panels retain portions of the carved veranda balustrade.
  for(let j=0;j<4;j++){
    const x=mx-5.1+j*3.4;
    if(j===2)continue;
    for(let n=0;n<9;n++)beam([x-1.25+n*.31,fy+.86,mz+5.9],[.09,.8,.15],0,'paleWood');
    beam([x,fy+1.3,mz+5.9],[3,.15,.2]);
  }
  // Broad roof eaves, thick stepped corbelling and damaged historic lantern frame.
  const roofY=postTop+.32;
  mesh(new THREE.BoxGeometry(16.2,.23,14.8),earthMat,'mosque-lower-earth-roof',[mx,roofY,mz]);
  for(let i=0;i<6;i++){
    const w=11.0-i*.47,d=10.6-i*.45,y=roofY+.27+i*.24;
    beam([mx,y,mz-d/2],[w,.2,.36],0,i%2?'darkWood':'wood');beam([mx,y,mz+d/2],[w,.2,.36]);
    beam([mx-w/2,y,mz],[.36,.2,d]);beam([mx+w/2,y,mz],[.36,.2,d]);
    for(let j=0;j<9;j++){
      beam([mx-w*.44+j*w*.11,y,mz-d/2-.1],[.23,.18,.85],0,'darkWood');
      beam([mx-w*.44+j*w*.11,y,mz+d/2+.1],[.23,.18,.85],0,'darkWood');
    }
  }
  mesh(new THREE.BoxGeometry(8.5,.34,8.0),earthMat,'mosque-heavy-upper-roof',[mx,roofY+1.76,mz]);
  for(let j=0;j<13;j++)beam([mx-3.7+j*.6,roofY+1.98,mz],[.43,.18,8.1],range(-.025,.025),'paleWood');
  const ly=roofY+2.1;
  for(const x of [mx-1.45,mx+1.45])for(const z of [mz-1.35,mz+1.35])beam([x,ly+1.0,z],[.23,2.15,.24],0,'darkWood');
  for(const z of [mz-1.35,mz+1.35])beam([mx,ly+2.05,z],[3.3,.23,.24],0,'darkWood');
  beam([mx-1.45,ly+2.05,mz],[.23,.24,2.9]);
  // One absent upper beam preserves the broken, open roof condition in the old photo.
  for(let k=0;k<18;k++)stone([mx+range(-7.5,7.5),roofY+.22,mz+range(-6.5,6.5)],[range(.25,.7),.16,range(.2,.6)],rnd());
  for(let j=0;j<6;j++)stone([mx+8.5+j*.6,fy-.35-j*.17,mz+5.3],[1.25,.36,2.3],0);
  rubble(mx+7,mz-5,35,3.3,fy-1.8);

  // The aged timber gate has a carved cusped opening and partially open plank doors.
  const gx=0,gz=36.0;
  for(const x of [-2.55,2.55]){beam([x,2.5,gz],[.58,5.0,.65],0,'darkWood');beam([x,2.45,gz+.38],[.32,4.8,.23],0,'paleWood');}
  beam([gx,5.05,gz],[6.05,.66,.8],0,'darkWood');beam([gx,5.45,gz],[6.25,.26,.86]);
  // Timber spandrel around an ogee-like cusped aperture; the centre is open geometry.
  const gateShape=new THREE.Shape();gateShape.moveTo(-2.3,3.45);gateShape.lineTo(-2.3,4.85);gateShape.lineTo(2.3,4.85);gateShape.lineTo(2.3,3.45);
  gateShape.bezierCurveTo(1.95,3.4,2.02,3.88,1.61,3.8);gateShape.bezierCurveTo(1.15,3.72,1.5,4.23,1.05,4.15);gateShape.bezierCurveTo(.6,4.1,.54,4.35,0,4.65);gateShape.bezierCurveTo(-.54,4.35,-.6,4.1,-1.05,4.15);gateShape.bezierCurveTo(-1.5,4.23,-1.15,3.72,-1.61,3.8);gateShape.bezierCurveTo(-2.02,3.88,-1.95,3.4,-2.3,3.45);
  mesh(new THREE.ExtrudeGeometry(gateShape,{depth:.37,bevelEnabled:true,bevelThickness:.025,bevelSize:.03,bevelSegments:1}),woodMat,'carved-gateway-spandrels',[0,0,gz+.03]);
  // Lotus rosettes and incised pentagonal motifs occur in Hakal's description.
  for(const x of [-2.55,2.55]){
    for(const y of [.55,4.35]){
      const petalShape=new THREE.Shape();petalShape.moveTo(0,-.19);petalShape.quadraticCurveTo(.16,.04,0,.28);petalShape.quadraticCurveTo(-.16,.04,0,-.19);
      const pg=new THREE.ExtrudeGeometry(petalShape,{depth:.035,bevelEnabled:false,curveSegments:5});
      for(let p=0;p<7;p++){const m=mesh(pg,paleWood,'lotus-carving',[x,y,gz+.51]);m.rotation.z=p/7*Math.PI*2;}
    }
    for(let y=1.2;y<3.85;y+=.42){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.095,.018,3,5),paleWood);ring.name='pentagonal-timber-motif';ring.position.set(x,y,gz+.54);group.add(ring);
    }
  }
  function gateLeaf(side,angle){
    const leaf=new THREE.Group();leaf.name='aged-timber-gate-leaf';leaf.position.set(side*2.12,.1,gz-.1);leaf.rotation.y=angle;group.add(leaf);
    for(let i=0;i<6;i++){
      const plank=new THREE.Mesh(new THREE.BoxGeometry(.335,3.65-range(0,.09),.17),i%3===0?darkWood:woodMat);plank.position.set(-side*(.18+i*.35),1.85,0);plank.rotation.z=range(-.006,.006);plank.castShadow=true;leaf.add(plank);
    }
    for(const y of [.55,1.92,3.22]){
      const cross=new THREE.Mesh(new THREE.BoxGeometry(2.12,.16,.2),darkWood);cross.position.set(-side*1.06,y,.13);leaf.add(cross);
      const strap=new THREE.Mesh(new THREE.BoxGeometry(1.9,.055,.035),iron);strap.position.set(-side*1.04,y,.245);leaf.add(strap);
      for(let n=0;n<6;n++){const nail=new THREE.Mesh(new THREE.SphereGeometry(.035,5,4),iron);nail.position.set(-side*(.22+n*.32),y,.27);leaf.add(nail);}
    }
  }
  gateLeaf(-1,-Math.PI*.35);gateLeaf(1,Math.PI*.23);
  for(let i=0;i<7;i++)stone([0,-.27-i*.18,gz+.7+i*.83],[4.35-i*.1,.4,1.05],range(-.015,.015));
  for(const x of [-4.25,4.25]){wall([x,35],[x,39.5],{height:2.1,thickness:.8,slits:false,earth:false});rubble(x,39,18,1.8,-.8);}
  // Rubble at wall feet and broken timbers tell a quieter history than fantasy ruins.
  for(let i=0;i<200;i++){
    const x=range(-63,63),south=rnd()<.5,z=south?range(30,34):range(-28,-25);
    if(Math.abs(x)<5&&south)continue;
    const s=range(.12,.52);instance('rock',debrisGeometry,[x,s*.3-.3,z],[s*1.6,s*.6,s],[rnd()*3,rnd()*6,rnd()*3],range(.65,1.1));
  }

  // Material buckets keep thousands of actual 3D blocks to a few dozen draw calls.
  let stoneCount=0,totalInstances=0,triangles=0;
  for(const {kind,geom,items} of buckets.values()){
    const im=new THREE.InstancedMesh(geom,matList[kind],items.length);im.name=kind==='stone'?'individual-irregular-masonry':'instanced-'+kind;
    for(let i=0;i<items.length;i++){
      const d=items[i];dummy.position.fromArray(d.pos);dummy.scale.fromArray(d.scale);dummy.rotation.set(...d.rot);dummy.updateMatrix();im.setMatrixAt(i,dummy.matrix);
      color.setRGB(d.tint,d.tint*.98,d.tint*.94);im.setColorAt(i,color);
    }
    im.castShadow=true;im.receiveShadow=true;im.computeBoundingSphere();group.add(im);
    totalInstances+=items.length;if(kind==='stone')stoneCount+=items.length;
    triangles+=(geom.index?geom.index.count:geom.attributes.position.count)/3*items.length;
  }
  group.userData={historicalStatus:'Historically informed reconstruction; footprint, dimensions, bastion arrangement and missing room fabric interpreted, not measured.',sources:['https://doam.gov.pk/public/sites/8178','https://iris.unive.it/retrieve/0eb1024b-0923-4037-833f-fbe5a03c9976/14-13-PB.pdf','https://s3.amazonaws.com/media.archnet.org/system/publications/contents/4874/original/DPC1587.pdf?1384787082=']};
  const hotspots=[
    {id:'gateway',title:'The timber threshold',position:[500,161,37],description:'A low wooden gateway and cator-laced masonry follow documented Balti construction. Carved floral and geometric motifs are described by Hakal; dimensions and the south-approach geometry are interpreted.',evidence:'Documented construction / Inferred geometry',source:'https://iris.unive.it/retrieve/0eb1024b-0923-4037-833f-fbe5a03c9976/14-13-PB.pdf'},
    {id:'mosque',title:'Panjtan Mosque',position:[454,164,-4],description:'The inventory records a two-level mosque with carved windows and doorframes. The open veranda, heavy corbelled roof and damaged lantern refer to the 1914 photograph; its placement and dimensions are inferred.',evidence:'Documented features / Inferred geometry',source:'https://s3.amazonaws.com/media.archnet.org/system/publications/contents/4874/original/DPC1587.pdf?1384787082='},
    {id:'barracks',title:'The lower casemates',position:[517,160,-20],description:'Lower tunnel-like military barracks are recorded by the Department of Archaeology. The bay arrangement, roof survival and sleeping ledges shown here are a spatial interpretation.',evidence:'Documented use / Inferred geometry',source:'https://doam.gov.pk/public/sites/8178'},
    {id:'courtyard',title:'Water in the courtyard',position:[497,157,-2],description:'A courtyard water pond is recorded in the official inventory. This modest reservoir is interpreted; neither its exact shape nor its position is established by a measured plan.',evidence:'Documented feature / Inferred geometry',source:'https://doam.gov.pk/public/sites/8178'},
  ];
  return {group,hotspots,collisionWalls,stats:{stoneCount,totalInstances,triangles:Math.round(triangles),bastions:7,interpretation:'Documented construction, inferred plan'}};
}
