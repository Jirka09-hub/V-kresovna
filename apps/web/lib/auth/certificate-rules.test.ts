import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { FINAL_TEST_PASS_THRESHOLD, PILOT_MODULE } from '@vykresovna/content'
import { describe, expect, it } from 'vitest'

// Pravidla certifikátu jsou i v SQL (app.certificate_rules); musí sedět s obsahem (D-027).
describe('pravidla certifikátu v databázi', () => {
  it('odpovídají packages/content', () => {
    const dir = join(__dirname, '../../../../supabase/migrations')
    const sql = readdirSync(dir)
      .sort()
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join('\n')
    const defs = [
      ...sql.matchAll(
        /function app\.certificate_rules\([\s\S]*?as \$\$ select '([a-z-]+)'::text, ([0-9.]+)::real \$\$/g,
      ),
    ]
    const last = defs.at(-1)
    expect(last, 'definice app.certificate_rules').toBeDefined()
    const finalLesson = PILOT_MODULE.lessons.find((l) => l.test)
    expect(last![1]).toBe(finalLesson?.slug)
    expect(Number(last![2])).toBe(FINAL_TEST_PASS_THRESHOLD)
  })
})
