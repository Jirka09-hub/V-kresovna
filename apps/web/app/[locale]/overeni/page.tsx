import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { VerifyForm } from '@/components/certificate/VerifyForm'
import { panel } from '@/components/ui'
import { redirect } from '@/i18n/navigation'
import { normalizeCode } from '@/lib/certificate/format'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'verify' })
  return { title: t('title') }
}

/** Veřejné ověření certifikátu: zadání kódu (formulář funguje i bez JavaScriptu). */
export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ kod?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const { kod } = await searchParams
  const code = normalizeCode(kod ?? '')
  if (code) redirect({ href: `/overeni/${code}`, locale })
  const t = await getTranslations('verify')
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-10 sm:px-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted">{t('intro')}</p>
      <div className={`${panel} p-5`}>
        <VerifyForm />
      </div>
    </main>
  )
}
