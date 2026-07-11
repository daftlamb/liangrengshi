import type { Behavior } from '../model/schema';
import { noise1D } from '../math/random';

export interface FrameContext { time:number; delta:number; pointer:{x:number;y:number;active:boolean} }
export interface BehaviorContext extends FrameContext {
  index:number; count:number; position:{x:number;y:number};
  baseTransform:{x:number;y:number;rotation:number}; target?:{x:number;y:number};
}
export interface ChannelDelta { value:number; x:number; y:number; rotation:number }
const empty=(value=0):ChannelDelta=>({value,x:value,y:value,rotation:value});
const finite=(value:number, fallback=0)=>Number.isFinite(value)?value:fallback;
const capVector=(x:number,y:number,maximum=100):[number,number]=>{const length=Math.hypot(x,y);return length>maximum?[x*maximum/length,y*maximum/length]:[x,y]};

export function evaluateBehavior(behavior:Behavior, context:BehaviorContext):ChannelDelta {
  const time=finite(context.time), amplitude='amplitude' in behavior?(behavior.amplitude??1):1;
  if(behavior.type==='wave'){
    const frequency=behavior.frequency??1, phase=behavior.phase??0;
    let cycle=((time*frequency+phase/(Math.PI*2))%1+1)%1;
    if(Math.abs(cycle-1)<1e-12||Math.abs(cycle)<1e-12) cycle=0;
    const waveform=behavior.waveform??'sine';
    const unit=waveform==='triangle'?Math.asin(Math.sin(cycle*Math.PI*2))*2/Math.PI:waveform==='saw'?cycle*2-1:Math.sin(cycle*Math.PI*2);
    const value=Math.abs(unit)<1e-12?0:unit*amplitude; return empty(value);
  }
  if(behavior.type==='noise') return empty(noise1D(behavior.seed,time*(behavior.frequency??1))*amplitude);
  if(behavior.type==='spring'){
    const stiffness=Math.min(1e4,behavior.stiffness??100), damping=Math.min(1e3,behavior.damping??10);
    const response=1-Math.exp(-Math.max(0,time)*Math.max(1,damping)*.5)*Math.cos(Math.sqrt(stiffness)*Math.max(0,time));
    return empty(Math.max(-1,Math.min(1,response)));
  }
  if(behavior.type==='ramp'){
    const delay=behavior.delay??0,duration=behavior.duration??.35,hold=behavior.hold??1.8,cycle=behavior.cycle??(delay+duration+hold);
    const local=((((Math.max(0,time)%cycle)+cycle)%cycle)-delay)/duration;
    return empty(-1+Math.max(0,Math.min(1,local)));
  }
  const target=context.target??(context.pointer.active?context.pointer:context.position);
  const dx=finite(target.x-context.position.x),dy=finite(target.y-context.position.y);
  if(behavior.type==='lookAt') return {...empty(),rotation:Math.atan2(dy,dx)};
  if(behavior.type==='follow'){
    const delay=context.count<=1?0:context.index/(context.count-1)*.25;
    const amount=Math.max(0,Math.min(1,(time-delay)*4)); return {...empty(),x:dx*amount,y:dy*amount};
  }
  const distance=Math.hypot(dx,dy);
  if(distance<=Number.EPSILON)return empty();
  const direction=behavior.type==='repel'?-1:1;
  const step=Math.min(100,Math.abs(behavior.strength??1)*Math.min(Math.max(finite(context.delta),0),1));
  const [x,y]=capVector(direction*dx/distance*step,direction*dy/distance*step);
  return {...empty(),x,y};
}
