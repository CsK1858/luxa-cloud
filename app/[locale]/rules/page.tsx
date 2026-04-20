'use client';

// ============================================================
//  Luxa Cloud — Automation Rules List
//  (v2-group10, oturum 4/4)
//
//  Lists all automation_rules for the current user's devices.
//  Supports enable/disable toggle, delete, and "new rule" flow.
//  Rule editing lives in /rules/[id]/page.tsx — this page is
//  the overview + fast toggle surface.
// ============================================================

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import type { AutomationRule, Device, RuleCondition, RuleAction } from '@/lib/types';
import {
  Zap, Plus, ToggleLeft, ToggleRight, Trash2, ArrowLeft,
  Clock, Thermometer, User,
} from 'lucide-react';

export default function RulesPage() {
  const t = useTranslations('rules');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const [rRes, dRes] = await Promise.all([
      supabase.from('automation_rules').select('*').order('priority', { ascending: false }),
      supabase.from('devices').select('*'),
    ]);
    if (rRes.data) setRules(rRes.data);
    if (dRes.data) setDevices(dRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleEnabled = async (rule: AutomationRule) => {
    const supabase = createClient();
    await supabase.from('automation_rules')
      .update({ enabled: !rule.enabled })
      .eq('id', rule.id);
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
  };

  const deleteRule = async (rule: AutomationRule) => {
    if (!confirm(t('confirmDelete', { name: rule.name }))) return;
    const supabase = createClient();
    await supabase.from('automation_rules').delete().eq('id', rule.id);
    setRules(prev => prev.filter(r => r.id !== rule.id));
  };

  const createNew = async () => {
    if (devices.length === 0) {
      alert(t('needDevice'));
      return;
    }
    // Create a blank rule tied to the first device, then navigate to
    // the edit page. UUID generated server-side.
    const supabase = createClient();
    const { data } = await supabase.from('automation_rules').insert({
      device_id: devices[0].device_id,
      name: t('newRuleName'),
      enabled: false,
      priority: 50,
      rule: {
        condition: { type: 'sensor_above', slot_id: 0, channel: 'temp', threshold: 25 },
        action: { type: 'device_command', target: 'motor_1', command: 'close' },
      },
    }).select().single();
    if (data) router.push(`/${locale}/rules/${data.id}`);
  };

  const getDeviceName = (id: string) =>
    devices.find(d => d.device_id === id)?.name || id.slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/${locale}/dashboard`}
              className="inline-flex items-center text-sm text-luxa-muted hover:text-luxa-text mb-3 transition">
          <ArrowLeft className="w-4 h-4 mr-1" /> {tCommon('back')}
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-luxa-text">{t('title')}</h1>
            <p className="text-sm text-luxa-muted mt-1">{t('subtitle')}</p>
          </div>
          <button onClick={createNew}
                  className="flex items-center gap-2 px-4 py-2 bg-luxa-gold text-luxa-bg
                             text-sm font-semibold rounded-lg hover:bg-luxa-gold-light transition">
            <Plus size={16} /> {t('newRule')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-luxa-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-16 bg-luxa-bg-card border border-luxa-border rounded-xl">
          <Zap className="w-16 h-16 mx-auto mb-3 text-luxa-muted opacity-40" />
          <p className="text-luxa-muted">{t('noRules')}</p>
          <button onClick={createNew}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-luxa-gold
                             text-sm hover:underline">
            <Plus size={16} /> {t('createFirst')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <RuleRow key={rule.id}
                     rule={rule}
                     deviceName={getDeviceName(rule.device_id)}
                     onToggle={() => toggleEnabled(rule)}
                     onDelete={() => deleteRule(rule)}
                     locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

function RuleRow({
  rule, deviceName, onToggle, onDelete, locale,
}: {
  rule: AutomationRule;
  deviceName: string;
  onToggle: () => void;
  onDelete: () => void;
  locale: string;
}) {
  const conditionSummary = summarizeCondition(rule.rule?.condition);
  const actionSummary = summarizeAction(rule.rule?.action);

  return (
    <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-4
                    hover:border-luxa-gold/40 transition">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/${locale}/rules/${rule.id}`} className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`font-semibold ${rule.enabled ? 'text-luxa-text' : 'text-luxa-muted'}`}>
              {rule.name}
            </h3>
            {!rule.enabled && (
              <span className="text-[10px] px-1.5 py-0.5 bg-luxa-border/40 text-luxa-muted
                               rounded uppercase tracking-wide">
                Disabled
              </span>
            )}
          </div>
          <p className="text-sm text-luxa-muted">
            <span className="text-luxa-gold">{deviceName}</span> ·
            <span className="ml-1">{conditionSummary}</span> →
            <span className="ml-1">{actionSummary}</span>
          </p>
        </Link>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={(e) => { e.preventDefault(); onToggle(); }}
                  className="p-1.5 rounded hover:bg-luxa-border/40 transition"
                  title={rule.enabled ? 'Disable' : 'Enable'}>
            {rule.enabled
              ? <ToggleRight className="text-luxa-success" size={22} />
              : <ToggleLeft className="text-luxa-muted" size={22} />}
          </button>
          <button onClick={(e) => { e.preventDefault(); onDelete(); }}
                  className="p-1.5 rounded hover:bg-luxa-error/20 text-luxa-muted hover:text-luxa-error transition"
                  title="Delete">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function summarizeCondition(c: RuleCondition | undefined): string {
  if (!c) return '—';
  switch (c.type) {
    case 'sensor_above':
      return `sensor[${c.slot_id}].${c.channel} > ${c.threshold}`;
    case 'sensor_below':
      return `sensor[${c.slot_id}].${c.channel} < ${c.threshold}`;
    case 'time_range':
      return `time ${c.start}–${c.end}`;
    case 'presence':
      return `zone[${c.zone_id}] ${c.state}`;
    default:
      return '?';
  }
}

function summarizeAction(a: RuleAction | undefined): string {
  if (!a) return '—';
  switch (a.type) {
    case 'device_command':
      return `${a.target}: ${a.command}`;
    case 'scene':
      return `scene #${a.scene_id}`;
    case 'notify':
      return `notify: ${a.message.slice(0, 40)}`;
    default:
      return '?';
  }
}
