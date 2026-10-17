import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

export const IDENTITY_HUB = 'https://user.th3scr1b3.art';

export interface Account {
  status: 'loading' | 'ready';
  user: User | null;
  /** Can publish lyrics to the vault (public.is_admin()). */
  isAdmin: boolean;
  displayName: string;
  avatarUrl: string | null;
}

/** The hub signs people in and sends them back here; the shared cookie does the rest. */
export function signInUrl(): string {
  return `${IDENTITY_HUB}/?redirect_uri=${encodeURIComponent(window.location.href)}`;
}

/**
 * The shared session can be a PIM guest (anonymous) account. Like the main site, a guest
 * counts as signed out here.
 */
function signedInUser(session: Session | null): User | null {
  const u = session?.user;
  return u && !u.is_anonymous ? u : null;
}

function nameFor(user: User | null): string {
  if (!user) return '';
  const m = user.user_metadata ?? {};
  const name = m.user_name || m.preferred_username || m.full_name || m.name;
  if (typeof name === 'string' && name.trim()) return name.trim();
  if (user.email) return user.email.split('@')[0];
  const wallet = typeof m.wallet_address === 'string' ? m.wallet_address : m.address;
  if (typeof wallet === 'string' && wallet.length > 10) return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
  return 'Signed in';
}

/** Attach anything this browser did anonymously (visits on every layer share th3_sid). */
function linkAnonymousActivity(userId: string) {
  const sessionId = window.th3Ecosystem?.sessionId;
  if (!sessionId) return;
  void supabase
    .rpc('link_anonymous_plays', { p_session_id: sessionId, p_user_id: userId })
    .then(({ error }) => {
      if (error) console.warn('[Auth] Failed to link anonymous activity:', error.message);
    });
}

export function useAccount(): Account {
  const [status, setStatus] = useState<Account['status']>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const apply = (session: Session | null) => {
      const next = signedInUser(session);
      setUser(next);
      setStatus('ready');
      if (!next) {
        setIsAdmin(false);
        return;
      }
      void supabase.rpc('is_admin').then(({ data, error }) => {
        if (!cancelled) setIsAdmin(!error && data === true);
      });
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      apply(data.session);
      const u = signedInUser(data.session);
      if (u) linkAnonymousActivity(u.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      apply(session);
      const u = signedInUser(session);
      if (event === 'SIGNED_IN' && u) linkAnonymousActivity(u.id);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const m = user?.user_metadata ?? {};
  return {
    status,
    user,
    isAdmin,
    displayName: nameFor(user),
    avatarUrl: typeof m.avatar_url === 'string' ? m.avatar_url : null,
  };
}
