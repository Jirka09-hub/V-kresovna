import { useTranslations } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { Suspense, use, type ReactNode } from 'react'
import { AccountDeletedNotice } from '@/components/account/AccountDeletedNotice'
import { LandingSample } from '@/components/landing/LandingSample'
import { PilotCta, PilotForm } from '@/components/pilot/PilotForm'
import { btnSecondary, focusRing, panel } from '@/components/ui'
import { Link } from '@/i18n/navigation'

const STEPS = ['look', 'practice', 'verify'] as const
const COMPANY_POINTS = ['pace', 'noEmail', 'overview', 'certificate'] as const
const SCHOOL_POINTS = ['code', 'generated', 'matrix', 'projection'] as const
const FAQ = ['requirements', 'data', 'minors', 'terms'] as const

const ctaPrimary = `inline-flex items-center justify-center rounded-md bg-accent px-5 py-3 text-base font-semibold text-white hover:bg-blue-800 ${focusRing}`
const ctaSecondary = `inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-ink hover:border-accent ${focusRing}`

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true">
      <path
        d="M4 10.5l4 4 8-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Audience({
  id,
  title,
  lead,
  points,
  cta,
}: {
  id: string
  title: string
  lead: string
  points: readonly string[]
  cta: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`flex flex-col gap-4 p-6 ${panel}`}>
      <h2 id={`${id}-title`} className="text-2xl font-bold">
        {title}
      </h2>
      <p className="text-muted">{lead}</p>
      <ul className="flex flex-col gap-2">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <Check />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-2">{cta}</div>
    </section>
  )
}

/** Úvodní stránka pro firmy a školy (fáze 5, D-031): ukázka, přínosy, otázky, formulář pilotu. */
export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params)
  setRequestLocale(locale)
  const t = useTranslations('home')
  const tp = useTranslations('pilot')

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-10 sm:px-8 sm:py-16">
      <Suspense fallback={null}>
        <AccountDeletedNotice />
      </Suspense>

      <header className="flex flex-col gap-5">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">{t('eyebrow')}</p>
        <h1 className="max-w-3xl text-3xl font-bold text-balance sm:text-5xl">{t('title')}</h1>
        <p className="max-w-2xl text-lg text-muted">{t('lead')}</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/demo" className={ctaPrimary} data-testid="cta-demo">
            {t('ctaDemo')}
          </Link>
          <a href="#pilot" className={ctaSecondary} data-testid="cta-pilot">
            {t('ctaPilot')}
          </a>
        </div>
        <p className="text-sm text-muted">
          {t('ctaDemoText')} {t('heroNote')}
        </p>
      </header>

      <section aria-labelledby="ukazka-title" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="ukazka-title" className="text-2xl font-bold">
            {t('sample.title')}
          </h2>
          <p className="max-w-3xl text-muted">{t('sample.text')}</p>
        </div>
        <LandingSample />
      </section>

      <section aria-labelledby="jak-title" className="flex flex-col gap-6">
        <h2 id="jak-title" className="text-2xl font-bold">
          {t('how.title')}
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s} className={`flex flex-col gap-2 p-6 ${panel}`}>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 font-bold text-accent"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <h3 className="text-lg font-semibold">{t(`how.steps.${s}.title`)}</h3>
              <p className="text-muted">{t(`how.steps.${s}.text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Audience
          id="pro-firmy"
          title={t('companies.title')}
          lead={t('companies.lead')}
          points={COMPANY_POINTS.map((p) => t(`companies.points.${p}`))}
          cta={
            <PilotCta segment="company" className={btnSecondary}>
              {t('companies.cta')}
            </PilotCta>
          }
        />
        <Audience
          id="pro-skoly"
          title={t('schools.title')}
          lead={t('schools.lead')}
          points={SCHOOL_POINTS.map((p) => t(`schools.points.${p}`))}
          cta={
            <PilotCta segment="school" className={btnSecondary}>
              {t('schools.cta')}
            </PilotCta>
          }
        />
      </div>

      <section
        aria-labelledby="modul-title"
        className="flex flex-col items-start gap-3 rounded-lg bg-blue-50 p-6 sm:p-8"
      >
        <h2 id="modul-title" className="text-2xl font-bold">
          {t('module.title')}
        </h2>
        <p className="max-w-3xl text-ink">{t('module.text')}</p>
        <Link href="/lekce" className={ctaSecondary} data-testid="cta-lessons">
          {t('ctaLessons')}
        </Link>
      </section>

      <section aria-labelledby="otazky-title" className="flex flex-col gap-4">
        <h2 id="otazky-title" className="text-2xl font-bold">
          {t('faq.title')}
        </h2>
        <dl className="grid gap-4 md:grid-cols-2">
          {FAQ.map((f) => (
            <div key={f} className={`p-6 ${panel}`}>
              <dt className="font-semibold">{t(`faq.items.${f}.q`)}</dt>
              <dd className="mt-2 text-muted">
                {t(`faq.items.${f}.a`)}
                {f === 'data' ? (
                  <>
                    {' '}
                    <Link href="/zasady" className={`text-accent underline ${focusRing}`}>
                      {t('privacyLink')}
                    </Link>
                  </>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        id="pilot"
        aria-labelledby="pilot-title"
        className={`scroll-mt-6 flex flex-col gap-4 p-6 sm:p-8 ${panel}`}
      >
        <h2 id="pilot-title" className="text-2xl font-bold">
          {tp('title')}
        </h2>
        <p className="text-muted">{tp('lead')}</p>
        <PilotForm />
      </section>
    </main>
  )
}
