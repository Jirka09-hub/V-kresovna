'use client'

import type { PartRenderData } from '@vykresovna/engine'
import { CameraControls, GizmoHelper, GizmoViewcube, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { boundsOf, ENGINE_TO_THREE_ROTATION, ISO_DIRECTION, type Bounds } from './coords'
import { DEFAULT_COLORS, PartModel, type ViewerColors } from './PartModel'
import { frontCameraTarget, UnfoldStage } from './UnfoldStage'
import { unfoldPhase } from './unfold'

/** Popisky stěn kostky orientace (texty dodává aplikace přes i18n). */
export type ViewCubeLabels = {
  right: string
  left: string
  top: string
  bottom: string
  front: string
  back: string
}

export type PartViewerProps = {
  data: PartRenderData
  cubeLabels: ViewCubeLabels
  /** Rentgen: skryté hrany čárkovaně přes těleso. */
  xray?: boolean
  /** Animace rozložení pohledů 0–1; undefined = bez průměten. */
  unfoldProgress?: number
  /** Hrany zvýrazněné ve 3D (např. podle najetí myší ve 2D výkresu). */
  highlightedEdgeIds?: readonly string[]
  onHoverEdge?: (edgeId: string | null) => void
  colors?: Partial<ViewerColors>
  className?: string
  /** Popis plátna pro čtečky obrazovky. */
  ariaLabel?: string
}

export type PartViewerHandle = {
  /** Vrátí kameru do výchozího pohledu. */
  reset: () => void
}

const EMPTY: readonly string[] = []

type ControlsApi = {
  setLookAt: (...args: [number, number, number, number, number, number, boolean]) => Promise<void>
}

/** Ovládání kamery uvnitř plátna: výchozí pohled a přesun před výkres při animaci rozložení. */
function CameraRig({
  bounds,
  frontView,
  resetToken,
}: {
  bounds: Bounds
  frontView: boolean
  resetToken: number
}) {
  const controls = useThree((s) => s.controls) as unknown as ControlsApi | null
  const invalidate = useThree((s) => s.invalidate)
  const first = useRef(true)

  useEffect(() => {
    if (!controls) return
    const animate = !first.current
    first.current = false
    if (frontView) {
      // souřadnice enginu → three.js: (x, y, z) → (x, z, −y)
      const { target, distance } = frontCameraTarget(bounds)
      const t = [target[0], target[2], -target[1]] as const
      void controls.setLookAt(t[0], t[1], t[2] + distance, t[0], t[1], t[2], animate)
    } else {
      const d = bounds.radius * 4.2
      const len = Math.hypot(...ISO_DIRECTION)
      const [x, y, z] = ISO_DIRECTION.map((c) => (c / len) * d) as [number, number, number]
      void controls.setLookAt(x, y, z, 0, 0, 0, animate)
    }
    invalidate()
  }, [controls, frontView, bounds, resetToken, invalidate])
  return null
}

export const PartViewer = forwardRef<PartViewerHandle, PartViewerProps>(function PartViewer(
  {
    data,
    cubeLabels,
    xray = false,
    unfoldProgress,
    highlightedEdgeIds = EMPTY,
    onHoverEdge,
    colors: colorOverrides,
    className,
    ariaLabel,
  },
  ref,
) {
  const bounds = useMemo(() => boundsOf(data), [data])
  const colors = { ...DEFAULT_COLORS, ...colorOverrides }
  const [dpr, setDpr] = useState(1.5)
  const [resetToken, setResetToken] = useState(0)
  useImperativeHandle(ref, () => ({ reset: () => setResetToken((t) => t + 1) }), [])

  const phase = unfoldProgress === undefined ? null : unfoldPhase(unfoldProgress)
  const faces = [
    cubeLabels.right,
    cubeLabels.left,
    cubeLabels.top,
    cubeLabels.bottom,
    cubeLabels.front,
    cubeLabels.back,
  ]

  return (
    <div className={className} role="img" aria-label={ariaLabel}>
      <Canvas
        frameloop="demand"
        dpr={dpr}
        camera={{ fov: 32, near: 1, far: 5000, position: [200, 200, 260] }}
        gl={{ antialias: true, powerPreference: 'default' }}
      >
        <PerformanceMonitor
          onDecline={() => setDpr(1)}
          onIncline={() => setDpr(Math.min(2, window.devicePixelRatio))}
        />
        <color attach="background" args={['#eef2f7']} />
        <ambientLight intensity={0.55} />
        <hemisphereLight args={['#ffffff', '#94a3b8', 0.6]} />
        <directionalLight position={[120, 200, 160]} intensity={1.4} />
        <directionalLight position={[-150, 60, -120]} intensity={0.45} />
        <group rotation={ENGINE_TO_THREE_ROTATION}>
          <PartModel
            data={data}
            bounds={bounds}
            colors={colors}
            xray={xray}
            opacity={phase ? phase.body : 1}
            highlightedEdgeIds={highlightedEdgeIds}
            edgeWidth={dpr > 1.2 ? 1.8 : 1.4}
            {...(onHoverEdge ? { onHoverEdge } : {})}
          />
          {unfoldProgress !== undefined ? (
            <UnfoldStage data={data} bounds={bounds} progress={unfoldProgress} colors={colors} />
          ) : null}
        </group>
        <CameraControls
          makeDefault
          minDistance={bounds.radius * 1.2}
          maxDistance={bounds.radius * 20}
        />
        <CameraRig
          bounds={bounds}
          frontView={phase?.cameraFront ?? false}
          resetToken={resetToken}
        />
        <GizmoHelper alignment="top-right" margin={[64, 64]}>
          <GizmoViewcube
            faces={faces}
            font="bold 19px Arial, sans-serif"
            color="#ffffff"
            hoverColor="#bfdbfe"
            textColor="#0f172a"
            strokeColor="#64748b"
          />
        </GizmoHelper>
      </Canvas>
    </div>
  )
})
