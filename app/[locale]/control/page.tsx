// app/[locale]/control/page.tsx — Server Component
// Fetches devices + latest sensor readings + safety events from Supabase,
// then passes to the client ControlPanel component.
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { ControlPanel } from '@/components/control/control-panel';
import type { Device, SensorReading, SafetyEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ControlPage() {
  const supabase = createServerSupabase();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch devices
  const { data: devices } = await supabase
    .from('devices')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at');

  if (!devices?.length) {
    return (
      <div style={{
        minHeight: '100dvh', background: '#0a0a0c',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px', gap: 16,
      }}>
        <div style={{ fontSize: 40 }}>🔌</div>
        <p style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
          fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,.8)',
        }}>Henüz cihaz yok</p>
        <a href="/devices/add" style={{
          padding: '10px 20px', borderRadius: 14, background: '#c9963b',
          color: '#0a0a0c', fontWeight: 700, fontSize: 14,
          textDecoration: 'none', display: 'inline-block',
        }}>Cihaz Ekle</a>
      </div>
    );
  }

  // Fetch latest sensor readings (last 1h) for first device
  const deviceId = devices[0]?.device_id;
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();

  const [{ data: readings }, { data: safetyEvents }] = await Promise.all([
    supabase
      .from('sensor_readings')
      .select('device_id,slot_id,channel,value,ts')
      .eq('device_id', deviceId)
      .gte('ts', oneHourAgo)
      .order('ts', { ascending: false })
      .limit(200),
    supabase
      .from('safety_events')
      .select('*')
      .eq('device_id', deviceId)
      .order('ts', { ascending: false })
      .limit(20),
  ]);

  // Latest reading per channel
  const latestByChannel: Record<string, number> = {};
  for (const r of (readings ?? [])) {
    if (!(r.channel in latestByChannel)) {
      latestByChannel[r.channel] = r.value;
    }
  }

  return (
    <ControlPanel
      devices={devices as Device[]}
      latestReadings={latestByChannel}
      safetyEvents={(safetyEvents ?? []) as SafetyEvent[]}
    />
  );
}
