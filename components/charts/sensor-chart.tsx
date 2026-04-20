'use client';

// ============================================================
//  Luxa Cloud — Sensor Chart Component
//  (v2-group10, oturum 4/4)
//
//  Time-series line chart for a single sensor channel. Uses
//  Recharts. Fetches bucketed aggregates from Supabase via the
//  sensor_chart() RPC function defined in the migrations SQL.
//
//  Range selector: 1h / 24h / 7d / 30d. Bucket size auto-picks
//  so each range shows ~100-200 points — enough resolution to
//  spot trends without hammering the DB with a million rows.
// ============================================================

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase-client';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts';
import { CHANNEL_META, type ChartBucket } from '@/lib/types';

type Range = '1h' | '24h' | '7d' | '30d';

// For each range: how far back (in hours), bucket size (postgres
// INTERVAL string), and the d3-format-style time label.
const RANGE_CONFIG: Record<Range, {
  hours: number;
  bucket: string;
  label: string;
}> = {
  '1h':  { hours: 1,   bucket: '30 seconds', label: 'HH:mm' },
  '24h': { hours: 24,  bucket: '10 minutes', label: 'HH:mm' },
  '7d':  { hours: 168, bucket: '1 hour',     label: 'MMM d HH:mm' },
  '30d': { hours: 720, bucket: '4 hours',    label: 'MMM d' },
};

interface Props {
  deviceId: string;
  slotId: number;
  channel: string;
  sensorName: string;
  alertHigh?: number | null;
  alertLow?: number | null;
}

export function SensorChart({
  deviceId, slotId, channel, sensorName, alertHigh, alertLow,
}: Props) {
  const t = useTranslations('charts');
  const tLatest = t('latest');
  const tAvg = t('avg');
  const tNoData = t('noData');
  const [range, setRange] = useState<Range>('24h');
  const [data, setData] = useState<ChartBucket[]>([]);
  const [loading, setLoading] = useState(true);

  const meta = CHANNEL_META[channel] || {
    label: channel, unit: '', color: '#6b7280',
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      const cfg = RANGE_CONFIG[range];
      const from = new Date(Date.now() - cfg.hours * 3600_000).toISOString();
      const to = new Date().toISOString();

      // Two fallback strategies because Supabase projects may or may
      // not have TimescaleDB enabled. Try the RPC first; on failure
      // (function doesn't exist) fall back to a direct table query
      // and bucket client-side.
      const { data: bucketed, error } = await supabase.rpc('sensor_chart', {
        p_device_id: deviceId,
        p_slot_id: slotId,
        p_channel: channel,
        p_from: from,
        p_to: to,
        p_bucket: cfg.bucket,
      });

      if (error || !bucketed) {
        // Fallback: raw query + client-side bucket
        const { data: raw } = await supabase
          .from('sensor_readings')
          .select('ts,value')
          .eq('device_id', deviceId)
          .eq('slot_id', slotId)
          .eq('channel', channel)
          .gte('ts', from)
          .lt('ts', to)
          .order('ts');
        if (raw) {
          setData(clientBucket(raw, cfg.bucket));
        } else {
          setData([]);
        }
      } else {
        setData(bucketed as ChartBucket[]);
      }
      setLoading(false);
    };
    load();
  }, [deviceId, slotId, channel, range]);

  return (
    <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-4">
      <div className="flex justify-between items-center mb-3 gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold text-luxa-text">
            {sensorName} — {meta.label}
          </h3>
          {data.length > 0 && (
            <p className="text-sm text-luxa-muted">
              {tLatest}: {data[data.length - 1].avg_value.toFixed(1)}{meta.unit}
              {' · '}
              {tAvg}: {(data.reduce((s, d) => s + d.avg_value, 0) / data.length).toFixed(1)}{meta.unit}
            </p>
          )}
        </div>
        <div className="flex gap-1 text-sm">
          {(['1h', '24h', '7d', '30d'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded transition ${
                range === r
                  ? 'bg-luxa-gold text-luxa-bg font-semibold'
                  : 'bg-luxa-bg border border-luxa-border text-luxa-muted hover:border-luxa-gold/40'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-luxa-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-luxa-muted text-sm">
          {tNoData}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data.map(d => ({
            ts: new Date(d.bucket_ts).getTime(),
            avg: Number(d.avg_value.toFixed(2)),
            min: Number(d.min_value.toFixed(2)),
            max: Number(d.max_value.toFixed(2)),
          }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor"
                           className="text-luxa-border" opacity={0.4} />
            <XAxis
              dataKey="ts"
              type="number"
              domain={['auto', 'auto']}
              tickFormatter={(v) => formatTimeForRange(v, range)}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-luxa-muted"
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              tickFormatter={(v) => `${v}${meta.unit}`}
              className="text-luxa-muted"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(17,24,39,0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: '#f9fafb',
                fontSize: 12,
              }}
              labelFormatter={(v) => new Date(v as number).toLocaleString()}
              formatter={(val) => [`${Number(val).toFixed(2)}${meta.unit}`, '']}
            />
            {alertHigh != null && (
              <ReferenceLine y={alertHigh} stroke="#ef4444" strokeDasharray="4 4"
                             label={{ value: 'Alert high', position: 'insideTopRight', fontSize: 10 }} />
            )}
            {alertLow != null && (
              <ReferenceLine y={alertLow} stroke="#3b82f6" strokeDasharray="4 4"
                             label={{ value: 'Alert low', position: 'insideBottomRight', fontSize: 10 }} />
            )}
            <Line type="monotone" dataKey="avg" stroke={meta.color}
                  strokeWidth={2} dot={false} name={meta.label} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function formatTimeForRange(ms: number, range: Range): string {
  const d = new Date(ms);
  if (range === '1h' || range === '24h') {
    return d.getHours().toString().padStart(2, '0') + ':' +
           d.getMinutes().toString().padStart(2, '0');
  }
  if (range === '7d') {
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()] + ' ' +
           d.getHours().toString().padStart(2, '0') + ':00';
  }
  // 30d
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

// Client-side bucketing for when the sensor_chart RPC isn't available.
// Parses the bucket string (e.g. '10 minutes', '1 hour') to ms and
// groups raw readings into that window's avg/min/max.
function clientBucket(
  raw: { ts: string; value: number }[],
  bucketStr: string,
): ChartBucket[] {
  const ms = parseInterval(bucketStr);
  const buckets = new Map<number, number[]>();
  for (const r of raw) {
    const t = new Date(r.ts).getTime();
    const key = Math.floor(t / ms) * ms;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(r.value);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([k, vals]) => ({
      bucket_ts: new Date(k).toISOString(),
      avg_value: vals.reduce((s, v) => s + v, 0) / vals.length,
      min_value: Math.min(...vals),
      max_value: Math.max(...vals),
      sample_count: vals.length,
    }));
}

function parseInterval(s: string): number {
  const m = s.match(/^(\d+)\s*(second|minute|hour)/);
  if (!m) return 600_000; // default 10 min
  const n = parseInt(m[1], 10);
  const mult: Record<string, number> = {
    second: 1000,
    minute: 60_000,
    hour: 3_600_000,
  };
  return n * mult[m[2]];
}
