import { sceneSchema, type AnimationBinding, type Element, type Scene } from '../model/schema';
import { evaluateBehavior, type FrameContext } from './behaviors';
import { evaluateFalloff } from './falloffs';
import { generateInstances, type InstanceContext } from './generators';
import { resolveWorldTransforms, transformPoint, type WorldTransform } from './transforms';

type RenderElement<T extends Element=Element>=T extends Element?Omit<T,'x'|'y'|'rotation'|'opacity'>:never;
export type RenderInstance=RenderElement&{instanceId:string;x:number;y:number;rotation:number;scale:number;opacity:number;content?:string};
type Drawable = { element: Element; bindings: AnimationBinding[]; transform: WorldTransform };

function drawable(scene:Scene,world:Map<string,WorldTransform>):Drawable[]{
  const byId=new Map(scene.elements.map(element=>[element.id,element]));
  const children=new Set(scene.elements.flatMap(element=>element.type==='group'?element.childIds:[]));
  const bindingsByElement=new Map<string,AnimationBinding[]>();
  for(const binding of scene.animation) bindingsByElement.set(binding.elementId,[...(bindingsByElement.get(binding.elementId)??[]),binding]);
  const visit=(element:Element,inherited:AnimationBinding[]=[]):Drawable[]=>{
    const bindings=[...inherited,...(bindingsByElement.get(element.id)??[])];
    const transform=world.get(element.id)!;
    if(element.type!=='group')return[{element,bindings,transform}];
    return element.childIds.flatMap(id=>visit(byId.get(id)!,bindings));
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
  const world=resolveWorldTransforms(validScene);
  return drawable(validScene,world).flatMap(({element,bindings,transform})=>{
    const generator=generatorByElement.get(element.id);
    const rawPathElement=generator?.type==='path'?byId.get(generator.pathElementId):undefined;
    const pathElement=rawPathElement?worldGeometry(rawPathElement,world.get(rawPathElement.id)!):undefined;
    const generated=generator?generateInstances(generator,{...element,x:transform.x,y:transform.y,rotation:transform.rotation} as Element,validScene.composition,pathElement):[singleton(element,transform)];
    return generated.map(instance=>{
      let x=instance.position.x,y=instance.position.y,rotation=instance.baseTransform.rotation,scale=transform.scale,opacity=element.opacity??1;
      const colorProperty='fill' in element&&element.fill!==undefined?'fill':'stroke';
      let color=colorProperty==='fill'&&'fill' in element?element.fill:'stroke' in element?element.stroke:undefined;
      let letterSpacing=element.type==='text'?(element.letterSpacing??0):undefined;
      let lineHeight=element.type==='text'?(element.lineHeight??element.fontSize??32):undefined;
      let cornerRadius=element.type==='rectangle'?(element.cornerRadius??0):undefined;
      let width=element.type==='rectangle'?element.width:undefined,height=element.type==='rectangle'?element.height:undefined;
      let pathProgress='pathProgress' in element?(element.pathProgress??1):undefined;
      for(const binding of bindings){
        const behavior=behaviorById.get(binding.behaviorId);
        if(!behavior) throw new Error(`Missing behavior reference ${binding.behaviorId}`);
        const target='targetElementId' in behavior&&behavior.targetElementId?byId.get(behavior.targetElementId):undefined;
        if('targetElementId' in behavior&&behavior.targetElementId&&!target) throw new Error(`Missing target reference ${behavior.targetElementId}`);
        const targetTransform=target?world.get(target.id):undefined;
        const delta=evaluateBehavior(behavior,{...frame,time,index:instance.index,count:instance.count,position:{x,y},baseTransform:instance.baseTransform,target:targetTransform?{x:targetTransform.x,y:targetTransform.y}:undefined});
        const falloffs=binding.falloffIds.map(id=>{const falloff=falloffById.get(id);if(!falloff)throw new Error(`Missing falloff reference ${id}`);return falloff;});
        const weight=evaluateFalloff(falloffs,{...instance,position:{x,y},time});
        for(const channel of binding.channels){
          if(channel==='x')x+=delta.x*weight; else if(channel==='y')y+=delta.y*weight; else if(channel==='rotation')rotation+=delta.rotation*weight;
          else if(channel==='scale')scale*=1+delta.value*weight; else if(channel==='opacity')opacity*=1+delta.value*weight;
          else if(channel==='color')color=rotateColor(color,delta.value*weight*.5);
          else if(channel==='letterSpacing')letterSpacing=(letterSpacing??0)+delta.value*weight;
          else if(channel==='lineHeight')lineHeight=Math.max(0,(lineHeight??0)+delta.value*weight);
          else if(channel==='cornerRadius')cornerRadius=Math.max(0,(cornerRadius??0)+delta.value*weight);
          else if(channel==='width')width=Math.max(0,(width??0)+delta.value*weight);
          else if(channel==='height')height=Math.max(0,(height??0)+delta.value*weight);
          else if(channel==='pathProgress')pathProgress=Math.max(0,Math.min(1,(pathProgress??1)+delta.value*weight));
        }
      }
      return {...element,...(color?{[colorProperty]:color}:{}),...(letterSpacing!==undefined?{letterSpacing}:{}),...(lineHeight!==undefined?{lineHeight}:{}),...(cornerRadius!==undefined?{cornerRadius}:{}),...(width!==undefined?{width}:{}),...(height!==undefined?{height}:{}),...(pathProgress!==undefined?{pathProgress}:{}),instanceId:instance.id,x,y,rotation,scale:Math.max(0,finite(scale)),opacity:Math.max(0,Math.min(1,finite(opacity))),content:instance.content};
    });
  });
}
const finite=(value:number)=>Number.isFinite(value)?value:0;
function rotateColor(color:string|undefined,turns:number):string|undefined {
  if(!color)return color;
  const match=/^#([\da-f]{3}|[\da-f]{6})$/i.exec(color);
  if(!match)return `hsl(from ${color} calc(h + ${turns*360}) s l)`;
  const hex=match[1]!.length===3?[...match[1]!].map(value=>value+value).join(''):match[1]!;
  const [r,g,b]=[0,2,4].map(index=>parseInt(hex.slice(index,index+2),16)/255);
  const max=Math.max(r,g,b),min=Math.min(r,g,b),light=(max+min)/2,d=max-min;
  let hue=0,saturation=0;
  if(d){saturation=d/(1-Math.abs(2*light-1));hue=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;hue/=6;}
  hue=((hue+turns)%1+1)%1;
  const a=saturation*Math.min(light,1-light),f=(n:number)=>light-a*Math.max(-1,Math.min((n+hue*12)%12-3,9-(n+hue*12)%12,1));
  return `#${[f(0),f(8),f(4)].map(value=>Math.round(value*255).toString(16).padStart(2,'0')).join('')}`;
}
function worldGeometry(element:Element,transform:WorldTransform):Element {
  if(element.type==='line'){
    const start={x:transform.x,y:transform.y};
    const end=transformPoint(transform,{x:element.x2-(element.x??0),y:element.y2-(element.y??0)});
    return {...element,x:start.x,y:start.y,x2:end.x,y2:end.y,rotation:0,scale:1};
  }
  if(element.type==='circle')return {...element,x:transform.x,y:transform.y,radius:element.radius*transform.scale,rotation:transform.rotation,scale:1};
  if(element.type==='polygon')return {...element,x:0,y:0,points:element.points.map(point=>transformPoint(transform,point)),rotation:0,scale:1};
  return element;
}
