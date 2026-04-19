'use client';
import { useState, useEffect } from 'react';

const IC_HOME = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>;
const IC_CFG  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>;
const IC_CORE = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M6.3 6.3a8 8 0 000 11.4M17.7 6.3a8 8 0 010 11.4"/><path d="M3.5 3.5a13 13 0 000 17M20.5 3.5a13 13 0 010 17"/></svg>;
const IC_CTRL = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
const IC_DEAL = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18l-2 9H5L3 9z"/><path d="M3 9L5 3h14l2 6"/><circle cx="9" cy="20" r="1" fill="currentColor"/><circle cx="15" cy="20" r="1" fill="currentColor"/></svg>;

const PORTALS = [
  { id:'home',         Icon:IC_HOME, tr:'Ana Sayfa',    de:'Startseite',   en:'Home',         path:'https://luxasystem.com',          ext:true  },
  { id:'configurator', Icon:IC_CFG,  tr:'Konfiguratör', de:'Konfigurator', en:'Configurator',  path:'https://luxasystem.com/configure', ext:true  },
  { id:'core',         Icon:IC_CORE, tr:'Luxa Core',    de:'Luxa Core',    en:'Luxa Core',     path:'/',                               ext:false },
  { id:'control',      Icon:IC_CTRL, tr:'Kontrol',      de:'Kontrolle',    en:'Control',       path:'https://luxasystem.com/dashboard', ext:true  },
  { id:'dealer',       Icon:IC_DEAL, tr:'Bayi',         de:'Händler',      en:'Dealer',        path:'https://luxasystem.com/dealer',    ext:true  },
];

const GOLD = '#c9963b';
const RED  = '#dc2626';

export function PortalNav({ activeId = 'core' }: { activeId?: string }) {
  const [locale, setLocale] = useState('en');
  const [ready,  setReady]  = useState(false);
  const [isMob,  setMob]    = useState(false);

  useEffect(() => {
    const bl = navigator.language?.substring(0, 2) || 'en';
    setLocale(['tr','de','en'].includes(bl) ? bl : 'en');
    setMob(window.innerWidth < 640);
    const t = setTimeout(() => setReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  const lbl = (p: typeof PORTALS[0]) =>
    locale === 'tr' ? p.tr : locale === 'de' ? p.de : p.en;

  return (
    <>
      <div style={{ height: 80 }} />
      <div style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: `translateX(-50%) translateY(${ready ? 0 : 16}px)`,
        opacity: ready ? 1 : 0,
        transition: 'opacity 0.35s ease, transform 0.35s cubic-bezier(.34,1.56,.64,1)',
        zIndex: 9999,
      }}>
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '8px 10px',
          background: 'rgba(20,20,22,0.82)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}>
          {PORTALS.map(p => {
            const active  = p.id === activeId;
            const isCore  = p.id === 'core';
            const activeCol = isCore ? RED : GOLD;

            return (
              <a
                key={p.id}
                href={p.path}
                {...(p.ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  padding: isMob ? '7px 12px' : '8px 16px',
                  borderRadius: 16,
                  textDecoration: 'none',
                  background: active ? `${activeCol}18` : 'transparent',
                  border: `1px solid ${active ? activeCol + '30' : 'transparent'}`,
                  color: active ? activeCol : 'rgba(255,255,255,0.38)',
                  transition: 'all 0.22s cubic-bezier(.4,0,.2,1)',
                  minWidth: isMob ? 52 : 64,
                  WebkitTapHighlightColor: 'transparent',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.72)'; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.38)'; }}
              >
                <span style={{ display: 'flex', lineHeight: 0 }}>
                  <p.Icon />
                </span>
                <span style={{
                  fontSize: isMob ? 9.5 : 10.5,
                  fontWeight: active ? 600 : 400,
                  letterSpacing: '0.01em',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}>
                  {isCore && active
                    ? <span>Luxa <span style={{ color: RED }}>Core</span></span>
                    : lbl(p)}
                </span>
              </a>
            );
          })}
        </nav>
      </div>
    </>
  );
}
