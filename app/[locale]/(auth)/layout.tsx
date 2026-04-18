'use client';

import { LuxaLogo } from '@/components/ui/logo';
import { useTranslations } from 'next-intl';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('common');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <LuxaLogo size={56} />
        <h1 className="text-2xl font-bold text-luxa-gold mt-4 tracking-wider">{t('appName')}</h1>
        <p className="text-luxa-muted text-sm mt-1">{t('tagline')}</p>
      </div>
      <div className="w-full max-w-sm">
        {children}
      </div>
    </div>
  );
}
