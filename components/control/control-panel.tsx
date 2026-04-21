'use client';
// components/control/control-panel.tsx
// Apple + Hue hybrid dashboard — Cloud edition.
// Commands → Supabase 'commands' table (cloud relay, ~1-3s delay).
// Premium cloud features labelled with ◈ badge.

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';
import type { Device, SafetyEvent } from '@/lib/types';

// ─── Design tokens (matches luxa-core web_ui_final.jsx exactly) ─
const C = {
  gold:   '#c9963b',
  blue:   '#0ea5e9',
  green:  '#34c759',
  red:    '#ff3b30',
  purple: '#bf5af2',
  orange: '#ff9f0a',
  teal:   '#5ac8fa',
  bg:     '#0a0a0c',
};
const SF      = `-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",sans-serif`;
const SF_R    = `"SF Pro Rounded",-apple-system,BlinkMacSystemFont,sans-serif`;
const SF_MONO = `"SF Mono","Menlo","Monaco","Consolas",monospace`;

// ─── Feature split ───────────────────────────────────────────────
// CLOUD (premium):  remote command relay, history charts, multi-device,
//                   OTA, alert timeline, dealer portal, schedule sync.
// CORE  (local):    direct motor control (<10ms), live sensors, local scenes.

const CATEGORIES = [
  { id: 'covers',  icon: '🪟', label: 'Perdeler',  col: C.gold   },
  { id: 'sensors', icon: '📊', label: 'Sensörler', col: C.blue   },
  { id: 'safety',  icon: '🛡', label: 'Güvenlik',  col: C.red    },
  { id: 'climate', icon: '🌡', label: 'İklim',     col: C.teal   },
  { id: 'auto',    icon: '⚡', label: 'Otomasyon', col: C.green  },
  { id: 'history', icon: '📈', label: 'Geçmiş',    col: C.purple, premium: true },
];

// ─── Types ────────────────────────────────────────────────────────
interface Props {
  devices:       Device[];
  latestReadings: Record<string, number>;
  safetyEvents:  SafetyEvent[];
}

interface CoverState {
  id: number;
  name: string;
  pos: number;
  moving: boolean;
  dir: 'up' | 'down' | 'stop';
  paired: boolean;
}

// ─── SVG Arc helper ───────────────────────────────────────────────
function arcPath(cx: number, cy: number, r: number, s: number, e: number) {
  const rad = (d: number) => d * Math.PI / 180;
  const sx = cx + r * Math.cos(rad(s)), sy = cy + r * Math.sin(rad(s));
  const ex = cx + r * Math.cos(rad(e)), ey = cy + r * Math.sin(rad(e));
  return `M${sx} ${sy} A${r} ${r} 0 ${(e - s) > 180 ? 1 : 0} 1 ${ex} ${ey}`;
}

// ─── Main component ───────────────────────────────────────────────
export function ControlPanel({ devices, latestReadings, safetyEvents }: Props) {
  const [cat,    setCat]    = useState('covers');
  const [device, setDevice] = useState<Device>(devices[0]);
  const [covers, setCovers] = useState<CoverState[]>(() => {
    const n = device.status?.remote_count ?? 0;
    return Array.from({ length: Math.max(n, 1) }, (_, i) => ({
      id: i, name: `Motor ${i + 1}`, pos: 0,
      moving: false, dir: 'stop', paired: true,
    }));
  });
  const [sheet,   setSheet]   = useState<CoverState | null>(null);
  const [localPos, setLocalPos] = useState(0);
  const [sending, setSending]  = useState<string | null>(null);
  const [toast,   setToast]    = useState<{ msg: string; ok: boolean } | null>(null);
  const [time,    setTime]     = useState(new Date());

  const supabase = createClient();

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (sheet) setLocalPos(sheet.pos);
  }, [sheet?.id]);

  // Send command via Supabase (cloud relay)
  const sendCmd = useCallback(async (action: string, target: number = 0) => {
    setSending(action);
    const { error } = await supabase.from('commands').insert({
      device_id: device.device_id,
      action, target, status: 'pending',
    });
    if (error) {
      setToast({ msg: 'Komut gönderilemedi', ok: false });
    } else {
      setToast({ msg: '◈ Komut buluta gönderildi (~1-3s)', ok: true });
      // Optimistically update local state
      if (action.startsWith('rts_')) {
        setCovers(prev => prev.map(c => c.id !== target ? c : {
          ...c,
          moving: action !== 'rts_my',
          dir: action === 'rts_up' ? 'up' : action === 'rts_down' ? 'down' : 'stop',
        }));
        if (sheet?.id === target) {
          setSheet(prev => prev ? {
            ...prev,
            moving: action !== 'rts_my',
            dir: action === 'rts_up' ? 'up' : action === 'rts_down' ? 'down' : 'stop',
          } : null);
        }
      }
    }
    setSending(null);
    setTimeout(() => setToast(null), 3000);
  }, [device.device_id, sheet, supabase]);

  // Realtime subscription to command results
  useEffect(() => {
    const channel = supabase
      .channel(`cmd-${device.device_id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'commands',
        filter: `device_id=eq.${device.device_id}`,
      }, (payload) => {
        if (payload.new.status === 'executed') {
          setToast({ msg: '✓ Komut cihaza ulaştı', ok: true });
          setTimeout(() => setToast(null), 2000);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [device.device_id, supabase]);

  const hh = time.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const dd = time.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
  const isOnline = device.last_seen && (Date.now() - new Date(device.last_seen).getTime()) < 300_000;
  const activeSafety = safetyEvents.filter(e => e.state === 'alarm' || e.state === 'warning');
  const catCol = CATEGORIES.find(c => c.id === cat)?.col ?? C.gold;

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, overflowX: 'hidden', fontFamily: SF }}>

      {/* Ambient blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: -150, left: -100, width: 500, height: 500,
          background: `radial-gradient(ellipse,${catCol}0d 0%,transparent 65%)`,
          transition: 'background .6s',
        }} />
        <div style={{
          position: 'absolute', bottom: 80, right: -60, width: 380, height: 380,
          background: `radial-gradient(ellipse,${C.blue}0b 0%,transparent 65%)`,
        }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, paddingBottom: 100 }}>
        <div style={{ height: 'env(safe-area-inset-top,12px)' }} />

        {/* ── Header ── */}
        <div style={{ padding: '16px 20px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              {/* Clock */}
              <div style={{
                fontFamily: SF_R, fontSize: 50, fontWeight: 700,
                letterSpacing: -2, lineHeight: 1, color: 'rgba(255,255,255,.95)',
              }}>{hh}</div>
              <div style={{
                fontFamily: SF, fontSize: 14, fontWeight: 400,
                letterSpacing: -0.1, color: 'rgba(255,255,255,.38)', marginTop: 3,
              }}>{dd}</div>
            </div>

            {/* Right: device + badges */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7 }}>
              {/* Device selector (if multiple) */}
              {devices.length > 1 && (
                <select
                  value={device.device_id}
                  onChange={e => setDevice(devices.find(d => d.device_id === e.target.value) ?? devices[0])}
                  style={{
                    background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)',
                    borderRadius: 10, padding: '5px 10px', color: 'rgba(255,255,255,.8)',
                    fontFamily: SF, fontSize: 12, cursor: 'pointer', outline: 'none',
                  }}
                >
                  {devices.map(d => (
                    <option key={d.device_id} value={d.device_id}>{d.name || d.device_id}</option>
                  ))}
                </select>
              )}

              {/* Online status */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
                borderRadius: 20, background: isOnline ? `${C.green}18` : `${C.red}18`,
                border: `1px solid ${isOnline ? C.green + '40' : C.red + '40'}`,
              }}>
                <div style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: isOnline ? C.green : C.red,
                  boxShadow: `0 0 6px ${isOnline ? C.green : C.red}`,
                }} />
                <span style={{
                  fontFamily: SF, fontSize: 10, fontWeight: 700,
                  letterSpacing: .4, color: isOnline ? C.green : C.red,
                }}>
                  {device.name || device.device_id} · {isOnline ? 'ÇEVRIMIÇI' : 'ÇEVRİMDIŞI'}
                </span>
              </div>

              {/* Cloud badge */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
                borderRadius: 20, background: `${C.blue}18`, border: `1px solid ${C.blue}40`,
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.blue, boxShadow: `0 0 6px ${C.blue}` }} />
                <span style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, letterSpacing: .4, color: C.blue }}>
                  ◈ BULUT
                </span>
              </div>

              {/* Safety alert badge */}
              {activeSafety.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
                  borderRadius: 20, background: `${C.red}22`, border: `1px solid ${C.red}55`,
                  animation: 'pulseRed 1.5s infinite',
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.red, boxShadow: `0 0 8px ${C.red}` }} />
                  <span style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, letterSpacing: .4, color: C.red }}>
                    {activeSafety.length} ALARM
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Toast */}
          {toast && (
            <div style={{
              marginTop: 12, padding: '9px 14px', borderRadius: 12,
              background: toast.ok ? `${C.blue}18` : `${C.red}18`,
              border: `1px solid ${toast.ok ? C.blue + '40' : C.red + '40'}`,
              fontFamily: SF, fontSize: 13, fontWeight: 500,
              color: toast.ok ? C.blue : C.red,
            }}>{toast.msg}</div>
          )}
        </div>

        {/* ── Category tabs ── */}
        <div style={{
          display: 'flex', gap: 0, overflowX: 'auto', padding: '0 16px',
          marginBottom: 20, scrollbarWidth: 'none',
        }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setCat(c.id)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '8px 12px', border: 'none', background: 'transparent',
              cursor: 'pointer', flexShrink: 0, position: 'relative',
              WebkitTapHighlightColor: 'transparent',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: cat === c.id ? `${c.col}30` : 'rgba(255,255,255,.06)',
                border: `1.5px solid ${cat === c.id ? c.col + '66' : 'rgba(255,255,255,.08)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                boxShadow: cat === c.id ? `0 0 20px ${c.col}44` : 'none',
                transition: 'all .25s',
                filter: cat === c.id ? `drop-shadow(0 0 6px ${c.col}88)` : 'none',
                position: 'relative',
              }}>
                {c.icon}
                {c.premium && (
                  <div style={{
                    position: 'absolute', top: -4, right: -4, width: 14, height: 14,
                    borderRadius: '50%', background: C.purple, border: '2px solid #0a0a0c',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 7, fontWeight: 800, color: 'white',
                  }}>◈</div>
                )}
              </div>
              <span style={{
                fontFamily: SF, fontSize: 10, fontWeight: cat === c.id ? 700 : 500,
                letterSpacing: .2, color: cat === c.id ? c.col : 'rgba(255,255,255,.35)',
                transition: 'color .2s', whiteSpace: 'nowrap',
              }}>{c.label}</span>
              {cat === c.id && (
                <div style={{
                  position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                  width: 20, height: 2, borderRadius: 1, background: c.col,
                  boxShadow: `0 0 6px ${c.col}`,
                }} />
              )}
            </button>
          ))}
        </div>

        {/* ── Content per category ── */}

        {/* COVERS */}
        {cat === 'covers' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 20px' }}>
            {covers.map(cv => (
              <button key={cv.id} onClick={() => setSheet(cv)} style={{
                background: cv.pos > 0
                  ? `linear-gradient(145deg,${C.gold}20,${C.gold}07)`
                  : 'rgba(255,255,255,.05)',
                border: `1px solid ${cv.pos > 0 ? C.gold + '40' : 'rgba(255,255,255,.08)'}`,
                borderRadius: 20, padding: '16px 14px', cursor: 'pointer', textAlign: 'left',
                position: 'relative', overflow: 'hidden',
                boxShadow: cv.moving ? `0 0 28px ${C.gold}22,0 4px 16px rgba(0,0,0,.4)` : '0 2px 8px rgba(0,0,0,.25)',
                transition: 'all .25s', color: 'white',
                WebkitTapHighlightColor: 'transparent',
              }}
              onPointerDown={e => (e.currentTarget as HTMLButtonElement).style.transform = 'scale(.95)'}
              onPointerUp={e => (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'}
              >
                {/* Fill */}
                <div style={{
                  position: 'absolute', left: 0, bottom: 0, width: '100%', height: `${cv.pos}%`,
                  background: cv.moving
                    ? `linear-gradient(to top,${C.gold}3a,transparent)`
                    : `linear-gradient(to top,${C.gold}1a,transparent)`,
                  transition: 'height .7s cubic-bezier(.4,0,.2,1)',
                  pointerEvents: 'none', borderRadius: '0 0 20px 20px',
                }} />
                {/* Shimmer */}
                {cv.moving && (
                  <div style={{
                    position: 'absolute', left: 0, bottom: `${cv.pos - 1}%`, width: '100%', height: 1,
                    background: `linear-gradient(90deg,transparent,${C.gold}cc,transparent)`,
                    animation: 'shimmer 1.8s linear infinite', pointerEvents: 'none',
                  }} />
                )}
                {/* Status dot */}
                <div style={{
                  position: 'absolute', top: 13, right: 13, width: 7, height: 7, borderRadius: '50%',
                  background: cv.moving ? C.gold : cv.pos > 0 ? `${C.gold}88` : 'rgba(255,255,255,.15)',
                  boxShadow: cv.moving ? `0 0 10px ${C.gold}` : 'none',
                  animation: cv.moving ? 'pulse 1.1s ease-in-out infinite' : 'none',
                }} />
                <div style={{ fontSize: 22, marginBottom: 8, lineHeight: 1, position: 'relative',
                  filter: cv.pos > 0 ? `drop-shadow(0 0 6px ${C.gold}88)` : 'none' }}>🪟</div>
                <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, letterSpacing: -0.1,
                  color: 'rgba(255,255,255,.9)', marginBottom: 4, lineHeight: 1.2, position: 'relative' }}>
                  {cv.name}
                </div>
                <div style={{ fontFamily: SF_MONO, fontSize: 20, fontWeight: 700, letterSpacing: -0.8,
                  color: cv.moving ? C.gold : cv.pos > 0 ? `${C.gold}cc` : 'rgba(255,255,255,.3)',
                  transition: 'color .3s', position: 'relative' }}>
                  {cv.pos}%
                </div>
              </button>
            ))}
          </div>
        )}

        {/* SENSORS */}
        {cat === 'sensors' && (
          <div style={{ padding: '0 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {Object.entries({
                temp:     { icon: '🌡', label: 'Sıcaklık',  unit: '°C' },
                humidity: { icon: '💧', label: 'Nem',        unit: '%'  },
                lux:      { icon: '☀️', label: 'Işık',       unit: ' lx'},
                gas:      { icon: '⚗️', label: 'Gaz',        unit: ' %' },
                water:    { icon: '💧', label: 'Su',         unit: '' },
                rain:     { icon: '🌧', label: 'Yağmur',    unit: '' },
              }).map(([ch, meta]) => {
                const val = latestReadings[ch];
                const hasVal = val !== undefined;
                return (
                  <div key={ch} style={{
                    background: 'rgba(255,255,255,.05)',
                    border: `1px solid ${hasVal ? C.blue + '30' : 'rgba(255,255,255,.07)'}`,
                    borderRadius: 20, padding: '18px 16px',
                  }}>
                    <div style={{ fontSize: 26, marginBottom: 10 }}>{meta.icon}</div>
                    <div style={{
                      fontFamily: SF_MONO, fontSize: 26, fontWeight: 700,
                      letterSpacing: -0.8, lineHeight: 1, marginBottom: 6,
                      color: hasVal ? C.blue : 'rgba(255,255,255,.3)',
                    }}>
                      {hasVal ? val.toFixed(1) : '—'}
                      <span style={{ fontSize: 13, fontWeight: 400, opacity: .7 }}>{meta.unit}</span>
                    </div>
                    <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 600,
                      letterSpacing: .4, textTransform: 'uppercase', color: 'rgba(255,255,255,.35)' }}>
                      {meta.label}
                    </div>
                    {!hasVal && (
                      <div style={{ fontFamily: SF, fontSize: 10, color: 'rgba(255,255,255,.2)', marginTop: 4 }}>
                        Veri bekleniyor
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SAFETY */}
        {cat === 'safety' && (
          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {safetyEvents.length === 0 ? (
              <div style={{
                background: `${C.green}12`, border: `1px solid ${C.green}30`,
                borderRadius: 20, padding: '32px 20px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 600, color: C.green }}>
                  Tüm sistemler normal
                </div>
              </div>
            ) : safetyEvents.map(ev => {
              const alarm = ev.state === 'alarm';
              const col = alarm ? C.red : ev.state === 'warning' ? C.orange : C.green;
              return (
                <div key={ev.id} style={{
                  background: `${col}12`, border: `1px solid ${col}35`,
                  borderRadius: 18, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  animation: alarm ? 'pulseRed 1.5s infinite' : 'none',
                }}>
                  <div style={{ fontSize: 24 }}>
                    {ev.alarm_type === 1 ? '🔥' : ev.alarm_type === 2 ? '⚠️' : ev.alarm_type === 3 ? '💧' : '🚨'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: col, marginBottom: 2 }}>
                      {ev.alarm_type_name || `Alarm #${ev.alarm_type}`}
                    </div>
                    <div style={{ fontFamily: SF, fontSize: 12, color: 'rgba(255,255,255,.45)' }}>
                      {new Date(ev.ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                      {ev.value != null ? ev.value.toFixed(2) : ev.state}
                    </div>
                  </div>
                  <div style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, letterSpacing: .4, color: col }}>
                    {ev.state.toUpperCase()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CLIMATE */}
        {cat === 'climate' && (
          <div style={{ padding: '0 20px' }}>
            <div style={{
              background: 'rgba(255,255,255,.04)', border: `1px solid ${C.teal}30`,
              borderRadius: 20, padding: 24, textAlign: 'center',
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🌡</div>
              <div style={{ fontFamily: SF_MONO, fontSize: 40, fontWeight: 700, color: C.teal, letterSpacing: -1.5 }}>
                {latestReadings.temp != null ? latestReadings.temp.toFixed(1) : '--'}
                <span style={{ fontFamily: SF, fontSize: 18, fontWeight: 400, opacity: .6 }}>°C</span>
              </div>
              <div style={{ fontFamily: SF, fontSize: 13, color: 'rgba(255,255,255,.4)', marginTop: 6 }}>
                Nem: {latestReadings.humidity != null ? latestReadings.humidity.toFixed(0) + '%' : '—'}
              </div>
              <div style={{
                display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20,
                flexWrap: 'wrap',
              }}>
                {['Konfor', 'Eko', 'Boost', 'Uzakta', 'Kapalı'].map(mode => (
                  <button key={mode} onClick={() => sendCmd('climate_mode', 0)} style={{
                    padding: '8px 16px', borderRadius: 12, border: `1px solid ${C.teal}40`,
                    background: `${C.teal}15`, color: C.teal, cursor: 'pointer',
                    fontFamily: SF, fontSize: 13, fontWeight: 600,
                    WebkitTapHighlightColor: 'transparent',
                  }}>{mode}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AUTOMATION */}
        {cat === 'auto' && (
          <div style={{ padding: '0 20px' }}>
            <div style={{
              background: `${C.green}10`, border: `1px solid ${C.green}30`,
              borderRadius: 16, padding: '12px 16px', marginBottom: 16,
              fontFamily: SF, fontSize: 13, fontWeight: 500, color: `${C.green}cc`,
            }}>
              ◈ Otomasyon kuralları Supabase üzerinde çalışır — cloud premium özellik.{' '}
              <a href="/rules" style={{ color: C.green, fontWeight: 700 }}>Kural Yöneticisi →</a>
            </div>
            {[
              { icon: '💨', name: 'Rüzgar → Perde Kapat', desc: 'Rüzgar > 30 km/h', on: true,  col: C.teal  },
              { icon: '🌡', name: 'Sıcaklık → Klima Eko', desc: 'Sıcaklık > 28°C',  on: true,  col: C.orange},
              { icon: '🔥', name: 'Duman → Acil Durdur',  desc: 'Duman alarmı',     on: true,  col: C.red   },
              { icon: '⏰', name: 'Sabah 07:00 Aç',        desc: 'Zamanlanmış',      on: false, col: C.gold  },
            ].map((r, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
                borderRadius: 16, padding: '13px 16px', display: 'flex', alignItems: 'center',
                gap: 12, marginBottom: 8, opacity: r.on ? 1 : .5,
              }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                  background: `${r.col}20`, border: `1px solid ${r.col}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {r.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,.88)', marginBottom: 2 }}>{r.name}</div>
                  <div style={{ fontFamily: SF, fontSize: 12, color: 'rgba(255,255,255,.38)' }}>{r.desc}</div>
                </div>
                <span style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, letterSpacing: .4,
                  color: r.on ? C.green : 'rgba(255,255,255,.25)' }}>
                  {r.on ? 'AKTİF' : 'PASİF'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* HISTORY (Premium) */}
        {cat === 'history' && (
          <div style={{ padding: '0 20px' }}>
            <div style={{
              background: `${C.purple}12`, border: `1px solid ${C.purple}35`,
              borderRadius: 20, padding: '20px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ fontSize: 28 }}>◈</div>
              <div>
                <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 700, color: C.purple, marginBottom: 4 }}>
                  Premium Cloud Özelliği
                </div>
                <div style={{ fontFamily: SF, fontSize: 13, color: 'rgba(255,255,255,.5)' }}>
                  Sensor geçmişi, motor aktivite log'u ve enerji analitikleri cloud'da saklanır.
                  Core cihazda bu veriler yoktur.
                </div>
              </div>
            </div>
            {/* Sensor chart placeholder */}
            <div style={{
              background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 20, padding: 20,
            }}>
              <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 600, letterSpacing: .4,
                textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 16 }}>
                SON 24 SAAT — SICAKLIK
              </div>
              <svg width="100%" height={80} viewBox="0 0 300 80" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.blue} stopOpacity=".4"/>
                    <stop offset="100%" stopColor={C.blue} stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <path d="M0,60 C50,55 100,40 150,42 C200,44 250,30 300,35"
                  fill="none" stroke={C.blue} strokeWidth={2} strokeLinecap="round"/>
                <path d="M0,60 C50,55 100,40 150,42 C200,44 250,30 300,35 L300,80 L0,80 Z"
                  fill="url(#g1)"/>
              </svg>
              <a href={`/devices/${device.id}/sensors`} style={{
                display: 'inline-block', marginTop: 12, padding: '9px 16px',
                borderRadius: 12, background: `${C.purple}22`, border: `1px solid ${C.purple}40`,
                color: C.purple, fontFamily: SF, fontSize: 13, fontWeight: 600,
                textDecoration: 'none',
              }}>Detaylı Sensor Geçmişi →</a>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Sheet (Cover control) ── */}
      {sheet && (
        <>
          <div onClick={() => setSheet(null)} style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }} />
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 101,
            background: '#111114', borderRadius: '28px 28px 0 0',
            border: '1px solid rgba(255,255,255,.1)', borderBottom: 'none',
            boxShadow: '0 -24px 64px rgba(0,0,0,.65)',
            paddingBottom: 'env(safe-area-inset-bottom,24px)',
            animation: 'slideUp .35s cubic-bezier(.32,0,.67,0) forwards',
            maxHeight: '88dvh', overflowY: 'auto',
          }}>
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.2)' }} />
            </div>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '4px 24px 0', marginBottom: 4 }}>
              <div>
                <div style={{ fontFamily: SF, fontSize: 22, fontWeight: 700, letterSpacing: -0.4, color: 'rgba(255,255,255,.95)' }}>
                  {sheet.name}
                </div>
                <div style={{ fontFamily: SF, fontSize: 13, color: 'rgba(255,255,255,.38)', marginTop: 3 }}>
                  {device.name || device.device_id} · {sheet.paired ? 'RTS Eşleştirildi' : 'Röle'}
                </div>
              </div>
              <button onClick={() => setSheet(null)} style={{
                width: 32, height: 32, borderRadius: 16, background: 'rgba(255,255,255,.1)',
                border: 'none', color: 'rgba(255,255,255,.6)', cursor: 'pointer',
                fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, WebkitTapHighlightColor: 'transparent',
              }}>✕</button>
            </div>

            {/* Cloud delay notice */}
            <div style={{ margin: '8px 24px 0', background: 'rgba(14,165,233,.1)', border: '1px solid rgba(14,165,233,.25)', borderRadius: 12, padding: '7px 12px' }}>
              <span style={{ fontFamily: SF, fontSize: 12, fontWeight: 500, color: 'rgba(14,165,233,.85)' }}>
                ◈ Bulut üzerinden · Komut cihaza ~1-3 saniyede ulaşır
              </span>
            </div>

            {/* Arc dial */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0', marginBottom: -8 }}>
              <svg width={160} height={136} viewBox="0 0 160 136" style={{ overflow: 'visible' }}>
                <path d={arcPath(80, 90, 64, -210, 30)} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={5} strokeLinecap="round"/>
                {localPos > 0 && (
                  <path d={arcPath(80, 90, 64, -210, -210 + (localPos / 100) * 240)} fill="none"
                    stroke={sheet.moving ? C.gold : 'rgba(201,150,59,.75)'} strokeWidth={5} strokeLinecap="round"
                    style={{ filter: sheet.moving ? `drop-shadow(0 0 5px ${C.gold})` : 'none' }}/>
                )}
                <text x={80} y={84} textAnchor="middle" fontFamily={SF_R}
                  fontSize={36} fontWeight={700} letterSpacing={-1.5}
                  fill={sheet.moving ? C.gold : 'rgba(255,255,255,.88)'}>
                  {localPos}
                </text>
                <text x={80} y={104} textAnchor="middle" fontFamily={SF}
                  fontSize={11} fontWeight={600} letterSpacing={.4} fill="rgba(255,255,255,.28)">
                  YÜZDE
                </text>
              </svg>
            </div>

            {/* Slider */}
            <div style={{ padding: '0 28px 8px' }}>
              <input type="range" min={0} max={100} value={localPos}
                onChange={e => {
                  setLocalPos(+e.target.value);
                  setSheet(prev => prev ? { ...prev, pos: +e.target.value } : null);
                }}
                style={{ width: '100%', height: 32, appearance: 'none', WebkitAppearance: 'none', background: 'transparent', cursor: 'pointer', outline: 'none', border: 'none' }}/>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: '0 24px 20px' }}>
              {([
                ['↑', 'AÇ',    'rts_up',   C.gold],
                ['■', 'DUR',   'rts_my',   'rgba(255,255,255,.45)'],
                ['↓', 'KAPAT', 'rts_down', C.blue],
              ] as [string, string, string, string][]).map(([ic, label, cmd, col]) => (
                <button key={cmd}
                  onClick={() => sendCmd(cmd, sheet.id)}
                  disabled={sending === cmd}
                  style={{
                    height: 64, borderRadius: 16, border: 'none', background: `${col}1a`,
                    color: col, cursor: 'pointer', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 3, fontFamily: SF,
                    transition: 'background .15s', WebkitTapHighlightColor: 'transparent',
                    opacity: sending === cmd ? .5 : 1,
                  }}
                  onPointerDown={e => (e.currentTarget as HTMLButtonElement).style.background = `${col}33`}
                  onPointerUp={e => (e.currentTarget as HTMLButtonElement).style.background = `${col}1a`}
                >
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{ic}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: .5 }}>{label}</span>
                </button>
              ))}
            </div>

            {/* Info */}
            <div style={{ margin: '0 24px 8px', background: 'rgba(255,255,255,.04)', borderRadius: 14, padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[['Durum', sheet.moving ? 'Hareket' : sheet.pos === 0 ? 'Kapalı' : sheet.pos === 100 ? 'Açık' : 'Kısmi'],
                ['Pozisyon', `${localPos}%`],
                ['Protokol', sheet.paired ? 'Somfy RTS' : 'Röle']].map(([k, v]) => (
                <div key={k} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: SF_MONO, fontSize: 14, fontWeight: 700, letterSpacing: -0.3, color: 'rgba(255,255,255,.82)', marginBottom: 3 }}>{v}</div>
                  <div style={{ fontFamily: SF, fontSize: 10, fontWeight: 600, letterSpacing: .4, textTransform: 'uppercase', color: 'rgba(255,255,255,.3)' }}>{k}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <style>{`
        * { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { display: none; }
        input[type="range"] { -webkit-appearance: none; appearance: none; outline: none; }
        input[type="range"]::-webkit-slider-runnable-track { height: 3px; background: rgba(255,255,255,.12); border-radius: 2px; }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 26px; height: 26px; border-radius: 50%;
          background: ${C.gold}; box-shadow: 0 0 14px ${C.gold}aa; margin-top: -11.5px; transition: transform .15s; }
        input[type="range"]:active::-webkit-slider-thumb { transform: scale(1.28); }
        @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.78)} }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes pulseRed { 0%,100%{box-shadow:0 0 0 rgba(255,59,48,0)} 50%{box-shadow:0 0 20px rgba(255,59,48,.4)} }
      `}</style>
    </div>
  );
}
