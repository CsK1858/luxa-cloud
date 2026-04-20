'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase-client';
import { LuxaCloudLogo } from '@/components/ui/logo';
import { LayoutDashboard, Cpu, LogOut, Globe, User } from 'lucide-react';

export function Navbar() {
  const t = useTranslations('nav');
  const tAuth = useTranslations('auth');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
    router.refresh();
  };

  const switchLocale = () => {
    const newLocale = locale === 'tr' ? 'en' : 'tr';
    router.push(pathname.replace(`/${locale}`, `/${newLocale}`));
  };

  const isActive = (path: string) => pathname.includes(path);

  return (
    <nav className="sticky top-0 z-50 bg-luxa-bg/80 backdrop-blur-xl border-b border-luxa-border">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Logo: Luxa Cloud with blue branding */}
        <Link href={`/${locale}/dashboard`} className="flex items-center gap-3">
          <LuxaCloudLogo size={34} />
          <span className="font-bold tracking-wider text-lg hidden sm:flex items-baseline gap-1">
            <span className="text-luxa-gold">Luxa</span>
            <span style={{ color: '#0ea5e9' }}>Cloud</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <NavLink href={`/${locale}/dashboard`} active={isActive('/dashboard')}>
            <LayoutDashboard size={18} />
            <span className="hidden sm:inline">{t('dashboard')}</span>
          </NavLink>
          <NavLink href={`/${locale}/devices`} active={isActive('/devices')}>
            <Cpu size={18} />
            <span className="hidden sm:inline">{t('devices')}</span>
          </NavLink>
          <NavLink href={`/${locale}/profile`} active={isActive('/profile')}>
            <User size={18} />
            <span className="hidden sm:inline">{t('profile')}</span>
          </NavLink>
          <button onClick={switchLocale}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-luxa-muted hover:text-luxa-text hover:bg-luxa-bg-hover transition"
            title={locale === 'tr' ? 'English' : 'Türkçe'}>
            <Globe size={18} />
            <span className="text-xs uppercase">{locale === 'tr' ? 'EN' : 'TR'}</span>
          </button>
          <button onClick={handleLogout}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-luxa-muted hover:text-luxa-error hover:bg-luxa-bg-hover transition">
            <LogOut size={18} />
            <span className="hidden sm:inline">{tAuth('logout')}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition ${
        active ? 'text-luxa-gold bg-luxa-bg-hover' : 'text-luxa-muted hover:text-luxa-text hover:bg-luxa-bg-hover'
      }`}>
      {children}
    </Link>
  );
}
