'use client';

import { useTranslations, useLocale } from 'next-intl';
import { LuxaLogo } from '@/components/ui/logo';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import Link from 'next/link';
import { Download, ArrowLeft, Shield, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export default function FirmwarePage() {
  const t = useTranslations('firmware');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const [showOlder, setShowOlder] = useState(false);

  return (
    <div className="min-h-screen">
      <nav className="border-b border-luxa-border bg-luxa-bg/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/${locale}`} className="text-luxa-muted hover:text-luxa-text transition"><ArrowLeft size={20} /></Link>
            <LuxaLogo size={28} />
            <span className="text-luxa-gold font-bold tracking-wider">LUXA</span>
          </div>
          <LanguageSwitcher />
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-luxa-text">{t('title')}</h1>

        {/* Current Release — v1.3.0 */}
        <div className="bg-luxa-bg-card border border-luxa-gold/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-luxa-muted">{t('currentVersion')}</p>
              <p className="text-2xl font-bold text-luxa-gold">v1.3.0</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-luxa-muted">{t('releaseDate')}</p>
              <p className="text-sm text-luxa-text">2026-04-18</p>
            </div>
          </div>
          <a
            href="/firmware/luxa-core-v1.3.0.zip"
            className="flex items-center justify-center gap-2 w-full py-3 bg-luxa-gold text-luxa-bg font-semibold rounded-lg hover:bg-luxa-gold-light transition"
          >
            <Download size={18} />
            {t('download')} — luxa-core-v1.3.0.zip
          </a>

          {/* v1.3.0 Highlights */}
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium text-luxa-muted">{t('changelog')}</p>
            <div className="space-y-2">
              <ChangeCategory icon={<Shield size={14} />} label={t('catSecurity')} items={[t('v130sec1'), t('v130sec2')]} />
              <ChangeCategory icon={<Zap size={14} />} label={t('catPerformance')} items={[t('v130perf1'), t('v130perf2'), t('v130perf3')]} />
            </div>
            <p className="text-xs text-luxa-muted">{t('v130summary')}</p>
          </div>
        </div>

        {/* Older Releases */}
        <button
          onClick={() => setShowOlder(!showOlder)}
          className="flex items-center gap-2 text-sm text-luxa-muted hover:text-luxa-text transition w-full justify-center"
        >
          {t('olderReleases')}
          {showOlder ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showOlder && (
          <div className="space-y-4">
            {/* v1.2.0 */}
            <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-lg font-semibold text-luxa-text">v1.2.0</p>
                <p className="text-xs text-luxa-muted">2026-04-18</p>
              </div>
              <p className="text-sm text-luxa-text mb-2">{t('v120summary')}</p>
              <ul className="text-xs text-luxa-muted space-y-1 list-disc list-inside">
                <li>{t('v120fix1')}</li>
                <li>{t('v120fix2')}</li>
                <li>{t('v120fix3')}</li>
                <li>{t('v120fix4')}</li>
                <li>{t('v120fix5')}</li>
                <li>{t('v120fix6')}</li>
              </ul>
            </div>

            {/* v1.0.0 */}
            <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-lg font-semibold text-luxa-text">v1.0.0</p>
                <p className="text-xs text-luxa-muted">2026-04-15</p>
              </div>
              <p className="text-sm text-luxa-text">{t('v100changes')}</p>
            </div>
          </div>
        )}

        <div className="text-center">
          <Link href={`/${locale}/setup`} className="text-luxa-gold text-sm hover:underline">{tNav('setup')} →</Link>
        </div>
      </main>
    </div>
  );
}

function ChangeCategory({ icon, label, items }: { icon: React.ReactNode; label: string; items: string[] }) {
  return (
    <div className="bg-luxa-bg rounded-lg border border-luxa-border p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-luxa-gold">{icon}</span>
        <span className="text-xs font-semibold text-luxa-text uppercase tracking-wide">{label}</span>
      </div>
      <ul className="text-xs text-luxa-muted space-y-0.5 list-disc list-inside">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}

