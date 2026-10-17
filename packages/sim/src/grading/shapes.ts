import type { Vec2 } from '../scene/types'

export type ShapePreset = 'square' | 'triangle' | 'circle' | 'line'

/**
 * Points for a drawing objective's common shapes, `size` across (a circle's diameter, a line's
 * length), centred on `center`. Squares and triangles start at a corner and go round
 * counter-clockwise seen from above, as a robot turning left draws them; circles are 36 sides.
 */
export function shapePoints(preset: ShapePreset, size: number, center: Vec2 = { x: 0, z: 0 }): { shape: Vec2[]; closed: boolean } {
  const at = (x: number, z: number): Vec2 => ({ x: round(center.x + x), z: round(center.z + z) })
  const half = size / 2
  switch (preset) {
    case 'square':
      return { shape: [at(-half, half), at(half, half), at(half, -half), at(-half, -half)], closed: true }
    case 'triangle': {
      // Equilateral, flat side down the screen.
      const height = (size * Math.sqrt(3)) / 2
      return { shape: [at(-half, height / 3), at(half, height / 3), at(0, (-2 * height) / 3)], closed: true }
    }
    case 'circle':
      return {
        shape: Array.from({ length: 36 }, (_, i) => at(half * Math.cos((i * Math.PI) / 18), -half * Math.sin((i * Math.PI) / 18))),
        closed: true,
      }
    case 'line':
      return { shape: [at(-half, 0), at(half, 0)], closed: false }
  }
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000
}
