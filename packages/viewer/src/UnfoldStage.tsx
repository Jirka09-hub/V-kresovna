'use client'

import type { ViewName } from '@vykresovna/drafting-standards'
import type { PartRenderData, ViewProjection } from '@vykresovna/engine'
import { viewBasis } from '@vykresovna/engine/projection'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { Bounds } from './coords'
import type { ViewerColors } from './PartModel'
import { unfoldPhase } from './unfold'

type Vec3 = [number, number, number]

/** Rozměry „krabice“ průměten kolem tělesa (v souřadnicích enginu, střed tělesa v počátku). */
export function stageLayout(bounds: Bounds) {
  const [hx, hy, hz] = bounds.half
  const size = Math.max(hx, hy, hz)
  const gap = size * 0.9
  const margin = size * 0.35
  return {
    hx,
    hy,
    hz,
    margin,
    /** nárysna: rovina y = frontY (za tělesem) */
    frontY: hy + gap,
    /** půdorysna: rovina z = topZ (pod tělesem) */
    topZ: -hz - gap,
    /** bokorysna: rovina x = sideX (vpravo od tělesa, kam se promítá pohled zleva) */
    sideX: hx + gap,
  }
}

/** Střed rozloženého výkresu a vzdálenost kamery, aby byl celý vidět zepředu. */
export function frontCameraTarget(bounds: Bounds): { target: Vec3; distance: number } {
  const l = stageLayout(bounds)
  const left = -l.hx - l.margin
  const right = l.sideX + (l.frontY + l.hy + l.margin)
  const top = l.hz + l.margin
  const bottom = l.topZ - (l.frontY + l.hy + l.margin)
  const width = right - left
  const height = top - bottom
  return {
    target: [(left + right) / 2, l.frontY, (top + bottom) / 2],
    distance: Math.max(width, height) * 1.9,
  }
}

function planeLines(
  projection: ViewProjection,
  view: ViewName,
  bounds: Bounds,
  depth: number,
  pivot: Vec3,
) {
  const basis = viewBasis(view)
  const c = bounds.center
  const cu = c[0] * basis.right[0] + c[1] * basis.right[1] + c[2] * basis.right[2]
  const cv = c[0] * basis.up[0] + c[1] * basis.up[1] + c[2] * basis.up[2]
  const visible: number[] = []
  const hidden: number[] = []
  const to3 = (u: number, v: number) => {
    const uu = u - cu
    const vv = v - cv
    return [
      uu * basis.right[0] + vv * basis.up[0] + depth * basis.dir[0] - pivot[0],
      uu * basis.right[1] + vv * basis.up[1] + depth * basis.dir[1] - pivot[1],
      uu * basis.right[2] + vv * basis.up[2] + depth * basis.dir[2] - pivot[2],
    ]
  }
  for (const s of projection.segments) {
    const target = s.visibility === 'visible' ? visible : hidden
    target.push(...to3(s.a[0], s.a[1]), ...to3(s.b[0], s.b[1]))
  }
  const mk = (arr: number[]) => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
    return g
  }
  return { visible: mk(visible), hidden: mk(hidden) }
}

type PlaneProps = {
  corners: [number, number][] // obdélník ve dvou osách roviny
  axes: [0 | 1 | 2, 0 | 1 | 2]
  fixed: { axis: 0 | 1 | 2; value: number }
  pivot: Vec3
}

function planeGeometry({ corners, axes, fixed, pivot }: PlaneProps) {
  const pts: number[] = []
  const quad = [corners[0]!, corners[1]!, corners[2]!, corners[0]!, corners[2]!, corners[3]!]
  for (const [a, b] of quad) {
    const p: Vec3 = [0, 0, 0]
    p[axes[0]] = a
    p[axes[1]] = b
    p[fixed.axis] = fixed.value
    pts.push(p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  g.computeVertexNormals()
  const border = new THREE.BufferGeometry()
  const loop: number[] = []
  for (let i = 0; i < 4; i++) {
    for (const [a, b] of [corners[i]!, corners[(i + 1) % 4]!]) {
      const p: Vec3 = [0, 0, 0]
      p[axes[0]] = a
      p[axes[1]] = b
      p[fixed.axis] = fixed.value
      loop.push(p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2])
    }
  }
  border.setAttribute('position', new THREE.Float32BufferAttribute(loop, 3))
  return { surface: g, border }
}

type StageProps = {
  data: PartRenderData
  bounds: Bounds
  progress: number
  colors: ViewerColors
}

/** Průmětny s pohledy, paprsky a animací sklopení do roviny výkresu (souřadnice enginu). */
export function UnfoldStage({ data, bounds, progress, colors }: StageProps) {
  const phase = unfoldPhase(progress)
  const l = stageLayout(bounds)

  const scene = useMemo(() => {
    const byView = new Map(data.views.map((v) => [v.view, v]))
    const eps = bounds.radius * 0.002
    const frontPivot: Vec3 = [0, 0, 0]
    const topPivot: Vec3 = [0, l.frontY, l.topZ]
    const sidePivot: Vec3 = [l.sideX, l.frontY, 0]
    const front = byView.get('front')
    const top = byView.get('top')
    const left = byView.get('left')
    const frontPlane = planeGeometry({
      corners: [
        [-l.hx - l.margin, l.topZ],
        [l.sideX, l.topZ],
        [l.sideX, l.hz + l.margin],
        [-l.hx - l.margin, l.hz + l.margin],
      ],
      axes: [0, 2],
      fixed: { axis: 1, value: l.frontY },
      pivot: frontPivot,
    })
    const topPlane = planeGeometry({
      corners: [
        [-l.hx - l.margin, -l.hy - l.margin],
        [l.sideX, -l.hy - l.margin],
        [l.sideX, l.frontY],
        [-l.hx - l.margin, l.frontY],
      ],
      axes: [0, 1],
      fixed: { axis: 2, value: l.topZ },
      pivot: topPivot,
    })
    const sidePlane = planeGeometry({
      corners: [
        [-l.hy - l.margin, l.topZ],
        [l.frontY, l.topZ],
        [l.frontY, l.hz + l.margin],
        [-l.hy - l.margin, l.hz + l.margin],
      ],
      axes: [1, 2],
      fixed: { axis: 0, value: l.sideX },
      pivot: sidePivot,
    })
    // čáry pohledů leží těsně před průmětnou (směrem k tělesu)
    const frontLines = front && planeLines(front, 'front', bounds, l.frontY - eps, frontPivot)
    const topLines = top && planeLines(top, 'top', bounds, -l.topZ - eps, topPivot)
    const leftLines = left && planeLines(left, 'left', bounds, l.sideX - eps, sidePivot)

    // promítací paprsky z vrcholů hran tělesa na všechny tři průmětny
    const verts = new Map<string, Vec3>()
    for (const e of data.edges) {
      const n = e.points.length / 3
      if (n > 2) continue // u kružnic by paprsků bylo moc
      for (let i = 0; i < n; i++) {
        const p: Vec3 = [
          e.points[i * 3]! - bounds.center[0],
          e.points[i * 3 + 1]! - bounds.center[1],
          e.points[i * 3 + 2]! - bounds.center[2],
        ]
        verts.set(p.map((x) => x.toFixed(3)).join(','), p)
      }
    }
    const rays: number[] = []
    for (const p of [...verts.values()].slice(0, 48)) {
      rays.push(...p, p[0], l.frontY, p[2])
      rays.push(...p, p[0], p[1], l.topZ)
      rays.push(...p, l.sideX, p[1], p[2])
    }
    const rayGeometry = new THREE.BufferGeometry()
    rayGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rays, 3))

    const dashed = (g: THREE.BufferGeometry | undefined) => {
      if (!g) return null
      const ls = new THREE.LineSegments(
        g,
        new THREE.LineDashedMaterial({
          color: colors.edge,
          dashSize: bounds.radius * 0.045,
          gapSize: bounds.radius * 0.025,
          transparent: true,
        }),
      )
      ls.computeLineDistances()
      return ls
    }
    return {
      frontPivot,
      topPivot,
      sidePivot,
      frontPlane,
      topPlane,
      sidePlane,
      frontLines,
      topLines,
      leftLines,
      frontHidden: dashed(frontLines?.hidden),
      topHidden: dashed(topLines?.hidden),
      leftHidden: dashed(leftLines?.hidden),
      rayGeometry,
    }
  }, [data, bounds, l.frontY, l.topZ, l.sideX, l.hx, l.hy, l.hz, l.margin, colors.edge])

  for (const h of [scene.frontHidden, scene.topHidden, scene.leftHidden]) {
    if (h) (h.material as THREE.LineDashedMaterial).opacity = phase.drawing
  }

  if (phase.planes <= 0.001) return null

  const plane = (
    geo: { surface: THREE.BufferGeometry; border: THREE.BufferGeometry },
    lines: { visible: THREE.BufferGeometry } | undefined,
    hidden: THREE.LineSegments | null,
  ) => (
    <>
      <mesh geometry={geo.surface} renderOrder={-1}>
        <meshBasicMaterial
          color="#f8fafc"
          side={THREE.DoubleSide}
          transparent
          opacity={0.82 * phase.planes}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={geo.border}>
        <lineBasicMaterial color="#94a3b8" transparent opacity={phase.planes} />
      </lineSegments>
      {lines ? (
        <lineSegments geometry={lines.visible}>
          <lineBasicMaterial color={colors.edge} transparent opacity={phase.drawing} />
        </lineSegments>
      ) : null}
      {hidden ? <primitive object={hidden} /> : null}
    </>
  )

  return (
    <group>
      <group position={scene.frontPivot}>
        {plane(scene.frontPlane, scene.frontLines, scene.frontHidden)}
      </group>
      <group position={scene.topPivot} rotation={[phase.fold, 0, 0]}>
        {plane(scene.topPlane, scene.topLines, scene.topHidden)}
      </group>
      <group position={scene.sidePivot} rotation={[0, 0, phase.fold]}>
        {plane(scene.sidePlane, scene.leftLines, scene.leftHidden)}
      </group>
      {phase.rays > 0.01 ? (
        <lineSegments geometry={scene.rayGeometry}>
          <lineBasicMaterial color={colors.highlight} transparent opacity={0.35 * phase.rays} />
        </lineSegments>
      ) : null}
    </group>
  )
}
