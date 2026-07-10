import type { RenderInstance } from '../evaluate/scene';
import type { Element, Scene } from '../model/schema';

type Composition = Scene['composition'];

export class CanvasRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly textMetrics = new Map<string, TextMetrics>();
  private backingWidth = 0;
  private backingHeight = 0;
  private pixelRatio = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable');
    this.context = context;
  }

  render(instances: readonly RenderInstance[], composition: Composition, revision = 0): void {
    const ratio = window.devicePixelRatio || 1;
    this.canvas.style.aspectRatio = `${composition.width} / ${composition.height}`;
    const backingWidth = Math.round(composition.width * ratio);
    const backingHeight = Math.round(composition.height * ratio);
    if (backingWidth !== this.backingWidth || backingHeight !== this.backingHeight || ratio !== this.pixelRatio) {
      this.canvas.width = backingWidth;
      this.canvas.height = backingHeight;
      this.backingWidth = backingWidth;
      this.backingHeight = backingHeight;
      this.pixelRatio = ratio;
    }
    const context = this.context;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = composition.background;
    context.fillRect(0, 0, composition.width, composition.height);
    for (const instance of instances) {
      context.save();
      try {
        context.translate(instance.x, instance.y);
        context.rotate(instance.rotation);
        context.scale(instance.scale, instance.scale);
        context.globalAlpha = instance.opacity;
        this.draw(instance);
      } catch (error) {
        throw new Error(`Render failed for instance ${instance.instanceId} at revision ${revision}`, { cause: error });
      } finally {
        context.restore();
      }
    }
  }

  private draw(instance: RenderInstance): void {
    const context = this.context;
    if (instance.type === 'text') {
      const item = instance as RenderInstance & Extract<Element, { type: 'text' }>;
      const content = item.content ?? item.text;
      context.font = `${item.fontSize ?? 32}px ${item.fontFamily ?? 'sans-serif'}`;
      context.fillStyle = item.fill ?? '#fff';
      if ((item.letterSpacing ?? 0) !== 0 || content.includes('\n')) {
        const spacing=item.letterSpacing??0,lines=content.split('\n'),lineHeight=item.lineHeight??item.fontSize??32;
        lines.forEach((line,lineIndex)=>{
          const widths=[...line].map(character=>context.measureText(character).width);
          let cursor=-(widths.reduce((sum,width)=>sum+width,0)+Math.max(0,widths.length-1)*spacing)/2;
          [...line].forEach((character,index)=>{context.fillText(character,cursor,lineIndex*lineHeight);cursor+=widths[index]!+spacing;});
        });
        return;
      }
      const key = `${context.font}|${item.split ?? 'none'}|${content}`;
      let metrics = this.textMetrics.get(key);
      if (metrics) { this.textMetrics.delete(key); this.textMetrics.set(key, metrics); }
      else {
        metrics = context.measureText(content);
        this.textMetrics.set(key, metrics);
        if (this.textMetrics.size > 256) this.textMetrics.delete(this.textMetrics.keys().next().value!);
      }
      context.fillText(content, -metrics.width / 2, 0);
      return;
    }
    context.beginPath();
    if (instance.type === 'circle') context.arc(0, 0, (instance as RenderInstance & Extract<Element, { type: 'circle' }>).radius, 0, Math.PI * 2);
    else if (instance.type === 'rectangle') { const item = instance as RenderInstance & Extract<Element, { type: 'rectangle' }>; context.roundRect(0, 0, item.width, item.height, item.cornerRadius ?? 0); }
    else if (instance.type === 'line') { const item = instance as RenderInstance & Extract<Element, { type: 'line' }>; const progress=item.pathProgress??1; context.moveTo(0, 0); context.lineTo((item.x2-item.x)*progress,(item.y2-item.y)*progress); }
    else if (instance.type === 'polygon') { const item = instance as RenderInstance & Extract<Element, { type: 'polygon' }>; this.drawProgressivePath(item.points,item.pathProgress??1); }
    else if (instance.type === 'star') {
      const item = instance as RenderInstance & Extract<Element, { type: 'star' }>;
      const vertices=[];
      for (let index = 0; index < item.points * 2; index += 1) {
        const angle = -Math.PI / 2 + index * Math.PI / item.points;
        const radius = index % 2 ? item.innerRadius : item.outerRadius;
        const point = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
        vertices.push(point);
      }
      this.drawProgressivePath(vertices,item.pathProgress??1);
    }
    else throw new Error(`Unsupported render instance type: ${(instance as { type?: unknown }).type ?? 'unknown'}`);
    const painted = instance as RenderInstance & { fill?: string; stroke?: string; strokeWidth?: number };
    if (painted.fill) { context.fillStyle = painted.fill; context.fill(); }
    if (painted.stroke) { context.strokeStyle = painted.stroke; context.lineWidth = painted.strokeWidth ?? 1; context.stroke(); }
  }

  private drawProgressivePath(points:readonly {x:number;y:number}[],progress:number):void {
    if(!points.length)return;
    const context=this.context,closed=[...points,points[0]!],lengths=closed.slice(1).map((point,index)=>Math.hypot(point.x-closed[index]!.x,point.y-closed[index]!.y));
    let remaining=lengths.reduce((sum,length)=>sum+length,0)*Math.max(0,Math.min(1,progress));
    context.moveTo(points[0]!.x,points[0]!.y);
    for(let index=0;index<lengths.length&&remaining>0;index++){
      const start=closed[index]!,end=closed[index+1]!,amount=Math.min(1,remaining/lengths[index]!);
      context.lineTo(start.x+(end.x-start.x)*amount,start.y+(end.y-start.y)*amount); remaining-=lengths[index]!;
    }
    if(progress>=1)context.closePath();
  }
}
