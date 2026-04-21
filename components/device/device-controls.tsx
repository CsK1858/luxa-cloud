'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase-client';
import type { Device, DeviceAction } from '@/lib/types';
import {
  ArrowUp, ArrowDown, Square, ChevronUp, ChevronDown, Star,
} from 'lucide-react';

interface Props {
  device: Device;
}

export function DeviceControls({ device }: Props) {
  const t = useTranslations('device');
  const [sending, setSending] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const sendCommand = async (action: DeviceAction, target: number = 0) => {
    setSending(action);
    setToast(null);

    const supabase = createClient();
    const { error } = await supabase.from('commands').insert({
      device_id: device.device_id,
      action,
      target,
      status: 'pending',
    });

    if (error) {
      setToast({ msg: t('commandFailed'), ok: false });
    } else {
      setToast({ msg: t('commandSent'), ok: true });
    }
    setSending(null);
    setTimeout(() => setToast(null), 3000);
  };

  const motorCount = device.status?.device_count ?? 0;
  const rtsCount = device.status?.remote_count ?? 0;

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`px-4 py-2 rounded-lg text-sm ${toast.ok ? 'bg-luxa-success/10 text-luxa-success' : 'bg-luxa-error/10 text-luxa-error'}`}>
          {toast.msg}
        </div>
      )}

      {/* Motor Controls */}
      {motorCount > 0 && (
        <div>
          <h3 className="text-sm font-medium text-luxa-muted mb-3">{t('motorControls')}</h3>
          {Array.from({ length: motorCount }, (_, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <span className="text-sm text-luxa-text w-20">Motor {i + 1}</span>
              <ControlButton
                icon={<ArrowUp size={18} />}
                label={t('open')}
                onClick={() => sendCommand('motor_open', i)}
                loading={sending === 'motor_open'}
                color="gold"
              />
              <ControlButton
                icon={<Square size={14} />}
                label={t('stop')}
                onClick={() => sendCommand('motor_stop', i)}
                loading={sending === 'motor_stop'}
                color="red"
              />
              <ControlButton
                icon={<ArrowDown size={18} />}
                label={t('close')}
                onClick={() => sendCommand('motor_close', i)}
                loading={sending === 'motor_close'}
                color="muted"
              />
            </div>
          ))}
        </div>
      )}

      {/* Kablosuz (RF) Kontroller */}
      {rtsCount > 0 && (
        <div>
          <h3 className="text-sm font-medium text-luxa-muted mb-3">{t('rtsControls')}</h3>
          {Array.from({ length: rtsCount }, (_, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <span className="text-sm text-luxa-text w-20">Kanal {i + 1}</span>
              <ControlButton
                icon={<ChevronUp size={18} />}
                label={t('up')}
                onClick={() => sendCommand('rts_up', i)}
                loading={sending === 'rts_up'}
                color="gold"
              />
              <ControlButton
                icon={<Star size={14} />}
                label={t('my')}
                onClick={() => sendCommand('rts_my', i)}
                loading={sending === 'rts_my'}
                color="muted"
              />
              <ControlButton
                icon={<ChevronDown size={18} />}
                label={t('down')}
                onClick={() => sendCommand('rts_down', i)}
                loading={sending === 'rts_down'}
                color="muted"
              />
            </div>
          ))}
        </div>
      )}

      {motorCount === 0 && rtsCount === 0 && (
        <p className="text-sm text-luxa-muted text-center py-8">
          {t('controls')}: —
        </p>
      )}
    </div>
  );
}

function ControlButton({ icon, label, onClick, loading, color }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  loading: boolean;
  color: 'gold' | 'red' | 'muted';
}) {
  const colors = {
    gold: 'text-luxa-gold border-luxa-gold/30 hover:bg-luxa-gold/10',
    red: 'text-luxa-error border-luxa-error/30 hover:bg-luxa-error/10',
    muted: 'text-luxa-muted border-luxa-border hover:bg-luxa-bg-hover',
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 px-4 py-2.5 border rounded-lg text-sm transition disabled:opacity-50 ${colors[color]}`}
      title={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
