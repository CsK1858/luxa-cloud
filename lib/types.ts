export interface Device {
  id: string;
  device_id: string;
  mac_address: string | null;
  model: string;
  firmware: string | null;
  ip_address: string | null;
  activated: boolean;
  last_seen: string;
  status: DeviceStatus;
  user_id: string | null;
  name: string | null;
  created_at: string;
}

export interface DeviceStatus {
  uptime?: number;
  heap_free?: number;
  wifi_rssi?: number;
  device_count?: number;
  remote_count?: number;
  schedule_count?: number;
  radio_ok?: boolean;
  mqtt_ok?: boolean;
}

export interface Command {
  id: string;
  device_id: string;
  action: string;
  target: number;
  payload: string | null;
  status: 'pending' | 'executed' | 'failed' | 'expired';
  result: string | null;
  user_id: string | null;
  created_at: string;
  executed_at: string | null;
}

export interface ActivityEntry {
  id: string;
  device_id: string;
  action: string;
  target: number | null;
  result: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  locale: string;
  timezone: string;
}

export type DeviceAction =
  | 'motor_open' | 'motor_close' | 'motor_stop'
  | 'rts_up' | 'rts_down' | 'rts_my' | 'rts_prog';

// ============================================================
//  v2-group10 (oturum 4/4): Sensor platform types
//
//  Mirrors the Supabase schema in supabase/migrations/
//  20260420_001_luxa_platform.sql. Kept in sync manually; any
//  new column in SQL must be reflected here.
// ============================================================

// SensorType enum values match firmware's sensors/sensor_manager.h
export const SENSOR_TYPE_NAMES: Record<number, string> = {
  1: 'BME280', 2: 'BH1750', 3: 'SHT3X', 4: 'TSL2561', 5: 'DS18B20',
  6: 'Soil Moisture', 7: 'MQ-2 Gas', 8: 'MQ-135 Air', 9: 'Water Leak',
  10: 'Rain', 11: 'PIR Motion',
};

// Channel → display metadata
export const CHANNEL_META: Record<string, { label: string; unit: string; color: string; }> = {
  temp:     { label: 'Temperature', unit: '°C',   color: '#ef4444' },
  humidity: { label: 'Humidity',    unit: '%',    color: '#3b82f6' },
  pressure: { label: 'Pressure',    unit: 'hPa',  color: '#8b5cf6' },
  lux:      { label: 'Light',       unit: 'lx',   color: '#eab308' },
  soil:     { label: 'Soil',        unit: '%',    color: '#84cc16' },
  gas:      { label: 'Gas',         unit: '%',    color: '#f59e0b' },
  water:    { label: 'Water',       unit: '%',    color: '#06b6d4' },
  rain:     { label: 'Rain',        unit: '',     color: '#0ea5e9' },
  motion:   { label: 'Motion',      unit: '',     color: '#a855f7' },
};

export interface Sensor {
  id: string;
  device_id: string;
  slot_id: number;
  sensor_type: number;
  name: string;
  pin: number | null;
  enabled: boolean;
  offset_cal: number;
  scale_cal: number;
  alert_high: number | null;
  alert_low: number | null;
  alert_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SensorReading {
  device_id: string;
  slot_id: number;
  channel: string;
  value: number;
  raw_value: number | null;
  ts: string;
}

export interface ChartBucket {
  bucket_ts: string;
  avg_value: number;
  min_value: number;
  max_value: number;
  sample_count: number;
}

// AlarmType enum matches safety_manager.h
export const ALARM_TYPE_NAMES: Record<number, string> = {
  1: 'Smoke', 2: 'Gas', 3: 'Water Leak', 4: 'Frost',
  5: 'Overheat', 6: 'Carbon Monoxide', 7: 'Power Failure',
};

export const ALARM_TYPE_ICONS: Record<number, string> = {
  1: '🔥', 2: '⚠️', 3: '💧', 4: '❄️',
  5: '🌡️', 6: '☠️', 7: '⚡',
};

export interface SafetyEvent {
  id: number;
  device_id: string;
  device_name?: string;
  slot_id: number;
  alarm_type: number;
  alarm_type_name?: string;
  state: 'ok' | 'warning' | 'alarm' | 'silenced';
  value: number | null;
  ts: string;
  notified: boolean;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
}

export interface PresenceEvent {
  id: number;
  device_id: string;
  zone_id: number;
  zone_name: string | null;
  state: 'vacant' | 'motion' | 'stationary' | 'both';
  ts: string;
}

// Automation rule stored as JSONB in Supabase — the rule field has
// a flexible schema so the editor can evolve without SQL migrations.
// See supabase/migrations comment for canonical examples.
export interface AutomationRule {
  id: string;
  device_id: string;
  name: string;
  enabled: boolean;
  priority: number;
  rule: RuleDefinition;
  created_at: string;
  updated_at: string;
  last_applied_at: string | null;
}

// Canonical rule shape used by the rule editor. Firmware's
// rules_engine reads whatever shape it understands; this is the
// dashboard's supported subset.
export interface RuleDefinition {
  condition: RuleCondition;
  action: RuleAction;
}

export type RuleCondition =
  | { type: 'sensor_above'; slot_id: number; channel: string; threshold: number; }
  | { type: 'sensor_below'; slot_id: number; channel: string; threshold: number; }
  | { type: 'time_range'; start: string; end: string; }
  | { type: 'presence'; zone_id: number; state: string; };

export type RuleAction =
  | { type: 'device_command'; target: string; command: string; }
  | { type: 'scene'; scene_id: number; }
  | { type: 'notify'; message: string; };
