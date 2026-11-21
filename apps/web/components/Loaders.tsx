'use client'

import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'

function Loading() {
  const t = useTranslations('common')
  return (
    <p role="status" className="py-16 text-center text-muted">
      {t('loading')}
    </p>
  )
}

// 3D, dnd a Web Worker enginu jen v prohlížeči a až na stránkách, které je potřebují
const DemoPlayer = dynamic(() => import('./demo/DemoPlayer').then((m) => m.DemoPlayer), {
  ssr: false,
  loading: Loading,
})
const LessonPlayer = dynamic(() => import('./lessons/LessonPlayer').then((m) => m.LessonPlayer), {
  ssr: false,
  loading: Loading,
})

export function DemoLoader() {
  return <DemoPlayer />
}

export function LessonLoader({ slug }: { slug: string }) {
  return <LessonPlayer slug={slug} />
}
