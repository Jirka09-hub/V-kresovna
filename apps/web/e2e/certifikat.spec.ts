import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { signIn } from './auth-helpers'
import { addMember, admin, createOrg, createUser, dbAvailable, uniq } from './db'
import { answerCurrent, fixSeeds } from './helpers'

test.skip(!dbAvailable, 'potřebuje lokální Supabase (pnpm db:start && pnpm db:env)')

test.describe('certifikát', () => {
  test('splněný závěrečný test → certifikát, PDF a veřejné ověření', async ({ page, browser }) => {
    test.setTimeout(300_000)
    const org = await createOrg({ name: `Strojírny Ďáblice ${uniq()}` })
    const user = await createUser('Řehoř Žluťoučký')
    await addMember(user.id, org.id, 'participant')

    await signIn(page, user.username, user.password)
    await fixSeeds(page, [424242])
    await page.goto('/cs/lekce/zaverecny-test')
    await expect(page.getByTestId('results-banner')).toHaveAttribute('data-mode', 'active')
    await expect(page.getByTestId('test-storage-rule')).toContainText('Výsledek se uloží')
    await page.getByTestId('start-test').click()
    for (let i = 1; i <= 12; i++) {
      await expect(
        page.getByRole('heading', { level: 2, name: new RegExp(`Úloha ${i} z 12`) }),
      ).toBeVisible()
      await answerCurrent(page)
    }
    const results = page.getByTestId('test-results')
    await expect(results).toHaveAttribute('data-passed', 'true')

    // průchod testu je uložený se seedem testu
    const { data: runs } = await admin()
      .from('lesson_runs')
      .select('*')
      .eq('user_id', user.id)
      .eq('lesson_slug', 'zaverecny-test')
    expect(runs).toHaveLength(1)
    expect(runs![0]).toMatchObject({ seed: 424242, task_count: 12, engine_version: '0.4.0' })

    await page.getByTestId('certificate-issue').click()
    const issued = page.getByTestId('certificate-issued')
    await expect(issued).toBeVisible()
    const code = (await issued.getAttribute('data-code'))!
    expect(code).toMatch(/^[A-Z2-9]{16}$/)
    await expect(page.getByTestId('certificate-code')).toHaveText(code.match(/.{4}/g)!.join('-'))
    const { data: certs } = await admin()
      .from('certificates')
      .select('holder_name, org_name, score, run_id')
      .eq('user_id', user.id)
    expect(certs).toEqual([
      { holder_name: 'Řehoř Žluťoučký', org_name: org.name, score: 1, run_id: runs![0]!.id },
    ])

    // PDF vznikne v prohlížeči
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('certificate-download').click(),
    ])
    expect(download.suggestedFilename()).toBe(`certifikat-vykresovna-${code}.pdf`)
    const pdf = readFileSync((await download.path())!)
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(pdf.length).toBeGreaterThan(20_000)

    // veřejné ověření bez přihlášení (nový kontext prohlížeče)
    const anon = await browser.newContext()
    const p2 = await anon.newPage()
    await p2.goto(`/cs/overeni/${code}`)
    await expect(p2.getByTestId('verify-result')).toHaveAttribute('data-valid', 'true')
    await expect(p2.getByTestId('verify-holder')).toHaveText('Řehoř Žluťoučký')
    await expect(p2.getByTestId('verify-result')).toContainText(org.name)
    await expect(p2.getByTestId('verify-result')).toContainText('100 %')
    // formulář: kód s pomlčkami a malými písmeny
    await p2.goto('/cs/overeni')
    await p2.getByLabel('Ověřovací kód').fill(code.match(/.{4}/g)!.join('-').toLowerCase())
    await p2.getByRole('button', { name: 'Ověřit' }).click()
    await expect(p2).toHaveURL(new RegExp(`/cs/overeni/${code}$`))
    await expect(p2.getByTestId('verify-holder')).toHaveText('Řehoř Žluťoučký')
    await p2.goto('/cs/overeni/NEEXISTUJE123456')
    await expect(p2.getByTestId('verify-result')).toHaveAttribute('data-valid', 'false')
    await expect(p2.getByTestId('verify-result')).toContainText('neexistuje')
    await anon.close()

    // certifikát je i v „Můj účet“
    await page.goto('/cs/ucet')
    await expect(page.getByTestId('account-certificate')).toContainText(
      'Pohledy a řezy jednoduchých součástí',
    )
  })

  test('nepřihlášenému úvod testu řekne, že se výsledek neukládá', async ({ page }) => {
    await page.goto('/cs/lekce/zaverecny-test')
    await expect(page.getByTestId('results-banner')).toHaveAttribute('data-mode', 'anonymous')
    await expect(page.getByTestId('test-storage-rule')).toContainText('Bez přihlášení')
  })
})
