'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from '@/i18n/navigation'
import type { Database } from '@/lib/supabase/database.types'

/**
 * Supabase klient se stáhne až u přihlášeného (má cookie `sb-…`). Návštěvník bez účtu, třeba na
 * úvodní stránce, tak nestahuje knihovnu Supabase vůbec (výkon na slabých zařízeních, D-032).
 */
const loadClient = () => import('@/lib/supabase/client').then((m) => m.createClient())

function hasSessionCookie(): boolean {
  return /(?:^|; )sb-[^=]*-auth-token/.test(document.cookie)
}

type OrgRole = Database['public']['Enums']['org_role']

export type ClientMembership = {
  readonly orgId: string
  readonly role: OrgRole
  readonly orgName: string
  readonly licenseValidUntil: string
}

export type ClientViewer = {
  readonly userId: string
  readonly displayName: string
  readonly memberships: readonly ClientMembership[]
  readonly activeOrgId: string | null
  readonly isPlatformAdmin: boolean
}

type State = { readonly status: 'loading' | 'ready'; readonly viewer: ClientViewer | null }

const ViewerContext = createContext<State & { reload: () => void }>({
  status: 'loading',
  viewer: null,
  reload: () => {},
})

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return m ? decodeURIComponent(m[1]!) : null
}

/**
 * Přihlášený uživatel v prohlížeči (hlavička, ukládání výsledků v lekcích). Stránky lekcí jsou
 * statické, proto se údaje načtou až v prohlížeči; bez přihlášení se nevolá nic po síti.
 */
export function ViewerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading', viewer: null })

  const load = useCallback(async () => {
    if (!hasSessionCookie()) {
      setState({ status: 'ready', viewer: null })
      return
    }
    const supabase = await loadClient()
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    if (!user) {
      setState({ status: 'ready', viewer: null })
      return
    }
    const [profile, memberships, platform] = await Promise.all([
      supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
      supabase
        .from('memberships')
        .select('org_id, role, organizations(name, license_valid_until)')
        .eq('user_id', user.id),
      supabase.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
    ])
    const list = (memberships.data ?? [])
      .filter((m) => m.organizations)
      .map((m) => ({
        orgId: m.org_id,
        role: m.role,
        orgName: m.organizations!.name,
        licenseValidUntil: m.organizations!.license_valid_until,
      }))
      .sort((a, b) => a.orgName.localeCompare(b.orgName, 'cs'))
    const wanted = readCookie('vk_org')
    const active = list.find((m) => m.orgId === wanted) ?? list[0] ?? null
    setState({
      status: 'ready',
      viewer: {
        userId: user.id,
        displayName: profile.data?.display_name ?? '',
        memberships: list,
        activeOrgId: active?.orgId ?? null,
        isPlatformAdmin: !!platform.data,
      },
    })
  }, [])

  useEffect(() => {
    // Bez přihlášení stačí jednou říct „nikdo“ (mimo tělo efektu kvůli pravidlům Reactu).
    if (!hasSessionCookie()) {
      const timer = setTimeout(() => void load(), 0)
      return () => clearTimeout(timer)
    }
    // INITIAL_SESSION přijde hned po přihlášení k odběru; volání Supabase uvnitř callbacku se
    // odkládá (doporučení supabase-js, jinak hrozí zablokování zámku session)
    let unsubscribe: (() => void) | null = null
    let alive = true
    void loadClient().then((client) => {
      if (!alive) return
      const { data } = client.auth.onAuthStateChange((event) => {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          setTimeout(() => void load(), 0)
        }
      })
      unsubscribe = () => data.subscription.unsubscribe()
    })
    return () => {
      alive = false
      unsubscribe?.()
    }
  }, [load])

  // Přihlášení a odhlášení probíhá i na serveru (server actions): po každé navigaci ověřit, jestli se
  // změnil uživatel v cookies (getSession čte cookies, po síti se nic nevolá).
  const pathname = usePathname()
  const currentUser = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    currentUser.current = state.status === 'ready' ? (state.viewer?.userId ?? null) : undefined
  }, [state])
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (currentUser.current === undefined) return
      if (!hasSessionCookie()) {
        if (currentUser.current !== null) void load()
        return
      }
      const { data } = await (await loadClient()).auth.getSession()
      if ((data.session?.user.id ?? null) !== currentUser.current) void load()
    }, 0)
    return () => clearTimeout(timer)
  }, [pathname, load])

  return (
    <ViewerContext.Provider value={{ ...state, reload: () => void load() }}>
      {children}
    </ViewerContext.Provider>
  )
}

export function useViewer() {
  return useContext(ViewerContext)
}

export function activeClientMembership(viewer: ClientViewer | null): ClientMembership | null {
  return viewer?.memberships.find((m) => m.orgId === viewer.activeOrgId) ?? null
}
