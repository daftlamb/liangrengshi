import type { Element, Scene } from '../model/schema';

export interface WorldTransform { x:number; y:number; rotation:number; scale:number }
export const identityTransform:WorldTransform={x:0,y:0,rotation:0,scale:1};

export function transformPoint(transform:WorldTransform, point:{x:number;y:number}) {
  const cosine=Math.cos(transform.rotation),sine=Math.sin(transform.rotation);
  return {x:transform.x+transform.scale*(point.x*cosine-point.y*sine),y:transform.y+transform.scale*(point.x*sine+point.y*cosine)};
}

export function composeTransform(parent:WorldTransform, element:Element):WorldTransform {
  const origin=transformPoint(parent,{x:element.x??0,y:element.y??0});
  return {x:origin.x,y:origin.y,rotation:parent.rotation+(element.rotation??0),scale:parent.scale*(element.scale??1)};
}

export function resolveWorldTransforms(scene:Scene):Map<string,WorldTransform> {
  const byId=new Map(scene.elements.map(element=>[element.id,element]));
  const parentByChild=new Map<string,string>();
  for(const element of scene.elements) if(element.type==='group') for(const childId of element.childIds) parentByChild.set(childId,element.id);
  const result=new Map<string,WorldTransform>();
  const resolve=(element:Element):WorldTransform=>{
    const existing=result.get(element.id); if(existing)return existing;
    const parentId=parentByChild.get(element.id);
    const world=composeTransform(parentId?resolve(byId.get(parentId)!):identityTransform,element);
    result.set(element.id,world); return world;
  };
  for(const element of scene.elements)resolve(element);
  return result;
}
