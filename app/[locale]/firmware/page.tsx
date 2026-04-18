'use client';

import { useTranslations, useLocale } from 'next-intl';
import { LuxaLogo } from '@/components/ui/logo';
import Link from 'next/link';
import { Download, ArrowLeft, Package, Cpu, Usb, Terminal } from 'lucide-react';

export default function FirmwarePage() {
  const t = useTranslations('firmware');
  const tNav = useTranslations('nav');
  const locale = useLocale();

  return (
    <div className="min-h-screen">
      <nav className="border-b border-luxa-border bg-luxa-bg/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link href={`/${locale}`} className="text-luxa-muted hover:text-luxa-text transition"><ArrowLeft size={20} /></Link>
          <LuxaLogo size={28} />
          <span className="text-luxa-gold font-bold tracking-wider">LUXA</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-luxa-text">{t('title')}</h1>

        {/* Current Release */}
        <div className="bg-luxa-bg-card border border-luxa-gold/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-luxa-muted">{t('currentVersion')}</p>
              <p className="text-2xl font-bold text-luxa-gold">v1.0.0</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-luxa-muted">{t('releaseDate')}</p>
              <p className="text-sm text-luxa-text">2026-04-18</p>
            </div>
          </div>
          <a
            href="/firmware/luxa-core-v1.0.0.zip"
            className="flex items-center justify-center gap-2 w-full py-3 bg-luxa-gold text-luxa-bg font-semibold rounded-lg hover:bg-luxa-gold-light transition"
          >
            <Download size={18} />
            {t('download')} — luxa-core-v1.0.0.zip
          </a>
          <div className="mt-4">
            <p className="text-sm font-medium text-luxa-muted mb-1">{t('changelog')}</p>
            <p className="text-sm text-luxa-text">{t('v100changes')}</p>
          </div>
        </div>

        {/* Requirements */}
        <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-luxa-text mb-4">{t('requirements')}</h2>
          <div className="space-y-3">
            <ReqItem icon={<Cpu size={16} />} text={t('req1')} />
            <ReqItem icon={<Package size={16} />} text={t('req2')} />
            <ReqItem icon={<Usb size={16} />} text={t('req3')} />
            <ReqItem icon={<Terminal size={16} />} text={t('req4')} />
          </div>
        </div>

        {/* Flash Guide */}
        <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-luxa-text mb-4">{t('flashGuide')}</h2>
          <div className="space-y-3 text-sm">
            <StepItem n="1" text={t('flashStep1')} />
            <StepItem n="2" text={t('flashStep2')} />
            <StepItem n="3" text={t('flashStep3')} />
            <StepItem n="4" text={t('flashStep4')} />
          </div>
          <div className="mt-4 p-3 bg-luxa-bg rounded-lg border border-luxa-border">
            <code className="text-xs text-luxa-gold font-mono">pio run -t upload</code>
          </div>
          <p className="text-xs text-luxa-muted mt-3">{t('otaNote')}</p>
        </div>

        <div className="text-center">
          <Link href={`/${locale}/setup`} className="text-luxa-gold text-sm hover:underline">{tNav('setup')} →</Link>
        </div>
      </main>
    </div>
  );
}

function ReqItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-luxa-gold">{icon}</span>
      <span className="text-luxa-text">{text}</span>
    </div>
  );
}

function StepItem({ n, text }: { n: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-6 h-6 rounded-full bg-luxa-gold/10 text-luxa-gold text-xs flex items-center justify-center shrink-0 mt-0.5">{n}</span>
      <span className="text-luxa-text">{text}</span>
    </div>
  );
}
