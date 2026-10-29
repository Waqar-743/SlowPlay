import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PerspectiveCamera,Vector3} from 'three';
import {FreeExplore} from '../src/free-explore.js';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

test('viewer has every referenced control without a website header or footer',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(ids.length,new Set(ids).size,'Control IDs must be unique');
  for(const [,id] of main.matchAll(/\$\('([^']+)'\)/g))assert(ids.includes(id),`Missing control: ${id}`);
  assert(!/<(?:header|footer)\b/i.test(html));
  assert(!/hero-copy|scene-vignette|exploration-dock/.test(html));
  assert(/id="controls-panel"[^>]+hidden/.test(html),'Control panel starts collapsed');
  assert(!main.includes('setViewOffset('),'Canvas framing must be centered');
});

test('free flight moves relative to the camera, rotates 360 degrees, and releases input',()=>{
  globalThis.window=new EventTarget();
  globalThis.document=new EventTarget();
  document.hidden=false;
  const canvas=new EventTarget();canvas.clientHeight=900;canvas.focus=()=>document.activeElement=canvas;canvas.setPointerCapture=()=>{};
  const camera=new PerspectiveCamera();camera.position.set(0,100,0);
  const flight=new FreeExplore(camera,canvas);
  function send(target,type,values={}){const event=new Event(type,{cancelable:true});Object.assign(event,values);target.dispatchEvent(event);return event;}
  const initial=camera.position.clone();flight.keys.add('KeyW');flight.update(.05);
  assert(camera.position.equals(initial),'Disabled flight must not move');
  flight.setEnabled(true);canvas.focus();
  send(window,'keydown',{code:'KeyW'});
  assert.equal(flight.keys.size,0,'Keyboard input outside the canvas is ignored');
  const key=new Event('keydown',{cancelable:true});Object.defineProperty(key,'target',{value:canvas});Object.defineProperty(key,'code',{value:'KeyW'});window.dispatchEvent(key);
  flight.update(.05);assert(camera.position.z<0,'Forward moves along the view direction');
  send(window,'keyup',{code:'KeyW'});assert.equal(flight.keys.size,0);
  camera.position.copy(initial);flight.keys.add('KeyW');flight.keys.add('KeyD');flight.update(5);
  assert(Math.abs(camera.position.distanceTo(initial)-flight.speed*.05)<1e-8,'Diagonal motion is normalized and long frames are capped');
  send(window,'blur');assert.equal(flight.keys.size,0,'Focus loss stops movement');
  send(canvas,'pointerdown',{pointerId:1,clientX:0,clientY:0});
  send(canvas,'pointermove',{pointerId:1,clientX:2*Math.PI/.003,clientY:0,buttons:1});
  assert(Math.abs(flight.yaw+2*Math.PI)<1e-8,'Yaw supports a complete revolution');
  const direction=new Vector3();camera.getWorldDirection(direction);assert(direction.distanceTo(new Vector3(0,0,-1))<1e-8);
  send(canvas,'pointermove',{pointerId:1,clientX:0,clientY:100000,buttons:1});
  assert(Math.abs(flight.pitch)<Math.PI/2,'Looking up/down cannot flip the camera');
  send(canvas,'pointercancel',{pointerId:1});assert.equal(flight.pointers.size,0);
  flight.pitch=0;flight.yaw=0;flight.orient();camera.position.copy(initial);
  send(canvas,'pointerdown',{pointerId:1,clientX:0,clientY:0});send(canvas,'pointerdown',{pointerId:2,clientX:10,clientY:0});
  send(canvas,'pointermove',{pointerId:1,clientX:20,clientY:0,buttons:1});assert(camera.position.x<0,'Two-finger movement strafes');
  send(window,'blur');assert.equal(flight.pointers.size,0);
  const z=camera.position.z;const wheel=send(canvas,'wheel',{deltaY:-100,deltaMode:0});assert(camera.position.z<z&&wheel.defaultPrevented,'Wheel moves in flight without scrolling');
  flight.keys.add('KeyE');flight.setEnabled(false);assert.equal(flight.keys.size,0);
  const stopped=camera.position.clone();send(canvas,'wheel',{deltaY:100,deltaMode:0});flight.update(.05);assert(camera.position.equals(stopped));
});
