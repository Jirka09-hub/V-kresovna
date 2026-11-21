'use client'

import type { PartRenderData } from '@vykresovna/engine'
import { PerspectiveCamera, View } from '@react-three/drei'
import { Canvas, useThree, type RootState } from '@react-three/fiber'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'
import type * as THREE from 'three'
import { boundsOf, ENGINE_TO_THREE_ROTATION, ISO_DIRECTION } from './coords'
import { DEFAULT_COLORS, PartModel } from './PartModel'

/**
 * Galerie několika malých 3D modelů na JEDNOM plátně (jeden WebGL kontext, drei `View`).
 * Šetří slabé školní počítače: místo čtyř plátek jedno, vykreslování jen na vyžádání.
 * Všechny modely se otáčejí společně (stejný úhel pohledu), aby šly snadno porovnat.
 */

export type GalleryRotation = { yaw: number; pitch: number }

const ISO_LEN = Math.hypot(...ISO_DIRECTION)
/** Výchozí natočení odpovídá výchozímu pohledu `PartViewer` (zepředu, shora, zprava). */
export const DEFAULT_GALLERY_ROTATION: GalleryRotation = {
  yaw: Math.atan2(ISO_DIRECTION[0], ISO_DIRECTION[2]),
  pitch: Math.asin(ISO_DIRECTION[1] / ISO_LEN),
}
const PITCH_LIMIT = Math.PI / 2 - 0.05
const FOV = 30

type GalleryState = {
  rotation: GalleryRotation
  rotate: (dYaw: number, dPitch: number) => void
  /** Poloměr, podle kterého se nastaví vzdálenost kamery (stejné měřítko všech modelů). */
  radius: number
}
const GalleryContext = createContext<GalleryState | null>(null)

/** Poloměr obalové koule součásti (mm); pro společné měřítko galerie se bere největší. */
export function partRadius(data: PartRenderData): number {
  return boundsOf(data).radius
}

export type PartGalleryHandle = {
  rotate: (dYaw: number, dPitch: number) => void
  reset: () => void
}

export type PartGalleryProps = {
  /** Obsah galerie (karty s `PartGalleryView`). Plátno leží nad ním a nepřijímá události. */
  children: ReactNode
  /** Poloměr pro společné měřítko (např. největší `partRadius` ze zobrazených modelů). */
  radius: number
  className?: string
  /** Ovládání otáčení z aplikace (tlačítka pro klávesnici). */
  controlsRef?: Ref<PartGalleryHandle>
}

export function PartGallery({ children, radius, className, controlsRef }: PartGalleryProps) {
  const [rotation, setRotation] = useState(DEFAULT_GALLERY_ROTATION)
  const invalidate = useRef<RootState['invalidate'] | null>(null)
  const container = useRef<HTMLDivElement>(null)

  const rotate = useCallback(
    (dYaw: number, dPitch: number) =>
      setRotation((r) => ({
        yaw: r.yaw + dYaw,
        pitch: Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, r.pitch + dPitch)),
      })),
    [],
  )
  const state = useMemo<GalleryState>(
    () => ({ rotation, radius, rotate }),
    [rotation, radius, rotate],
  )
  useImperativeHandle(
    controlsRef,
    () => ({ rotate, reset: () => setRotation(DEFAULT_GALLERY_ROTATION) }),
    [rotate],
  )

  // Změna rozvržení uvnitř galerie (např. zpětná vazba u karty) posune sledované oblasti:
  // překreslit po každém renderu a při změně velikosti.
  useEffect(() => {
    invalidate.current?.()
  })
  useEffect(() => {
    const el = container.current
    if (!el) return
    const ro = new ResizeObserver(() => invalidate.current?.())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <GalleryContext.Provider value={state}>
      <div
        ref={container}
        className={className}
        style={{ position: 'relative' }}
        data-testid="part-gallery"
        data-rotation={`${rotation.yaw.toFixed(3)} ${rotation.pitch.toFixed(3)}`}
      >
        {children}
        <Canvas
          frameloop="demand"
          dpr={[1, 1.5]}
          gl={{ antialias: true, powerPreference: 'default' }}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          onCreated={(s) => {
            invalidate.current = s.invalidate
          }}
        >
          <View.Port />
        </Canvas>
      </div>
    </GalleryContext.Provider>
  )
}

function OrbitCamera({ rotation, distance }: { rotation: GalleryRotation; distance: number }) {
  const ref = useRef<THREE.PerspectiveCamera>(null)
  const invalidate = useThree((s) => s.invalidate)
  useLayoutEffect(() => {
    const cam = ref.current
    if (!cam) return
    const { yaw, pitch } = rotation
    cam.position.set(
      distance * Math.cos(pitch) * Math.sin(yaw),
      distance * Math.sin(pitch),
      distance * Math.cos(pitch) * Math.cos(yaw),
    )
    cam.lookAt(0, 0, 0)
    cam.updateMatrixWorld()
    invalidate()
  }, [rotation, distance, invalidate])
  // Pohled (drei View) se připojí až po prvním snímku a kamera se nastaví jako výchozí až po
  // efektech; s frameloop="demand" je proto potřeba po připojení vyžádat další snímky.
  useEffect(() => {
    let raf = requestAnimationFrame(() => {
      invalidate()
      raf = requestAnimationFrame(() => invalidate())
    })
    const timer = setTimeout(() => invalidate(), 150)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [invalidate])
  return <PerspectiveCamera ref={ref} makeDefault fov={FOV} near={1} far={5000} />
}

/**
 * Obsah pohledů se do plátna dostává přes tunel až po renderu galerie, proto si o nový snímek
 * řekne až obsah sám (po změně modelu nebo zvýraznění).
 */
function InvalidateOnChange({
  data,
  highlightedEdgeIds,
}: {
  data: PartRenderData
  highlightedEdgeIds: readonly string[]
}) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const raf = requestAnimationFrame(() => invalidate())
    return () => cancelAnimationFrame(raf)
  }, [data, highlightedEdgeIds, invalidate])
  return null
}

export type PartGalleryViewProps = {
  data: PartRenderData
  highlightedEdgeIds?: readonly string[]
  className?: string
  /** Popis modelu pro čtečky obrazovky. */
  ariaLabel?: string
}

const EMPTY: readonly string[] = []

/** Jeden model v galerii. Táhnutím myší (prstem) se otáčejí všechny modely najednou. */
export function PartGalleryView({
  data,
  highlightedEdgeIds = EMPTY,
  className,
  ariaLabel,
}: PartGalleryViewProps) {
  const gallery = useContext(GalleryContext)
  if (!gallery) throw new Error('PartGalleryView musí být uvnitř PartGallery')
  const bounds = useMemo(() => boundsOf(data), [data])
  const drag = useRef<{ x: number; y: number } | null>(null)
  const distance = (gallery.radius * 1.12) / Math.sin(((FOV / 2) * Math.PI) / 180)

  return (
    <div
      className={className}
      role="img"
      aria-label={ariaLabel}
      style={{ position: 'relative', touchAction: 'none', cursor: 'grab' }}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        const dx = e.clientX - drag.current.x
        const dy = e.clientY - drag.current.y
        drag.current = { x: e.clientX, y: e.clientY }
        gallery.rotate(-dx * 0.01, dy * 0.01)
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <View style={{ position: 'absolute', inset: 0 }}>
        <color attach="background" args={['#eef2f7']} />
        <OrbitCamera rotation={gallery.rotation} distance={distance} />
        <InvalidateOnChange data={data} highlightedEdgeIds={highlightedEdgeIds} />
        <ambientLight intensity={0.55} />
        <hemisphereLight args={['#ffffff', '#94a3b8', 0.6]} />
        <directionalLight position={[120, 200, 160]} intensity={1.4} />
        <directionalLight position={[-150, 60, -120]} intensity={0.45} />
        <group rotation={ENGINE_TO_THREE_ROTATION}>
          <PartModel
            data={data}
            bounds={bounds}
            colors={DEFAULT_COLORS}
            xray={false}
            opacity={1}
            highlightedEdgeIds={highlightedEdgeIds}
            edgeWidth={1.4}
          />
        </group>
      </View>
    </div>
  )
}
