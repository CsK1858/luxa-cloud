'use client';
// components/control/control-panel.tsx
// 
// Tek ekran — kontrol + yapılandırma + senaryo yönetimi.
// Motor ekleme, düzenleme, silme; senaryo oluşturma, adım ekleme, çalıştırma.
// Protokol adı: "RF" (433 MHz) veya "Röle" — marka adı yok.
//
// Veri katmanı: Supabase (motors, scenarios, scenario_steps, commands tabloları)
// Komutlar: commands.insert() → ESP32 polling ile 1-3s içinde çalışır.

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase-client';
import type { Device, SafetyEvent, SensorReading } from '@/lib/types';

// ─── Tasarım sistemi ─────────────────────────────────────────────
const SF      = `-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",sans-serif`;
const SF_R    = `"SF Pro Rounded",-apple-system,BlinkMacSystemFont,sans-serif`;
const SF_MONO = `"SF Mono","Menlo","Monaco","Consolas",monospace`;

const C = {
  gold:'#c9963b', blue:'#0ea5e9', green:'#34c759', red:'#ff3b30',
  purple:'#bf5af2', orange:'#ff9f0a', teal:'#5ac8fa',
  bg:'#0a0a0c', card:'rgba(255,255,255,.055)', border:'rgba(255,255,255,.09)',
};

// ─── Yerel tipler ────────────────────────────────────────────────
interface Motor {
  id: string;
  device_id: string;
  slot_id: number;
  name: string;
  room: string;
  protocol: 'rf' | 'relay'; // rf = 433 MHz, relay = doğrudan röle
  icon: string;
  current_pos: number;
}
interface Scenario {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  steps?: ScenarioStep[];
}
interface ScenarioStep {
  id?: string;
  motor_id: string;
  action: 'open' | 'close' | 'stop' | 'position';
  target_pos: number | null;
  step_order: number;
}

// ─── Props ───────────────────────────────────────────────────────
interface Props {
  devices:       Device[];
  latestReadings: Record<string, number>;
  safetyEvents:  SafetyEvent[];
}

// ─── Kategori tanımları ──────────────────────────────────────────
const CATS = [
  { id:'covers',    icon:'🪟', label:'Perdeler',   col:C.gold   },
  { id:'scenarios', icon:'✦',  label:'Sahneler',   col:C.green  },
  { id:'sensors',   icon:'📊', label:'Sensörler',  col:C.blue   },
  { id:'safety',    icon:'🛡', label:'Güvenlik',   col:C.red    },
  { id:'settings',  icon:'⚙️', label:'Ayarlar',    col:'rgba(255,255,255,.6)' },
];

// ─── SVG arc yardımcısı ──────────────────────────────────────────
function arcPath(cx:number,cy:number,r:number,s:number,e:number) {
  const rad=(d:number)=>d*Math.PI/180;
  const sx=cx+r*Math.cos(rad(s)), sy=cy+r*Math.sin(rad(s));
  const ex=cx+r*Math.cos(rad(e)), ey=cy+r*Math.sin(rad(e));
  return `M${sx} ${sy} A${r} ${r} 0 ${(e-s)>180?1:0} 1 ${ex} ${ey}`;
}

// ─── Küçük yardımcılar ───────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily:SF, fontSize:11, fontWeight:600, letterSpacing:.4,
      textTransform:'uppercase', color:'rgba(255,255,255,.28)',
      padding:'0 20px', marginBottom:10 }}>{children}</div>
  );
}
function Card({ children, style }: { children:React.ReactNode; style?:React.CSSProperties }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`,
      borderRadius:20, padding:'16px', ...style }}>{children}</div>
  );
}
function PrimaryBtn({ children, onClick, disabled, col=C.gold }:
  { children:React.ReactNode; onClick:()=>void; disabled?:boolean; col?:string }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width:'100%', height:52, borderRadius:14, border:'none',
      background:`linear-gradient(135deg,${col}dd,${col}99)`,
      color:'#0a0a0c', cursor:disabled?'not-allowed':'pointer',
      fontFamily:SF, fontSize:15, fontWeight:700, letterSpacing:-0.1,
      opacity:disabled?.5:1, transition:'opacity .2s',
      WebkitTapHighlightColor:'transparent',
    }}>{children}</button>
  );
}
function GhostBtn({ children, onClick, col='rgba(255,255,255,.5)' }:
  { children:React.ReactNode; onClick:()=>void; col?:string }) {
  return (
    <button onClick={onClick} style={{
      flex:1, height:44, borderRadius:12, border:`1px solid ${col}40`,
      background:`${col}12`, color:col, cursor:'pointer',
      fontFamily:SF, fontSize:13, fontWeight:600,
      WebkitTapHighlightColor:'transparent', transition:'background .15s',
    }}>{children}</button>
  );
}

// ─── Ana Bileşen ─────────────────────────────────────────────────
export function ControlPanel({ devices, latestReadings, safetyEvents }: Props) {
  const sb = createClient();

  // ── Durum ──────────────────────────────────────────────────────
  const [device, setDevice]       = useState<Device>(devices[0]);
  const [motors, setMotors]       = useState<Motor[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [cat, setCat]             = useState('covers');
  const [time, setTime]           = useState(new Date());

  // Control sheet
  const [ctrlMotor, setCtrlMotor]   = useState<Motor|null>(null);
  const [ctrlPos,   setCtrlPos]     = useState(0);
  const [sending,   setSending]     = useState<string|null>(null);
  const [toast,     setToast]       = useState<{msg:string;ok:boolean}|null>(null);

  // Motor edit/add sheet
  const [editMotor, setEditMotor]   = useState<Partial<Motor>|null>(null);
  const [savingMotor, setSavingMotor] = useState(false);

  // Scenario edit/add sheet
  const [editScenario, setEditScenario] = useState<(Partial<Scenario> & {steps:ScenarioStep[]})|null>(null);
  const [savingScene,  setSavingScene]   = useState(false);

  // ── Saat ──────────────────────────────────────────────────────
  useEffect(()=>{
    const t=setInterval(()=>setTime(new Date()),1000);
    return()=>clearInterval(t);
  },[]);

  // ── Veri yükle ────────────────────────────────────────────────
  const loadMotors = useCallback(async () => {
    const { data } = await sb.from('motors')
      .select('*').eq('device_id', device.device_id).order('slot_id');
    if (data) setMotors(data as Motor[]);
  }, [device.device_id, sb]);

  const loadScenarios = useCallback(async () => {
    const { data:scens } = await sb.from('scenarios')
      .select('*, scenario_steps(*)').order('sort_order');
    if (scens) {
      setScenarios(scens.map((s:any) => ({
        ...s, steps: s.scenario_steps || [],
      })));
    }
  }, [sb]);

  useEffect(()=>{ loadMotors(); loadScenarios(); },[loadMotors, loadScenarios]);

  // Realtime komut güncellemesi
  useEffect(()=>{
    const ch = sb.channel(`cmd-${device.device_id}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'commands',
        filter:`device_id=eq.${device.device_id}`},(p)=>{
          if(p.new.status==='executed'){
            setToast({msg:'✓ Komut cihaza ulaştı',ok:true});
            setTimeout(()=>setToast(null),2000);
          }
      }).subscribe();
    return()=>{ sb.removeChannel(ch); };
  },[device.device_id, sb]);

  // ── Komut gönder ──────────────────────────────────────────────
  const sendCmd = useCallback(async (action:string, target:number=0) => {
    setSending(action);
    const { error } = await sb.from('commands').insert({
      device_id: device.device_id, action, target, status:'pending',
    });
    if (error) setToast({msg:'Komut gönderilemedi',ok:false});
    else       setToast({msg:'◈ Komut gönderildi (~1-3s)',ok:true});
    setSending(null);
    setTimeout(()=>setToast(null),3000);
  },[device.device_id, sb]);

  // ── Motor CRUD ────────────────────────────────────────────────
  const openAddMotor = () => setEditMotor({
    device_id: device.device_id, slot_id: motors.length,
    name:'', room:'Teras', protocol:'rf', icon:'🪟', current_pos:0,
  });

  const openEditMotor = (m:Motor) => setEditMotor({ ...m });

  const saveMotor = async () => {
    if (!editMotor?.name?.trim()) return;
    setSavingMotor(true);
    if (editMotor.id) {
      await sb.from('motors').update({
        name: editMotor.name, room: editMotor.room,
        protocol: editMotor.protocol, icon: editMotor.icon,
      }).eq('id', editMotor.id);
    } else {
      await sb.from('motors').insert({
        device_id: editMotor.device_id, slot_id: editMotor.slot_id,
        name: editMotor.name, room: editMotor.room,
        protocol: editMotor.protocol || 'rf',
        icon: editMotor.icon || '🪟', current_pos: 0,
        user_id: (await sb.auth.getUser()).data.user?.id,
      });
    }
    setSavingMotor(false);
    setEditMotor(null);
    loadMotors();
  };

  const deleteMotor = async (id:string) => {
    await sb.from('motors').delete().eq('id', id);
    setEditMotor(null);
    loadMotors();
  };

  // ── Senaryo CRUD ─────────────────────────────────────────────
  const openAddScenario = () => setEditScenario({
    name:'', icon:'🌅', color:C.gold, sort_order: scenarios.length, steps:[],
  });

  const openEditScenario = (s:Scenario) => setEditScenario({
    ...s, steps: s.steps ? [...s.steps] : [],
  });

  const addStep = () => {
    if (!editScenario || motors.length===0) return;
    setEditScenario(prev => prev ? {
      ...prev, steps:[...prev.steps,{
        motor_id: motors[0].id, action:'open',
        target_pos:null, step_order:prev.steps.length,
      }],
    } : null);
  };

  const updateStep = (idx:number, patch:Partial<ScenarioStep>) =>
    setEditScenario(prev => prev ? {
      ...prev, steps: prev.steps.map((s,i)=>i===idx?{...s,...patch}:s),
    } : null);

  const removeStep = (idx:number) =>
    setEditScenario(prev => prev ? {
      ...prev, steps: prev.steps.filter((_,i)=>i!==idx)
                      .map((s,i)=>({...s,step_order:i})),
    } : null);

  const saveScenario = async () => {
    if (!editScenario?.name?.trim()) return;
    setSavingScene(true);
    const uid = (await sb.auth.getUser()).data.user?.id;
    let scId = editScenario.id;
    if (scId) {
      await sb.from('scenarios').update({
        name:editScenario.name, icon:editScenario.icon, color:editScenario.color,
      }).eq('id',scId);
      await sb.from('scenario_steps').delete().eq('scenario_id',scId);
    } else {
      const { data } = await sb.from('scenarios').insert({
        name:editScenario.name, icon:editScenario.icon,
        color:editScenario.color, sort_order:editScenario.sort_order, user_id:uid,
      }).select().single();
      scId = (data as any)?.id;
    }
    if (scId && editScenario.steps.length>0) {
      await sb.from('scenario_steps').insert(
        editScenario.steps.map((step,i)=>({
          scenario_id:scId, motor_id:step.motor_id,
          action:step.action, target_pos:step.target_pos,
          step_order:i,
        }))
      );
    }
    setSavingScene(false);
    setEditScenario(null);
    loadScenarios();
  };

  const deleteScenario = async (id:string) => {
    await sb.from('scenarios').delete().eq('id',id);
    setEditScenario(null);
    loadScenarios();
  };

  const runScenario = async (id:string) => {
    const { data } = await sb.rpc('execute_scenario',{p_scenario_id:id});
    const res = data as any;
    if (res?.ok) setToast({msg:`✦ ${res.commands_sent} komut gönderildi`,ok:true});
    else          setToast({msg:'Senaryo çalıştırılamadı',ok:false});
    setTimeout(()=>setToast(null),3000);
  };

  // ── Hesaplamalar ──────────────────────────────────────────────
  const catCol   = CATS.find(c=>c.id===cat)?.col ?? C.gold;
  const hh       = time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const dd       = time.toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long'});
  const isOnline = device.last_seen && (Date.now()-new Date(device.last_seen).getTime())<300_000;
  const alarmsActive = safetyEvents.filter(e=>e.state==='alarm'||e.state==='warning');

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:'100dvh',background:C.bg,overflowX:'hidden',fontFamily:SF,color:'rgba(255,255,255,.88)'}}>

      {/* Ambient */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0}}>
        <div style={{position:'absolute',top:-150,left:-100,width:500,height:500,
          background:`radial-gradient(ellipse,${catCol}0d 0%,transparent 65%)`,transition:'background .6s'}}/>
        <div style={{position:'absolute',bottom:80,right:-60,width:350,height:350,
          background:`radial-gradient(ellipse,${C.blue}0b 0%,transparent 65%)`}}/>
      </div>

      <div style={{position:'relative',zIndex:1,paddingBottom:88}}>
        <div style={{height:'env(safe-area-inset-top,12px)'}}/>

        {/* ── Header ── */}
        <div style={{padding:'16px 20px 14px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <div style={{fontFamily:SF_R,fontSize:48,fontWeight:700,letterSpacing:-2,
                lineHeight:1,color:'rgba(255,255,255,.95)'}}>{hh}</div>
              <div style={{fontFamily:SF,fontSize:14,fontWeight:400,letterSpacing:-0.1,
                color:'rgba(255,255,255,.38)',marginTop:3}}>{dd}</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:7,marginTop:2}}>
              {devices.length>1&&(
                <select value={device.device_id}
                  onChange={e=>setDevice(devices.find(d=>d.device_id===e.target.value)??devices[0])}
                  style={{background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.12)',
                    borderRadius:10,padding:'4px 10px',color:'rgba(255,255,255,.8)',
                    fontFamily:SF,fontSize:12,cursor:'pointer',outline:'none'}}>
                  {devices.map(d=><option key={d.device_id} value={d.device_id}>{d.name||d.device_id}</option>)}
                </select>
              )}
              {/* Online badge */}
              <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',
                borderRadius:20,background:isOnline?`${C.green}18`:`${C.red}18`,
                border:`1px solid ${isOnline?C.green+'40':C.red+'40'}`}}>
                <div style={{width:5,height:5,borderRadius:'50%',
                  background:isOnline?C.green:C.red,boxShadow:`0 0 6px ${isOnline?C.green:C.red}`}}/>
                <span style={{fontFamily:SF,fontSize:10,fontWeight:700,letterSpacing:.4,
                  color:isOnline?C.green:C.red}}>
                  {(device.name||device.device_id)} · {isOnline?'ÇEVRİMİÇİ':'ÇEVRİMDIŞI'}
                </span>
              </div>
              {/* Cloud badge */}
              <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',
                borderRadius:20,background:`${C.blue}18`,border:`1px solid ${C.blue}40`}}>
                <div style={{width:5,height:5,borderRadius:'50%',background:C.blue,boxShadow:`0 0 6px ${C.blue}`}}/>
                <span style={{fontFamily:SF,fontSize:10,fontWeight:700,letterSpacing:.4,color:C.blue}}>◈ BULUT</span>
              </div>
              {/* Alarm */}
              {alarmsActive.length>0&&(
                <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',
                  borderRadius:20,background:`${C.red}22`,border:`1px solid ${C.red}55`}}>
                  <div style={{width:5,height:5,borderRadius:'50%',background:C.red,boxShadow:`0 0 8px ${C.red}`,animation:'blink 1s infinite'}}/>
                  <span style={{fontFamily:SF,fontSize:10,fontWeight:700,letterSpacing:.4,color:C.red}}>
                    {alarmsActive.length} ALARM
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Toast */}
          {toast&&(
            <div style={{marginTop:10,padding:'9px 14px',borderRadius:12,
              background:toast.ok?`${C.blue}18`:`${C.red}18`,
              border:`1px solid ${toast.ok?C.blue+'40':C.red+'40'}`,
              fontFamily:SF,fontSize:13,fontWeight:500,
              color:toast.ok?C.blue:C.red}}>{toast.msg}</div>
          )}
        </div>

        {/* ── Kategori tab'ları ── */}
        <div style={{display:'flex',gap:0,overflowX:'auto',padding:'0 16px',
          marginBottom:20,scrollbarWidth:'none',WebkitOverflowScrolling:'touch'}}>
          {CATS.map(c=>(
            <button key={c.id} onClick={()=>setCat(c.id)} style={{
              display:'flex',flexDirection:'column',alignItems:'center',gap:4,
              padding:'8px 11px',border:'none',background:'transparent',
              cursor:'pointer',flexShrink:0,position:'relative',
              WebkitTapHighlightColor:'transparent'}}>
              <div style={{width:44,height:44,borderRadius:14,
                background:cat===c.id?`${c.col}30`:'rgba(255,255,255,.06)',
                border:`1.5px solid ${cat===c.id?c.col+'66':'rgba(255,255,255,.08)'}`,
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,
                boxShadow:cat===c.id?`0 0 20px ${c.col}44`:'none',transition:'all .25s',
                filter:cat===c.id?`drop-shadow(0 0 6px ${c.col}88)`:'none'}}>
                {c.icon}
              </div>
              <span style={{fontFamily:SF,fontSize:10,fontWeight:cat===c.id?700:500,letterSpacing:.2,
                color:cat===c.id?c.col:'rgba(255,255,255,.35)',transition:'color .2s',whiteSpace:'nowrap'}}>
                {c.label}
              </span>
              {cat===c.id&&<div style={{position:'absolute',bottom:0,left:'50%',transform:'translateX(-50%)',
                width:20,height:2,borderRadius:1,background:c.col,boxShadow:`0 0 6px ${c.col}`}}/>}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════
            PERDELER (Motorlar)
        ════════════════════════════════════════════════════════ */}
        {cat==='covers'&&(
          <>
            {motors.length===0?(
              <div style={{padding:'0 20px'}}>
                <Card style={{textAlign:'center',padding:'32px 20px'}}>
                  <div style={{fontSize:40,marginBottom:12}}>🪟</div>
                  <div style={{fontFamily:SF,fontSize:17,fontWeight:600,
                    color:'rgba(255,255,255,.8)',marginBottom:8}}>Motor tanımlanmamış</div>
                  <div style={{fontFamily:SF,fontSize:14,color:'rgba(255,255,255,.4)',marginBottom:20}}>
                    Cihazınızdaki motor ve perde slotlarını buradan adlandırın.
                  </div>
                  <PrimaryBtn onClick={openAddMotor}>+ Motor Ekle</PrimaryBtn>
                </Card>
              </div>
            ):(
              <>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:'0 20px',marginBottom:16}}>
                  {motors.map(m=>(
                    <MotorTile key={m.id} motor={m}
                      onTap={()=>{ setCtrlMotor(m); setCtrlPos(m.current_pos); }}
                      onEdit={()=>openEditMotor(m)}
                    />
                  ))}
                  {/* Ekle butonu */}
                  <button onClick={openAddMotor} style={{
                    background:'rgba(255,255,255,.04)',
                    border:`1px dashed rgba(255,255,255,.18)`,
                    borderRadius:20,padding:'16px',cursor:'pointer',
                    display:'flex',flexDirection:'column',alignItems:'center',
                    justifyContent:'center',gap:8,color:'rgba(255,255,255,.35)',
                    minHeight:120,WebkitTapHighlightColor:'transparent',
                    fontFamily:SF,fontSize:13,fontWeight:500,
                  }}>
                    <div style={{fontSize:28,opacity:.5}}>＋</div>
                    Motor Ekle
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            SAHNELER (Senaryolar)
        ════════════════════════════════════════════════════════ */}
        {cat==='scenarios'&&(
          <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:12}}>
            {/* Senaryo kartları */}
            {scenarios.map(sc=>(
              <ScenarioCard key={sc.id} scenario={sc} motors={motors}
                onRun={()=>runScenario(sc.id)}
                onEdit={()=>openEditScenario(sc)}
              />
            ))}
            {/* Yeni senaryo */}
            <button onClick={openAddScenario} style={{
              background:'rgba(255,255,255,.04)',
              border:'1px dashed rgba(255,255,255,.18)',
              borderRadius:18,padding:'16px 20px',cursor:'pointer',
              display:'flex',alignItems:'center',gap:12,
              color:'rgba(255,255,255,.4)',fontFamily:SF,fontSize:14,fontWeight:500,
              WebkitTapHighlightColor:'transparent',
            }}>
              <div style={{fontSize:22,opacity:.5}}>＋</div>
              Yeni Senaryo Oluştur
            </button>
            {scenarios.length===0&&(
              <div style={{fontFamily:SF,fontSize:13,color:'rgba(255,255,255,.3)',
                textAlign:'center',padding:'8px 0'}}>
                Senaryo = birden fazla motorun tek tuşla hareketi.<br/>
                Örn: "Sinema" → Pergola %0, Jaluzi %100
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            SENSÖRLER
        ════════════════════════════════════════════════════════ */}
        {cat==='sensors'&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:'0 20px'}}>
            {([
              ['🌡','temp','°C','Sıcaklık'],['💧','humidity','%','Nem'],
              ['☀️','lux',' lx','Işık'],['💨','gas',' %','Gaz'],
              ['💧','water','','Su'],['🌧','rain','','Yağmur'],
            ] as [string,string,string,string][]).map(([icon,ch,unit,label])=>{
              const v=latestReadings[ch];
              return(
                <Card key={ch}>
                  <div style={{fontSize:24,marginBottom:8}}>{icon}</div>
                  <div style={{fontFamily:SF_MONO,fontSize:26,fontWeight:700,
                    letterSpacing:-0.8,lineHeight:1,marginBottom:5,
                    color:v!=null?C.blue:'rgba(255,255,255,.3)'}}>
                    {v!=null?v.toFixed(1):'—'}<span style={{fontSize:12,opacity:.6}}>{unit}</span>
                  </div>
                  <div style={{fontFamily:SF,fontSize:10,fontWeight:600,letterSpacing:.4,
                    textTransform:'uppercase',color:'rgba(255,255,255,.35)'}}>{label}</div>
                  {v==null&&<div style={{fontFamily:SF,fontSize:10,color:'rgba(255,255,255,.2)',marginTop:4}}>
                    Veri bekleniyor
                  </div>}
                </Card>
              );
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            GÜVENLİK
        ════════════════════════════════════════════════════════ */}
        {cat==='safety'&&(
          <div style={{display:'flex',flexDirection:'column',gap:10,padding:'0 20px'}}>
            {safetyEvents.length===0?(
              <Card style={{textAlign:'center',padding:'32px 20px',background:`${C.green}10`,border:`1px solid ${C.green}30`}}>
                <div style={{fontSize:36,marginBottom:12}}>✅</div>
                <div style={{fontFamily:SF,fontSize:16,fontWeight:600,color:C.green}}>Tüm sistemler normal</div>
              </Card>
            ):safetyEvents.map(ev=>{
              const alarm=ev.state==='alarm';
              const col=alarm?C.red:ev.state==='warning'?C.orange:C.green;
              return(
                <Card key={ev.id} style={{background:`${col}10`,border:`1px solid ${col}30`,
                  display:'flex',alignItems:'center',gap:12,
                  animation:alarm?'pulseRed 1.5s infinite':'none'}}>
                  <div style={{fontSize:24}}>{ev.alarm_type===1?'🔥':ev.alarm_type===2?'⚠️':ev.alarm_type===3?'💧':'🚨'}</div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:SF,fontSize:14,fontWeight:600,color:col,marginBottom:2}}>
                      {ev.alarm_type_name||`Alarm #${ev.alarm_type}`}
                    </div>
                    <div style={{fontFamily:SF,fontSize:12,color:'rgba(255,255,255,.4)'}}>
                      {new Date(ev.ts).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}
                      {ev.value!=null?` · ${ev.value.toFixed(2)}`:''}
                    </div>
                  </div>
                  <span style={{fontFamily:SF,fontSize:10,fontWeight:700,letterSpacing:.4,color:col}}>
                    {ev.state.toUpperCase()}
                  </span>
                </Card>
              );
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            AYARLAR
        ════════════════════════════════════════════════════════ */}
        {cat==='settings'&&(
          <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
            <Card>
              <div style={{fontFamily:SF,fontSize:11,fontWeight:600,letterSpacing:.4,
                textTransform:'uppercase',color:'rgba(255,255,255,.3)',marginBottom:12}}>
                CİHAZ BİLGİSİ
              </div>
              {([
                ['ID', device.device_id],
                ['Model', device.model||'LuxaCore v2'],
                ['Firmware', device.firmware||'v2.0.0'],
                ['IP', device.ip_address||'—'],
                ['Son Görülme', device.last_seen?new Date(device.last_seen).toLocaleString('tr-TR'):'—'],
              ] as [string,string][]).map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,.06)'}}>
                  <span style={{fontFamily:SF,fontSize:14,color:'rgba(255,255,255,.5)'}}>{k}</span>
                  <span style={{fontFamily:SF_MONO,fontSize:13,fontWeight:600,
                    color:'rgba(255,255,255,.8)',letterSpacing:-0.2}}>{v}</span>
                </div>
              ))}
            </Card>
            <a href="/devices" style={{textDecoration:'none'}}>
              <Card style={{display:'flex',alignItems:'center',gap:12,cursor:'pointer',
                background:`${C.blue}10`,border:`1px solid ${C.blue}25`}}>
                <div style={{fontSize:22}}>⚙️</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:SF,fontSize:15,fontWeight:600,color:`${C.blue}cc`}}>
                    Gelişmiş Cihaz Ayarları
                  </div>
                  <div style={{fontFamily:SF,fontSize:12,color:'rgba(255,255,255,.35)',marginTop:2}}>
                    Sensör konfigürasyonu, kurallar, firmware
                  </div>
                </div>
                <span style={{color:'rgba(255,255,255,.3)',fontSize:18}}>›</span>
              </Card>
            </a>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          KONTROL SHEET (Motor kontrol)
      ════════════════════════════════════════════════════════════ */}
      {ctrlMotor&&(
        <Sheet onClose={()=>setCtrlMotor(null)}>
          {/* Başlık */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',
            padding:'4px 24px 0',marginBottom:6}}>
            <div>
              <div style={{fontFamily:SF,fontSize:22,fontWeight:700,letterSpacing:-0.4,
                color:'rgba(255,255,255,.95)',display:'flex',alignItems:'center',gap:8}}>
                <span>{ctrlMotor.icon}</span>
                <span>{ctrlMotor.name}</span>
              </div>
              <div style={{fontFamily:SF,fontSize:13,color:'rgba(255,255,255,.38)',marginTop:3}}>
                {ctrlMotor.room} · {ctrlMotor.protocol==='rf'?'RF 433 MHz':'Röle Kontrol'}
              </div>
            </div>
            <SheetCloseBtn onClick={()=>setCtrlMotor(null)}/>
          </div>

          {/* Bulut uyarısı */}
          <div style={{margin:'8px 24px 0',background:'rgba(14,165,233,.1)',
            border:'1px solid rgba(14,165,233,.25)',borderRadius:12,padding:'7px 12px'}}>
            <span style={{fontFamily:SF,fontSize:12,fontWeight:500,color:'rgba(14,165,233,.85)'}}>
              ◈ Bulut üzerinden · Komut cihaza ~1-3 saniyede ulaşır
            </span>
          </div>

          {/* Arc dial */}
          <div style={{display:'flex',justifyContent:'center',padding:'8px 0 0',marginBottom:-8}}>
            <svg width={160} height={136} viewBox="0 0 160 136" style={{overflow:'visible'}}>
              <path d={arcPath(80,90,64,-210,30)} fill="none"
                stroke="rgba(255,255,255,.1)" strokeWidth={5} strokeLinecap="round"/>
              {ctrlPos>0&&<path d={arcPath(80,90,64,-210,-210+(ctrlPos/100)*240)} fill="none"
                stroke={C.gold} strokeWidth={5} strokeLinecap="round"
                style={{filter:`drop-shadow(0 0 5px ${C.gold})`}}/>}
              <text x={80} y={84} textAnchor="middle" fontFamily={SF_R}
                fontSize={36} fontWeight={700} letterSpacing={-1.5} fill={C.gold}>{ctrlPos}</text>
              <text x={80} y={104} textAnchor="middle" fontFamily={SF}
                fontSize={11} fontWeight={600} letterSpacing={.4} fill="rgba(255,255,255,.28)">YÜZDE</text>
            </svg>
          </div>

          {/* Slider */}
          <div style={{padding:'0 28px 8px'}}>
            <input type="range" min={0} max={100} value={ctrlPos}
              onChange={e=>setCtrlPos(+e.target.value)}
              style={{width:'100%',height:32,appearance:'none',
                WebkitAppearance:'none',background:'transparent',cursor:'pointer',outline:'none',border:'none'}}/>
          </div>

          {/* Butonlar */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,padding:'0 24px 20px'}}>
            {([
              ['↑','AÇ',   ctrlMotor.protocol==='rf'?'rts_up':'motor_open',   C.gold],
              ['■','DUR',  ctrlMotor.protocol==='rf'?'rts_my':'motor_stop',   'rgba(255,255,255,.45)'],
              ['↓','KAPAT',ctrlMotor.protocol==='rf'?'rts_down':'motor_close',C.blue],
            ] as [string,string,string,string][]).map(([ic,label,cmd,col])=>(
              <button key={cmd}
                onClick={()=>sendCmd(cmd,ctrlMotor.slot_id)}
                disabled={sending===cmd}
                style={{height:64,borderRadius:16,border:'none',background:`${col}1a`,color:col,
                  cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',
                  justifyContent:'center',gap:3,fontFamily:SF,
                  opacity:sending===cmd?.5:1,WebkitTapHighlightColor:'transparent'}}
                onPointerDown={e=>(e.currentTarget as HTMLButtonElement).style.background=`${col}33`}
                onPointerUp={e=>(e.currentTarget as HTMLButtonElement).style.background=`${col}1a`}>
                <span style={{fontSize:22,lineHeight:1}}>{ic}</span>
                <span style={{fontSize:10,fontWeight:700,letterSpacing:.5}}>{label}</span>
              </button>
            ))}
          </div>

          {/* Info + Düzenle */}
          <div style={{margin:'0 24px',background:'rgba(255,255,255,.04)',
            borderRadius:14,padding:'12px 16px',display:'grid',gridTemplateColumns:'1fr 1fr 1fr',
            gap:8,marginBottom:16}}>
            {[['Durum',ctrlPos===0?'Kapalı':ctrlPos===100?'Açık':'Kısmi'],
              ['Pozisyon',`${ctrlPos}%`],
              ['Protokol',ctrlMotor.protocol==='rf'?'RF':'Röle']].map(([k,v])=>(
              <div key={k} style={{textAlign:'center'}}>
                <div style={{fontFamily:SF_MONO,fontSize:14,fontWeight:700,letterSpacing:-0.3,
                  color:'rgba(255,255,255,.82)',marginBottom:3}}>{v}</div>
                <div style={{fontFamily:SF,fontSize:10,fontWeight:600,letterSpacing:.4,
                  textTransform:'uppercase',color:'rgba(255,255,255,.3)'}}>{k}</div>
              </div>
            ))}
          </div>
          <div style={{padding:'0 24px 4px',display:'flex',gap:8}}>
            <GhostBtn onClick={()=>{ setCtrlMotor(null); openEditMotor(ctrlMotor); }}>
              ✎ Motoru Düzenle
            </GhostBtn>
          </div>
        </Sheet>
      )}

      {/* ══════════════════════════════════════════════════════════
          MOTOR DÜZENLE / EKLE SHEET
      ════════════════════════════════════════════════════════════ */}
      {editMotor&&(
        <Sheet onClose={()=>setEditMotor(null)}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
            padding:'4px 24px 16px'}}>
            <div style={{fontFamily:SF,fontSize:20,fontWeight:700,letterSpacing:-0.3,
              color:'rgba(255,255,255,.95)'}}>
              {editMotor.id ? 'Motoru Düzenle' : 'Motor Ekle'}
            </div>
            <SheetCloseBtn onClick={()=>setEditMotor(null)}/>
          </div>

          <div style={{padding:'0 24px',display:'flex',flexDirection:'column',gap:14}}>
            {/* İkon seçici */}
            <div>
              <FieldLabel>İkon</FieldLabel>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {['🪟','🏠','🌿','⬛','🔲','🌅','🌙','🛖','🏢'].map(ic=>(
                  <button key={ic} onClick={()=>setEditMotor(p=>p?{...p,icon:ic}:p)}
                    style={{width:40,height:40,borderRadius:10,border:`1.5px solid ${editMotor.icon===ic?C.gold+'66':'rgba(255,255,255,.12)'}`,
                      background:editMotor.icon===ic?`${C.gold}22`:'rgba(255,255,255,.05)',
                      fontSize:20,cursor:'pointer',WebkitTapHighlightColor:'transparent'}}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            {/* İsim */}
            <div>
              <FieldLabel>Motor Adı</FieldLabel>
              <TextInput value={editMotor.name||''} placeholder="örn. Pergola"
                onChange={v=>setEditMotor(p=>p?{...p,name:v}:p)}/>
            </div>

            {/* Oda */}
            <div>
              <FieldLabel>Oda / Konum</FieldLabel>
              <TextInput value={editMotor.room||''} placeholder="örn. Teras"
                onChange={v=>setEditMotor(p=>p?{...p,room:v}:p)}/>
            </div>

            {/* Protokol */}
            <div>
              <FieldLabel>Protokol</FieldLabel>
              <div style={{display:'flex',gap:8}}>
                {([['rf','RF  433 MHz'],['relay','Röle']] as [string,string][]).map(([proto,lbl])=>(
                  <button key={proto}
                    onClick={()=>setEditMotor(p=>p?{...p,protocol:proto as 'rf'|'relay'}:p)}
                    style={{flex:1,height:44,borderRadius:12,border:`1.5px solid ${editMotor.protocol===proto?C.gold+'66':'rgba(255,255,255,.12)'}`,
                      background:editMotor.protocol===proto?`${C.gold}22`:'rgba(255,255,255,.05)',
                      color:editMotor.protocol===proto?C.gold:'rgba(255,255,255,.5)',
                      fontFamily:SF,fontSize:13,fontWeight:600,cursor:'pointer',
                      WebkitTapHighlightColor:'transparent'}}>
                    {lbl}
                  </button>
                ))}
              </div>
              <div style={{fontFamily:SF,fontSize:11,color:'rgba(255,255,255,.3)',marginTop:6}}>
                RF = 433 MHz frekanslı kablosuz motor · Röle = kablolu doğrudan bağlantı
              </div>
            </div>

            {/* Slot (sadece yeni eklemede) */}
            {!editMotor.id&&(
              <div>
                <FieldLabel>ESP32 Slot (0-15)</FieldLabel>
                <TextInput value={String(editMotor.slot_id??0)} placeholder="0"
                  onChange={v=>setEditMotor(p=>p?{...p,slot_id:parseInt(v)||0}:p)}/>
                <div style={{fontFamily:SF,fontSize:11,color:'rgba(255,255,255,.3)',marginTop:6}}>
                  Firmware'de bu motor/perde için atanmış slot numarası
                </div>
              </div>
            )}

            <div style={{marginTop:4,display:'flex',flexDirection:'column',gap:8}}>
              <PrimaryBtn onClick={saveMotor} disabled={savingMotor||!editMotor.name?.trim()}>
                {savingMotor?'Kaydediliyor...':'Kaydet'}
              </PrimaryBtn>
              {editMotor.id&&(
                <button onClick={()=>deleteMotor(editMotor.id!)}
                  style={{width:'100%',height:44,borderRadius:12,border:`1px solid ${C.red}40`,
                    background:`${C.red}12`,color:C.red,cursor:'pointer',fontFamily:SF,
                    fontSize:13,fontWeight:600,WebkitTapHighlightColor:'transparent'}}>
                  Motoru Sil
                </button>
              )}
            </div>
          </div>
        </Sheet>
      )}

      {/* ══════════════════════════════════════════════════════════
          SENARYO DÜZENLE / OLUŞTUR SHEET
      ════════════════════════════════════════════════════════════ */}
      {editScenario&&(
        <Sheet onClose={()=>setEditScenario(null)} tall>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
            padding:'4px 24px 16px'}}>
            <div style={{fontFamily:SF,fontSize:20,fontWeight:700,letterSpacing:-0.3,
              color:'rgba(255,255,255,.95)'}}>
              {editScenario.id ? 'Senaryoyu Düzenle' : 'Yeni Senaryo'}
            </div>
            <SheetCloseBtn onClick={()=>setEditScenario(null)}/>
          </div>

          <div style={{padding:'0 24px',display:'flex',flexDirection:'column',gap:14}}>
            {/* İkon */}
            <div>
              <FieldLabel>İkon</FieldLabel>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {['🌅','☀️','🌙','🎬','⛈','🏠','🔒','🌿','🎉','💤'].map(ic=>(
                  <button key={ic} onClick={()=>setEditScenario(p=>p?{...p,icon:ic}:p)}
                    style={{width:40,height:40,borderRadius:10,
                      border:`1.5px solid ${editScenario.icon===ic?C.gold+'66':'rgba(255,255,255,.12)'}`,
                      background:editScenario.icon===ic?`${C.gold}22`:'rgba(255,255,255,.05)',
                      fontSize:20,cursor:'pointer',WebkitTapHighlightColor:'transparent'}}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            {/* İsim */}
            <div>
              <FieldLabel>Senaryo Adı</FieldLabel>
              <TextInput value={editScenario.name||''} placeholder="örn. Sinema Modu"
                onChange={v=>setEditScenario(p=>p?{...p,name:v}:p)}/>
            </div>

            {/* Renk */}
            <div>
              <FieldLabel>Renk</FieldLabel>
              <div style={{display:'flex',gap:8}}>
                {[C.gold,C.blue,C.green,C.red,C.purple,C.orange,C.teal,'#64748b'].map(col=>(
                  <button key={col} onClick={()=>setEditScenario(p=>p?{...p,color:col}:p)}
                    style={{width:32,height:32,borderRadius:'50%',border:`2.5px solid ${editScenario.color===col?'white':'transparent'}`,
                      background:col,cursor:'pointer',WebkitTapHighlightColor:'transparent'}}/>
                ))}
              </div>
            </div>

            {/* Adımlar */}
            <div>
              <FieldLabel>Adımlar ({editScenario.steps.length})</FieldLabel>
              {motors.length===0&&(
                <div style={{fontFamily:SF,fontSize:13,color:C.orange,
                  background:`${C.orange}12`,border:`1px solid ${C.orange}30`,
                  borderRadius:12,padding:'10px 14px',marginBottom:10}}>
                  ⚠️ Önce Perdeler sekmesinden motor ekleyin
                </div>
              )}
              {editScenario.steps.map((step,idx)=>{
                const motor=motors.find(m=>m.id===step.motor_id);
                return(
                  <div key={idx} style={{display:'flex',alignItems:'center',gap:8,
                    marginBottom:10,background:'rgba(255,255,255,.04)',
                    border:'1px solid rgba(255,255,255,.08)',borderRadius:14,padding:'10px 12px'}}>
                    {/* Motor seçici */}
                    <select value={step.motor_id}
                      onChange={e=>updateStep(idx,{motor_id:e.target.value})}
                      style={{flex:1,background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.12)',
                        borderRadius:8,padding:'6px 8px',color:'rgba(255,255,255,.85)',
                        fontFamily:SF,fontSize:13,cursor:'pointer',outline:'none'}}>
                      {motors.map(m=>(
                        <option key={m.id} value={m.id}>{m.icon} {m.name}</option>
                      ))}
                    </select>

                    {/* Eylem */}
                    <select value={step.action}
                      onChange={e=>updateStep(idx,{action:e.target.value as any,
                        target_pos:e.target.value==='position'?50:null})}
                      style={{width:90,background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.12)',
                        borderRadius:8,padding:'6px 8px',color:'rgba(255,255,255,.85)',
                        fontFamily:SF,fontSize:12,cursor:'pointer',outline:'none'}}>
                      <option value="open">Aç</option>
                      <option value="close">Kapat</option>
                      <option value="stop">Durdur</option>
                      <option value="position">% Konum</option>
                    </select>

                    {/* Pozisyon (sadece position seçiliyse) */}
                    {step.action==='position'&&(
                      <input type="number" min={0} max={100} value={step.target_pos??50}
                        onChange={e=>updateStep(idx,{target_pos:parseInt(e.target.value)||0})}
                        style={{width:60,background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.12)',
                          borderRadius:8,padding:'6px 8px',color:C.gold,
                          fontFamily:SF_MONO,fontSize:13,outline:'none',
                          WebkitAppearance:'none',textAlign:'center'}}/>
                    )}

                    {/* Sil */}
                    <button onClick={()=>removeStep(idx)}
                      style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.red}30`,
                        background:`${C.red}12`,color:C.red,cursor:'pointer',fontSize:14,
                        display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
                        WebkitTapHighlightColor:'transparent'}}>✕</button>
                  </div>
                );
              })}

              {/* Adım ekle */}
              <button onClick={addStep} disabled={motors.length===0}
                style={{width:'100%',height:42,borderRadius:12,
                  border:'1px dashed rgba(255,255,255,.2)',background:'transparent',
                  color:'rgba(255,255,255,.45)',cursor:motors.length===0?'not-allowed':'pointer',
                  fontFamily:SF,fontSize:13,fontWeight:500,
                  WebkitTapHighlightColor:'transparent'}}>
                ＋ Motor Adımı Ekle
              </button>
            </div>

            <div style={{marginTop:4,display:'flex',flexDirection:'column',gap:8}}>
              <PrimaryBtn onClick={saveScenario}
                disabled={savingScene||!editScenario.name?.trim()||editScenario.steps.length===0}
                col={editScenario.color||C.gold}>
                {savingScene?'Kaydediliyor...':'Senaryoyu Kaydet'}
              </PrimaryBtn>
              {editScenario.id&&(
                <button onClick={()=>deleteScenario(editScenario.id!)}
                  style={{width:'100%',height:44,borderRadius:12,border:`1px solid ${C.red}40`,
                    background:`${C.red}12`,color:C.red,cursor:'pointer',fontFamily:SF,
                    fontSize:13,fontWeight:600,WebkitTapHighlightColor:'transparent'}}>
                  Senaryoyu Sil
                </button>
              )}
            </div>
          </div>
        </Sheet>
      )}

      <style>{`
        *{box-sizing:border-box;-webkit-font-smoothing:antialiased}
        ::-webkit-scrollbar{display:none}
        input[type="range"]{-webkit-appearance:none;appearance:none;outline:none}
        input[type="range"]::-webkit-slider-runnable-track{height:3px;background:rgba(255,255,255,.12);border-radius:2px}
        input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;
          border-radius:50%;background:${C.gold};box-shadow:0 0 14px ${C.gold}aa;margin-top:-11.5px;transition:transform .15s}
        input[type="range"]:active::-webkit-slider-thumb{transform:scale(1.28)}
        @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.78)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes pulseRed{0%,100%{box-shadow:0 0 0 rgba(255,59,48,0)}50%{box-shadow:0 0 24px rgba(255,59,48,.4)}}
      `}</style>
    </div>
  );
}

// ─── Alt Bileşenler ──────────────────────────────────────────────

function Sheet({ children, onClose, tall }:
  { children:React.ReactNode; onClose:()=>void; tall?:boolean }) {
  return(
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:100,
        background:'rgba(0,0,0,.55)',backdropFilter:'blur(6px)',WebkitBackdropFilter:'blur(6px)'}}/>
      <div style={{position:'fixed',left:0,right:0,bottom:0,zIndex:101,
        background:'#111114',borderRadius:'28px 28px 0 0',
        border:'1px solid rgba(255,255,255,.1)',borderBottom:'none',
        boxShadow:'0 -24px 64px rgba(0,0,0,.65)',
        paddingBottom:'env(safe-area-inset-bottom,24px)',
        animation:'slideUp .35s cubic-bezier(.32,0,.67,0) forwards',
        maxHeight: tall?'94dvh':'88dvh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'center',padding:'12px 0 8px'}}>
          <div style={{width:36,height:4,borderRadius:2,background:'rgba(255,255,255,.2)'}}/>
        </div>
        {children}
      </div>
    </>
  );
}

function SheetCloseBtn({ onClick }:{onClick:()=>void}) {
  return(
    <button onClick={onClick} style={{width:32,height:32,borderRadius:16,
      background:'rgba(255,255,255,.1)',border:'none',color:'rgba(255,255,255,.6)',
      cursor:'pointer',fontSize:14,fontWeight:600,display:'flex',alignItems:'center',
      justifyContent:'center',flexShrink:0,WebkitTapHighlightColor:'transparent'}}>✕</button>
  );
}

function FieldLabel({ children }:{children:React.ReactNode}) {
  return(
    <div style={{fontFamily:`-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif`,
      fontSize:11,fontWeight:600,letterSpacing:.4,textTransform:'uppercase',
      color:'rgba(255,255,255,.35)',marginBottom:8}}>{children}</div>
  );
}

function TextInput({ value,placeholder,onChange }:
  {value:string;placeholder:string;onChange:(v:string)=>void}) {
  const SF=`-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif`;
  return(
    <input type="text" value={value} placeholder={placeholder}
      onChange={e=>onChange(e.target.value)}
      style={{width:'100%',background:'rgba(255,255,255,.07)',
        border:'1px solid rgba(255,255,255,.12)',borderRadius:12,
        padding:'12px 14px',color:'rgba(255,255,255,.88)',
        fontFamily:SF,fontSize:15,outline:'none',
        caretColor:'#c9963b'}}/>
  );
}

function MotorTile({ motor, onTap, onEdit }:
  {motor:Motor; onTap:()=>void; onEdit:()=>void}) {
  const on=motor.current_pos>0;
  const gold='#c9963b';
  return(
    <div style={{position:'relative'}}>
      <button onClick={onTap} style={{
        width:'100%',background:on?`linear-gradient(145deg,rgba(201,150,59,.2),rgba(201,150,59,.07))`:'rgba(255,255,255,.05)',
        border:`1px solid ${on?'rgba(201,150,59,.4)':'rgba(255,255,255,.08)'}`,
        borderRadius:20,padding:'16px 14px',cursor:'pointer',textAlign:'left',
        position:'relative',overflow:'hidden',
        boxShadow:on?'0 4px 16px rgba(0,0,0,.3)':'0 2px 8px rgba(0,0,0,.25)',
        transition:'all .25s',color:'white',WebkitTapHighlightColor:'transparent'}}>
        {/* Fill */}
        <div style={{position:'absolute',left:0,bottom:0,width:'100%',height:`${motor.current_pos}%`,
          background:`linear-gradient(to top,rgba(201,150,59,.2),transparent)`,
          transition:'height .7s',pointerEvents:'none',borderRadius:'0 0 20px 20px'}}/>
        <div style={{position:'absolute',top:13,right:36,width:7,height:7,borderRadius:'50%',
          background:on?'rgba(201,150,59,.7)':'rgba(255,255,255,.15)',
          boxShadow:on?`0 0 7px ${gold}`:'none'}}/>
        <div style={{fontSize:22,marginBottom:8,lineHeight:1,position:'relative',
          filter:on?`drop-shadow(0 0 6px rgba(201,150,59,.7))`:'none'}}>{motor.icon}</div>
        <div style={{fontFamily:`-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif`,
          fontSize:14,fontWeight:600,letterSpacing:-0.1,color:'rgba(255,255,255,.9)',
          marginBottom:3,lineHeight:1.2,position:'relative'}}>{motor.name}</div>
        <div style={{fontFamily:`"SF Mono","Menlo","Consolas",monospace`,
          fontSize:11,fontWeight:600,letterSpacing:.3,color:'rgba(255,255,255,.35)',
          position:'relative'}}>{motor.room}</div>
        <div style={{fontFamily:`"SF Mono","Menlo","Consolas",monospace`,
          fontSize:18,fontWeight:700,letterSpacing:-0.8,
          color:on?'rgba(201,150,59,.85)':'rgba(255,255,255,.3)',
          position:'relative',marginTop:4}}>{motor.current_pos}%</div>
      </button>
      {/* Düzenle butonu */}
      <button onClick={e=>{e.stopPropagation();onEdit();}} style={{
        position:'absolute',top:10,right:10,width:26,height:26,borderRadius:8,
        background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.12)',
        color:'rgba(255,255,255,.45)',cursor:'pointer',fontSize:11,
        display:'flex',alignItems:'center',justifyContent:'center',
        WebkitTapHighlightColor:'transparent'}}>✎</button>
    </div>
  );
}

function ScenarioCard({ scenario, motors, onRun, onEdit }:
  {scenario:Scenario; motors:Motor[]; onRun:()=>void; onEdit:()=>void}) {
  const SF=`-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif`;
  const MONO=`"SF Mono","Menlo","Consolas",monospace`;
  const steps=scenario.steps||[];
  return(
    <div style={{background:'rgba(255,255,255,.04)',
      border:`1px solid rgba(255,255,255,.08)`,borderRadius:20,overflow:'hidden'}}>
      {/* Başlık */}
      <div style={{padding:'14px 16px 10px',display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:44,height:44,borderRadius:12,flexShrink:0,
          background:`${scenario.color}22`,border:`1px solid ${scenario.color}40`,
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>
          {scenario.icon}
        </div>
        <div style={{flex:1}}>
          <div style={{fontFamily:SF,fontSize:16,fontWeight:700,letterSpacing:-0.1,
            color:'rgba(255,255,255,.92)'}}>{scenario.name}</div>
          <div style={{fontFamily:SF,fontSize:12,color:'rgba(255,255,255,.38)',marginTop:2}}>
            {steps.length} adım
          </div>
        </div>
        <button onClick={onEdit}
          style={{width:32,height:32,borderRadius:9,background:'rgba(255,255,255,.07)',
            border:'1px solid rgba(255,255,255,.12)',color:'rgba(255,255,255,.5)',
            cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',
            justifyContent:'center',WebkitTapHighlightColor:'transparent'}}>✎</button>
      </div>

      {/* Adım özeti */}
      {steps.length>0&&(
        <div style={{padding:'0 16px 12px',display:'flex',flexDirection:'column',gap:5}}>
          {steps.slice(0,4).map((step,i)=>{
            const motor=motors.find(m=>m.id===step.motor_id);
            return(
              <div key={i} style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:14}}>{motor?.icon||'🪟'}</span>
                <span style={{fontFamily:SF,fontSize:12,color:'rgba(255,255,255,.55)',flex:1}}>
                  {motor?.name||'Motor'}
                </span>
                <span style={{fontFamily:MONO,fontSize:11,fontWeight:600,
                  color:`${scenario.color}cc`,letterSpacing:.2}}>
                  {step.action==='open'?'Aç':step.action==='close'?'Kapat':
                    step.action==='stop'?'Dur':`%${step.target_pos}`}
                </span>
              </div>
            );
          })}
          {steps.length>4&&(
            <div style={{fontFamily:SF,fontSize:11,color:'rgba(255,255,255,.3)'}}>
              +{steps.length-4} adım daha
            </div>
          )}
        </div>
      )}

      {/* Çalıştır */}
      <div style={{padding:'0 16px 14px'}}>
        <button onClick={onRun} style={{
          width:'100%',height:44,borderRadius:12,border:'none',
          background:`linear-gradient(135deg,${scenario.color}cc,${scenario.color}88)`,
          color:'#0a0a0c',cursor:'pointer',fontFamily:SF,fontSize:14,fontWeight:700,
          WebkitTapHighlightColor:'transparent',transition:'opacity .15s'}}
          onPointerDown={e=>(e.currentTarget as HTMLButtonElement).style.opacity='.7'}
          onPointerUp={e=>(e.currentTarget as HTMLButtonElement).style.opacity='1'}>
          ▶ Senaryoyu Çalıştır
        </button>
      </div>
    </div>
  );
}
