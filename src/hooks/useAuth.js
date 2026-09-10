import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function useAuth() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const actionPending = useRef(false);
  const user = session?.user ?? null;

  useEffect(() => {
    if (!supabase) return;
    // INITIAL_SESSION でOAuth帰還時・再読み込み時のセッションも復元する。
    // コールバック内でSupabaseの非同期APIを呼ばない。
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setProfile(null);
      setError('');
      setSession(nextSession ? { ...nextSession } : null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user) return;
    let active = true;
    const userId = session.user.id;
    async function loadProfile() {
      try {
        const { data, error: profileError } = await supabase.from('profiles')
          .select('role, is_allowed').eq('id', userId).maybeSingle();
        if (profileError) throw profileError;
        if (active) setProfile({ userId, role: ['admin', 'editor', 'viewer'].includes(data?.role) ? data.role : null, isAllowed: data?.is_allowed === true });
      } catch {
        if (active) {
          setProfile({ userId, role: null, isAllowed: false });
          setError('権限を取得できませんでした。現在は閲覧のみです。');
        }
      }
    }
    void loadProfile();
    // ログアウト・アカウント変更前の結果で権限を復活させない。
    return () => { active = false; };
  }, [session]);

  async function accountAction() {
    if (actionPending.current) return;
    if (!supabase) {
      window.alert('Googleログインには .env の Supabase URL と Publishable Key の設定が必要です。');
      return;
    }
    actionPending.current = true;
    setBusy(true);
    setError('');
    try {
      const { error: authError } = user
        ? await supabase.auth.signOut({ scope: 'local' })
        : await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } });
      if (authError) throw authError;
      if (user) { setProfile(null); setSession(null); }
    } catch {
      const message = user ? 'ログアウトに失敗しました。もう一度お試しください。' : 'Googleログインを開始できませんでした。もう一度お試しください。';
      setError(message);
      window.alert(message);
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }

  const role = user && profile?.userId === user.id ? profile.role : null;
  const canEdit = !busy && profile?.isAllowed === true && (role === 'admin' || role === 'editor');
  return { user, role, canEdit, loading: Boolean(supabase) && (session === undefined || Boolean(user && !profile)), busy, error, accountAction };
}
