import { describe, expect, it } from 'vitest';
import { createDefaultScene } from '../src/model/defaults';
import { sceneSchema } from '../src/model/schema';

describe('color schema', () => {
  it('accepts explicit RGB hex and rejects order-dependent CSS color syntax', () => {
    const scene=createDefaultScene('colors',1);
    scene.composition.background='#abc';
    scene.elements=[{id:'text',type:'text',text:'A',fill:'#A1b2C3'}];
    expect(sceneSchema.safeParse(scene).success).toBe(true);
    scene.elements=[{id:'text',type:'text',text:'A',fill:'red'}];
    expect(sceneSchema.safeParse(scene).success).toBe(false);
  });
});
