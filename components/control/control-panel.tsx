'use client';
// components/control/control-panel.tsx  v2
// Three-tab Apple-style layout:
//   ⬡ Kontrol   → category grid (Perdeler/Sensörler/Güvenlik/İklim/Otomasyon/Geçmiş)
//   ✦ Senaryolar → panoramic scene cards + custom groups + rules + schedules
//   ⊙ Ayarlar   → device info + cloud links
// Hides top navbar — full-screen immersive like Apple Home.

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';
import type { Device, SafetyEvent } from '@/lib/types';
import { ALARM_TYPE_NAMES, ALARM_TYPE_ICONS } from '@/lib/types';

// ─── Tokens ──────────────────────────────────────────────────────
const C = {
  gold:'#c9963b', blue:'#0ea5e9', green:'#34c759', red:'#ff3b30',
  purple:'#bf5af2', orange:'#ff9f0a', teal:'#5ac8fa', bg:'#0a0a0c',
};
const SF      = `-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",sans-serif`;
const SF_R    = `"SF Pro Rounded",-apple-system,BlinkMacSystemFont,sans-serif`;
const SF_MONO = `"SF Mono","Menlo","Monaco","Consolas",monospace`;

const CATS = [
  { id:'covers',  icon:'🪟', label:'Perdeler',  col:C.gold   },
  { id:'sensors', icon:'📊', label:'Sensörler', col:C.blue   },
  { id:'safety',  icon:'🛡', label:'Güvenlik',  col:C.red    },
  { id:'climate', icon:'🌡', label:'İklim',     col:C.teal   },
  { id:'auto',    icon:'⚡', label:'Otomasyon', col:C.green  },
  { id:'history', icon:'📈', label:'Geçmiş',    col:C.purple, premium:true },
];

const SCENE_CARDS = [
  { id:0, icon:'🌅', name:'Sabah',          grad:'linear-gradient(135deg,#1a0a00,#7a3800)', glow:'rgba(249,115,22,.38)', devices:'Perdeler %30 · Işıklar açık' },
  { id:1, icon:'☀️', name:'Gündüz',         grad:'linear-gradient(135deg,#1a1200,#7a5200)', glow:`rgba(201,150,59,.35)`, devices:'Normal çalışma modu' },
  { id:2, icon:'🎬', name:'Sinema',         grad:'linear-gradient(135deg,#050010,#180040)', glow:'rgba(129,140,248,.3)',  devices:'Perdeler %0 · Işıklar %10', active:true },
  { id:3, icon:'🌙', name:'Gece',           grad:'linear-gradient(135deg,#020412,#0a1540)', glow:'rgba(59,130,246,.25)',  devices:'Perdeler %0 · 18°C' },
  { id:4, icon:'⛈', name:'Fırtına',        grad:'linear-gradient(135deg,#0a0a0a,#1a1f24)', glow:'rgba(100,116,139,.3)',  devices:'Tüm perdeler kapat' },
  { id:5, icon:'🔒', name:'Hepsini Kapat',  grad:'linear-gradient(135deg,#001520,#003d5c)', glow:'rgba(14,165,233,.25)',  devices:'Tüm cihazlar kapalı' },
];

const GROUPS = [
  { id:0, icon:'🏡', name:'Teras Grubu',    devices:'Pergola · Zip · Teras Işık', activeN:2, col:C.gold   },
  { id:1, icon:'🔐', name:'Gece Güvenlik',  devices:'Duman · Gaz · Su · Hareket', activeN:0, col:C.blue   },
  { id:2, icon:'🛋', name:'Salon Tam',      devices:'Jaluzi · Tente · LED · Klima',activeN:3, col:'rgba(255,255,255,.5)' },
  { id:3, icon:'⚡', name:'Enerji Tasarruf',devices:'Işıklar %20 · Eko termostat', activeN:0, col:C.green  },
];

const RULES_MOCK = [
  { id:0, icon:'💨', col:C.teal,   name:'Rüzgar → Perde Kapat',  desc:'Rüzgar > 30 km/h → Kapat', on:true  },
  { id:1, icon:'🌡', col:C.orange, name:'Sıcaklık → Klima Eko',  desc:'Sıcaklık > 28°C → Eko',   on:true  },
  { id:2, icon:'🌧', col:C.blue,   name:'Yağmur → Tente Kapat',  desc:'Yağmur → Tente kapat',     on:false },
  { id:3, icon:'🔥', col:C.red,    name:'Duman → Acil Durdur',   desc:'Duman alarmı → Dur',        on:true  },
];

const SCHEDULES_MOCK = [
  { id:0, time:'07:00', period:'SABAH',        name:'Sabah Aç',        action:'Pergola+Zip → %60', next:'Yarın',    freq:'Hft içi', col:C.gold  },
  { id:1, time:'22:30', period:'GECE',         name:'Gece Kapatma',    action:'Perdeler kapat · Işıklar off', next:'Bu gece', freq:'Her gün', col:C.teal },
  { id:2, time:'14:00', period:'ÖĞLEDEN S.',   name:'Öğleden Sonra',   action:'Güney cephe %80',   next:'Devre dışı', freq:undefined, col:'rgba(255,255,255,.35)', disabled:true },
];

interface Props {
  devices:        Device[];
  latestReadings: Record<string, number>;
  safetyEvents:   SafetyEvent[];
}

interface CoverState { id:number; name:string; pos:number; moving:boolean; dir:'up'|'down'|'stop'; paired:boolean; }

function arcPath(cx:number,cy:number,r:number,s:number,e:number){
  const rad=(d:number)=>d*Math.PI/180;
  const [sx,sy]=[cx+r*Math.cos(rad(s)),cy+r*Math.sin(rad(s))];
  const [ex,ey]=[cx+r*Math.cos(rad(e)),cy+r*Math.sin(rad(e))];
  return `M${sx} ${sy} A${r} ${r} 0 ${(e-s)>180?1:0} 1 ${ex} ${ey}`;
}

export function ControlPanel({ devices, latestReadings, safetyEvents }:Props) {
  const [mainTab, setMainTab] = useState<'control'|'scenarios'|'settings'>('control');
  const [cat,     setCat]     = useState('covers');
  const [device,  setDevice]  = useState<Device>(devices[0]);
  const [covers,  setCovers]  = useState<CoverState[]>(()=>
    Array.from({length:Math.max(device.status?.remote_count??0,2)},(_,i)=>
      ({id:i,name:`Motor ${i+1}`,pos:0,moving:false,dir:'stop',paired:true})));
  const [sheet,    setSheet]    = useState<CoverState|null>(null);
  const [localPos, setLocalPos] = useState(0);
  const [sending,  setSending]  = useState<string|null>(null);
  const [toast,    setToast]    = useState<{msg:string;ok:boolean}|null>(null);
  const [time,     setTime]     = useState(new Date());
  const [activeScene, setActiveScene] = useState<number|null>(2);

  const supabase = createClient();

  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(t);},[]);
  useEffect(()=>{if(sheet)setLocalPos(sheet.pos);},[sheet?.id]);

  const sendCmd = useCallback(async(action:string,target:number=0)=>{
    setSending(action+target);
    const {error} = await supabase.from('commands').insert({device_id:device.device_id,action,target,status:'pending'});
    if(error){ setToast({msg:'Komut gönderilemedi',ok:false}); }
    else {
      setToast({msg:'◈ Komut gönderildi (~1-3s)',ok:true});
      setCovers(p=>p.map(c=>c.id!==target?c:{...c,moving:action!=='rts_my',dir:action==='rts_up'?'up':action==='rts_down'?'down':'stop'}));
      if(sheet?.id===target) setSheet(p=>p?{...p,moving:action!=='rts_my',dir:action==='rts_up'?'up':action==='rts_down'?'down':'stop'}:null);
    }
    setSending(null);
    setTimeout(()=>setToast(null),3000);
  },[device.device_id,sheet,supabase]);

  // Realtime command ack
  useEffect(()=>{
    const ch=supabase.channel(`cmd-${device.device_id}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'commands',filter:`device_id=eq.${device.device_id}`},
        (p)=>{if(p.new.status==='executed'){setToast({msg:'✓ Komut cihaza ulaştı',ok:true});setTimeout(()=>setToast(null),2000);}})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[device.device_id,supabase]);

  const hh   = time.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
  const dd   = time.toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long'});
  const isOnline = device.last_seen && (Date.now()-new Date(device.last_seen).getTime())<300_000;
  const catCol = CATS.find(c=>c.id===cat)?.col??C.gold;
  const activeSafety = safetyEvents.filter(e=>e.state==='alarm'||e.state==='warning');

  // ── Shared header ─────────────────────────────────────────────
  const Header=()=>(
    <div style={{padding:'16px 20px 12px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <div style={{fontFamily:SF_R,fontSize:48,fontWeight:700,letterSpacing:-2,lineHeight:1,color:'rgba(255,255,255,.95)'}}>{hh}</div>
          <div style={{fontFamily:SF,fontSize:14,fontWeight:400,letterSpacing:-0.1,color:'rgba(255,255,255,.38)',marginTop:3}}>{dd}</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6,marginTop:4}}>
          {devices.length>1&&(
            <select value={device.device_id} onChange={e=>setDevice(devices.find(d=>d.device_id===e.target.value)??devices[0])}
              style={{background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.12)',borderRadius:10,
                padding:'4px 8px',color:'rgba(255,255,255,.8)',fontFamily:SF,fontSize:11,cursor:'pointer',outline:'none'}}>
              {devices.map(d=><option key={d.device_id} value={d.device_id}>{d.name||d.device_id}</option>)}
            </select>
          )}
          <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:20,
            background:isOnline?`${C.green}18`:`${C.red}18`,
            border:`1px solid ${isOnline?C.green+'40':C.red+'40'}`}}>
            <div style={{width:5,height:5,borderRadius:'50%',background:isOnline?C.green:C.red,boxShadow:`0 0 6px ${isOnline?C.green:C.red}`}}/>
            <span style={{fontFamily:SF,fontSize:10,fontWeight:700,letterSpacing:.4,color:isOnline?C.green:C.red}}>
              {device.name||device.device_id} · {isOnline?'ONLİNE':'OFFLİNE'}
            </span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:20,
            background:`${C.blue}18`,border:`1px solid ${C.blue}40`}}>
            <div style={{width:5,height:5,borderRadius:'50%',background:C.blue,boxShadow:`0 0 6px ${C.blue}`}}/>
            <span style={{fontFamily:SF,fontSize:10,fontWeight:700,letterSpacing:.4,color:C.blue}}>◈ BULUT</span>
          </div>
          {activeSafety.length>0&&(
            <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:20,
              background:`${C.red}22`,border:`1px solid ${C.red}55`,animation:'pulseRed 1.5s infinite'}}>
              <div style={{width:5,height:5,borderRadius:'50%',background:C.red,boxShadow:`0 0 8px ${C.red}`}}/>
              <span style={{fontFamily:SF,fontSize:10,fontWeight:700,letterSpacing:.4,color:C.red}}>{activeSafety.length} ALARM</span>
            </div>
          )}
        </div>
      </div>
      {toast&&(
        <div style={{marginTop:10,padding:'9px 14px',borderRadius:12,
          background:toast.ok?`${C.blue}18`:`${C.red}18`,
          border:`1px solid ${toast.ok?C.blue+'40':C.red+'40'}`,
          fontFamily:SF,fontSize:13,fontWeight:500,color:toast.ok?C.blue:C.red}}>
          {toast.msg}
        </div>
      )}
    </div>
  );

  // ── KONTROL screen ─────────────────────────────────────────────
  const ControlScreen=()=>(
    <>
      {/* Category tabs */}
      <div style={{display:'flex',gap:0,overflowX:'auto',padding:'0 16px',marginBottom:18,scrollbarWidth:'none'}}>
        {CATS.map(c=>(
          <button key={c.id} onClick={()=>setCat(c.id)} style={{
            display:'flex',flexDirection:'column',alignItems:'center',gap:4,
            padding:'7px 11px',border:'none',background:'transparent',cursor:'pointer',
            flexShrink:0,position:'relative',WebkitTapHighlightColor:'transparent'}}>
            <div style={{width:44,height:44,borderRadius:14,
              background:cat===c.id?`${c.col}30`:'rgba(255,255,255,.06)',
              border:`1.5px solid ${cat===c.id?c.col+'66':'rgba(255,255,255,.08)'}`,
              display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,
              boxShadow:cat===c.id?`0 0 20px ${c.col}44`:'none',transition:'all .25s',
              filter:cat===c.id?`drop-shadow(0 0 6px ${c.col}88)`:'none',position:'relative'}}>
              {c.icon}
              {c.premium&&<div style={{position:'absolute',top:-4,right:-4,width:14,height:14,
                borderRadius:'50%',background:C.purple,border:'2px solid #0a0a0c',
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:7,color:'white',fontWeight:800}}>◈</div>}
            </div>
            <span style={{fontFamily:SF,fontSize:10,fontWeight:cat===c.id?700:500,letterSpacing:.2,
              color:cat===c.id?c.col:'rgba(255,255,255,.35)',whiteSpace:'nowrap'}}>{c.label}</span>
            {cat===c.id&&<div style={{position:'absolute',bottom:0,left:'50%',transform:'translateX(-50%)',
              width:20,height:2,borderRadius:1,background:c.col,boxShadow:`0 0 6px ${c.col}`}}/>}
          </button>
        ))}
      </div>

      {/* COVERS */}
      {cat==='covers'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:'0 20px'}}>
          {covers.map(cv=>(
            <button key={cv.id} onClick={()=>setSheet(cv)} style={{
              background:cv.pos>0?`linear-gradient(145deg,${C.gold}20,${C.gold}07)`:'rgba(255,255,255,.05)',
              border:`1px solid ${cv.pos>0?C.gold+'40':'rgba(255,255,255,.08)'}`,
              borderRadius:20,padding:'16px 14px',cursor:'pointer',textAlign:'left',
              position:'relative',overflow:'hidden',
              boxShadow:cv.moving?`0 0 28px ${C.gold}22,0 4px 16px rgba(0,0,0,.4)`:'0 2px 8px rgba(0,0,0,.25)',
              transition:'all .25s',color:'white',WebkitTapHighlightColor:'transparent'}}
              onPointerDown={e=>(e.currentTarget as HTMLButtonElement).style.transform='scale(.95)'}
              onPointerUp={e=>(e.currentTarget as HTMLButtonElement).style.transform='scale(1)'}>
              <div style={{position:'absolute',left:0,bottom:0,width:'100%',height:`${cv.pos}%`,
                background:cv.moving?`linear-gradient(to top,${C.gold}3a,transparent)`:`linear-gradient(to top,${C.gold}1a,transparent)`,
                transition:'height .7s cubic-bezier(.4,0,.2,1)',pointerEvents:'none',borderRadius:'0 0 20px 20px'}}/>
              {cv.moving&&<div style={{position:'absolute',left:0,bottom:`${cv.pos-1}%`,width:'100%',height:1,
                background:`linear-gradient(90deg,transparent,${C.gold}cc,transparent)`,
                animation:'shimmer 1.8s linear infinite',pointerEvents:'none'}}/>}
              <div style={{position:'absolute',top:13,right:13,width:7,height:7,borderRadius:'50%',
                background:cv.moving?C.gold:cv.pos>0?`${C.gold}88`:'rgba(255,255,255,.15)',
                boxShadow:cv.moving?`0 0 10px ${C.gold}`:'none',
                animation:cv.moving?'pulse 1.1s ease-in-out infinite':'none'}}/>
              <div style={{fontSize:22,marginBottom:8,lineHeight:1,position:'relative',
                filter:cv.pos>0?`drop-shadow(0 0 6px ${C.gold}88)`:'none'}}>🪟</div>
              <div style={{fontFamily:SF,fontSize:14,fontWeight:600,letterSpacing:-0.1,
                color:'rgba(255,255,255,.9)',marginBottom:4,position:'relative'}}>{cv.name}</div>
              <div style={{fontFamily:SF_MONO,fontSize:20,fontWeight:700,letterSpacing:-0.8,
                color:cv.moving?C.gold:cv.pos>0?`${C.gold}cc`:'rgba(255,255,255,.3)',
                transition:'color .3s',position:'relative'}}>{cv.pos}%</div>
            </button>
          ))}
        </div>
      )}

      {/* SENSORS */}
      {cat==='sensors'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:'0 20px'}}>
          {([['temp','🌡','Sıcaklık','°C'],['humidity','💧','Nem','%'],['lux','☀️','Işık',' lx'],
             ['gas','⚗️','Gaz',' %'],['water','💧','Su',''],['rain','🌧','Yağmur','']] as [string,string,string,string][])
            .map(([ch,icon,label,unit])=>{
              const val=latestReadings[ch];
              const has=val!==undefined;
              return(
                <div key={ch} style={{background:'rgba(255,255,255,.05)',
                  border:`1px solid ${has?C.blue+'30':'rgba(255,255,255,.07)'}`,borderRadius:20,padding:'18px 16px'}}>
                  <div style={{fontSize:24,marginBottom:10}}>{icon}</div>
                  <div style={{fontFamily:SF_MONO,fontSize:26,fontWeight:700,letterSpacing:-0.8,lineHeight:1,marginBottom:6,
                    color:has?C.blue:'rgba(255,255,255,.3)'}}>
                    {has?val.toFixed(1):'—'}<span style={{fontSize:13,fontWeight:400,opacity:.7}}>{unit}</span>
                  </div>
                  <div style={{fontFamily:SF,fontSize:11,fontWeight:600,letterSpacing:.4,
                    textTransform:'uppercase',color:'rgba(255,255,255,.35)'}}>{label}</div>
                  {!has&&<div style={{fontFamily:SF,fontSize:10,color:'rgba(255,255,255,.2)',marginTop:4}}>Veri bekleniyor</div>}
                </div>
              );
          })}
        </div>
      )}

      {/* SAFETY */}
      {cat==='safety'&&(
        <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:10}}>
          {safetyEvents.length===0?(
            <div style={{background:`${C.green}12`,border:`1px solid ${C.green}30`,borderRadius:20,padding:'32px 20px',textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:12}}>✅</div>
              <div style={{fontFamily:SF,fontSize:16,fontWeight:600,color:C.green}}>Tüm sistemler normal</div>
            </div>
          ):safetyEvents.map(ev=>{
            const alarm=ev.state==='alarm';
            const col=alarm?C.red:ev.state==='warning'?C.orange:C.green;
            const icon = ALARM_TYPE_ICONS[ev.alarm_type] ?? '🚨';
            const name = ev.alarm_type_name ?? ALARM_TYPE_NAMES[ev.alarm_type] ?? `Alarm #${ev.alarm_type}`;
            return(
              <div key={ev.id} style={{background:`${col}12`,border:`1px solid ${col}35`,borderRadius:18,
                padding:'14px 16px',display:'flex',alignItems:'center',gap:12,
                animation:alarm?'pulseRed 1.5s infinite':'none'}}>
                <div style={{fontSize:24}}>{icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:SF,fontSize:15,fontWeight:600,color:col,marginBottom:2}}>{name}</div>
                  <div style={{fontFamily:SF,fontSize:12,color:'rgba(255,255,255,.45)'}}>
                    {new Date(ev.ts).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}
                    {ev.value!=null?` · ${ev.value.toFixed(2)}`:''}
                  </div>
                </div>
                <div style={{fontFamily:SF,fontSize:10,fontWeight:700,letterSpacing:.4,color:col}}>
                  {ev.state.toUpperCase()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CLIMATE */}
      {cat==='climate'&&(
        <div style={{padding:'0 20px'}}>
          <div style={{background:'rgba(255,255,255,.04)',border:`1px solid ${C.teal}30`,borderRadius:20,padding:24,textAlign:'center'}}>
            <div style={{fontSize:36,marginBottom:12}}>🌡</div>
            <div style={{fontFamily:SF_MONO,fontSize:42,fontWeight:700,color:C.teal,letterSpacing:-1.5,lineHeight:1}}>
              {latestReadings.temp!=null?latestReadings.temp.toFixed(1):'--'}
              <span style={{fontFamily:SF,fontSize:18,fontWeight:400,opacity:.6}}>°C</span>
            </div>
            <div style={{fontFamily:SF,fontSize:13,color:'rgba(255,255,255,.4)',marginTop:6}}>
              Nem: {latestReadings.humidity!=null?latestReadings.humidity.toFixed(0)+'%':'—'}
            </div>
            <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:20,flexWrap:'wrap'}}>
              {['Konfor','Eko','Boost','Uzakta','Kapalı'].map(m=>(
                <button key={m} onClick={()=>sendCmd('climate_mode',0)} style={{
                  padding:'8px 16px',borderRadius:12,border:`1px solid ${C.teal}40`,
                  background:`${C.teal}15`,color:C.teal,cursor:'pointer',
                  fontFamily:SF,fontSize:13,fontWeight:600,WebkitTapHighlightColor:'transparent'}}>{m}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AUTOMATION */}
      {cat==='auto'&&(
        <div style={{padding:'0 20px'}}>
          <div style={{background:`${C.green}10`,border:`1px solid ${C.green}30`,borderRadius:14,
            padding:'11px 14px',marginBottom:14,fontFamily:SF,fontSize:12,fontWeight:500,color:`${C.green}cc`}}>
            ◈ Kural yönetimi Supabase üzerinde.{' '}
            <a href="/rules" style={{color:C.green,fontWeight:700}}>Kural Yöneticisi →</a>
          </div>
          {RULES_MOCK.map((r,i)=>(
            <div key={i} style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.08)',
              borderRadius:16,padding:'13px 16px',display:'flex',alignItems:'center',
              gap:12,marginBottom:8,opacity:r.on?1:.5}}>
              <div style={{width:38,height:38,borderRadius:11,flexShrink:0,
                background:`${r.col}20`,border:`1px solid ${r.col}30`,
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{r.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:SF,fontSize:14,fontWeight:600,color:'rgba(255,255,255,.88)',marginBottom:2}}>{r.name}</div>
                <div style={{fontFamily:SF,fontSize:12,color:'rgba(255,255,255,.38)'}}>{r.desc}</div>
              </div>
              <span style={{fontFamily:SF,fontSize:10,fontWeight:700,letterSpacing:.4,
                color:r.on?C.green:'rgba(255,255,255,.25)'}}>{r.on?'AKTİF':'PASİF'}</span>
            </div>
          ))}
        </div>
      )}

      {/* HISTORY premium */}
      {cat==='history'&&(
        <div style={{padding:'0 20px'}}>
          <div style={{background:`${C.purple}12`,border:`1px solid ${C.purple}35`,borderRadius:20,padding:20,marginBottom:14,
            display:'flex',alignItems:'center',gap:12}}>
            <div style={{fontSize:28}}>◈</div>
            <div>
              <div style={{fontFamily:SF,fontSize:16,fontWeight:700,color:C.purple,marginBottom:4}}>Premium Bulut Özelliği</div>
              <div style={{fontFamily:SF,fontSize:12,color:'rgba(255,255,255,.5)'}}>
                Sensör geçmişi ve motor aktivite log'u sadece cloud'da saklanır.
              </div>
            </div>
          </div>
          <div style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)',borderRadius:20,padding:20}}>
            <div style={{fontFamily:SF,fontSize:11,fontWeight:600,letterSpacing:.4,
              textTransform:'uppercase',color:'rgba(255,255,255,.3)',marginBottom:14}}>SON 24 SAAT — SICAKLIK</div>
            <svg width="100%" height={80} viewBox="0 0 300 80" style={{overflow:'visible'}}>
              <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.blue} stopOpacity=".4"/>
                <stop offset="100%" stopColor={C.blue} stopOpacity="0"/>
              </linearGradient></defs>
              <path d="M0,60 C50,55 100,40 150,42 C200,44 250,30 300,35" fill="none" stroke={C.blue} strokeWidth={2} strokeLinecap="round"/>
              <path d="M0,60 C50,55 100,40 150,42 C200,44 250,30 300,35 L300,80 L0,80 Z" fill="url(#g1)"/>
            </svg>
            <a href={`/devices/${devices[0]?.id}/sensors`} style={{display:'inline-block',marginTop:12,padding:'9px 16px',
              borderRadius:12,background:`${C.purple}22`,border:`1px solid ${C.purple}40`,
              color:C.purple,fontFamily:SF,fontSize:13,fontWeight:600,textDecoration:'none'}}>
              Detaylı Sensor Geçmişi →</a>
          </div>
        </div>
      )}
    </>
  );

  // ── SENARYOLAR screen ──────────────────────────────────────────
  const ScenariosScreen=()=>(
    <>
      {/* Scenes */}
      <div style={{padding:'0 20px',marginBottom:10}}>
        <span style={{fontFamily:SF,fontSize:11,fontWeight:600,letterSpacing:.4,
          textTransform:'uppercase',color:'rgba(255,255,255,.28)'}}>HIZLI SAHNELER</span>
      </div>
      <div style={{display:'flex',gap:12,overflowX:'auto',padding:'0 20px',marginBottom:24,scrollbarWidth:'none',WebkitOverflowScrolling:'touch'}}>
        {SCENE_CARDS.map(sc=>(
          <button key={sc.id} onClick={()=>setActiveScene(sc.id===activeScene?null:sc.id)} style={{
            flexShrink:0,width:190,height:112,borderRadius:20,position:'relative',overflow:'hidden',
            cursor:'pointer',
            border:`1px solid ${sc.active||activeScene===sc.id?'rgba(129,140,248,.5)':'rgba(255,255,255,.1)'}`,
            boxShadow:sc.active||activeScene===sc.id?`0 0 24px rgba(129,140,248,.2)`:'none',
            WebkitTapHighlightColor:'transparent',transition:'all .2s'}}
            onPointerDown={e=>(e.currentTarget as HTMLButtonElement).style.transform='scale(.96)'}
            onPointerUp={e=>(e.currentTarget as HTMLButtonElement).style.transform='scale(1)'}>
            <div style={{position:'absolute',inset:0,background:sc.grad}}/>
            <div style={{position:'absolute',inset:0,background:`radial-gradient(ellipse at 65% 35%,${sc.glow},transparent 60%)`}}/>
            <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,transparent 25%,rgba(0,0,0,.7) 100%)'}}/>
            {(sc.active||activeScene===sc.id)&&(
              <div style={{position:'absolute',top:9,left:11,background:'rgba(129,140,248,.9)',borderRadius:7,
                padding:'2px 7px',fontFamily:SF,fontSize:9,fontWeight:700,letterSpacing:.4,color:'white'}}>AKTİF</div>
            )}
            <span style={{position:'absolute',top:10,right:13,fontSize:24,opacity:.85}}>{sc.icon}</span>
            <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'9px 13px'}}>
              <div style={{fontFamily:SF,fontSize:14,fontWeight:700,letterSpacing:-0.1,
                color:(sc.active||activeScene===sc.id)?'rgb(199,194,255)':'rgba(255,255,255,.95)',marginBottom:2}}>{sc.name}</div>
              <div style={{fontFamily:SF,fontSize:11,fontWeight:400,color:'rgba(255,255,255,.5)'}}>{sc.devices}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Groups */}
      <div style={{padding:'0 20px',marginBottom:10}}>
        <span style={{fontFamily:SF,fontSize:11,fontWeight:600,letterSpacing:.4,
          textTransform:'uppercase',color:'rgba(255,255,255,.28)'}}>ÖZEL GRUPLAR</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:'0 20px',marginBottom:24}}>
        {GROUPS.map(g=>(
          <button key={g.id} style={{
            background:g.activeN>0?`linear-gradient(145deg,${g.col}20,${g.col}06)`:'rgba(255,255,255,.04)',
            border:`1px solid ${g.activeN>0?g.col+'38':'rgba(255,255,255,.08)'}`,
            borderRadius:20,padding:'15px 14px',cursor:'pointer',textAlign:'left',
            position:'relative',WebkitTapHighlightColor:'transparent',transition:'all .2s',color:'white'}}
            onPointerDown={e=>(e.currentTarget as HTMLButtonElement).style.transform='scale(.95)'}
            onPointerUp={e=>(e.currentTarget as HTMLButtonElement).style.transform='scale(1)'}>
            <div style={{position:'absolute',top:10,right:10,
              background:g.activeN>0?'rgba(52,199,89,.2)':'rgba(255,255,255,.07)',
              border:`1px solid ${g.activeN>0?'rgba(52,199,89,.4)':'rgba(255,255,255,.12)'}`,
              borderRadius:7,padding:'2px 7px',fontFamily:SF,fontSize:9,fontWeight:700,letterSpacing:.3,
              color:g.activeN>0?C.green:'rgba(255,255,255,.4)'}}>
              {g.activeN>0?`${g.activeN} AKTİF`:'PASİF'}
            </div>
            <div style={{fontSize:22,marginBottom:8,lineHeight:1}}>{g.icon}</div>
            <div style={{fontFamily:SF,fontSize:14,fontWeight:700,letterSpacing:-0.1,color:'rgba(255,255,255,.9)',marginBottom:4}}>{g.name}</div>
            <div style={{fontFamily:SF,fontSize:11,color:'rgba(255,255,255,.38)',lineHeight:1.5}}>{g.devices}</div>
          </button>
        ))}
      </div>

      {/* Rules */}
      <div style={{padding:'0 20px',marginBottom:10}}>
        <span style={{fontFamily:SF,fontSize:11,fontWeight:600,letterSpacing:.4,
          textTransform:'uppercase',color:'rgba(255,255,255,.28)'}}>AKTİF KURALLAR</span>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8,padding:'0 20px',marginBottom:24}}>
        {RULES_MOCK.map((r,i)=>(
          <div key={i} style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',
            borderRadius:16,padding:'12px 16px',display:'flex',alignItems:'center',gap:12,opacity:r.on?1:.5}}>
            <div style={{width:36,height:36,borderRadius:10,flexShrink:0,
              background:`${r.col}20`,border:`1px solid ${r.col}30`,
              display:'flex',alignItems:'center',justifyContent:'center',fontSize:17}}>{r.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:SF,fontSize:14,fontWeight:600,color:'rgba(255,255,255,.85)',marginBottom:2,
                whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.name}</div>
              <div style={{fontFamily:SF,fontSize:11,color:'rgba(255,255,255,.38)'}}>{r.desc}</div>
            </div>
            <span style={{fontFamily:SF,fontSize:10,fontWeight:700,letterSpacing:.4,flexShrink:0,
              color:r.on?C.green:'rgba(255,255,255,.25)'}}>{r.on?'AKTİF':'PASİF'}</span>
          </div>
        ))}
      </div>

      {/* Schedules */}
      <div style={{padding:'0 20px',marginBottom:10}}>
        <span style={{fontFamily:SF,fontSize:11,fontWeight:600,letterSpacing:.4,
          textTransform:'uppercase',color:'rgba(255,255,255,.28)'}}>ZAMANLAMALAR</span>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8,padding:'0 20px',marginBottom:24}}>
        {SCHEDULES_MOCK.map(s=>(
          <div key={s.id} style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',
            borderRadius:16,padding:'12px 16px',display:'flex',alignItems:'center',gap:12,opacity:s.disabled?.5:1}}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',minWidth:54,flexShrink:0}}>
              <div style={{fontFamily:SF_MONO,fontSize:19,fontWeight:700,letterSpacing:-0.5,lineHeight:1,
                color:s.disabled?'rgba(255,255,255,.4)':s.col}}>{s.time}</div>
              <div style={{fontFamily:SF,fontSize:8,fontWeight:600,letterSpacing:.3,textTransform:'uppercase',
                color:'rgba(255,255,255,.28)',marginTop:2}}>{s.period}</div>
            </div>
            <div style={{width:1,height:32,background:'rgba(255,255,255,.1)',flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:SF,fontSize:14,fontWeight:600,
                color:s.disabled?'rgba(255,255,255,.5)':'rgba(255,255,255,.85)',marginBottom:2}}>{s.name}</div>
              <div style={{fontFamily:SF,fontSize:11,color:'rgba(255,255,255,.35)',
                whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.action}</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2,flexShrink:0}}>
              <div style={{fontFamily:SF,fontSize:11,fontWeight:600,
                color:s.disabled?'rgba(255,255,255,.25)':s.col}}>{s.next}</div>
              {s.freq&&<div style={{fontFamily:SF,fontSize:9,color:'rgba(255,255,255,.28)'}}>{s.freq}</div>}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  // ── AYARLAR screen ─────────────────────────────────────────────
  const SettingsScreen=()=>(
    <div style={{padding:'0 20px'}}>
      {/* Device info */}
      <div style={{fontFamily:SF,fontSize:11,fontWeight:600,letterSpacing:.4,
        textTransform:'uppercase',color:'rgba(255,255,255,.28)',marginBottom:10}}>CİHAZ BİLGİSİ</div>
      <div style={{borderRadius:20,overflow:'hidden',border:'1px solid rgba(255,255,255,.08)',marginBottom:24}}>
        {[['Cihaz ID',device.device_id],['Model',device.model||'Luxa Core'],
          ['Firmware',device.firmware||'—'],['IP Adresi',device.ip_address||'—'],
          ['Son Görülme',device.last_seen?new Date(device.last_seen).toLocaleString('tr-TR',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'}):'—'],
          ['WiFi RSSI',device.status?.wifi_rssi!=null?`${device.status.wifi_rssi} dBm`:'—'],
          ['Heap',device.status?.heap_free!=null?`${Math.round(device.status.heap_free/1024)} KB`:'—'],
          ['Uptime',device.status?.uptime!=null?`${Math.floor(device.status.uptime/3600)}h ${Math.floor((device.status.uptime%3600)/60)}m`:'—'],
        ].map(([k,v],i,a)=>(
          <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
            padding:'12px 16px',background:'rgba(255,255,255,.04)',
            borderBottom:i<a.length-1?'1px solid rgba(255,255,255,.06)':'none'}}>
            <span style={{fontFamily:SF,fontSize:14,fontWeight:400,color:'rgba(255,255,255,.5)'}}>{k}</span>
            <span style={{fontFamily:SF_MONO,fontSize:12,fontWeight:600,color:'rgba(255,255,255,.8)',letterSpacing:-0.2}}>{v}</span>
          </div>
        ))}
      </div>

      {/* Cloud links */}
      <div style={{fontFamily:SF,fontSize:11,fontWeight:600,letterSpacing:.4,
        textTransform:'uppercase',color:'rgba(255,255,255,.28)',marginBottom:10}}>HIZLI ERİŞİM</div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {[
          {href:'/dashboard',      icon:'📊', label:'Kontrol Paneli',    desc:'Genel bakış ve cihaz listesi'},
          {href:'/alerts',         icon:'🔔', label:'Alarmlar',          desc:'Güvenlik ve sensör alarmları'},
          {href:'/rules',          icon:'⚡', label:'Kural Yöneticisi',  desc:'Otomasyon kuralları (cloud)'},
          {href:'/firmware',       icon:'📦', label:'Firmware Güncelle', desc:'OTA kablosuz güncelleme'},
          {href:'/profile',        icon:'👤', label:'Profil & Ayarlar',  desc:'Hesap ve dil tercihleri'},
        ].map(l=>(
          <a key={l.href} href={l.href} style={{
            background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',
            borderRadius:16,padding:'12px 16px',textDecoration:'none',
            display:'flex',alignItems:'center',gap:12,transition:'background .2s'}}
            onMouseEnter={e=>(e.currentTarget as HTMLAnchorElement).style.background='rgba(255,255,255,.08)'}
            onMouseLeave={e=>(e.currentTarget as HTMLAnchorElement).style.background='rgba(255,255,255,.04)'}>
            <span style={{fontSize:22,flexShrink:0}}>{l.icon}</span>
            <div style={{flex:1}}>
              <div style={{fontFamily:SF,fontSize:14,fontWeight:600,color:'rgba(255,255,255,.88)',marginBottom:2}}>{l.label}</div>
              <div style={{fontFamily:SF,fontSize:12,color:'rgba(255,255,255,.38)'}}>{l.desc}</div>
            </div>
            <span style={{color:'rgba(255,255,255,.25)',fontSize:16}}>›</span>
          </a>
        ))}
      </div>
    </div>
  );

  // ── Bottom Sheet ───────────────────────────────────────────────
  const BottomSheet=()=>{
    if(!sheet)return null;
    return(
      <>
        <div onClick={()=>setSheet(null)} style={{position:'fixed',inset:0,zIndex:100,
          background:'rgba(0,0,0,.55)',backdropFilter:'blur(6px)',WebkitBackdropFilter:'blur(6px)'}}/>
        <div style={{position:'fixed',left:0,right:0,bottom:0,zIndex:101,background:'#111114',
          borderRadius:'28px 28px 0 0',border:'1px solid rgba(255,255,255,.1)',borderBottom:'none',
          boxShadow:'0 -24px 64px rgba(0,0,0,.65)',
          paddingBottom:'env(safe-area-inset-bottom,24px)',
          animation:'slideUp .35s cubic-bezier(.32,0,.67,0) forwards',maxHeight:'88dvh',overflowY:'auto'}}>
          <div style={{display:'flex',justifyContent:'center',padding:'12px 0 8px'}}>
            <div style={{width:36,height:4,borderRadius:2,background:'rgba(255,255,255,.2)'}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'4px 24px 0',marginBottom:6}}>
            <div>
              <div style={{fontFamily:SF,fontSize:22,fontWeight:700,letterSpacing:-0.4,color:'rgba(255,255,255,.95)'}}>{sheet.name}</div>
              <div style={{fontFamily:SF,fontSize:13,color:'rgba(255,255,255,.38)',marginTop:3}}>
                {device.name||device.device_id} · {sheet.paired?'RTS Eşleştirildi':'Röle'}
              </div>
            </div>
            <button onClick={()=>setSheet(null)} style={{width:32,height:32,borderRadius:16,background:'rgba(255,255,255,.1)',
              border:'none',color:'rgba(255,255,255,.6)',cursor:'pointer',fontSize:14,
              display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,WebkitTapHighlightColor:'transparent'}}>✕</button>
          </div>
          <div style={{margin:'6px 24px 0',background:'rgba(14,165,233,.1)',border:'1px solid rgba(14,165,233,.25)',
            borderRadius:12,padding:'7px 12px'}}>
            <span style={{fontFamily:SF,fontSize:12,fontWeight:500,color:'rgba(14,165,233,.85)'}}>
              ◈ Bulut üzerinden · Komut cihaza ~1-3 saniyede ulaşır
            </span>
          </div>
          <div style={{display:'flex',justifyContent:'center',padding:'8px 0 0',marginBottom:-8}}>
            <svg width={160} height={136} viewBox="0 0 160 136" style={{overflow:'visible'}}>
              <path d={arcPath(80,90,64,-210,30)} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={5} strokeLinecap="round"/>
              {localPos>0&&<path d={arcPath(80,90,64,-210,-210+(localPos/100)*240)} fill="none"
                stroke={sheet.moving?C.gold:'rgba(201,150,59,.75)'} strokeWidth={5} strokeLinecap="round"
                style={{filter:sheet.moving?`drop-shadow(0 0 5px ${C.gold})`:'none'}}/>}
              <text x={80} y={84} textAnchor="middle" fontFamily={SF_R} fontSize={36} fontWeight={700} letterSpacing={-1.5}
                fill={sheet.moving?C.gold:'rgba(255,255,255,.88)'}>{localPos}</text>
              <text x={80} y={104} textAnchor="middle" fontFamily={SF} fontSize={11} fontWeight={600} letterSpacing={.4}
                fill="rgba(255,255,255,.28)">YÜZDE</text>
            </svg>
          </div>
          <div style={{padding:'0 28px 8px'}}>
            <input type="range" min={0} max={100} value={localPos}
              onChange={e=>{setLocalPos(+e.target.value);setSheet(p=>p?{...p,pos:+e.target.value}:null);}}
              style={{width:'100%',height:32,appearance:'none',WebkitAppearance:'none',background:'transparent',cursor:'pointer',outline:'none',border:'none'}}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,padding:'0 24px 20px'}}>
            {([[`↑`,'AÇ','rts_up',C.gold],[`■`,'DUR','rts_my','rgba(255,255,255,.45)'],[`↓`,'KAPAT','rts_down',C.blue]] as [string,string,string,string][])
              .map(([ic,label,cmd,col])=>(
              <button key={cmd} onClick={()=>sendCmd(cmd,sheet.id)} disabled={sending===cmd+sheet.id}
                style={{height:64,borderRadius:16,border:'none',background:`${col}1a`,color:col,cursor:'pointer',
                  display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,
                  fontFamily:SF,transition:'background .15s',WebkitTapHighlightColor:'transparent',
                  opacity:sending===cmd+sheet.id?.5:1}}
                onPointerDown={e=>(e.currentTarget as HTMLButtonElement).style.background=`${col}33`}
                onPointerUp={e=>(e.currentTarget as HTMLButtonElement).style.background=`${col}1a`}>
                <span style={{fontSize:22,lineHeight:1}}>{ic}</span>
                <span style={{fontSize:10,fontWeight:700,letterSpacing:.5}}>{label}</span>
              </button>
            ))}
          </div>
          <div style={{margin:'0 24px 8px',background:'rgba(255,255,255,.04)',borderRadius:14,padding:'12px 16px',
            display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            {[['Durum',sheet.moving?'Hareket':sheet.pos===0?'Kapalı':sheet.pos===100?'Açık':'Kısmi'],
              ['Pozisyon',`${localPos}%`],
              ['Protokol',sheet.paired?'Somfy RTS':'Röle']].map(([k,v])=>(
              <div key={k} style={{textAlign:'center'}}>
                <div style={{fontFamily:SF_MONO,fontSize:14,fontWeight:700,letterSpacing:-0.3,
                  color:'rgba(255,255,255,.82)',marginBottom:3}}>{v}</div>
                <div style={{fontFamily:SF,fontSize:10,fontWeight:600,letterSpacing:.4,
                  textTransform:'uppercase',color:'rgba(255,255,255,.3)'}}>{k}</div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  };

  // ── Render ─────────────────────────────────────────────────────
  return(
    <div style={{minHeight:'100dvh',background:C.bg,overflowX:'hidden',fontFamily:SF}}>

      {/* Ambient */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0}}>
        <div style={{position:'absolute',top:-150,left:-100,width:500,height:500,
          background:mainTab==='scenarios'?`radial-gradient(ellipse,${C.green}0d 0%,transparent 65%)`
            :mainTab==='settings'?`radial-gradient(ellipse,rgba(255,255,255,.04) 0%,transparent 65%)`
            :`radial-gradient(ellipse,${catCol}0d 0%,transparent 65%)`,
          transition:'background .6s'}}/>
        <div style={{position:'absolute',bottom:80,right:-60,width:380,height:380,
          background:`radial-gradient(ellipse,${C.blue}0b 0%,transparent 65%)`}}/>
      </div>

      <div style={{position:'relative',zIndex:1,paddingBottom:82}}>
        <div style={{height:'env(safe-area-inset-top,12px)'}}/>
        <Header/>

        {mainTab==='control'   && <ControlScreen/>}
        {mainTab==='scenarios' && <ScenariosScreen/>}
        {mainTab==='settings'  && <SettingsScreen/>}
      </div>

      <BottomSheet/>

      {/* ── Bottom tab bar — 3 tabs ── */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:50,
        background:'rgba(14,14,18,.94)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',
        borderTop:'1px solid rgba(255,255,255,.08)',display:'flex',
        paddingBottom:'env(safe-area-inset-bottom,4px)'}}>
        {([
          {id:'control'   as const, icon:'⬡', label:'Kontrol',    col:catCol},
          {id:'scenarios' as const, icon:'✦', label:'Senaryolar', col:C.green},
          {id:'settings'  as const, icon:'⊙', label:'Ayarlar',    col:'rgba(255,255,255,.6)'},
        ]).map(tb=>(
          <button key={tb.id} onClick={()=>setMainTab(tb.id)} style={{
            flex:1,padding:'10px 0 8px',border:'none',background:'transparent',cursor:'pointer',
            display:'flex',flexDirection:'column',alignItems:'center',gap:3,
            WebkitTapHighlightColor:'transparent'}}>
            <span style={{fontSize:22,lineHeight:1,
              color:mainTab===tb.id?tb.col:'rgba(255,255,255,.3)',
              filter:mainTab===tb.id?`drop-shadow(0 0 7px ${tb.col}99)`:'none',
              transition:'color .2s,filter .2s'}}>{tb.icon}</span>
            <span style={{fontFamily:SF,fontSize:10,fontWeight:mainTab===tb.id?600:400,letterSpacing:.2,
              color:mainTab===tb.id?tb.col:'rgba(255,255,255,.3)',transition:'color .2s'}}>{tb.label}</span>
          </button>
        ))}
      </div>

      <style>{`
        *{box-sizing:border-box;-webkit-font-smoothing:antialiased;}
        ::-webkit-scrollbar{display:none;}
        input[type="range"]{-webkit-appearance:none;appearance:none;outline:none;}
        input[type="range"]::-webkit-slider-runnable-track{height:3px;background:rgba(255,255,255,.12);border-radius:2px;}
        input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;border-radius:50%;
          background:${C.gold};box-shadow:0 0 14px ${C.gold}aa;margin-top:-11.5px;transition:transform .15s;}
        input[type="range"]:active::-webkit-slider-thumb{transform:scale(1.28);}
        @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.78)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes pulseRed{0%,100%{box-shadow:0 0 0 rgba(255,59,48,0)}50%{box-shadow:0 0 20px rgba(255,59,48,.4)}}
      `}</style>
    </div>
  );
}
