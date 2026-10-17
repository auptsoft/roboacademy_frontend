import * as THREE from 'three'
import { ARM_GEOMETRY as G } from '../../robots/arm'
import { DEG_TO_RAD } from '../geometry'
import type { RobotLook, RobotModel } from './models'

const JOINT_COLOR = '#1d232a'

/**
 * The robot arm, as a chain of groups - base, turret, shoulder, elbow, wrist - each turned by its
 * joint, so posing it is setting one angle per group. Its parts match the physics bodies.
 */
export function buildArmModel(look: RobotLook): RobotModel {
  const linkColor = look.color ?? '#2f6fec'
  const material = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
  const box = (x: number, y: number, z: number, color: string) => new THREE.Mesh(new THREE.BoxGeometry(x, y, z), material(color))
  const hinge = () => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(G.link * 0.7, G.link * 0.7, G.link * 1.2, 16), material(JOINT_COLOR))
    mesh.rotation.x = Math.PI / 2
    return mesh
  }

  const root = new THREE.Group()
  const base = new THREE.Mesh(new THREE.CylinderGeometry(G.baseRadius, G.baseRadius, G.baseHeight, 28), material('#5b6b7b'))
  base.position.y = G.baseHeight / 2
  root.add(base)

  const turret = new THREE.Group()
  const turretBody = box(0.07, G.shoulderHeight - G.baseHeight, 0.07, linkColor)
  turretBody.position.y = (G.baseHeight + G.shoulderHeight) / 2
  turret.add(turretBody)
  // A pointer on the turret, so which way the arm faces is readable from above.
  const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.03, 3), material('#ffd23f'))
  pointer.rotation.z = -Math.PI / 2
  pointer.position.set(0.05, G.baseHeight + 0.01, 0)
  turret.add(pointer)
  root.add(turret)

  const shoulder = new THREE.Group()
  shoulder.position.y = G.shoulderHeight
  shoulder.add(hinge())
  const upperArm = box(G.upperArm, G.link, G.link, linkColor)
  upperArm.position.x = G.upperArm / 2
  shoulder.add(upperArm)
  turret.add(shoulder)

  const elbow = new THREE.Group()
  elbow.position.x = G.upperArm
  elbow.add(hinge())
  const forearm = box(G.forearm, G.link, G.link, linkColor)
  forearm.position.x = G.forearm / 2
  elbow.add(forearm)
  shoulder.add(elbow)

  const wrist = new THREE.Group()
  wrist.position.x = G.forearm
  wrist.add(hinge())
  const palmLength = G.hand - G.fingerLength
  const palm = box(palmLength, G.link, G.gripperOpen + G.finger * 2, JOINT_COLOR)
  palm.position.x = palmLength / 2
  wrist.add(palm)
  const fingers = [-1, 1].map((side) => {
    const finger = box(G.fingerLength, G.link * 0.8, G.finger, '#ffd23f')
    finger.position.x = G.hand - G.fingerLength / 2
    finger.userData.side = side
    wrist.add(finger)
    return finger
  })
  elbow.add(wrist)

  return {
    object: root,
    restHeight: 0,
    color: linkColor,
    update: (state) => {
      const angle = (name: string) => (state.joints[name] ?? 0) * DEG_TO_RAD
      turret.rotation.y = angle('base')
      shoulder.rotation.z = angle('shoulder')
      elbow.rotation.z = angle('elbow')
      wrist.rotation.z = angle('wrist')
      const gap = state.gripper ?? G.gripperOpen
      for (const finger of fingers) finger.position.z = finger.userData.side * (gap / 2 + G.finger / 2)
    },
  }
}
