'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

const LOCALE_LABELS: Record<string, string> = {
  tr: 'TR',
  de: 'DE',
  en: 'EN',
  nl: 'NL',
  fr: 'FR',
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(newLocale: string) {
    const segments = pathname.split('/');
    segments[1] = newLocale;
    router.push(segments.join('/'));
  }

  return (
    <div className="flex items-center gap-1">
      {Object.entries(LOCALE_LABELS).map(([code, label]) => (
        <button
          key={code}
          onClick={() => switchLocale(code)}
          className={`px-2 py-1 text-xs font-medium rounded transition ${
            locale === code
              ? 'bg-luxa-gold text-luxa-bg'
              : 'text-luxa-muted hover:text-luxa-text'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
