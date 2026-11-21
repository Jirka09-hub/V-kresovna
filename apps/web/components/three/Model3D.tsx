'use client'

import type { PartRenderData } from '@vykresovna/engine'
import { PartViewer, type PartViewerHandle, type ViewCubeLabels } from '@vykresovna/viewer'
import { useTranslations } from 'next-intl'
import { useState, type Ref } from 'react'
import { WebGLBoundary } from '@/components/lab/WebGLBoundary'
import { webglSupported } from '@/lib/webgl'

export function useCubeLabels(): ViewCubeLabels {
  const tv = useTranslations('viewer')
  return {
    right: tv('cube.right'),
    left: tv('cube.left'),
    top: tv('cube.top'),
    bottom: tv('cube.bottom'),
    front: tv('cube.front'),
    back: tv('cube.back'),
  }
}

export function NoWebGL({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="flex h-full items-center justify-center p-6 text-center text-sm text-muted"
    >
      {text}
    </div>
  )
}

type Props = {
  data: PartRenderData | null
  ariaLabel: string
  xray?: boolean
  unfoldProgress?: number
  highlightedEdgeIds?: readonly string[]
  onHoverEdge?: (id: string | null) => void
  viewerRef?: Ref<PartViewerHandle>
  className?: string
}

/** 3D prohlížeč součásti s náhradou bez WebGL a stavem načítání. */
export function Model3D({
  data,
  ariaLabel,
  xray = false,
  unfoldProgress,
  highlightedEdgeIds,
  onHoverEdge,
  viewerRef,
  className = '',
}: Props) {
  const t = useTranslations('model3d')
  const tv = useTranslations('viewer')
  const cubeLabels = useCubeLabels()
  const [webgl] = useState(() => webglSupported())
  const fallback = <NoWebGL text={tv('noWebgl')} />
  return (
    <div
      className={`overflow-hidden rounded-lg border border-slate-200 bg-[#eef2f7] ${className}`}
    >
      {!webgl ? (
        fallback
      ) : data ? (
        <WebGLBoundary fallback={fallback}>
          <PartViewer
            ref={viewerRef}
            data={data}
            cubeLabels={cubeLabels}
            xray={xray}
            {...(unfoldProgress !== undefined ? { unfoldProgress } : {})}
            {...(highlightedEdgeIds ? { highlightedEdgeIds } : {})}
            {...(onHoverEdge ? { onHoverEdge } : {})}
            className="h-full w-full"
            ariaLabel={ariaLabel}
          />
        </WebGLBoundary>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted">
          {t('loading')}
        </div>
      )}
    </div>
  )
}
