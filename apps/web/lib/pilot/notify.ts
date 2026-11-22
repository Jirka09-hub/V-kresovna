import type { PilotRequestInput } from './validate'

/**
 * Upozornění e-mailem na novou poptávku (D-030). Posílá přes Cloudflare Email Service (vazba
 * `send_email` s názvem PILOT_EMAIL ve wrangler.jsonc). Odesílatel musí být na doméně, kterou
 * spravuje Cloudflare, proto dokud doména není, vazba chybí a funkce nic nepošle: poptávka je
 * uložená v databázi a správce platformy ji vidí v /cs/platforma. Adresy nejsou v repozitáři:
 * PILOT_NOTIFY_TO a PILOT_NOTIFY_FROM jsou proměnné prostředí Workeru.
 */

type SendEmail = {
  send(message: {
    to: string
    from: string
    subject: string
    text: string
    replyTo?: string
  }): Promise<{ messageId: string }>
}

type NotifyEnv = {
  PILOT_EMAIL?: SendEmail
  PILOT_NOTIFY_TO?: string
  PILOT_NOTIFY_FROM?: string
}

export type NotifyResult = 'sent' | 'not-configured' | 'failed'

const SEGMENT_LABEL = { company: 'firma', school: 'škola' } as const

/** Text e-mailu (čistý text, bez odkazů na osobní údaje mimo poptávku). */
export function pilotEmailText(req: PilotRequestInput, adminUrl: string): string {
  return [
    `Nová poptávka pilotu (${SEGMENT_LABEL[req.segment]})`,
    '',
    `Jméno: ${req.name}`,
    `Organizace: ${req.organization}`,
    `E-mail: ${req.email}`,
    `Telefon: ${req.phone ?? '–'}`,
    `Počet lidí: ${req.headcount ?? '–'}`,
    '',
    req.message ?? '(bez zprávy)',
    '',
    `Všechny poptávky: ${adminUrl}`,
  ].join('\n')
}

async function cloudflareEnv(): Promise<NotifyEnv | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    return getCloudflareContext().env as NotifyEnv
  } catch {
    // mimo Cloudflare (next start, testy) kontext není
    return null
  }
}

export async function notifyPilotRequest(
  req: PilotRequestInput,
  adminUrl: string,
): Promise<NotifyResult> {
  const env = await cloudflareEnv()
  const to = env?.PILOT_NOTIFY_TO ?? process.env.PILOT_NOTIFY_TO
  const from = env?.PILOT_NOTIFY_FROM ?? process.env.PILOT_NOTIFY_FROM
  if (!env?.PILOT_EMAIL || !to || !from) return 'not-configured'
  try {
    await env.PILOT_EMAIL.send({
      to,
      from,
      replyTo: req.email,
      subject: `Výkresovna: poptávka pilotu – ${req.organization}`,
      text: pilotEmailText(req, adminUrl),
    })
    return 'sent'
  } catch (e) {
    console.error('pilot: e-mail se nepodařilo odeslat', e instanceof Error ? e.message : e)
    return 'failed'
  }
}
