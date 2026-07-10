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
    else if (instance.type === 'line') { const item = instance as RenderInstance & Extract<Element, { type: 'line' }>; context.moveTo(0, 0); context.lineTo(item.x2 - item.x, item.y2 - item.y); }
    else if (instance.type === 'polygon') { const item = instance as RenderInstance & Extract<Element, { type: 'polygon' }>; item.points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.closePath(); }
    else if (instance.type === 'star') {
      const item = instance as RenderInstance & Extract<Element, { type: 'star' }>;
      for (let index = 0; index < item.points * 2; index += 1) {
        const angle = -Math.PI / 2 + index * Math.PI / item.points;
        const radius = index % 2 ? item.innerRadius : item.outerRadius;
        const point = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
        if (index) context.lineTo(point.x, point.y); else context.moveTo(point.x, point.y);
      }
      context.closePath();
    }
    else throw new Error(`Unsupported render instance type: ${(instance as { type?: unknown }).type ?? 'unknown'}`);
    const painted = instance as RenderInstance & { fill?: string; stroke?: string; strokeWidth?: number };
    if (painted.fill) { context.fillStyle = painted.fill; context.fill(); }
    if (painted.stroke) { context.strokeStyle = painted.stroke; context.lineWidth = painted.strokeWidth ?? 1; context.stroke(); }
  }
}
