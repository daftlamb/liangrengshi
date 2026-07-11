import jsonPatch, { type Operation } from 'fast-json-patch';
import type { Scene } from './schema';
import { validateScene } from './validate';

export type PreserveConstraint = 'layout' | 'content' | 'palette' | 'timing' | 'motion';

const clone = <T>(value: T): T => structuredClone(value);
const { applyPatch } = jsonPatch;
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

function projection(scene: Scene, constraint: PreserveConstraint): unknown {
  const elements = scene.elements.map((element) => {
    const { id, type } = element;
    if (constraint === 'layout') {
      const layout:Record<string,unknown>={...element};
      delete layout.opacity; delete layout.fill; delete layout.stroke; delete layout.text; delete layout.fontFamily;
      return layout;
    }
    if (constraint === 'palette') return { id, ...('fill' in element ? { fill: element.fill } : {}), ...('stroke' in element ? { stroke: element.stroke } : {}), opacity: element.opacity };
    if (constraint === 'content') return { id, type, ...('text' in element ? { text: element.text } : {}), ...('childIds' in element ? { childIds: element.childIds } : {}) };
    return undefined;
  });
  if (constraint === 'layout') return { width: scene.composition.width, height: scene.composition.height, elements, generators:scene.generators };
  if (constraint === 'palette') return { background: scene.composition.background, elements };
  if (constraint === 'content') return { name: scene.metadata.name, elements };
  if (constraint === 'timing') return {
    duration: scene.composition.duration, loop: scene.composition.loop,
    behaviors:scene.behaviors.map(behavior=>({id:behavior.id,type:behavior.type,...('frequency' in behavior?{frequency:behavior.frequency}:{}),...('phase' in behavior?{phase:behavior.phase}:{}),...(behavior.type==='spring'?{stiffness:behavior.stiffness,damping:behavior.damping}:{}),...(behavior.type==='follow'?{targetElementId:behavior.targetElementId}: {})})),
    falloffs:scene.falloffs.filter(falloff=>falloff.type==='time'),
    animation:scene.animation.map(binding=>({id:binding.id,elementId:binding.elementId,behaviorId:binding.behaviorId,falloffIds:binding.falloffIds})),
  };
  return { seed: scene.metadata.seed, generators: scene.generators, behaviors: scene.behaviors, falloffs: scene.falloffs, animation: scene.animation };
}

function assertValid(scene: Scene): void {
  const result = validateScene(scene);
  if (!result.valid) throw new TypeError(`Invalid scene: ${result.errors.join('; ')}`);
}

export class SceneStore {
  private snapshots: Scene[];
  private failed = new Set<number>();
  private nextRevision: number;

  constructor(initial: Scene) {
    assertValid(initial);
    this.snapshots = [clone(initial)];
    this.nextRevision = initial.metadata.revision + 1;
  }

  current(): Scene { return clone(this.snapshots.at(-1)!); }

  apply(operations: readonly Operation[], preserve: readonly PreserveConstraint[]): Scene {
    const before = this.current();
    const candidate = applyPatch(clone(before), Array.from(clone(operations)), true, false).newDocument as Scene;
    return this.accept(candidate, preserve, before);
  }

  replace(scene: Scene): Scene { return this.accept(clone(scene), [], this.current()); }

  undo(): Scene {
    if (this.snapshots.length < 2) throw new Error('No revision to undo');
    const target = [...this.snapshots].slice(0, -1).reverse().find((scene) => !this.failed.has(scene.metadata.revision));
    if (!target) throw new Error('No revision to undo');
    return this.accept(clone(target), [], this.current());
  }

  markRenderFailed(revision: number): Scene {
    const active = this.snapshots.at(-1)!;
    if (active.metadata.revision !== revision) throw new Error(`Revision ${revision} is not active`);
    const target = [...this.snapshots].reverse().find((scene) => scene.metadata.revision < revision && !this.failed.has(scene.metadata.revision));
    if (!target) throw new Error(`No safe revision exists below ${revision}`);
    const restored = clone(target);
    restored.metadata.revision = this.nextRevision;
    assertValid(restored);

    this.failed.add(revision);
    this.nextRevision += 1;
    this.snapshots.push(clone(restored));
    if (this.snapshots.length > 50) this.snapshots.splice(0, this.snapshots.length - 50);
    return clone(restored);
  }

  private accept(candidate: Scene, preserve: readonly PreserveConstraint[], before: Scene): Scene {
    assertValid(candidate);
    for (const constraint of preserve) if (canonical(projection(before, constraint)) !== canonical(projection(candidate, constraint))) {
      throw new Error(`Cannot preserve ${constraint}`);
    }
    candidate.metadata.revision = this.nextRevision++;
    assertValid(candidate);
    this.snapshots.push(clone(candidate));
    if (this.snapshots.length > 50) this.snapshots.splice(0, this.snapshots.length - 50);
    return clone(candidate);
  }
}
