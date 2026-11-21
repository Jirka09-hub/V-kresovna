'use client'

import type { PartSpec } from '@vykresovna/engine'
import dynamic from 'next/dynamic'

// 3D a Web Worker jen v prohlížeči
const EngineLab = dynamic(() => import('./EngineLab').then((m) => m.EngineLab), { ssr: false })

export function EngineLabLoader({ parts }: { parts: readonly PartSpec[] }) {
  return <EngineLab parts={parts} />
}
