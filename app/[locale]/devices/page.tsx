'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase-client';
import { DeviceCard } from '@/components/device/device-card';
import { PlusCircle, Cpu, Search } from 'lucide-react';
import type { Device } from '@/lib/types';

export default function DevicesPage() {
  const t = useTranslations('nav');
  const tAdd = useTranslations('addDevice');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [devices, setDevices] = useState<Device[]>([]);
  const [showAdd, setShowAdd] = useState(searchParams.get('add') === 'true');
  const [code, setCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDevices = async () => {
    const supabase = createClient();
    const { data } = await supabase.from('devices').select('*').order('last_seen', { ascending: false });
    if (data) setDevices(data);
    setLoading(false);
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const claimDevice = async () => {
    if (!code.trim()) return;
    setClaiming(true);
    setClaimMsg(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if device exists and is unclaimed
    const { data: device } = await supabase
      .from('devices')
      .select('*')
      .eq('device_id', code.trim().toUpperCase())
      .single();

    if (!device) {
      setClaimMsg({ text: tAdd('claimFailed'), ok: false });
      setClaiming(false);
      return;
    }

    if (device.user_id && device.user_id !== user.id) {
      setClaimMsg({ text: tAdd('alreadyClaimed'), ok: false });
      setClaiming(false);
      return;
    }

    // Claim the device
    const { error } = await supabase
      .from('devices')
      .update({ user_id: user.id })
      .eq('device_id', code.trim().toUpperCase());

    if (error) {
      setClaimMsg({ text: tAdd('claimFailed'), ok: false });
    } else {
      setClaimMsg({ text: tAdd('claimSuccess'), ok: true });
      setCode('');
      setShowAdd(false);
      loadDevices();
    }
    setClaiming(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-luxa-text">{t('devices')}</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 bg-luxa-gold text-luxa-bg text-sm font-semibold rounded-lg hover:bg-luxa-gold-light transition"
        >
          <PlusCircle size={16} />
          {t('addDevice')}
        </button>
      </div>

      {/* Add Device Panel */}
      {showAdd && (
        <div className="bg-luxa-bg-card border border-luxa-gold/30 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-luxa-gold">{tAdd('title')}</h2>
          <div className="space-y-2 text-sm text-luxa-muted">
            <p>1. {tAdd('step1')}</p>
            <p>2. {tAdd('step2')}</p>
            <p>3. {tAdd('step3')}</p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={tAdd('deviceCodePlaceholder')}
              className="flex-1 px-4 py-3 bg-luxa-bg border border-luxa-border rounded-lg text-luxa-text font-mono tracking-wider text-center uppercase focus:outline-none focus:border-luxa-gold"
              maxLength={12}
            />
            <button
              onClick={claimDevice}
              disabled={claiming || !code.trim()}
              className="px-6 py-3 bg-luxa-gold text-luxa-bg font-semibold rounded-lg hover:bg-luxa-gold-light transition disabled:opacity-50"
            >
              {claiming ? '...' : tAdd('claim')}
            </button>
          </div>
          {claimMsg && (
            <p className={`text-sm ${claimMsg.ok ? 'text-luxa-success' : 'text-luxa-error'}`}>
              {claimMsg.text}
            </p>
          )}
        </div>
      )}

      {/* Device List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-luxa-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-16 bg-luxa-bg-card border border-luxa-border rounded-xl">
          <Cpu size={48} className="mx-auto text-luxa-muted mb-4" />
          <p className="text-luxa-muted">{tCommon('noDevices')}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {devices.map(device => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </div>
      )}
    </div>
  );
}
