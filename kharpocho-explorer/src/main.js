import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createMaterials,updateTextureQuality} from './materials.js';
import {createTerrain,heightAt} from './terrain.js';
import {createFort} from './fort.js';
import {createEnvironment,createDust} from './environment.js';
import {FreeExplore} from './free-explore.js';

const $=id=>document.getElementById(id);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile=matchMedia('(max-width: 768px)').matches;
const state={labels:false,golden:true,quality:mobile?'low':'high',tour:null,transition:null,ready:false,view:'mountain',navigation:'orbit',capture:false};
let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
function progress(f,message){$('load-progress').style.width=`${Math.round(f*100)}%`;$('load-status').textContent=message;}
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>button.closest('dialog').close());
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
$('notes-open').onclick=()=>$('notes-dialog').showModal();
$('about-open').onclick=()=>$('about-dialog').showModal();
function showControls(open){$('controls-panel').hidden=!open;$('controls-toggle').setAttribute('aria-expanded',String(open));if(!open)$('controls-toggle').focus();}
$('controls-toggle').onclick=()=>showControls($('controls-panel').hidden);
$('controls-close').onclick=()=>showControls(false);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('controls-panel').hidden)showControls(false);});

const presets={
  mountain:{position:[1600,540,1450],target:[-80,155,0],label:'The mountain stronghold',detail:'Khardong hill · the eastern shoulder of Skardu',index:1},
  fort:{position:[655,252,182],target:[496,158,0],label:'Stone, earth & timber',detail:'The enclosure · a historically informed interpretation',index:2},
  entrance:{position:[517,166,68],target:[500,158,36],label:'The fortified threshold',detail:'The southern approach · worn stone and carved timber',index:3},
  river:{position:[1100,310,-1250],target:[115,117,0],label:'Above the Indus',detail:'A rocky spur between the river and Skardu',index:4},
};
if(mobile){for(const name of ['mountain','river']){const p=presets[name],target=new THREE.Vector3().fromArray(p.target);p.position=new THREE.Vector3().fromArray(p.position).sub(target).multiplyScalar(1.8).add(target).toArray();}}

try{
  progress(.02,'Preparing light and atmosphere…');
  const canvas=$('scene');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:1.75));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xe9e4d8);scene.fog=new THREE.FogExp2(0xe9e4d8,mobile?.0001:.000145);
  const camera=new THREE.PerspectiveCamera(mobile?52:39,1,.5,17000);
  camera.position.fromArray(presets.mountain.position);
  const controls=new OrbitControls(camera,canvas);
  controls.target.fromArray(presets.mountain.target);controls.enableDamping=true;controls.dampingFactor=.065;
  controls.minDistance=3;controls.maxDistance=mobile?5000:4200;controls.maxPolarAngle=Math.PI*.995;
  controls.minPolarAngle=.005;controls.panSpeed=.7;controls.zoomSpeed=.7;controls.rotateSpeed=.5;controls.autoRotateSpeed=.25;controls.enablePan=true;
  controls.screenSpacePanning=true;
  controls.listenToKeyEvents(window);controls.keyPanSpeed=30;
  controls.addEventListener('start',()=>{endTour(false);state.transition=null;document.body.classList.add('is-exploring');});
  const flight=new FreeExplore(camera,canvas,{onStart:()=>{endTour(false);state.transition=null;}});
  const lookDirection=new THREE.Vector3();
  function setNavigation(mode){
    endTour(false);state.transition=null;controls.autoRotate=false;$('orbit-toggle').setAttribute('aria-pressed','false');
    if(mode==='orbit'&&flight.enabled){camera.getWorldDirection(lookDirection);controls.target.copy(camera.position).addScaledVector(lookDirection,80);}
    flight.setEnabled(mode==='flight');controls.enabled=mode==='orbit';state.navigation=mode;
    $('orbit-mode').setAttribute('aria-pressed',String(mode==='orbit'));$('flight-mode').setAttribute('aria-pressed',String(mode==='flight'));
    $('flight-pad').hidden=mode!=='flight';document.body.classList.toggle('is-flight',mode==='flight');
    $('navigation-help').textContent=mode==='flight'?'Drag to look around. W A S D to move, Q / E down / up, Shift for speed. Scroll moves forward or back. Two fingers slide sideways. Use the movement pad on touch screens.':'Drag to rotate 360°. Scroll or pinch to zoom. Right-drag or use two fingers to pan.';
    canvas.focus();
  }
  $('orbit-mode').onclick=()=>setNavigation('orbit');$('flight-mode').onclick=()=>setNavigation('flight');
  for(const button of document.querySelectorAll('[data-move]')){
    button.onpointerdown=event=>{event.preventDefault();button.setPointerCapture(event.pointerId);flight.keys.add(button.dataset.move);};
    const release=()=>flight.keys.delete(button.dataset.move);
    button.onpointerup=release;button.onpointercancel=release;button.onlostpointercapture=release;
  }
  for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('close',()=>canvas.focus());
  const hemi=new THREE.HemisphereLight(0xe2e8e4,0x908267,1.15);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffe0ad,4.0);sun.position.set(-700,450,900);sun.castShadow=true;
  sun.shadow.mapSize.set(mobile?2048:4096,mobile?2048:4096);
  sun.shadow.camera.left=-1400;sun.shadow.camera.right=1400;sun.shadow.camera.top=1100;sun.shadow.camera.bottom=-1100;sun.shadow.camera.near=20;sun.shadow.camera.far=3500;
  sun.shadow.bias=-.00018;sun.shadow.normalBias=.6;sun.shadow.radius=2.5;sun.target.position.set(0,90,0);scene.add(sun,sun.target);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const environment=pmrem.fromScene(new RoomEnvironment(),.04);scene.environment=environment.texture;scene.environmentIntensity=.23;pmrem.dispose();

  const materials=await createMaterials(f=>progress(.04+f*.49,'Reading stone, earth and timber…'),{quality:state.quality});
  progress(.57,'Reconstructing the fractured ridge…');
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const terrain=createTerrain(materials,{quality:state.quality});scene.add(terrain.group);
  progress(.72,'Placing the fort within the rock…');
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const fort=createFort(materials);scene.add(fort.group);
  const valley=createEnvironment(materials);scene.add(valley.group);
  const dust=createDust();scene.add(dust);
  scene.updateMatrixWorld(true);

  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  const ao=new GTAOPass(scene,camera,600,400,undefined,{radius:5,thickness:8,distanceExponent:1,distanceFallOff:1,scale:1},{radius:4,rings:2,samples:8});
  ao.blendIntensity=.32;ao.enabled=state.quality==='high';composer.addPass(ao);composer.addPass(new OutputPass());

  function resize(){
    const box=$('viewer').getBoundingClientRect();renderer.setSize(box.width,box.height,false);camera.aspect=box.width/box.height;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();composer.setSize(box.width,box.height);ao.setSize(Math.round(box.width*.7),Math.round(box.height*.7));
  }
  new ResizeObserver(resize).observe($('viewer'));resize();controls.update();

  const labels=[
    {id:'fort-landmark',title:'Kharpocho Fort',position:[530,173,0],view:'fort'},
    {id:'ridge-landmark',title:'Khardong ridge',position:[280,335,-20],view:'mountain'},
    {id:'river-landmark',title:'Indus River',position:[-260,2,-600],view:'river'},
    ...(fort.hotspots??[]).map(h=>({...h,view:'fort',close:true})),
  ];
  const labelItems=labels.map(label=>{
    const element=document.createElement('button');element.className='landmark-label';element.type='button';element.textContent=label.title;element.setAttribute('aria-label',`Explore ${label.title}`);
    element.onclick=()=>{if(label.close){setView('fort');toast(label.description??label.evidence??label.title);}else setView(label.view);};$('labels-layer').append(element);
    return{...label,element,point:new THREE.Vector3().fromArray(label.position)};
  });
  const v=new THREE.Vector3(),sample=new THREE.Vector3();
  function updateLabels(now){
    if(now%8!==0)return;
    const w=canvas.clientWidth,h=canvas.clientHeight,distance=camera.position.distanceTo(controls.target);
    for(const label of labelItems){
      const show=state.labels&&(label.close?distance<450:distance>120||label.id==='fort-landmark');
      v.copy(label.point).project(camera);
      let visible=show&&v.z>-1&&v.z<1&&Math.abs(v.x)<.94&&Math.abs(v.y)<.8;
      if(visible){
        for(let i=1;i<45;i++){sample.lerpVectors(camera.position,label.point,i/48);if(heightAt(sample.x,sample.z)>sample.y+1.4){visible=false;break;}}
      }
      label.element.hidden=!visible;
      if(visible){label.element.style.left=`${(v.x*.5+.5)*w}px`;label.element.style.top=`${(-v.y*.5+.5)*h}px`;}
    }
  }
  function activateView(name){
    state.view=name;
    document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('is-active',b.dataset.view===name);b.setAttribute('aria-pressed',String(b.dataset.view===name));});
    document.body.classList.toggle('is-close-view',name==='fort'||name==='entrance');
  }
  function setView(name,duration=2200){
    setNavigation('orbit');activateView(name);controls.autoRotate=false;$('orbit-toggle').setAttribute('aria-pressed','false');
    state.transition={start:performance.now(),duration:reduced?1:duration,from:camera.position.clone(),fromTarget:controls.target.clone(),to:new THREE.Vector3().fromArray(presets[name].position),toTarget:new THREE.Vector3().fromArray(presets[name].target)};
  }
  function endTour(notify=true){
    if(!state.tour)return;state.tour=null;$('tour-caption').hidden=true;$('tour-stop').hidden=true;controls.enabled=!flight.enabled;
    if(notify)toast('The landscape is yours to explore.');
  }
  const tourFrames=[
    {p:presets.mountain.position,t:presets.mountain.target,time:0,text:'An island of ancient rock in the Skardu valley.',view:'mountain'},
    {p:mobile?presets.river.position:[950,600,-1450],t:[-70,120,0],time:9,text:'The Indus follows the northern foot of Khardong hill.',view:'river'},
    {p:[680,490,-390],t:[200,230,0],time:17,text:'A higher ridge watches over the fort’s eastern shoulder.',view:'mountain'},
    {p:[665,254,185],t:[496,158,0],time:25,text:'Stone, earth and timber bind the walls to the mountain.',view:'fort'},
    {p:[517,166,68],t:[500,158,36],time:34,text:'The southern path reaches a low, fortified threshold.',view:'entrance'},
    {p:[640,220,160],t:[500,158,0],time:40,text:'Explore freely. Every view reveals another relationship.',view:'fort'},
  ];
  function beginTour(){
    setNavigation('orbit');showControls(false);
    if(reduced){setView('fort');toast('Reduced motion is enabled. Use the four views to explore.');return;}
    state.transition=null;controls.autoRotate=false;$('orbit-toggle').setAttribute('aria-pressed','false');
    state.tour={start:performance.now(),frames:tourFrames};controls.enabled=false;$('tour-caption').hidden=false;$('tour-stop').hidden=false;
    document.body.classList.add('is-exploring');
  }
  document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>setView(button.dataset.view));
  $('tour-play').onclick=beginTour;$('tour-stop').onclick=()=>endTour();
  $('reset').onclick=()=>{document.body.classList.remove('is-exploring');setView('mountain');};
  $('orbit-toggle').onclick=()=>{const rotate=!controls.autoRotate;if(flight.enabled)setNavigation('orbit');endTour(false);state.transition=null;controls.autoRotate=rotate;$('orbit-toggle').setAttribute('aria-pressed',String(controls.autoRotate));};
  $('labels-toggle').onclick=()=>{state.labels=!state.labels;$('labels-toggle').setAttribute('aria-pressed',String(state.labels));};
  $('light-toggle').onclick=()=>{
    state.golden=!state.golden;sun.color.setHex(state.golden?0xffe0ad:0xfff4df);sun.position.set(state.golden?-700:-350,state.golden?450:1200,state.golden?900:500);sun.intensity=state.golden?4.0:3.5;
    hemi.intensity=state.golden?1.15:1.8;scene.fog.color.setHex(state.golden?0xe9e4d8:0xe3e7e4);scene.background.copy(scene.fog.color);toast(state.golden?'Golden-hour light':'Clear daylight');
  };
  $('quality').value=state.quality;
  $('quality').onchange=async()=>{
    state.quality=$('quality').value;ao.enabled=state.quality==='high';renderer.setPixelRatio(Math.min(devicePixelRatio,state.quality==='high'?1.75:1));composer.setPixelRatio(renderer.getPixelRatio());
    terrain.group.traverse(o=>{if(o.isLOD){o.autoUpdate=state.quality==='high';if(o.levels[1])o.levels[1].distance=state.quality==='high'?3200:850;if(!o.autoUpdate){o.levels.forEach((l,i)=>l.object.visible=i===Math.min(1,o.levels.length-1));}}});resize();toast(state.quality==='high'?'Refining the surfaces…':'Preparing a lighter landscape…');
    $('quality').disabled=true;
    try{await updateTextureQuality(scene,state.quality);toast(state.quality==='high'?'High detail · ambient occlusion enabled':'Adaptive detail · lighter rendering');}catch{toast('Surface detail could not update. The landscape remains available.');}finally{$('quality').disabled=false;}
  };
  $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('viewer').requestFullscreen();}catch{toast('Fullscreen is unavailable in this browser panel.');}};
  $('capture').onclick=()=>state.capture=true;
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();toast('Rendering paused. Reload the page to restore the landscape.');});
  window.addEventListener('keydown',e=>{if(e.target.closest('dialog,select,input'))return;if(e.key==='Escape')endTour();if(e.key==='Home'){e.preventDefault();setView('mountain');}if(/^[1-4]$/.test(e.key))setView(Object.keys(presets)[+e.key-1]);if(e.key==='+'||e.key==='=')camera.position.lerp(controls.target,.1);if(e.key==='-')camera.position.sub(controls.target).multiplyScalar(1.1).add(controls.target);});

  // Baked material AO and GTAO complement actual cast shadows. Close views use a tighter shadow frustum.
  function focusShadows(){
    const close=camera.position.distanceTo(new THREE.Vector3(500,155,0))<500;
    const span=close?270:1400;sun.shadow.camera.left=-span;sun.shadow.camera.right=span;sun.shadow.camera.top=span;sun.shadow.camera.bottom=-span;
    sun.target.position.set(close?500:0,close?150:90,0);sun.position.set((state.golden?-700:-350)+(close?500:0),state.golden?450:1200,state.golden?900:500);sun.shadow.camera.updateProjectionMatrix();
  }
  const previousCamera=camera.position.clone();
  function avoidMasonry(){
    if(camera.position.distanceToSquared(new THREE.Vector3(500,155,0))>220*220)return;
    for(const wall of fort.collisionWalls??[]){
      if(camera.position.y<wall.bottom-1||camera.position.y>wall.top+1)continue;
      const dx=wall.b[0]-wall.a[0],dz=wall.b[1]-wall.a[1],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length,nx=-uz,nz=ux;
      const x=camera.position.x-wall.a[0],z=camera.position.z-wall.a[1],along=x*ux+z*uz;
      if(along<-.6||along>length+.6)continue;
      if(wall.gate&&Math.abs(along-length*.5)<1.65&&camera.position.y<159.2)continue;
      const dist=x*nx+z*nz,old=(previousCamera.x-wall.a[0])*nx+(previousCamera.z-wall.a[1])*nz,radius=wall.thickness*.5+1.1;
      if(Math.abs(dist)<radius||old*dist<0){const side=old>=0?1:-1;camera.position.x+=nx*(side*radius-dist);camera.position.z+=nz*(side*radius-dist);}
    }
  }
  let frame=0,last=performance.now(),fpsTime=0,fpsFrames=0;
  function animate(time){
    requestAnimationFrame(animate);const dt=Math.min((time-last)/1000,.05);last=time;frame++;
    if(state.tour){
      const elapsed=(time-state.tour.start)/1000;let i=0;while(i<tourFrames.length-2&&elapsed>tourFrames[i+1].time)i++;
      const a=tourFrames[i],b=tourFrames[i+1],u=THREE.MathUtils.clamp((elapsed-a.time)/(b.time-a.time),0,1),ease=u*u*(3-2*u);
      camera.position.lerpVectors(new THREE.Vector3().fromArray(a.p),new THREE.Vector3().fromArray(b.p),ease);controls.target.lerpVectors(new THREE.Vector3().fromArray(a.t),new THREE.Vector3().fromArray(b.t),ease);
      $('tour-caption').textContent=a.text;if(state.view!==a.view)activateView(a.view);
      if(elapsed>=40){activateView('fort');endTour();}
    }else if(state.transition){
      const a=state.transition,u=Math.min((time-a.start)/a.duration,1),ease=u*u*(3-2*u);
      camera.position.lerpVectors(a.from,a.to,ease);controls.target.lerpVectors(a.fromTarget,a.toTarget,ease);if(u>=1)state.transition=null;
    }
    previousCamera.copy(camera.position);
    if(flight.enabled&&!document.querySelector('dialog[open]'))flight.update(dt);else if(!flight.enabled)controls.update(dt);
    if(!state.tour&&!state.transition)avoidMasonry();
    const nearFort=Math.hypot(camera.position.x-500,camera.position.z)<135;
    const floor=heightAt(camera.position.x,camera.position.z)+(nearFort?1.75:6);
    if(camera.position.y<floor)camera.position.y=floor;
    if(frame%30===0)focusShadows();
    if(!reduced){dust.position.x=Math.sin(time*.000035)*50;dust.position.z=Math.sin(time*.00002)*10;}
    if(flight.enabled){camera.getWorldDirection(lookDirection);controls.target.copy(camera.position).addScaledVector(lookDirection,80);}
    updateLabels(frame);composer.render();
    if(state.capture){state.capture=false;const link=document.createElement('a');link.download=`kharpocho-${state.view}.png`;link.href=canvas.toDataURL('image/png');link.click();toast('View saved as a PNG photograph.');}
    fpsTime+=dt;fpsFrames++;if(fpsTime>3){const fps=fpsFrames/fpsTime;$('model-stats').textContent=`FULL 3D LANDSCAPE · ${state.quality==='high'?'HIGH DETAIL':'ADAPTIVE DETAIL'} · ${Math.round(fps)} FPS`;fpsTime=0;fpsFrames=0;}
  }
  progress(.94,'Opening the mountain…');
  composer.render();
  state.ready=true;
  $('loading').classList.add('is-complete');setTimeout(()=>$('loading').hidden=true,800);
  setTimeout(()=>$('interaction-hint').classList.add('is-dismissed'),6500);
  // Read-only diagnostics make delivered geometry and loading status inspectable.
  window.kharpocho={scene,camera,renderer,terrain,fort,state,flight,controls,version:'1.1.0',presets};
  requestAnimationFrame(animate);
}catch(error){console.error(error);$('loading').hidden=true;$('error').hidden=false;$('error').querySelector('p').textContent=`The 3D landscape could not load. ${error.message}. Reload this page or download the reusable model below.`;}
