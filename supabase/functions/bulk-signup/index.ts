// supabase/functions/bulk-signup/index.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';

// Helper function to create Supabase admin client
function getSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = Deno?.env?.get('SUPABASE_URL') || process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = Deno?.env?.get('SUPABASE_SERVICE_ROLE_KEY') || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("[Bulk Signup] CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
    throw new Error("پیکربندی سرور ناقص است. لطفاً با مدیر سیستم تماس بگیرید.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });
}

// Main Edge Function
Deno.serve(async (req: Request) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let supabaseAdmin: SupabaseClient;
  try {
    supabaseAdmin = getSupabaseAdminClient();
  } catch (initError: any) {
    return new Response(JSON.stringify({ success: false, error: initError.message, errors: [initError.message] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  try {
    const body = await req.json();
    const { users, userType } = body;

    // Input validation
    if (!users || !Array.isArray(users) || !userType) {
      throw new Error('فیلدهای "users" (آرایه) و "userType" (رشته) الزامی هستند.');
    }

    const validUserTypes = ['admin', 'teacher', 'parent'];
    if (!validUserTypes.includes(userType)) {
      throw new Error(`مقدار "userType" نامعتبر است (${userType}). باید یکی از ${validUserTypes.join(', ')} باشد.`);
    }

    const errors: string[] = [];
    const results: { email: string; id: string; temp_student_name?: string }[] = [];
    let successCount = 0;

    for (const [index, user] of users.entries()) {
      const rowIndex = index + 1;
      let userId = '';
      const { email, password, full_name, username, temp_student_name } = user;

      try {
        if (!email || !password || !full_name || !username) {
          const missingFields = [];
          if (!email) missingFields.push("ایمیل");
          if (!password) missingFields.push("رمز عبور");
          if (!full_name) missingFields.push("نام کامل");
          if (!username) missingFields.push("نام کاربری");
          throw new Error(`ردیف ${rowIndex}: فیلدهای الزامی (${missingFields.join(', ')}) یافت نشد یا خالی هستند.`);
        }

        // Create Auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name, username },
        });

        if (authError) {
          if (authError.message.includes('already registered')) {
            throw new Error(`(ردیف ${rowIndex}: ${email}) - ایمیل قبلا ثبت شده است.`);
          }
          throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در ساخت کاربر Auth: ${authError.message}`);
        }

        userId = authData.user.id;

        // Insert profile
        const { error: profileInsertError } = await supabaseAdmin.from('profiles').insert({
          id: userId,
          full_name,
          username,
          email,
        });

        if (profileInsertError) {
          throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در ساخت پروفایل: ${profileInsertError.message}`);
        }

        // Insert role
        const { error: roleError } = await supabaseAdmin.from('user_roles').insert({
          user_id: userId,
          role: userType,
        });

        if (roleError) {
          throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در تخصیص نقش '${userType}': ${roleError.message}`);
        }

        // Insert teacher record if userType === 'teacher'
        if (userType === 'teacher') {
          const { error: teacherError } = await supabaseAdmin.from('teachers').insert({
            profile_id: userId,
          });
          if (teacherError) throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در ساخت رکورد معلم: ${teacherError.message}`);
        }

        results.push({ email, id: userId, temp_student_name });
        successCount++;

      } catch (userError: any) {
        errors.push(userError.message);

        // Rollback Auth user if created
        if (userId) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(userId);
          } catch (rollbackError: any) {
            errors.push(`(ردیف ${rowIndex}: ${email}) - خطا در بازگردانی عملیات: ${rollbackError.message}`);
          }
        }
      }
    }

    const overallSuccess = errors.length === 0 && users.length > 0;
    return new Response(JSON.stringify({ success: overallSuccess, successCount, errors, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message, errors: [error.message] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error instanceof SyntaxError ? 400 : 500,
    });
  }
});
