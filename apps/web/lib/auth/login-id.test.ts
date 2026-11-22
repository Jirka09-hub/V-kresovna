import { describe, expect, it } from 'vitest'
import {
  formatJoinCode,
  generatePassword,
  parseLoginId,
  suggestUsername,
  usernameFromEmail,
  USERNAME_PATTERN,
} from './login-id'

describe('přihlašovací údaje', () => {
  it('rozliší e-mail a přihlašovací jméno', () => {
    expect(parseLoginId(' Jana@Firma.cz ')).toEqual({ kind: 'email', email: 'jana@firma.cz' })
    expect(parseLoginId('jan.novak')).toEqual({
      kind: 'username',
      username: 'jan.novak',
      email: 'jan.novak@ucet.vykresovna.invalid',
    })
    expect(parseLoginId('ab')).toBeNull()
    expect(parseLoginId('x@ucet.vykresovna.invalid')).toBeNull()
    expect(parseLoginId('není jméno')).toBeNull()
  })

  it('vrátí přihlašovací jméno z technické adresy', () => {
    expect(usernameFromEmail('jan.novak@ucet.vykresovna.invalid')).toBe('jan.novak')
    expect(usernameFromEmail('jan@firma.cz')).toBeNull()
  })

  it('navrhne platné přihlašovací jméno i z krátkého nebo divného jména', () => {
    expect(suggestUsername('Jan Novák')).toBe('jan.novak')
    expect(suggestUsername('Žofie Šťastná-Řehořová', 7)).toBe('zofie.stastna.rehorova7')
    for (const name of ['Al', '', '???', 'Ö', 'Velmi Dlouhé Jméno Které Se Nevejde Celé']) {
      expect(suggestUsername(name, 12)).toMatch(USERNAME_PATTERN)
    }
  })

  it('heslo a kód', () => {
    expect(generatePassword()).toMatch(/^[a-z2-9]{8}$/)
    expect(formatJoinCode('abcd efgh')).toBe('ABCD-EFGH')
  })
})
