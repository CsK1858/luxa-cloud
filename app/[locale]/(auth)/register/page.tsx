'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase-client';
import Link from 'next/link';

export default function RegisterPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-luxa-success/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-luxa-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-luxa-text">{t('registerSuccess')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleRegister} className="space-y-4">
      <div>
        <label className="block text-sm text-luxa-muted mb-1">{t('fullName')}</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className="w-full px-4 py-3 bg-luxa-bg-card border border-luxa-border rounded-lg text-luxa-text focus:outline-none focus:border-luxa-gold"
        />
      </div>
      <div>
        <label className="block text-sm text-luxa-muted mb-1">{t('email')}</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 bg-luxa-bg-card border border-luxa-border rounded-lg text-luxa-text focus:outline-none focus:border-luxa-gold"
          placeholder="email@example.com"
        />
      </div>
      <div>
        <label className="block text-sm text-luxa-muted mb-1">{t('password')}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full px-4 py-3 bg-luxa-bg-card border border-luxa-border rounded-lg text-luxa-text focus:outline-none focus:border-luxa-gold"
          placeholder="••••••••"
        />
      </div>
      {error && <p className="text-luxa-error text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-luxa-gold text-luxa-bg font-semibold rounded-lg hover:bg-luxa-gold-light transition disabled:opacity-50"
      >
        {loading ? '...' : t('register')}
      </button>
      <p className="text-center text-sm text-luxa-muted">
        {t('hasAccount')}{' '}
        <Link href={`/${locale}/login`} className="text-luxa-gold hover:underline">
          {t('login')}
        </Link>
      </p>
    </form>
  );
}
