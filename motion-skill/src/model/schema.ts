import { z } from 'zod';

const id = z.string().min(1);
const finite = z.number().finite();
const opacity = finite.min(0).max(1);
const point = z.object({ x: finite, y: finite });
const baseElement = { id, opacity: opacity.optional(), x: finite.optional(), y: finite.optional(), rotation: finite.optional() };

const textElement = z.object({ ...baseElement, type: z.literal('text'), text: z.string(), split: z.enum(['none', 'words', 'characters']).optional(), fill: z.string().optional(), fontFamily: z.string().optional(), fontSize: finite.positive().optional() });
const circleElement = z.object({ ...baseElement, type: z.literal('circle'), radius: finite.nonnegative(), fill: z.string().optional(), stroke: z.string().optional() });
const rectangleElement = z.object({ ...baseElement, type: z.literal('rectangle'), width: finite.nonnegative(), height: finite.nonnegative(), cornerRadius: finite.nonnegative().optional(), fill: z.string().optional(), stroke: z.string().optional() });
const lineElement = z.object({ ...baseElement, type: z.literal('line'), x2: finite, y2: finite, stroke: z.string().optional(), strokeWidth: finite.nonnegative().optional() });
const polygonElement = z.object({ ...baseElement, type: z.literal('polygon'), points: z.array(point).min(3), fill: z.string().optional(), stroke: z.string().optional() });
const starElement = z.object({ ...baseElement, type: z.literal('star'), points: z.number().int().min(2), innerRadius: finite.nonnegative(), outerRadius: finite.nonnegative(), fill: z.string().optional(), stroke: z.string().optional() });
const groupElement = z.object({ ...baseElement, type: z.literal('group'), childIds: z.array(id) });
export const elementSchema = z.discriminatedUnion('type', [textElement, circleElement, rectangleElement, lineElement, polygonElement, starElement, groupElement]);

const generatorBase = { id, count: z.number().int().positive().optional() };
export const generatorSchema = z.discriminatedUnion('type', [
  z.object({ ...generatorBase, type: z.literal('linear'), start: point.optional(), end: point.optional() }),
  z.object({ ...generatorBase, type: z.literal('grid'), columns: z.number().int().positive().optional(), rows: z.number().int().positive().optional(), gapX: finite.optional(), gapY: finite.optional() }),
  z.object({ ...generatorBase, type: z.literal('radial'), center: point.optional(), radius: finite.nonnegative().optional() }),
  z.object({ ...generatorBase, type: z.literal('path'), pathElementId: id, start: opacity.optional(), end: opacity.optional() }),
  z.object({ ...generatorBase, type: z.literal('scatter'), seed: z.number().int(), bounds: z.object({ x: finite, y: finite, width: finite.nonnegative(), height: finite.nonnegative() }).optional() }),
]);

const behaviorBase = { id };
export const behaviorSchema = z.discriminatedUnion('type', [
  z.object({ ...behaviorBase, type: z.literal('wave'), amplitude: finite.optional(), frequency: finite.optional(), phase: finite.optional() }),
  z.object({ ...behaviorBase, type: z.literal('noise'), amplitude: finite.optional(), frequency: finite.optional(), seed: z.number().int() }),
  z.object({ ...behaviorBase, type: z.literal('spring'), stiffness: finite.nonnegative().optional(), damping: finite.nonnegative().optional() }),
  z.object({ ...behaviorBase, type: z.literal('follow'), targetElementId: id }),
  z.object({ ...behaviorBase, type: z.literal('lookAt'), targetElementId: id }),
  z.object({ ...behaviorBase, type: z.literal('attract'), targetElementId: id, strength: finite.optional() }),
  z.object({ ...behaviorBase, type: z.literal('repel'), targetElementId: id, strength: finite.optional() }),
]);

const falloffBase = { id };
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
  }
  scene.elements.forEach((element, index) => { if (element.type === 'group') element.childIds.forEach((childId) => { if (!elementIds.has(childId)) ctx.addIssue({ code: 'custom', path: ['elements', index, 'childIds'], message: 'Unknown child reference' }); }); });
  scene.generators.forEach((generator, index) => { if (generator.type === 'path' && !elementIds.has(generator.pathElementId)) ctx.addIssue({ code: 'custom', path: ['generators', index, 'pathElementId'], message: 'Unknown path reference' }); });
  scene.behaviors.forEach((behavior, index) => { if ('targetElementId' in behavior && !elementIds.has(behavior.targetElementId)) ctx.addIssue({ code: 'custom', path: ['behaviors', index, 'targetElementId'], message: 'Unknown target reference' }); });
});

export type Element = z.infer<typeof elementSchema>;
export type Generator = z.infer<typeof generatorSchema>;
export type Behavior = z.infer<typeof behaviorSchema>;
export type Falloff = z.infer<typeof falloffSchema>;
export type AnimationBinding = z.infer<typeof animationBindingSchema>;
export type Scene = z.infer<typeof sceneSchema>;
