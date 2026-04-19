'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { User, Mail, Globe, Clock, Shield, Save, Check } from 'lucide-react';

const TIMEZONES = [
  'Europe/Istanbul',
  'Europe/Amsterdam',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const LOCALES = [
  { code: 'tr', label: 'Turkce' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'fr', label: 'Francais' },
];

export default function ProfilePage() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [userLocale, setUserLocale] = useState(locale);
  const [timezone, setTimezone] = useState('Europe/Istanbul');
  const [deviceCount, setDeviceCount] = useState(0);
  const [memberSince, setMemberSince] = useState('');

  // Password change
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setEmail(user.email || '');
    setMemberSince(new Date(user.created_at).toLocaleDateString(locale, {
      year: 'numeric', month: 'long', day: 'numeric'
    }));

    // Load profile from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      setFullName(profile.full_name || '');
      setUserLocale(profile.locale || locale);
      setTimezone(profile.timezone || 'Europe/Istanbul');
    } else {
      // Fallback to auth metadata
      setFullName(user.user_metadata?.full_name || '');
    }

    // Count devices
    const { count } = await supabase
      .from('devices')
      .select('*', { count: 'exact', head: true });
    setDeviceCount(count || 0);

    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        locale: userLocale,
        timezone: timezone,
      })
      .eq('id', user.id);

    if (!error) {
      setSaved(true);
      // If locale changed, redirect to new locale
      if (userLocale !== locale) {
        const path = `/${userLocale}/profile`;
        router.push(path);
      }
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  const handlePasswordChange = async () => {
    setPasswordMsg(null);
    if (newPassword.length < 6) {
      setPasswordMsg({ text: t('passwordTooShort'), ok: false });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: t('passwordMismatch'), ok: false });
      return;
    }

    setChangingPassword(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPasswordMsg({ text: error.message, ok: false });
    } else {
      setPasswordMsg({ text: t('passwordChanged'), ok: true });
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordChange(false);
    }
    setChangingPassword(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-luxa-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-luxa-text">{t('title')}</h1>

      {/* Profile Info */}
      <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-6 space-y-5">
        {/* Avatar / initials */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-luxa-gold/20 flex items-center justify-center">
            <span className="text-2xl font-bold text-luxa-gold">
              {fullName ? fullName.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-luxa-text font-semibold">{fullName || email}</p>
            <p className="text-sm text-luxa-muted">{email}</p>
          </div>
        </div>

        {/* Full Name */}
        <div>
          <label className="flex items-center gap-2 text-sm text-luxa-muted mb-1.5">
            <User size={14} /> {t('fullName')}
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-3 bg-luxa-bg border border-luxa-border rounded-lg text-luxa-text focus:outline-none focus:border-luxa-gold"
          />
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="flex items-center gap-2 text-sm text-luxa-muted mb-1.5">
            <Mail size={14} /> {t('email')}
          </label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full px-4 py-3 bg-luxa-bg border border-luxa-border rounded-lg text-luxa-muted cursor-not-allowed"
          />
        </div>

        {/* Language */}
        <div>
          <label className="flex items-center gap-2 text-sm text-luxa-muted mb-1.5">
            <Globe size={14} /> {t('language')}
          </label>
          <select
            value={userLocale}
            onChange={(e) => setUserLocale(e.target.value)}
            className="w-full px-4 py-3 bg-luxa-bg border border-luxa-border rounded-lg text-luxa-text focus:outline-none focus:border-luxa-gold"
          >
            {LOCALES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* Timezone */}
        <div>
          <label className="flex items-center gap-2 text-sm text-luxa-muted mb-1.5">
            <Clock size={14} /> {t('timezone')}
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full px-4 py-3 bg-luxa-bg border border-luxa-border rounded-lg text-luxa-text focus:outline-none focus:border-luxa-gold"
          >
            {TIMEZONES.map(tz => (
              <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 bg-luxa-gold text-luxa-bg font-semibold rounded-lg hover:bg-luxa-gold-light transition disabled:opacity-50"
        >
          {saved ? <Check size={18} /> : <Save size={18} />}
          {saving ? '...' : saved ? t('saved') : tCommon('save')}
        </button>
      </div>

      {/* Security */}
      <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-6 space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-luxa-muted uppercase tracking-wider">
          <Shield size={14} /> {t('security')}
        </h2>

        {!showPasswordChange ? (
          <button
            onClick={() => setShowPasswordChange(true)}
            className="w-full py-3 text-sm text-luxa-text border border-luxa-border rounded-lg hover:border-luxa-gold transition"
          >
            {t('changePassword')}
          </button>
        ) : (
          <div className="space-y-3">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('newPassword')}
              minLength={6}
              className="w-full px-4 py-3 bg-luxa-bg border border-luxa-border rounded-lg text-luxa-text focus:outline-none focus:border-luxa-gold"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('confirmPassword')}
              className="w-full px-4 py-3 bg-luxa-bg border border-luxa-border rounded-lg text-luxa-text focus:outline-none focus:border-luxa-gold"
            />
            {passwordMsg && (
              <p className={`text-sm ${passwordMsg.ok ? 'text-luxa-success' : 'text-luxa-error'}`}>
                {passwordMsg.text}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowPasswordChange(false); setNewPassword(''); setConfirmPassword(''); setPasswordMsg(null); }}
                className="flex-1 py-2 text-sm text-luxa-muted border border-luxa-border rounded-lg hover:bg-luxa-bg"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={handlePasswordChange}
                disabled={changingPassword}
                className="flex-1 py-2 text-sm bg-luxa-gold text-luxa-bg font-semibold rounded-lg hover:bg-luxa-gold-light transition disabled:opacity-50"
              >
                {changingPassword ? '...' : tCommon('save')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Account stats */}
      <div className="bg-luxa-bg-card border border-luxa-border rounded-xl p-6 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-luxa-muted">{t('memberSince')}</span>
          <span className="text-luxa-text">{memberSince}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-luxa-muted">{t('connectedDevices')}</span>
          <span className="text-luxa-text">{deviceCount}</span>
        </div>
      </div>
    </div>
  );
}
