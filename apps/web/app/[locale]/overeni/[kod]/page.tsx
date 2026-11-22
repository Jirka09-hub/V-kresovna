import type { Metadata } from 'next'
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import { VerifyForm } from '@/components/certificate/VerifyForm'
import { CheckIcon, CrossIcon } from '@/components/exercises/icons'
import { panel } from '@/components/ui'
import {
  CERTIFICATE_DATE_FORMAT,
  formatCode,
  normalizeCode,
  scorePercent,
} from '@/lib/certificate/format'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Params = Promise<{ locale: string; kod: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'verify' })
  // ověřovací stránky nepatří do vyhledávačů (jméno držitele)
  return { title: t('title'), robots: { index: false, follow: false } }
}

/**
 * Veřejné ověření certifikátu podle kódu (rpc `verify_certificate`, smí i nepřihlášený). Ukáže jen
 * údaje vytištěné na certifikátu.
 */
export default async function VerifyCodePage({ params }: { params: Params }) {
  const { locale, kod } = await params
  setRequestLocale(locale)
  const t = await getTranslations('verify')
  const tm = await getTranslations('modules')
  const format = await getFormatter()
  const code = normalizeCode(decodeURIComponent(kod))
  const supabase = await createClient()
  const { data, error } = code
    ? await supabase.rpc('verify_certificate', { p_code: code })
    : { data: [], error: null }
  const cert = data?.[0]

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-10 sm:px-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      {cert ? (
        <section
          className="flex flex-col gap-4 rounded-lg border-2 border-green-700 bg-green-50 p-5"
          data-testid="verify-result"
          data-valid="true"
        >
          <p className="flex items-center gap-2 text-lg font-bold text-green-800">
            <CheckIcon className="h-6 w-6" />
            {t('valid')}
          </p>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
            <dt className="text-sm text-slate-600">{t('holder')}</dt>
            <dd className="text-lg font-semibold" data-testid="verify-holder">
              {cert.holder_name}
            </dd>
            {cert.org_name ? (
              <>
                <dt className="text-sm text-slate-600">{t('organization')}</dt>
                <dd>{cert.org_name}</dd>
              </>
            ) : null}
            <dt className="text-sm text-slate-600">{t('module')}</dt>
            <dd>
              {tm.has(`${cert.module_slug}.title`)
                ? tm(`${cert.module_slug}.title`)
                : cert.module_slug}
            </dd>
            <dt className="text-sm text-slate-600">{t('score')}</dt>
            <dd>{t('scoreValue', { percent: scorePercent(cert.score) })}</dd>
            <dt className="text-sm text-slate-600">{t('issued')}</dt>
            <dd>{format.dateTime(new Date(cert.issued_at), CERTIFICATE_DATE_FORMAT)}</dd>
            <dt className="text-sm text-slate-600">{t('code')}</dt>
            <dd className="font-mono tracking-wide">{formatCode(code)}</dd>
          </dl>
          <p className="text-sm text-slate-700">{t('validNote')}</p>
        </section>
      ) : (
        <section
          className="flex flex-col gap-2 rounded-lg border-2 border-red-700 bg-red-50 p-5"
          data-testid="verify-result"
          data-valid="false"
          role="alert"
        >
          <p className="flex items-center gap-2 text-lg font-bold text-red-800">
            <CrossIcon className="h-6 w-6" />
            {error ? t('error') : t('notFound')}
          </p>
          {!error ? <p className="text-sm text-slate-700">{t('notFoundHint')}</p> : null}
        </section>
      )}
      <div className={`${panel} flex flex-col gap-3 p-5`}>
        <h2 className="font-semibold">{t('another')}</h2>
        <VerifyForm />
      </div>
    </main>
  )
}
