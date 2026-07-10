import { sceneSchema, type Scene } from './schema';

export interface ValidationResult { valid: boolean; errors: string[] }
export interface CostReport {
  instanceCount: number;
  classification: 'simple' | 'compound';
  limit: 500 | 150;
  suggestedCount?: number;
}

const commonChannels = new Set(['x', 'y', 'rotation', 'scale', 'opacity']);
const typeChannels: Record<Scene['elements'][number]['type'], ReadonlySet<string>> = {
  text: new Set([...commonChannels, 'color', 'letterSpacing', 'lineHeight']),
  circle: new Set([...commonChannels, 'color']),
  rectangle: new Set([...commonChannels, 'color', 'cornerRadius', 'width', 'height']),
  line: new Set([...commonChannels, 'color', 'pathProgress']),
  polygon: new Set([...commonChannels, 'color', 'pathProgress']),
  star: new Set([...commonChannels, 'color', 'pathProgress']),
  group: commonChannels,
};

export function validateScene(scene: Scene): ValidationResult {
  const parsed = sceneSchema.safeParse(scene);
  const errors = parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join('.') || 'scene'}: ${issue.message}`);
  const elements = new Map(scene.elements.map((element) => [element.id, element]));
  scene.animation.forEach((binding, index) => {
    const element = elements.get(binding.elementId);
    if (element) for (const channel of binding.channels) {
      if (!typeChannels[element.type].has(channel)) errors.push(`animation.${index}.channels: channel ${channel} is invalid for ${element.type}`);
    }
  });
  return { valid: errors.length === 0, errors };
}

function generatorCount(generator: Scene['generators'][number]): number {
  if (generator.type === 'grid') return generator.count ?? (generator.columns ?? 1) * (generator.rows ?? 1);
  return generator.count ?? 1;
}

export function estimateSceneCost(scene: Scene): CostReport {
  const instanceCount = scene.generators.reduce((total, generator) => total + generatorCount(generator), 0) || scene.elements.length;
  const behaviorById = new Map(scene.behaviors.map((behavior) => [behavior.id, behavior]));
  const compound = scene.animation.some((binding) => {
    const behavior = behaviorById.get(binding.behaviorId);
    const force = behavior?.type === 'spring' || behavior?.type === 'attract' || behavior?.type === 'repel';
    return force || binding.falloffIds.length >= 2;
  });
  const limit = compound ? 150 : 500;
  return { instanceCount, classification: compound ? 'compound' : 'simple', limit, ...(instanceCount > limit ? { suggestedCount: limit } : {}) };
}
