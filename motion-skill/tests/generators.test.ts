import { describe, expect, it } from 'vitest';
import { createRandom, noise1D } from '../src/math/random';
import { generateInstances, splitGraphemes } from '../src/evaluate/generators';
import type { Element, Generator } from '../src/model/schema';

const composition = { width: 200, height: 100 };
const element = { id: 'title', type: 'text', text: 'AB', split: 'characters', x: 3, y: 4, rotation: 0.5 } as Element;
const generate = (generator: object, target: Element = element, path?: Element) => generateInstances({ elementId: target.id, ...generator } as Generator, target, composition, path ?? target);

describe('deterministic generators', () => {
  it('places linear endpoints and creates stable IDs', () => {
    const values = generate({ id: 'g', type: 'linear', elementId:'title', count: 3, start: { x: 10, y: 20 }, end: { x: 30, y: 40 } });
    expect(values.map(v => [v.id, v.position])).toEqual([['title:0', { x: 10, y: 20 }], ['title:1', { x: 20, y: 30 }], ['title:2', { x: 30, y: 40 }]]);
  });
  it('lays out grids and radial endpoint angles', () => {
    expect(generate({ id: 'g', type: 'grid', elementId:'title', columns: 2, rows: 2, gapX: 10, gapY: 20 }).map(v => v.position)).toEqual([{x:3,y:4},{x:13,y:4},{x:3,y:24},{x:13,y:24}]);
    const radial = generate({ id: 'r', type: 'radial', elementId:'title', count: 4, center: {x:50,y:50}, radius: 10 });
    expect(radial[0].position).toEqual({x:60,y:50});
    expect(radial[1].position.x).toBeCloseTo(50);
    expect(radial[1].position.y).toBeCloseTo(60);
  });
  it('provides tangents for line, circle, and cubic bezier paths', () => {
    const line = { id:'line', type:'line', x:0, y:0, x2:100, y2:0 } as Element;
    expect(generate({id:'p',type:'path',pathElementId:'line',count:2}, line)[0].tangent).toBeCloseTo(0);
    const circle = { id:'circle', type:'circle', x:50, y:50, radius:20 } as Element;
    expect(generate({id:'p',type:'path',pathElementId:'circle',count:2}, circle)[0].tangent).toBeCloseTo(Math.PI/2);
    const bezier = { id:'curve', type:'polygon', points:[{x:0,y:0},{x:0,y:10},{x:10,y:10},{x:10,y:0}] } as Element;
    expect(generate({id:'p',type:'path',pathElementId:'curve',count:2}, bezier)[0].tangent).toBeCloseTo(Math.PI/2);
  });
  it('keeps generated content separate from path geometry', () => {
    const line = { id:'line', type:'line', x:10, y:20, x2:110, y2:20 } as Element;
    const values = generate({id:'p',type:'path',elementId:'title',pathElementId:'line',count:2} as Generator, element, line);
    expect(values.map(value => value.content)).toEqual(['A', 'B']);
    expect(values.map(value => value.position)).toEqual([{x:10,y:20},{x:110,y:20}]);
    expect(values.every(value => value.id.startsWith('title:'))).toBe(true);
  });
  it('requires the referenced path element and rejects unsupported geometry', () => {
    expect(() => generateInstances({id:'p',type:'path',elementId:'title',pathElementId:'line',count:2}, element, composition)).toThrow(/path reference/i);
    expect(() => generate({id:'p',type:'path',pathElementId:'title',count:2})).toThrow(/unsupported path geometry/i);
  });
  it('uses limiting cubic tangents when endpoint derivatives vanish', () => {
    const start = { id:'start', type:'polygon', points:[{x:0,y:0},{x:0,y:0},{x:10,y:0},{x:10,y:10}] } as Element;
    expect(generate({id:'p',type:'path',pathElementId:'start',count:2}, start)[0].tangent).toBeCloseTo(0);
    const end = { id:'end', type:'polygon', points:[{x:0,y:0},{x:0,y:10},{x:10,y:10},{x:10,y:10}] } as Element;
    expect(generate({id:'p',type:'path',pathElementId:'end',count:2}, end)[1].tangent).toBeCloseTo(0);
  });
  it('splits text by block, line, word, and grapheme character with exact counts', () => {
    const text = (split: 'none'|'lines'|'words'|'characters') => ({id:'text',type:'text',text:'A\u0301 👨‍👩‍👧‍👦\nnext',split} as Element);
    expect(generate({id:'g',type:'linear'}, text('none')).map(v => v.content)).toEqual(['A\u0301 👨‍👩‍👧‍👦\nnext']);
    expect(generate({id:'g',type:'linear'}, text('lines')).map(v => v.content)).toEqual(['A\u0301 👨‍👩‍👧‍👦','next']);
    expect(generate({id:'g',type:'linear'}, text('words')).map(v => v.content)).toEqual(['A\u0301','👨‍👩‍👧‍👦','next']);
    expect(generate({id:'g',type:'linear'}, text('characters')).map(v => v.content)).toEqual(['A\u0301',' ','👨‍👩‍👧‍👦','\n','n','e','x','t']);
    expect(splitGraphemes('A\u0301 👨‍👩‍👧‍👦', null)).toEqual(['A\u0301',' ','👨‍👩‍👧‍👦']);
  });
  it('keeps scatter bounded and reproducible', () => {
    const g = {id:'s',type:'scatter',seed:42,count:20,bounds:{x:10,y:20,width:30,height:40}} as Generator;
    const a=generate(g), b=generate(g);
    expect(a).toEqual(b);
    expect(a.every(v => v.position.x>=10 && v.position.x<=40 && v.position.y>=20 && v.position.y<=60)).toBe(true);
  });
  it('provides repeatable PRNG and continuous bounded noise', () => {
    expect([createRandom(7)(), createRandom(7)()]).toEqual([createRandom(7)(), createRandom(7)()]);
    expect(noise1D(2, 1.01)).toBeCloseTo(noise1D(2, 1), 1);
    expect(noise1D(2, 10)).toBeGreaterThanOrEqual(-1);
    expect(noise1D(2, 10)).toBeLessThanOrEqual(1);
  });
});
