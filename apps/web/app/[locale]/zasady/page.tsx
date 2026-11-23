import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

type Section = { id: string; title: string; paragraphs: string[] }

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'privacy' })
  return { title: t('title') }
}

/** Zásady zpracování osobních údajů (fáze 5, D-030). Text vlastními slovy, žádné citace předpisů. */
export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('privacy')
  const sections = t.raw('sections') as Section[]
  const fill = (p: string) =>
    p.replace('{controller}', t('controller')).replace('{contact}', t('contact'))

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 sm:px-8 sm:py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold text-balance">{t('title')}</h1>
        <p className="text-lg text-muted">{t('lead')}</p>
        <p className="text-sm text-muted">{t('updated')}</p>
      </header>
      {sections.map((s) => (
        <section
          key={s.id}
          id={s.id}
          aria-labelledby={`${s.id}-title`}
          className="flex flex-col gap-3"
        >
          <h2 id={`${s.id}-title`} className="text-xl font-semibold">
            {s.title}
          </h2>
          {s.paragraphs.map((p, i) => (
            <p key={i} className="leading-relaxed">
              {fill(p)}
            </p>
          ))}
        </section>
      ))}
    </main>
  )
}
