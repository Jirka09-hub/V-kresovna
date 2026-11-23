import { useTranslations } from 'next-intl'
import { focusRing } from '@/components/ui'
import { Link } from '@/i18n/navigation'

/** Patička webu: zásady zpracování, ověření certifikátu a poptávka pilotu. */
export function SiteFooter() {
  const t = useTranslations('footer')
  const link = `text-slate-700 underline-offset-2 hover:underline ${focusRing}`
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="text-slate-700">{t('copyright')}</p>
        <nav aria-label={t('label')}>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li>
              <Link href="/zasady" className={link}>
                {t('privacy')}
              </Link>
            </li>
            <li>
              <Link href="/overeni" className={link}>
                {t('verify')}
              </Link>
            </li>
            <li>
              <Link href="/#pilot" className={link}>
                {t('pilot')}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}
