import type { Metadata } from 'next'
import { useTranslations } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { use } from 'react'
import { DemoLoader } from '@/components/Loaders'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'demo' })
  return { title: t('title') }
}

/** Demo: 3D ukázka a pět úloh, bez přihlášení, nic se neukládá. */
export default function DemoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params)
  setRequestLocale(locale)
  const t = useTranslations('demo')
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1>
        <p className="max-w-3xl text-muted">{t('lead')}</p>
      </header>
      <DemoLoader />
    </main>
  )
}
