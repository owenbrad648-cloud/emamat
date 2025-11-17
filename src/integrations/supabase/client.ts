import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// ✅ پشتیبانی از هر دو حالت: publishable key (در Lovable) و anon key (در Supabase مستقیم)
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;

const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY; // ← این خط مهم است

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Supabase environment variables are missing!');
  console.warn(
    'لطفاً مطمئن شوید مقادیر زیر در Environment Variables تنظیم شده‌اند:\n' +
    'VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY یا VITE_SUPABASE_ANON_KEY'
  );
}

// ✅ ایجاد کلاینت
export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
