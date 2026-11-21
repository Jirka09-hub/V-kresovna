import { defineRouting } from 'next-intl/routing'

/**
 * Jazyky aplikace. Čeština je výchozí; slovenštinu a němčinu stačí přidat sem
 * a doplnit messages/sk.json, messages/de.json.
 */
export const routing = defineRouting({
  locales: ['cs'],
  defaultLocale: 'cs',
  localePrefix: 'always',
})

export type Locale = (typeof routing.locales)[number]
