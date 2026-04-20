'use client';

// ============================================================
//  Luxa Cloud — Automation Rule Editor
//  (v2-group10, oturum 4/4)
//
//  Edit a single automation_rule row. The rule JSONB field is
//  structured by RuleDefinition in lib/types.ts — this UI
//  provides typed forms for each variant of RuleCondition and
//  RuleAction so the user doesn't have to hand-write JSON.
//
//  Saved changes bump updated_at (trigger in migrations SQL) so
//  firmware's next pullAutomationRules() call sees a newer ts
//  and re-applies the rule locally.
// ============================================================

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import type {
  AutomationRule, Device, Sensor, RuleCondition, RuleAction,
} from '@/lib/types';
import { CHANNEL_META } from '@/lib/types';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';

type CondType = RuleCondition['type'];
type ActType = RuleAction['type'];

export default function RuleEditPage({
  params: { id, locale },
}: { params: { id: string; locale: string } }) {
  const t = useTranslations('rules');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [rule, setRule] = useState<AutomationRule | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from('automation_rules')
      .select('*').eq('id', id).single();
    if (data) {
      setRule(data);
      // Load sensors for the selected device so condition editor can
      // offer a slot_id dropdown instead of a bare number input.
      const { data: s } = await supabase.from('sensors')
        .select('*').eq('device_id', data.device_id).eq('enabled', true);
      if (s) setSensors(s);
    }
    const { data: d } = await supabase.from('devices').select('*');
    if (d) setDevices(d);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  // When user switches device, reload that device's sensors.
  const changeDevice = async (newDeviceId: string) => {
    if (!rule) return;
    setRule({ ...rule, device_id: newDeviceId });
    const supabase = createClient();
    const { data: s } = await supabase.from('sensors')
      .select('*').eq('device_id', newDeviceId).eq('enabled', true);
    setSensors(s || []);
  };

  const save = async () => {
    if (!rule) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('automation_rules').update({
      name: rule.name,
      enabled: rule.enabled,
      priority: rule.priority,
      device_id: rule.device_id,
      rule: rule.rule,
    }).eq('id', rule.id);
    setSaving(false);
    if (error) {
      alert(t('saveFailed') + ': ' + error.message);
    } else {
      router.push(`/${locale}/rules`);
    }
  };

  const remove = async () => {
    if (!rule) return;
    if (!confirm(t('confirmDelete', { name: rule.name }))) return;
    const supabase = createClient();
    await supabase.from('automation_rules').delete().eq('id', rule.id);
    router.push(`/${locale}/rules`);
  };

  if (loading || !rule) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-luxa-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/${locale}/rules`}
              className="inline-flex items-center text-sm text-luxa-muted hover:text-luxa-text mb-3 transition">
          <ArrowLeft className="w-4 h-4 mr-1" /> {tCommon('back')}
        </Link>
        <h1 className="text-xl font-bold text-luxa-text">{t('editRule')}</h1>
      </div>

      {/* Metadata */}
      <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-4 space-y-3">
        <Field label={t('name')}>
          <input type="text" value={rule.name}
                 onChange={e => setRule({ ...rule, name: e.target.value })}
                 className="luxa-input" />
        </Field>
        <Field label={t('device')}>
          <select value={rule.device_id}
                  onChange={e => changeDevice(e.target.value)}
                  className="luxa-input">
            {devices.map(d => (
              <option key={d.device_id} value={d.device_id}>
                {d.name || d.device_id.slice(0, 12)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('priority')}>
            <input type="number" min={0} max={100}
                   value={rule.priority}
                   onChange={e => setRule({ ...rule, priority: parseInt(e.target.value) || 50 })}
                   className="luxa-input" />
          </Field>
          <Field label={t('enabled')}>
            <label className="flex items-center gap-2 py-2">
              <input type="checkbox" checked={rule.enabled}
                     onChange={e => setRule({ ...rule, enabled: e.target.checked })}
                     className="w-4 h-4" />
              <span className="text-sm text-luxa-muted">
                {rule.enabled ? t('enabledHint') : t('disabledHint')}
              </span>
            </label>
          </Field>
        </div>
      </div>

      {/* Condition */}
      <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-luxa-gold mb-3">{t('whenCondition')}</h2>
        <ConditionEditor
          condition={rule.rule.condition}
          sensors={sensors}
          onChange={c => setRule({ ...rule, rule: { ...rule.rule, condition: c } })}
          t={t} />
      </div>

      {/* Action */}
      <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-luxa-gold mb-3">{t('thenAction')}</h2>
        <ActionEditor
          action={rule.rule.action}
          onChange={a => setRule({ ...rule, rule: { ...rule.rule, action: a } })}
          t={t} />
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button onClick={save} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-luxa-gold text-luxa-bg
                           text-sm font-semibold rounded-lg hover:bg-luxa-gold-light
                           disabled:opacity-50 transition">
          <Save size={16} />
          {saving ? tCommon('loading') : tCommon('save')}
        </button>
        <button onClick={remove}
                className="flex items-center gap-2 px-4 py-2 bg-luxa-error/10 border border-luxa-error/40
                           text-luxa-error text-sm font-semibold rounded-lg hover:bg-luxa-error/20 transition">
          <Trash2 size={16} />
          {tCommon('delete')}
        </button>
      </div>

      {/* Inline style block defining the shared input class.
          Tailwind @apply would be cleaner but this avoids a globals.css
          edit in this focused session. */}
      <style jsx>{`
        :global(.luxa-input) {
          background: var(--luxa-bg, rgba(0,0,0,0.2));
          border: 1px solid var(--luxa-border, rgba(255,255,255,0.1));
          color: var(--luxa-text, #e5e7eb);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          width: 100%;
          font-size: 0.875rem;
        }
        :global(.luxa-input:focus) {
          outline: none;
          border-color: var(--luxa-gold, #c9963b);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide text-luxa-muted mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function ConditionEditor({
  condition, sensors, onChange, t,
}: {
  condition: RuleCondition;
  sensors: Sensor[];
  onChange: (c: RuleCondition) => void;
  t: (k: string) => string;
}) {
  const type = condition.type;

  const changeType = (newType: CondType) => {
    // Reset to defaults for the selected type.
    switch (newType) {
      case 'sensor_above':
        onChange({ type: 'sensor_above', slot_id: sensors[0]?.slot_id ?? 0, channel: 'temp', threshold: 25 });
        break;
      case 'sensor_below':
        onChange({ type: 'sensor_below', slot_id: sensors[0]?.slot_id ?? 0, channel: 'temp', threshold: 10 });
        break;
      case 'time_range':
        onChange({ type: 'time_range', start: '22:00', end: '07:00' });
        break;
      case 'presence':
        onChange({ type: 'presence', zone_id: 0, state: 'vacant' });
        break;
    }
  };

  return (
    <div className="space-y-3">
      <Field label={t('condType')}>
        <select value={type} onChange={e => changeType(e.target.value as CondType)}
                className="luxa-input">
          <option value="sensor_above">{t('cond.sensor_above')}</option>
          <option value="sensor_below">{t('cond.sensor_below')}</option>
          <option value="time_range">{t('cond.time_range')}</option>
          <option value="presence">{t('cond.presence')}</option>
        </select>
      </Field>

      {(condition.type === 'sensor_above' || condition.type === 'sensor_below') && (
        <>
          <Field label={t('sensor')}>
            <select value={condition.slot_id}
                    onChange={e => onChange({ ...condition, slot_id: parseInt(e.target.value) })}
                    className="luxa-input">
              {sensors.length === 0 ? (
                <option value={0}>{t('noSensorsHint')}</option>
              ) : sensors.map(s => (
                <option key={s.slot_id} value={s.slot_id}>
                  {s.name} (slot {s.slot_id})
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('channel')}>
              <select value={condition.channel}
                      onChange={e => onChange({ ...condition, channel: e.target.value })}
                      className="luxa-input">
                {Object.entries(CHANNEL_META).map(([ch, m]) => (
                  <option key={ch} value={ch}>{m.label}</option>
                ))}
              </select>
            </Field>
            <Field label={t('threshold')}>
              <input type="number" step="0.1" value={condition.threshold}
                     onChange={e => onChange({ ...condition, threshold: parseFloat(e.target.value) || 0 })}
                     className="luxa-input" />
            </Field>
          </div>
        </>
      )}

      {condition.type === 'time_range' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('timeStart')}>
            <input type="time" value={condition.start}
                   onChange={e => onChange({ ...condition, start: e.target.value })}
                   className="luxa-input" />
          </Field>
          <Field label={t('timeEnd')}>
            <input type="time" value={condition.end}
                   onChange={e => onChange({ ...condition, end: e.target.value })}
                   className="luxa-input" />
          </Field>
        </div>
      )}

      {condition.type === 'presence' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('zoneId')}>
            <input type="number" min={0} max={15} value={condition.zone_id}
                   onChange={e => onChange({ ...condition, zone_id: parseInt(e.target.value) || 0 })}
                   className="luxa-input" />
          </Field>
          <Field label={t('state')}>
            <select value={condition.state}
                    onChange={e => onChange({ ...condition, state: e.target.value })}
                    className="luxa-input">
              <option value="vacant">vacant</option>
              <option value="motion">motion</option>
              <option value="stationary">stationary</option>
              <option value="both">both</option>
            </select>
          </Field>
        </div>
      )}
    </div>
  );
}

function ActionEditor({
  action, onChange, t,
}: {
  action: RuleAction;
  onChange: (a: RuleAction) => void;
  t: (k: string) => string;
}) {
  const changeType = (newType: ActType) => {
    switch (newType) {
      case 'device_command':
        onChange({ type: 'device_command', target: 'motor_1', command: 'close' });
        break;
      case 'scene':
        onChange({ type: 'scene', scene_id: 1 });
        break;
      case 'notify':
        onChange({ type: 'notify', message: 'Rule triggered' });
        break;
    }
  };

  return (
    <div className="space-y-3">
      <Field label={t('actType')}>
        <select value={action.type} onChange={e => changeType(e.target.value as ActType)}
                className="luxa-input">
          <option value="device_command">{t('act.device_command')}</option>
          <option value="scene">{t('act.scene')}</option>
          <option value="notify">{t('act.notify')}</option>
        </select>
      </Field>

      {action.type === 'device_command' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('target')}>
            <input type="text" value={action.target} placeholder="motor_1, rts_0, ..."
                   onChange={e => onChange({ ...action, target: e.target.value })}
                   className="luxa-input" />
          </Field>
          <Field label={t('command')}>
            <select value={action.command}
                    onChange={e => onChange({ ...action, command: e.target.value })}
                    className="luxa-input">
              <option value="open">open</option>
              <option value="close">close</option>
              <option value="stop">stop</option>
              <option value="up">up</option>
              <option value="down">down</option>
              <option value="my">my (preset)</option>
            </select>
          </Field>
        </div>
      )}

      {action.type === 'scene' && (
        <Field label={t('sceneId')}>
          <input type="number" min={1} max={255} value={action.scene_id}
                 onChange={e => onChange({ ...action, scene_id: parseInt(e.target.value) || 1 })}
                 className="luxa-input" />
        </Field>
      )}

      {action.type === 'notify' && (
        <Field label={t('message')}>
          <textarea value={action.message} rows={2}
                    onChange={e => onChange({ ...action, message: e.target.value })}
                    className="luxa-input resize-none" />
        </Field>
      )}
    </div>
  );
}
