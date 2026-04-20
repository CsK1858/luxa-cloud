'use client';

// ============================================================
//  Luxa Cloud — Alerts History Page
//  (v2-group10, oturum 4/4)
// ============================================================

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import {
  ALARM_TYPE_NAMES, ALARM_TYPE_ICONS,
  type SafetyEvent, type Device,
} from '@/lib/types';
import {
  CheckCircle2, Bell, BellOff, ChevronDown, ArrowLeft,
} from 'lucide-react';

export default function AlertsPage() {
  const t = useTranslations('alerts');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [events, setEvents] = useState<SafetyEvent[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('active');

  const load = async () => {
    const supabase = createClient();
    let query = supabase
      .from('alert_history')
      .select('*')
      .order('ts', { ascending: false })
      .limit(200);
    if (deviceFilter !== 'all') query = query.eq('device_id', deviceFilter);
    if (stateFilter === 'active') query = query.in('state', ['alarm', 'warning']);
    else if (stateFilter === 'unack') query = query.is('acknowledged_at', null);

    const [eventRes, devRes] = await Promise.all([
      query,
      supabase.from('devices').select('*'),
    ]);
    if (eventRes.data) setEvents(eventRes.data as SafetyEvent[]);
    if (devRes.data) setDevices(devRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [deviceFilter, stateFilter]);

  const acknowledge = async (id: number) => {
    const supabase = createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    await supabase.from('safety_events')
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user.user.id })
      .eq('id', id);
    load();
  };

  const activeCount = events.filter(e =>
    (e.state === 'alarm' || e.state === 'warning') && !e.acknowledged_at
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/${locale}/dashboard`}
              className="inline-flex items-center text-sm text-luxa-muted hover:text-luxa-text mb-3 transition">
          <ArrowLeft className="w-4 h-4 mr-1" /> {tCommon('back')}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-luxa-text">{t('title')}</h1>
            {activeCount > 0 ? (
              <p className="text-sm text-luxa-error mt-1">
                <Bell className="w-4 h-4 inline mr-1" />
                {activeCount} {t('activeUnack')}
              </p>
            ) : (
              <p className="text-sm text-luxa-muted mt-1">
                <BellOff className="w-4 h-4 inline mr-1" />
                {t('noActive')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <FilterSelect value={deviceFilter} onChange={setDeviceFilter}
                      options={[
                        { value: 'all', label: t('allDevices') },
                        ...devices.map(d => ({
                          value: d.device_id,
                          label: d.name || d.device_id.slice(0, 8),
                        })),
                      ]} />
        <FilterSelect value={stateFilter} onChange={setStateFilter}
                      options={[
                        { value: 'active', label: t('active') },
                        { value: 'unack',  label: t('unack') },
                        { value: 'all',    label: t('allEvents') },
                      ]} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-luxa-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 bg-luxa-bg-card border border-luxa-border rounded-xl">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-3 text-luxa-success opacity-50" />
          <p className="text-luxa-muted">{t('noEventsMatch')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(ev => (
            <AlertRow key={ev.id} event={ev} onAck={acknowledge}
                      tAck={t('acknowledge')} tAcked={t('acknowledged')} />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertRow({
  event, onAck, tAck, tAcked,
}: {
  event: SafetyEvent;
  onAck: (id: number) => void;
  tAck: string;
  tAcked: string;
}) {
  const icon = ALARM_TYPE_ICONS[event.alarm_type] || '⚠️';
  const typeName = ALARM_TYPE_NAMES[event.alarm_type] || 'Unknown';
  const isActive = event.state === 'alarm' || event.state === 'warning';

  const borderLeft = event.state === 'alarm' ? 'border-l-4 border-l-luxa-error'
                   : event.state === 'warning' ? 'border-l-4 border-l-luxa-warn'
                   : 'border-l-4 border-l-luxa-border';

  return (
    <div className={`${borderLeft} bg-luxa-bg-card border border-luxa-border
                     rounded-r-xl p-3 flex items-start gap-3`}>
      <div className="text-2xl flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-luxa-text">
              {typeName}
              {event.value != null && (
                <span className="text-sm text-luxa-muted ml-2">
                  ({event.value.toFixed(1)})
                </span>
              )}
            </p>
            <p className="text-sm text-luxa-muted truncate">
              {event.device_name || event.device_id.slice(0, 12)}
              {' · '}
              <span className={
                event.state === 'alarm'   ? 'text-luxa-error font-medium' :
                event.state === 'warning' ? 'text-luxa-warn' :
                                            'text-luxa-muted'
              }>
                {event.state.toUpperCase()}
              </span>
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-luxa-muted whitespace-nowrap">
              {formatRelative(event.ts)}
            </p>
            {event.acknowledged_at ? (
              <p className="text-xs text-luxa-success mt-1">
                <CheckCircle2 className="w-3 h-3 inline" /> {tAcked}
              </p>
            ) : isActive ? (
              <button onClick={() => onAck(event.id)}
                      className="text-xs text-luxa-gold hover:underline mt-1">
                {tAck}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
              className="appearance-none bg-luxa-bg-card border border-luxa-border
                         text-luxa-text rounded-lg pl-3 pr-8 py-1.5 text-sm cursor-pointer
                         hover:border-luxa-gold/40 transition">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="w-4 h-4 absolute right-2 top-2 text-luxa-muted pointer-events-none" />
    </div>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString();
}
