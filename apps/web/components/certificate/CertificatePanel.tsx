'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { btnPrimary } from '@/components/ui'
import { Link } from '@/i18n/navigation'
import { formatCode } from '@/lib/certificate/format'
import { createClient } from '@/lib/supabase/client'
import { CertificateDownload, type CertificateRecord } from './CertificateDownload'

type State =
  | { readonly step: 'ready' | 'issuing' | 'error' }
  | { readonly step: 'issued'; readonly cert: CertificateRecord }

/** Vydání certifikátu po splněném a uloženém závěrečném testu (rpc `issue_certificate`). */
export function CertificatePanel({ runId }: { runId: string }) {
  const t = useTranslations('certificate')
  const [state, setState] = useState<State>({ step: 'ready' })

  const issue = async () => {
    setState({ step: 'issuing' })
    const supabase = createClient()
    const { data: code, error } = await supabase.rpc('issue_certificate', { p_run: runId })
    if (error || !code) return setState({ step: 'error' })
    const { data: row } = await supabase
      .from('certificates')
      .select('holder_name, org_name, module_slug, score, issued_at, verification_code')
      .eq('verification_code', code)
      .maybeSingle()
    if (!row) return setState({ step: 'error' })
    setState({
      step: 'issued',
      cert: {
        holderName: row.holder_name,
        orgName: row.org_name,
        moduleSlug: row.module_slug,
        score: row.score,
        issuedAt: row.issued_at,
        code: row.verification_code,
      },
    })
  }

  if (state.step === 'issued') {
    const { cert } = state
    return (
      <div
        className="flex flex-col gap-3 rounded-lg border border-green-700 bg-green-50 p-4"
        data-testid="certificate-issued"
        data-code={cert.code}
      >
        <h3 className="font-semibold">{t('issuedTitle')}</h3>
        <p>
          {t('codeText')}{' '}
          <span className="font-mono font-semibold tracking-wide" data-testid="certificate-code">
            {formatCode(cert.code)}
          </span>
        </p>
        <div className="flex flex-wrap items-start gap-3">
          <CertificateDownload cert={cert} />
          <Link
            href={`/overeni/${cert.code}`}
            className="self-center font-medium text-accent underline"
            data-testid="certificate-verify-link"
          >
            {t('verifyLink')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-2" data-testid="certificate-panel">
      <p>{t('passedIntro')}</p>
      <button
        type="button"
        className={btnPrimary}
        onClick={issue}
        disabled={state.step === 'issuing'}
        aria-busy={state.step === 'issuing'}
        data-testid="certificate-issue"
      >
        {state.step === 'issuing' ? t('issuing') : t('issueButton')}
      </button>
      {state.step === 'error' ? (
        <p role="alert" className="text-sm text-red-700">
          {t('issueError')}
        </p>
      ) : null}
    </div>
  )
}
