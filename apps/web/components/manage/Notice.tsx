import type { ReactNode } from 'react'

/** Přátelské oznámení (chybí oprávnění, vypršelá licence…) pro serverové stránky správy. */
export function Notice({
  tone = 'info',
  children,
  testId,
}: {
  tone?: 'info' | 'warning'
  children: ReactNode
  testId?: string
}) {
  const cls =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-blue-200 bg-blue-50 text-blue-950'
  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${cls}`} data-testid={testId}>
      {children}
    </div>
  )
}

/** Obal stránky správy. */
export function ManagePage({
  title,
  lead,
  children,
}: {
  title: string
  lead?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{title}</h1>
        {lead && <p className="text-sm text-muted">{lead}</p>}
      </header>
      {children}
    </main>
  )
}

export function Section({
  title,
  id,
  children,
  aside,
}: {
  title: string
  id?: string
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={id ? `${id}-title` : undefined} className="text-lg font-semibold">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}
