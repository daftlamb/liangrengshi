export interface RelationNode { x: number; y: number; radius: number }

export function relationEdge(options: { from: RelationNode; to: RelationNode; clearance: number }) {
  const dx = options.to.x - options.from.x;
  const dy = options.to.y - options.from.y;
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  const startDistance = options.from.radius + options.clearance;
  const endDistance = options.to.radius + options.clearance;
  const start = { x: options.from.x + ux * startDistance, y: options.from.y + uy * startDistance };
  const end = { x: options.to.x - ux * endDistance, y: options.to.y - uy * endDistance };
  return { start, end, arrow: { x: end.x, y: end.y, rotation: Math.atan2(dy, dx) } };
}
