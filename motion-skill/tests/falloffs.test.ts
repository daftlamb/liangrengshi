import { describe, expect, it } from 'vitest';
import { evaluateFalloff } from '../src/evaluate/falloffs';
import type { Falloff } from '../src/model/schema';

const context = (x:number, index=0, time=0) => ({ id:`e:${index}`, index, count:3, position:{x,y:0}, baseTransform:{x,y:0,rotation:0}, time });
describe('falloffs', () => {
  it('evaluates linear and radial endpoints', () => {
    expect(evaluateFalloff({id:'l',type:'linear',start:0,end:100},context(0))).toBe(1);
    expect(evaluateFalloff({id:'l',type:'linear',start:0,end:100},context(100))).toBe(0);
    expect(evaluateFalloff({id:'r',type:'radial',center:{x:0,y:0},radius:100},context(50))).toBe(.5);
  });
  it('evaluates index order and seeded random repeatably', () => {
    expect(evaluateFalloff({id:'i',type:'index'},context(0,0))).toBe(1);
    expect(evaluateFalloff({id:'i',type:'index'},context(0,2))).toBe(0);
    const f={id:'r',type:'random',seed:9,min:.2,max:.8} as Falloff;
    expect(evaluateFalloff(f,context(0,1))).toBe(evaluateFalloff(f,context(0,1)));
    expect(evaluateFalloff(f,context(0,1))).not.toBe(evaluateFalloff(f,context(0,2)));
    const otherSeed = {id:'r',type:'random',seed:10,min:.2,max:.8} as Falloff;
    expect(evaluateFalloff(otherSeed,context(0,1))).not.toBe(evaluateFalloff(f,context(0,1)));
    expect(evaluateFalloff(f,context(0,1))).toBeGreaterThanOrEqual(.2);
    expect(evaluateFalloff(f,context(0,1))).toBeLessThanOrEqual(.8);
  });
  it('does not mutate context and visits combined falloffs in binding order', () => {
    const frozen = Object.freeze({...context(25,1), position:Object.freeze({x:25,y:0}), baseTransform:Object.freeze({x:25,y:0,rotation:0})});
    expect(() => evaluateFalloff({id:'l',type:'linear',start:0,end:100}, frozen)).not.toThrow();
    expect(frozen.position.x).toBe(25);
    const order:string[]=[];
    const first = {id:'a',get type(){order.push('first');return 'index' as const;}} as Falloff;
    const second = {id:'b',get type(){order.push('second');return 'index' as const;}} as Falloff;
    evaluateFalloff([first,second],context(0,1));
    expect(order.filter((name,index) => name !== order[index-1])).toEqual(['first','second']);
  });
  it('moves a time field and supports easing, inversion, clamp, and multiplication', () => {
    const moving={id:'t',type:'time',start:0,end:2} as Falloff;
    expect(evaluateFalloff(moving,context(0,0,0))).toBe(1);
    expect(evaluateFalloff(moving,context(0,0,2))).toBe(0);
    const adjusted={id:'l',type:'linear',start:0,end:100,easing:'easeIn',invert:true,clamp:[.2,.8]} as Falloff;
    expect(evaluateFalloff(adjusted,context(50))).toBe(.75);
    expect(evaluateFalloff([{id:'a',type:'index'},{id:'b',type:'radial',center:{x:0,y:0},radius:100}],context(50,1))).toBe(.25);
  });
});
