'use client'

import {
  HATCH_PHASE,
  HATCH_SPACING_MM,
  SECTION_HATCH_ANGLE_DEG,
} from '@vykresovna/drafting-standards'
import type { PartRenderData } from '@vykresovna/engine'
import { viewBasis } from '@vykresovna/engine/projection'
import { hatchLines, sectionCap, type CutPlane } from '@vykresovna/engine/section'
import { Line } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Bounds } from './coords'
import type { ViewerColors } from './PartModel'
import { axisPositionUnderRay, sectionViewOf, type SectionPlaneState } from './section'

type P3 = [number, number, number]
const AXIS_INDEX = { x: 0, y: 1, z: 2 } as const

type Props = {
  data: PartRenderData
  bounds: Bounds
  colors: ViewerColors
  state: SectionPlaneState
  plane: CutPlane
  /** Krok polohy roviny při tažení (mm). */
  step: number
  onChange?: (at: number) => void
}

/**
 * Plocha řezu a rovina řezu ve 3D (souřadnice enginu, střed tělesa v počátku jako u `PartModel`).
 * Plocha řezu je přesný mnohoúhelník z enginu (stejný výpočet jako ve výkresu) se šrafami pod 45°,
 * takže 3D a 2D řez vždy souhlasí. Rovinu jde posouvat tažením úchytu.
 */
export function SectionStage({ data, bounds, colors, state, plane, step, onChange }: Props) {
  const ai = AXIS_INDEX[state.axis]
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null
  const [hover, setHover] = useState(false)
  const drag = useRef<{ grab: number } | null>(null)
  const group = useRef<THREE.Group>(null)

  const cap = useMemo(
    () => sectionCap({ positions: data.positions, triangles: data.indices }, plane),
    [data, plane],
  )

  const capGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(cap.triangles, 3))
    g.computeVertexNormals()
    return g
  }, [cap])

  // šrafy ve stejných souřadnicích jako pohled v řezu na výkrese (stejný směr i rozteč)
  const hatch = useMemo(() => {
    const basis = viewBasis(sectionViewOf(state))
    const dot = (p: readonly number[], d: readonly number[]) =>
      p[0]! * d[0]! + p[1]! * d[1]! + p[2]! * d[2]!
    const loops = cap.loops.map((l) =>
      l.map((p) => [dot(p, basis.right), dot(p, basis.up)] as const),
    )
    const lines = hatchLines(loops, SECTION_HATCH_ANGLE_DEG, HATCH_SPACING_MM, HATCH_PHASE)
    // kousek před plochou řezu (k pozorovateli), aby čáry nesplývaly s plochou
    const lift = cap.normal.map((c) => c * Math.max(0.02, bounds.radius * 1e-3)) as P3
    const to3 = (q: readonly [number, number]): P3 => {
      const p: P3 = [0, 0, 0]
      for (let k = 0; k < 3; k++) {
        p[k] = q[0] * basis.right[k]! + q[1] * basis.up[k]! + lift[k]!
      }
      p[ai] = cap.at + lift[ai]!
      return p
    }
    return lines.flatMap((l) => [to3(l.a), to3(l.b)])
  }, [cap, state, ai, bounds.radius])

  const outline = useMemo(() => {
    const lift = cap.normal.map((c) => c * Math.max(0.02, bounds.radius * 1e-3)) as P3
    return cap.loops.flatMap((loop) =>
      loop.flatMap((p, i) => {
        const q = loop[(i + 1) % loop.length]!
        return [
          [p[0] + lift[0], p[1] + lift[1], p[2] + lift[2]] as P3,
          [q[0] + lift[0], q[1] + lift[1], q[2] + lift[2]] as P3,
        ]
      }),
    )
  }, [cap, bounds.radius])

  // rámeček roviny řezu o kus větší než součást a úchyt v jeho rohu
  const frame = useMemo(() => {
    const { min, max } = data.bbox
    const m = bounds.radius * 0.12
    const others = ([0, 1, 2] as const).filter((k) => k !== ai)
    const [a, b] = others as [0 | 1 | 2, 0 | 1 | 2]
    const corner = (ua: number, ub: number): P3 => {
      const p: P3 = [0, 0, 0]
      p[ai] = state.at
      p[a] = ua
      p[b] = ub
      return p
    }
    const a0 = min[a] - m
    const a1 = max[a] + m
    const b0 = min[b] - m
    const b1 = max[b] + m
    const corners = [corner(a0, b0), corner(a1, b0), corner(a1, b1), corner(a0, b1)]
    const center = corner((a0 + a1) / 2, (b0 + b1) / 2)
    const size: P3 = [0, 0, 0]
    size[a] = a1 - a0
    size[b] = b1 - b0
    return { corners, knob: corner(a1, b1), center, size, a, b }
  }, [data.bbox, bounds.radius, ai, state.at])

  const quadRotation = useMemo((): [number, number, number] => {
    // výchozí rovina three.js leží v XY (normála Z)
    if (state.axis === 'x') return [0, Math.PI / 2, 0]
    if (state.axis === 'y') return [Math.PI / 2, 0, 0]
    return [0, 0, 0]
  }, [state.axis])
  const quadSize: [number, number] =
    state.axis === 'x'
      ? [frame.size[2], frame.size[1]]
      : state.axis === 'y'
        ? [frame.size[0], frame.size[2]]
        : [frame.size[0], frame.size[1]]

  const offset: P3 = [-bounds.center[0], -bounds.center[1], -bounds.center[2]]
  const knobRadius = bounds.radius * 0.055
  const { min, max } = data.bbox
  const clamp = (v: number) => {
    const lo = min[ai] + step
    const hi = max[ai] - step
    const snapped = Math.round(v / step) * step
    return Math.min(hi, Math.max(lo, snapped))
  }

  /** Poloha na ose pod ukazatelem myši (souřadnice enginu). */
  const axisAt = (e: ThreeEvent<PointerEvent>): number | null => {
    const g = group.current
    if (!g) return null
    const inv = g.matrixWorld.clone().invert()
    const ray = e.ray.clone().applyMatrix4(inv)
    return axisPositionUnderRay(
      state.axis,
      frame.knob,
      [ray.origin.x, ray.origin.y, ray.origin.z],
      [ray.direction.x, ray.direction.y, ray.direction.z],
    )
  }

  const capture = (e: ThreeEvent<PointerEvent>, on: boolean) => {
    const target = e.target as unknown as {
      setPointerCapture?: (id: number) => void
      releasePointerCapture?: (id: number) => void
    }
    if (on) target.setPointerCapture?.(e.pointerId)
    else target.releasePointerCapture?.(e.pointerId)
  }

  const knobEvents = onChange
    ? {
        onPointerDown: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          const pos = axisAt(e)
          drag.current = { grab: pos === null ? 0 : pos - state.at }
          capture(e, true)
          if (controls) controls.enabled = false
        },
        onPointerMove: (e: ThreeEvent<PointerEvent>) => {
          if (!drag.current) return
          e.stopPropagation()
          const pos = axisAt(e)
          if (pos === null) return
          const next = clamp(pos - drag.current.grab)
          if (next !== state.at) onChange(next)
        },
        onPointerUp: (e: ThreeEvent<PointerEvent>) => {
          drag.current = null
          capture(e, false)
          if (controls) controls.enabled = true
        },
        onPointerOver: () => {
          setHover(true)
          document.body.style.cursor = 'grab'
        },
        onPointerOut: () => {
          setHover(false)
          document.body.style.cursor = ''
        },
      }
    : {}

  const knobColor = hover ? colors.highlight : colors.sectionPlane
  const arrow = (dir: 1 | -1) => {
    const p: P3 = [...frame.knob]
    p[ai] += dir * knobRadius * 1.9
    const rot: [number, number, number] =
      state.axis === 'x'
        ? [0, 0, dir === 1 ? -Math.PI / 2 : Math.PI / 2]
        : state.axis === 'y'
          ? [0, 0, dir === 1 ? 0 : Math.PI]
          : [dir === 1 ? Math.PI / 2 : -Math.PI / 2, 0, 0]
    return { p, rot }
  }

  return (
    <group ref={group} position={offset}>
      {cap.triangles.length > 0 ? (
        <mesh geometry={capGeometry} renderOrder={1} raycast={() => null}>
          <meshBasicMaterial
            color={colors.section}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
      ) : null}
      {hatch.length > 0 ? (
        <Line points={hatch} segments color={colors.sectionHatch} lineWidth={1} renderOrder={2} />
      ) : null}
      {outline.length > 0 ? (
        <Line points={outline} segments color={colors.edge} lineWidth={1.8} renderOrder={2} />
      ) : null}
      <mesh position={frame.center} rotation={quadRotation} raycast={() => null} renderOrder={4}>
        <planeGeometry args={quadSize} />
        <meshBasicMaterial
          color={colors.sectionPlane}
          transparent
          opacity={0.08}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Line
        points={[...frame.corners, frame.corners[0]!]}
        color={colors.sectionPlane}
        lineWidth={1.5}
        transparent
        opacity={0.8}
        renderOrder={4}
      />
      {onChange ? (
        <group>
          <mesh position={frame.knob} {...knobEvents} renderOrder={5}>
            <sphereGeometry args={[knobRadius, 24, 16]} />
            <meshStandardMaterial color={knobColor} />
          </mesh>
          {([1, -1] as const).map((d) => {
            const { p, rot } = arrow(d)
            return (
              <mesh key={d} position={p} rotation={rot} raycast={() => null}>
                <coneGeometry args={[knobRadius * 0.55, knobRadius * 1.2, 16]} />
                <meshStandardMaterial color={knobColor} />
              </mesh>
            )
          })}
        </group>
      ) : null}
    </group>
  )
}
