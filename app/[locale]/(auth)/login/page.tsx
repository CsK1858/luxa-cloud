'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase-client';
import Link from 'next/link';

export default function LoginPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(t('invalidCredentials'));
      setLoading(false);
      return;
    }

    router.push(`/${locale}/dashboard`);
    router.refresh();
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
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
        {loading ? '...' : t('login')}
      </button>
      <p className="text-center text-sm text-luxa-muted">
        {t('noAccount')}{' '}
        <Link href={`/${locale}/register`} className="text-luxa-gold hover:underline">
          {t('register')}
        </Link>
      </p>
    </form>
  );
}
