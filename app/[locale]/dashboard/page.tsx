'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase-client';
import { DeviceCard } from '@/components/device/device-card';
import { Cpu, Wifi, WifiOff, PlusCircle, Activity, Bell, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { Device, ActivityEntry, SafetyEvent } from '@/lib/types';

function isOnline(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() < 120000;
}

// v2-group10 (oturum 4/4): map device_id → unacknowledged alert count
// so DeviceCard can render a badge. Single query for all devices
// avoids N+1 on dashboard load.
type AlertCountMap = Record<string, number>;

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const [devices, setDevices] = useState<Device[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [alertCounts, setAlertCounts] = useState<AlertCountMap>({});
  const [activeAlerts, setActiveAlerts] = useState<SafetyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [devRes, actRes, alertRes] = await Promise.all([
        supabase.from('devices').select('*').order('last_seen', { ascending: false }),
        supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(10),
        // Unacknowledged active alerts across all user's devices.
        // RLS filters to owner's devices automatically.
        supabase.from('alert_history')
          .select('*')
          .in('state', ['alarm', 'warning'])
          .is('acknowledged_at', null)
          .order('ts', { ascending: false })
          .limit(50),
      ]);
      if (devRes.data) setDevices(devRes.data);
      if (actRes.data) setActivity(actRes.data);
      if (alertRes.data) {
        setActiveAlerts(alertRes.data as SafetyEvent[]);
        // Count active alerts per device
        const counts: AlertCountMap = {};
        for (const ev of alertRes.data as SafetyEvent[]) {
          counts[ev.device_id] = (counts[ev.device_id] || 0) + 1;
        }
        setAlertCounts(counts);
      }
      setLoading(false);
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const onlineCount = devices.filter(d => isOnline(d.last_seen)).length;
  const offlineCount = devices.length - onlineCount;
  const alertCount = activeAlerts.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-luxa-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-luxa-text">{t('title')}</h1>
        <Link
          href={`/${locale}/devices?add=true`}
          className="flex items-center gap-2 px-4 py-2 bg-luxa-gold text-luxa-bg text-sm font-semibold rounded-lg hover:bg-luxa-gold-light transition"
        >
          <PlusCircle size={16} />
          {tNav('addDevice')}
        </Link>
      </div>

      {/* Active alerts banner — only shows when there are unack'd alerts */}
      {alertCount > 0 && (
        <Link
          href={`/${locale}/alerts`}
          className="flex items-center gap-3 p-4 bg-luxa-error/10 border border-luxa-error/40
                     rounded-xl hover:bg-luxa-error/20 transition"
        >
          <AlertTriangle className="text-luxa-error flex-shrink-0" size={24} />
          <div className="flex-1">
            <p className="font-semibold text-luxa-error">
              {alertCount} {alertCount === 1 ? 'active alert' : 'active alerts'}
            </p>
            <p className="text-sm text-luxa-muted">
              {activeAlerts.slice(0, 2).map(a =>
                `${a.device_name || a.device_id.slice(0, 8)}: ${a.alarm_type_name}`
              ).join(' · ')}
              {alertCount > 2 && ` · +${alertCount - 2} more`}
            </p>
          </div>
          <span className="text-xs text-luxa-muted">View all →</span>
        </Link>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Cpu size={20} />} label={t('totalDevices')} value={devices.length} />
        <StatCard icon={<Wifi size={20} />} label={t('onlineDevices')} value={onlineCount} color="success" />
        <StatCard icon={<WifiOff size={20} />} label={t('offlineDevices')} value={offlineCount} color="muted" />
        <Link href={`/${locale}/alerts`}>
          <StatCard icon={<Bell size={20} />} label={tNav('alerts')} value={alertCount}
                    color={alertCount > 0 ? 'error' : 'muted'} />
        </Link>
      </div>

      {/* Devices */}
      {devices.length === 0 ? (
        <div className="text-center py-16 bg-luxa-bg-card border border-luxa-border rounded-xl">
          <Cpu size={48} className="mx-auto text-luxa-muted mb-4" />
          <p className="text-luxa-muted">{tCommon('noDevices')}</p>
          <Link
            href={`/${locale}/devices?add=true`}
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-luxa-gold text-sm hover:underline"
          >
            <PlusCircle size={16} />
            {tNav('addDevice')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {devices.map(device => (
            <div key={device.id} className="relative">
              <DeviceCard device={device} />
              {alertCounts[device.device_id] > 0 && (
                <span className="absolute top-2 right-2 bg-luxa-error text-white
                                 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Bell size={10} />
                  {alertCounts[device.device_id]}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Recent Activity */}
      {activity.length > 0 && (
        <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-luxa-muted mb-3 flex items-center gap-2">
            <Activity size={16} />
            {t('recentActivity')}
          </h2>
          <div className="space-y-2">
            {activity.map(a => (
              <div key={a.id} className="flex items-center justify-between text-sm py-1.5 border-b border-luxa-border last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-luxa-gold font-mono text-xs">{a.device_id}</span>
                  <span className="text-luxa-text">{a.action}</span>
                  {a.target !== null && <span className="text-luxa-muted">#{a.target}</span>}
                </div>
                <span className="text-xs text-luxa-muted">
                  {new Date(a.created_at).toLocaleTimeString(locale)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color = 'gold' }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color?: 'gold' | 'success' | 'muted' | 'error';
}) {
  const colorMap = {
    gold: 'text-luxa-gold',
    success: 'text-luxa-success',
    muted: 'text-luxa-muted',
    error: 'text-luxa-error',
  };
  return (
    <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-4 hover:border-luxa-gold/40 transition">
      <div className={`mb-2 ${colorMap[color]}`}>{icon}</div>
      <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
      <p className="text-xs text-luxa-muted mt-1">{label}</p>
    </div>
  );
}
