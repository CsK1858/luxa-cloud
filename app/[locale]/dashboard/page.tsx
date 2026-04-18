'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase-client';
import { DeviceCard } from '@/components/device/device-card';
import { Cpu, Wifi, WifiOff, PlusCircle, Activity } from 'lucide-react';
import Link from 'next/link';
import type { Device, ActivityEntry } from '@/lib/types';

function isOnline(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() < 120000;
}

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const [devices, setDevices] = useState<Device[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [devRes, actRes] = await Promise.all([
        supabase.from('devices').select('*').order('last_seen', { ascending: false }),
        supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(10),
      ]);
      if (devRes.data) setDevices(devRes.data);
      if (actRes.data) setActivity(actRes.data);
      setLoading(false);
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const onlineCount = devices.filter(d => isOnline(d.last_seen)).length;
  const offlineCount = devices.length - onlineCount;

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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<Cpu size={20} />} label={t('totalDevices')} value={devices.length} />
        <StatCard icon={<Wifi size={20} />} label={t('onlineDevices')} value={onlineCount} color="success" />
        <StatCard icon={<WifiOff size={20} />} label={t('offlineDevices')} value={offlineCount} color="muted" />
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
            <DeviceCard key={device.id} device={device} />
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
  color?: 'gold' | 'success' | 'muted';
}) {
  const colorMap = {
    gold: 'text-luxa-gold',
    success: 'text-luxa-success',
    muted: 'text-luxa-muted',
  };
  return (
    <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-4">
      <div className={`mb-2 ${colorMap[color]}`}>{icon}</div>
      <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
      <p className="text-xs text-luxa-muted mt-1">{label}</p>
    </div>
  );
}
