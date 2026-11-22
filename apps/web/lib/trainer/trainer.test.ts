import { describe, expect, it } from 'vitest'
import { buildCsv, csvCell, csvFilename, matrixCsvRows, type CsvLabels } from './csv'
import { isOverdue, pragueDate, pragueEndOfDay } from './dates'
import { buildMatrix, topErrorCodes } from './matrix'

describe('csv', () => {
  it('escapuje oddělovač, uvozovky a konce řádků', () => {
    expect(csvCell('Novák; Jan')).toBe('"Novák; Jan"')
    expect(csvCell('Jan "Honza" Novák')).toBe('"Jan ""Honza"" Novák"')
    expect(csvCell('řádek 1\nřádek 2')).toBe('"řádek 1\nřádek 2"')
    expect(csvCell('a\r\nb')).toBe('"a\r\nb"')
    expect(csvCell('obyčejný text')).toBe('obyčejný text')
    expect(csvCell(null)).toBe('')
    expect(csvCell(80)).toBe('80')
  })

  it('zneškodní hodnoty, které by tabulka spustila jako vzorec', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('+420 123')).toBe("'+420 123")
    expect(csvCell('@jan')).toBe("'@jan")
    expect(csvCell('=A1;B1')).toBe(`"'=A1;B1"`)
  })

  it('celý soubor: BOM, středníky, CRLF', () => {
    const csv = buildCsv([
      ['Jméno', 'Lekce 1'],
      ['Eva Malá', 'hotovo 80 %'],
    ])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.slice(1)).toBe('Jméno;Lekce 1\r\nEva Malá;hotovo 80 %\r\n')
  })

  it('název souboru bez diakritiky', () => {
    expect(csvFilename('Ranní směna – 2. A', '2026-11-22')).toBe(
      'vysledky-ranni-smena-2-a-2026-11-22.csv',
    )
    expect(csvFilename('***', '2026-11-22')).toBe('vysledky-skupina-2026-11-22.csv')
  })
})

describe('matice postupu', () => {
  const participants = [
    { userId: 'u2', displayName: 'Zdeněk Útlý', username: 'zdenek' },
    { userId: 'u1', displayName: 'Čeněk Ácha', username: null },
  ]
  const matrix = buildMatrix({
    participants,
    progress: [
      { user_id: 'u1', lesson_slug: 'a', finished_runs: 2, best_score: 0.8, last_started_at: 'x' },
      { user_id: 'u1', lesson_slug: 'b', finished_runs: 0, best_score: null, last_started_at: 'x' },
      {
        user_id: 'u1',
        lesson_slug: 'test',
        finished_runs: 1,
        best_score: 0.75,
        last_started_at: 'x',
      },
      {
        user_id: 'u2',
        lesson_slug: 'test',
        finished_runs: 1,
        best_score: 0.5,
        last_started_at: 'x',
      },
    ],
    certificates: [{ user_id: 'u1', verification_code: 'ABCDEFGH23456789' }],
    lessonSlugs: ['a', 'b', 'test'],
    finalLessonSlug: 'test',
    passThreshold: 0.75,
  })

  it('řadí podle jména česky a určí stav buněk', () => {
    expect(matrix.map((r) => r.userId)).toEqual(['u1', 'u2'])
    expect(matrix[0]!.cells.a).toEqual({ status: 'done', bestScore: 0.8 })
    expect(matrix[0]!.cells.b).toEqual({ status: 'started', bestScore: null })
    expect(matrix[1]!.cells.a).toEqual({ status: 'none', bestScore: null })
  })

  it('závěrečný test: hranice včetně, certifikát', () => {
    expect(matrix[0]).toMatchObject({ finalScore: 0.75, finalPassed: true })
    expect(matrix[0]!.certificateCode).toBe('ABCDEFGH23456789')
    expect(matrix[1]).toMatchObject({ finalScore: 0.5, finalPassed: false, certificateCode: null })
  })

  it('řádky CSV', () => {
    const labels: CsvLabels = {
      name: 'Jméno',
      login: 'Přihlašovací jméno',
      finalTest: 'Test',
      finalResult: 'Splněno',
      certificate: 'Certifikát',
      lessons: ['A', 'B'],
      cell: (c) => (c.status === 'done' ? `hotovo ${Math.round(c.bestScore! * 100)} %` : c.status),
      passed: (p) => (p === null ? '' : p ? 'ano' : 'ne'),
    }
    expect(matrixCsvRows(matrix, ['a', 'b'], labels)).toEqual([
      ['Jméno', 'Přihlašovací jméno', 'A', 'B', 'Test', 'Splněno', 'Certifikát'],
      ['Čeněk Ácha', '', 'hotovo 80 %', 'started', '75 %', 'ano', 'ABCDEFGH23456789'],
      ['Zdeněk Útlý', 'zdenek', 'none', 'none', '50 %', 'ne', ''],
    ])
  })

  it('nejčastější chyby: jeden pokus počítá kód jednou', () => {
    expect(
      topErrorCodes([
        { error_codes: ['MIRRORED', 'MIRRORED'] },
        { error_codes: ['MIRRORED', 'EXTRA_EDGE'] },
        { error_codes: ['VIEW_MISSING'] },
        { error_codes: null },
      ]),
    ).toEqual([
      { code: 'MIRRORED', count: 2 },
      { code: 'EXTRA_EDGE', count: 1 },
      { code: 'VIEW_MISSING', count: 1 },
    ])
  })
})

describe('termíny', () => {
  it('konec dne v Praze v zimě i v létě', () => {
    expect(pragueEndOfDay('2026-12-05')).toBe('2026-12-05T22:59:59.000Z')
    expect(pragueEndOfDay('2026-07-01')).toBe('2026-07-01T21:59:59.000Z')
    expect(pragueEndOfDay('2026-13-01')).toBeNull()
    expect(pragueEndOfDay('zítra')).toBeNull()
  })

  it('den v Praze a prošlý termín', () => {
    expect(pragueDate('2026-12-05T22:59:59.000Z')).toBe('2026-12-05')
    expect(isOverdue('2026-12-05T22:59:59.000Z', new Date('2026-12-05T23:00:00Z'))).toBe(true)
    expect(isOverdue('2026-12-05T22:59:59.000Z', new Date('2026-12-05T20:00:00Z'))).toBe(false)
    expect(isOverdue(null)).toBe(false)
  })
})
