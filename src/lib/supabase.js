import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// 設定前も既存ページを表示できるようにする。秘密キーは受け付けない。
export const supabase = url && key?.startsWith('sb_publishable_')
  ? createClient(url, key, { auth: { flowType: 'pkce' } })
  : null;
