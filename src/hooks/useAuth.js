import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function useAuth() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const actionPending = useRef(false);
  const sessionUser = session?.user ?? null;

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    // INITIAL_SESSION でOAuth帰還時・再読み込み時のセッションも復元する。
    // コールバック内でSupabaseの非同期APIを呼ばない。
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setProfile(null);
      if (nextSession) setError('');
      setSession(nextSession ? { ...nextSession } : null);
    });
    // OAuth帰還時のHook拒否・コード交換失敗を、ゲストメニューに通知する。
    supabase.auth.initialize().then(({ error: initializationError }) => {
      if (mounted && initializationError) setError('ログインできませんでした。管理者から招待・許可されたGoogleアカウントをご利用ください。');
    }).catch(() => {
      if (mounted) setError('ログインを確認できませんでした。接続を確認して、もう一度お試しください。');
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user) return;
    let active = true;
    const userId = session.user.id;
    async function rejectSession(message) {
      if (!active) return;
      setProfile({ userId, role: null, isAllowed: false });
      setError(message);
      setRejecting(true);
      try { await supabase.auth.signOut({ scope: 'local' }); }
      catch { /* 通信失敗でもアプリの会員権限は付与しない。DB側もcan_view()で拒否する。 */ }
      finally { if (active) setSession(null); setRejecting(false); }
    }
    async function loadProfile() {
      try {
        const { data, error: profileError } = await supabase.from('profiles')
          .select('role, is_allowed').eq('id', userId).maybeSingle();
        if (profileError) throw profileError;
        if (!active) return;
        if (data?.is_allowed !== true || !['admin', 'editor', 'viewer'].includes(data?.role)) {
          await rejectSession('このアカウントはログインを許可されていません。管理者に招待・許可をご依頼ください。');
          return;
        }
        setProfile({ userId, role: data.role, isAllowed: true });
      } catch {
        await rejectSession('利用許可を確認できなかったためログインできませんでした。接続を確認して、もう一度お試しください。');
      }
    }
    void loadProfile();
    // ログアウト・アカウント変更前の結果で権限を復活させない。
    return () => { active = false; };
  }, [session]);

  async function accountAction() {
    if (actionPending.current || rejecting || loading) return;
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

  const isAllowed = Boolean(sessionUser && profile?.userId === sessionUser.id && profile.isAllowed);
  const user = isAllowed ? sessionUser : null;
  const role = isAllowed ? profile.role : null;
  const canView = isAllowed && !busy && !rejecting;
  const canEdit = canView && (role === 'admin' || role === 'editor');
  const loading = rejecting || Boolean(supabase) && (session === undefined || Boolean(sessionUser && !profile));
  return { user, role, canView, canEdit, loading, busy: busy || rejecting, error, accountAction };
}
