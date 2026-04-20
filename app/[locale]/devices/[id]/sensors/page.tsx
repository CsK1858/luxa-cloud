'use client';

// ============================================================
//  Luxa Cloud — Device Sensors Page
//  (v2-group10, oturum 4/4)
//
//  Per-device sensor dashboard. Lists all sensors registered for
//  a device, shows current value + mini chart for each. Clicking
//  a sensor expands its full chart with range selector.
// ============================================================

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import { SensorChart } from '@/components/charts/sensor-chart';
import {
  SENSOR_TYPE_NAMES, CHANNEL_META,
  type Sensor, type SensorReading,
} from '@/lib/types';
import { ArrowLeft, Activity } from 'lucide-react';

// Which channels does this sensor type publish? Mirrors the
// firmware-side SENSOR_META table in mqtt_manager.cpp.
const CHANNELS_FOR_TYPE: Record<number, string[]> = {
  1: ['temp', 'humidity', 'pressure'],  // BME280
  2: ['lux'],                           // BH1750
  3: ['temp', 'humidity'],              // SHT3X
  4: ['lux'],                           // TSL2561
  5: ['temp'],                          // DS18B20
  6: ['soil'],                          // SOIL
  7: ['gas'],                           // MQ-2
  8: ['gas'],                           // MQ-135
  9: ['water'],                         // WATER LEAK
  10: ['rain'],                         // RAIN
  11: ['motion'],                       // PIR
};

export default function DeviceSensorsPage({
  params: { id, locale },
}: { params: { id: string; locale: string } }) {
  const t = useTranslations('sensors');
  const tCommon = useTranslations('common');
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [latest, setLatest] = useState<Record<string, SensorReading>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const { data: sRows } = await supabase
      .from('sensors')
      .select('*')
      .eq('device_id', id)
      .eq('enabled', true)
      .order('slot_id');

    if (sRows) setSensors(sRows);

    // Fetch the latest reading per (slot, channel) — PostgREST doesn't
    // support DISTINCT ON directly, but we can approximate with a
    // recent-window + client dedup. For real production, a 'latest_
    // sensor_readings' materialized view would be ideal.
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: rRows } = await supabase
      .from('sensor_readings')
      .select('*')
      .eq('device_id', id)
      .gte('ts', since)
      .order('ts', { ascending: false });

    if (rRows) {
      const byKey: Record<string, SensorReading> = {};
      for (const r of rRows) {
        const k = `${r.slot_id}:${r.channel}`;
        if (!byKey[k]) byKey[k] = r;  // first row we see is newest due to order
      }
      setLatest(byKey);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
    // Refresh every 30s so live values stay fresh without manual reload
    const int = setInterval(load, 30_000);
    return () => clearInterval(int);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/${locale}/devices/${id}`}
              className="inline-flex items-center text-sm text-luxa-muted hover:text-luxa-text mb-3 transition">
          <ArrowLeft className="w-4 h-4 mr-1" /> {tCommon('back')}
        </Link>
        <h1 className="text-xl font-bold text-luxa-text">{t('title')}</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-luxa-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sensors.length === 0 ? (
        <div className="text-center py-16 bg-luxa-bg-card border border-luxa-border rounded-xl">
          <Activity className="w-16 h-16 mx-auto mb-3 text-luxa-muted opacity-40" />
          <p className="text-luxa-muted">{t('noSensors')}</p>
          <p className="text-sm mt-2 text-luxa-muted">
            {t('noSensorsHint')}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sensors.map(sensor => {
            const channels = CHANNELS_FOR_TYPE[sensor.sensor_type] || ['temp'];
            return (
              <div key={sensor.id}>
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <div>
                    <h2 className="font-semibold text-luxa-text">
                      {sensor.name}
                    </h2>
                    <p className="text-xs text-luxa-muted">
                      {SENSOR_TYPE_NAMES[sensor.sensor_type] || 'Unknown'} ·
                      slot {sensor.slot_id} · pin {sensor.pin}
                      {(sensor.offset_cal !== 0 || sensor.scale_cal !== 1) && (
                        <span className="ml-2 px-1.5 py-0.5 bg-luxa-gold/20
                                         text-luxa-gold rounded text-[10px] font-semibold">
                          CAL
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-4">
                    {channels.map(ch => {
                      const lastVal = latest[`${sensor.slot_id}:${ch}`];
                      const meta = CHANNEL_META[ch];
                      return (
                        <div key={ch} className="text-right">
                          <p className="text-xs text-luxa-muted">{meta?.label || ch}</p>
                          <p className="text-lg font-semibold" style={{ color: meta?.color }}>
                            {lastVal ? lastVal.value.toFixed(1) + (meta?.unit || '') : '—'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* One chart per channel */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {channels.map(ch => (
                    <SensorChart
                      key={ch}
                      deviceId={id}
                      slotId={sensor.slot_id}
                      channel={ch}
                      sensorName={sensor.name}
                      alertHigh={sensor.alert_high}
                      alertLow={sensor.alert_low}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
