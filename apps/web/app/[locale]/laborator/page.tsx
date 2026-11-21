import { SECTION_TEST_CASES, TEST_PARTS } from '@vykresovna/engine/fixtures'
import type { Metadata } from 'next'
import { useTranslations } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { use } from 'react'
import { EngineLabLoader } from '@/components/lab/EngineLabLoader'

export const metadata: Metadata = { robots: { index: false } }

/** Vývojová stránka: 10 testovacích součástí, 3D prohlížeč, výkres a animace rozložení. */
export default function LabPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params)
  setRequestLocale(locale)
  const t = useTranslations('lab')
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1>
        <p className="max-w-3xl text-muted">{t('intro')}</p>
      </header>
      <EngineLabLoader parts={TEST_PARTS} sections={SECTION_TEST_CASES} />
    </main>
  )
}
