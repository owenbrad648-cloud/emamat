import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { profile_id } = await req.json(); // ID کاربر (profile_id) را دریافت می‌کنیم

    if (!profile_id) {
      throw new Error('profile_id الزامی است');
    }

    // کلاینت ادمین با دسترسی کامل
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // ۱. حذف کاربر از Auth
    // این کار باید اول انجام شود.
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(profile_id);

    if (authError) {
      // اگر کاربر قبلاً حذف شده بود هم خطا نمی‌دهیم و ادامه می‌دهیم
      if (authError.message !== 'User not found') {
        throw new Error(`خطا در حذف کاربر Auth: ${authError.message}`);
      }
    }
    
    // ۲. حذف از جدول teachers
    // شما می‌توانید با استفاده از "Cascade Delete" در دیتابیس،
    // کاری کنید که با حذف پروفایل، رکوردهای teachers هم خودکار حذف شوند.
    // اما اگر اینکار را نکرده‌اید، دستی حذف کنید:
    const { error: teacherError } = await supabaseAdmin
      .from('teachers')
      .delete()
      .eq('profile_id', profile_id); // فرض می‌کنیم ستون شما 'profile_id' است

    if (teacherError) {
      console.warn(`خطا در حذف معلم از جدول teachers: ${teacherError.message}`);
      // ادامه می‌دهیم تا پروفایل حذف شود
    }

    // ۳. حذف از جدول profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', profile_id);

    if (profileError) {
      throw new Error(`خطا در حذف پروفایل: ${profileError.message}`);
    }

    return new Response(
      JSON.stringify({ message: 'کاربر، پروفایل و معلم با موفقیت حذف شدند' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});