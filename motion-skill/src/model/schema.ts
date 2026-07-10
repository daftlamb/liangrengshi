import { z } from 'zod';

const id = z.string().min(1);
const finite = z.number().finite();
const opacity = finite.min(0).max(1);
const point = z.object({ x: finite, y: finite });
const baseElement = { id, opacity: opacity.optional(), x: finite.optional(), y: finite.optional(), rotation: finite.optional(), scale: finite.nonnegative().optional() };

const textElement = z.object({ ...baseElement, type: z.literal('text'), text: z.string(), split: z.enum(['none', 'lines', 'words', 'characters']).optional(), fill: z.string().optional(), fontFamily: z.string().optional(), fontSize: finite.positive().optional(), letterSpacing: finite.optional(), lineHeight: finite.positive().optional() });
const circleElement = z.object({ ...baseElement, type: z.literal('circle'), radius: finite.nonnegative(), fill: z.string().optional(), stroke: z.string().optional() });
const rectangleElement = z.object({ ...baseElement, type: z.literal('rectangle'), width: finite.nonnegative(), height: finite.nonnegative(), cornerRadius: finite.nonnegative().optional(), fill: z.string().optional(), stroke: z.string().optional() });
const lineElement = z.object({ ...baseElement, type: z.literal('line'), x2: finite, y2: finite, stroke: z.string().optional(), strokeWidth: finite.nonnegative().optional(), pathProgress: opacity.optional() });
const polygonElement = z.object({ ...baseElement, type: z.literal('polygon'), points: z.array(point).min(3), fill: z.string().optional(), stroke: z.string().optional(), pathProgress: opacity.optional() });
const starElement = z.object({ ...baseElement, type: z.literal('star'), points: z.number().int().min(2), innerRadius: finite.nonnegative(), outerRadius: finite.nonnegative(), fill: z.string().optional(), stroke: z.string().optional(), pathProgress: opacity.optional() });
const groupElement = z.object({ ...baseElement, type: z.literal('group'), childIds: z.array(id) });
export const elementSchema = z.discriminatedUnion('type', [textElement, circleElement, rectangleElement, lineElement, polygonElement, starElement, groupElement]);

const generatorBase = { id, elementId: id, count: z.number().int().positive().optional() };
export const generatorSchema = z.discriminatedUnion('type', [
  z.object({ ...generatorBase, type: z.literal('linear'), start: point.optional(), end: point.optional() }),
  z.object({ ...generatorBase, type: z.literal('grid'), columns: z.number().int().positive().optional(), rows: z.number().int().positive().optional(), gapX: finite.optional(), gapY: finite.optional() }),
  z.object({ ...generatorBase, type: z.literal('radial'), center: point.optional(), radius: finite.nonnegative().optional() }),
  z.object({ ...generatorBase, type: z.literal('path'), pathElementId: id, start: opacity.optional(), end: opacity.optional() }),
  z.object({ ...generatorBase, type: z.literal('scatter'), seed: z.number().int(), bounds: z.object({ x: finite, y: finite, width: finite.nonnegative(), height: finite.nonnegative() }).optional() }),
]);

const behaviorBase = { id };
export const behaviorSchema = z.discriminatedUnion('type', [
  z.object({ ...behaviorBase, type: z.literal('wave'), waveform: z.enum(['sine', 'triangle', 'saw']).optional(), amplitude: finite.optional(), frequency: finite.optional(), phase: finite.optional() }),
  z.object({ ...behaviorBase, type: z.literal('noise'), amplitude: finite.optional(), frequency: finite.optional(), seed: z.number().int() }),
  z.object({ ...behaviorBase, type: z.literal('spring'), stiffness: finite.nonnegative().optional(), damping: finite.nonnegative().optional() }),
  z.object({ ...behaviorBase, type: z.literal('follow'), targetElementId: id }),
  z.object({ ...behaviorBase, type: z.literal('lookAt'), targetElementId: id }),
  z.object({ ...behaviorBase, type: z.literal('attract'), targetElementId: id, strength: finite.optional() }),
  z.object({ ...behaviorBase, type: z.literal('repel'), targetElementId: id.optional(), strength: finite.optional() }),
]);

const clamp = z.tuple([opacity, opacity]).refine(([minimum, maximum]) => minimum <= maximum, { message: 'Clamp minimum must not exceed maximum' });
const falloffBase = { id, easing: z.enum(['linear', 'easeIn', 'easeOut', 'easeInOut']).optional(), invert: z.boolean().optional(), clamp: clamp.optional() };
export const falloffSchema = z.discriminatedUnion('type', [
  z.object({ ...falloffBase, type: z.literal('linear'), start: finite.optional(), end: finite.optional() }),
  z.object({ ...falloffBase, type: z.literal('radial'), center: point.optional(), radius: finite.positive().optional() }),
  z.object({ ...falloffBase, type: z.literal('index'), start: opacity.optional(), end: opacity.optional() }),
  z.object({ ...falloffBase, type: z.literal('random'), seed: z.number().int(), min: opacity.optional(), max: opacity.optional() }),
  z.object({ ...falloffBase, type: z.literal('time'), start: finite.nonnegative().optional(), end: finite.nonnegative().optional() }),
]);

export const animationBindingSchema = z.object({
  id, elementId: id, behaviorId: id, falloffIds: z.array(id),
  channels: z.array(z.enum(['x', 'y', 'rotation', 'scale', 'opacity', 'color', 'letterSpacing', 'lineHeight', 'cornerRadius', 'width', 'height', 'pathProgress'])),
  role: z.enum(['primary', 'supporting']),
});

export const sceneSchema = z.object({
  metadata: z.object({ schemaVersion: z.literal(1), revision: z.number().int().nonnegative(), seed: z.number().int(), name: z.string().min(1) }),
  composition: z.object({ width: finite.positive(), height: finite.positive(), background: z.string(), duration: finite.positive(), loop: z.boolean(), style: z.enum(['editorial', 'kinetic-type', 'geometric', 'organic', 'chaotic']) }),
  elements: z.array(elementSchema), generators: z.array(generatorSchema), behaviors: z.array(behaviorSchema), falloffs: z.array(falloffSchema), animation: z.array(animationBindingSchema),
}).superRefine((scene, ctx) => {
  const elementIds = new Set(scene.elements.map(({ id }) => id));
  const behaviorIds = new Set(scene.behaviors.map(({ id }) => id));
  const falloffIds = new Set(scene.falloffs.map(({ id }) => id));
  const allIds = [...scene.elements, ...scene.generators, ...scene.behaviors, ...scene.falloffs, ...scene.animation].map(({ id }) => id);
  if (new Set(allIds).size !== allIds.length) ctx.addIssue({ code: 'custom', message: 'IDs must be unique' });
  const primaryBindings = scene.animation.filter(({ role }) => role === 'primary').length;
  const supportingBindings = scene.animation.filter(({ role }) => role === 'supporting').length;
  if (primaryBindings > 1) ctx.addIssue({ code: 'custom', path: ['animation'], message: 'At most one primary animation binding is allowed' });
  if (supportingBindings > 2) ctx.addIssue({ code: 'custom', path: ['animation'], message: 'At most two supporting animation bindings are allowed' });
  for (const [index, binding] of scene.animation.entries()) {
    if (!elementIds.has(binding.elementId)) ctx.addIssue({ code: 'custom', path: ['animation', index, 'elementId'], message: 'Unknown element reference' });
    if (!behaviorIds.has(binding.behaviorId)) ctx.addIssue({ code: 'custom', path: ['animation', index, 'behaviorId'], message: 'Unknown behavior reference' });
    binding.falloffIds.forEach((falloffId, falloffIndex) => { if (!falloffIds.has(falloffId)) ctx.addIssue({ code: 'custom', path: ['animation', index, 'falloffIds', falloffIndex], message: 'Unknown falloff reference' }); });
    const element=scene.elements.find(item=>item.id===binding.elementId);
    const common=['x','y','rotation','scale','opacity'];
    const allowed:Record<Element['type'],string[]>={text:[...common,'color','letterSpacing','lineHeight'],circle:[...common,'color'],rectangle:[...common,'color','cornerRadius','width','height'],line:[...common,'color','pathProgress'],polygon:[...common,'color','pathProgress'],star:[...common,'color','pathProgress'],group:common};
    if(element)binding.channels.forEach((channel,channelIndex)=>{if(!allowed[element.type].includes(channel))ctx.addIssue({code:'custom',path:['animation',index,'channels',channelIndex],message:`Channel ${channel} is invalid for ${element.type}`});});
  }
  scene.elements.forEach((element, index) => { if (element.type === 'group') {
    if (element.childIds.includes(element.id)) ctx.addIssue({ code: 'custom', path: ['elements', index, 'childIds'], message: 'Group cannot reference itself' });
    if (new Set(element.childIds).size !== element.childIds.length) ctx.addIssue({ code: 'custom', path: ['elements', index, 'childIds'], message: 'Group cannot contain duplicate child IDs' });
    element.childIds.forEach((childId) => { if (!elementIds.has(childId)) ctx.addIssue({ code: 'custom', path: ['elements', index, 'childIds'], message: 'Unknown child reference' }); });
  } });
  const parents = new Map<string, number>();
  scene.elements.forEach(element => { if (element.type === 'group') element.childIds.forEach(childId => parents.set(childId,(parents.get(childId)??0)+1)); });
  for (const [childId, count] of parents) if (count > 1) ctx.addIssue({ code: 'custom', path: ['elements'], message: `Element ${childId} may have at most one parent group` });
  const generatorTargets = new Set<string>();
  scene.generators.forEach((generator, index) => {
    const generatorTarget=scene.elements.find(element=>element.id===generator.elementId);
    if (!generatorTarget) ctx.addIssue({ code: 'custom', path: ['generators', index, 'elementId'], message: 'Unknown generator target reference' });
    else if(generatorTarget.type==='group') ctx.addIssue({ code: 'custom', path: ['generators', index, 'elementId'], message: 'Generator target must be drawable, not a group' });
    if (generatorTargets.has(generator.elementId)) ctx.addIssue({ code: 'custom', path: ['generators', index, 'elementId'], message: 'An element may have at most one generator' });
    generatorTargets.add(generator.elementId);
    if (generator.type === 'path') {
      const pathElement = scene.elements.find(({ id }) => id === generator.pathElementId);
      if (!pathElement) ctx.addIssue({ code: 'custom', path: ['generators', index, 'pathElementId'], message: 'Unknown path reference' });
      else if (pathElement.type !== 'line' && pathElement.type !== 'circle' && !(pathElement.type === 'polygon' && pathElement.points.length === 4)) ctx.addIssue({ code: 'custom', path: ['generators', index, 'pathElementId'], message: 'Unsupported path geometry' });
    }
  });
  const groups = new Map(scene.elements.filter((element) => element.type === 'group').map((group) => [group.id, group]));
  const visiting = new Set<string>(); const visited = new Set<string>();
  const visitGroup = (groupId: string): boolean => {
    if (visiting.has(groupId)) return true;
    if (visited.has(groupId)) return false;
    visiting.add(groupId);
    const cyclic = groups.get(groupId)?.childIds.some((childId) => groups.has(childId) && visitGroup(childId)) ?? false;
    visiting.delete(groupId); visited.add(groupId); return cyclic;
  };
  for (const [groupId] of groups) if (visitGroup(groupId)) { ctx.addIssue({ code: 'custom', path: ['elements'], message: 'Group hierarchy cannot contain cycles' }); break; }
  scene.behaviors.forEach((behavior, index) => { if ('targetElementId' in behavior) {
    const target=scene.elements.find(element=>element.id===behavior.targetElementId);
    if (!target) ctx.addIssue({ code: 'custom', path: ['behaviors', index, 'targetElementId'], message: 'Unknown target reference' });
    else if(target.type==='group') ctx.addIssue({ code: 'custom', path: ['behaviors', index, 'targetElementId'], message: 'Behavior target must be drawable, not a group' });
  } });
});

export type Element = z.infer<typeof elementSchema>;
export type Generator = z.infer<typeof generatorSchema>;
export type Behavior = z.infer<typeof behaviorSchema>;
export type Falloff = z.infer<typeof falloffSchema>;
export type AnimationBinding = z.infer<typeof animationBindingSchema>;
export type Scene = z.infer<typeof sceneSchema>;
