'use client'

import { useTranslations } from 'next-intl'
import { focusRing } from '@/components/ui'
import { Link, usePathname } from '@/i18n/navigation'
import { useViewer } from './ViewerContext'

const linkClass = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${focusRing} ${
    active ? 'bg-blue-50 text-accent' : 'text-ink hover:bg-slate-100'
  }`

/** Odkazy podle role přihlášeného uživatele (nebo „Přihlásit“). */
export function UserMenu() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const { status, viewer } = useViewer()
  if (status === 'loading') return null
  if (!viewer) {
    return (
      <li>
        <Link href="/prihlaseni" className={linkClass(pathname === '/prihlaseni')}>
          {t('signIn')}
        </Link>
      </li>
    )
  }
  const staff = viewer.memberships.some((m) => m.role !== 'participant')
  const admin = viewer.memberships.some((m) => m.role === 'org_admin')
  const links = [
    ...(staff ? [{ href: '/skolitel', label: t('trainer') }] : []),
    ...(admin ? [{ href: '/sprava', label: t('orgAdmin') }] : []),
    ...(viewer.isPlatformAdmin ? [{ href: '/platforma', label: t('platform') }] : []),
    { href: '/ucet', label: viewer.displayName || t('account'), testId: 'user-menu-account' },
  ]
  return (
    <>
      {links.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            aria-current={pathname.startsWith(l.href) ? 'page' : undefined}
            className={linkClass(pathname.startsWith(l.href))}
            data-testid={'testId' in l ? l.testId : undefined}
          >
            {l.label}
          </Link>
        </li>
      ))}
    </>
  )
}
