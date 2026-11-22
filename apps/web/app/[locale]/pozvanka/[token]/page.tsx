import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AuthCard } from '@/components/auth/AuthForms'
import { JoinPanel, StatusMessage } from '@/components/auth/JoinPanel'
import { getViewer } from '@/lib/auth/viewer'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>
}) {
  const { locale, token } = await params
  setRequestLocale(locale)
  const t = await getTranslations('auth.invitation')
  const tr = await getTranslations('roles')
  const supabase = await createClient()
  const [{ data }, viewer] = await Promise.all([
    supabase.rpc('invitation_preview', { p_token: token }),
    getViewer(),
  ])
  const preview = data?.[0]
  return (
    <AuthCard title={t('title')}>
      {preview?.status === 'ok' && preview.role ? (
        <>
          <p className="text-base">
            {preview.group_name
              ? t('targetGroup', {
                  org: preview.org_name ?? '',
                  group: preview.group_name,
                  role: tr(preview.role),
                })
              : t('target', { org: preview.org_name ?? '', role: tr(preview.role) })}
          </p>
          <JoinPanel
            kind="invitation"
            secret={token}
            viewer={viewer}
            returnTo={`/pozvanka/${token}`}
            joinLabel={t('accept')}
          />
        </>
      ) : (
        <StatusMessage status={preview?.status ?? 'invalid'} />
      )}
    </AuthCard>
  )
}
