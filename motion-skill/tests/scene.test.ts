import { describe, expect, it } from 'vitest';
import { evaluateScene } from '../src/evaluate/scene';
import type { Scene } from '../src/model/schema';

const fixture:Scene={metadata:{schemaVersion:1,revision:0,seed:1,name:'x'},composition:{width:100,height:100,background:'#fff',duration:1,loop:true,style:'geometric'},
 elements:[{id:'dot',type:'circle',radius:2,x:10,y:20,rotation:.5,opacity:.8}], generators:[{id:'g',type:'linear',count:2,start:{x:0,y:0},end:{x:100,y:0}}],
 behaviors:[{id:'w',type:'wave',amplitude:10,frequency:1}],falloffs:[{id:'i',type:'index'}],
 animation:[{id:'a',elementId:'dot',behaviorId:'w',falloffIds:['i'],channels:['x','rotation','scale','opacity'],role:'primary'}]};
const frame=(time:number)=>({time,delta:1/60,pointer:{x:0,y:0,active:false}});
describe('evaluateScene',()=>{
 it('composes generator then ordered behavior and falloff with channel rules',()=>{
   const output=evaluateScene(fixture,frame(.25));
   expect(output).toHaveLength(2); expect(output[0].x).toBe(10); expect(output[1].x).toBe(100);
   expect(output[0].rotation).toBeCloseTo(10.5); expect(output[0].scale).toBeCloseTo(11); expect(output[0].opacity).toBe(1);
 });
 it('is deterministic and periodic at the loop boundary',()=>{
   expect(evaluateScene(fixture,frame(.37))).toEqual(evaluateScene(fixture,frame(.37)));
   expect(evaluateScene(fixture,frame(0))).toEqual(evaluateScene(fixture,frame(1)));
 });
 it('enforces animation role limits',()=>{
   const invalid={...fixture,animation:[...fixture.animation,{...fixture.animation[0],id:'b'}]};
   expect(()=>evaluateScene(invalid,frame(0))).toThrow(/primary/i);
 });
});
