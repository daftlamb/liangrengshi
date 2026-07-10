import type { Element, Scene } from '../model/schema';
import { evaluateBehavior, type FrameContext } from './behaviors';
import { evaluateFalloff } from './falloffs';
import { generateInstances, type InstanceContext } from './generators';

export type RenderInstance=Omit<Element,'x'|'y'|'rotation'|'opacity'>&{instanceId:string;x:number;y:number;rotation:number;scale:number;opacity:number;content?:string};

function drawable(scene:Scene):Element[]{
  const byId=new Map(scene.elements.map(element=>[element.id,element]));
  const children=new Set(scene.elements.flatMap(element=>element.type==='group'?element.childIds:[]));
  const visit=(element:Element,seen=new Set<string>()):Element[]=>{
    if(element.type!=='group')return [element]; if(seen.has(element.id))return [];
    const next=new Set(seen).add(element.id); return element.childIds.flatMap(id=>{const child=byId.get(id);return child?visit(child,next):[]});
  };
  return scene.elements.filter(element=>!children.has(element.id)).flatMap(element=>visit(element));
}
function singleton(element:Element):InstanceContext{return{id:`${element.id}:0`,index:0,count:1,baseTransform:{x:element.x??0,y:element.y??0,rotation:element.rotation??0},position:{x:element.x??0,y:element.y??0},content:element.type==='text'?element.text:undefined};}
export function evaluateScene(scene:Scene,frame:FrameContext):RenderInstance[]{
  const primary=scene.animation.filter(binding=>binding.role==='primary').length,supporting=scene.animation.filter(binding=>binding.role==='supporting').length;
  if(primary>1)throw new Error('At most one primary binding is allowed'); if(supporting>2)throw new Error('At most two supporting bindings are allowed');
  const time=scene.composition.loop?((frame.time%scene.composition.duration)+scene.composition.duration)%scene.composition.duration:frame.time;
  const elements=drawable(scene), byId=new Map(scene.elements.map(element=>[element.id,element]));
  return elements.flatMap((element,elementIndex)=>{
    const generator=scene.generators[elementIndex]??(elements.length===1?scene.generators[0]:undefined);
    const instances=generator?generateInstances(generator,element,scene.composition):[singleton(element)];
    return instances.map(instance=>{
      let x=instance.position.x,y=instance.position.y,rotation=instance.baseTransform.rotation,scale=1,opacity=element.opacity??1;
      for(const binding of scene.animation.filter(binding=>binding.elementId===element.id)){
        const behavior=scene.behaviors.find(item=>item.id===binding.behaviorId); if(!behavior)continue;
        const target='targetElementId' in behavior?byId.get(behavior.targetElementId):undefined;
        const delta=evaluateBehavior(behavior,{...frame,time,index:instance.index,count:instance.count,position:{x,y},baseTransform:instance.baseTransform,target:target?{x:target.x??0,y:target.y??0}:undefined});
        const falloffs=binding.falloffIds.map(id=>scene.falloffs.find(item=>item.id===id)).filter(item=>item!==undefined);
        const weight=evaluateFalloff(falloffs,{...instance,position:{x,y},time});
        for(const channel of binding.channels){
          if(channel==='x')x+=delta.x*weight; else if(channel==='y')y+=delta.y*weight; else if(channel==='rotation')rotation+=delta.rotation*weight;
          else if(channel==='scale')scale*=1+delta.value*weight; else if(channel==='opacity')opacity*=1+delta.value*weight;
        }
      }
      return {...element,instanceId:instance.id,x,y,rotation,scale:Math.max(0,finite(scale)),opacity:Math.max(0,Math.min(1,finite(opacity))),content:instance.content};
    });
  });
}
const finite=(value:number)=>Number.isFinite(value)?value:0;
