import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AuthCard, SignInForm } from '@/components/auth/AuthForms'
import { Link, redirect } from '@/i18n/navigation'
import { getViewer } from '@/lib/auth/viewer'

export const dynamic = 'force-dynamic'

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ next?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const { next } = await searchParams
  if (await getViewer()) redirect({ href: '/ucet', locale })
  const t = await getTranslations('auth.signIn')
  return (
    <AuthCard title={t('title')}>
      <p className="text-sm text-slate-700">{t('intro')}</p>
      <SignInForm next={next} />
      <p className="text-sm text-slate-600">{t('forgot')}</p>
      <p className="border-t border-slate-200 pt-4 text-sm text-slate-700">
        {t('noAccount')}{' '}
        <Link href="/pripojit" className="font-medium text-accent underline">
          {t('joinLink')}
        </Link>
      </p>
    </AuthCard>
  )
}
