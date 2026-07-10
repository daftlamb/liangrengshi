import type { Falloff } from '../model/schema';
import { createRandom } from '../math/random';

export interface FalloffContext { id: string; index: number; count: number; position: {x:number;y:number}; baseTransform: {x:number;y:number;rotation:number}; time: number }
const saturate = (v:number) => Math.min(1,Math.max(0,v));
function easing(v:number, name: Falloff['easing']):number {
  if(name==='easeIn') return v*v;
  if(name==='easeOut') return 1-(1-v)*(1-v);
  if(name==='easeInOut') return v<.5 ? 2*v*v : 1-Math.pow(-2*v+2,2)/2;
  return v;
}
function one(falloff: Falloff, context: FalloffContext):number {
  let value:number;
  if(falloff.type==='linear') value=1-saturate((context.position.x-(falloff.start??0))/((falloff.end??1)-(falloff.start??0)||1));
  else if(falloff.type==='radial') { const c=falloff.center??{x:0,y:0}; value=1-saturate(Math.hypot(context.position.x-c.x,context.position.y-c.y)/(falloff.radius??1)); }
  else if(falloff.type==='index') { const t=context.count<=1?0:context.index/(context.count-1); value=1-saturate((t-(falloff.start??0))/((falloff.end??1)-(falloff.start??0)||1)); }
  else if(falloff.type==='random') { const random=createRandom((falloff.seed ^ Math.imul(context.index,0x9e3779b1))>>>0); value=(falloff.min??0)+random()*((falloff.max??1)-(falloff.min??0)); }
  else value=1-saturate((context.time-(falloff.start??0))/((falloff.end??1)-(falloff.start??0)||1));
  value=easing(saturate(value),falloff.easing);
  if(falloff.invert) value=1-value;
  if(falloff.clamp) value=Math.min(falloff.clamp[1],Math.max(falloff.clamp[0],value));
  return saturate(value);
}
export function evaluateFalloff(falloff: Falloff|Falloff[], context: FalloffContext):number {
  return (Array.isArray(falloff)?falloff:[falloff]).reduce((value,current)=>value*one(current,context),1);
}
