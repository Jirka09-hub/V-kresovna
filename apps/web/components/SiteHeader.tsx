'use client'

import { useTranslations } from 'next-intl'
import { focusRing } from '@/components/ui'
import { Link, usePathname } from '@/i18n/navigation'

/** Hlavička webu: název (odkaz domů) a hlavní navigace. */
export function SiteHeader() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const links = [
    { href: '/demo', label: t('demo') },
    { href: '/lekce', label: t('lessons') },
  ] as const
  return (
    <header className="border-b border-slate-200 bg-white">
      <a
        href="#obsah"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        {t('skip')}
      </a>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <Link href="/" className={`flex items-center gap-2 text-lg font-bold ${focusRing}`}>
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-accent" aria-hidden="true">
            <path
              d="M4 8l8-4 8 4-8 4-8-4zm0 0v8l8 4m0-8v8m8-12v8l-8 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
          {t('home')}
        </Link>
        <nav aria-label={t('label')}>
          <ul className="flex items-center gap-1">
            {links.map((l) => {
              const active = pathname === l.href || pathname.startsWith(`${l.href}/`)
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${focusRing} ${
                      active ? 'bg-blue-50 text-accent' : 'text-ink hover:bg-slate-100'
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </header>
  )
}
