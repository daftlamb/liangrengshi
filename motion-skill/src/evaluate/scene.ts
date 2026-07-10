import { sceneSchema, type AnimationBinding, type Element, type Scene } from '../model/schema';
import { evaluateBehavior, type FrameContext } from './behaviors';
import { evaluateFalloff } from './falloffs';
import { generateInstances, type InstanceContext } from './generators';

export type RenderInstance=Omit<Element,'x'|'y'|'rotation'|'opacity'>&{instanceId:string;x:number;y:number;rotation:number;scale:number;opacity:number;content?:string};
type Drawable = { element: Element; bindings: AnimationBinding[]; transform: { x:number; y:number; rotation:number } };

function drawable(scene:Scene):Drawable[]{
  const byId=new Map(scene.elements.map(element=>[element.id,element]));
  const children=new Set(scene.elements.flatMap(element=>element.type==='group'?element.childIds:[]));
  const bindingsByElement=new Map<string,AnimationBinding[]>();
  for(const binding of scene.animation) bindingsByElement.set(binding.elementId,[...(bindingsByElement.get(binding.elementId)??[]),binding]);
  const visit=(element:Element,inherited:AnimationBinding[]=[],parent={x:0,y:0,rotation:0}):Drawable[]=>{
    const bindings=[...inherited,...(bindingsByElement.get(element.id)??[])];
    const transform={x:parent.x+(element.x??0),y:parent.y+(element.y??0),rotation:parent.rotation+(element.rotation??0)};
    if(element.type!=='group')return[{element,bindings,transform}];
    return element.childIds.flatMap(id=>visit(byId.get(id)!,bindings,transform));
  };
  return scene.elements.filter(element=>!children.has(element.id)).flatMap(element=>visit(element));
}
function singleton(element:Element,transform:Drawable['transform']):InstanceContext{return{id:`${element.id}:0`,index:0,count:1,baseTransform:{...transform},position:{x:transform.x,y:transform.y},content:element.type==='text'?element.text:undefined};}
export function evaluateScene(scene:Scene,frame:FrameContext):RenderInstance[]{
  const parsed=sceneSchema.safeParse(scene);
  if(!parsed.success) throw new Error(`Invalid scene reference: ${parsed.error.issues.map(issue=>`${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  const validScene=parsed.data;
  const time=validScene.composition.loop?((frame.time%validScene.composition.duration)+validScene.composition.duration)%validScene.composition.duration:frame.time;
  const byId=new Map(validScene.elements.map(element=>[element.id,element]));
  const generatorByElement=new Map(validScene.generators.map(generator=>[generator.elementId,generator]));
  const behaviorById=new Map(validScene.behaviors.map(behavior=>[behavior.id,behavior]));
  const falloffById=new Map(validScene.falloffs.map(falloff=>[falloff.id,falloff]));
  return drawable(validScene).flatMap(({element,bindings,transform})=>{
    const generator=generatorByElement.get(element.id);
    const pathElement=generator?.type==='path'?byId.get(generator.pathElementId):undefined;
    const generated=generator?generateInstances(generator,{...element,x:transform.x,y:transform.y,rotation:transform.rotation} as Element,validScene.composition,pathElement):[singleton(element,transform)];
    return generated.map(instance=>{
      let x=instance.position.x,y=instance.position.y,rotation=instance.baseTransform.rotation,scale=1,opacity=element.opacity??1;
      for(const binding of bindings){
        const behavior=behaviorById.get(binding.behaviorId);
        if(!behavior) throw new Error(`Missing behavior reference ${binding.behaviorId}`);
        const target='targetElementId' in behavior?byId.get(behavior.targetElementId):undefined;
        if('targetElementId' in behavior&&!target) throw new Error(`Missing target reference ${behavior.targetElementId}`);
        const delta=evaluateBehavior(behavior,{...frame,time,index:instance.index,count:instance.count,position:{x,y},baseTransform:instance.baseTransform,target:target?{x:target.x??0,y:target.y??0}:undefined});
        const falloffs=binding.falloffIds.map(id=>{const falloff=falloffById.get(id);if(!falloff)throw new Error(`Missing falloff reference ${id}`);return falloff;});
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
