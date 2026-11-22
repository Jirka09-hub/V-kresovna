'use server'

import { createAdminClient, hasAdminKey } from '@/lib/supabase/admin'
import { appUrl, str } from '@/lib/manage/server'
import { notifyPilotRequest } from './notify'
import { botCheck, validatePilotRequest, type PilotField } from './validate'

export type PilotState = {
  readonly ok?: boolean
  /** chyba celého formuláře: RETRY, RATE_LIMITED, SERVER */
  readonly error?: string
  readonly fields?: readonly PilotField[]
  /** odeslané hodnoty, aby se formulář po chybě nevyprázdnil */
  readonly values?: Readonly<Record<string, string>>
}

const FORM_FIELDS = [
  'segment',
  'name',
  'organization',
  'email',
  'phone',
  'headcount',
  'message',
  'consent',
] as const

/** Odeslání formuláře „Chci pilot“ (D-030): pasti na roboty, kontrola, uložení, upozornění. */
export async function submitPilotRequest(_prev: PilotState, fd: FormData): Promise<PilotState> {
  const bot = botCheck(str(fd, 'website'), str(fd, 'startedAt'), Date.now())
  // Robotovi tvrdíme, že se to povedlo, ať nezkouší jiné varianty.
  if (bot === 'bot') return { ok: true }
  const values = Object.fromEntries(FORM_FIELDS.map((k) => [k, str(fd, k)]))
  if (bot === 'retry') return { error: 'RETRY', values }
  const result = validatePilotRequest(values)
  if (!result.ok) return { fields: result.fields, values }
  if (!hasAdminKey()) return { error: 'SERVER', values }

  const req = result.data
  const { error } = await createAdminClient().rpc('submit_pilot_request', {
    p_segment: req.segment,
    p_name: req.name,
    p_organization: req.organization,
    p_email: req.email,
    ...(req.phone ? { p_phone: req.phone } : {}),
    ...(req.headcount !== null ? { p_headcount: req.headcount } : {}),
    ...(req.message ? { p_message: req.message } : {}),
  })
  if (error) {
    if (error.message?.includes('RATE_LIMITED')) return { error: 'RATE_LIMITED', values }
    if (error.code === '23514') return { error: 'RETRY', values }
    console.error('pilot: poptávku se nepodařilo uložit', error.code, error.message)
    return { error: 'SERVER', values }
  }
  await notifyPilotRequest(req, await appUrl('/platforma#poptavky'))
  return { ok: true }
}
