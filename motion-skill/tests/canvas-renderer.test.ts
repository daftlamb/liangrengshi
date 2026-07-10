import { describe, expect, it, vi } from 'vitest';
import { CanvasRenderer } from '../src/render/canvas-renderer';
import type { RenderInstance } from '../src/evaluate/scene';

function renderer() {
  const context = new Proxy({ measureText:vi.fn((text:string)=>({width:text.length*10})) }, { get(target,key){
    if(key in target)return target[key as keyof typeof target];
    const fn=vi.fn(); Object.assign(target,{[key]:fn}); return fn;
  } }) as unknown as CanvasRenderingContext2D;
  const canvas={style:{},getContext:()=>context,width:0,height:0} as unknown as HTMLCanvasElement;
  vi.stubGlobal('window',{devicePixelRatio:1});
  return {renderer:new CanvasRenderer(canvas),context};
}
const composition={width:200,height:100,background:'#000',duration:1,loop:true,style:'geometric' as const};
const text=(content:string):RenderInstance=>({id:'text',instanceId:`text:${content}`,type:'text',text:content,content,x:0,y:0,rotation:0,scale:1,opacity:1});

describe('CanvasRenderer animated channels',()=>{
  it('throws unsupported types with instance and revision context',()=>{
    const {renderer:r}=renderer();
    const unsupported={instanceId:'future:7',id:'future',type:'future-shape',x:0,y:0,rotation:0,scale:1,opacity:1} as unknown as RenderInstance;
    expect(()=>r.render([unsupported],composition,12)).toThrow(/future:7.*revision 12/u);
  });
  it('uses measured text width for placement and bounds metrics with LRU eviction',()=>{
    const {renderer:r,context}=renderer();
    r.render([text('first')],composition);
    expect(context.fillText).toHaveBeenLastCalledWith('first',-25,0);
    for(let index=0;index<256;index++)r.render([text(`value-${index}`)],composition);
    r.render([text('first')],composition);
    expect(context.measureText).toHaveBeenCalledTimes(258);
  });
  it('renders multiline text with animated letter spacing and line height',()=>{
    const {renderer:r,context}=renderer();
    r.render([{id:'t',instanceId:'t:0',type:'text',text:'AB\nC',content:'AB\nC',x:0,y:0,rotation:0,scale:1,opacity:1,letterSpacing:2,lineHeight:20}] as RenderInstance[],composition);
    expect(context.fillText).toHaveBeenCalledTimes(3);
    expect(context.fillText).toHaveBeenCalledWith('B',expect.any(Number),0);
    expect(context.fillText).toHaveBeenCalledWith('C',expect.any(Number),20);
  });
  it('uses animated rectangle dimensions and corner radius',()=>{
    const {renderer:r,context}=renderer();
    r.render([{id:'r',instanceId:'r:0',type:'rectangle',width:11,height:21,cornerRadius:4,x:0,y:0,rotation:0,scale:1,opacity:1}] as RenderInstance[],composition);
    expect(context.roundRect).toHaveBeenCalledWith(0,0,11,21,4);
  });
  it('draws line and closed geometry only through animated path progress',()=>{
    const {renderer:r,context}=renderer();
    r.render([{id:'l',instanceId:'l:0',type:'line',x:0,y:0,x2:100,y2:0,pathProgress:.25,stroke:'#fff',rotation:0,scale:1,opacity:1}] as RenderInstance[],composition);
    expect(context.lineTo).toHaveBeenCalledWith(25,0);
  });
});
