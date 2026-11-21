/** Ikony stavu odpovědi. Vždy doplňují text, správnost se nesděluje jen barvou ani jen ikonou. */
export function CheckIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="9" fill="currentColor" />
      <path
        d="M5.5 10.5l3 3 6-7"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CrossIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="18" height="18" rx="3" fill="currentColor" />
      <path d="M6.5 6.5l7 7M13.5 6.5l-7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** Šipka (výchozí směr doprava), `rotate` ve stupních. */
export function ArrowIcon({
  rotate = 0,
  className = 'h-4 w-4',
}: {
  rotate?: number
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path
        d="M2 8h11M9 4l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
