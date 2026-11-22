import { expect, test, type Page } from '@playwright/test'
import { signIn } from './auth-helpers'
import {
  addGroupMember,
  addMember,
  admin,
  createAssignment,
  createGroup,
  createOrg,
  createUser,
  dbAvailable,
} from './db'
import { fixSeeds, solveCurrent } from './helpers'

test.skip(!dbAvailable, 'potřebuje lokální Supabase (pnpm db:start && pnpm db:env)')

const LESSON = 'jak-vznikaji-pohledy'
// lekce 1: tři úlohy podle plánu + jedna adaptivní (všechno přiřazování pohledů)
const SEEDS = [5101, 5102, 5103, 5104]

/** Požadavky prohlížeče na tabulky výsledků (zápis i čtení). */
function watchResultRequests(page: Page): string[] {
  const seen: string[] = []
  page.on('request', (req) => {
    const url = req.url()
    if (/\/rest\/v1\/(lesson_runs|attempts)|finish_lesson_run/.test(url)) {
      seen.push(`${req.method()} ${url}`)
    }
  })
  return seen
}

async function startTasks(page: Page) {
  await expect(page.getByTestId('intro')).toBeVisible()
  await page.getByTestId('next-screen').click()
  await page.getByTestId('to-tasks').click()
}

test.describe('ukládání výsledků', () => {
  test.setTimeout(150_000)

  test('přihlášený účastník projde lekci: průchod a pokusy v databázi, lekce hotová v přehledu', async ({
    page,
  }) => {
    const org = await createOrg()
    const trainer = await createUser('Školitel Výsledků')
    await addMember(trainer.id, org.id, 'trainer')
    const user = await createUser('Účastník Výsledků')
    await addMember(user.id, org.id, 'participant')
    const group = await createGroup(org.id, 'Třída výsledků', trainer.id)
    await addGroupMember(group.id, org.id, user.id)
    await createAssignment(group.id, 'diry-a-osy', '2026-12-05T12:00:00Z', trainer.id)

    await signIn(page, user.username, user.password)
    // pevné seedy až pro stránku lekce (nový dokument)
    await fixSeeds(page, SEEDS)
    await page.goto(`/cs/lekce/${LESSON}`)
    const banner = page.getByTestId('results-banner')
    await expect(banner).toHaveAttribute('data-mode', 'active')
    await expect(banner).toContainText(org.name)

    await startTasks(page)
    for (let i = 0; i < SEEDS.length; i++) {
      await expect(page.getByTestId('exercise')).toHaveAttribute('data-seed', String(SEEDS[i]))
      await solveCurrent(page)
      await page.getByTestId('next').click()
    }
    await expect(page.getByTestId('summary')).toBeVisible()
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'finished')

    const { data: runs } = await admin().from('lesson_runs').select('*').eq('user_id', user.id)
    expect(runs).toHaveLength(1)
    const run = runs![0]!
    expect(run).toMatchObject({
      org_id: org.id,
      module_slug: 'pohledy-a-rezy',
      lesson_slug: LESSON,
      task_count: 4,
      engine_version: '0.4.0',
      correct_count: 4,
      seed: null,
    })
    expect(run.finished_at).not.toBeNull()
    const { data: attempts } = await admin()
      .from('attempts')
      .select('*')
      .eq('run_id', run.id)
      .order('task_index')
    expect(attempts!.map((a) => a.seed)).toEqual(SEEDS)
    for (const a of attempts!) {
      expect(a).toMatchObject({
        user_id: user.id,
        org_id: org.id,
        exercise_type: 'assign-views',
        engine_version: '0.4.0',
        is_correct: true,
        score: 1,
        error_codes: [],
      })
      expect((a.answer as { kind: string }).kind).toBe('assign-views')
      expect(a.duration_ms).toBeGreaterThan(0)
    }

    // přehled lekcí: lekce 1 hotová, lekce 3 přiřazená školitelem s termínem
    await page.goto('/cs/lekce')
    const done = page.locator(`li[data-lesson="${LESSON}"] [data-testid="lesson-status"]`)
    await expect(done).toHaveAttribute('data-state', 'done')
    await expect(done).toContainText('100 %')
    await expect(
      page.locator('li[data-lesson="diry-a-osy"] [data-testid="lesson-assigned"]'),
    ).toContainText('5. 12. 2026')
    await expect(page.locator('[data-testid="lesson-status"]')).toHaveCount(1)

    // opakování lekce = nový průchod (rozpracovaný po první odpovědi)
    await page.goto(`/cs/lekce/${LESSON}`)
    await startTasks(page)
    await solveCurrent(page)
    await expect
      .poll(async () => {
        const { data } = await admin().from('lesson_runs').select('id').eq('user_id', user.id)
        return data?.length
      })
      .toBe(2)
  })

  test('nepřihlášený uživatel vidí výzvu k přihlášení a nic se neukládá', async ({ page }) => {
    const requests = watchResultRequests(page)
    await fixSeeds(page, SEEDS)
    await page.goto(`/cs/lekce/${LESSON}`)
    const banner = page.getByTestId('results-banner')
    await expect(banner).toHaveAttribute('data-mode', 'anonymous')
    await expect(banner).toContainText('Přihlaste se, aby se vaše výsledky ukládaly')
    await expect(banner.getByRole('link', { name: 'Přihlásit se' })).toHaveAttribute(
      'href',
      `/cs/prihlaseni?next=%2Flekce%2F${LESSON}`,
    )
    await startTasks(page)
    await solveCurrent(page)
    await page.getByTestId('next').click()
    await expect(page.getByTestId('exercise')).toHaveAttribute('data-seed', String(SEEDS[1]))
    expect(requests).toEqual([])
  })

  test('po vypršení licence lekce vysvětlí, že se výsledky neukládají', async ({ page }) => {
    const org = await createOrg({ validDays: -3 })
    const user = await createUser('Účastník Prošlé Licence')
    await addMember(user.id, org.id, 'participant')
    const requests = watchResultRequests(page)

    await signIn(page, user.username, user.password)
    await fixSeeds(page, SEEDS)
    await page.goto(`/cs/lekce/${LESSON}`)
    const banner = page.getByTestId('results-banner')
    await expect(banner).toHaveAttribute('data-mode', 'expired')
    await expect(banner).toContainText('vypršela')
    await startTasks(page)
    await expect(page.getByTestId('exercise')).toHaveAttribute('data-seed', String(SEEDS[0]))
    await solveCurrent(page)
    await page.getByTestId('next').click()
    await expect(page.getByTestId('exercise')).toHaveAttribute('data-seed', String(SEEDS[1]))

    // zápis se ani nezkusí (čtení historie pro adaptivitu je dovolené)
    expect(requests.filter((r) => !r.startsWith('GET '))).toEqual([])
    const { data: runs } = await admin().from('lesson_runs').select('id').eq('user_id', user.id)
    expect(runs).toEqual([])
    const { data: attempts } = await admin().from('attempts').select('id').eq('user_id', user.id)
    expect(attempts).toEqual([])
  })
})
