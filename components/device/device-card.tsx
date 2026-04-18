'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Cpu, Wifi, WifiOff, Clock } from 'lucide-react';
import type { Device } from '@/lib/types';

function timeAgo(dateStr: string, locale: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return locale === 'tr' ? 'az önce' : 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function isOnline(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() < 120000; // 2 minutes
}

export function DeviceCard({ device }: { device: Device }) {
  const locale = useLocale();
  const t = useTranslations('common');
  const online = isOnline(device.last_seen);

  return (
    <Link
      href={`/${locale}/devices/${device.device_id}`}
      className="block bg-luxa-bg-card border border-luxa-border rounded-xl p-4 hover:border-luxa-gold/40 transition group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${online ? 'bg-luxa-success/10' : 'bg-luxa-border'}`}>
            <Cpu size={20} className={online ? 'text-luxa-success' : 'text-luxa-muted'} />
          </div>
          <div>
            <h3 className="font-semibold text-luxa-text group-hover:text-luxa-gold transition">
              {device.name || device.device_id}
            </h3>
            <p className="text-xs text-luxa-muted">{device.device_id}</p>
          </div>
        </div>
        <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
          online
            ? 'bg-luxa-success/10 text-luxa-success'
            : 'bg-luxa-border text-luxa-muted'
        }`}>
          {online ? <Wifi size={12} /> : <WifiOff size={12} />}
          {online ? t('online') : t('offline')}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-luxa-muted">
        <span>{device.model}</span>
        {device.firmware && <span>v{device.firmware}</span>}
        <span className="flex items-center gap-1 ml-auto">
          <Clock size={12} />
          {timeAgo(device.last_seen, locale)}
        </span>
      </div>

      {device.status?.wifi_rssi && (
        <div className="mt-2 flex items-center gap-2 text-xs text-luxa-muted">
          <Wifi size={12} />
          <span>{device.status.wifi_rssi > -50 ? 'Excellent' : device.status.wifi_rssi > -65 ? 'Good' : device.status.wifi_rssi > -75 ? 'Fair' : 'Weak'}</span>
        </div>
      )}
    </Link>
  );
}
