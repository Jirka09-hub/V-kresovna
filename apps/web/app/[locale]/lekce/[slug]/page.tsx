import { getLesson, PILOT_MODULE } from '@vykresovna/content'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { use } from 'react'
import { LessonLoader } from '@/components/Loaders'
import { btnSecondary } from '@/components/ui'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

type Params = Promise<{ locale: string; slug: string }>

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    PILOT_MODULE.lessons.map((l) => ({ locale, slug: l.slug })),
  )
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params
  if (!getLesson(slug)) return {}
  const t = await getTranslations({ locale, namespace: 'lessons' })
  return { title: t(`items.${slug}.title`) }
}

/** Lekce: výklad s 3D, úlohy podle plánu a shrnutí. Postup se zatím neukládá. */
export default function LessonPage({ params }: { params: Params }) {
  const { locale, slug } = use(params)
  setRequestLocale(locale)
  const t = useTranslations('lessons')
  const found = getLesson(slug)
  if (!found) notFound()
  const n = found.module.lessons.indexOf(found.lesson) + 1
  const available = found.lesson.status === 'available'
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-8">
      <header className="flex flex-col gap-1">
        <Link href="/lekce" className="text-sm text-accent hover:underline">
          {t('backToOverview')}
        </Link>
        <p className="text-sm font-semibold text-muted">{t('lessonNumber', { n })}</p>
        <h1 className="text-2xl font-bold sm:text-3xl">{t(`items.${slug}.title`)}</h1>
        <p className="max-w-3xl text-muted">{t(`items.${slug}.summary`)}</p>
      </header>
      {available ? (
        <LessonLoader slug={slug} />
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
          <p data-testid="coming-soon">{t('comingSoonText')}</p>
          <Link href="/lekce" className={btnSecondary}>
            {t('backToOverview')}
          </Link>
        </div>
      )}
    </main>
  )
}
