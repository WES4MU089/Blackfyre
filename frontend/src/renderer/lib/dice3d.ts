/**
 * 3D Dice Rolling Engine
 * Three.js + Cannon-es physics for pool-based d6 rolling
 * Dice are rigged to land on server-determined faces
 */

import * as THREE from 'three'
import * as CANNON from 'cannon-es'

export interface DiceRollRequest {
  results: number[]    // predetermined result for each die (1-6)
  threshold: number    // success threshold (>= this value = success)
}

export type DieSettleCallback = (index: number, value: number, isSuccess: boolean) => void

// --- Pip layouts for d6 faces (normalized 0-1 coords) ---

function getPipPositions(value: number): [number, number][] {
  const C = 0.5, A = 0.26, B = 0.74
  switch (value) {
    case 1: return [[C, C]]
    case 2: return [[B, A], [A, B]]
    case 3: return [[B, A], [C, C], [A, B]]
    case 4: return [[A, A], [B, A], [A, B], [B, B]]
    case 5: return [[A, A], [B, A], [C, C], [A, B], [B, B]]
    case 6: return [[A, A], [A, C], [A, B], [B, A], [B, C], [B, B]]
    default: return []
  }
}

// --- Face texture generation (dark die with gold pips) ---

function createFaceTexture(value: number): THREE.CanvasTexture {
  const S = 256
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')!

  // Dark wood/stone face
  ctx.fillStyle = '#1a1412'
  ctx.fillRect(0, 0, S, S)

  // Subtle inset border
  ctx.strokeStyle = '#2a1e16'
  ctx.lineWidth = 6
  ctx.strokeRect(6, 6, S - 12, S - 12)

  // Gold pips with radial gradient
  for (const [x, y] of getPipPositions(value)) {
    const px = x * S, py = y * S, r = S * 0.1
    ctx.beginPath()
    ctx.arc(px, py, r, 0, Math.PI * 2)
    const grad = ctx.createRadialGradient(px - 2, py - 2, 0, px, py, r)
    grad.addColorStop(0, '#e8d070')
    grad.addColorStop(0.7, '#c9a84c')
    grad.addColorStop(1, '#907020')
    ctx.fillStyle = grad
    ctx.fill()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  return tex
}

// BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z
// Standard d6 mapping (opposite faces sum to 7):
// +X=3, -X=4, +Y=6, -Y=1, +Z=2, -Z=5
const FACE_ORDER = [3, 4, 6, 1, 2, 5]

function createDieMaterials(): THREE.MeshStandardMaterial[] {
  return FACE_ORDER.map(v => {
    const tex = createFaceTexture(v)
    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.7,
      metalness: 0.05,
    })
  })
}

// Target quaternion: rotation to place face N on top (+Y)
function targetQuatForFace(faceValue: number): THREE.Quaternion {
  const euler: [number, number, number] = (() => {
    switch (faceValue) {
      case 1:  return [Math.PI, 0, 0] as const
      case 2:  return [Math.PI / 2, 0, 0] as const
      case 3:  return [0, 0, -Math.PI / 2] as const
      case 4:  return [0, 0, Math.PI / 2] as const
      case 5:  return [-Math.PI / 2, 0, 0] as const
      case 6:  return [0, 0, 0] as const
      default: return [0, 0, 0] as const
    }
  })()

  const q = new THREE.Quaternion()
  q.setFromEuler(new THREE.Euler(euler[0], euler[1], euler[2]))

  // Random Y rotation so dice don't all align uniformly
  const yRot = new THREE.Quaternion()
  yRot.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2)
  q.premultiply(yRot)

  return q
}

// --- Internal die state ---

interface DieState {
  mesh: THREE.Mesh
  body: CANNON.Body
  targetValue: number
  settled: boolean
  settleFrames: number
  correcting: boolean
  correctionT: number
  startQuat: THREE.Quaternion
  targetQuat: THREE.Quaternion
  highlighted: boolean
}

// --- Main DiceScene class ---

export class DiceScene {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private world: CANNON.World
  private dice: DieState[] = []
  private animId: number | null = null
  private onDieSettle?: DieSettleCallback
  private resolveRoll?: () => void
  private threshold = 4
  private disposed = false
  private diceMaterial: CANNON.Material
  private surfaceMaterial: CANNON.Material
  private lastTime = 0

  constructor(canvas: HTMLCanvasElement, onDieSettle?: DieSettleCallback) {
    this.onDieSettle = onDieSettle

    // --- Renderer ---
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.8

    // --- Scene ---
    this.scene = new THREE.Scene()

    // --- Camera ---
    this.camera = new THREE.PerspectiveCamera(
      45,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      100
    )
    this.camera.position.set(0, 10, 7)
    this.camera.lookAt(0, 0, 0)

    // --- Lighting ---
    // Warm ambient
    this.scene.add(new THREE.AmbientLight(0xfff0e0, 0.4))

    // Main directional (casts shadows)
    const dirLight = new THREE.DirectionalLight(0xffe8c0, 1.2)
    dirLight.position.set(5, 12, 4)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.set(1024, 1024)
    dirLight.shadow.camera.left = -8
    dirLight.shadow.camera.right = 8
    dirLight.shadow.camera.top = 8
    dirLight.shadow.camera.bottom = -8
    dirLight.shadow.camera.near = 1
    dirLight.shadow.camera.far = 30
    this.scene.add(dirLight)

    // Cool fill from opposite side
    const fillLight = new THREE.DirectionalLight(0xc0d0ff, 0.3)
    fillLight.position.set(-4, 8, -3)
    this.scene.add(fillLight)

    // --- Floor mesh ---
    const floorGeo = new THREE.PlaneGeometry(20, 20)
    const floorMeshMat = new THREE.MeshStandardMaterial({
      color: 0x12100e,
      roughness: 0.95,
      metalness: 0,
    })
    const floorMesh = new THREE.Mesh(floorGeo, floorMeshMat)
    floorMesh.rotation.x = -Math.PI / 2
    floorMesh.receiveShadow = true
    this.scene.add(floorMesh)

    // --- Physics world ---
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -35, 0) })
    this.world.allowSleep = true

    this.diceMaterial = new CANNON.Material('dice')
    this.surfaceMaterial = new CANNON.Material('surface')

    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.diceMaterial, this.surfaceMaterial, {
        friction: 0.4,
        restitution: 0.3,
      })
    )
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.diceMaterial, this.diceMaterial, {
        friction: 0.2,
        restitution: 0.4,
      })
    )

    // Floor body
    const floorBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: this.surfaceMaterial,
    })
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    this.world.addBody(floorBody)

    // Invisible walls to keep dice on the table
    const walls: [number, number, number, number, number, number][] = [
      [-5, 0, 0, 0, Math.PI / 2, 0],   // left  → normal +X
      [5, 0, 0, 0, -Math.PI / 2, 0],   // right → normal -X
      [0, 0, -5, 0, 0, 0],             // back  → normal +Z
      [0, 0, 5, 0, Math.PI, 0],        // front → normal -Z
    ]
    for (const [px, py, pz, rx, ry, rz] of walls) {
      const wall = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Plane(),
        material: this.surfaceMaterial,
      })
      wall.position.set(px, py, pz)
      wall.quaternion.setFromEuler(rx, ry, rz)
      this.world.addBody(wall)
    }
  }

  // --- Public API ---

  roll(request: DiceRollRequest): Promise<void> {
    return new Promise(resolve => {
      this.clearDice()
      this.threshold = request.threshold
      this.resolveRoll = resolve

      const { results } = request
      const count = results.length
      const cols = Math.ceil(Math.sqrt(count))
      const rows = Math.ceil(count / cols)
      const spacing = 1.8

      for (let i = 0; i < count; i++) {
        const col = i % cols
        const row = Math.floor(i / cols)
        const offsetX = (cols - 1) * spacing / 2
        const offsetZ = (rows - 1) * spacing / 2

        const x = col * spacing - offsetX + (Math.random() - 0.5) * 0.4
        const z = row * spacing - offsetZ + (Math.random() - 0.5) * 0.4
        const y = 5 + Math.random() * 3

        this.spawnDie(x, y, z, results[i])
      }

      // Adjust camera for dice count
      const extent = Math.max(3, cols * 1.5)
      this.camera.position.set(0, extent * 2.2, extent * 1.5)
      this.camera.lookAt(0, 0, 0)

      if (!this.animId) this.startLoop()
    })
  }

  dispose() {
    this.disposed = true
    if (this.animId) {
      cancelAnimationFrame(this.animId)
      this.animId = null
    }
    this.clearDice()
    this.renderer.dispose()
  }

  // --- Private ---

  private spawnDie(x: number, y: number, z: number, targetValue: number) {
    const size = 0.8

    // Three.js mesh with per-face pip textures
    const geo = new THREE.BoxGeometry(size, size, size)
    const mats = createDieMaterials()
    const mesh = new THREE.Mesh(geo, mats)
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.scene.add(mesh)

    // Cannon-es physics body
    const half = size / 2
    const body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Box(new CANNON.Vec3(half, half, half)),
      material: this.diceMaterial,
      linearDamping: 0.2,
      angularDamping: 0.2,
    })
    body.position.set(x, y, z)
    body.velocity.set(
      (Math.random() - 0.5) * 4,
      -(Math.random() * 3 + 2),
      (Math.random() - 0.5) * 4
    )
    body.angularVelocity.set(
      (Math.random() - 0.5) * 15,
      (Math.random() - 0.5) * 15,
      (Math.random() - 0.5) * 15
    )
    body.quaternion.setFromEuler(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    )
    this.world.addBody(body)

    this.dice.push({
      mesh,
      body,
      targetValue,
      settled: false,
      settleFrames: 0,
      correcting: false,
      correctionT: 0,
      startQuat: new THREE.Quaternion(),
      targetQuat: targetQuatForFace(targetValue),
      highlighted: false,
    })
  }

  private startLoop() {
    this.lastTime = performance.now()
    const fixedStep = 1 / 60
    let accumulator = 0

    const loop = () => {
      if (this.disposed) return
      this.animId = requestAnimationFrame(loop)

      const now = performance.now()
      const dt = Math.min((now - this.lastTime) / 1000, 0.1)
      this.lastTime = now
      accumulator += dt

      // Step physics
      while (accumulator >= fixedStep) {
        this.world.step(fixedStep)
        accumulator -= fixedStep
      }

      let allDone = true

      for (let i = 0; i < this.dice.length; i++) {
        const die = this.dice[i]

        if (!die.highlighted) allDone = false

        if (!die.settled) {
          // Sync Three.js mesh to physics body
          die.mesh.position.set(
            die.body.position.x,
            die.body.position.y,
            die.body.position.z
          )
          die.mesh.quaternion.set(
            die.body.quaternion.x,
            die.body.quaternion.y,
            die.body.quaternion.z,
            die.body.quaternion.w
          )

          // Settle detection: low velocity for sustained frames
          const v = die.body.velocity.length()
          const av = die.body.angularVelocity.length()

          if (v < 0.15 && av < 0.3) {
            die.settleFrames++
            if (die.settleFrames > 20) {
              die.settled = true
              die.correcting = true
              die.correctionT = 0
              die.startQuat.copy(die.mesh.quaternion)
              this.world.removeBody(die.body)
            }
          } else {
            die.settleFrames = 0
          }
        } else if (die.correcting) {
          // Slerp to target face over 0.4s
          die.correctionT += dt / 0.4
          const t = Math.min(1, die.correctionT)
          const eased = t * t * (3 - 2 * t) // smoothstep

          die.mesh.quaternion.slerpQuaternions(die.startQuat, die.targetQuat, eased)

          if (t >= 1) {
            die.correcting = false
            die.highlighted = true

            // Apply highlight glow
            const isSuccess = die.targetValue >= this.threshold
            const materials = die.mesh.material as THREE.MeshStandardMaterial[]
            for (const mat of materials) {
              if (isSuccess) {
                mat.emissive = new THREE.Color(0xc9a84c)
                mat.emissiveIntensity = 0.4
              } else {
                mat.emissive = new THREE.Color(0x1a0505)
                mat.emissiveIntensity = 0.3
                mat.opacity = 0.6
                mat.transparent = true
              }
            }

            this.onDieSettle?.(i, die.targetValue, isSuccess)
          }
        }
      }

      // All dice resolved
      if (allDone && this.dice.length > 0 && this.resolveRoll) {
        const resolve = this.resolveRoll
        this.resolveRoll = undefined
        setTimeout(() => resolve(), 800)
      }

      this.renderer.render(this.scene, this.camera)
    }

    loop()
  }

  private clearDice() {
    for (const die of this.dice) {
      this.scene.remove(die.mesh)
      const mats = die.mesh.material as THREE.MeshStandardMaterial[]
      for (const m of mats) {
        m.map?.dispose()
        m.dispose()
      }
      die.mesh.geometry.dispose()
      if (this.world.bodies.includes(die.body)) {
        this.world.removeBody(die.body)
      }
    }
    this.dice = []
  }
}
