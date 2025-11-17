-- Enable RLS on evaluations and add row-level policies

-- IMPORTANT: Review and run this migration in your Supabase project (or via supabase migrations)

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- 1) Admins: full access
CREATE POLICY "Admins full access on evaluations"
  ON public.evaluations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- 2) Teachers: allow inserting/updating/selecting/deleting evaluations they recorded (recorded_by = auth.uid())
CREATE POLICY "Teachers manage own recorded evaluations"
  ON public.evaluations
  FOR ALL
  USING (recorded_by = auth.uid())
  WITH CHECK (recorded_by = auth.uid());

-- 3) Teachers: allow viewing evaluations for classes they teach (class_subjects.teacher_id -> teachers.id where teachers.profile_id = auth.uid())
CREATE POLICY "Teachers view evaluations for their classes"
  ON public.evaluations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.teachers t
      JOIN public.class_subjects cs ON cs.teacher_id = t.id
      WHERE t.profile_id = auth.uid() AND cs.class_id = public.evaluations.class_id
    )
  );

-- 4) Parents: allow viewing evaluations for their children (students.parent_id = auth.uid())
CREATE POLICY "Parents can view their children evaluations"
  ON public.evaluations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.students s WHERE s.id = public.evaluations.student_id AND s.parent_id = auth.uid()
    )
  );

-- 5) Allow authenticated users to SELECT basic rows if they are the recorder or admin (defensive)
CREATE POLICY "Allow recorder or admin select"
  ON public.evaluations
  FOR SELECT
  USING (
    recorded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

-- NOTES:
-- - The "Teachers manage own recorded evaluations" policy allows teachers to insert rows only if `recorded_by = auth.uid()`; ensure the frontend supplies that field on insert/upsert.
-- - If you want teachers to be able to insert an evaluation for their colleague (i.e., recorded_by != auth.uid()), you'll need a different policy or an admin workflow.
-- - Review the policies and test in your Supabase project. If you use the browser anon key for writes that should be allowed, ensure the policy conditions match the authenticated user's id and role.
-- - If you instead perform writes from a server or Edge Function, prefer using the service_role key on the server to bypass RLS (use with caution; do not expose the service key to browsers).