import type { Vec2 } from '../scene/types'

export const DEG_TO_RAD = Math.PI / 180
export const RAD_TO_DEG = 180 / Math.PI

/** Unit vector a heading faces, on the floor plane. Heading 0 faces +X, positive is counter-clockwise from above. */
export function headingVector(headingDeg: number): Vec2 {
  const radians = headingDeg * DEG_TO_RAD
  return { x: Math.cos(radians), z: -Math.sin(radians) }
}

/** Heading in degrees, normalised to (-180, 180], from a rotation about Y in radians. */
export function headingFromYaw(yaw: number): number {
  return normaliseDegrees(yaw * RAD_TO_DEG)
}

export function normaliseDegrees(degrees: number): number {
  let result = degrees % 360
  if (result <= -180) result += 360
  if (result > 180) result -= 360
  return result
}

/** Rotation about Y from a quaternion (only yaw matters: the robot never tips). */
export function yawFromQuaternion(q: { x: number; y: number; z: number; w: number }): number {
  return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z))
}

/** Quaternion for a rotation about Y. */
export function yawQuaternion(yaw: number): { x: number; y: number; z: number; w: number } {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }
}

/** Shortest distance from a point to a polyline, on the floor plane. */
export function distanceToPolyline(point: Vec2, points: Vec2[]): number {
  let best = Infinity
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const abx = b.x - a.x
    const abz = b.z - a.z
    const lengthSq = abx * abx + abz * abz
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.z - a.z) * abz) / lengthSq))
    const dx = point.x - (a.x + abx * t)
    const dz = point.z - (a.z + abz * t)
    best = Math.min(best, Math.hypot(dx, dz))
  }
  return best
}
