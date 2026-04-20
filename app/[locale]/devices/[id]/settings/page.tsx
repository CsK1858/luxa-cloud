'use client';

// ============================================================
//  Luxa Cloud — Device Settings Page
//  (v2-group10, oturum 4/4)
//
//  Cloud-side device configuration surface. Firmware remains the
//  source of truth for WiFi/MQTT (they're baked into device NVS)
//  so this page is primarily:
//    - READ: last reported heartbeat, firmware version, IP, RSSI
//    - WRITE via commands queue: push calibration updates, rename,
//      trigger reboot/rescan — firmware polls the 'commands' table
//      and applies them on next cycle
//    - CONFIG INSPECTION: cloud-visible sensors/rules summary
//
//  Direct WiFi/MQTT config editing from cloud requires a round
//  trip through the commands table (action: 'config_update') and
//  is intentionally NOT exposed here yet — risk of bricking a
//  remote device is too high without a confirmation UX.
// ============================================================

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import type { Device, Sensor, AutomationRule } from '@/lib/types';
import {
  ArrowLeft, Wifi, Activity, Cpu, Clock, Edit3, RefreshCw,
  Thermometer, Zap, AlertCircle,
} from 'lucide-react';

export default function DeviceSettingsPage({
  params: { id, locale },
}: { params: { id: string; locale: string } }) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [device, setDevice] = useState<Device | null>(null);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [commandInFlight, setCommandInFlight] = useState<string | null>(null);

  const load = async () => {
    const supabase = createClient();
    const [dRes, sRes, rRes] = await Promise.all([
      supabase.from('devices').select('*').eq('device_id', id).single(),
      supabase.from('sensors').select('*').eq('device_id', id).order('slot_id'),
      supabase.from('automation_rules').select('*').eq('device_id', id),
    ]);
    if (dRes.data) {
      setDevice(dRes.data);
      setNewName(dRes.data.name || '');
    }
    if (sRes.data) setSensors(sRes.data);
    if (rRes.data) setRules(rRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const saveRename = async () => {
    const supabase = createClient();
    await supabase.from('devices').update({ name: newName }).eq('device_id', id);
    setRenaming(false);
    load();
  };

  // Queue a command for firmware to pick up on its next command poll.
  const sendCommand = async (action: string, label: string) => {
    if (!confirm(t('confirmCommand', { action: label }))) return;
    setCommandInFlight(action);
    const supabase = createClient();
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from('commands').insert({
      device_id: id,
      action,
      target: 0,
      user_id: user.user?.id || null,
    });
    setCommandInFlight(null);
    if (error) alert(t('commandFailed') + ': ' + error.message);
    else alert(t('commandQueued'));
  };

  const pushCalibration = async (sensor: Sensor) => {
    const offset = prompt(t('promptOffset', { current: sensor.offset_cal }),
                          String(sensor.offset_cal));
    if (offset === null) return;
    const scale = prompt(t('promptScale', { current: sensor.scale_cal }),
                         String(sensor.scale_cal));
    if (scale === null) return;
    const off = parseFloat(offset), scl = parseFloat(scale);
    if (isNaN(off) || isNaN(scl) || scl <= 0) {
      alert(t('invalidCalibration'));
      return;
    }
    const supabase = createClient();
    // Update cloud-side metadata first
    await supabase.from('sensors')
      .update({ offset_cal: off, scale_cal: scl })
      .eq('id', sensor.id);
    // Queue a command so firmware applies the calibration locally
    const { data: user } = await supabase.auth.getUser();
    await supabase.from('commands').insert({
      device_id: id,
      action: 'sensor_calibrate',
      target: sensor.slot_id,
      payload: JSON.stringify({ offset: off, scale: scl }),
      user_id: user.user?.id || null,
    });
    load();
  };

  if (loading || !device) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-luxa-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const lastSeenMs = new Date(device.last_seen).getTime();
  const isOnline = (Date.now() - lastSeenMs) < 120_000;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/${locale}/devices/${id}`}
              className="inline-flex items-center text-sm text-luxa-muted hover:text-luxa-text mb-3 transition">
          <ArrowLeft className="w-4 h-4 mr-1" /> {tCommon('back')}
        </Link>
        <h1 className="text-xl font-bold text-luxa-text">{t('title')}</h1>
      </div>

      {/* Device identity card */}
      <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            {renaming ? (
              <div className="flex items-center gap-2">
                <input type="text" value={newName}
                       onChange={e => setNewName(e.target.value)}
                       className="bg-luxa-bg border border-luxa-border text-luxa-text
                                  rounded px-2 py-1 text-sm" />
                <button onClick={saveRename}
                        className="text-xs px-2 py-1 bg-luxa-gold text-luxa-bg rounded">
                  {tCommon('save')}
                </button>
                <button onClick={() => setRenaming(false)}
                        className="text-xs text-luxa-muted">
                  {tCommon('cancel')}
                </button>
              </div>
            ) : (
              <h2 className="font-semibold text-luxa-text flex items-center gap-2">
                {device.name || device.device_id.slice(0, 12)}
                <button onClick={() => setRenaming(true)}
                        className="text-luxa-muted hover:text-luxa-gold">
                  <Edit3 size={14} />
                </button>
              </h2>
            )}
            <p className="text-xs text-luxa-muted font-mono mt-1">{device.device_id}</p>
          </div>
          <span className={`text-xs px-2 py-1 rounded ${
            isOnline ? 'bg-luxa-success/20 text-luxa-success' : 'bg-luxa-muted/20 text-luxa-muted'
          }`}>
            {isOnline ? tCommon('online') : tCommon('offline')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoItem icon={<Cpu size={14} />} label={t('model')} value={device.model || '—'} />
          <InfoItem icon={<Activity size={14} />} label={t('firmware')}
                    value={(device as any).firmware_ver || device.firmware || '—'} />
          <InfoItem icon={<Wifi size={14} />} label="IP"
                    value={(device as any).last_ip || device.ip_address || '—'} />
          <InfoItem icon={<Wifi size={14} />} label="RSSI"
                    value={(device as any).last_rssi ? `${(device as any).last_rssi} dBm` : '—'} />
          <InfoItem icon={<Clock size={14} />} label={t('lastSeen')}
                    value={new Date(device.last_seen).toLocaleString(locale)} />
          <InfoItem icon={<AlertCircle size={14} />} label={t('mac')}
                    value={device.mac_address || '—'} />
        </div>
      </div>

      {/* Remote commands */}
      <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-luxa-gold mb-3">{t('remoteCommands')}</h2>
        <p className="text-xs text-luxa-muted mb-3">{t('commandsHint')}</p>
        <div className="flex gap-2 flex-wrap">
          <CommandButton label={t('cmd.rescanSensors')} action="sensor_rescan"
                         disabled={!isOnline || commandInFlight !== null}
                         onClick={() => sendCommand('sensor_rescan', t('cmd.rescanSensors'))} />
          <CommandButton label={t('cmd.reboot')} action="reboot" variant="danger"
                         disabled={!isOnline || commandInFlight !== null}
                         onClick={() => sendCommand('reboot', t('cmd.reboot'))} />
          <CommandButton label={t('cmd.silenceAlarms')} action="safety_silence"
                         disabled={!isOnline || commandInFlight !== null}
                         onClick={() => sendCommand('safety_silence', t('cmd.silenceAlarms'))} />
          <CommandButton label={t('cmd.syncTime')} action="time_sync"
                         disabled={!isOnline || commandInFlight !== null}
                         onClick={() => sendCommand('time_sync', t('cmd.syncTime'))} />
        </div>
      </div>

      {/* Sensors summary with cloud calibration */}
      <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-luxa-gold mb-3 flex items-center gap-2">
          <Thermometer size={14} /> {t('sensors')} ({sensors.filter(s => s.enabled).length})
        </h2>
        {sensors.length === 0 ? (
          <p className="text-sm text-luxa-muted">{t('noSensors')}</p>
        ) : (
          <div className="space-y-2">
            {sensors.map(s => (
              <div key={s.id}
                   className="flex items-center justify-between py-2 border-b border-luxa-border
                              last:border-0 text-sm">
                <div className="flex-1 min-w-0">
                  <p className={s.enabled ? 'text-luxa-text' : 'text-luxa-muted'}>
                    {s.name}
                    {!s.enabled && <span className="text-xs ml-2">(disabled)</span>}
                  </p>
                  <p className="text-xs text-luxa-muted">
                    slot {s.slot_id} · pin {s.pin} ·
                    <span className="ml-1">
                      offset {s.offset_cal.toFixed(2)} · scale {s.scale_cal.toFixed(2)}
                    </span>
                  </p>
                </div>
                <button onClick={() => pushCalibration(s)}
                        disabled={!isOnline}
                        className="text-xs px-2 py-1 border border-luxa-border rounded
                                   hover:border-luxa-gold disabled:opacity-40 transition">
                  {t('calibrate')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rules quick view */}
      <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-luxa-gold flex items-center gap-2">
            <Zap size={14} /> {t('rules')} ({rules.filter(r => r.enabled).length})
          </h2>
          <Link href={`/${locale}/rules`}
                className="text-xs text-luxa-gold hover:underline">
            {t('manageRules')} →
          </Link>
        </div>
        {rules.length === 0 ? (
          <p className="text-sm text-luxa-muted">{t('noRules')}</p>
        ) : (
          <div className="space-y-1">
            {rules.slice(0, 5).map(r => (
              <Link key={r.id} href={`/${locale}/rules/${r.id}`}
                    className="block py-1 text-sm hover:text-luxa-gold transition">
                <span className={r.enabled ? 'text-luxa-text' : 'text-luxa-muted'}>
                  {r.name}
                </span>
                {!r.enabled && <span className="text-xs text-luxa-muted ml-2">(off)</span>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-luxa-muted">{icon}</span>
      <span className="text-luxa-muted">{label}:</span>
      <span className="text-luxa-text ml-auto truncate">{value}</span>
    </div>
  );
}

function CommandButton({
  label, action, variant, disabled, onClick,
}: {
  label: string;
  action: string;
  variant?: 'danger';
  disabled?: boolean;
  onClick: () => void;
}) {
  const base = 'px-3 py-1.5 text-xs rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed';
  const cls = variant === 'danger'
    ? `${base} border-luxa-error/40 text-luxa-error hover:bg-luxa-error/10`
    : `${base} border-luxa-border text-luxa-text hover:border-luxa-gold/40`;
  return (
    <button className={cls} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}
