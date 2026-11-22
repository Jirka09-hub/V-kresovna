/**
 * Stažení PDF certifikátu v prohlížeči. Modul se načítá dynamicky (`import()`), až když uživatel
 * klikne, takže pdf-lib, fontkit ani písmo nejsou v hlavním bundlu (D-029).
 */
import { buildCertificatePdf, type CertificateLines } from './pdf'

/** Písmo Noto Sans (OFL, licence v public/fonts/OFL.txt) zmenšené na latinku s češtinou. */
export const CERTIFICATE_FONTS = {
  regular: '/fonts/NotoSans-Regular.ttf',
  bold: '/fonts/NotoSans-Bold.ttf',
} as const

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return res.arrayBuffer()
}

export async function downloadCertificatePdf(
  lines: CertificateLines,
  fileName: string,
): Promise<void> {
  const [regular, bold] = await Promise.all([
    fetchBytes(CERTIFICATE_FONTS.regular),
    fetchBytes(CERTIFICATE_FONTS.bold),
  ])
  const bytes = await buildCertificatePdf(lines, { regular, bold })
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // odkaz uvolnit až po zahájení stahování
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
