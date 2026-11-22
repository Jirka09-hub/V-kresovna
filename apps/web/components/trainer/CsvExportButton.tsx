'use client'

import { useTranslations } from 'next-intl'
import { btnSecondary } from '@/components/ui'
import { buildCsv, csvFilename, matrixCsvRows } from '@/lib/trainer/csv'
import { pragueDate } from '@/lib/trainer/dates'
import { percent, type MatrixRow } from '@/lib/trainer/matrix'

/** Stažení matice postupu jako CSV (vzniká v prohlížeči z dat, která stránka už má), D-028. */
export function CsvExportButton({
  matrix,
  lessonSlugs,
  lessonTitles,
  groupName,
}: {
  matrix: readonly MatrixRow[]
  lessonSlugs: readonly string[]
  lessonTitles: readonly string[]
  groupName: string
}) {
  const t = useTranslations('csv')
  const download = () => {
    const rows = matrixCsvRows(matrix, lessonSlugs, {
      name: t('name'),
      login: t('login'),
      finalTest: t('finalTest'),
      finalResult: t('finalResult'),
      certificate: t('certificate'),
      lessons: lessonTitles,
      cell: (c) =>
        c.status === 'done'
          ? t('done', { score: percent(c.bestScore ?? 0) })
          : c.status === 'started'
            ? t('started')
            : t('none'),
      passed: (p) => (p === null ? '' : p ? t('passed') : t('failed')),
    })
    const blob = new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = csvFilename(groupName, pragueDate(new Date()))
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <button type="button" className={btnSecondary} onClick={download} data-testid="csv-export">
      {t('download')}
    </button>
  )
}
