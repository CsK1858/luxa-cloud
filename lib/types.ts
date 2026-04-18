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
