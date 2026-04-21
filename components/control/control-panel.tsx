'use client';
// components/control/control-panel.tsx — v3
// Complete management dashboard: motor CRUD + scenario builder + live control.
// NO "RF" anywhere — protocol label is "RF 433" or "Relay".
// Commands → Supabase commands table (cloud relay).

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase-client';
import type { Device, SafetyEvent } from '@/lib/types';

// ─── Design tokens ─────────────────────────────────────────────
const C = {
  gold:'#c9963b', blue:'#0ea5e9', green:'#34c759', red:'#ff3b30',
  purple:'#bf5af2', orange:'#ff9f0a', teal:'#5ac8fa', bg:'#0a0a0c',
  card:'rgba(255,255,255,.055)', border:'rgba(255,255,255,.09)',
};
const SF      = `-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",sans-serif`;
const SF_R    = `"SF Pro Rounded",-apple-system,sans-serif`;
const SF_MONO = `"SF Mono","Menlo","Monaco","Consolas",monospace`;

// ─── DB types ─────────────────────────────────────────────────
interface Motor {
  id: string;
  device_id: string;
  slot_id: number;
  name: string;
  room: string;
  protocol: 'rf' | 'relay';
  icon: string;
  current_pos: number;
  moving?: boolean;
  dir?: 'up' | 'down' | 'stop';
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
  scenario_id?: string;
  motor_id: string;
  action: 'open' | 'close' | 'stop' | 'position';
  target_pos?: number;
  step_order: number;
}

// ─── Component props ───────────────────────────────────────────
interface Props {
  devices:        Device[];
  safetyEvents:   SafetyEvent[];
  latestReadings: Record<string, number>;
}

// ─── Categories ────────────────────────────────────────────────
const CATS = [
  { id:'covers',    icon:'🪟', label:'Perdeler',   col:C.gold   },
  { id:'scenarios', icon:'✦',  label:'Senaryolar', col:C.green  },
  { id:'sensors',   icon:'📊', label:'Sensörler',  col:C.blue   },
  { id:'safety',    icon:'🛡', label:'Güvenlik',   col:C.red    },
];

// ─── Rooms list (editable in add-motor form) ───────────────────
const ROOMS = ['Teras','Salon','Yatak','Mutfak','Yemek','Banyo','Çalışma','Dış'];

// ─── Icons for motors ──────────────────────────────────────────
const MOTOR_ICONS = ['🪟','🏠','🌿','☀️','🌊','🎭','🔲','⬛'];

// ─── Scene defaults ────────────────────────────────────────────
const SCENE_COLORS = [C.gold,'#f97316','#818cf8','#3b82f6','#64748b',C.blue,C.green,C.red];
const SCENE_ICONS  = ['🌅','☀️','🎬','🌙','⛈','🏠','🔒','⚡','🌿','🎭'];

// ─── SVG Arc ───────────────────────────────────────────────────
function arcPath(cx:number,cy:number,r:number,s:number,e:number){
  const rad=(d:number)=>d*Math.PI/180;
  const[sx,sy]=[cx+r*Math.cos(rad(s)),cy+r*Math.sin(rad(s))];
  const[ex,ey]=[cx+r*Math.cos(rad(e)),cy+r*Math.sin(rad(e))];
  return`M${sx} ${sy} A${r} ${r} 0 ${(e-s)>180?1:0} 1 ${ex} ${ey}`;
}

// ─── Reusable sheet wrapper ─────────────────────────────────────
function Sheet({children,onClose}:{children:React.ReactNode,onClose:()=>void}){
  return(
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:100,
        background:'rgba(0,0,0,.6)',backdropFilter:'blur(6px)',WebkitBackdropFilter:'blur(6px)'}}/>
      <div style={{position:'fixed',left:0,right:0,bottom:0,zIndex:101,
        background:'#111114',borderRadius:'28px 28px 0 0',
        border:'1px solid rgba(255,255,255,.1)',borderBottom:'none',
        boxShadow:'0 -24px 64px rgba(0,0,0,.7)',
        paddingBottom:'env(safe-area-inset-bottom,24px)',
        animation:'slideUp .32s cubic-bezier(.32,0,.67,0) forwards',
        maxHeight:'90dvh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'center',padding:'12px 0 6px'}}>
          <div style={{width:36,height:4,borderRadius:2,background:'rgba(255,255,255,.2)'}}/>
        </div>
        {children}
      </div>
    </>
  );
}

// ─── Input component ────────────────────────────────────────────
function Input({label,value,onChange,placeholder,type='text'}:{
  label:string;value:string;onChange:(v:string)=>void;placeholder?:string;type?:string;
}){
  return(
    <div style={{marginBottom:14}}>
      <div style={{fontFamily:SF,fontSize:11,fontWeight:600,letterSpacing:.4,
        textTransform:'uppercase',color:'rgba(255,255,255,.4)',marginBottom:6}}>{label}</div>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)}
        placeholder={placeholder}
        style={{width:'100%',background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.12)',
          borderRadius:12,padding:'11px 14px',color:'rgba(255,255,255,.9)',fontFamily:SF,
          fontSize:15,outline:'none',WebkitAppearance:'none'}}/>
    </div>
  );
}

// ─── Primary button ─────────────────────────────────────────────
function PrimaryBtn({label,col=C.gold,onClick,disabled=false}:{
  label:string;col?:string;onClick:()=>void;disabled?:boolean;
}){
  return(
    <button onClick={onClick} disabled={disabled} style={{
      width:'100%',height:52,borderRadius:16,border:'none',
      background:disabled?'rgba(255,255,255,.1)':`linear-gradient(135deg,${col}dd,${col}88)`,
      color:disabled?'rgba(255,255,255,.3)':'#0a0a0c',cursor:disabled?'default':'pointer',
      fontFamily:SF,fontSize:15,fontWeight:700,letterSpacing:-0.1,
      WebkitTapHighlightColor:'transparent',transition:'all .2s',
    }}>{label}</button>
  );
}

// ─── Main component ─────────────────────────────────────────────
export function ControlPanel({devices,safetyEvents,latestReadings}:Props){
  const [cat,      setCat]      = useState('covers');
  const [device,   setDevice]   = useState<Device>(devices[0]);
  const [motors,   setMotors]   = useState<Motor[]>([]);
  const [scenarios,setScenarios]= useState<Scenario[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [time,     setTime]     = useState(new Date());

  // Sheet states
  const [motorSheet,  setMotorSheet]   = useState<{motor:Motor}|null>(null);
  const [addMotor,    setAddMotor]     = useState(false);
  const [editMotor,   setEditMotor]    = useState<Motor|null>(null);
  const [scenSheet,   setScenSheet]    = useState<{scen:Scenario}|null>(null);
  const [editScen,    setEditScen]     = useState<Scenario|null>(null);
  const [addScen,     setAddScen]      = useState(false);

  const [toast, setToast] = useState<{msg:string;ok:boolean}|null>(null);
  const supabase = createClient();

  const showToast=(msg:string,ok=true)=>{setToast({msg,ok});setTimeout(()=>setToast(null),3000);};

  // ── Clock ──────────────────────────────────────────────────
  useEffect(()=>{const i=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(i);},[]);

  // ── Load motors + scenarios ────────────────────────────────
  const loadData = useCallback(async()=>{
    setLoading(true);
    const[{data:mots},{data:scens}]=await Promise.all([
      supabase.from('motors').select('*').eq('device_id',device.device_id).order('slot_id'),
      supabase.from('scenarios').select('*, steps:scenario_steps(*)').eq('user_id',(await supabase.auth.getUser()).data.user?.id??'').order('sort_order'),
    ]);
    setMotors((mots??[]).map((m:Motor)=>({...m,moving:false,dir:'stop'})));
    setScenarios(scens??[]);
    setLoading(false);
  },[device.device_id,supabase]);

  useEffect(()=>{loadData();},[loadData]);

  // ── Send command ───────────────────────────────────────────
  const sendCmd=async(motor:Motor,action:string)=>{
    const cmd=action==='rts_up'?'rts_up':action==='rts_down'?'rts_down':action==='rts_my'?'rts_my':action;
    const{error}=await supabase.from('commands').insert({
      device_id:motor.device_id,action:cmd,target:motor.slot_id,status:'pending',
    });
    if(error){showToast('Komut gönderilemedi',false);return;}
    showToast('◈ Komut gönderildi');
    setMotors(p=>p.map(m=>m.id!==motor.id?m:{
      ...m,moving:action!=='rts_my',
      dir:action==='rts_up'?'up':action==='rts_down'?'down':'stop',
    }));
    if(motorSheet?.motor.id===motor.id){
      setMotorSheet(p=>p?{motor:{...p.motor,moving:action!=='rts_my',
        dir:action==='rts_up'?'up':action==='rts_down'?'down':'stop'}}:null);
    }
  };

  // ── Execute scenario ───────────────────────────────────────
  const runScenario=async(s:Scenario)=>{
    const{data,error}=await supabase.rpc('execute_scenario',{p_scenario_id:s.id});
    if(error){showToast('Senaryo çalıştırılamadı',false);return;}
    showToast(`✓ ${s.name} — ${(data as any)?.commands_sent} komut gönderildi`);
  };

  // ── Save motor ─────────────────────────────────────────────
  const saveMotor=async(form:{name:string;room:string;slot_id:number;protocol:'rf'|'relay';icon:string})=>{
    const uid=(await supabase.auth.getUser()).data.user?.id;
    const{error}=await supabase.from('motors').upsert({
      device_id:device.device_id,user_id:uid,
      slot_id:form.slot_id,name:form.name,room:form.room,
      protocol:form.protocol,icon:form.icon,current_pos:0,
    },{onConflict:'device_id,slot_id'});
    if(error){showToast('Kaydedilemedi',false);return;}
    showToast('Motor kaydedildi');
    setAddMotor(false);setEditMotor(null);
    loadData();
  };

  const deleteMotor=async(m:Motor)=>{
    if(!confirm(`"${m.name}" silinecek. Emin misiniz?`))return;
    await supabase.from('motors').delete().eq('id',m.id);
    setMotorSheet(null);setEditMotor(null);
    loadData();
  };

  // ── Save scenario ──────────────────────────────────────────
  const saveScenario=async(form:{name:string;icon:string;color:string},steps:ScenarioStep[],existingId?:string)=>{
    const uid=(await supabase.auth.getUser()).data.user?.id;
    let sid=existingId;
    if(sid){
      await supabase.from('scenarios').update({name:form.name,icon:form.icon,color:form.color}).eq('id',sid);
      await supabase.from('scenario_steps').delete().eq('scenario_id',sid);
    } else {
      const{data}=await supabase.from('scenarios').insert({user_id:uid,...form,sort_order:scenarios.length}).select().single();
      sid=data?.id;
    }
    if(!sid){showToast('Senaryo kaydedilemedi',false);return;}
    if(steps.length>0){
      await supabase.from('scenario_steps').insert(steps.map((s,i)=>({
        scenario_id:sid,motor_id:s.motor_id,action:s.action,
        target_pos:s.target_pos,step_order:i,
      })));
    }
    showToast('Senaryo kaydedildi');
    setAddScen(false);setEditScen(null);setScenSheet(null);
    loadData();
  };

  const deleteScenario=async(s:Scenario)=>{
    if(!confirm(`"${s.name}" silinecek?`))return;
    await supabase.from('scenarios').delete().eq('id',s.id);
    setScenSheet(null);setEditScen(null);
    loadData();
  };

  const hh=time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const dd=time.toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long'});
  const isOnline=device.last_seen&&(Date.now()-new Date(device.last_seen).getTime())<300_000;
  const catCol=CATS.find(c=>c.id===cat)?.col??C.gold;
  const alarms=safetyEvents.filter(e=>e.state==='alarm'||e.state==='warning');

  return(
    <div style={{minHeight:'100dvh',background:C.bg,fontFamily:SF,overflowX:'hidden',color:'rgba(255,255,255,.88)'}}>

      {/* Ambient blobs */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0}}>
        <div style={{position:'absolute',top:-150,left:-100,width:500,height:500,
          background:`radial-gradient(ellipse,${catCol}0d,transparent 65%)`,transition:'background .6s'}}/>
        <div style={{position:'absolute',bottom:80,right:-60,width:380,height:380,
          background:`radial-gradient(ellipse,${C.blue}0b,transparent 65%)`}}/>
      </div>

      <div style={{position:'relative',zIndex:1,paddingBottom:88}}>
        <div style={{height:'env(safe-area-inset-top,12px)'}}/>

        {/* ── Header ── */}
        <div style={{padding:'16px 20px 14px',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div style={{fontFamily:SF_R,fontSize:48,fontWeight:700,letterSpacing:-2,lineHeight:1,
              color:'rgba(255,255,255,.95)'}}>{hh}</div>
            <div style={{fontFamily:SF,fontSize:14,fontWeight:400,letterSpacing:-0.1,
              color:'rgba(255,255,255,.38)',marginTop:3}}>{dd}</div>
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:7,marginTop:4}}>
            {devices.length>1&&(
              <select value={device.device_id}
                onChange={e=>setDevice(devices.find(d=>d.device_id===e.target.value)??devices[0])}
                style={{background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.12)',
                  borderRadius:10,padding:'5px 10px',color:'rgba(255,255,255,.8)',
                  fontFamily:SF,fontSize:12,cursor:'pointer',outline:'none'}}>
                {devices.map(d=><option key={d.device_id} value={d.device_id}>{d.name||d.device_id}</option>)}
              </select>
            )}
            <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:20,
              background:isOnline?`${C.green}18`:`${C.red}18`,
              border:`1px solid ${isOnline?C.green+'40':C.red+'40'}`}}>
              <div style={{width:5,height:5,borderRadius:'50%',
                background:isOnline?C.green:C.red,boxShadow:`0 0 6px ${isOnline?C.green:C.red}`}}/>
              <span style={{fontFamily:SF,fontSize:10,fontWeight:700,letterSpacing:.4,
                color:isOnline?C.green:C.red}}>
                {device.name||device.device_id} · {isOnline?'ÇEVRIMIÇI':'ÇEVRİMDIŞI'}
              </span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:20,
              background:`${C.blue}18`,border:`1px solid ${C.blue}40`}}>
              <div style={{width:5,height:5,borderRadius:'50%',background:C.blue,boxShadow:`0 0 6px ${C.blue}`}}/>
              <span style={{fontFamily:SF,fontSize:10,fontWeight:700,letterSpacing:.4,color:C.blue}}>◈ BULUT</span>
            </div>
            {alarms.length>0&&(
              <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:20,
                background:`${C.red}22`,border:`1px solid ${C.red}55`}}>
                <div style={{width:5,height:5,borderRadius:'50%',background:C.red,boxShadow:`0 0 8px ${C.red}`,animation:'pulse 1.1s infinite'}}/>
                <span style={{fontFamily:SF,fontSize:10,fontWeight:700,letterSpacing:.4,color:C.red}}>{alarms.length} ALARM</span>
              </div>
            )}
          </div>
        </div>

        {/* Toast */}
        {toast&&(
          <div style={{margin:'0 20px 12px',padding:'9px 14px',borderRadius:12,
            background:toast.ok?`${C.blue}18`:`${C.red}18`,
            border:`1px solid ${toast.ok?C.blue+'40':C.red+'40'}`,
            fontFamily:SF,fontSize:13,fontWeight:500,color:toast.ok?C.blue:C.red}}>
            {toast.msg}
          </div>
        )}

        {/* ── Category tabs ── */}
        <div style={{display:'flex',gap:0,overflowX:'auto',padding:'0 16px',marginBottom:20,scrollbarWidth:'none'}}>
          {CATS.map(c=>(
            <button key={c.id} onClick={()=>setCat(c.id)} style={{
              display:'flex',flexDirection:'column',alignItems:'center',gap:4,
              padding:'8px 14px',border:'none',background:'transparent',cursor:'pointer',
              flexShrink:0,position:'relative',WebkitTapHighlightColor:'transparent'}}>
              <div style={{width:44,height:44,borderRadius:14,fontSize:cat===c.id?20:18,
                background:cat===c.id?`${c.col}30`:'rgba(255,255,255,.06)',
                border:`1.5px solid ${cat===c.id?c.col+'66':'rgba(255,255,255,.08)'}`,
                display:'flex',alignItems:'center',justifyContent:'center',
                boxShadow:cat===c.id?`0 0 20px ${c.col}44`:'none',transition:'all .25s',
                filter:cat===c.id?`drop-shadow(0 0 6px ${c.col}88)`:'none'}}>
                {c.icon}
              </div>
              <span style={{fontFamily:SF,fontSize:10,fontWeight:cat===c.id?700:500,letterSpacing:.2,
                color:cat===c.id?c.col:'rgba(255,255,255,.35)',whiteSpace:'nowrap'}}>
                {c.label}
              </span>
              {cat===c.id&&<div style={{position:'absolute',bottom:0,left:'50%',transform:'translateX(-50%)',
                width:20,height:2,borderRadius:1,background:c.col,boxShadow:`0 0 6px ${c.col}`}}/>}
            </button>
          ))}
        </div>

        {/* ═══════════════ PERDELER ═══════════════ */}
        {cat==='covers'&&(
          <div>
            {loading?<div style={{textAlign:'center',padding:40,color:'rgba(255,255,255,.3)'}}>Yükleniyor…</div>:(
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:'0 20px',marginBottom:16}}>
                {motors.map(m=>(
                  <button key={m.id} onClick={()=>setMotorSheet({motor:m})} style={{
                    background:m.current_pos>0?`linear-gradient(145deg,${C.gold}20,${C.gold}07)`:C.card,
                    border:`1px solid ${m.current_pos>0?C.gold+'40':C.border}`,
                    borderRadius:20,padding:'16px 14px',cursor:'pointer',textAlign:'left',
                    position:'relative',overflow:'hidden',color:'white',
                    boxShadow:m.moving?`0 0 28px ${C.gold}22,0 4px 16px rgba(0,0,0,.4)`:'0 2px 8px rgba(0,0,0,.25)',
                    transition:'all .25s',WebkitTapHighlightColor:'transparent'}}>
                    {/* position fill */}
                    <div style={{position:'absolute',left:0,bottom:0,width:'100%',height:`${m.current_pos}%`,
                      background:`linear-gradient(to top,${C.gold}${m.moving?'3a':'18'},transparent)`,
                      transition:'height .7s cubic-bezier(.4,0,.2,1)',pointerEvents:'none',borderRadius:'0 0 20px 20px'}}/>
                    {m.moving&&<div style={{position:'absolute',left:0,bottom:`${m.current_pos-1}%`,
                      width:'100%',height:1,background:`linear-gradient(90deg,transparent,${C.gold}cc,transparent)`,
                      animation:'shimmer 1.8s linear infinite',pointerEvents:'none'}}/>}
                    <div style={{position:'absolute',top:13,right:13,width:7,height:7,borderRadius:'50%',
                      background:m.moving?C.gold:m.current_pos>0?`${C.gold}88`:'rgba(255,255,255,.15)',
                      boxShadow:m.moving?`0 0 10px ${C.gold}`:'none',
                      animation:m.moving?'pulse 1.1s infinite':'none'}}/>
                    <div style={{fontSize:22,marginBottom:8,lineHeight:1,position:'relative',
                      filter:m.current_pos>0?`drop-shadow(0 0 6px ${C.gold}88)`:'none'}}>{m.icon}</div>
                    <div style={{fontFamily:SF,fontSize:14,fontWeight:600,letterSpacing:-0.1,
                      color:'rgba(255,255,255,.9)',marginBottom:2,lineHeight:1.2,position:'relative'}}>
                      {m.name}</div>
                    <div style={{fontFamily:SF,fontSize:11,color:'rgba(255,255,255,.35)',
                      marginBottom:4,position:'relative'}}>{m.room}</div>
                    <div style={{fontFamily:SF_MONO,fontSize:20,fontWeight:700,letterSpacing:-0.8,
                      color:m.moving?C.gold:m.current_pos>0?`${C.gold}cc`:'rgba(255,255,255,.3)',
                      transition:'color .3s',position:'relative'}}>{m.current_pos}%</div>
                  </button>
                ))}
                {/* Add motor tile */}
                <button onClick={()=>setAddMotor(true)} style={{
                  background:'rgba(255,255,255,.03)',
                  border:`1.5px dashed rgba(255,255,255,.15)`,
                  borderRadius:20,padding:'16px 14px',cursor:'pointer',textAlign:'left',
                  color:'rgba(255,255,255,.35)',display:'flex',flexDirection:'column',
                  alignItems:'center',justifyContent:'center',gap:8,minHeight:130,
                  WebkitTapHighlightColor:'transparent',transition:'all .2s'}}
                  onPointerDown={e=>(e.currentTarget as HTMLButtonElement).style.borderColor='rgba(201,150,59,.4)'}
                  onPointerUp={e=>(e.currentTarget as HTMLButtonElement).style.borderColor='rgba(255,255,255,.15)'}>
                  <span style={{fontSize:24}}>＋</span>
                  <span style={{fontFamily:SF,fontSize:12,fontWeight:600,letterSpacing:.2}}>Motor Ekle</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ SENARYOLAR ═══════════════ */}
        {cat==='scenarios'&&(
          <div style={{padding:'0 20px'}}>
            {loading?<div style={{textAlign:'center',padding:40,color:'rgba(255,255,255,.3)'}}>Yükleniyor…</div>:(
              <>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                  {scenarios.map(s=>(
                    <button key={s.id} onClick={()=>setScenSheet({scen:s})} style={{
                      background:`linear-gradient(145deg,${s.color}22,${s.color}08)`,
                      border:`1px solid ${s.color}44`,borderRadius:20,padding:'18px 16px',
                      cursor:'pointer',textAlign:'left',color:'white',
                      boxShadow:`0 4px 16px rgba(0,0,0,.3)`,WebkitTapHighlightColor:'transparent',
                      transition:'all .2s',position:'relative'}}
                      onPointerDown={e=>(e.currentTarget as HTMLButtonElement).style.transform='scale(.96)'}
                      onPointerUp={e=>(e.currentTarget as HTMLButtonElement).style.transform='scale(1)'}>
                      <div style={{fontSize:28,marginBottom:10,filter:`drop-shadow(0 0 8px ${s.color}88)`}}>
                        {s.icon}</div>
                      <div style={{fontFamily:SF,fontSize:15,fontWeight:700,letterSpacing:-0.1,
                        color:'rgba(255,255,255,.95)',marginBottom:4}}>{s.name}</div>
                      <div style={{fontFamily:SF,fontSize:11,color:'rgba(255,255,255,.4)'}}>
                        {(s.steps?.length??0)} adım</div>
                    </button>
                  ))}
                  {/* Add scenario tile */}
                  <button onClick={()=>setAddScen(true)} style={{
                    background:'rgba(255,255,255,.03)',
                    border:`1.5px dashed rgba(255,255,255,.15)`,
                    borderRadius:20,padding:'18px 16px',cursor:'pointer',textAlign:'left',
                    color:'rgba(255,255,255,.35)',display:'flex',flexDirection:'column',
                    alignItems:'center',justifyContent:'center',gap:8,minHeight:130,
                    WebkitTapHighlightColor:'transparent',transition:'all .2s'}}
                    onPointerDown={e=>(e.currentTarget as HTMLButtonElement).style.borderColor=`${C.green}40`}
                    onPointerUp={e=>(e.currentTarget as HTMLButtonElement).style.borderColor='rgba(255,255,255,.15)'}>
                    <span style={{fontSize:24}}>＋</span>
                    <span style={{fontFamily:SF,fontSize:12,fontWeight:600,letterSpacing:.2}}>Senaryo Ekle</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════════ SENSÖRLER ═══════════════ */}
        {cat==='sensors'&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:'0 20px'}}>
            {[{ch:'temp',icon:'🌡',lbl:'SICAKLIK',unit:'°C'},
              {ch:'humidity',icon:'💧',lbl:'NEM',unit:'%'},
              {ch:'lux',icon:'☀️',lbl:'IŞIK',unit:' lx'},
              {ch:'gas',icon:'⚗️',lbl:'GAZ',unit:' %'},
              {ch:'water',icon:'💧',lbl:'SU',unit:''},
              {ch:'rain',icon:'🌧',lbl:'YAĞMUR',unit:''},
            ].map(({ch,icon,lbl,unit})=>{
              const val=latestReadings[ch];const has=val!==undefined;
              return(
                <div key={ch} style={{background:C.card,border:`1px solid ${has?C.blue+'30':C.border}`,
                  borderRadius:20,padding:'18px 16px'}}>
                  <div style={{fontSize:26,marginBottom:10}}>{icon}</div>
                  <div style={{fontFamily:SF_MONO,fontSize:26,fontWeight:700,letterSpacing:-0.8,lineHeight:1,
                    color:has?C.blue:'rgba(255,255,255,.3)',marginBottom:6}}>
                    {has?val.toFixed(1):'—'}<span style={{fontSize:13,fontWeight:400,opacity:.6}}>{unit}</span>
                  </div>
                  <div style={{fontFamily:SF,fontSize:11,fontWeight:600,letterSpacing:.4,
                    textTransform:'uppercase',color:'rgba(255,255,255,.35)'}}>{lbl}</div>
                  {!has&&<div style={{fontFamily:SF,fontSize:10,color:'rgba(255,255,255,.2)',marginTop:4}}>Veri bekleniyor</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════════════ GÜVENLİK ═══════════════ */}
        {cat==='safety'&&(
          <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:10}}>
            {safetyEvents.length===0?(
              <div style={{background:`${C.green}12`,border:`1px solid ${C.green}30`,
                borderRadius:20,padding:'32px 20px',textAlign:'center'}}>
                <div style={{fontSize:36,marginBottom:12}}>✅</div>
                <div style={{fontFamily:SF,fontSize:16,fontWeight:600,color:C.green}}>Tüm sistemler normal</div>
              </div>
            ):safetyEvents.map(ev=>{
              const alarm=ev.state==='alarm';const col=alarm?C.red:ev.state==='warning'?C.orange:C.green;
              return(
                <div key={ev.id} style={{background:`${col}12`,border:`1px solid ${col}35`,
                  borderRadius:18,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,
                  animation:alarm?'pulseRed 1.5s infinite':'none'}}>
                  <div style={{fontSize:24}}>
                    {ev.alarm_type===1?'🔥':ev.alarm_type===2?'⚠️':ev.alarm_type===3?'💧':'🚨'}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:SF,fontSize:15,fontWeight:600,color:col,marginBottom:2}}>
                      {ev.alarm_type_name||`Alarm #${ev.alarm_type}`}</div>
                    <div style={{fontFamily:SF,fontSize:12,color:'rgba(255,255,255,.45)'}}>
                      {new Date(ev.ts).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}
                      {ev.value!=null?` · ${ev.value.toFixed(2)}`:''}
                    </div>
                  </div>
                  <div style={{fontFamily:SF,fontSize:10,fontWeight:700,letterSpacing:.4,color:col}}>
                    {ev.state.toUpperCase()}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ MOTOR CONTROL SHEET ═══ */}
      {motorSheet&&(
        <MotorControlSheet
          motor={motorSheet.motor}
          onClose={()=>setMotorSheet(null)}
          onCmd={sendCmd}
          onEdit={()=>{setEditMotor(motorSheet.motor);setMotorSheet(null);}}
          onDelete={()=>deleteMotor(motorSheet.motor)}
        />
      )}

      {/* ═══ ADD / EDIT MOTOR SHEET ═══ */}
      {(addMotor||editMotor)&&(
        <MotorFormSheet
          initial={editMotor??undefined}
          usedSlots={motors.filter(m=>m.id!==editMotor?.id).map(m=>m.slot_id)}
          onClose={()=>{setAddMotor(false);setEditMotor(null);}}
          onSave={saveMotor}
          onDelete={editMotor?()=>deleteMotor(editMotor):undefined}
        />
      )}

      {/* ═══ SCENARIO DETAIL SHEET ═══ */}
      {scenSheet&&!editScen&&(
        <ScenarioDetailSheet
          scen={scenSheet.scen}
          motors={motors}
          onClose={()=>setScenSheet(null)}
          onRun={runScenario}
          onEdit={()=>{setEditScen(scenSheet.scen);setScenSheet(null);}}
          onDelete={()=>deleteScenario(scenSheet.scen)}
        />
      )}

      {/* ═══ ADD / EDIT SCENARIO SHEET ═══ */}
      {(addScen||editScen)&&(
        <ScenarioFormSheet
          initial={editScen??undefined}
          motors={motors}
          onClose={()=>{setAddScen(false);setEditScen(null);}}
          onSave={saveScenario}
        />
      )}

      {/* ── Bottom tab bar ── */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:50,
        background:'rgba(14,14,18,.93)',backdropFilter:'blur(20px)',
        WebkitBackdropFilter:'blur(20px)',borderTop:'1px solid rgba(255,255,255,.08)',
        display:'flex',paddingBottom:'env(safe-area-inset-bottom,4px)'}}>
        {CATS.map(c=>(
          <button key={c.id} onClick={()=>setCat(c.id)} style={{
            flex:1,padding:'10px 0 8px',border:'none',background:'transparent',cursor:'pointer',
            display:'flex',flexDirection:'column',alignItems:'center',gap:3,
            WebkitTapHighlightColor:'transparent'}}>
            <span style={{fontSize:cat===c.id?22:20,lineHeight:1,
              color:cat===c.id?c.col:'rgba(255,255,255,.3)',
              filter:cat===c.id?`drop-shadow(0 0 6px ${c.col}99)`:'none',
              transition:'all .2s'}}>{c.icon}</span>
            <span style={{fontFamily:SF,fontSize:10,fontWeight:cat===c.id?600:400,
              letterSpacing:.2,color:cat===c.id?c.col:'rgba(255,255,255,.3)'}}>{c.label}</span>
          </button>
        ))}
      </div>

      <style>{`
        *{box-sizing:border-box;-webkit-font-smoothing:antialiased;}
        ::-webkit-scrollbar{display:none;}
        input,select{appearance:none;-webkit-appearance:none;}
        input[type="range"]{outline:none;border:none;height:32px;background:transparent;}
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

// ═══════════════════════════════════════════════════════════════
// MOTOR CONTROL SHEET — arc dial + commands
// ═══════════════════════════════════════════════════════════════
function MotorControlSheet({motor,onClose,onCmd,onEdit,onDelete}:{
  motor:Motor;onClose:()=>void;
  onCmd:(m:Motor,action:string)=>void;
  onEdit:()=>void;onDelete:()=>void;
}){
  const [pos,setPos]=useState(motor.current_pos);
  const[C_]=useState(C);

  return(
    <Sheet onClose={onClose}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'4px 24px 0',marginBottom:4}}>
        <div>
          <div style={{fontFamily:'-apple-system,sans-serif',fontSize:22,fontWeight:700,letterSpacing:-0.4,
            color:'rgba(255,255,255,.95)'}}>{motor.name}</div>
          <div style={{fontFamily:'-apple-system,sans-serif',fontSize:13,color:'rgba(255,255,255,.38)',marginTop:3}}>
            {motor.room} · {motor.protocol==='rf'?'RF 433':'Röle'}
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={onEdit} style={{background:'rgba(255,255,255,.08)',border:'none',borderRadius:10,
            padding:'6px 12px',color:'rgba(255,255,255,.6)',cursor:'pointer',fontFamily:'-apple-system,sans-serif',
            fontSize:12,fontWeight:600}}>Düzenle</button>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:16,background:'rgba(255,255,255,.1)',
            border:'none',color:'rgba(255,255,255,.6)',cursor:'pointer',fontSize:14,
            display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
        </div>
      </div>

      {/* Cloud delay notice */}
      <div style={{margin:'8px 24px 0',background:`rgba(14,165,233,.1)`,
        border:'1px solid rgba(14,165,233,.25)',borderRadius:12,padding:'7px 12px'}}>
        <span style={{fontFamily:'-apple-system,sans-serif',fontSize:12,fontWeight:500,
          color:'rgba(14,165,233,.85)'}}>◈ Bulut üzerinden · Komut cihaza ~1-3 saniyede ulaşır</span>
      </div>

      {/* Arc dial */}
      <div style={{display:'flex',justifyContent:'center',padding:'8px 0 0',marginBottom:-8}}>
        <svg width={160} height={136} viewBox="0 0 160 136" style={{overflow:'visible'}}>
          <path d={arcPath(80,90,64,-210,30)} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={5} strokeLinecap="round"/>
          {pos>0&&<path d={arcPath(80,90,64,-210,-210+(pos/100)*240)} fill="none"
            stroke={motor.moving?C.gold:'rgba(201,150,59,.75)'} strokeWidth={5} strokeLinecap="round"
            style={{filter:motor.moving?`drop-shadow(0 0 5px ${C.gold})`:'none'}}/>}
          <text x={80} y={84} textAnchor="middle" fontFamily={SF_R}
            fontSize={36} fontWeight={700} letterSpacing={-1.5}
            fill={motor.moving?C.gold:'rgba(255,255,255,.88)'}>{pos}</text>
          <text x={80} y={104} textAnchor="middle" fontFamily={SF}
            fontSize={11} fontWeight={600} letterSpacing={.4} fill="rgba(255,255,255,.28)">
            YÜZDE</text>
        </svg>
      </div>

      {/* Slider */}
      <div style={{padding:'0 28px 8px'}}>
        <input type="range" min={0} max={100} value={pos}
          onChange={e=>setPos(+e.target.value)} style={{width:'100%'}}/>
      </div>

      {/* AÇ / DUR / KAPAT */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,padding:'0 24px 20px'}}>
        {([['↑','AÇ','rts_up',C.gold],['■','DUR','rts_my','rgba(255,255,255,.45)'],['↓','KAPAT','rts_down',C.blue]] as[string,string,string,string][]).map(([ic,lbl,cmd,col])=>(
          <button key={cmd} onClick={()=>onCmd(motor,cmd)} style={{
            height:64,borderRadius:16,border:'none',background:`${col}1a`,color:col,cursor:'pointer',
            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,
            fontFamily:'-apple-system,sans-serif',WebkitTapHighlightColor:'transparent',transition:'background .15s'}}
            onPointerDown={e=>(e.currentTarget as HTMLButtonElement).style.background=`${col}33`}
            onPointerUp={e=>(e.currentTarget as HTMLButtonElement).style.background=`${col}1a`}>
            <span style={{fontSize:22,lineHeight:1}}>{ic}</span>
            <span style={{fontSize:10,fontWeight:700,letterSpacing:.5}}>{lbl}</span>
          </button>
        ))}
      </div>

      {/* Info strip */}
      <div style={{margin:'0 24px 16px',background:'rgba(255,255,255,.04)',borderRadius:14,
        padding:'12px 16px',display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
        {[['DURUM',motor.moving?'Hareket':motor.current_pos===0?'Kapalı':motor.current_pos===100?'Açık':'Kısmi'],
          ['POZİSYON',`${pos}%`],['PROTOKOL',motor.protocol==='rf'?'RF 433':'Röle']].map(([k,v])=>(
          <div key={k} style={{textAlign:'center'}}>
            <div style={{fontFamily:'"SF Mono","Menlo","Monaco","Consolas",monospace',
              fontSize:14,fontWeight:700,letterSpacing:-0.3,color:'rgba(255,255,255,.82)',marginBottom:3}}>{v}</div>
            <div style={{fontFamily:'-apple-system,sans-serif',fontSize:10,fontWeight:600,letterSpacing:.4,
              textTransform:'uppercase',color:'rgba(255,255,255,.3)'}}>{k}</div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════
// MOTOR FORM SHEET — add / edit a motor
// ═══════════════════════════════════════════════════════════════
function MotorFormSheet({initial,usedSlots,onClose,onSave,onDelete}:{
  initial?:Motor;usedSlots:number[];
  onClose:()=>void;
  onSave:(form:{name:string;room:string;slot_id:number;protocol:'rf'|'relay';icon:string})=>void;
  onDelete?:()=>void;
}){
  const[name,setName]=useState(initial?.name??'');
  const[room,setRoom]=useState(initial?.room??'Teras');
  const[slot,setSlot]=useState(initial?.slot_id??0);
  const[proto,setProto]=useState<'rf'|'relay'>(initial?.protocol??'rf');
  const[icon,setIcon]=useState(initial?.icon??'🪟');

  return(
    <Sheet onClose={onClose}>
      <div style={{padding:'4px 24px 24px'}}>
        <div style={{fontFamily:'-apple-system,sans-serif',fontSize:20,fontWeight:700,letterSpacing:-0.3,
          color:'rgba(255,255,255,.95)',marginBottom:20}}>
          {initial?'Motor Düzenle':'Motor Ekle'}</div>

        {/* Icon picker */}
        <div style={{marginBottom:16}}>
          <div style={{fontFamily:'-apple-system,sans-serif',fontSize:11,fontWeight:600,letterSpacing:.4,
            textTransform:'uppercase',color:'rgba(255,255,255,.4)',marginBottom:8}}>İKON</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {MOTOR_ICONS.map(ic=>(
              <button key={ic} onClick={()=>setIcon(ic)} style={{
                width:40,height:40,borderRadius:10,fontSize:20,border:'none',cursor:'pointer',
                background:icon===ic?`${C.gold}30`:'rgba(255,255,255,.07)',
                border_: `1px solid ${icon===ic?C.gold+'55':'rgba(255,255,255,.08)'}`,
              }}>{ic}</button>
            ))}
          </div>
        </div>

        <Input label="Motor Adı" value={name} onChange={setName} placeholder="ör. Pergola, Balkon Jaluzi…"/>

        {/* Room selector */}
        <div style={{marginBottom:14}}>
          <div style={{fontFamily:'-apple-system,sans-serif',fontSize:11,fontWeight:600,letterSpacing:.4,
            textTransform:'uppercase',color:'rgba(255,255,255,.4)',marginBottom:6}}>ODA</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {ROOMS.map(r=>(
              <button key={r} onClick={()=>setRoom(r)} style={{
                padding:'6px 12px',borderRadius:12,border:'none',cursor:'pointer',
                background:room===r?`${C.gold}30`:'rgba(255,255,255,.07)',
                color:room===r?C.gold:'rgba(255,255,255,.55)',
                fontFamily:'-apple-system,sans-serif',fontSize:13,fontWeight:room===r?700:500,
                WebkitTapHighlightColor:'transparent'}}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Slot selector */}
        <div style={{marginBottom:14}}>
          <div style={{fontFamily:'-apple-system,sans-serif',fontSize:11,fontWeight:600,letterSpacing:.4,
            textTransform:'uppercase',color:'rgba(255,255,255,.4)',marginBottom:6}}>
            SLOT (ESP32 Motor Numarası)
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {Array.from({length:8},(_,i)=>i).map(i=>{
              const used=usedSlots.includes(i);
              return(
                <button key={i} onClick={()=>!used&&setSlot(i)} style={{
                  width:40,height:40,borderRadius:10,border:'none',cursor:used?'default':'pointer',
                  background:slot===i?`${C.gold}30`:used?'rgba(255,255,255,.04)':'rgba(255,255,255,.07)',
                  color:slot===i?C.gold:used?'rgba(255,255,255,.2)':'rgba(255,255,255,.6)',
                  fontFamily:'"SF Mono","Menlo",monospace',fontSize:14,fontWeight:700,
                  textDecoration:used&&slot!==i?'line-through':'none',
                  WebkitTapHighlightColor:'transparent'}}>{i}</button>
              );
            })}
          </div>
          <div style={{fontFamily:'-apple-system,sans-serif',fontSize:11,color:'rgba(255,255,255,.3)',marginTop:6}}>
            Seçili: Slot {slot} · Firmware'deki motor/RTS indeksiyle eşleşmeli</div>
        </div>

        {/* Protocol */}
        <div style={{marginBottom:20}}>
          <div style={{fontFamily:'-apple-system,sans-serif',fontSize:11,fontWeight:600,letterSpacing:.4,
            textTransform:'uppercase',color:'rgba(255,255,255,.4)',marginBottom:8}}>PROTOKOL</div>
          <div style={{display:'flex',gap:10}}>
            {([['rf','RF 433 (Radyo Frekans)','📡'],['relay','Röle (Direkt Kablo)','🔌']] as [string,string,string][]).map(([p,lbl,ic])=>(
              <button key={p} onClick={()=>setProto(p as 'rf'|'relay')} style={{
                flex:1,padding:'12px 10px',borderRadius:14,border:'none',cursor:'pointer',
                background:proto===p?`${C.gold}22`:'rgba(255,255,255,.05)',
                border_:`1px solid ${proto===p?C.gold+'44':'rgba(255,255,255,.08)'}`,
                color:proto===p?C.gold:'rgba(255,255,255,.5)',
                fontFamily:'-apple-system,sans-serif',fontSize:13,fontWeight:proto===p?700:400,
                WebkitTapHighlightColor:'transparent',textAlign:'center' as const}}>
                <div style={{fontSize:20,marginBottom:4}}>{ic}</div>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <PrimaryBtn label={initial?'Güncelle':'Motor Ekle'} disabled={!name.trim()}
          onClick={()=>saveMotor({name:name.trim(),room,slot_id:slot,protocol:proto,icon})}/>

        {onDelete&&(
          <button onClick={onDelete} style={{width:'100%',height:46,marginTop:10,borderRadius:14,
            border:'none',background:'rgba(255,59,48,.12)',color:C.red,cursor:'pointer',
            fontFamily:'-apple-system,sans-serif',fontSize:14,fontWeight:600}}>
            Motoru Sil
          </button>
        )}
      </div>
    </Sheet>
  );

  function saveMotor(form:{name:string;room:string;slot_id:number;protocol:'rf'|'relay';icon:string}){
    if(!form.name)return;
    onSave(form);
  }
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO DETAIL SHEET — view steps + run
// ═══════════════════════════════════════════════════════════════
function ScenarioDetailSheet({scen,motors,onClose,onRun,onEdit,onDelete}:{
  scen:Scenario;motors:Motor[];onClose:()=>void;
  onRun:(s:Scenario)=>void;onEdit:()=>void;onDelete:()=>void;
}){
  const getMotor=(id:string)=>motors.find(m=>m.id===id);
  const ACTION_LABEL:Record<string,string>={open:'Aç',close:'Kapat',stop:'Dur',position:'Pozisyon'};

  return(
    <Sheet onClose={onClose}>
      <div style={{padding:'4px 24px 24px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:32,filter:`drop-shadow(0 0 10px ${scen.color}88)`}}>{scen.icon}</span>
            <div>
              <div style={{fontFamily:'-apple-system,sans-serif',fontSize:20,fontWeight:700,letterSpacing:-0.3,
                color:'rgba(255,255,255,.95)'}}>{scen.name}</div>
              <div style={{fontFamily:'-apple-system,sans-serif',fontSize:12,color:'rgba(255,255,255,.35)',marginTop:2}}>
                {scen.steps?.length??0} adım</div>
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={onEdit} style={{background:'rgba(255,255,255,.08)',border:'none',
              borderRadius:10,padding:'6px 12px',color:'rgba(255,255,255,.6)',cursor:'pointer',
              fontFamily:'-apple-system,sans-serif',fontSize:12,fontWeight:600}}>Düzenle</button>
            <button onClick={onClose} style={{width:32,height:32,borderRadius:16,
              background:'rgba(255,255,255,.1)',border:'none',color:'rgba(255,255,255,.6)',
              cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>✕</button>
          </div>
        </div>

        {/* Steps */}
        {(scen.steps?.length??0)>0?(
          <div style={{marginBottom:20}}>
            <div style={{fontFamily:'-apple-system,sans-serif',fontSize:11,fontWeight:600,letterSpacing:.4,
              textTransform:'uppercase',color:'rgba(255,255,255,.3)',marginBottom:10}}>ADIMLAR</div>
            {scen.steps?.sort((a,b)=>a.step_order-b.step_order).map((step,i)=>{
              const motor=getMotor(step.motor_id);
              return(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,
                  background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)',
                  borderRadius:12,padding:'10px 14px',marginBottom:8}}>
                  <span style={{fontFamily:'"SF Mono","Menlo",monospace',fontSize:13,
                    fontWeight:700,color:scen.color,minWidth:20}}>{i+1}</span>
                  <span style={{fontSize:18}}>{motor?.icon??'🪟'}</span>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:'-apple-system,sans-serif',fontSize:14,fontWeight:600,
                      color:'rgba(255,255,255,.85)'}}>{motor?.name??'—'}</div>
                    <div style={{fontFamily:'-apple-system,sans-serif',fontSize:12,color:'rgba(255,255,255,.4)'}}>
                      {ACTION_LABEL[step.action]}
                      {step.action==='position'?` %${step.target_pos}`:''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ):(
          <div style={{textAlign:'center',padding:'20px 0 16px',color:'rgba(255,255,255,.3)',
            fontFamily:'-apple-system,sans-serif',fontSize:14}}>
            Henüz adım eklenmemiş · "Düzenle"ye bas
          </div>
        )}

        <PrimaryBtn label={`${scen.icon} ${scen.name} Çalıştır`} col={scen.color}
          onClick={()=>{onRun(scen);onClose();}}/>
        <button onClick={onDelete} style={{width:'100%',height:44,marginTop:10,borderRadius:14,
          border:'none',background:'rgba(255,59,48,.1)',color:C.red,cursor:'pointer',
          fontFamily:'-apple-system,sans-serif',fontSize:14,fontWeight:600}}>
          Senaryoyu Sil
        </button>
      </div>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO FORM SHEET — create / edit with step builder
// ═══════════════════════════════════════════════════════════════
function ScenarioFormSheet({initial,motors,onClose,onSave}:{
  initial?:Scenario;motors:Motor[];onClose:()=>void;
  onSave:(form:{name:string;icon:string;color:string},steps:ScenarioStep[],id?:string)=>void;
}){
  const[name,  setName]  = useState(initial?.name??'');
  const[icon,  setIcon]  = useState(initial?.icon??'🌅');
  const[color, setColor] = useState(initial?.color??C.gold);
  const[steps, setSteps] = useState<ScenarioStep[]>(
    (initial?.steps??[]).sort((a,b)=>a.step_order-b.step_order)
  );
  const ACTION_OPTS:[string,string][]=[['open','Aç'],['close','Kapat'],['stop','Dur'],['position','Pozisyon']];

  const addStep=()=>{
    if(!motors.length)return;
    setSteps(p=>[...p,{motor_id:motors[0].id,action:'open',step_order:p.length}]);
  };
  const updateStep=(i:number,patch:Partial<ScenarioStep>)=>{
    setSteps(p=>p.map((s,j)=>j===i?{...s,...patch}:s));
  };
  const removeStep=(i:number)=>setSteps(p=>p.filter((_,j)=>j!==i));

  return(
    <Sheet onClose={onClose}>
      <div style={{padding:'4px 24px 24px'}}>
        <div style={{fontFamily:'-apple-system,sans-serif',fontSize:20,fontWeight:700,letterSpacing:-0.3,
          color:'rgba(255,255,255,.95)',marginBottom:20}}>
          {initial?'Senaryo Düzenle':'Senaryo Oluştur'}</div>

        {/* Icon picker */}
        <div style={{marginBottom:14}}>
          <div style={{fontFamily:'-apple-system,sans-serif',fontSize:11,fontWeight:600,letterSpacing:.4,
            textTransform:'uppercase',color:'rgba(255,255,255,.4)',marginBottom:8}}>İKON</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {SCENE_ICONS.map(ic=>(
              <button key={ic} onClick={()=>setIcon(ic)} style={{
                width:40,height:40,borderRadius:10,fontSize:20,border:'none',cursor:'pointer',
                background:icon===ic?`${color}30`:'rgba(255,255,255,.07)'}}>
                {ic}
              </button>
            ))}
          </div>
        </div>

        {/* Color picker */}
        <div style={{marginBottom:14}}>
          <div style={{fontFamily:'-apple-system,sans-serif',fontSize:11,fontWeight:600,letterSpacing:.4,
            textTransform:'uppercase',color:'rgba(255,255,255,.4)',marginBottom:8}}>RENK</div>
          <div style={{display:'flex',gap:8}}>
            {SCENE_COLORS.map(col=>(
              <button key={col} onClick={()=>setColor(col)} style={{
                width:30,height:30,borderRadius:'50%',border:color===col?`2px solid white`:'2px solid transparent',
                background:col,cursor:'pointer'}}>
              </button>
            ))}
          </div>
        </div>

        <Input label="Senaryo Adı" value={name} onChange={setName} placeholder="ör. Sabah, Gece, Fırtına…"/>

        {/* Step builder */}
        <div style={{marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div style={{fontFamily:'-apple-system,sans-serif',fontSize:11,fontWeight:600,letterSpacing:.4,
              textTransform:'uppercase',color:'rgba(255,255,255,.4)'}}>ADIMLAR</div>
            <button onClick={addStep} style={{
              padding:'5px 12px',borderRadius:10,border:'none',cursor:'pointer',
              background:`${color}22`,color:color,fontFamily:'-apple-system,sans-serif',
              fontSize:12,fontWeight:700}}>+ Adım Ekle</button>
          </div>

          {steps.length===0&&(
            <div style={{textAlign:'center',padding:'16px 0',
              fontFamily:'-apple-system,sans-serif',fontSize:13,color:'rgba(255,255,255,.3)'}}>
              Henüz adım yok · "Adım Ekle" butonuna bas
            </div>
          )}

          {steps.map((step,i)=>{
            const motor=motors.find(m=>m.id===step.motor_id);
            return(
              <div key={i} style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',
                borderRadius:14,padding:'12px 14px',marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <span style={{fontFamily:'"SF Mono","Menlo",monospace',fontSize:12,fontWeight:700,color:color}}>
                    ADİM {i+1}</span>
                  <button onClick={()=>removeStep(i)} style={{background:'none',border:'none',
                    color:'rgba(255,59,48,.7)',cursor:'pointer',fontSize:16}}>✕</button>
                </div>
                {/* Motor selector */}
                <div style={{marginBottom:8}}>
                  <div style={{fontFamily:'-apple-system,sans-serif',fontSize:10,fontWeight:600,letterSpacing:.3,
                    textTransform:'uppercase',color:'rgba(255,255,255,.3)',marginBottom:5}}>MOTOR</div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {motors.map(m=>(
                      <button key={m.id} onClick={()=>updateStep(i,{motor_id:m.id})} style={{
                        display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:10,
                        border:'none',cursor:'pointer',
                        background:step.motor_id===m.id?`${color}22`:'rgba(255,255,255,.07)',
                        color:step.motor_id===m.id?color:'rgba(255,255,255,.6)',
                        fontFamily:'-apple-system,sans-serif',fontSize:12,fontWeight:step.motor_id===m.id?700:400}}>
                        <span>{m.icon}</span><span>{m.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Action selector */}
                <div>
                  <div style={{fontFamily:'-apple-system,sans-serif',fontSize:10,fontWeight:600,letterSpacing:.3,
                    textTransform:'uppercase',color:'rgba(255,255,255,.3)',marginBottom:5}}>AKSİYON</div>
                  <div style={{display:'flex',gap:6}}>
                    {ACTION_OPTS.map(([act,lbl])=>(
                      <button key={act} onClick={()=>updateStep(i,{action:act as any,target_pos:act==='position'?50:undefined})}
                        style={{padding:'5px 12px',borderRadius:10,border:'none',cursor:'pointer',
                          background:step.action===act?`${color}22`:'rgba(255,255,255,.07)',
                          color:step.action===act?color:'rgba(255,255,255,.55)',
                          fontFamily:'-apple-system,sans-serif',fontSize:12,fontWeight:step.action===act?700:400}}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                  {/* Position slider */}
                  {step.action==='position'&&(
                    <div style={{marginTop:8,display:'flex',alignItems:'center',gap:10}}>
                      <input type="range" min={0} max={100} value={step.target_pos??50}
                        onChange={e=>updateStep(i,{target_pos:+e.target.value})}
                        style={{flex:1}}/>
                      <span style={{fontFamily:'"SF Mono","Menlo",monospace',fontSize:14,fontWeight:700,
                        color:color,minWidth:38}}>%{step.target_pos??50}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <PrimaryBtn label={initial?'Güncelle':'Senaryo Oluştur'} col={color} disabled={!name.trim()}
          onClick={()=>onSave({name:name.trim(),icon,color},steps,initial?.id)}/>
      </div>
    </Sheet>
  );
}
