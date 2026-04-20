// LuxaSystem platform X icon (gold)
export function LuxaLogo({ size = 44 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="mx-auto">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8c068"/><stop offset="100%" stopColor="#c9963b"/>
        </linearGradient>
        <linearGradient id="g2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b6d2e"/><stop offset="100%" stopColor="#c9963b" stopOpacity="0.4"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#141414"/>
      <line x1="15" y1="15" x2="49" y2="49" stroke="url(#g1)" strokeWidth="8" strokeLinecap="round"/>
      <line x1="49" y1="15" x2="15" y2="49" stroke="url(#g2)" strokeWidth="8" strokeLinecap="round"/>
      <circle cx="32" cy="32" r="5.5" fill="#c9963b"/>
    </svg>
  );
}

// Luxa Core product X icon (red) — same X shape, red colors
export function LuxaCoreLogo({ size = 44 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="mx-auto">
      <defs>
        <linearGradient id="cx1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f87171"/><stop offset="100%" stopColor="#dc2626"/>
        </linearGradient>
        <linearGradient id="cx2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#991b1b"/><stop offset="100%" stopColor="#dc2626" stopOpacity="0.4"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#1a0505"/>
      <line x1="15" y1="15" x2="49" y2="49" stroke="url(#cx1)" strokeWidth="8" strokeLinecap="round"/>
      <line x1="49" y1="15" x2="15" y2="49" stroke="url(#cx2)" strokeWidth="8" strokeLinecap="round"/>
      <circle cx="32" cy="32" r="5.5" fill="#dc2626"/>
    </svg>
  );
}

// Luxa Cloud product X icon (blue) — same X shape, blue colors
export function LuxaCloudLogo({ size = 44 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="mx-auto">
      <defs>
        <linearGradient id="blx1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8"/><stop offset="100%" stopColor="#0ea5e9"/>
        </linearGradient>
        <linearGradient id="blx2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0369a1"/><stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.4"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#020d1a"/>
      <line x1="15" y1="15" x2="49" y2="49" stroke="url(#blx1)" strokeWidth="8" strokeLinecap="round"/>
      <line x1="49" y1="15" x2="15" y2="49" stroke="url(#blx2)" strokeWidth="8" strokeLinecap="round"/>
      <circle cx="32" cy="32" r="5.5" fill="#0ea5e9"/>
    </svg>
  );
}
