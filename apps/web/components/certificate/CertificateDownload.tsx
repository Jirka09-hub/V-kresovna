'use client'

import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { btnPrimary, btnSecondary } from '@/components/ui'
import {
  CERTIFICATE_DATE_FORMAT,
  certificateFileName,
  formatCode,
  scorePercent,
  verifyPath,
} from '@/lib/certificate/format'
import type { CertificateLines } from '@/lib/certificate/pdf'

/** Údaje certifikátu, jak je vrací databáze (snímek v době vydání). */
export type CertificateRecord = {
  readonly holderName: string
  readonly orgName: string | null
  readonly moduleSlug: string
  readonly score: number
  readonly issuedAt: string
  readonly code: string
}

/** Tlačítko „Stáhnout certifikát (PDF)“: PDF vzniká v prohlížeči až po kliknutí. */
export function CertificateDownload({
  cert,
  primary = true,
}: {
  cert: CertificateRecord
  primary?: boolean
}) {
  const t = useTranslations('certificate')
  const tm = useTranslations('modules')
  const format = useFormatter()
  const locale = useLocale()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const download = async () => {
    setBusy(true)
    setFailed(false)
    try {
      const date = format.dateTime(new Date(cert.issuedAt), CERTIFICATE_DATE_FORMAT)
      const moduleTitle = tm.has(`${cert.moduleSlug}.title`)
        ? tm(`${cert.moduleSlug}.title`)
        : cert.moduleSlug
      const lines: CertificateLines = {
        brand: t('pdf.brand'),
        title: t('pdf.title'),
        subtitle: t('pdf.subtitle'),
        awardedTo: t('pdf.awardedTo'),
        holder: cert.holderName,
        forModule: t('pdf.forModule'),
        module: moduleTitle,
        details: [
          ...(cert.orgName ? [t('pdf.organization', { org: cert.orgName })] : []),
          t('pdf.score', { percent: scorePercent(cert.score) }),
        ],
        stamp: [
          { label: t('pdf.codeLabel'), value: formatCode(cert.code) },
          { label: t('pdf.dateLabel'), value: date },
        ],
        verifyHint: t('pdf.verifyHint'),
        verifyUrl: `${window.location.origin}${verifyPath(locale, cert.code)}`,
        documentTitle: t('pdf.documentTitle', { name: cert.holderName }),
      }
      const { downloadCertificatePdf } = await import('@/lib/certificate/download')
      await downloadCertificatePdf(lines, certificateFileName(cert.code))
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        className={primary ? btnPrimary : btnSecondary}
        onClick={download}
        disabled={busy}
        aria-busy={busy}
        data-testid="certificate-download"
      >
        {busy ? t('downloading') : t('download')}
      </button>
      {failed ? (
        <span role="alert" className="text-sm text-red-700">
          {t('downloadError')}
        </span>
      ) : null}
    </span>
  )
}
