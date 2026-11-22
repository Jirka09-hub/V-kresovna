'use client'

import type { PartRenderData } from '@vykresovna/engine'
import type { CutPlane } from '@vykresovna/engine/section'
import { type ThreeEvent } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Bounds } from './coords'
import { clipSegments, worldClippingPlane } from './section'

export type ViewerColors = {
  body: string
  edge: string
  hiddenEdge: string
  highlight: string
  /** Plocha řezu (interaktivní řez). */
  section: string
  /** Šrafy na ploše řezu. */
  sectionHatch: string
  /** Rovina řezu a její úchyt. */
  sectionPlane: string
}

export const DEFAULT_COLORS: ViewerColors = {
  body: '#c9d3df',
  edge: '#18212f',
  hiddenEdge: '#475569',
  highlight: '#1d4ed8',
  section: '#f4d3b8',
  sectionHatch: '#7c2d12',
  sectionPlane: '#2563eb',
}

type Props = {
  data: PartRenderData
  bounds: Bounds
  colors: ViewerColors
  xray: boolean
  opacity: number
  highlightedEdgeIds: readonly string[]
  /** Tloušťka viditelných hran v pixelech. */
  edgeWidth: number
  onHoverEdge?: (edgeId: string | null) => void
  /** Interaktivní řez: materiál před rovinou se nezobrazí (těleso i hrany). */
  clip?: CutPlane | null
}

/** Těleso součásti s hranami. Souřadnice enginu, posunuté tak, aby střed tělesa byl v počátku. */
export function PartModel({
  data,
  bounds,
  colors,
  xray,
  opacity,
  highlightedEdgeIds,
  edgeWidth,
  onHoverEdge,
  clip = null,
}: Props) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    g.setIndex(new THREE.BufferAttribute(data.indices, 1))
    // ostré hrany zůstanou ostré, válce dostanou hladké stínování
    const creased = toCreasedNormals(g, (30 * Math.PI) / 180)
    g.dispose()
    return creased
  }, [data])

  const { edgeGeometry, segmentEdge, segmentPoints } = useMemo(() => {
    const pts: number[] = []
    const segmentEdge: number[] = []
    data.edges.forEach((e, ei) => {
      const n = e.points.length / 3
      const count = e.closed ? n : n - 1
      for (let i = 0; i < count; i++) {
        const j = (i + 1) % n
        pts.push(e.points[i * 3]!, e.points[i * 3 + 1]!, e.points[i * 3 + 2]!)
        pts.push(e.points[j * 3]!, e.points[j * 3 + 1]!, e.points[j * 3 + 2]!)
        segmentEdge.push(ei)
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    let segmentPoints: [number, number, number][] = []
    for (let i = 0; i < pts.length; i += 3) segmentPoints.push([pts[i]!, pts[i + 1]!, pts[i + 2]!])
    let edges = segmentEdge
    if (clip) {
      // řez: hrany před rovinou se nekreslí, protnuté se zkrátí
      const clipped = clipSegments(segmentPoints, clip)
      segmentPoints = clipped.points
      edges = clipped.source.map((s) => segmentEdge[s]!)
      g.setAttribute('position', new THREE.Float32BufferAttribute(segmentPoints.flat(), 3))
    }
    return { edgeGeometry: g, segmentEdge: edges, segmentPoints }
  }, [data, clip])

  const clippingPlanes = useMemo(
    () => (clip ? [worldClippingPlane(clip, bounds)] : null),
    [clip, bounds],
  )

  // zásah myší jen do zobrazené části tělesa (odebraný materiál paprsek ignoruje)
  const raycast = useMemo(() => {
    const plane = clippingPlanes?.[0] ?? null
    return function (this: THREE.Mesh, raycaster: THREE.Raycaster, hits: THREE.Intersection[]) {
      if (!plane) return THREE.Mesh.prototype.raycast.call(this, raycaster, hits)
      const all: THREE.Intersection[] = []
      THREE.Mesh.prototype.raycast.call(this, raycaster, all)
      for (const h of all) if (plane.distanceToPoint(h.point) >= -1e-6) hits.push(h)
    }
  }, [clippingPlanes])

  const highlightLines = useMemo(() => {
    const wanted = new Set(highlightedEdgeIds)
    return data.edges
      .filter((e) => wanted.has(e.id))
      .map((edge) => {
        const n = edge.points.length / 3
        const pts: [number, number, number][] = []
        for (let i = 0; i < (edge.closed ? n + 1 : n); i++) {
          const k = i % n
          pts.push([edge.points[k * 3]!, edge.points[k * 3 + 1]!, edge.points[k * 3 + 2]!])
        }
        if (!clip) return { id: edge.id, pts, segments: false }
        const pairs = pts.slice(1).flatMap((p, i) => [pts[i]!, p])
        return { id: edge.id, pts: clipSegments(pairs, clip).points, segments: true }
      })
      .filter((h) => h.pts.length >= 2)
  }, [data, highlightedEdgeIds, clip])

  const hiddenLines = useMemo(() => {
    const lines = new THREE.LineSegments(
      edgeGeometry,
      new THREE.LineDashedMaterial({
        color: colors.hiddenEdge,
        dashSize: bounds.radius * 0.05,
        gapSize: bounds.radius * 0.03,
        depthFunc: THREE.GreaterDepth,
        depthWrite: false,
        transparent: true,
        opacity: 0.85,
      }),
    )
    lines.computeLineDistances()
    lines.renderOrder = 2
    return lines
  }, [edgeGeometry, colors.hiddenEdge, bounds.radius])

  /** Najde hranu nejblíž bodu na povrchu tělesa (hover na hranu bez přesného míření na čáru). */
  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    if (!onHoverEdge) return
    e.stopPropagation()
    const p = e.object.worldToLocal(e.point.clone())
    const pos = edgeGeometry.getAttribute('position') as THREE.BufferAttribute
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const line = new THREE.Line3()
    const closest = new THREE.Vector3()
    let best = Infinity
    let bestEdge = -1
    for (let s = 0; s < segmentEdge.length; s++) {
      a.fromBufferAttribute(pos, s * 2)
      b.fromBufferAttribute(pos, s * 2 + 1)
      line.set(a, b)
      line.closestPointToPoint(p, true, closest)
      const d = closest.distanceTo(p)
      if (d < best) {
        best = d
        bestEdge = segmentEdge[s]!
      }
    }
    const threshold = bounds.radius * 0.06
    onHoverEdge(best < threshold && bestEdge >= 0 ? data.edges[bestEdge]!.id : null)
  }

  const offset: [number, number, number] = [-bounds.center[0], -bounds.center[1], -bounds.center[2]]
  const transparent = xray || opacity < 1

  return (
    <group position={offset}>
      <mesh
        geometry={geometry}
        raycast={raycast}
        onPointerMove={handleMove}
        onPointerOut={() => onHoverEdge?.(null)}
        visible={opacity > 0.01}
      >
        <meshStandardMaterial
          color={colors.body}
          metalness={0.25}
          roughness={0.5}
          transparent={transparent}
          opacity={xray ? 0.35 * opacity : opacity}
          clippingPlanes={clippingPlanes}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      {opacity > 0.01 ? (
        <Line
          points={segmentPoints}
          segments
          color={colors.edge}
          lineWidth={edgeWidth}
          transparent={opacity < 1}
          opacity={opacity}
          renderOrder={1}
        />
      ) : null}
      {xray && opacity > 0.01 ? <primitive object={hiddenLines} /> : null}
      {highlightLines.map((h) => (
        <Line
          key={h.id}
          points={h.pts}
          segments={h.segments}
          color={colors.highlight}
          lineWidth={4}
          depthTest={false}
          renderOrder={3}
        />
      ))}
    </group>
  )
}
