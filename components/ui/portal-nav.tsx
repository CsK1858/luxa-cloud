'use client';
import { useState, useEffect } from 'react';

const IC_HOME = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>;
const IC_CFG  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>;
const IC_CORE = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M6.3 6.3a8 8 0 000 11.4M17.7 6.3a8 8 0 010 11.4"/><path d="M3.5 3.5a13 13 0 000 17M20.5 3.5a13 13 0 010 17"/></svg>;
const IC_CTRL = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
const IC_DEAL = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18l-2 9H5L3 9z"/><path d="M3 9L5 3h14l2 6"/><circle cx="9" cy="20" r="1" fill="currentColor"/><circle cx="15" cy="20" r="1" fill="currentColor"/></svg>;

const PORTALS = [
  { id: 'home',         Icon: IC_HOME, tr: 'Ana Sayfa',       de: 'Startseite',      en: 'Home',            path: 'https://luxasystem.com',          ext: true  },
  { id: 'configurator', Icon: IC_CFG,  tr: '3D Konfiguratör', de: '3D Konfigurator', en: '3D Configurator',  path: 'https://luxasystem.com/configure', ext: true  },
  { id: 'core',         Icon: IC_CORE, tr: 'Luxa Core',       de: 'Luxa Core',       en: 'Luxa Core',        path: '/',                               ext: false },
  { id: 'control',      Icon: IC_CTRL, tr: 'Kontrol',         de: 'Kontrolle',       en: 'Control',          path: 'https://luxasystem.com/dashboard', ext: true  },
  { id: 'dealer',       Icon: IC_DEAL, tr: 'Bayi',            de: 'Händler',         en: 'Dealer',           path: 'https://luxasystem.com/dealer',    ext: true  },
];

const GOLD = '#c9963b';
const RED  = '#dc2626';

export function PortalNav({ activeId = 'core' }: { activeId?: string }) {
  const [locale, setLocale] = useState('en');
  const [ready,  setReady]  = useState(false);

  useEffect(() => {
    const bl = navigator.language?.substring(0, 2) || 'en';
    setLocale(['tr', 'de', 'en'].includes(bl) ? bl : 'en');
    const t = setTimeout(() => setReady(true), 150);
    return () => clearTimeout(t);
  }, []);

  const lbl = (p: typeof PORTALS[0]) =>
    locale === 'tr' ? p.tr : locale === 'de' ? p.de : p.en;

  return (
    <>
      <div style={{ height: 58 }} />
      <nav
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          display: 'flex', justifyContent: 'center',
          opacity: ready ? 1 : 0, transition: 'opacity .3s',
        }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'stretch',
            background: 'rgba(13,13,15,0.97)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 -2px 20px rgba(0,0,0,0.35)',
            width: '100%', maxWidth: 680,
          }}
        >
          {PORTALS.map((p) => {
            const isActive = p.id === activeId;
            const isCore   = p.id === 'core';
            const col = isActive ? (isCore ? RED : GOLD) : 'rgba(255,255,255,0.32)';

            return (
              <a
                key={p.id}
                href={p.path}
                {...(p.ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 3, padding: '9px 4px 13px',
                  textDecoration: 'none', color: col,
                  transition: 'color .2s', position: 'relative', minWidth: 0,
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.7)'; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.32)'; }}
              >
                {isActive && (
                  <span style={{
                    position: 'absolute', top: 0, left: '50%',
                    transform: 'translateX(-50%)',
                    width: 24, height: 2, borderRadius: 2,
                    background: isCore ? RED : GOLD,
                  }} />
                )}
                <span style={{ display: 'flex', opacity: isActive ? 1 : 0.45 }}>
                  <p.Icon />
                </span>
                <span style={{
                  fontSize: 10, fontWeight: isActive ? 700 : 500,
                  letterSpacing: '0.02em', whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  maxWidth: '100%', lineHeight: 1,
                }}>
                  {isCore && isActive
                    ? <span>Luxa <span style={{ color: RED }}>Core</span></span>
                    : lbl(p)}
                </span>
              </a>
            );
          })}
        </div>
      </nav>
    </>
  );
}
