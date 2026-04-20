// LuxaSystem X icon (platform brand)
export function LuxaLogo({ size = 44 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width={size} height={size} className="mx-auto">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8c068" /><stop offset="100%" stopColor="#c9963b" />
        </linearGradient>
        <linearGradient id="g2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b6d2e" /><stop offset="100%" stopColor="#c9963b" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#141414" />
      <line x1="15" y1="15" x2="49" y2="49" stroke="url(#g1)" strokeWidth="8" strokeLinecap="round" />
      <line x1="49" y1="15" x2="15" y2="49" stroke="url(#g2)" strokeWidth="8" strokeLinecap="round" />
      <circle cx="32" cy="32" r="5.5" fill="#c9963b" />
    </svg>
  );
}

// Luxa Core product icon (red radio/signal)
export function LuxaCoreLogo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#1a0505"/>
      <circle cx="32" cy="32" r="7" stroke="#dc2626" strokeWidth="3" fill="#dc2626" fillOpacity="0.2"/>
      <path d="M14 14a25 25 0 000 36M50 14a25 25 0 010 36" stroke="#dc2626" strokeWidth="3" strokeLinecap="round"/>
      <path d="M6 6a31 31 0 000 52M58 6a31 31 0 010 52" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
    </svg>
  );
}

// Luxa Cloud product icon (blue cloud)
export function LuxaCloudLogo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#020d1a"/>
      <path d="M46 46H20a14 14 0 110-28h1A18 18 0 1146 46z" stroke="#0ea5e9" strokeWidth="3" fill="#0ea5e9" fillOpacity="0.15" strokeLinejoin="round"/>
      <path d="M32 34v10M27 39l5 5 5-5" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
