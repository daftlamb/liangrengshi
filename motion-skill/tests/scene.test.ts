import { describe, expect, it } from 'vitest';
import { evaluateScene } from '../src/evaluate/scene';
import type { Scene } from '../src/model/schema';

const fixture:Scene={metadata:{schemaVersion:1,revision:0,seed:1,name:'x'},composition:{width:100,height:100,background:'#fff',duration:1,loop:true,style:'geometric'},
 elements:[{id:'dot',type:'circle',radius:2,x:10,y:20,rotation:.5,opacity:.8}], generators:[{id:'g',type:'linear',elementId:'dot',count:2,start:{x:0,y:0},end:{x:100,y:0}}],
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
 it('targets generators by element ID regardless of array order or unrelated insertion',()=>{
   const second={id:'label',type:'text',text:'X',split:'none',x:7,y:8} as const;
   const scene={...fixture,elements:[second,...fixture.elements],generators:[{id:'label-grid',type:'grid',elementId:'label',count:3,gapX:1,gapY:0}, {...fixture.generators[0],elementId:'dot'}]} as Scene;
   const reordered={...scene,elements:[...scene.elements].reverse(),generators:[...scene.generators].reverse()};
   const stable=(value:Scene)=>evaluateScene(value,frame(0)).sort((a,b)=>a.instanceId.localeCompare(b.instanceId));
   expect(stable(scene)).toEqual(stable(reordered));
   expect(evaluateScene(scene,frame(0)).filter(item=>item.id==='label')).toHaveLength(3);
   expect(evaluateScene(scene,frame(0)).filter(item=>item.id==='dot')).toHaveLength(2);
 });
 it('uses a path source for placement while retaining target content',()=>{
   const scene={...fixture,elements:[{id:'copy',type:'text',text:'AB',split:'characters'}, {id:'guide',type:'line',x:0,y:5,x2:20,y2:5}],generators:[{id:'path',type:'path',elementId:'copy',pathElementId:'guide',count:2}],animation:[]} as Scene;
   const copies=evaluateScene(scene,frame(0)).filter(item=>item.id==='copy');
   expect(copies.map(item=>[item.type,item.content,item.x,item.y])).toEqual([['text','A',0,5],['text','B',20,5]]);
 });
 it('inherits group bindings and combines nested group transforms',()=>{
   const scene={...fixture,elements:[{id:'outer',type:'group',x:10,y:20,rotation:.2,childIds:['inner']},{id:'inner',type:'group',x:3,y:4,rotation:.3,childIds:['dot']},{id:'dot',type:'circle',radius:2,x:1,y:2}],generators:[],behaviors:[{id:'w',type:'wave',amplitude:5,frequency:1}],falloffs:[],animation:[{id:'a',elementId:'outer',behaviorId:'w',falloffIds:[],channels:['x'],role:'primary'}]} as Scene;
   const [dot]=evaluateScene(scene,frame(.25));
   expect(dot.x).toBeCloseTo(17.064253895); expect(dot.y).toBeCloseTo(26.750864966); expect(dot.rotation).toBeCloseTo(.5);
 });
 it('applies group rotation and scale to a grouped line path source',()=>{
   const scene={...fixture,elements:[{id:'group',type:'group',x:10,y:20,rotation:Math.PI/2,scale:2,childIds:['guide']},{id:'guide',type:'line',x:1,y:0,x2:3,y2:0},{id:'copy',type:'text',text:'AB',split:'characters'}],generators:[{id:'path',type:'path',elementId:'copy',pathElementId:'guide',count:2}],animation:[]} as Scene;
   const copies=evaluateScene(scene,frame(0)).filter(item=>item.id==='copy');
   expect(copies.map(item=>[item.x,item.y,item.rotation])).toEqual([[10,22,Math.PI/2],[10,26,Math.PI/2]]);
 });
 it('resolves grouped drawable and lookAt/force targets through one world transform',()=>{
   const base={...fixture,elements:[{id:'group',type:'group',x:10,y:20,rotation:Math.PI/2,scale:2,childIds:['target']},{id:'target',type:'circle',radius:1,x:5,y:0},{id:'actor',type:'circle',radius:1,x:0,y:20}],generators:[],falloffs:[]} as Scene;
   const look={...base,behaviors:[{id:'b',type:'lookAt',targetElementId:'target'}],animation:[{id:'a',elementId:'actor',behaviorId:'b',falloffIds:[],channels:['rotation'],role:'primary'}]} as Scene;
   const force={...base,behaviors:[{id:'b',type:'attract',targetElementId:'target',strength:10}],animation:[{id:'a',elementId:'actor',behaviorId:'b',falloffIds:[],channels:['x','y'],role:'primary'}]} as Scene;
   expect(evaluateScene(look,frame(0)).find(item=>item.id==='target')).toMatchObject({x:10,y:30,scale:2,rotation:Math.PI/2});
   expect(evaluateScene(look,frame(0)).find(item=>item.id==='actor')?.rotation).toBeCloseTo(Math.PI/4);
   const forced=evaluateScene(force,{...frame(0),delta:1}).find(item=>item.id==='actor')!;
   expect(forced.x).toBeCloseTo(Math.SQRT1_2*10); expect(forced.y).toBeCloseTo(20+Math.SQRT1_2*10);
 });
 it.each([
   ['behavior',{behaviors:[]}],
   ['falloff',{falloffs:[]}],
   ['generator',{generators:[{...fixture.generators[0],elementId:'missing'}]}],
 ] as const)('fails fast for a typed-invalid missing %s reference',(_,change)=>{
   expect(()=>evaluateScene({...fixture,...change} as unknown as Scene,frame(0))).toThrow(/reference|unknown|missing/i);
 });
});
