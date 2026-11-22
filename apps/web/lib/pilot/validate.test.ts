import { describe, expect, it } from 'vitest'
import { botCheck, validatePilotRequest } from './validate'

const valid = {
  segment: 'school',
  name: 'Jana Nováková',
  organization: 'SPŠ strojní',
  email: ' Jana@Skola.CZ ',
  phone: '',
  headcount: '1 200',
  message: '',
  consent: 'on',
}

describe('formulář Chci pilot', () => {
  it('platná poptávka projde a hodnoty se upraví', () => {
    expect(validatePilotRequest(valid)).toEqual({
      ok: true,
      data: {
        segment: 'school',
        name: 'Jana Nováková',
        organization: 'SPŠ strojní',
        email: 'jana@skola.cz',
        phone: null,
        headcount: 1200,
        message: null,
      },
    })
  })

  it('vyjmenuje všechna chybná pole', () => {
    const r = validatePilotRequest({
      segment: 'x',
      name: 'J',
      organization: '',
      email: 'bez-zavinace',
      phone: 'abc',
      headcount: '0',
      message: 'x'.repeat(2001),
    })
    expect(r).toEqual({
      ok: false,
      fields: [
        'segment',
        'name',
        'organization',
        'email',
        'phone',
        'headcount',
        'message',
        'consent',
      ],
    })
  })

  it('telefon a počet lidí jsou nepovinné, ale musí dávat smysl', () => {
    expect(validatePilotRequest({ ...valid, phone: '+420 777 123 456' }).ok).toBe(true)
    expect(validatePilotRequest({ ...valid, headcount: '2,5' }).ok).toBe(false)
  })

  it('past na roboty', () => {
    const now = 1_000_000
    expect(botCheck('', String(now - 10_000), now)).toBe('ok')
    expect(botCheck('https://spam', String(now - 10_000), now)).toBe('bot')
    expect(botCheck('', String(now - 500), now)).toBe('retry')
    expect(botCheck('', '', now)).toBe('retry')
    expect(botCheck('', String(now - 2 * 24 * 3600_000), now)).toBe('retry')
  })
})
