import { useTranslations } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { use } from 'react'

export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params)
  setRequestLocale(locale)
  const t = useTranslations('home')

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-16 sm:px-8 sm:py-24">
      <header className="flex flex-col gap-4">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">{t('eyebrow')}</p>
        <h1 className="text-3xl font-bold text-balance sm:text-5xl">{t('title')}</h1>
        <p className="max-w-2xl text-lg text-muted">{t('lead')}</p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold">{t('forCompanies')}</h2>
          <p className="mt-2 text-muted">{t('forCompaniesText')}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold">{t('forSchools')}</h2>
          <p className="mt-2 text-muted">{t('forSchoolsText')}</p>
        </article>
      </section>
      <footer className="text-sm text-muted" data-testid="status">
        {t('status')}
      </footer>
    </main>
  )
}
