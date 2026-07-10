import { describe, expect, it } from 'vitest';
import { evaluateBehavior, type BehaviorContext } from '../src/evaluate/behaviors';
import type { Behavior } from '../src/model/schema';

const context = (time=0, index=0, overrides:Partial<BehaviorContext>={}):BehaviorContext => ({
  time, delta:1/60, pointer:{x:0,y:0,active:false}, index, count:4,
  position:{x:0,y:0}, baseTransform:{x:0,y:0,rotation:0},
  target:{x:10,y:0}, ...overrides,
});
const behavior = (value:object) => value as Behavior;

describe('evaluateBehavior', () => {
  it('evaluates sine, triangle, and saw waves at quarter periods', () => {
    const values = [0,.25,.5,.75,1];
    expect(values.map(time=>evaluateBehavior(behavior({id:'w',type:'wave',waveform:'sine',amplitude:2,frequency:1}),context(time)).value)).toEqual([0,2,0,-2,0]);
    expect(values.map(time=>evaluateBehavior(behavior({id:'w',type:'wave',waveform:'triangle',amplitude:2,frequency:1}),context(time)).value)).toEqual([0,2,0,-2,0]);
    expect(values.map(time=>evaluateBehavior(behavior({id:'w',type:'wave',waveform:'saw',amplitude:2,frequency:1}),context(time)).value)).toEqual([-2,-1,0,1,-2]);
  });
  it('produces continuous deterministic seeded noise', () => {
    const n=behavior({id:'n',type:'noise',seed:7,amplitude:3,frequency:2});
    expect(evaluateBehavior(n,context(.123))).toEqual(evaluateBehavior(n,context(.123)));
    expect(Math.abs(evaluateBehavior(n,context(.123)).value-evaluateBehavior(n,context(.124)).value)).toBeLessThan(.1);
  });
  it('damps spring toward its target and stays finite for a large delta', () => {
    const s=behavior({id:'s',type:'spring',stiffness:30,damping:8});
    const early=evaluateBehavior(s,context(.1,0,{delta:.1})).value;
    const late=evaluateBehavior(s,context(2,0,{delta:1e9})).value;
    expect(early).toBeGreaterThan(0); expect(late).toBeCloseTo(1,2); expect(Number.isFinite(late)).toBe(true);
  });
  it('delays follow by stable index and points outward from target', () => {
    const f=behavior({id:'f',type:'follow',targetElementId:'t'});
    expect(evaluateBehavior(f,context(.2,0)).x).toBeGreaterThan(evaluateBehavior(f,context(.2,3)).x);
    expect(evaluateBehavior(behavior({id:'l',type:'lookAt',targetElementId:'t'}),context(0,0,{position:{x:10,y:0},target:{x:0,y:0}})).rotation).toBeCloseTo(Math.PI);
  });
  it('caps attract and repel displacement and remains finite at zero distance', () => {
    for(const type of ['attract','repel'] as const){
      const near=evaluateBehavior(behavior({id:type,type,targetElementId:'t',strength:1e9}),context(0,0,{target:{x:0,y:0},delta:1e9}));
      const far=evaluateBehavior(behavior({id:type,type,targetElementId:'t',strength:1e9}),context(0,0,{target:{x:1e9,y:0},delta:1e9}));
      expect(Number.isFinite(near.x)).toBe(true); expect(Math.hypot(far.x,far.y)).toBeLessThanOrEqual(100);
    }
  });
});
