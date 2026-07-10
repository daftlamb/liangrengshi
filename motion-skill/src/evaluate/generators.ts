import type { Element, Generator, Scene } from '../model/schema';
import { createRandom } from '../math/random';
import { splitGraphemes } from '../text/graphemes';
export { splitGraphemes } from '../text/graphemes';

type Point = { x: number; y: number };
export interface InstanceContext {
  id: string; index: number; count: number;
  baseTransform: { x: number; y: number; rotation: number };
  position: Point; tangent?: number; content?: string;
}
type Composition = Pick<Scene['composition'], 'width' | 'height'>;

function pieces(element: Element): Array<string | undefined> {
  if (element.type !== 'text') return [undefined];
  if (element.split === 'characters') return splitGraphemes(element.text);
  if (element.split === 'words') return element.text.trim() ? element.text.trim().split(/\s+/u) : [];
  if (element.split === 'lines') return element.text.split(/\r?\n/u);
  return [element.text];
}
const interpolate = (a: number, b: number, t: number) => a + (b - a) * t;
const progress = (index: number, count: number, start = 0, end = 1) => interpolate(start, end, count <= 1 ? 0 : index / (count - 1));

export function generateInstances(generator: Generator, element: Element, composition: Composition, pathElement?: Element): InstanceContext[] {
  if (generator.type === 'path') {
    if (!pathElement || generator.pathElementId !== pathElement.id) throw new Error(`Missing path reference ${generator.pathElementId}`);
    if (pathElement.type !== 'line' && pathElement.type !== 'circle' && !(pathElement.type === 'polygon' && pathElement.points.length === 4)) {
      throw new Error(`Unsupported path geometry: ${pathElement.type}`);
    }
  }
  const split = pieces(element);
  const defaultCount = split.length;
  const count = generator.type === 'grid' && generator.count === undefined
    ? (generator.columns ?? 1) * (generator.rows ?? 1)
    : (generator.count ?? defaultCount);
  const base = { x: element.x ?? 0, y: element.y ?? 0, rotation: element.rotation ?? 0 };
  const random = generator.type === 'scatter' ? createRandom(generator.seed) : undefined;
  return Array.from({ length: count }, (_, index) => {
    let position: Point = { x: base.x, y: base.y };
    let tangent: number | undefined;
    if (generator.type === 'linear') {
      const start = generator.start ?? { x: base.x, y: base.y };
      const end = generator.end ?? { x: composition.width, y: base.y };
      const t = count <= 1 ? 0 : index / (count - 1);
      position = { x: interpolate(start.x, end.x, t), y: interpolate(start.y, end.y, t) };
    } else if (generator.type === 'grid') {
      const columns = generator.columns ?? Math.max(1, Math.ceil(Math.sqrt(count)));
      position = { x: base.x + (index % columns) * (generator.gapX ?? 0), y: base.y + Math.floor(index / columns) * (generator.gapY ?? 0) };
    } else if (generator.type === 'radial') {
      const center = generator.center ?? { x: composition.width / 2, y: composition.height / 2 };
      const angle = 2 * Math.PI * index / Math.max(1, count);
      const radius = generator.radius ?? 0;
      position = { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
      tangent = angle + Math.PI / 2;
    } else if (generator.type === 'scatter') {
      const bounds = generator.bounds ?? { x: 0, y: 0, width: composition.width, height: composition.height };
      position = { x: bounds.x + random!() * bounds.width, y: bounds.y + random!() * bounds.height };
    } else if (generator.type === 'path') {
      const t = progress(index, count, generator.start, generator.end);
      if (pathElement!.type === 'line') {
        const x1=pathElement!.x??0, y1=pathElement!.y??0;
        position={x:interpolate(x1,pathElement!.x2,t),y:interpolate(y1,pathElement!.y2,t)};
        tangent=Math.atan2(pathElement!.y2-y1,pathElement!.x2-x1);
      } else if (pathElement!.type === 'circle') {
        const angle=t*Math.PI*2, cx=pathElement!.x??0, cy=pathElement!.y??0;
        position={x:cx+Math.cos(angle)*pathElement!.radius,y:cy+Math.sin(angle)*pathElement!.radius}; tangent=angle+Math.PI/2;
      } else if (pathElement!.type === 'polygon' && pathElement!.points.length === 4) {
        const [p0,p1,p2,p3]=pathElement!.points, u=1-t;
        position={x:u**3*p0.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t**3*p3.x,y:u**3*p0.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t**3*p3.y};
        const derivatives = [
          {x:3*u*u*(p1.x-p0.x)+6*u*t*(p2.x-p1.x)+3*t*t*(p3.x-p2.x),y:3*u*u*(p1.y-p0.y)+6*u*t*(p2.y-p1.y)+3*t*t*(p3.y-p2.y)},
          {x:6*u*(p2.x-2*p1.x+p0.x)+6*t*(p3.x-2*p2.x+p1.x),y:6*u*(p2.y-2*p1.y+p0.y)+6*t*(p3.y-2*p2.y+p1.y)},
          {x:6*(p3.x-3*p2.x+3*p1.x-p0.x),y:6*(p3.y-3*p2.y+3*p1.y-p0.y)},
        ];
        const derivativeIndex = derivatives.findIndex(({x,y}) => Math.hypot(x,y) > Number.EPSILON);
        const rawDerivative = derivativeIndex < 0 ? {x:1,y:0} : derivatives[derivativeIndex];
        const direction = t === 1 && derivativeIndex % 2 === 1 ? -1 : 1;
        const derivative = {x:rawDerivative.x*direction,y:rawDerivative.y*direction};
        tangent=Math.atan2(derivative.y,derivative.x);
      }
    }
    return { id: `${element.id}:${index}`, index, count, baseTransform: { ...base, rotation:tangent??base.rotation }, position, tangent, content: split[index % Math.max(1, split.length)] };
  });
}
