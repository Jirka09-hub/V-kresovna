/** Sdílené třídy tlačítek a panelů (Tailwind), aby vzhled byl jednotný napříč stránkami. */
export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

export const btnPrimary = `inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`

export const btnSecondary = `inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`

export const panel = 'rounded-lg border border-slate-200 bg-white'
