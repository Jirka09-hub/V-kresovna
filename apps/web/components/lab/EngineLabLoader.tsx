'use client'

import type { PartSpec, SectionTestCase } from '@vykresovna/engine'
import dynamic from 'next/dynamic'

// 3D a Web Worker jen v prohlížeči
const EngineLab = dynamic(() => import('./EngineLab').then((m) => m.EngineLab), { ssr: false })

export function EngineLabLoader({
  parts,
  sections,
}: {
  parts: readonly PartSpec[]
  sections?: readonly SectionTestCase[]
}) {
  return <EngineLab parts={parts} {...(sections ? { sections } : {})} />
}
