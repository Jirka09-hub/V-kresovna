import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  // interní balíčky monorepa se překládají přímo ze zdrojového TypeScriptu
  transpilePackages: [
    '@vykresovna/drafting-standards',
    '@vykresovna/engine',
    '@vykresovna/viewer',
    '@vykresovna/exercises',
    '@vykresovna/content',
  ],
  poweredByHeader: false,
}

export default withNextIntl(nextConfig)

// Lokální vývoj s bindingy Cloudflare (next dev); v produkci řeší OpenNext.
if (process.env.NODE_ENV === 'development') {
  void import('@opennextjs/cloudflare').then((m) => m.initOpenNextCloudflareForDev())
}
