'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase-client';
import { DeviceControls } from '@/components/device/device-controls';
import {
  ArrowLeft, Wifi, WifiOff, Clock,
  Activity, Pencil, Trash2,
} from 'lucide-react';
import Link from 'next/link';
import type { Device, ActivityEntry } from '@/lib/types';

function isOnline(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() < 120000;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function DeviceDetailPage({ params: { id, locale } }: { params: { id: string; locale: string } }) {
  const t = useTranslations('device');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const currentLocale = useLocale();
  const [device, setDevice] = useState<Device | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  const load = async () => {
    const supabase = createClient();
    const [devRes, actRes] = await Promise.all([
      supabase.from('devices').select('*').eq('device_id', id).single(),
      supabase.from('activity_log').select('*').eq('device_id', id).order('created_at', { ascending: false }).limit(20),
    ]);
    if (devRes.data) {
      setDevice(devRes.data);
      setNewName(devRes.data.name || '');
    }
    if (actRes.data) setActivity(actRes.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [id]);

  const handleRename = async () => {
    if (!device) return;
    const supabase = createClient();
    await supabase.from('devices').update({ name: newName }).eq('device_id', device.device_id);
    setRenaming(false);
    load();
  };

  const handleRemove = async () => {
    if (!device || !confirm(t('removeConfirm'))) return;
    const supabase = createClient();
    await supabase.from('devices').update({ user_id: null }).eq('device_id', device.device_id);
    router.push(`/${currentLocale}/devices`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-luxa-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!device) {
    return (
      <div className="text-center py-20">
        <p className="text-luxa-muted">{tCommon('error')}</p>
        <Link href={`/${currentLocale}/devices`} className="text-luxa-gold text-sm mt-2 inline-block">
          {tCommon('back')}
        </Link>
      </div>
    );
  }

  const online = isOnline(device.last_seen);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/${currentLocale}/devices`} className="text-luxa-muted hover:text-luxa-text transition">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          {renaming ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="px-3 py-1.5 bg-luxa-bg border border-luxa-border rounded-lg text-luxa-text focus:outline-none focus:border-luxa-gold"
                autoFocus
              />
              <button onClick={handleRename} className="text-sm text-luxa-gold">{tCommon('save')}</button>
              <button onClick={() => setRenaming(false)} className="text-sm text-luxa-muted">{tCommon('cancel')}</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-luxa-text">{device.name || device.device_id}</h1>
              <button onClick={() => setRenaming(true)} className="text-luxa-muted hover:text-luxa-gold transition">
                <Pencil size={14} />
              </button>
            </div>
          )}
          <p className="text-xs text-luxa-muted font-mono">{device.device_id}</p>
        </div>
        <span className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-full ${
          online ? 'bg-luxa-success/10 text-luxa-success' : 'bg-luxa-border text-luxa-muted'
        }`}>
          {online ? <Wifi size={14} /> : <WifiOff size={14} />}
          {online ? tCommon('online') : tCommon('offline')}
        </span>
      </div>

      {/* Info Card — only user-relevant info */}
      <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          {device.status?.uptime && (
            <InfoRow icon={<Clock size={14} />} label={t('uptime')} value={formatUptime(device.status.uptime)} />
          )}
          {device.status?.wifi_rssi && (
            <InfoRow icon={<Wifi size={14} />} label={t('signal')} value={
              device.status.wifi_rssi > -50 ? '●●●● ' : device.status.wifi_rssi > -65 ? '●●●○ ' : device.status.wifi_rssi > -75 ? '●●○○ ' : '●○○○ '
            } />
          )}
          <InfoRow icon={<Clock size={14} />} label={t('lastSeen')} value={new Date(device.last_seen).toLocaleString(currentLocale)} />
        </div>
      </div>

      {/* Controls */}
      <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-4">
        <h2 className="text-sm font-medium text-luxa-muted mb-4 flex items-center gap-2">
          {t('controls')}
        </h2>
        <DeviceControls device={device} />
      </div>

      {/* Activity Log */}
      {activity.length > 0 && (
        <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-luxa-muted mb-3 flex items-center gap-2">
            <Activity size={16} />
            {t('activity')}
          </h2>
          <div className="space-y-1">
            {activity.map(a => (
              <div key={a.id} className="flex items-center justify-between text-sm py-1.5 border-b border-luxa-border last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-luxa-text">{a.action}</span>
                  {a.target !== null && <span className="text-luxa-muted">#{a.target}</span>}
                  {a.result && <span className="text-xs text-luxa-success">{a.result}</span>}
                </div>
                <span className="text-xs text-luxa-muted">
                  {new Date(a.created_at).toLocaleString(currentLocale)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="bg-luxa-bg-card border border-luxa-error/20 rounded-xl p-4">
        <button
          onClick={handleRemove}
          className="flex items-center gap-2 text-sm text-luxa-error hover:underline"
        >
          <Trash2 size={14} />
          {t('remove')}
        </button>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-luxa-muted">{icon}</span>
      <span className="text-luxa-muted">{label}:</span>
      <span className="text-luxa-text ml-auto">{value}</span>
    </div>
  );
}
