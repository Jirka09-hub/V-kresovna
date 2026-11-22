import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AuthCard } from '@/components/auth/AuthForms'
import { JoinPanel, StatusMessage } from '@/components/auth/JoinPanel'
import { getViewer } from '@/lib/auth/viewer'
import { createAdminClient, hasAdminKey } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function PlatformInvitationPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>
}) {
  const { locale, token } = await params
  setRequestLocale(locale)
  const t = await getTranslations('auth.invitation')
  const valid = hasAdminKey()
    ? (await createAdminClient().rpc('platform_invitation_valid', { p_token: token })).data === true
    : false
  const viewer = await getViewer()
  return (
    <AuthCard title={t('platformTitle')}>
      {valid ? (
        <>
          <p className="text-base">{t('platformTarget')}</p>
          <JoinPanel
            kind="platform"
            secret={token}
            viewer={viewer}
            returnTo={`/platforma/pozvanka/${token}`}
            joinLabel={t('accept')}
          />
        </>
      ) : (
        <StatusMessage status="invalid" />
      )}
    </AuthCard>
  )
}
