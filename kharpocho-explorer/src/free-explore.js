import {Euler, Vector3} from 'three';

// Drag-to-look works without pointer lock, including in embedded browsers.
export class FreeExplore {
  constructor(camera, canvas, {onStart=()=>{}}={}) {
    this.camera=camera; this.canvas=canvas; this.onStart=onStart;
    this.enabled=false; this.keys=new Set(); this.pointers=new Map();
    this.yaw=0; this.pitch=0; this.speed=55;
    this.forward=new Vector3(); this.right=new Vector3(); this.motion=new Vector3();
    this.euler=new Euler(0,0,0,'YXZ');
    canvas.addEventListener('pointerdown',event=>{
      if(!this.enabled)return;
      event.preventDefault(); canvas.focus(); this.onStart();
      this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove',event=>{
      if(!this.enabled||!this.pointers.has(event.pointerId))return;
      const old=this.pointers.get(event.pointerId),dx=event.clientX-old.x,dy=event.clientY-old.y;
      if(this.pointers.size>1||event.buttons===2){
        this.translate(-dx*.08,dy*.08,0);
      }else{
        this.yaw-=dx*.003; this.pitch=Math.max(-Math.PI*.495,Math.min(Math.PI*.495,this.pitch-dy*.003));
        this.orient();
      }
      this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    });
    for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,event=>this.pointers.delete(event.pointerId));
    canvas.addEventListener('wheel',event=>{
      if(!this.enabled)return; event.preventDefault(); this.onStart();
      const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?canvas.clientHeight:1);
      this.translate(0,0,-Math.sign(delta)*Math.min(Math.abs(delta)*.18,60));
    },{passive:false});
    canvas.addEventListener('contextmenu',event=>event.preventDefault());
    window.addEventListener('keydown',event=>{
      if(!this.enabled||event.target!==canvas||!['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight'].includes(event.code))return;
      event.preventDefault();this.keys.add(event.code);this.onStart();
    });
    window.addEventListener('keyup',event=>this.keys.delete(event.code));
    window.addEventListener('blur',()=>this.clearInput());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clearInput();});
  }
  clearInput(){this.keys.clear();this.pointers.clear();}
  setEnabled(enabled){
    this.enabled=enabled;this.clearInput();
    this.euler.setFromQuaternion(this.camera.quaternion,'YXZ');this.yaw=this.euler.y;this.pitch=this.euler.x;
  }
  orient(){this.camera.quaternion.setFromEuler(this.euler.set(this.pitch,this.yaw,0,'YXZ'));}
  translate(right,up,forward){
    this.camera.getWorldDirection(this.forward);
    this.right.crossVectors(this.forward,this.camera.up).normalize();
    this.camera.position.addScaledVector(this.right,right).addScaledVector(this.camera.up,up).addScaledVector(this.forward,forward);
  }
  update(dt){
    if(!this.enabled)return;
    this.motion.set(Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA')),Number(this.keys.has('KeyE'))-Number(this.keys.has('KeyQ')),Number(this.keys.has('KeyW'))-Number(this.keys.has('KeyS')));
    if(this.motion.lengthSq()>0){
      this.motion.normalize().multiplyScalar(Math.min(dt,.05)*this.speed*(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?3:1));
      this.translate(this.motion.x,this.motion.y,this.motion.z);
    }
  }
}
