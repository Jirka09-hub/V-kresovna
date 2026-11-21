import { lessonTaskCount, PILOT_MODULE } from '@vykresovna/content'
import type { Metadata } from 'next'
import { useTranslations } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { use } from 'react'
import { focusRing } from '@/components/ui'
import { Link } from '@/i18n/navigation'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'lessons' })
  return { title: t('title') }
}

/** Přehled lekcí pilotního modulu. */
export default function LessonsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params)
  setRequestLocale(locale)
  const t = useTranslations('lessons')
  const tm = useTranslations('modules')
  const mod = PILOT_MODULE
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">{t('title')}</p>
        <h1 className="text-2xl font-bold sm:text-3xl">{tm(`${mod.slug}.title`)}</h1>
        <p className="max-w-3xl text-muted">{tm(`${mod.slug}.summary`)}</p>
        <p className="max-w-3xl text-sm text-muted">{t('lead')}</p>
      </header>
      <ol className="grid gap-3 sm:grid-cols-2" data-testid="lesson-list">
        {mod.lessons.map((lesson, i) => {
          const available = lesson.status === 'available'
          const count = lessonTaskCount(lesson)
          const body = (
            <>
              <span className="flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-muted">{t('lessonNumber', { n: i + 1 })}</span>
                {available ? (
                  <span className="text-muted">{t('tasksCount', { count })}</span>
                ) : (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {t('comingSoon')}
                  </span>
                )}
              </span>
              <span className="text-lg font-semibold">{t(`items.${lesson.slug}.title`)}</span>
              <span className="text-sm text-muted">{t(`items.${lesson.slug}.summary`)}</span>
            </>
          )
          return (
            <li key={lesson.slug} data-lesson={lesson.slug} data-status={lesson.status}>
              {available ? (
                <Link
                  href={`/lekce/${lesson.slug}`}
                  className={`flex h-full flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 hover:border-accent hover:shadow-sm ${focusRing}`}
                >
                  {body}
                </Link>
              ) : (
                <div
                  className="flex h-full flex-col gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 opacity-80"
                  aria-disabled="true"
                >
                  {body}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </main>
  )
}
