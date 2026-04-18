'use client';

import { useTranslations, useLocale } from 'next-intl';
import { LuxaLogo } from '@/components/ui/logo';
import Link from 'next/link';
import { Wifi, Radio, Clock, Home } from 'lucide-react';

export default function LandingPage() {
  const t = useTranslations('landing');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');
  const locale = useLocale();

  const features = [
    { icon: <Wifi size={28} />, title: t('feature1Title'), desc: t('feature1Desc') },
    { icon: <Radio size={28} />, title: t('feature2Title'), desc: t('feature2Desc') },
    { icon: <Clock size={28} />, title: t('feature3Title'), desc: t('feature3Desc') },
    { icon: <Home size={28} />, title: t('feature4Title'), desc: t('feature4Desc') },
  ];

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-luxa-border bg-luxa-bg/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LuxaLogo size={32} />
            <span className="text-luxa-gold font-bold tracking-wider text-lg">LUXA</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/${locale}/firmware`} className="px-3 py-2 text-sm text-luxa-muted hover:text-luxa-text transition">{tNav('firmware')}</Link>
            <Link href={`/${locale}/setup`} className="px-3 py-2 text-sm text-luxa-muted hover:text-luxa-text transition">{tNav('setup')}</Link>
            <Link href={`/${locale}/login`} className="px-4 py-2 bg-luxa-gold text-luxa-bg text-sm font-semibold rounded-lg hover:bg-luxa-gold-light transition">{t('ctaDashboard')}</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 py-20 text-center">
        <LuxaLogo size={80} />
        <h1 className="text-4xl sm:text-5xl font-bold text-luxa-gold mt-6 tracking-wider">{t('hero')}</h1>
        <p className="text-lg text-luxa-muted mt-4 max-w-xl mx-auto">{t('heroSub')}</p>
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <Link href={`/${locale}/dashboard`} className="px-6 py-3 bg-luxa-gold text-luxa-bg font-semibold rounded-lg hover:bg-luxa-gold-light transition">{t('ctaDashboard')}</Link>
          <Link href={`/${locale}/firmware`} className="px-6 py-3 border border-luxa-border text-luxa-gold rounded-lg hover:bg-luxa-bg-hover transition">{t('ctaFirmware')}</Link>
          <Link href={`/${locale}/setup`} className="px-6 py-3 border border-luxa-border text-luxa-muted rounded-lg hover:bg-luxa-bg-hover transition">{t('ctaSetup')}</Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="grid sm:grid-cols-2 gap-4">
          {features.map((f, i) => (
            <div key={i} className="bg-luxa-bg-card border border-luxa-border rounded-xl p-6 hover:border-luxa-gold/30 transition">
              <div className="text-luxa-gold mb-3">{f.icon}</div>
              <h3 className="text-lg font-semibold text-luxa-text mb-2">{f.title}</h3>
              <p className="text-sm text-luxa-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-luxa-border py-8 text-center text-sm text-luxa-muted">
        <p>{tCommon('appName')} &mdash; luxasystem.com</p>
      </footer>
    </div>
  );
}
