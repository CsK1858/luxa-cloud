'use client';

import { useTranslations, useLocale } from 'next-intl';
import { LuxaLogo } from '@/components/ui/logo';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import Link from 'next/link';
import { ArrowLeft, Cpu, Wifi, Globe, Radio, Zap } from 'lucide-react';

export default function SetupPage() {
  const t = useTranslations('setup');
  const tNav = useTranslations('nav');
  const locale = useLocale();

  const steps = [
    { icon: <Zap size={20} />, title: t('step1Title'), desc: t('step1Desc') },
    { icon: <Cpu size={20} />, title: t('step2Title'), desc: t('step2Desc') },
    { icon: <Wifi size={20} />, title: t('step3Title'), desc: t('step3Desc') },
    { icon: <Globe size={20} />, title: t('step4Title'), desc: t('step4Desc') },
    { icon: <Globe size={20} />, title: t('step5Title'), desc: t('step5Desc') },
    { icon: <Radio size={20} />, title: t('step6Title'), desc: t('step6Desc') },
  ];

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

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((s, i) => (
            <div key={i} className="bg-luxa-bg-card border border-luxa-border rounded-xl p-5 hover:border-luxa-gold/20 transition">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-luxa-gold/10 text-luxa-gold shrink-0 mt-0.5">{s.icon}</div>
                <div>
                  <h3 className="font-semibold text-luxa-text mb-1">{s.title}</h3>
                  <p className="text-sm text-luxa-muted">{s.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pinout */}
        <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-5">
          <h2 className="text-lg font-semibold text-luxa-text mb-4">{t('pinout')}</h2>
          <div className="space-y-2 font-mono text-xs">
            <PinRow label={t('pinCC1101')} />
            <PinRow label={t('pinMotor')} />
            <PinRow label={t('pinEndstop')} />
            <PinRow label={t('pinLED')} />
          </div>
        </div>

        <div className="flex justify-between text-sm">
          <Link href={`/${locale}/firmware`} className="text-luxa-gold hover:underline">← {tNav('firmware')}</Link>
          <Link href={`/${locale}/dashboard`} className="text-luxa-gold hover:underline">{tNav('dashboard')} →</Link>
        </div>
      </main>
    </div>
  );
}

function PinRow({ label }: { label: string }) {
  return (
    <div className="p-2 bg-luxa-bg rounded-lg border border-luxa-border text-luxa-gold">
      {label}
    </div>
  );
}
