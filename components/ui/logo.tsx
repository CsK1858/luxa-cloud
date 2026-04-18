export function LuxaLogo({ size = 44 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width={size} height={size} className="mx-auto">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8c068" />
          <stop offset="100%" stopColor="#c9963b" />
        </linearGradient>
        <linearGradient id="g2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b6d2e" />
          <stop offset="100%" stopColor="#c9963b" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#141414" />
      <line x1="15" y1="15" x2="49" y2="49" stroke="url(#g1)" strokeWidth="8" strokeLinecap="round" />
      <line x1="49" y1="15" x2="15" y2="49" stroke="url(#g2)" strokeWidth="8" strokeLinecap="round" />
      <circle cx="32" cy="32" r="5.5" fill="#c9963b" />
    </svg>
  );
}
